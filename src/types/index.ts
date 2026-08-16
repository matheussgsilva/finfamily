import type { AccountType, AssetClass, CategoryType, TransactionType, OpType } from "@/generated/prisma";

// ─────────────────────────────────────────────────────────────
// Re-exportar tipos do Prisma para uso na app
// ─────────────────────────────────────────────────────────────
export type { AccountType, AssetClass, CategoryType, TransactionType, OpType };

// ─────────────────────────────────────────────────────────────
// Tipos de resposta de Server Actions
// ─────────────────────────────────────────────────────────────
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────
// Tipos de KPIs do Dashboard
// ─────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  totalBalance: number;         // Saldo consolidado (bancos)
  monthIncome: number;          // Entradas do mês
  monthExpense: number;         // Saídas do mês
  savingsRate: number;          // Taxa de poupança (%)
  totalInvested: number;        // Patrimônio investido
  netWorth: number;             // Patrimônio líquido total
}

// ─────────────────────────────────────────────────────────────
// Tipos de Transação enriquecida
// ─────────────────────────────────────────────────────────────
export interface TransactionWithRelations {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  notes: string | null;
  tags: string[];
  isRecurring: boolean;
  installments: number | null;
  installmentNum: number | null;
  parentId: string | null;
  categoryId: string | null;
  bankAccountId: string;
  destinationAccountId: string | null;
  familyMemberId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string;
  } | null;
  bankAccount: {
    id: string;
    name: string;
    type: AccountType;
    color: string;
  };
  destinationAccount: {
    id: string;
    name: string;
    type: AccountType;
    color: string;
  } | null;
  familyMember: {
    id: string;
    name: string;
    color: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Tipos de Investimento enriquecido
// ─────────────────────────────────────────────────────────────
export interface InvestmentWithCalcs {
  id: string;
  ticker: string | null;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
  targetAlloc: number | null;
  priceUpdatedAt: Date | null;
  // Calculados
  totalCost: number;            // quantity * avgPrice
  currentValue: number;         // quantity * currentPrice
  result: number;               // currentValue - totalCost
  resultPercent: number;        // (result / totalCost) * 100
  portfolioWeight: number;      // % do portfólio total
}

// ─────────────────────────────────────────────────────────────
// Tipos de Orçamento com progresso
// ─────────────────────────────────────────────────────────────
export interface BudgetWithProgress {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string;
  amount: number;          // Limite definido
  spent: number;           // Total gasto no período
  remaining: number;       // amount - spent
  percentUsed: number;     // (spent / amount) * 100
  status: "ok" | "warning" | "over"; // < 80%, 80-100%, > 100%
}

// ─────────────────────────────────────────────────────────────
// Tipos de Filtros
// ─────────────────────────────────────────────────────────────
export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  bankAccountId?: string;
  familyMemberId?: string;
  type?: TransactionType;
  search?: string;
}

// ─────────────────────────────────────────────────────────────
// Tipos de Alocação da Carteira
// ─────────────────────────────────────────────────────────────
export interface AllocationData {
  assetClass: AssetClass;
  label: string;
  currentPercent: number;
  targetPercent: number | null;
  currentValue: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────
// Mapeamentos de label amigável
// ─────────────────────────────────────────────────────────────
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Conta Corrente",
  SAVINGS: "Poupança",
  CREDIT_CARD: "Cartão de Crédito",
  INVESTMENT: "Conta de Investimento",
  WALLET: "Carteira / Dinheiro",
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  FIXED_INCOME: "Renda Fixa",
  STOCKS: "Ações",
  REITS: "FIIs",
  CRYPTO: "Criptomoedas",
  INTERNATIONAL: "Internacional",
  OTHER: "Outros",
};

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  FIXED_INCOME: "#22c55e",
  STOCKS: "#3b82f6",
  REITS: "#f97316",
  CRYPTO: "#a855f7",
  INTERNATIONAL: "#06b6d4",
  OTHER: "#6b7280",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferência",
};
