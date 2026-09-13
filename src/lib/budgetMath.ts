import { formatCurrency } from "@/lib/utils";

/**
 * Compara o gasto de uma categoria no mês com o orçamento definido e retorna
 * uma mensagem de alerta quando o orçamento foi estourado (>100%) ou está perto
 * do limite (>=90%). Retorna undefined quando está dentro do esperado.
 */
export function getBudgetAlertMessage(
  categoryName: string,
  spent: number,
  limit: number
): string | undefined {
  if (spent > limit) {
    return `Atenção: Você ultrapassou o orçamento de ${categoryName} em ${formatCurrency(spent - limit)}.`;
  }

  if (spent >= limit * 0.9) {
    return `Aviso: Você já utilizou ${Math.round((spent / limit) * 100)}% do orçamento de ${categoryName}.`;
  }

  return undefined;
}
