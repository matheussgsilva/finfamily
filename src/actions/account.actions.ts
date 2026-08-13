"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accountSchema, type AccountInput } from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";

export async function createAccount(input: AccountInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    await db.bankAccount.create({
      data: {
        name: data.name,
        type: data.type,
        balance: data.balance,
        creditLimit: data.creditLimit ?? null,
        closingDay: data.closingDay ?? null,
        dueDay: data.dueDay ?? null,
        color: data.color,
        icon: data.icon ?? null,
        userId,
      },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return { success: false, error: "Erro interno ao criar a conta." };
  }
}

export async function updateAccount(
  id: string,
  input: AccountInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    // Garantir que a conta pertence ao usuário
    const existing = await db.bankAccount.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Conta não encontrada." };
    }

    await db.bankAccount.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        balance: data.balance,
        creditLimit: data.creditLimit ?? null,
        closingDay: data.closingDay ?? null,
        dueDay: data.dueDay ?? null,
        color: data.color,
        icon: data.icon ?? null,
      },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    return { success: false, error: "Erro interno ao atualizar a conta." };
  }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.bankAccount.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Conta não encontrada." };
    }

    const txCount = await db.transaction.count({
      where: { OR: [{ bankAccountId: id }, { destinationAccountId: id }] },
    });
    if (txCount > 0) {
      return {
        success: false,
        error: "Esta conta possui transações vinculadas. Exclua-as primeiro.",
      };
    }

    await db.bankAccount.delete({ where: { id } });

    revalidatePath("/configuracoes");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    return { success: false, error: "Erro interno ao excluir a conta." };
  }
}
