import { describe, expect, it } from "vitest";
import { reconcileOpeningBalance } from "./netWorthMath";

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
