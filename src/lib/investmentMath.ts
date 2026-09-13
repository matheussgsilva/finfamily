export interface Position {
  quantity: number;
  avgPrice: number;
}

interface OperationInputMath {
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
}

/**
 * Aplica uma operação (compra/venda) a uma posição, recalculando quantidade e preço médio.
 * Compra: preço médio pondera o custo existente com o novo aporte (incluindo taxas).
 * Venda: preço médio não muda, só a quantidade reduz.
 */
export function applyOperation(position: Position, op: OperationInputMath): Position {
  if (op.type === "BUY") {
    const newQuantity = position.quantity + op.quantity;
    const costTotal = position.quantity * position.avgPrice + op.quantity * op.price + op.fees;
    return { quantity: newQuantity, avgPrice: newQuantity > 0 ? costTotal / newQuantity : 0 };
  }

  if (op.quantity > position.quantity) {
    throw new Error("Quantidade de venda maior que a posição atual.");
  }
  return { quantity: position.quantity - op.quantity, avgPrice: position.avgPrice };
}

/**
 * Desfaz uma operação já aplicada (usado ao excluir uma operação), invertendo `applyOperation`.
 */
export function revertOperation(
  position: Position,
  op: Pick<OperationInputMath, "type" | "quantity">
): Position {
  if (op.type === "BUY") {
    const newQuantity = position.quantity - op.quantity;
    const totalInvested = position.quantity * position.avgPrice;
    const removedValue = op.quantity * position.avgPrice;
    return {
      quantity: newQuantity,
      avgPrice: newQuantity > 0 ? (totalInvested - removedValue) / newQuantity : 0,
    };
  }

  return { quantity: position.quantity + op.quantity, avgPrice: position.avgPrice };
}
