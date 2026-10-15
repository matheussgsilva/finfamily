"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import { getDueOccurrences } from "@/lib/recurrence";
import { checkBudget } from "@/actions/transaction.actions";
import type { Prisma } from "@/generated/prisma";
import type { ActionResult } from "@/types";

/**
 * Gera as ocorrências pendentes de todas as recorrências ativas do usuário
 * (a raiz mais a última ocorrência já lançada definem a partir de qual data
 * contar). Chamada como efeito colateral silencioso ao abrir o app.
 *
 * Roda dentro de uma transação com um advisory lock por usuário: chamadas
 * simultâneas (duas abas, StrictMode em dev) ficam em fila e a segunda já
 * enxerga o que a primeira lançou, em vez de duplicar as ocorrências.
 */
export async function generateDueRecurringTransactions(): Promise<{
  createdCount: number;
  budgetAlerts: string[];
}> {
  const userId = await getRequiredUserId();
  const today = new Date();

  const created = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const roots = await tx.transaction.findMany({
        where: { userId, isRecurring: true, parentId: null, recurrenceRule: { not: null } },
      });

      const rows: Prisma.TransactionCreateManyInput[] = [];
      for (const root of roots) {
        const latest = await tx.transaction.aggregate({
          where: { userId, OR: [{ id: root.id }, { parentId: root.id }] },
          _max: { date: true },
        });
        const lastDate = latest._max.date ?? root.date;

        for (const date of getDueOccurrences(root.date, lastDate, today)) {
          rows.push({
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
          });
        }
      }

      if (rows.length > 0) await tx.transaction.createMany({ data: rows });
      return rows;
    },
    { timeout: 15_000 }
  );

  if (created.length === 0) {
    return { createdCount: 0, budgetAlerts: [] };
  }

  // Alertas de orçamento só depois do commit, fora da transação (e sem repetir
  // a mesma mensagem para várias ocorrências da mesma categoria/mês).
  const budgetAlerts = new Set<string>();
  for (const row of created) {
    if (row.type !== "EXPENSE") continue;
    const alert = await checkBudget(userId, row.categoryId ?? null, new Date(row.date));
    if (alert) budgetAlerts.add(alert);
  }

  revalidatePath("/fluxo-de-caixa");
  revalidatePath("/dashboard");
  revalidatePath("/fluxo-de-caixa/recorrencias");

  return { createdCount: created.length, budgetAlerts: [...budgetAlerts] };
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
