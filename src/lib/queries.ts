import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import {
  addMonths,
  differenceInCalendarMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { computeNextOccurrenceDate, getDueOccurrences } from "@/lib/recurrence";
import { investmentValueAt, reconcileOpeningBalance, type InvestmentHistoryInput } from "@/lib/netWorthMath";
import {
  getInvoiceDueDate,
  getInvoicePaymentPeriod,
  getInvoicePeriod,
  summarizeInvoice,
} from "@/lib/creditCardMath";
import {
  buildInvoiceEvents,
  type DatedInvoiceTransaction,
  type ProjectionEvent,
  type VariableEstimate,
} from "@/lib/projectionMath";
import type {
  AllocationData,
  BudgetWithProgress,
  CategorizationRuleItem,
  DashboardKPIs,
  InvestmentWithCalcs,
  RecurringSeriesItem,
  TransactionFilters,
  TransactionWithRelations,
} from "@/types";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from "@/types";

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getAccounts(userId: string) {
  return db.bankAccount.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getCategories(userId: string) {
  return db.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getExpenseCategories(userId: string) {
  return db.category.findMany({
    where: { type: "EXPENSE", OR: [{ userId }, { userId: null }] },
    orderBy: { name: "asc" },
  });
}

export async function getIncomeCategories(userId: string) {
  return db.category.findMany({
    where: { type: "INCOME", OR: [{ userId }, { userId: null }] },
    orderBy: { name: "asc" },
  });
}

export async function getFamilyMembers(userId: string) {
  return db.familyMember.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────
// Transações
// ─────────────────────────────────────────────────────────────
/**
 * Filtro de transações compartilhado pela lista do Fluxo de Caixa e pela
 * exportação. `gte` e `lte` precisam ficar no mesmo objeto `date`: espalhar
 * dois `{ date: ... }` faz o segundo sobrescrever o primeiro.
 */
function buildTransactionWhere(
  userId: string,
  filters: TransactionFilters
): Prisma.TransactionWhereInput {
  const { startDate, endDate, categoryId, bankAccountId, familyMemberId, type, search } = filters;
  return {
    userId,
    ...(startDate || endDate
      ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(bankAccountId ? { bankAccountId } : {}),
    ...(familyMemberId ? { familyMemberId } : {}),
    ...(type ? { type } : {}),
    ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
  };
}

const TRANSACTION_RELATIONS = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  bankAccount: { select: { id: true, name: true, type: true, color: true } },
  destinationAccount: { select: { id: true, name: true, type: true, color: true } },
  familyMember: { select: { id: true, name: true, color: true } },
} as const;

export async function getTransactions(
  userId: string,
  filters: TransactionFilters = {}
): Promise<TransactionWithRelations[]> {
  const transactions = await db.transaction.findMany({
    where: buildTransactionWhere(userId, filters),
    include: TRANSACTION_RELATIONS,
    orderBy: { date: "desc" },
    // Cap de segurança, não paginação real: o único chamador (TransactionsClient)
    // sempre filtra por um mês, então >200 transações em um único mês nunca acontece
    // em uso pessoal. Se um dia este filtro virar "todo o período" sem startDate/endDate,
    // isso precisa de paginação de verdade.
    take: 200,
  });

  return transactions.map((tx) => ({
    ...tx,
    amount: Number(tx.amount),
    type: tx.type,
  }));
}

// ─────────────────────────────────────────────────────────────
// Saldo das contas (calculado: saldo inicial + movimentações)
// ─────────────────────────────────────────────────────────────
export async function getAccountBalances(userId: string) {
  // Soma por conta de origem: INCOME soma, EXPENSE e TRANSFER subtraem.
  // Transferências sem destinationAccountId são ignoradas (dado inconsistente,
  // mesmo comportamento defensivo que existia no cálculo em memória).
  // Só entra o que já aconteceu (até o fim de hoje): parcelas e lançamentos
  // agendados para o futuro não mexem no saldo atual.
  const asOf = endOfDay(new Date());
  const [accounts, outgoing, incoming] = await Promise.all([
    db.bankAccount.findMany({ where: { userId } }),
    db.transaction.groupBy({
      by: ["bankAccountId", "type"],
      where: {
        userId,
        date: { lte: asOf },
        OR: [{ type: { not: "TRANSFER" } }, { type: "TRANSFER", destinationAccountId: { not: null } }],
      },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["destinationAccountId"],
      where: { userId, type: "TRANSFER", destinationAccountId: { not: null }, date: { lte: asOf } },
      _sum: { amount: true },
    }),
  ]);

  const balanceMap = new Map<string, number>();
  for (const acc of accounts) {
    balanceMap.set(acc.id, Number(acc.balance));
  }

  for (const row of outgoing) {
    const amount = Number(row._sum.amount ?? 0);
    const delta = row.type === "INCOME" ? amount : -amount;
    balanceMap.set(row.bankAccountId, (balanceMap.get(row.bankAccountId) ?? 0) + delta);
  }

  for (const row of incoming) {
    if (!row.destinationAccountId) continue;
    const amount = Number(row._sum.amount ?? 0);
    balanceMap.set(
      row.destinationAccountId,
      (balanceMap.get(row.destinationAccountId) ?? 0) + amount
    );
  }

  return accounts.map((acc) => ({
    ...acc,
    balance: balanceMap.get(acc.id) ?? Number(acc.balance),
    balanceNumber: balanceMap.get(acc.id) ?? Number(acc.balance),
  }));
}

// ─────────────────────────────────────────────────────────────
// Orçamentos com progresso
// ─────────────────────────────────────────────────────────────
export async function getBudgetsWithProgress(
  userId: string,
  month: number,
  year: number
): Promise<BudgetWithProgress[]> {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);

  const [budgets, transactions] = await Promise.all([
    db.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
      orderBy: { amount: "desc" },
    }),
    db.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: start, lte: end },
      },
      select: { categoryId: true, amount: true },
    }),
  ]);

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    spentByCategory.set(
      tx.categoryId,
      (spentByCategory.get(tx.categoryId) ?? 0) + Number(tx.amount)
    );
  }

  return budgets.map((budget) => {
    const amount = Number(budget.amount);
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const percentUsed = amount > 0 ? (spent / amount) * 100 : 0;
    const status: BudgetWithProgress["status"] =
      percentUsed >= 100 ? "over" : percentUsed >= 80 ? "warning" : "ok";

    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryIcon: budget.category.icon,
      categoryColor: budget.category.color,
      amount,
      spent,
      remaining: amount - spent,
      percentUsed,
      status,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
export async function getDashboardKPIs(userId: string): Promise<DashboardKPIs> {
  const now = new Date();

  const [accounts, monthTx, investments] = await Promise.all([
    getAccountBalances(userId),
    db.transaction.findMany({
      where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      select: { type: true, amount: true },
    }),
    db.investment.findMany({ where: { userId } }),
  ]);

  let monthIncome = 0;
  let monthExpense = 0;
  for (const tx of monthTx) {
    if (tx.type === "INCOME") monthIncome += Number(tx.amount);
    else if (tx.type === "EXPENSE") monthExpense += Number(tx.amount);
  }

  // Cartão de crédito não é saldo disponível (é dívida): fica fora do saldo
  // consolidado, mas entra no patrimônio com o próprio saldo (negativo quando há dívida).
  const totalBalance = accounts
    .filter((a) => a.type !== "CREDIT_CARD")
    .reduce((s, a) => s + a.balance, 0);
  const allAccountsBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalInvested = investments.reduce(
    (s, inv) => s + Number(inv.quantity) * Number(inv.currentPrice ?? inv.avgPrice),
    0
  );

  const savingsRate =
    monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;

  return {
    totalBalance,
    monthIncome,
    monthExpense,
    savingsRate: Math.max(savingsRate, 0),
    totalInvested,
    netWorth: allAccountsBalance + totalInvested,
  };
}

export async function getExpenseByCategory(userId: string, month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = endOfMonth(start);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      type: "EXPENSE",
      date: { gte: start, lte: end },
      categoryId: { not: null },
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  const byCategory = new Map<string, { name: string; color: string; value: number }>();
  for (const tx of transactions) {
    if (!tx.category) continue;
    const current = byCategory.get(tx.category.id) ?? {
      name: tx.category.name,
      color: tx.category.color,
      value: 0,
    };
    current.value += Number(tx.amount);
    byCategory.set(tx.category.id, current);
  }

  return [...byCategory.values()]
    .sort((a, b) => b.value - a.value)
    .map((c) => ({ ...c, value: Number(c.value.toFixed(2)) }));
}

export async function getMonthlyCashFlow(userId: string, monthsBack = 6) {
  const now = new Date();
  const start = startOfMonth(subMonths(now, monthsBack - 1));

  const transactions = await db.transaction.findMany({
    where: { userId, date: { gte: start } },
    select: { type: true, amount: true, date: true },
  });

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = subMonths(now, i);
    byMonth.set(format(m, "yyyy-MM"), { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const key = format(tx.date, "yyyy-MM");
    if (!byMonth.has(key)) continue;
    if (tx.type === "INCOME") byMonth.get(key)!.income += Number(tx.amount);
    else if (tx.type === "EXPENSE") byMonth.get(key)!.expense += Number(tx.amount);
  }

  return [...byMonth.entries()].map(([key, value]) => ({
    month: format(new Date(`${key}-01T12:00:00`), "MMM"),
    label: format(new Date(`${key}-01T12:00:00`), "MMM/yy"),
    ...value,
    income: Number(value.income.toFixed(2)),
    expense: Number(value.expense.toFixed(2)),
  }));
}

export async function getNetWorthSeries(userId: string, range: "1M" | "6M" | "1Y" | "ALL") {
  const now = new Date();
  const asOf = endOfDay(now);
  let start: Date;
  let granularity: "day" | "month" = "month";

  if (range === "1M") {
    start = startOfDay(subDays(now, 29));
    granularity = "day";
  } else if (range === "6M") {
    start = startOfMonth(subMonths(now, 5));
  } else if (range === "1Y") {
    start = startOfMonth(subMonths(now, 11));
  } else {
    const oldest = await db.transaction.aggregate({
      where: { userId, date: { lte: asOf } },
      _min: { date: true },
    });
    start = oldest._min.date ? startOfMonth(oldest._min.date) : startOfYear(now);
  }

  const [accountBalances, transactions, investments] = await Promise.all([
    getAccountBalances(userId),
    db.transaction.findMany({
      where: { userId, date: { gte: start, lte: asOf } },
      select: { type: true, amount: true, date: true },
    }),
    db.investment.findMany({
      where: { userId },
      include: {
        operations: { select: { type: true, quantity: true, date: true } },
        priceHistory: { select: { price: true, date: true } },
      },
    }),
  ]);

  const currentTotalBalance = accountBalances.reduce((s, a) => s + a.balance, 0);
  const openingTotal = reconcileOpeningBalance(
    currentTotalBalance,
    transactions.map((tx) => ({ type: tx.type, amount: Number(tx.amount) }))
  );

  const assets: InvestmentHistoryInput[] = investments.map((inv) => ({
    quantity: Number(inv.quantity),
    avgPrice: Number(inv.avgPrice),
    createdAt: inv.createdAt,
    operations: inv.operations.map((op) => ({
      type: op.type,
      quantity: Number(op.quantity),
      date: op.date,
    })),
    // O preço atual (que pode ter sido editado à mão, sem histórico) vale a
    // partir de agora, garantindo que o último ponto bata com o KPI do dashboard.
    priceHistory: [
      ...inv.priceHistory.map((p) => ({ price: Number(p.price), date: p.date })),
      { price: Number(inv.currentPrice ?? inv.avgPrice), date: now },
    ],
  }));

  // Cada ponto representa o fim do período (dia ou mês), limitado a agora.
  const periods = new Map<string, { end: Date; income: number; expense: number }>();
  if (granularity === "day") {
    for (const day of eachDayOfInterval({ start, end: now })) {
      periods.set(format(day, "yyyy-MM-dd"), { end: endOfDay(day), income: 0, expense: 0 });
    }
  } else {
    for (let cursor = start; cursor <= now; cursor = addMonths(cursor, 1)) {
      periods.set(format(cursor, "yyyy-MM"), { end: endOfMonth(cursor), income: 0, expense: 0 });
    }
  }

  for (const tx of transactions) {
    const key = granularity === "day" ? format(tx.date, "yyyy-MM-dd") : format(tx.date, "yyyy-MM");
    const period = periods.get(key);
    if (!period) continue;
    if (tx.type === "INCOME") period.income += Number(tx.amount);
    else if (tx.type === "EXPENSE") period.expense += Number(tx.amount);
  }

  let cumulative = openingTotal;
  return [...periods.entries()].map(([key, period]) => {
    cumulative += period.income - period.expense;
    const pointDate = period.end < now ? period.end : now;
    const investedValue = assets.reduce((s, asset) => s + investmentValueAt(asset, pointDate), 0);

    return {
      date:
        granularity === "day"
          ? format(new Date(`${key}T12:00:00`), "dd/MM")
          : format(new Date(`${key}-01T12:00:00`), "MMM/yy"),
      netWorth: Number((cumulative + investedValue).toFixed(2)),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Investimentos
// ─────────────────────────────────────────────────────────────
export async function getInvestmentsWithCalcs(userId: string) {
  const investments = await db.investment.findMany({
    where: { userId },
    include: {
      operations: { orderBy: { date: "desc" }, take: 10 },
      proventos: { orderBy: { paymentDate: "desc" }, take: 10 },
    },
  });

  const computed: InvestmentWithCalcs[] = investments.map((inv) => {
    const quantity = Number(inv.quantity);
    const avgPrice = Number(inv.avgPrice);
    const currentPrice = Number(inv.currentPrice ?? inv.avgPrice);
    const totalCost = quantity * avgPrice;
    const currentValue = quantity * currentPrice;
    const result = currentValue - totalCost;
    const resultPercent = totalCost > 0 ? (result / totalCost) * 100 : 0;

    return {
      id: inv.id,
      ticker: inv.ticker,
      name: inv.name,
      assetClass: inv.assetClass,
      quantity,
      avgPrice,
      currentPrice,
      targetAlloc: inv.targetAlloc !== null ? Number(inv.targetAlloc) : null,
      priceUpdatedAt: inv.priceUpdatedAt,
      totalCost,
      currentValue,
      result,
      resultPercent,
      portfolioWeight: 0,
    };
  });

  const totalValue = computed.reduce((s, inv) => s + inv.currentValue, 0);
  computed.forEach((inv) => {
    inv.portfolioWeight = totalValue > 0 ? (inv.currentValue / totalValue) * 100 : 0;
  });

  return { assets: computed, totalValue };
}

export async function getAllocationTargets(userId: string) {
  const targets = await db.allocationTarget.findMany({ where: { userId } });
  return targets.map((t) => ({ assetClass: t.assetClass, percent: Number(t.percent) }));
}

export async function getAllocationData(userId: string): Promise<AllocationData[]> {
  const [{ assets, totalValue }, targets] = await Promise.all([
    getInvestmentsWithCalcs(userId),
    getAllocationTargets(userId),
  ]);

  const byClass = new Map<AllocationData["assetClass"], number>();
  for (const asset of assets) {
    byClass.set(asset.assetClass, (byClass.get(asset.assetClass) ?? 0) + asset.currentValue);
  }
  // Classes com meta mas ainda sem ativos também aparecem (com 0%).
  for (const target of targets) {
    if (!byClass.has(target.assetClass)) byClass.set(target.assetClass, 0);
  }
  const targetByClass = new Map(targets.map((t) => [t.assetClass, t.percent]));

  return [...byClass.entries()].map(([assetClass, currentValue]) => ({
    assetClass,
    label: ASSET_CLASS_LABELS[assetClass],
    currentPercent: totalValue > 0 ? (currentValue / totalValue) * 100 : 0,
    targetPercent: targetByClass.get(assetClass) ?? null,
    currentValue,
    color: ASSET_CLASS_COLORS[assetClass],
  }));
}

export async function getProventosByYear(userId: string, year: number) {
  const start = new Date(year, 0, 1);
  const end = endOfYear(start);

  const proventos = await db.provento.findMany({
    where: { investment: { userId }, paymentDate: { gte: start, lte: end } },
    include: { investment: { select: { name: true, ticker: true } } },
    orderBy: { paymentDate: "desc" },
  });

  return proventos.map((p) => ({
    ...p,
    amount: Number(p.amount),
  }));
}

export async function getMonthlyProventos(userId: string, year: number) {
  const start = new Date(year, 0, 1);
  const end = endOfYear(start);

  const proventos = await db.provento.findMany({
    where: { investment: { userId }, paymentDate: { gte: start, lte: end } },
    select: { amount: true, paymentDate: true },
  });

  const byMonth = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    byMonth.set(format(new Date(year, i, 1), "MMM"), 0);
  }
  for (const p of proventos) {
    const key = format(p.paymentDate, "MMM");
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.amount));
  }

  return [...byMonth.entries()].map(([month, value]) => ({
    month,
    value: Number(value.toFixed(2)),
  }));
}

export async function getInvestmentDetail(userId: string, investmentId: string) {
  const [operations, proventos] = await Promise.all([
    db.investOperation.findMany({
      where: { investmentId, investment: { userId } },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.provento.findMany({
      where: { investmentId, investment: { userId } },
      orderBy: { paymentDate: "desc" },
      take: 50,
    }),
  ]);

  return {
    operations: operations.map((op) => ({
      ...op,
      quantity: Number(op.quantity),
      price: Number(op.price),
      fees: Number(op.fees),
      total: Number(op.total),
    })),
    proventos: proventos.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Recorrências (transações raiz com recurrenceRule preenchido)
// ─────────────────────────────────────────────────────────────
export async function getRecurringSeries(userId: string): Promise<RecurringSeriesItem[]> {
  const roots = await db.transaction.findMany({
    where: { userId, parentId: null, recurrenceRule: { not: null } },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      bankAccount: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "desc" },
  });

  if (roots.length === 0) return [];

  const childStats = await db.transaction.groupBy({
    by: ["parentId"],
    where: { userId, parentId: { in: roots.map((r) => r.id) } },
    _max: { date: true },
    _count: { _all: true },
  });
  const statsMap = new Map(childStats.map((s) => [s.parentId as string, s]));

  return roots.map((root) => {
    const stats = statsMap.get(root.id);
    const lastDate = stats?._max.date ?? root.date;

    return {
      id: root.id,
      description: root.description,
      amount: Number(root.amount),
      type: root.type,
      active: root.isRecurring,
      categoryId: root.categoryId,
      categoryName: root.category?.name ?? null,
      categoryIcon: root.category?.icon ?? null,
      categoryColor: root.category?.color ?? null,
      bankAccountId: root.bankAccountId,
      bankAccountName: root.bankAccount.name,
      bankAccountColor: root.bankAccount.color,
      lastDate,
      nextDate: root.isRecurring ? computeNextOccurrenceDate(root.date, lastDate) : null,
      occurrenceCount: 1 + (stats?._count._all ?? 0),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Fatura de cartão de crédito
// ─────────────────────────────────────────────────────────────
export interface CreditCardInvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: Date;
  installments: number | null;
  installmentNum: number | null;
  bankAccountId: string;
  destinationAccountId: string | null;
  category: { name: string; icon: string | null; color: string } | null;
  bankAccount: { name: string };
}

export interface CreditCardInvoiceData {
  transactions: CreditCardInvoiceTransaction[];
  payments: CreditCardInvoiceTransaction[];
  total: number;
  paid: number;
  open: number;
  startDate: Date;
  endDate: Date;
  // Dias (yyyy-MM-dd, no fuso do servidor) da janela em que um pagamento abate
  // esta fatura (ver getInvoicePaymentPeriod) e do vencimento. Strings em vez de
  // Date para o cliente não deslocar o dia ao converter para o fuso local.
  paymentStartDay: string;
  paymentEndDay: string;
  dueDay: string | null;
  closingDay: number;
}

export async function getCreditCardInvoice(
  userId: string,
  accountId: string,
  month: number,
  year: number
): Promise<CreditCardInvoiceData | null> {
  const account = await db.bankAccount.findFirst({
    where: { id: accountId, userId, type: "CREDIT_CARD" },
  });
  if (!account) return null;

  const { startDate, endDate } = getInvoicePeriod(month, year, account.closingDay);
  const paymentPeriod = getInvoicePaymentPeriod(month, year, account.closingDay);

  const select = {
    id: true,
    description: true,
    amount: true,
    type: true,
    date: true,
    installments: true,
    installmentNum: true,
    bankAccountId: true,
    destinationAccountId: true,
    category: { select: { name: true, icon: true, color: true } },
    bankAccount: { select: { name: true } },
  } as const;

  const [charges, payments] = await Promise.all([
    db.transaction.findMany({
      where: { userId, bankAccountId: accountId, date: { gte: startDate, lte: endDate } },
      select,
      orderBy: { date: "desc" },
    }),
    db.transaction.findMany({
      where: {
        userId,
        type: "TRANSFER",
        destinationAccountId: accountId,
        date: { gte: paymentPeriod.startDate, lte: paymentPeriod.endDate },
      },
      select,
      orderBy: { date: "desc" },
    }),
  ]);

  const toItem = (t: (typeof charges)[number]) => ({ ...t, amount: Number(t.amount) });
  const transactions = charges.map(toItem);
  const paymentItems = payments.map(toItem);
  const summary = summarizeInvoice(accountId, transactions, paymentItems);
  const dueDate = getInvoiceDueDate(month, year, account.closingDay, account.dueDay);

  return {
    transactions,
    payments: paymentItems,
    ...summary,
    startDate,
    endDate,
    paymentStartDay: format(paymentPeriod.startDate, "yyyy-MM-dd"),
    paymentEndDay: format(paymentPeriod.endDate, "yyyy-MM-dd"),
    dueDay: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
    closingDay: account.closingDay || 1,
  };
}

// ─────────────────────────────────────────────────────────────
// Regras de categorização (importação de extrato)
// ─────────────────────────────────────────────────────────────
export async function getCategorizationRules(userId: string): Promise<CategorizationRuleItem[]> {
  const rules = await db.categorizationRule.findMany({
    where: { userId },
    include: { category: { select: { name: true, icon: true, color: true, type: true } } },
    orderBy: { pattern: "asc" },
  });

  return rules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    categoryIcon: r.category.icon,
    categoryColor: r.category.color,
    categoryType: r.category.type,
  }));
}

// ─────────────────────────────────────────────────────────────
// Fluxo de caixa projetado
// ─────────────────────────────────────────────────────────────
export interface CashFlowProjectionInput {
  startDay: string;
  endDay: string;
  startBalance: number;
  events: ProjectionEvent[];
  /** Média mensal de receitas/despesas avulsas; null sem histórico suficiente. */
  variable: (VariableEstimate & { basedOnMonths: number }) | null;
}

/** Dia de uma transação gravada (meia-noite UTC, mesmo padrão do formatDate). */
const txDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Reúne o que a projeção precisa; o cálculo dia a dia fica em buildProjection
 * (projectionMath), que roda no cliente para o simulador e a estimativa
 * ligarem/desligarem sem nova requisição.
 *
 * Dinheiro disponível = contas que não são cartão. Cartões entram pelas faturas,
 * na data de vencimento.
 */
export async function getCashFlowProjectionInput(
  userId: string,
  months: number
): Promise<CashFlowProjectionInput> {
  const now = new Date();
  const asOf = endOfDay(now);
  const horizonEnd = endOfDay(addMonths(now, months));

  const accounts = await getAccountBalances(userId);
  const cashIds = new Set(accounts.filter((a) => a.type !== "CREDIT_CARD").map((a) => a.id));
  const cards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const cardIds = cards.map((c) => c.id);

  // Faturas do mês anterior (pode vencer neste mês) até o fim do horizonte.
  const invoiceMonths = Array.from({ length: months + 2 }, (_, i) => {
    const d = addMonths(now, i - 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  // Faixa que cobre todos os períodos e janelas de pagamento (com folga de um mês).
  const cardRangeStart = startOfMonth(subMonths(now, 3));
  const cardRangeEnd = endOfMonth(addMonths(now, months + 2));

  const variableStart = startOfMonth(subMonths(now, 3));
  const variableEnd = endOfMonth(subMonths(now, 1));

  const [futureTx, roots, seriesLastDates, cardTx, variableSums, firstTx] = await Promise.all([
    db.transaction.findMany({
      where: { userId, date: { gt: asOf, lte: horizonEnd } },
      select: {
        type: true,
        amount: true,
        date: true,
        description: true,
        bankAccountId: true,
        destinationAccountId: true,
      },
    }),
    db.transaction.findMany({
      where: { userId, isRecurring: true, parentId: null, recurrenceRule: { not: null } },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        bankAccountId: true,
        destinationAccountId: true,
      },
    }),
    db.transaction.groupBy({
      by: ["parentId"],
      where: { userId, parentId: { not: null } },
      _max: { date: true },
    }),
    cardIds.length > 0
      ? db.transaction.findMany({
          where: {
            userId,
            date: { gte: cardRangeStart, lte: cardRangeEnd },
            OR: [
              { bankAccountId: { in: cardIds } },
              { type: "TRANSFER", destinationAccountId: { in: cardIds } },
            ],
          },
          select: { type: true, amount: true, date: true, bankAccountId: true, destinationAccountId: true },
        })
      : Promise.resolve([]),
    // Avulsas: sem recorrência (raiz tem recurrenceRule; filhas têm parentId),
    // sem parcelas (installments) e sem transferências.
    db.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        type: { in: ["INCOME", "EXPENSE"] },
        parentId: null,
        recurrenceRule: null,
        installments: null,
        date: { gte: variableStart, lte: variableEnd },
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({ where: { userId }, _min: { date: true } }),
  ]);

  /** Efeito de um lançamento no dinheiro disponível (0 = não afeta). */
  const cashEffect = (t: {
    type: string;
    amount: number;
    bankAccountId: string;
    destinationAccountId: string | null;
  }) => {
    const fromCash = cashIds.has(t.bankAccountId);
    if (t.type === "INCOME") return fromCash ? t.amount : 0;
    if (t.type === "EXPENSE") return fromCash ? -t.amount : 0;
    if (!t.destinationAccountId) return 0;
    const toCash = cashIds.has(t.destinationAccountId);
    if (fromCash && !toCash) return -t.amount; // conta → cartão: pagamento de fatura
    if (!fromCash && toCash) return t.amount; // cartão → conta
    return 0; // entre contas próprias
  };

  const events: ProjectionEvent[] = [];

  for (const tx of futureTx) {
    const amount = cashEffect({ ...tx, amount: Number(tx.amount) });
    if (amount !== 0) {
      events.push({ day: txDay(tx.date), amount, description: tx.description, kind: "transaction" });
    }
  }

  // Recorrências: ocorrências futuras ainda não geradas. As que vencem até
  // hoje são lançadas ao abrir o app e já entram no saldo atual.
  const lastDateBySeries = new Map(seriesLastDates.map((s) => [s.parentId, s._max.date]));
  const projectedCardCharges: DatedInvoiceTransaction[] = [];
  for (const root of roots) {
    const childLast = lastDateBySeries.get(root.id);
    const lastDate = childLast && childLast > root.date ? childLast : root.date;
    // Folga no teto: ocorrências passadas ainda não geradas também contam nele.
    const occurrences = getDueOccurrences(root.date, lastDate, horizonEnd, months + 36).filter(
      (date) => date > asOf
    );
    const amount = Number(root.amount);

    for (const date of occurrences) {
      if (cardIds.includes(root.bankAccountId) && root.type !== "TRANSFER") {
        projectedCardCharges.push({
          type: root.type,
          amount,
          bankAccountId: root.bankAccountId,
          destinationAccountId: null,
          date,
        });
        continue;
      }
      const effect = cashEffect({ ...root, amount });
      if (effect !== 0) {
        events.push({ day: txDay(date), amount: effect, description: root.description, kind: "recurrence" });
      }
    }
  }

  for (const card of cards) {
    const toInvoiceTx = (t: (typeof cardTx)[number]): DatedInvoiceTransaction => ({
      type: t.type,
      amount: Number(t.amount),
      bankAccountId: t.bankAccountId,
      destinationAccountId: t.destinationAccountId,
      date: t.date,
    });
    events.push(
      ...buildInvoiceEvents({
        cardId: card.id,
        cardName: card.name,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        charges: [
          ...cardTx.filter((t) => t.bankAccountId === card.id).map(toInvoiceTx),
          ...projectedCardCharges.filter((t) => t.bankAccountId === card.id),
        ],
        payments: cardTx
          .filter((t) => t.type === "TRANSFER" && t.destinationAccountId === card.id)
          .map(toInvoiceTx),
        invoiceMonths,
        today: now,
      })
    );
  }

  // Média das avulsas nos últimos 3 meses completos (ou menos, se o histórico for curto).
  let variable: CashFlowProjectionInput["variable"] = null;
  const firstDate = firstTx._min.date;
  if (firstDate && firstDate <= variableEnd) {
    const from = firstDate > variableStart ? firstDate : variableStart;
    const basedOnMonths = Math.min(3, differenceInCalendarMonths(variableEnd, from) + 1);
    const sumOf = (type: string) =>
      Number(variableSums.find((row) => row.type === type)?._sum.amount ?? 0);
    variable = {
      monthlyIncome: Number((sumOf("INCOME") / basedOnMonths).toFixed(2)),
      monthlyExpense: Number((sumOf("EXPENSE") / basedOnMonths).toFixed(2)),
      basedOnMonths,
    };
  }

  return {
    startDay: format(now, "yyyy-MM-dd"),
    endDay: format(horizonEnd, "yyyy-MM-dd"),
    startBalance: Number(
      accounts.filter((a) => cashIds.has(a.id)).reduce((s, a) => s + a.balance, 0).toFixed(2)
    ),
    events: events.sort((a, b) => a.day.localeCompare(b.day)),
    variable,
  };
}

// ─────────────────────────────────────────────────────────────
// Exportação e backup
// ─────────────────────────────────────────────────────────────
/** Todas as transações do filtro (sem o limite da lista), em ordem cronológica. */
export async function getTransactionsForExport(
  userId: string,
  filters: TransactionFilters
): Promise<TransactionWithRelations[]> {
  const transactions = await db.transaction.findMany({
    where: buildTransactionWhere(userId, filters),
    include: TRANSACTION_RELATIONS,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return transactions.map((tx) => ({ ...tx, amount: Number(tx.amount) }));
}

/**
 * Tudo o que pertence ao usuário, para o backup. O perfil vai sem o hash da
 * senha e sem as tabelas de sessão do NextAuth. Os Decimals são mantidos aqui
 * e serializados como texto pela rota (sem perder precisão).
 */
export async function getBackupData(userId: string) {
  const [
    user,
    bankAccounts,
    familyMembers,
    categories,
    transactions,
    budgets,
    investments,
    categorizationRules,
    allocationTargets,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    db.bankAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.familyMember.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.transaction.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.budget.findMany({ where: { userId }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    db.investment.findMany({
      where: { userId },
      include: {
        operations: { orderBy: { date: "asc" } },
        proventos: { orderBy: { paymentDate: "asc" } },
        priceHistory: { orderBy: { date: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.categorizationRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.allocationTarget.findMany({ where: { userId } }),
  ]);

  return {
    user,
    bankAccounts,
    familyMembers,
    categories,
    transactions,
    budgets,
    investments,
    categorizationRules,
    allocationTargets,
  };
}
