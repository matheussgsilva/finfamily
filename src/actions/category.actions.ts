"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categorySchema, type CategoryInput } from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    await db.category.create({
      data: {
        name: data.name,
        type: data.type,
        color: data.color,
        icon: data.icon ?? null,
        parentId: data.parentId ?? null,
        userId,
      },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    return { success: false, error: "Erro interno ao criar a categoria." };
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const existing = await db.category.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return { success: false, error: "Categoria não encontrada." };
    }

    await db.category.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        color: data.color,
        icon: data.icon ?? null,
        parentId: data.parentId ?? null,
      },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    return { success: false, error: "Erro interno ao atualizar a categoria." };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Categoria não encontrada." };
    }

    const [txCount, budgetCount] = await Promise.all([
      db.transaction.count({ where: { categoryId: id } }),
      db.budget.count({ where: { categoryId: id } }),
    ]);
    if (txCount > 0 || budgetCount > 0) {
      return {
        success: false,
        error: "Esta categoria possui transações ou orçamentos vinculados.",
      };
    }

    // Remover vínculo dos filhos (se existirem)
    await db.category.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    await db.category.delete({ where: { id } });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    return { success: false, error: "Erro interno ao excluir a categoria." };
  }
}
