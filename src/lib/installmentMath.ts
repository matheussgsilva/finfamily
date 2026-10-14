/**
 * Divide o valor total de uma compra parcelada em `count` parcelas, trabalhando
 * em centavos inteiros para não perder/sobrar dinheiro por arredondamento.
 * Os centavos que sobram da divisão vão para a 1ª parcela
 * (ex.: R$ 100,00 em 3x => 33,34 + 33,33 + 33,33).
 */
export function splitInstallments(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) return [];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, i) =>
    (i === 0 ? baseCents + remainderCents : baseCents) / 100
  );
}
