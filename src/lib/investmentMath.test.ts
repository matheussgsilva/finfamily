import { describe, expect, it } from "vitest";
import { applyOperation, revertOperation, type Position } from "./investmentMath";

describe("applyOperation", () => {
  it("compra aumenta a quantidade e pondera o preço médio (incluindo taxas)", () => {
    const position: Position = { quantity: 10, avgPrice: 20 };
    const result = applyOperation(position, { type: "BUY", quantity: 10, price: 30, fees: 5 });

    // custo total = 10*20 + 10*30 + 5 = 505; nova quantidade = 20; preço médio = 25.25
    expect(result.quantity).toBe(20);
    expect(result.avgPrice).toBeCloseTo(25.25);
  });

  it("primeira compra parte de posição zerada", () => {
    const position: Position = { quantity: 0, avgPrice: 0 };
    const result = applyOperation(position, { type: "BUY", quantity: 5, price: 10, fees: 0 });

    expect(result).toEqual({ quantity: 5, avgPrice: 10 });
  });

  it("venda reduz a quantidade e mantém o preço médio", () => {
    const position: Position = { quantity: 10, avgPrice: 20 };
    const result = applyOperation(position, { type: "SELL", quantity: 4, price: 999, fees: 0 });

    expect(result).toEqual({ quantity: 6, avgPrice: 20 });
  });

  it("venda maior que a posição atual lança erro", () => {
    const position: Position = { quantity: 3, avgPrice: 20 };
    expect(() =>
      applyOperation(position, { type: "SELL", quantity: 4, price: 10, fees: 0 })
    ).toThrow("Quantidade de venda maior que a posição atual.");
  });

  it("venda que zera a posição não gera divisão por zero", () => {
    const position: Position = { quantity: 5, avgPrice: 20 };
    const result = applyOperation(position, { type: "SELL", quantity: 5, price: 10, fees: 0 });

    expect(result).toEqual({ quantity: 0, avgPrice: 20 });
  });
});

describe("revertOperation", () => {
  it("desfaz uma compra usando o preço médio ATUAL, não o preço da operação original", () => {
    // NOTA: revertOperation usa o avgPrice atual da posição (não o `price` da operação
    // que está sendo desfeita) para "tirar" a quantidade de volta. Isso só reconstrói
    // exatamente o preço médio anterior quando o preço da operação == o preço médio atual.
    // Este teste documenta o comportamento real (idêntico ao que já existia em
    // investment.actions.ts antes da extração) — não é a mecânica "ideal" de estorno.
    const original: Position = { quantity: 10, avgPrice: 20 };
    const afterBuy = applyOperation(original, { type: "BUY", quantity: 10, price: 30, fees: 5 });
    const reverted = revertOperation(afterBuy, { type: "BUY", quantity: 10 });

    expect(reverted.quantity).toBe(original.quantity);
    // avgPrice NÃO volta a 20 aqui — fica em 25.25 (o avgPrice pós-compra), porque a
    // fórmula de reversão desconta `quantity * avgPrice atual`, não `quantity * price da operação`.
    expect(reverted.avgPrice).toBeCloseTo(afterBuy.avgPrice);
  });

  it("desfazer a compra que zera a posição não gera divisão por zero", () => {
    const position: Position = { quantity: 10, avgPrice: 20 };
    const reverted = revertOperation(position, { type: "BUY", quantity: 10 });

    expect(reverted).toEqual({ quantity: 0, avgPrice: 0 });
  });

  it("desfaz uma venda devolvendo a quantidade e mantendo o preço médio", () => {
    const position: Position = { quantity: 6, avgPrice: 20 };
    const reverted = revertOperation(position, { type: "SELL", quantity: 4 });

    expect(reverted).toEqual({ quantity: 10, avgPrice: 20 });
  });
});
