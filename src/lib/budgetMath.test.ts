import { describe, expect, it } from "vitest";
import { getBudgetAlertMessage } from "./budgetMath";

describe("getBudgetAlertMessage", () => {
  it("retorna undefined quando o gasto está bem abaixo do limite", () => {
    expect(getBudgetAlertMessage("Alimentação", 500, 1000)).toBeUndefined();
  });

  it("retorna aviso quando o gasto atinge 90% do limite", () => {
    const message = getBudgetAlertMessage("Alimentação", 900, 1000);
    expect(message).toContain("Aviso");
    expect(message).toContain("90%");
  });

  it("retorna alerta de estouro quando o gasto passa do limite", () => {
    const message = getBudgetAlertMessage("Alimentação", 1200, 1000);
    expect(message).toContain("Atenção");
    expect(message).toContain("R$");
  });

  it("gasto exatamente no limite não conta como estouro", () => {
    const message = getBudgetAlertMessage("Alimentação", 1000, 1000);
    expect(message).toContain("Aviso");
  });
});
