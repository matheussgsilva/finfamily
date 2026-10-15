import { describe, expect, it } from "vitest";
import { investmentValueAt, reconcileOpeningBalance } from "./netWorthMath";

describe("reconcileOpeningBalance", () => {
  it("retorna o próprio saldo atual quando não há transações no período", () => {
    expect(reconcileOpeningBalance(1000, [])).toBe(1000);
  });

  it("subtrai receitas do período para achar o saldo anterior a elas", () => {
    expect(
      reconcileOpeningBalance(1500, [{ type: "INCOME", amount: 500 }])
    ).toBe(1000);
  });

  it("soma despesas do período de volta para achar o saldo anterior a elas", () => {
    expect(
      reconcileOpeningBalance(800, [{ type: "EXPENSE", amount: 200 }])
    ).toBe(1000);
  });

  it("ignora transferências, que não alteram o patrimônio total", () => {
    expect(
      reconcileOpeningBalance(1000, [{ type: "TRANSFER", amount: 300 }])
    ).toBe(1000);
  });

  it("combina receitas, despesas e transferências no mesmo período", () => {
    const result = reconcileOpeningBalance(1000, [
      { type: "INCOME", amount: 500 },
      { type: "EXPENSE", amount: 200 },
      { type: "TRANSFER", amount: 300 },
    ]);
    // saldo atual 1000 = abertura + 500 - 200 => abertura = 700
    expect(result).toBe(700);
  });
});

describe("investmentValueAt", () => {
  const base = {
    quantity: 10,
    avgPrice: 20,
    createdAt: new Date(2026, 0, 1),
    operations: [],
    priceHistory: [],
  };

  it("vale 0 antes de o ativo existir no app", () => {
    expect(investmentValueAt(base, new Date(2025, 11, 31))).toBe(0);
  });

  it("usa o preço médio quando não há histórico de preços", () => {
    expect(investmentValueAt(base, new Date(2026, 5, 1))).toBe(200);
  });

  it("usa o último preço do histórico até a data", () => {
    const asset = {
      ...base,
      priceHistory: [
        { price: 25, date: new Date(2026, 2, 1) },
        { price: 30, date: new Date(2026, 4, 1) },
      ],
    };
    expect(investmentValueAt(asset, new Date(2026, 1, 1))).toBe(200); // antes do histórico
    expect(investmentValueAt(asset, new Date(2026, 3, 1))).toBe(250);
    expect(investmentValueAt(asset, new Date(2026, 5, 1))).toBe(300);
  });

  it("desfaz compras e vendas posteriores à data", () => {
    const asset = {
      ...base,
      quantity: 10,
      operations: [
        { type: "BUY" as const, quantity: 4, date: new Date(2026, 3, 1) },
        { type: "SELL" as const, quantity: 2, date: new Date(2026, 5, 1) },
      ],
    };
    expect(investmentValueAt(asset, new Date(2026, 2, 1))).toBe(8 * 20); // 10 - 4 + 2
    expect(investmentValueAt(asset, new Date(2026, 4, 1))).toBe(12 * 20); // 10 + 2
    expect(investmentValueAt(asset, new Date(2026, 6, 1))).toBe(10 * 20);
  });

  it("considera operações anteriores à criação do ativo no app", () => {
    const asset = {
      ...base,
      createdAt: new Date(2026, 5, 1),
      operations: [{ type: "BUY" as const, quantity: 10, date: new Date(2026, 0, 10) }],
    };
    expect(investmentValueAt(asset, new Date(2026, 0, 5))).toBe(0);
    expect(investmentValueAt(asset, new Date(2026, 2, 1))).toBe(200);
  });
});
