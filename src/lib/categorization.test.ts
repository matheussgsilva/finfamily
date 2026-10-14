import { describe, expect, it } from "vitest";
import {
  historyKey,
  matchRule,
  normalizeDescription,
  suggestCategory,
  type RuleForMatching,
} from "./categorization";

describe("normalizeDescription", () => {
  it("remove acentos, dígitos, pontuação e colapsa espaços", () => {
    expect(normalizeDescription("  IFD*iFood   São Paulo 1234 ")).toBe("ifd ifood sao paulo");
  });
});

describe("matchRule", () => {
  const rules: RuleForMatching[] = [
    { pattern: "ifood", categoryId: "food", categoryType: "EXPENSE" },
    { pattern: "IFOOD Mercado", categoryId: "market", categoryType: "EXPENSE" },
    { pattern: "salário", categoryId: "salary", categoryType: "INCOME" },
  ];

  it("casa por 'contém' ignorando maiúsculas e acentos", () => {
    expect(matchRule(rules, "IFD*IFOOD RESTAURANTE", "EXPENSE")?.categoryId).toBe("food");
    expect(matchRule(rules, "SALARIO OUTUBRO", "INCOME")?.categoryId).toBe("salary");
  });

  it("o padrão mais específico vence", () => {
    expect(matchRule(rules, "IFOOD MERCADO 123", "EXPENSE")?.categoryId).toBe("market");
  });

  it("não aplica regra de categoria de outro tipo", () => {
    expect(matchRule(rules, "SALARIO", "EXPENSE")).toBeNull();
  });

  it("ignora padrões que ficam vazios após normalizar", () => {
    expect(matchRule([{ pattern: "123", categoryId: "x", categoryType: "EXPENSE" }], "123", "EXPENSE")).toBeNull();
  });
});

describe("suggestCategory", () => {
  const rules: RuleForMatching[] = [{ pattern: "uber", categoryId: "transport", categoryType: "EXPENSE" }];
  const history = new Map([[historyKey("EXPENSE", "Padaria Pão Quente 01"), "bakery"]]);

  it("prioriza a regra", () => {
    expect(suggestCategory({ rules, history, description: "UBER *TRIP", type: "EXPENSE" })).toEqual({
      categoryId: "transport",
      source: "rule",
    });
  });

  it("sem regra, usa o histórico com a mesma descrição normalizada", () => {
    expect(
      suggestCategory({ rules, history, description: "PADARIA PAO QUENTE 99", type: "EXPENSE" })
    ).toEqual({ categoryId: "bakery", source: "history" });
  });

  it("o histórico respeita o tipo do lançamento", () => {
    expect(
      suggestCategory({ rules, history, description: "PADARIA PAO QUENTE", type: "INCOME" })
    ).toEqual({ categoryId: null, source: null });
  });
});
