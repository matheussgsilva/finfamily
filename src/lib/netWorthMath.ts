export interface RangeTransaction {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
}

/**
 * Reconstrói o saldo no início de um período a partir do saldo total atual
 * (já calculado, incluindo todo o histórico) e das transações que já
 * aconteceram dentro desse período: saldo_inicio = saldo_atual - net(período).
 * Transferências entre contas próprias não mudam o patrimônio total, então
 * são ignoradas aqui, igual ao resto do cálculo de patrimônio líquido.
 */
export function reconcileOpeningBalance(
  currentTotalBalance: number,
  rangeTransactions: RangeTransaction[]
): number {
  const rangeNet = rangeTransactions.reduce((sum, tx) => {
    if (tx.type === "INCOME") return sum + tx.amount;
    if (tx.type === "EXPENSE") return sum - tx.amount;
    return sum;
  }, 0);

  return currentTotalBalance - rangeNet;
}

export interface InvestmentHistoryInput {
  quantity: number; // quantidade atual
  avgPrice: number;
  createdAt: Date;
  operations: { type: "BUY" | "SELL"; quantity: number; date: Date }[];
  priceHistory: { price: number; date: Date }[];
}

/**
 * Estima o valor de um ativo numa data passada:
 * - quantidade = quantidade atual desfazendo as operações posteriores à data
 *   (compra depois => não existia ainda; venda depois => ainda estava na carteira);
 * - preço = último preço do histórico até a data, ou o preço médio quando não há
 *   histórico (melhor estimativa disponível).
 * Antes de o ativo existir no app (criação ou primeira operação), vale 0.
 */
export function investmentValueAt(asset: InvestmentHistoryInput, date: Date): number {
  const firstOperation = asset.operations.reduce<Date | null>(
    (min, op) => (min === null || op.date < min ? op.date : min),
    null
  );
  const existsSince =
    firstOperation && firstOperation < asset.createdAt ? firstOperation : asset.createdAt;
  if (date < existsSince) return 0;

  let quantity = asset.quantity;
  for (const op of asset.operations) {
    if (op.date <= date) continue;
    quantity += op.type === "BUY" ? -op.quantity : op.quantity;
  }
  quantity = Math.max(quantity, 0);

  let price = asset.avgPrice;
  let priceDate: Date | null = null;
  for (const entry of asset.priceHistory) {
    if (entry.date <= date && (priceDate === null || entry.date >= priceDate)) {
      price = entry.price;
      priceDate = entry.date;
    }
  }

  return quantity * price;
}
