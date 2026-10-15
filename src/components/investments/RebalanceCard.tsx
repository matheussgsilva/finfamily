"use client";

import React, { useMemo, useState } from "react";
import { Scale, Target } from "lucide-react";
import { suggestContribution, type RebalanceAssetInput } from "@/lib/rebalanceMath";
import { cn, formatCurrency } from "@/lib/utils";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS, type AssetClass } from "@/types";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";

interface RebalanceCardProps {
  classes: { assetClass: AssetClass; currentValue: number; targetPercent: number | null }[];
  assets: RebalanceAssetInput[];
  onDefineTargets: () => void;
}

const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** "Onde aportar": divide o aporte entre as classes (e ativos) abaixo da meta, sem vendas. */
export function RebalanceCard({ classes, assets, onDefineTargets }: RebalanceCardProps) {
  const [contribution, setContribution] = useState<number | undefined>(undefined);
  const hasTargets = classes.some((c) => (c.targetPercent ?? 0) > 0);

  const suggestion = useMemo(
    () =>
      suggestContribution({
        classes: classes.map((c) => ({ ...c, targetPercent: c.targetPercent ?? 0 })),
        assets,
        contribution: contribution ?? 0,
      }),
    [classes, assets, contribution]
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Scale size={15} className="text-indigo-400" />
          Onde aportar
        </h3>
        <Button size="sm" variant="outline" onClick={onDefineTargets}>
          <Target size={14} />
          Definir metas
        </Button>
      </div>

      {!hasTargets ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Defina as metas de alocação por classe para receber a sugestão de aporte.
        </p>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Label>Valor do aporte</Label>
            <CurrencyInput placeholder="0,00" value={contribution} onChange={setContribution} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Classe</th>
                  <th className="px-3 py-2 text-right font-medium">Atual</th>
                  <th className="px-3 py-2 text-right font-medium">Meta</th>
                  <th className="px-3 py-2 text-right font-medium">Aportar</th>
                  <th className="py-2 pl-3 text-right font-medium">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suggestion.classes.map((c) => (
                  <React.Fragment key={c.assetClass}>
                    <tr className="text-zinc-300">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: ASSET_CLASS_COLORS[c.assetClass] }}
                          />
                          {ASSET_CLASS_LABELS[c.assetClass]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(c.currentPercent)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {c.targetPercent > 0 ? pct(c.targetPercent) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          c.amount > 0 ? "text-emerald-400" : "text-zinc-600"
                        )}
                      >
                        <PrivacyValue>{formatCurrency(c.amount)}</PrivacyValue>
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {contribution ? pct(c.afterPercent) : "—"}
                        {!!contribution && c.targetPercent > 0 && Math.abs(c.gapAfter) >= 1 && (
                          <PrivacyValue className="block text-[11px] text-zinc-500">
                            {c.gapAfter > 0
                              ? `faltam ${formatCurrency(c.gapAfter)}`
                              : `${formatCurrency(-c.gapAfter)} acima`}
                          </PrivacyValue>
                        )}
                      </td>
                    </tr>
                    {c.amount > 0 && (
                      <tr>
                        <td colSpan={5} className="pb-3 pl-5 pt-0 text-xs text-zinc-400">
                          {c.assets === null ? (
                            <span className="text-zinc-500">
                              Escolha o ativo (sem &quot;Peso na classe&quot; definido nos ativos desta classe).
                            </span>
                          ) : (
                            <ul className="space-y-0.5">
                              {c.assets.map((a) => (
                                <li key={a.id} className="flex justify-between gap-3">
                                  <span className="truncate">
                                    {a.ticker ?? a.name}
                                    {a.quantity !== null && (
                                      <span className="text-zinc-500">
                                        {" "}
                                        · {a.quantity} {a.quantity === 1 ? "cota" : "cotas"}
                                      </span>
                                    )}
                                  </span>
                                  <PrivacyValue className="shrink-0 tabular-nums text-zinc-300">
                                    {formatCurrency(a.spend)}
                                  </PrivacyValue>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {!!contribution && (
            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-zinc-400">
              <span>
                Total sugerido:{" "}
                <PrivacyValue className="font-semibold text-zinc-200">
                  {formatCurrency(suggestion.totalSuggested - suggestion.leftover)}
                </PrivacyValue>
              </span>
              {suggestion.leftover > 0 && (
                <span>
                  Sobra (não fecha uma cota):{" "}
                  <PrivacyValue className="text-zinc-200">{formatCurrency(suggestion.leftover)}</PrivacyValue>
                </span>
              )}
            </div>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">
            Só compras: o aporte vai para o que está abaixo da meta, sem sugerir vendas.
          </p>
        </>
      )}
    </div>
  );
}
