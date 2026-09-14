import { describe, expect, it } from "vitest";
import { computeNextOccurrenceDate, getDueOccurrences } from "./recurrence";

describe("computeNextOccurrenceDate", () => {
  it("soma um mês à data informada", () => {
    expect(computeNextOccurrenceDate(new Date(2026, 0, 15))).toEqual(
      new Date(2026, 1, 15)
    );
  });
});

describe("getDueOccurrences", () => {
  it("retorna array vazio quando a próxima ocorrência ainda não venceu", () => {
    const lastDate = new Date(2026, 0, 15);
    const today = new Date(2026, 1, 1);
    expect(getDueOccurrences(lastDate, today)).toEqual([]);
  });

  it("retorna uma ocorrência quando exatamente uma venceu", () => {
    const lastDate = new Date(2026, 0, 15);
    const today = new Date(2026, 1, 15);
    expect(getDueOccurrences(lastDate, today)).toEqual([new Date(2026, 1, 15)]);
  });

  it("retorna múltiplas ocorrências quando várias estão atrasadas", () => {
    const lastDate = new Date(2026, 0, 15);
    const today = new Date(2026, 4, 20);
    expect(getDueOccurrences(lastDate, today)).toEqual([
      new Date(2026, 1, 15),
      new Date(2026, 2, 15),
      new Date(2026, 3, 15),
      new Date(2026, 4, 15),
    ]);
  });

  it("respeita o teto de iterações para recorrências muito atrasadas", () => {
    const lastDate = new Date(2020, 0, 15);
    const today = new Date(2026, 0, 15);
    const result = getDueOccurrences(lastDate, today, 5);
    expect(result).toHaveLength(5);
    expect(result[4]).toEqual(new Date(2020, 5, 15));
  });
});
