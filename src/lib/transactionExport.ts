import { csvNumber, type CsvCell } from "@/lib/csv";
import { exportFiltersSchema, type ExportFilters } from "@/lib/validations";
import { TRANSACTION_TYPE_LABELS, type TransactionFilters, type TransactionType } from "@/types";

/** O mínimo de uma transação que a exportação e o relatório usam. */
export interface ExportTransaction {
  date: Date;
  description: string;
  type: TransactionType;
  amount: number;
  notes: string | null;
  tags: string[];
  isRecurring: boolean;
  installments: number | null;
  installmentNum: number | null;
  category: { id: string; name: string; color: string } | null;
  bankAccount: { name: string };
  destinationAccount: { name: string } | null;
  familyMember: { name: string } | null;
}

/** Data gravada (meia-noite UTC do dia) → dd/MM/aaaa, igual ao formatDate do app. */
export function exportDay(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  return iso.split("-").reverse().join("/");
}

/** Valor com sinal para somar na planilha: receita +, despesa −, transferência + (o tipo identifica). */
export function signedAmount(t: Pick<ExportTransaction, "type" | "amount">): number {
  return t.type === "EXPENSE" ? -t.amount : t.amount;
}

export const CSV_HEADER = [
  "Data",
  "Descrição",
  "Tipo",
  "Categoria",
  "Conta",
  "Conta destino",
  "Membro",
  "Valor",
  "Parcela",
  "Recorrente",
  "Tags",
  "Observações",
];

export function transactionCsvRows(transactions: ExportTransaction[]): CsvCell[][] {
  return [
    CSV_HEADER,
    ...transactions.map((t) => [
      exportDay(t.date),
      t.description,
      TRANSACTION_TYPE_LABELS[t.type],
      t.category?.name ?? "",
      t.bankAccount.name,
      t.destinationAccount?.name ?? "",
      t.familyMember?.name ?? "",
      csvNumber(signedAmount(t)),
      t.installments && t.installmentNum ? `${t.installmentNum}/${t.installments}` : "",
      t.isRecurring ? "Sim" : "Não",
      t.tags.join(", "),
      t.notes ?? "",
    ]),
  ];
}

// ─────────────────────────────────────────────────────────────
// Resumo para o relatório
// ─────────────────────────────────────────────────────────────
export interface CategoryTotal {
  id: string | null;
  name: string;
  color: string;
  total: number;
  percent: number;
}

export interface TransactionSummary {
  income: number;
  expense: number;
  balance: number;
  transfers: number;
  count: number;
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
}

const UNCATEGORIZED = { id: null, name: "Sem categoria", color: "#71717a" };
const round2 = (v: number) => Math.round(v * 100) / 100;

function byCategory(transactions: ExportTransaction[], total: number): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of transactions) {
    const category = t.category ?? UNCATEGORIZED;
    const key = category.id ?? "__none__";
    const entry = map.get(key) ?? { ...category, total: 0, percent: 0 };
    entry.total += t.amount;
    map.set(key, entry);
  }
  return [...map.values()]
    .map((c) => ({ ...c, total: round2(c.total), percent: total > 0 ? (c.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}

export function summarizeTransactions(transactions: ExportTransaction[]): TransactionSummary {
  const incomes = transactions.filter((t) => t.type === "INCOME");
  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const income = incomes.reduce((s, t) => s + t.amount, 0);
  const expense = expenses.reduce((s, t) => s + t.amount, 0);
  const transfers = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + t.amount, 0);

  return {
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    transfers: round2(transfers),
    count: transactions.length,
    expenseByCategory: byCategory(expenses, expense),
    incomeByCategory: byCategory(incomes, income),
  };
}

// ─────────────────────────────────────────────────────────────
// Filtros na URL (mesmo formato para o CSV e o relatório)
// ─────────────────────────────────────────────────────────────
const FILTER_KEYS = ["start", "end", "type", "categoryId", "bankAccountId", "familyMemberId", "search"] as const;

export function exportQueryString(filters: ExportFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

type ParamsSource = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseExportParams(source: ParamsSource) {
  const read = (key: string) => {
    const value = source instanceof URLSearchParams ? source.get(key) : source[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first === null || first === "" ? undefined : first;
  };
  return exportFiltersSchema.safeParse(Object.fromEntries(FILTER_KEYS.map((k) => [k, read(k)])));
}

/** Dias (UTC, como as datas são gravadas) → filtros da query de transações. */
export function toTransactionFilters(filters: ExportFilters): TransactionFilters {
  return {
    startDate: new Date(`${filters.start}T00:00:00.000Z`),
    endDate: new Date(`${filters.end}T23:59:59.999Z`),
    type: filters.type,
    categoryId: filters.categoryId,
    bankAccountId: filters.bankAccountId,
    familyMemberId: filters.familyMemberId,
    search: filters.search,
  };
}
