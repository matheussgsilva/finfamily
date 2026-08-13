"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactionSchema, type TransactionInput } from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";
import { addMonths } from "date-fns";

export async function createTransaction(input: TransactionInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    // Validações específicas por tipo
    if (data.type === "TRANSFER") {
      if (!data.destinationAccountId) {
        return { success: false, error: "Selecione a conta de destino da transferência." };
      }
      if (data.destinationAccountId === data.bankAccountId) {
        return { success: false, error: "As contas de origem e destino devem ser diferentes." };
      }
    }

    // Validação de categoria por tipo
    if (data.type !== "TRANSFER") {
      const category = data.categoryId
        ? await db.category.findFirst({
            where: { id: data.categoryId, OR: [{ userId }, { userId: null }] },
          })
        : null;
      if (data.categoryId && !category) {
        return { success: false, error: "Categoria inválida." };
      }
    }

    const account = await db.bankAccount.findFirst({
      where: { id: data.bankAccountId, userId },
    });
    if (!account) {
      return { success: false, error: "Conta inválida." };
    }

    const installments = data.installments ?? null;
    const total = data.amount;

    // Se parcelado, distribuir em N transações mensais
    if (installments && installments > 1) {
      let parentId: string | null = null;

      for (let i = 1; i <= installments; i++) {
        const installmentDate = addMonths(data.date, i - 1);
        const created: { id: string } = await db.transaction.create({
          data: {
            description:
              i === 1 ? data.description : `${data.description} (${i}/${installments})`,
            amount: Number(total.toFixed(2)),
            type: data.type,
            date: installmentDate,
            notes: data.notes ?? null,
            tags: data.tags,
            categoryId: data.type === "TRANSFER" ? null : (data.categoryId ?? null),
            bankAccountId: data.bankAccountId,
            destinationAccountId:
              data.type === "TRANSFER" ? (data.destinationAccountId ?? null) : null,
            familyMemberId: data.familyMemberId ?? null,
            installments,
            installmentNum: i,
            parentId: parentId ?? null,
            userId,
          },
        });
        if (!parentId) {
          parentId = created.id;
          await db.transaction.update({
            where: { id: created.id },
            data: { parentId: created.id },
          });
        }
      }
    } else {
      await db.transaction.create({
        data: {
          description: data.description,
          amount: total,
          type: data.type,
          date: data.date,
          notes: data.notes ?? null,
          tags: data.tags,
          isRecurring: data.isRecurring,
          recurrenceRule: data.recurrenceRule ?? null,
          categoryId: data.type === "TRANSFER" ? null : (data.categoryId ?? null),
          bankAccountId: data.bankAccountId,
          destinationAccountId:
            data.type === "TRANSFER" ? (data.destinationAccountId ?? null) : null,
          familyMemberId: data.familyMemberId ?? null,
          userId,
        },
      });
    }

    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return { success: false, error: "Erro interno ao criar a transação." };
  }
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const existing = await db.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!existing) {
      return { success: false, error: "Transação não encontrada." };
    }

    // Não permite editar individualmente uma parcela de série
    if (existing.installmentNum && existing.installmentNum > 1 && existing.parentId) {
      return {
        success: false,
        error: "Edite a transação original da série de parcelas.",
      };
    }

    if (data.type === "TRANSFER") {
      if (!data.destinationAccountId) {
        return { success: false, error: "Selecione a conta de destino da transferência." };
      }
    }

    await db.transaction.update({
      where: { id },
      data: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        date: data.date,
        notes: data.notes ?? null,
        tags: data.tags,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule ?? null,
        categoryId: data.type === "TRANSFER" ? null : (data.categoryId ?? null),
        bankAccountId: data.bankAccountId,
        destinationAccountId:
          data.type === "TRANSFER" ? (data.destinationAccountId ?? null) : null,
        familyMemberId: data.familyMemberId ?? null,
      },
    });

    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
    return { success: false, error: "Erro interno ao atualizar a transação." };
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Transação não encontrada." };
    }

    const isParent = existing.parentId === id;
    const seriesIds = isParent
      ? (await db.transaction.findMany({
          where: { parentId: id, userId },
          select: { id: true },
        })).map((t) => t.id)
      : [];

    // Excluir a série completa ou apenas a transação
    await db.transaction.deleteMany({
      where: { id: { in: [...seriesIds, id] } },
    });

    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
    return { success: false, error: "Erro interno ao excluir a transação." };
  }
}
