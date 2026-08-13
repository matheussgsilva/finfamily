"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { budgetSchema, type BudgetInput } from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";

export async function upsertBudget(input: BudgetInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = budgetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const category = await db.category.findFirst({
      where: { id: data.categoryId, OR: [{ userId }, { userId: null }] },
    });
    if (!category) {
      return { success: false, error: "Categoria inválida." };
    }

    await db.budget.upsert({
      where: {
        categoryId_month_year_userId: {
          categoryId: data.categoryId,
          month: data.month,
          year: data.year,
          userId,
        },
      },
      update: { amount: data.amount },
      create: {
        categoryId: data.categoryId,
        amount: data.amount,
        month: data.month,
        year: data.year,
        userId,
      },
    });

    revalidatePath("/fluxo-de-caixa/orcamentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    return { success: false, error: "Erro interno ao salvar o orçamento." };
  }
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.budget.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Orçamento não encontrado." };
    }

    await db.budget.delete({ where: { id } });

    revalidatePath("/fluxo-de-caixa/orcamentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir orçamento:", error);
    return { success: false, error: "Erro interno ao excluir o orçamento." };
  }
}
