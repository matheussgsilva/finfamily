import { describe, expect, it } from "vitest";
import {
  addMonthsToDay,
  buildInvoiceEvents,
  buildProjection,
  nextDay,
  simulatePurchase,
  type DatedInvoiceTransaction,
  type ProjectionEvent,
} from "./projectionMath";

describe("aritmética de dias", () => {
  it("nextDay vira mês e ano", () => {
    expect(nextDay("2026-01-31")).toBe("2026-02-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("addMonthsToDay limita ao fim do mês", () => {
    expect(addMonthsToDay("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDay("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("buildProjection", () => {
  const ev = (day: string, amount: number, kind: ProjectionEvent["kind"] = "transaction"): ProjectionEvent => ({
    day,
    amount,
    description: "x",
    kind,
  });

  it("acumula os eventos dia a dia e acha o menor saldo", () => {
    const result = buildProjection({
      startDay: "2026-10-14",
      endDay: "2026-10-18",
      startBalance: 1000,
      events: [ev("2026-10-15", -1500), ev("2026-10-17", 2000)],
      variable: null,
    });
    expect(result.points.map((p) => p.balance)).toEqual([1000, -500, -500, 1500, 1500]);
    expect(result.lowest).toEqual({ day: "2026-10-15", balance: -500 });
    expect(result.endBalance).toBe(1500);
  });

  it("aplica hoje os eventos atrasados e ignora os depois do fim", () => {
    const result = buildProjection({
      startDay: "2026-10-14",
      endDay: "2026-10-15",
      startBalance: 1000,
      events: [ev("2026-10-05", -300, "invoice"), ev("2026-11-01", -999)],
      variable: null,
    });
    expect(result.points).toEqual([
      { day: "2026-10-14", balance: 700 },
      { day: "2026-10-15", balance: 700 },
    ]);
  });

  it("distribui a estimativa mensal pelos dias, a partir de amanhã", () => {
    const result = buildProjection({
      startDay: "2026-11-01",
      endDay: "2026-11-30",
      startBalance: 0,
      events: [],
      variable: { monthlyIncome: 300, monthlyExpense: 3300 },
    });
    // 29 dias de novembro (30 dias) a -100/dia
    expect(result.endBalance).toBe(-2900);
    expect(result.points[0].balance).toBe(0);
    expect(result.months[0].variable).toBe(-2900);
  });

  it("resume por mês separando faturas", () => {
    const result = buildProjection({
      startDay: "2026-10-30",
      endDay: "2026-11-02",
      startBalance: 100,
      events: [
        ev("2026-10-31", 50),
        ev("2026-11-01", -20),
        ev("2026-11-02", -70, "invoice"),
      ],
      variable: null,
    });
    expect(result.months).toEqual([
      { month: "2026-10", income: 50, expense: 0, invoices: 0, variable: 0, endBalance: 150 },
      { month: "2026-11", income: 0, expense: 20, invoices: 70, variable: 0, endBalance: 60 },
    ]);
  });
});

describe("buildInvoiceEvents", () => {
  const CARD = "card";
  const charge = (date: Date, amount: number): DatedInvoiceTransaction => ({
    type: "EXPENSE",
    amount,
    bankAccountId: CARD,
    destinationAccountId: null,
    date,
  });
  const payment = (date: Date, amount: number): DatedInvoiceTransaction => ({
    type: "TRANSFER",
    amount,
    bankAccountId: "checking",
    destinationAccountId: CARD,
    date,
  });
  const base = {
    cardId: CARD,
    cardName: "Nubank",
    closingDay: 28,
    dueDay: 5,
    today: new Date(2026, 9, 14),
  };

  it("gera a saída no vencimento do mês seguinte ao fechamento", () => {
    const events = buildInvoiceEvents({
      ...base,
      charges: [charge(new Date(2026, 9, 10), 300)],
      payments: [],
      invoiceMonths: [{ month: 10, year: 2026 }],
    });
    expect(events).toEqual([
      { day: "2026-11-05", amount: -300, description: "Fatura Nubank 10/2026", kind: "invoice" },
    ]);
  });

  it("abate pagamentos e não gera evento para fatura quitada", () => {
    const events = buildInvoiceEvents({
      ...base,
      charges: [charge(new Date(2026, 9, 10), 300), charge(new Date(2026, 10, 10), 200)],
      payments: [payment(new Date(2026, 10, 1), 300), payment(new Date(2026, 11, 1), 50)],
      invoiceMonths: [
        { month: 10, year: 2026 },
        { month: 11, year: 2026 },
      ],
    });
    expect(events.map((e) => [e.day, e.amount])).toEqual([["2026-12-05", -150]]);
  });

  it("marca como vencida a fatura do mês atual não paga e ignora meses anteriores", () => {
    const events = buildInvoiceEvents({
      ...base,
      charges: [charge(new Date(2026, 7, 10), 100), charge(new Date(2026, 8, 10), 400)],
      payments: [],
      invoiceMonths: [
        { month: 8, year: 2026 }, // vence 05/09: mês anterior, ignorada
        { month: 9, year: 2026 }, // vence 05/10: vencida neste mês
      ],
    });
    expect(events).toEqual([
      {
        day: "2026-10-05",
        amount: -400,
        description: "Fatura Nubank 09/2026",
        kind: "invoice",
        overdue: true,
      },
    ]);
  });

  it("sem dia de vencimento, usa o fechamento", () => {
    const events = buildInvoiceEvents({
      ...base,
      dueDay: null,
      charges: [charge(new Date(2026, 10, 10), 80)],
      payments: [],
      invoiceMonths: [{ month: 11, year: 2026 }],
    });
    expect(events[0].day).toBe("2026-11-28");
  });
});

describe("simulatePurchase", () => {
  it("à vista gera uma saída no dia", () => {
    expect(simulatePurchase({ amount: 500, day: "2026-10-20", installments: 1 })).toEqual([
      { day: "2026-10-20", amount: -500, description: "Simulação", kind: "simulation" },
    ]);
  });

  it("parcelado divide o valor mês a mês", () => {
    const events = simulatePurchase({ amount: 100, day: "2026-10-31", installments: 3 });
    expect(events.map((e) => [e.day, e.amount])).toEqual([
      ["2026-10-31", -33.34],
      ["2026-11-30", -33.33],
      ["2026-12-31", -33.33],
    ]);
  });
});
