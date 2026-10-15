import { format, startOfDay, startOfMonth } from "date-fns";
import {
  getInvoiceDueDate,
  getInvoicePaymentPeriod,
  getInvoicePeriod,
  summarizeInvoice,
  type InvoiceTransaction,
} from "@/lib/creditCardMath";
import { splitInstallments } from "@/lib/installmentMath";

export type ProjectionEventKind = "transaction" | "recurrence" | "invoice" | "simulation";

export interface ProjectionEvent {
  day: string; // yyyy-MM-dd
  amount: number; // com sinal: negativo = sai do dinheiro disponível
  description: string;
  kind: ProjectionEventKind;
  overdue?: boolean;
}

export interface VariableEstimate {
  monthlyIncome: number;
  monthlyExpense: number;
}

export interface ProjectionPoint {
  day: string;
  balance: number;
}

export interface ProjectionMonth {
  month: string; // yyyy-MM
  income: number;
  expense: number;
  invoices: number;
  variable: number;
  endBalance: number;
}

export interface Projection {
  points: ProjectionPoint[];
  lowest: ProjectionPoint;
  endBalance: number;
  months: ProjectionMonth[];
}

// ─────────────────────────────────────────────────────────────
// Aritmética de dias em texto (yyyy-MM-dd), sem fuso horário
// ─────────────────────────────────────────────────────────────
function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
}

function toDay(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function nextDay(day: string): string {
  const { y, m, d } = parseDay(day);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return toDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Soma meses mantendo o dia (limitado ao último dia do mês: 31/01 + 1 = 28/02). */
export function addMonthsToDay(day: string, months: number): string {
  const { y, m, d } = parseDay(day);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const ny = first.getUTCFullYear();
  const nm = first.getUTCMonth() + 1;
  return toDay(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// ─────────────────────────────────────────────────────────────
// Faturas de cartão → saídas na data de vencimento
// ─────────────────────────────────────────────────────────────
export interface DatedInvoiceTransaction extends InvoiceTransaction {
  date: Date;
}

/**
 * Uma saída por fatura com valor em aberto, na data de vencimento (ou no
 * fechamento, sem dia de vencimento). Pagamentos já registrados abatem o
 * valor. Fatura vencida no mês atual entra marcada como `overdue`; vencidas
 * em meses anteriores são ignoradas (provavelmente pagas sem registro).
 */
export function buildInvoiceEvents({
  cardId,
  cardName,
  closingDay,
  dueDay,
  charges,
  payments,
  invoiceMonths,
  today,
}: {
  cardId: string;
  cardName: string;
  closingDay: number | null;
  dueDay: number | null;
  charges: DatedInvoiceTransaction[];
  payments: DatedInvoiceTransaction[];
  invoiceMonths: { month: number; year: number }[];
  today: Date;
}): ProjectionEvent[] {
  const events: ProjectionEvent[] = [];
  const todayStart = startOfDay(today);
  const currentMonthStart = startOfMonth(today);

  for (const { month, year } of invoiceMonths) {
    const period = getInvoicePeriod(month, year, closingDay);
    const paymentPeriod = getInvoicePaymentPeriod(month, year, closingDay);
    const inPeriod = (t: DatedInvoiceTransaction, p: { startDate: Date; endDate: Date }) =>
      t.date >= p.startDate && t.date <= p.endDate;

    const { open } = summarizeInvoice(
      cardId,
      charges.filter((t) => inPeriod(t, period)),
      payments.filter((t) => inPeriod(t, paymentPeriod))
    );
    if (open <= 0) continue;

    const due = getInvoiceDueDate(month, year, closingDay, dueDay) ?? startOfDay(period.endDate);
    if (due < currentMonthStart) continue;

    events.push({
      day: format(due, "yyyy-MM-dd"),
      amount: -open,
      description: `Fatura ${cardName} ${String(month).padStart(2, "0")}/${year}`,
      kind: "invoice",
      ...(due < todayStart ? { overdue: true } : {}),
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────
// Simulação de compra
// ─────────────────────────────────────────────────────────────
export function simulatePurchase({
  amount,
  day,
  installments,
}: {
  amount: number;
  day: string;
  installments: number;
}): ProjectionEvent[] {
  const parts = splitInstallments(amount, installments);
  return parts.map((value, i) => ({
    day: addMonthsToDay(day, i),
    amount: -value,
    description: parts.length > 1 ? `Simulação (${i + 1}/${parts.length})` : "Simulação",
    kind: "simulation" as const,
  }));
}

// ─────────────────────────────────────────────────────────────
// Projeção diária
// ─────────────────────────────────────────────────────────────
/**
 * Saldo dia a dia de `startDay` (hoje, saldo real) até `endDay`. Eventos com
 * dia ≤ hoje (ex.: fatura vencida) são aplicados no ponto de hoje; eventos
 * depois de `endDay` são ignorados. A estimativa do dia a dia (média mensal)
 * entra dividida pelos dias de cada mês, a partir de amanhã.
 */
export function buildProjection({
  startDay,
  endDay,
  startBalance,
  events,
  variable,
}: {
  startDay: string;
  endDay: string;
  startBalance: number;
  events: ProjectionEvent[];
  variable: VariableEstimate | null;
}): Projection {
  const byDay = new Map<string, ProjectionEvent[]>();
  for (const event of events) {
    if (event.day > endDay) continue;
    const day = event.day < startDay ? startDay : event.day;
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  const points: ProjectionPoint[] = [];
  const months = new Map<string, ProjectionMonth>();
  let balance = startBalance;

  for (let day = startDay; day <= endDay; day = nextDay(day)) {
    const monthKey = day.slice(0, 7);
    const summary = months.get(monthKey) ?? {
      month: monthKey,
      income: 0,
      expense: 0,
      invoices: 0,
      variable: 0,
      endBalance: 0,
    };

    for (const event of byDay.get(day) ?? []) {
      balance += event.amount;
      if (event.kind === "invoice") summary.invoices += -event.amount;
      else if (event.amount > 0) summary.income += event.amount;
      else summary.expense += -event.amount;
    }

    if (variable && day > startDay) {
      const { y, m } = parseDay(day);
      const daily = (variable.monthlyIncome - variable.monthlyExpense) / daysInMonth(y, m);
      balance += daily;
      summary.variable += daily;
    }

    summary.endBalance = balance;
    months.set(monthKey, summary);
    points.push({ day, balance: round2(balance) });
  }

  const lowest = points.reduce(
    (min, p) => (p.balance < min.balance ? p : min),
    points[0] ?? { day: startDay, balance: round2(startBalance) }
  );

  return {
    points,
    lowest,
    endBalance: round2(balance),
    months: [...months.values()].map((s) => ({
      month: s.month,
      income: round2(s.income),
      expense: round2(s.expense),
      invoices: round2(s.invoices),
      variable: round2(s.variable),
      endBalance: round2(s.endBalance),
    })),
  };
}
