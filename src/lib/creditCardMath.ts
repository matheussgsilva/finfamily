import { endOfDay, startOfDay } from "date-fns";

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

export interface InvoiceTransaction {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
}

/**
 * Soma o total da fatura: despesas aumentam o valor devido, pagamentos (entradas/transferências) reduzem.
 */
export function calculateInvoiceTotal(transactions: InvoiceTransaction[]): number {
  return transactions.reduce((acc, t) => {
    if (t.type === "EXPENSE") return acc + t.amount;
    if (t.type === "INCOME" || t.type === "TRANSFER") return acc - t.amount;
    return acc;
  }, 0);
}
