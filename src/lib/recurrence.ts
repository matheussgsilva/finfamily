import { addMonths, differenceInCalendarMonths, isAfter } from "date-fns";

/**
 * Única regra suportada por enquanto (MVP mensal). O valor é gravado em
 * `Transaction.recurrenceRule` e também funciona como marcador permanente de
 * "esta transação raiz já foi uma recorrência", mesmo depois de encerrada.
 */
export const DEFAULT_RECURRENCE_RULE = "FREQ=MONTHLY;INTERVAL=1";

/**
 * Índice (em meses a partir da raiz) da primeira ocorrência que cai num mês
 * posterior ao de `lastDate`. Comparar por mês do calendário, e não por data
 * exata, faz séries que já derivaram de dia (ex.: 28/03 em vez de 31/03) não
 * gerarem uma segunda ocorrência no mesmo mês.
 */
function nextOccurrenceIndex(rootDate: Date, lastDate: Date): number {
  return Math.max(1, differenceInCalendarMonths(lastDate, rootDate) + 1);
}

/**
 * Próxima ocorrência depois de `lastDate`. As datas são sempre calculadas a
 * partir da raiz (`rootDate + k meses`), então uma recorrência do dia 31 fica
 * 31/01 → 28/02 → 31/03, em vez de travar no dia 28 para sempre.
 */
export function computeNextOccurrenceDate(rootDate: Date, lastDate: Date): Date {
  return addMonths(rootDate, nextOccurrenceIndex(rootDate, lastDate));
}

/**
 * Retorna as datas mensais devidas depois do mês de `lastDate` até `today`
 * (inclusivo). O teto evita gerar uma série enorme de uma vez só caso uma
 * recorrência fique muito tempo sem o app ser aberto.
 */
export function getDueOccurrences(
  rootDate: Date,
  lastDate: Date,
  today: Date,
  maxOccurrences = 36
): Date[] {
  const dates: Date[] = [];

  for (let k = nextOccurrenceIndex(rootDate, lastDate); dates.length < maxOccurrences; k++) {
    const next = addMonths(rootDate, k);
    if (isAfter(next, today)) break;
    dates.push(next);
  }

  return dates;
}
