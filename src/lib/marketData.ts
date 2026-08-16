import "server-only";
import type { AssetClass } from "@/types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

export interface MarketPrice {
  price: number;
  currency: string;
  symbol: string;
}

/**
 * Normaliza um ticker para o formato esperado pela API do Yahoo Finance:
 * - Ações/FIIs brasileiras recebem o sufixo .SA (PETR4 -> PETR4.SA)
 * - Criptomoedas recebem o sufixo -USD (BTC -> BTC-USD)
 * - Ativos internacionais são usados como estão (VOO, AAPL)
 * - Tickers que já possuem sufixo (.SA, -USD, etc.) são preservados
 */
export function normalizeTicker(ticker: string, assetClass: AssetClass): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return "";
  if (t.includes(".") || t.includes("-")) return t;
  if (assetClass === "CRYPTO") return `${t}-USD`;
  if (assetClass === "INTERNATIONAL") return t;
  return `${t}.SA`;
}

/**
 * Busca o preço atual de um ativo na API pública do Yahoo Finance.
 * Retorna null quando o ticker não é encontrado ou a requisição falha.
 */
export async function fetchMarketPrice(symbol: string): Promise<MarketPrice | null> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    const meta = (data as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })
      ?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;

    const currency = typeof meta.currency === "string" ? meta.currency : "USD";
    return { price, currency, symbol };
  } catch {
    return null;
  }
}

/**
 * Tenta buscar o preço de um ativo tentando variações do ticker
 * (normalizado e depois o ticker cru como fallback).
 */
export async function fetchPriceForAsset(
  ticker: string,
  assetClass: AssetClass
): Promise<MarketPrice | null> {
  const normalized = normalizeTicker(ticker, assetClass);
  const candidates = normalized ? [normalized, ticker.trim().toUpperCase()] : [];
  for (const symbol of [...new Set(candidates)]) {
    const result = await fetchMarketPrice(symbol);
    if (result) return result;
  }
  return null;
}
