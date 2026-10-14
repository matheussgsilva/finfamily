import { describe, expect, it } from "vitest";
import { splitInstallments } from "./installmentMath";

describe("splitInstallments", () => {
  it("divide igualmente quando o valor é divisível", () => {
    expect(splitInstallments(1200, 12)).toEqual(Array(12).fill(100));
  });

  it("joga os centavos que sobram na 1ª parcela", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("a soma das parcelas é sempre igual ao total", () => {
    const parts = splitInstallments(999.99, 7);
    const sumCents = parts.reduce((s, p) => s + Math.round(p * 100), 0);
    expect(sumCents).toBe(99999);
  });

  it("não sofre com imprecisão de ponto flutuante na entrada", () => {
    // 0.1 + 0.2 = 0.30000000000000004
    expect(splitInstallments(0.1 + 0.2, 2)).toEqual([0.15, 0.15]);
  });

  it("retorna array vazio para quantidade inválida", () => {
    expect(splitInstallments(100, 0)).toEqual([]);
    expect(splitInstallments(100, 1.5)).toEqual([]);
  });
});
