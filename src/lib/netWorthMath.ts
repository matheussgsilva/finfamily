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
