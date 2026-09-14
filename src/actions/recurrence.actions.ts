"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import { getDueOccurrences } from "@/lib/recurrence";
import { checkBudget } from "@/actions/transaction.actions";
import type { ActionResult } from "@/types";

/**
 * Gera as ocorrências pendentes de todas as recorrências ativas do usuário
 * (a raiz mais a última ocorrência já lançada definem a partir de qual data
 * contar). Chamada como efeito colateral silencioso ao abrir o app.
 */
export async function generateDueRecurringTransactions(): Promise<{
  createdCount: number;
  budgetAlerts: string[];
}> {
  const userId = await getRequiredUserId();
  const today = new Date();

  const roots = await db.transaction.findMany({
    where: { userId, isRecurring: true, parentId: null, recurrenceRule: { not: null } },
  });

  if (roots.length === 0) {
    return { createdCount: 0, budgetAlerts: [] };
  }

  const budgetAlerts: string[] = [];
  let createdCount = 0;

  for (const root of roots) {
    const latest = await db.transaction.aggregate({
      where: { userId, OR: [{ id: root.id }, { parentId: root.id }] },
      _max: { date: true },
    });
    const lastDate = latest._max.date ?? root.date;

    const dueDates = getDueOccurrences(lastDate, today);
    for (const date of dueDates) {
      await db.transaction.create({
        data: {
          description: root.description,
          amount: root.amount,
          type: root.type,
          date,
          notes: root.notes,
          tags: root.tags,
          isRecurring: true,
          recurrenceRule: root.recurrenceRule,
          categoryId: root.categoryId,
          bankAccountId: root.bankAccountId,
          destinationAccountId: root.destinationAccountId,
          familyMemberId: root.familyMemberId,
          parentId: root.id,
          userId,
        },
      });
      createdCount++;

      if (root.type === "EXPENSE") {
        const alert = await checkBudget(userId, root.categoryId, date);
        if (alert) budgetAlerts.push(alert);
      }
    }
  }

  if (createdCount > 0) {
    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    revalidatePath("/fluxo-de-caixa/recorrencias");
  }

  return { createdCount, budgetAlerts };
}

export async function stopRecurrence(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.transaction.findFirst({
      where: { id, userId, parentId: null, isRecurring: true },
    });
    if (!existing) {
      return { success: false, error: "Recorrência não encontrada." };
    }

    await db.transaction.update({
      where: { id },
      data: { isRecurring: false },
    });

    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    revalidatePath("/fluxo-de-caixa/recorrencias");
    return { success: true };
  } catch (error) {
    console.error("Erro ao encerrar recorrência:", error);
    return { success: false, error: "Erro interno ao encerrar a recorrência." };
  }
}
