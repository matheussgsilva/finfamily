import type { AssetClass } from "@/types";

export interface ContributionItem {
  key: string;
  current: number; // valor atual
  target: number; // meta em qualquer escala (é normalizada pela soma); 0 = sem meta
}

/**
 * Divide um aporte entre itens (classes ou ativos) sem vender nada:
 * - meta de cada item depois do aporte = (total atual + aporte) × peso;
 * - déficit = quanto falta para essa meta (0 para quem já está acima);
 * - se o aporte não cobre todos os déficits, vai proporcional aos déficits;
 *   se cobre, completa todos e divide a sobra pelos pesos.
 * Itens sem meta não recebem nada, mas contam no total (estão "acima").
 * Trabalha em centavos; o arredondamento fecha exatamente o valor do aporte.
 */
export function distributeContribution(
  items: ContributionItem[],
  contribution: number
): Map<string, number> {
  const result = new Map(items.map((i) => [i.key, 0]));
  const contributionCents = Math.round(contribution * 100);
  const totalWeight = items.reduce((s, i) => s + Math.max(i.target, 0), 0);
  if (contributionCents <= 0 || totalWeight <= 0) return result;

  const total = items.reduce((s, i) => s + i.current, 0) + contribution;
  const weighted = items
    .filter((i) => i.target > 0)
    .map((i) => {
      const weight = i.target / totalWeight;
      return { key: i.key, weight, deficit: Math.max(0, total * weight - i.current) };
    });
  const totalDeficit = weighted.reduce((s, i) => s + i.deficit, 0);

  const raw = weighted.map((i) => {
    const amount =
      totalDeficit >= contribution && totalDeficit > 0
        ? (contribution * i.deficit) / totalDeficit
        : i.deficit + (contribution - totalDeficit) * i.weight;
    return { ...i, cents: amount * 100 };
  });

  // Maior resto: arredonda para baixo e entrega os centavos que sobraram a
  // quem teve a maior parte fracionária (empate: maior déficit).
  const floored = raw.map((r) => ({ ...r, base: Math.floor(r.cents), frac: r.cents - Math.floor(r.cents) }));
  let remaining = contributionCents - floored.reduce((s, r) => s + r.base, 0);
  const order = [...floored].sort((a, b) => b.frac - a.frac || b.deficit - a.deficit);
  for (const item of order) {
    if (remaining <= 0) break;
    item.base += 1;
    remaining -= 1;
  }

  for (const item of floored) result.set(item.key, item.base / 100);
  return result;
}

// ─────────────────────────────────────────────────────────────
// Sugestão em dois níveis: classe → ativo
// ─────────────────────────────────────────────────────────────

/** Classes negociadas em cotas inteiras na B3. */
const WHOLE_UNIT_CLASSES: AssetClass[] = ["STOCKS", "REITS"];

export interface RebalanceClassInput {
  assetClass: AssetClass;
  currentValue: number;
  targetPercent: number; // 0 = sem meta
}

export interface RebalanceAssetInput {
  id: string;
  name: string;
  ticker: string | null;
  assetClass: AssetClass;
  currentValue: number;
  price: number;
  weight: number | null; // peso dentro da classe (%)
}

export interface AssetSuggestion {
  id: string;
  name: string;
  ticker: string | null;
  amount: number; // valor sugerido
  quantity: number | null; // cotas inteiras (Ações/FIIs)
  spend: number; // quanto de fato é gasto (cotas × preço, ou o valor)
  leftover: number; // o que não fecha uma cota
}

export interface ClassSuggestion {
  assetClass: AssetClass;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  amount: number;
  afterPercent: number;
  /** Quanto ainda falta (+) ou sobra (−) para a meta exata depois do aporte. Informativo. */
  gapAfter: number;
  /** null quando a classe recebe aporte mas não tem pesos por ativo. */
  assets: AssetSuggestion[] | null;
}

export interface ContributionSuggestion {
  classes: ClassSuggestion[];
  totalSuggested: number;
  leftover: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function suggestContribution({
  classes,
  assets,
  contribution,
}: {
  classes: RebalanceClassInput[];
  assets: RebalanceAssetInput[];
  contribution: number;
}): ContributionSuggestion {
  const totalCurrent = classes.reduce((s, c) => s + c.currentValue, 0);
  const totalAfter = totalCurrent + Math.max(contribution, 0);
  const totalTarget = classes.reduce((s, c) => s + Math.max(c.targetPercent, 0), 0);

  const classAmounts = distributeContribution(
    classes.map((c) => ({ key: c.assetClass, current: c.currentValue, target: c.targetPercent })),
    contribution
  );

  let leftover = 0;
  const result: ClassSuggestion[] = classes.map((c) => {
    const amount = classAmounts.get(c.assetClass) ?? 0;
    const ideal = totalTarget > 0 ? (totalAfter * Math.max(c.targetPercent, 0)) / totalTarget : 0;

    let assetSuggestions: AssetSuggestion[] | null = null;
    const classAssets = assets.filter((a) => a.assetClass === c.assetClass);
    if (amount > 0 && classAssets.some((a) => (a.weight ?? 0) > 0)) {
      const assetAmounts = distributeContribution(
        classAssets.map((a) => ({ key: a.id, current: a.currentValue, target: a.weight ?? 0 })),
        amount
      );
      assetSuggestions = classAssets
        .map((a) => {
          const value = assetAmounts.get(a.id) ?? 0;
          const wholeUnits = WHOLE_UNIT_CLASSES.includes(a.assetClass) && a.price > 0;
          const quantity = wholeUnits ? Math.floor(value / a.price + 1e-9) : null;
          const spend = quantity !== null ? round2(quantity * a.price) : value;
          return {
            id: a.id,
            name: a.name,
            ticker: a.ticker,
            amount: value,
            quantity,
            spend,
            leftover: round2(value - spend),
          };
        })
        .filter((s) => s.amount > 0);
      leftover += assetSuggestions.reduce((s, a) => s + a.leftover, 0);
    }

    return {
      assetClass: c.assetClass,
      currentValue: c.currentValue,
      currentPercent: totalCurrent > 0 ? (c.currentValue / totalCurrent) * 100 : 0,
      targetPercent: c.targetPercent,
      amount,
      afterPercent: totalAfter > 0 ? ((c.currentValue + amount) / totalAfter) * 100 : 0,
      gapAfter: round2(ideal - (c.currentValue + amount)),
      assets: assetSuggestions,
    };
  });

  return {
    classes: result,
    totalSuggested: round2(result.reduce((s, c) => s + c.amount, 0)),
    leftover: round2(leftover),
  };
}
