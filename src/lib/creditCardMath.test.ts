import { describe, expect, it } from "vitest";
import { calculateInvoiceTotal, getInvoicePeriod } from "./creditCardMath";

function ymd(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

describe("getInvoicePeriod", () => {
  it("calcula o período dentro do mesmo ano civil", () => {
    const { startDate, endDate } = getInvoicePeriod(9, 2026, 5);

    expect(ymd(startDate)).toEqual({ year: 2026, month: 8, day: 6 });
    expect(ymd(endDate)).toEqual({ year: 2026, month: 9, day: 5 });
  });

  it("cruza a virada do ano (fatura de janeiro começa em dezembro do ano anterior)", () => {
    const { startDate, endDate } = getInvoicePeriod(1, 2026, 5);

    expect(ymd(startDate)).toEqual({ year: 2025, month: 12, day: 6 });
    expect(ymd(endDate)).toEqual({ year: 2026, month: 1, day: 5 });
  });

  it("usa o dia 1 como fechamento quando closingDay é null", () => {
    const { startDate, endDate } = getInvoicePeriod(3, 2026, null);

    expect(ymd(startDate)).toEqual({ year: 2026, month: 2, day: 2 });
    expect(ymd(endDate)).toEqual({ year: 2026, month: 3, day: 1 });
  });
});

describe("calculateInvoiceTotal", () => {
  it("soma despesas", () => {
    expect(
      calculateInvoiceTotal([
        { type: "EXPENSE", amount: 100 },
        { type: "EXPENSE", amount: 50 },
      ])
    ).toBe(150);
  });

  it("pagamento (INCOME ou TRANSFER) reduz o total da fatura", () => {
    expect(
      calculateInvoiceTotal([
        { type: "EXPENSE", amount: 200 },
        { type: "TRANSFER", amount: 200 },
      ])
    ).toBe(0);
  });

  it("lista vazia resulta em zero", () => {
    expect(calculateInvoiceTotal([])).toBe(0);
  });
});
