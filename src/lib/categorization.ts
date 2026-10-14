export type CategorizableType = "INCOME" | "EXPENSE";

export interface RuleForMatching {
  pattern: string;
  categoryId: string;
  categoryType: CategorizableType;
}

export interface CategorySuggestion {
  categoryId: string | null;
  source: "rule" | "history" | null;
}

/**
 * Normaliza descrições para comparação: minúsculas, sem acentos, sem dígitos
 * nem pontuação (códigos de autorização, datas, "*" etc. variam entre lançamentos
 * do mesmo estabelecimento) e espaços colapsados.
 * Ex.: "IFD*iFood São Paulo 1234" => "ifd ifood sao paulo".
 */
export function normalizeDescription(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave do mapa de histórico: o mesmo texto pode ser receita e despesa com categorias diferentes. */
export function historyKey(type: CategorizableType, description: string): string {
  return `${type}|${normalizeDescription(description)}`;
}

/**
 * Regra que casa com a descrição: o padrão (normalizado) precisa estar contido
 * na descrição (normalizada) e a categoria precisa ser do mesmo tipo do
 * lançamento. Com várias candidatas, vence o padrão mais longo (mais específico).
 */
export function matchRule(
  rules: RuleForMatching[],
  description: string,
  type: CategorizableType
): RuleForMatching | null {
  const normalized = normalizeDescription(description);
  let best: RuleForMatching | null = null;
  let bestLength = 0;

  for (const rule of rules) {
    if (rule.categoryType !== type) continue;
    const pattern = normalizeDescription(rule.pattern);
    if (!pattern || !normalized.includes(pattern)) continue;
    if (pattern.length > bestLength) {
      best = rule;
      bestLength = pattern.length;
    }
  }

  return best;
}

/** Sugere a categoria: regra do usuário primeiro; sem regra, a última categoria usada para a mesma descrição. */
export function suggestCategory({
  rules,
  history,
  description,
  type,
}: {
  rules: RuleForMatching[];
  history: Map<string, string>;
  description: string;
  type: CategorizableType;
}): CategorySuggestion {
  const rule = matchRule(rules, description, type);
  if (rule) return { categoryId: rule.categoryId, source: "rule" };

  const fromHistory = history.get(historyKey(type, description));
  if (fromHistory) return { categoryId: fromHistory, source: "history" };

  return { categoryId: null, source: null };
}
