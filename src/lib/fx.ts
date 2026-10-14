/**
 * Como obter o câmbio de uma moeda para BRL no Yahoo Finance. Algumas bolsas
 * cotam em subunidade (Londres em pence: "GBp"/"GBX"), então o par é o da
 * moeda principal e o preço precisa ser dividido por 100.
 * Retorna null quando a moeda já é BRL.
 */
export function fxQuoteFor(currency: string): { symbol: string; divisor: number } | null {
  const code = currency.trim();
  if (!code || code.toUpperCase() === "BRL") return null;
  if (code === "GBp" || code.toUpperCase() === "GBX") return { symbol: "GBPBRL=X", divisor: 100 };
  return { symbol: `${code.toUpperCase()}BRL=X`, divisor: 1 };
}
