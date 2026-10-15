import { describe, expect, it } from "vitest";
import {
  CSV_HEADER,
  exportQueryString,
  parseExportParams,
  summarizeTransactions,
  toTransactionFilters,
  transactionCsvRows,
  type ExportTransaction,
} from "./transactionExport";

const tx = (overrides: Partial<ExportTransaction>): ExportTransaction => ({
  date: new Date("2026-10-05T00:00:00.000Z"),
  description: "Mercado",
  type: "EXPENSE",
  amount: 100,
  notes: null,
  tags: [],
  isRecurring: false,
  installments: null,
  installmentNum: null,
  category: { id: "food", name: "Alimentação", color: "#f00" },
  bankAccount: { name: "Nubank" },
  destinationAccount: null,
  familyMember: null,
  ...overrides,
});

describe("transactionCsvRows", () => {
  it("monta cabeçalho e linha com valor negativo para despesa", () => {
    const rows = transactionCsvRows([
      tx({ installments: 10, installmentNum: 3, tags: ["casa", "importado"], notes: "obs" }),
    ]);
    expect(rows[0]).toEqual(CSV_HEADER);
    expect(rows[1]).toEqual([
      "05/10/2026", "Mercado", "Despesa", "Alimentação", "Nubank", "", "", "-100,00", "3/10", "Não", "casa, importado", "obs",
    ]);
  });

  it("transferência vai positiva, com conta destino e sem categoria", () => {
    const [, row] = transactionCsvRows([
      tx({ type: "TRANSFER", amount: 50, category: null, destinationAccount: { name: "Cartão" } }),
    ]);
    expect(row[2]).toBe("Transferência");
    expect(row[3]).toBe("");
    expect(row[5]).toBe("Cartão");
    expect(row[7]).toBe("50,00");
  });
});

describe("summarizeTransactions", () => {
  it("soma por tipo e agrupa por categoria com %", () => {
    const summary = summarizeTransactions([
      tx({ amount: 300 }),
      tx({ amount: 100, category: { id: "fun", name: "Lazer", color: "#0f0" } }),
      tx({ amount: 100, category: null }),
      tx({ type: "INCOME", amount: 1000, category: { id: "sal", name: "Salário", color: "#00f" } }),
      tx({ type: "TRANSFER", amount: 200, category: null }),
    ]);
    expect(summary).toMatchObject({ income: 1000, expense: 500, balance: 500, transfers: 200, count: 5 });
    expect(summary.expenseByCategory.map((c) => [c.name, c.total, c.percent])).toEqual([
      ["Alimentação", 300, 60],
      ["Lazer", 100, 20],
      ["Sem categoria", 100, 20],
    ]);
    expect(summary.incomeByCategory).toHaveLength(1);
  });
});

describe("parâmetros de exportação", () => {
  it("ida e volta pela URL", () => {
    const qs = exportQueryString({ start: "2026-10-01", end: "2026-10-31", type: "EXPENSE", search: "ifood" });
    expect(qs).toBe("start=2026-10-01&end=2026-10-31&type=EXPENSE&search=ifood");
    const parsed = parseExportParams(new URLSearchParams(qs));
    expect(parsed.success && parsed.data).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      type: "EXPENSE",
      search: "ifood",
    });
  });

  it("aceita searchParams de página (objeto) e ignora vazios", () => {
    const parsed = parseExportParams({ start: "2026-01-01", end: ["2026-12-31"], categoryId: "" });
    expect(parsed.success && parsed.data).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("rejeita início depois do fim e datas inexistentes", () => {
    expect(parseExportParams({ start: "2026-10-31", end: "2026-10-01" }).success).toBe(false);
    expect(parseExportParams({ start: "2026-02-31", end: "2026-03-01" }).success).toBe(false);
    expect(parseExportParams({ end: "2026-03-01" }).success).toBe(false);
  });

  it("converte os dias para o intervalo UTC das datas gravadas", () => {
    const filters = toTransactionFilters({ start: "2026-10-01", end: "2026-10-31" });
    expect(filters.startDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(filters.endDate?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
  });
});
