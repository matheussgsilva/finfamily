import { addMonths, isAfter } from "date-fns";

/**
 * Única regra suportada por enquanto (MVP mensal). O valor é gravado em
 * `Transaction.recurrenceRule` e também funciona como marcador permanente de
 * "esta transação raiz já foi uma recorrência", mesmo depois de encerrada.
 */
export const DEFAULT_RECURRENCE_RULE = "FREQ=MONTHLY;INTERVAL=1";

export function computeNextOccurrenceDate(lastDate: Date): Date {
  return addMonths(lastDate, 1);
}

/**
 * Retorna as datas mensais devidas entre `lastDate` (exclusivo) e `today`
 * (inclusivo). O teto de iterações evita gerar uma série enorme de uma vez
 * só caso uma recorrência fique muito tempo sem o app ser aberto.
 */
export function getDueOccurrences(
  lastDate: Date,
  today: Date,
  maxIterations = 36
): Date[] {
  const dates: Date[] = [];
  let cursor = lastDate;

  for (let i = 0; i < maxIterations; i++) {
    const next = computeNextOccurrenceDate(cursor);
    if (isAfter(next, today)) break;
    dates.push(next);
    cursor = next;
  }

  return dates;
}
