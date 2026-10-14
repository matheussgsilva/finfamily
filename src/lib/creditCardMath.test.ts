import { describe, expect, it } from "vitest";
import {
  getInvoicePaymentPeriod,
  getInvoicePeriod,
  summarizeInvoice,
  type InvoiceTransaction,
} from "./creditCardMath";

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

describe("getInvoicePaymentPeriod", () => {
  it("vai do dia seguinte ao fechamento até o próximo fechamento", () => {
    const { startDate, endDate } = getInvoicePaymentPeriod(9, 2026, 5);

    expect(ymd(startDate)).toEqual({ year: 2026, month: 9, day: 6 });
    expect(ymd(endDate)).toEqual({ year: 2026, month: 10, day: 5 });
  });

  it("cruza a virada do ano (pagamento da fatura de dezembro cai em janeiro)", () => {
    const { startDate, endDate } = getInvoicePaymentPeriod(12, 2026, 5);

    expect(ymd(startDate)).toEqual({ year: 2026, month: 12, day: 6 });
    expect(ymd(endDate)).toEqual({ year: 2027, month: 1, day: 5 });
  });
});

describe("summarizeInvoice", () => {
  const CARD = "card";
  const CHECKING = "checking";
  const tx = (
    type: InvoiceTransaction["type"],
    amount: number,
    bankAccountId: string,
    destinationAccountId: string | null = null
  ): InvoiceTransaction => ({ type, amount, bankAccountId, destinationAccountId });

  it("soma despesas do cartão", () => {
    expect(
      summarizeInvoice(CARD, [tx("EXPENSE", 100, CARD), tx("EXPENSE", 50, CARD)], [])
    ).toEqual({ total: 150, paid: 0, open: 150 });
  });

  it("estorno (INCOME no cartão) reduz o total", () => {
    expect(
      summarizeInvoice(CARD, [tx("EXPENSE", 200, CARD), tx("INCOME", 30, CARD)], []).total
    ).toBe(170);
  });

  it("transferência saindo do cartão aumenta o total", () => {
    expect(
      summarizeInvoice(CARD, [tx("TRANSFER", 80, CARD, CHECKING)], []).total
    ).toBe(80);
  });

  it("pagamento dentro do período não reduz o total (pertence à fatura anterior)", () => {
    expect(
      summarizeInvoice(CARD, [tx("EXPENSE", 200, CARD), tx("TRANSFER", 200, CHECKING, CARD)], [])
    ).toEqual({ total: 200, paid: 0, open: 200 });
  });

  it("pagamento na janela de pagamento abate o valor em aberto", () => {
    expect(
      summarizeInvoice(
        CARD,
        [tx("EXPENSE", 300, CARD)],
        [tx("TRANSFER", 120, CHECKING, CARD), tx("EXPENSE", 999, CARD)]
      )
    ).toEqual({ total: 300, paid: 120, open: 180 });
  });

  it("pagamento acima do total deixa o em aberto zerado", () => {
    expect(
      summarizeInvoice(CARD, [tx("EXPENSE", 100, CARD)], [tx("TRANSFER", 150, CHECKING, CARD)])
        .open
    ).toBe(0);
  });

  it("evita erro de ponto flutuante somando em centavos", () => {
    expect(
      summarizeInvoice(CARD, [tx("EXPENSE", 0.1, CARD), tx("EXPENSE", 0.2, CARD)], []).total
    ).toBe(0.3);
  });

  it("lista vazia resulta em zero", () => {
    expect(summarizeInvoice(CARD, [], [])).toEqual({ total: 0, paid: 0, open: 0 });
  });
});
