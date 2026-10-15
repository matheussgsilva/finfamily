import { describe, expect, it } from "vitest";
import { distributeContribution, suggestContribution, type RebalanceAssetInput } from "./rebalanceMath";

const toObject = (map: Map<string, number>) => Object.fromEntries(map);

describe("distributeContribution", () => {
  it("aporte menor que os déficits vai proporcional aos déficits", () => {
    // total depois = 1000 + 100 = 1100; metas 50/50 → 550 cada
    // déficits: A = 550 - 300 = 250, B = 550 - 700 = 0
    const result = distributeContribution(
      [
        { key: "A", current: 300, target: 50 },
        { key: "B", current: 700, target: 50 },
      ],
      100
    );
    expect(toObject(result)).toEqual({ A: 100, B: 0 });
  });

  it("divide entre vários abaixo da meta na proporção do que falta", () => {
    // total depois = 1000 + 300 = 1300; metas 40/40/20 → 520/520/260
    // déficits: A = 420, B = 320, C = 0 → 300 dividido 420:320
    const result = distributeContribution(
      [
        { key: "A", current: 100, target: 40 },
        { key: "B", current: 200, target: 40 },
        { key: "C", current: 700, target: 20 },
      ],
      300
    );
    expect(result.get("A")).toBeCloseTo(170.27, 2);
    expect(result.get("B")).toBeCloseTo(129.73, 2);
    expect(result.get("C")).toBe(0);
  });

  it("aporte maior que os déficits completa todos e divide a sobra pelos pesos", () => {
    // total depois = 200 + 1000 = 1200; metas 50/50 → 600 cada; déficits 500/500
    const result = distributeContribution(
      [
        { key: "A", current: 100, target: 1 },
        { key: "B", current: 100, target: 1 },
      ],
      1000
    );
    expect(toObject(result)).toEqual({ A: 500, B: 500 });
  });

  it("item sem meta não recebe nada, mas conta no total", () => {
    // total depois = 1000 + 500 = 1500; A tem 100% da meta → 1500, déficit 1500
    const result = distributeContribution(
      [
        { key: "A", current: 0, target: 100 },
        { key: "SEM_META", current: 1000, target: 0 },
      ],
      500
    );
    expect(toObject(result)).toEqual({ A: 500, SEM_META: 0 });
  });

  it("o arredondamento fecha exatamente o valor do aporte", () => {
    const result = distributeContribution(
      [
        { key: "A", current: 0, target: 1 },
        { key: "B", current: 0, target: 1 },
        { key: "C", current: 0, target: 1 },
      ],
      100
    );
    const sumCents = [...result.values()].reduce((s, v) => s + Math.round(v * 100), 0);
    expect(sumCents).toBe(10000);
  });

  it("sem metas ou sem aporte, ninguém recebe", () => {
    expect(toObject(distributeContribution([{ key: "A", current: 10, target: 0 }], 100))).toEqual({ A: 0 });
    expect(toObject(distributeContribution([{ key: "A", current: 10, target: 100 }], 0))).toEqual({ A: 0 });
  });
});

describe("suggestContribution", () => {
  const assets: RebalanceAssetInput[] = [
    { id: "bova", name: "BOVA11", ticker: "BOVA11", assetClass: "STOCKS", currentValue: 0, price: 120, weight: 60 },
    { id: "ivvb", name: "IVVB11", ticker: "IVVB11", assetClass: "STOCKS", currentValue: 0, price: 300, weight: 40 },
    { id: "cdb", name: "CDB", ticker: null, assetClass: "FIXED_INCOME", currentValue: 1000, price: 1, weight: null },
  ];

  it("desce da classe para o ativo, com cotas inteiras e sobra", () => {
    const result = suggestContribution({
      classes: [
        { assetClass: "FIXED_INCOME", currentValue: 1000, targetPercent: 50 },
        { assetClass: "STOCKS", currentValue: 0, targetPercent: 50 },
      ],
      assets,
      contribution: 1000,
    });
    // total depois 2000 → Ações precisa de 1000, Renda Fixa já tem os 1000 dela
    const stocks = result.classes.find((c) => c.assetClass === "STOCKS")!;
    expect(stocks.amount).toBe(1000);
    expect(stocks.afterPercent).toBe(50);
    expect(stocks.gapAfter).toBe(0);
    // dentro de Ações: 600 em BOVA11 (5 cotas = 600) e 400 em IVVB11 (1 cota = 300, sobra 100)
    expect(stocks.assets).toEqual([
      { id: "bova", name: "BOVA11", ticker: "BOVA11", amount: 600, quantity: 5, spend: 600, leftover: 0 },
      { id: "ivvb", name: "IVVB11", ticker: "IVVB11", amount: 400, quantity: 1, spend: 300, leftover: 100 },
    ]);
    expect(result.totalSuggested).toBe(1000);
    expect(result.leftover).toBe(100);
  });

  it("classe sem pesos por ativo não detalha (você escolhe o ativo)", () => {
    const result = suggestContribution({
      classes: [{ assetClass: "FIXED_INCOME", currentValue: 1000, targetPercent: 100 }],
      assets,
      contribution: 500,
    });
    expect(result.classes[0].amount).toBe(500);
    expect(result.classes[0].assets).toBeNull();
  });

  it("classe com meta mas sem ativos ainda recebe aporte", () => {
    const result = suggestContribution({
      classes: [
        { assetClass: "FIXED_INCOME", currentValue: 900, targetPercent: 90 },
        { assetClass: "CRYPTO", currentValue: 0, targetPercent: 10 },
      ],
      assets,
      contribution: 100,
    });
    // total depois 1000 → Renda Fixa 900 (ok), Cripto 100
    expect(result.classes.map((c) => [c.assetClass, c.amount])).toEqual([
      ["FIXED_INCOME", 0],
      ["CRYPTO", 100],
    ]);
  });
});
