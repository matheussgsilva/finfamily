"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import {
  historyKey,
  normalizeDescription,
  suggestCategory,
  type RuleForMatching,
} from "@/lib/categorization";
import {
  importConfirmSchema,
  importPreviewSchema,
  type ImportConfirmInput,
  type ImportPreviewInput,
} from "@/lib/validations";
import type { ActionResult, ImportPreviewRow } from "@/types";

/** Quantas transações categorizadas recentes alimentam a sugestão pelo histórico. */
const HISTORY_SIZE = 2000;

const toCents = (value: number) => Math.round(Math.abs(value) * 100);
/** Datas importadas seguem o padrão do formulário de transação: meia-noite UTC do dia. */
const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dateToDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Recebe os lançamentos já lidos do OFX (o parse acontece no navegador) e
 * devolve a prévia: o que já foi importado, possíveis duplicatas de lançamentos
 * manuais e a categoria sugerida por regra ou histórico.
 */
export async function previewOfxImport(
  input: ImportPreviewInput
): Promise<ActionResult<{ rows: ImportPreviewRow[] }>> {
  try {
    const userId = await getRequiredUserId();
    const parsed = importPreviewSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const { bankAccountId, rows } = parsed.data;

    const account = await db.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
    if (!account) {
      return { success: false, error: "Conta inválida." };
    }

    const days = rows.map((r) => r.date).sort();
    const [alreadyImported, manualInRange, rules, history] = await Promise.all([
      db.transaction.findMany({
        where: { bankAccountId, externalId: { in: rows.map((r) => r.fitId) } },
        select: { externalId: true },
      }),
      db.transaction.findMany({
        where: {
          userId,
          bankAccountId,
          externalId: null,
          date: { gte: dayToDate(days[0]), lte: new Date(`${days[days.length - 1]}T23:59:59.999Z`) },
        },
        select: { date: true, amount: true, type: true },
      }),
      db.categorizationRule.findMany({
        where: { userId },
        include: { category: { select: { type: true } } },
      }),
      db.transaction.findMany({
        where: { userId, categoryId: { not: null }, type: { in: ["INCOME", "EXPENSE"] } },
        select: { description: true, type: true, categoryId: true },
        orderBy: { date: "desc" },
        take: HISTORY_SIZE,
      }),
    ]);

    const importedIds = new Set(alreadyImported.map((t) => t.externalId));

    // Contador por (dia, tipo, valor): dois lançamentos manuais iguais no mesmo
    // dia só "cobrem" duas linhas do arquivo, não todas.
    const manualCount = new Map<string, number>();
    for (const tx of manualInRange) {
      const key = `${dateToDay(tx.date)}|${tx.type}|${toCents(Number(tx.amount))}`;
      manualCount.set(key, (manualCount.get(key) ?? 0) + 1);
    }

    const ruleList: RuleForMatching[] = rules
      .filter((r) => r.category.type === "INCOME" || r.category.type === "EXPENSE")
      .map((r) => ({ pattern: r.pattern, categoryId: r.categoryId, categoryType: r.category.type }));

    // Mais recente primeiro: a primeira categoria vista para cada descrição vence.
    const historyMap = new Map<string, string>();
    for (const tx of history) {
      if (tx.type === "TRANSFER" || !tx.categoryId) continue;
      const key = historyKey(tx.type, tx.description);
      if (!historyMap.has(key)) historyMap.set(key, tx.categoryId);
    }

    const isCard = account.type === "CREDIT_CARD";

    const previewRows: ImportPreviewRow[] = rows.map((row) => {
      const type = row.amount < 0 ? "EXPENSE" : "INCOME";
      const suggestion = suggestCategory({
        rules: ruleList,
        history: historyMap,
        description: row.description,
        type,
      });

      let status: ImportPreviewRow["status"] = "new";
      if (importedIds.has(row.fitId)) {
        status = "imported";
      } else {
        const key = `${row.date}|${type}|${toCents(row.amount)}`;
        const remaining = manualCount.get(key) ?? 0;
        if (remaining > 0) {
          status = "possible-duplicate";
          manualCount.set(key, remaining - 1);
        }
      }

      return {
        ...row,
        type,
        categoryId: suggestion.categoryId,
        suggestionSource: suggestion.source,
        status,
        // Em cartão, crédito costuma ser pagamento de fatura (registrado pelo
        // "Pagar Fatura" a partir da conta); importar contaria em dobro.
        defaultSkip: status !== "new" || (isCard && type === "INCOME"),
      };
    });

    return { success: true, data: { rows: previewRows } };
  } catch (error) {
    console.error("Erro ao pré-visualizar importação:", error);
    return { success: false, error: "Erro interno ao ler o extrato." };
  }
}

/**
 * Cria as transações selecionadas na revisão e as regras marcadas com
 * "lembrar". O índice único (conta, externalId) faz reimportações e cliques
 * duplos virarem "ignorados" em vez de duplicatas.
 */
export async function confirmOfxImport(
  input: ImportConfirmInput
): Promise<ActionResult<{ created: number; skipped: number; rulesCreated: number }>> {
  try {
    const userId = await getRequiredUserId();
    const parsed = importConfirmSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const { bankAccountId, rows } = parsed.data;

    const account = await db.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
    if (!account) {
      return { success: false, error: "Conta inválida." };
    }

    const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((id): id is string => !!id))];
    const categories = await db.category.findMany({
      where: { id: { in: categoryIds }, OR: [{ userId }, { userId: null }] },
      select: { id: true, type: true },
    });
    const categoryType = new Map(categories.map((c) => [c.id, c.type]));

    const rulesToCreate = new Map<string, { pattern: string; categoryId: string }>();
    for (const row of rows) {
      const type = row.amount < 0 ? "EXPENSE" : "INCOME";
      if (row.categoryId && categoryType.get(row.categoryId) !== type) {
        return { success: false, error: `Categoria inválida em "${row.description}".` };
      }
      const pattern = row.rememberPattern?.trim();
      if (pattern && row.categoryId) {
        if (normalizeDescription(pattern).length < 2) {
          return { success: false, error: `Regra muito curta em "${row.description}".` };
        }
        rulesToCreate.set(`${pattern.toLowerCase()}|${row.categoryId}`, {
          pattern,
          categoryId: row.categoryId,
        });
      }
    }

    const [createdTx, createdRules] = await db.$transaction([
      db.transaction.createMany({
        data: rows.map((row) => ({
          description: row.description,
          amount: Math.abs(row.amount),
          type: row.amount < 0 ? ("EXPENSE" as const) : ("INCOME" as const),
          date: dayToDate(row.date),
          categoryId: row.categoryId ?? null,
          bankAccountId,
          externalId: row.fitId,
          tags: ["importado"],
          userId,
        })),
        skipDuplicates: true,
      }),
      db.categorizationRule.createMany({
        data: [...rulesToCreate.values()].map((rule) => ({ ...rule, userId })),
        skipDuplicates: true,
      }),
    ]);

    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/fluxo-de-caixa/cartoes");
    revalidatePath("/dashboard");
    revalidatePath("/configuracoes");
    return {
      success: true,
      data: {
        created: createdTx.count,
        skipped: rows.length - createdTx.count,
        rulesCreated: createdRules.count,
      },
    };
  } catch (error) {
    console.error("Erro ao importar extrato:", error);
    return { success: false, error: "Erro interno ao importar o extrato." };
  }
}
