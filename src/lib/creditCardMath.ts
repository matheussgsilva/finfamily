import { endOfDay, getDaysInMonth, startOfDay } from "date-fns";

export interface InvoicePeriod {
  startDate: Date;
  endDate: Date;
}

/**
 * Calcula o período de uma fatura de cartão de crédito a partir do dia de fechamento.
 * Fatura do mês X fecha no dia `closingDay` do mês X (ex: fatura de Setembro fecha em 05/09,
 * cobrindo compras de 06/08 até 05/09). `closingDay` ausente assume o dia 1.
 */
export function getInvoicePeriod(month: number, year: number, closingDay: number | null): InvoicePeriod {
  const day = closingDay || 1;
  // Meses no JS são 0-indexed (0 = Jan, 8 = Set); new Date lida com mês -1/13 rolando o ano.
  return {
    startDate: startOfDay(new Date(year, month - 2, day + 1)),
    endDate: endOfDay(new Date(year, month - 1, day)),
  };
}

/**
 * Janela em que um pagamento abate a fatura do mês X: do dia seguinte ao
 * fechamento de X até o fechamento seguinte (= período da fatura de X+1).
 * Ex.: fatura de Setembro fecha em 05/09 => pagamentos de 06/09 a 05/10 abatem Setembro.
 */
export function getInvoicePaymentPeriod(
  month: number,
  year: number,
  closingDay: number | null
): InvoicePeriod {
  return getInvoicePeriod(month + 1, year, closingDay);
}

/**
 * Data de vencimento da fatura do mês X. Se o dia de vencimento é depois do
 * fechamento, vence no próprio mês X; senão, no mês seguinte (ex.: fecha dia
 * 28 e vence dia 5 => vence em 05/X+1). Dias inexistentes no mês (31 em
 * fevereiro) caem no último dia do mês.
 */
export function getInvoiceDueDate(
  month: number,
  year: number,
  closingDay: number | null,
  dueDay: number | null
): Date | null {
  if (!dueDay) return null;
  const closing = closingDay || 1;
  const monthIndex = dueDay > closing ? month - 1 : month;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const day = Math.min(dueDay, getDaysInMonth(firstOfMonth));
  return new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), day);
}

export interface InvoiceTransaction {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  bankAccountId: string;
  destinationAccountId: string | null;
}

export interface InvoiceSummary {
  total: number; // compras do período menos estornos
  paid: number; // pagamentos (transferências para o cartão) na janela de pagamento
  open: number; // quanto ainda falta pagar
}

const toCents = (value: number) => Math.round(value * 100);

/**
 * Resume uma fatura:
 * - `periodTransactions` (dentro do período da fatura): o que sai do cartão
 *   (EXPENSE ou TRANSFER com o cartão como origem) aumenta o total; INCOME no
 *   cartão é estorno e reduz. Transferências *para* o cartão nesse período são
 *   pagamentos da fatura anterior e não entram aqui.
 * - `paymentTransactions` (dentro de `getInvoicePaymentPeriod`): transferências
 *   com o cartão como destino somam em `paid`.
 */
export function summarizeInvoice(
  cardId: string,
  periodTransactions: InvoiceTransaction[],
  paymentTransactions: InvoiceTransaction[]
): InvoiceSummary {
  let totalCents = 0;
  for (const t of periodTransactions) {
    if (t.bankAccountId !== cardId) continue;
    if (t.type === "EXPENSE" || t.type === "TRANSFER") totalCents += toCents(t.amount);
    else if (t.type === "INCOME") totalCents -= toCents(t.amount);
  }

  let paidCents = 0;
  for (const t of paymentTransactions) {
    if (t.type === "TRANSFER" && t.destinationAccountId === cardId) paidCents += toCents(t.amount);
  }

  return {
    total: totalCents / 100,
    paid: paidCents / 100,
    open: Math.max(totalCents - paidCents, 0) / 100,
  };
}
