import "server-only";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import type {
  AllocationData,
  BudgetWithProgress,
  DashboardKPIs,
  InvestmentWithCalcs,
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
export async function getTransactions(
  userId: string,
  filters: TransactionFilters = {}
): Promise<TransactionWithRelations[]> {
  const {
    startDate,
    endDate,
    categoryId,
    bankAccountId,
    familyMemberId,
    type,
    search,
  } = filters;

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      ...(startDate ? { date: { gte: startDate } } : {}),
      ...(endDate ? { date: { lte: endDate } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(familyMemberId ? { familyMemberId } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? { description: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      bankAccount: { select: { id: true, name: true, type: true, color: true } },
      destinationAccount: {
        select: { id: true, name: true, type: true, color: true },
      },
      familyMember: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "desc" },
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
  const [accounts, transactions] = await Promise.all([
    db.bankAccount.findMany({ where: { userId } }),
    db.transaction.findMany({
      where: { userId },
      select: {
        bankAccountId: true,
        destinationAccountId: true,
        type: true,
        amount: true,
      },
    }),
  ]);

  const balanceMap = new Map<string, number>();
  for (const acc of accounts) {
    balanceMap.set(acc.id, Number(acc.balance));
  }

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      balanceMap.set(tx.bankAccountId, (balanceMap.get(tx.bankAccountId) ?? 0) + amount);
    } else if (tx.type === "EXPENSE") {
      balanceMap.set(tx.bankAccountId, (balanceMap.get(tx.bankAccountId) ?? 0) - amount);
    } else if (tx.type === "TRANSFER") {
      if (tx.destinationAccountId) {
        balanceMap.set(tx.bankAccountId, (balanceMap.get(tx.bankAccountId) ?? 0) - amount);
        balanceMap.set(
          tx.destinationAccountId,
          (balanceMap.get(tx.destinationAccountId) ?? 0) + amount
        );
      }
    }
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
  const monthStart = startOfMonth(now);

  const [accounts, monthTx, investments] = await Promise.all([
    db.bankAccount.findMany({ where: { userId } }),
    db.transaction.findMany({
      where: { userId, date: { gte: monthStart } },
      select: { type: true, amount: true, bankAccountId: true },
    }),
    db.investment.findMany({ where: { userId } }),
  ]);

  const balanceMap = new Map(accounts.map((a) => [a.id, Number(a.balance)]));
  let monthIncome = 0;
  let monthExpense = 0;
  let creditCardBalance = 0;

  for (const tx of monthTx) {
    if (tx.type === "INCOME") monthIncome += Number(tx.amount);
    else if (tx.type === "EXPENSE") monthExpense += Number(tx.amount);
    const account = accounts.find((a) => a.id === tx.bankAccountId);
    if (account?.type === "CREDIT_CARD") {
      if (tx.type === "EXPENSE") creditCardBalance -= Number(tx.amount);
      else if (tx.type === "INCOME") creditCardBalance += Number(tx.amount);
    }
  }

  const totalBalance = [...balanceMap.values()].reduce((s, v) => s + v, 0);
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
    netWorth: totalBalance + creditCardBalance + totalInvested,
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
  let start: Date;
  let granularity: "day" | "month" = "month";

  if (range === "1M") {
    start = startOfMonth(subMonths(now, 1));
    granularity = "day";
  } else if (range === "6M") {
    start = startOfMonth(subMonths(now, 5));
  } else if (range === "1Y") {
    start = startOfMonth(subMonths(now, 11));
  } else {
    start = startOfYear(now);
  }

  const [accounts, transactions, investments] = await Promise.all([
    db.bankAccount.findMany({ where: { userId } }),
    db.transaction.findMany({
      where: { userId, date: { gte: start } },
      select: { type: true, amount: true, date: true },
    }),
    db.investment.findMany({ where: { userId } }),
  ]);

  const openingTotal = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const investedValue = investments.reduce(
    (s, inv) => s + Number(inv.quantity) * Number(inv.currentPrice ?? inv.avgPrice),
    0
  );

  // Agrupar transações por período
  const keys = new Map<string, { income: number; expense: number }>();
  if (granularity === "day") {
    for (let i = 0; i <= now.getDate(); i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      if (d >= start) keys.set(format(d, "yyyy-MM-dd"), { income: 0, expense: 0 });
    }
  } else {
    let cursor = start;
    while (cursor <= now) {
      keys.set(format(cursor, "yyyy-MM"), { income: 0, expense: 0 });
      cursor = addMonths(cursor, 1);
    }
  }

  for (const tx of transactions) {
    const key = granularity === "day" ? format(tx.date, "yyyy-MM-dd") : format(tx.date, "yyyy-MM");
    if (!keys.has(key)) continue;
    if (tx.type === "INCOME") keys.get(key)!.income += Number(tx.amount);
    else if (tx.type === "EXPENSE") keys.get(key)!.expense += Number(tx.amount);
  }

  let cumulative = openingTotal;
  const series = [...keys.entries()].map(([key, value]) => {
    cumulative += value.income - value.expense;
    return {
      date:
        granularity === "day"
          ? format(new Date(`${key}T12:00:00`), "dd/MM")
          : format(new Date(`${key}-01T12:00:00`), "MMM/yy"),
      netWorth: Number(cumulative.toFixed(2)),
    };
  });

  // Patrimônio final inclui investimentos
  if (series.length > 0) {
    series[series.length - 1].netWorth = Number(
      (series[series.length - 1].netWorth + investedValue).toFixed(2)
    );
  }

  return series;
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

export async function getAllocationData(userId: string): Promise<AllocationData[]> {
  const { assets, totalValue } = await getInvestmentsWithCalcs(userId);

  const byClass = new Map<string, { currentValue: number; target: number }>();
  for (const asset of assets) {
    const current = byClass.get(asset.assetClass) ?? { currentValue: 0, target: 0 };
    current.currentValue += asset.currentValue;
    if (asset.targetAlloc !== null) {
      current.target += asset.targetAlloc;
    }
    byClass.set(asset.assetClass, current);
  }

  return [...byClass.entries()].map(([assetClass, value]) => ({
    assetClass: assetClass as AllocationData["assetClass"],
    label: ASSET_CLASS_LABELS[assetClass as keyof typeof ASSET_CLASS_LABELS],
    currentPercent: totalValue > 0 ? (value.currentValue / totalValue) * 100 : 0,
    targetPercent: value.target || null,
    currentValue: value.currentValue,
    color: ASSET_CLASS_COLORS[assetClass as keyof typeof ASSET_CLASS_COLORS],
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
