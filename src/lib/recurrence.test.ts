import { describe, expect, it } from "vitest";
import { computeNextOccurrenceDate, getDueOccurrences } from "./recurrence";

describe("computeNextOccurrenceDate", () => {
  it("soma um mês à última ocorrência", () => {
    const root = new Date(2026, 0, 15);
    expect(computeNextOccurrenceDate(root, root)).toEqual(new Date(2026, 1, 15));
  });

  it("volta ao dia original da raiz depois de um mês curto", () => {
    const root = new Date(2026, 0, 31);
    const feb = new Date(2026, 1, 28);
    expect(computeNextOccurrenceDate(root, feb)).toEqual(new Date(2026, 2, 31));
  });
});

describe("getDueOccurrences", () => {
  it("retorna array vazio quando a próxima ocorrência ainda não venceu", () => {
    const root = new Date(2026, 0, 15);
    const today = new Date(2026, 1, 1);
    expect(getDueOccurrences(root, root, today)).toEqual([]);
  });

  it("retorna uma ocorrência quando exatamente uma venceu", () => {
    const root = new Date(2026, 0, 15);
    const today = new Date(2026, 1, 15);
    expect(getDueOccurrences(root, root, today)).toEqual([new Date(2026, 1, 15)]);
  });

  it("retorna múltiplas ocorrências quando várias estão atrasadas", () => {
    const root = new Date(2026, 0, 15);
    const today = new Date(2026, 4, 20);
    expect(getDueOccurrences(root, root, today)).toEqual([
      new Date(2026, 1, 15),
      new Date(2026, 2, 15),
      new Date(2026, 3, 15),
      new Date(2026, 4, 15),
    ]);
  });

  it("continua a partir da última ocorrência já lançada", () => {
    const root = new Date(2026, 0, 15);
    const last = new Date(2026, 2, 15);
    const today = new Date(2026, 4, 20);
    expect(getDueOccurrences(root, last, today)).toEqual([
      new Date(2026, 3, 15),
      new Date(2026, 4, 15),
    ]);
  });

  it("não deriva o dia em recorrências de fim de mês", () => {
    const root = new Date(2026, 0, 31);
    const today = new Date(2026, 4, 31);
    expect(getDueOccurrences(root, root, today)).toEqual([
      new Date(2026, 1, 28),
      new Date(2026, 2, 31),
      new Date(2026, 3, 30),
      new Date(2026, 4, 31),
    ]);
  });

  it("não duplica o mês de uma série que já tinha derivado de dia", () => {
    // Série antiga gerada com a regra anterior: 31/01 → 28/02 → 28/03.
    const root = new Date(2026, 0, 31);
    const driftedLast = new Date(2026, 2, 28);
    const today = new Date(2026, 3, 30);
    expect(getDueOccurrences(root, driftedLast, today)).toEqual([new Date(2026, 3, 30)]);
  });

  it("respeita o teto de ocorrências para recorrências muito atrasadas", () => {
    const root = new Date(2020, 0, 15);
    const today = new Date(2026, 0, 15);
    const result = getDueOccurrences(root, root, today, 5);
    expect(result).toHaveLength(5);
    expect(result[4]).toEqual(new Date(2020, 5, 15));
  });
});
