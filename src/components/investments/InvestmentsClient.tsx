"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Coins,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { queryInvestmentDetail } from "@/actions/query.actions";
import { deleteInvestment } from "@/actions/investment.actions";
import { formatCurrency, cn } from "@/lib/utils";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, type AssetClass } from "@/types";
import { InvestmentFormDialog } from "./InvestmentFormDialog";
import { OperationFormDialog } from "./OperationFormDialog";
import { ProventoFormDialog } from "./ProventoFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { Button } from "@/components/ui/button";

interface AssetWithCalcs {
  id: string;
  ticker: string | null;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
  targetAlloc: number | null;
  totalCost: number;
  currentValue: number;
  result: number;
  resultPercent: number;
  portfolioWeight: number;
}

interface AllocationItem {
  assetClass: AssetClass;
  label: string;
  currentPercent: number;
  targetPercent: number | null;
  currentValue: number;
  color: string;
}

interface OperationItem {
  id: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  total: number;
  date: Date;
  notes: string | null;
}

interface ProventoItem {
  id: string;
  type: string;
  amount: number;
  paymentDate: Date;
  referenceDate: Date | null;
  notes: string | null;
}

interface MonthlyProvento {
  month: string;
  value: number;
}

interface InvestmentsClientProps {
  assets: AssetWithCalcs[];
  totalValue: number;
  allocation: AllocationItem[];
  monthlyProventos: MonthlyProvento[];
}

interface DetailData {
  operations: OperationItem[];
  proventos: ProventoItem[];
}

const PROVENTO_LABELS: Record<string, string> = {
  DIVIDEND: "Dividendo",
  JCP: "JCP",
  RENDIMENTO: "Rendimento",
  AMORTIZACAO: "Amortização",
  OUTROS: "Outros",
};

export function InvestmentsClient({
  assets,
  totalValue,
  allocation,
  monthlyProventos,
}: InvestmentsClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssetWithCalcs | null>(null);
  const [deleting, setDeleting] = useState<AssetWithCalcs | null>(null);
  const [opTarget, setOpTarget] = useState<AssetWithCalcs | null>(null);
  const [proventoTarget, setProventoTarget] = useState<AssetWithCalcs | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailData>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const yearTotal = monthlyProventos.reduce((s, m) => s + m.value, 0);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      setDetailLoading(id);
      try {
        const data = await queryInvestmentDetail(id);
        setDetails((prev) => ({ ...prev, [id]: data }));
      } catch {
        setDetails((prev) => ({ ...prev, [id]: { operations: [], proventos: [] } }));
      } finally {
        setDetailLoading(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <Briefcase size={14} className="text-blue-400" />
            Carteira total
          </div>
          <PrivacyValue className="text-xl font-bold text-white block">
            {formatCurrency(totalValue)}
          </PrivacyValue>
          <p className="text-[11px] text-zinc-500 mt-1">{assets.length} ativos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <Coins size={14} className="text-emerald-400" />
            Proventos do ano
          </div>
          <PrivacyValue className="text-xl font-bold text-emerald-400 block">
            {formatCurrency(yearTotal)}
          </PrivacyValue>
          <p className="text-[11px] text-zinc-500 mt-1">
            {yearTotal > 0
              ? `média de ${formatCurrency(yearTotal / 12)}/mês`
              : "registre os primeiros proventos"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <TrendingUp size={14} className="text-indigo-400" />
            Custo total
          </div>
          <PrivacyValue className="text-xl font-bold text-white block">
            {formatCurrency(assets.reduce((s, a) => s + a.totalCost, 0))}
          </PrivacyValue>
          <p className="text-[11px] text-zinc-500 mt-1">preço médio de compra</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <ArrowUpRight size={14} className="text-amber-400" />
            Resultado
          </div>
          {(() => {
            const result = assets.reduce((s, a) => s + a.result, 0);
            const cost = assets.reduce((s, a) => s + a.totalCost, 0);
            const pct = cost > 0 ? (result / cost) * 100 : 0;
            return (
              <>
                <PrivacyValue
                  className={cn(
                    "text-xl font-bold block",
                    result >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {result >= 0 ? "+" : ""}
                  {formatCurrency(result)}
                </PrivacyValue>
                <p
                  className={cn(
                    "text-[11px] mt-1",
                    result >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {pct.toFixed(2)}%
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Alocação + Proventos mensais */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">Alocação por classe</h3>
          {allocation.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Sem ativos cadastrados.</p>
          ) : (
            <div className="space-y-4">
              {allocation.map((item) => (
                <div key={item.assetClass}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                    <span className="text-zinc-500 tabular-nums">
                      {item.currentPercent.toFixed(1)}%
                      {item.targetPercent !== null && (
                        <span className="text-zinc-600 ml-1">(meta {item.targetPercent}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(item.currentPercent, 100)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">Proventos por mês</h3>
            <span className="text-xs text-zinc-500">
              Total: <span className="text-emerald-400 font-semibold">{formatCurrency(yearTotal)}</span>
            </span>
          </div>
          {yearTotal === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              Registre proventos para ver a distribuição mensal.
            </p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {monthlyProventos.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-zinc-600 tabular-nums">
                    {m.value > 0 ? formatCurrency(m.value).replace(/,\d+$/, "") : ""}
                  </span>
                  <div className="w-full rounded-t-lg bg-emerald-500/70"
                    style={{ height: `${yearTotal > 0 ? Math.max((m.value / yearTotal) * 100, 2) : 2}%` }}
                  />
                  <span className="text-[10px] text-zinc-500 capitalize">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de ativos */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Novo ativo
        </Button>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={<Briefcase size={20} />}
            title="Nenhum ativo cadastrado"
            description="Comece cadastrando seus investimentos para acompanhar a evolução da carteira."
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={16} />
                Cadastrar primeiro ativo
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => {
            const expanded = expandedId === asset.id;
            const detail = details[asset.id];
            const positive = asset.result >= 0;
            return (
              <div key={asset.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-900/40 transition group"
                  onClick={() => toggleExpand(asset.id)}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{
                      backgroundColor: `${ASSET_CLASS_COLORS[asset.assetClass]}22`,
                      color: ASSET_CLASS_COLORS[asset.assetClass],
                    }}
                  >
                    {positive ? <TrendingUp size={16} /> : <ArrowDownLeft size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {asset.ticker ?? asset.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ASSET_CLASS_LABELS[asset.assetClass]} · {asset.quantity.toLocaleString("pt-BR")} un.
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <PrivacyValue className="text-sm font-semibold text-zinc-200 block">
                      {formatCurrency(asset.currentValue)}
                    </PrivacyValue>
                    <p className="text-[11px] text-zinc-500">
                      {asset.portfolioWeight.toFixed(1)}% da carteira
                    </p>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <PrivacyValue
                      className={cn(
                        "text-sm font-semibold block",
                        positive ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatCurrency(asset.result)}
                    </PrivacyValue>
                    <p className={cn("text-[11px]", positive ? "text-emerald-500" : "text-red-500")}>
                      {positive ? "+" : ""}
                      {asset.resultPercent.toFixed(1)}%
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-zinc-600 transition-transform shrink-0",
                      expanded && "rotate-180"
                    )}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-zinc-800/60 p-4 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setOpTarget(asset)}>
                        <Plus size={14} />
                        Compra / Venda
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setProventoTarget(asset)}>
                        <Coins size={14} />
                        Provento
                      </Button>
                      <div className="flex-1" />
                      <button
                        onClick={() => {
                          setEditing(asset);
                          setFormOpen(true);
                        }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                        title="Editar ativo"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleting(asset)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                        title="Excluir ativo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {detailLoading === asset.id ? (
                      <p className="text-xs text-zinc-500 py-4 text-center">
                        Carregando operações...
                      </p>
                    ) : detail ? (
                      <>
                        {detail.operations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                              Últimas operações
                            </p>
                            <div className="divide-y divide-zinc-800/60">
                              {detail.operations.map((op) => (
                                <div key={op.id} className="flex items-center gap-3 py-2 text-sm">
                                  <span
                                    className={cn(
                                      "text-xs font-semibold px-2 py-0.5 rounded-md",
                                      op.type === "BUY"
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-red-500/10 text-red-400"
                                    )}
                                  >
                                    {op.type === "BUY" ? "COMPRA" : "VENDA"}
                                  </span>
                                  <span className="flex-1 text-zinc-400">
                                    {op.quantity.toLocaleString("pt-BR")} un ×{" "}
                                    {formatCurrency(op.price)}
                                  </span>
                                  <span className="text-zinc-500 hidden md:block">
                                    {format(op.date, "dd/MM/yyyy")}
                                  </span>
                                  <span className="font-semibold text-zinc-300 tabular-nums">
                                    {formatCurrency(op.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {detail.proventos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                              Proventos recebidos
                            </p>
                            <div className="divide-y divide-zinc-800/60">
                              {detail.proventos.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                                  <span className="text-xs text-zinc-500 w-24">
                                    {PROVENTO_LABELS[p.type] ?? p.type}
                                  </span>
                                  <span className="flex-1 text-zinc-500">
                                    {format(p.paymentDate, "dd/MM/yyyy")}
                                  </span>
                                  <span className="font-semibold text-emerald-400 tabular-nums">
                                    +{formatCurrency(p.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {detail.operations.length === 0 && detail.proventos.length === 0 && (
                          <p className="text-xs text-zinc-500 py-2 text-center">
                            Nenhuma operação ou provento registrado.
                          </p>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <InvestmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        investment={editing ? { ...editing } : null}
      />

      <OperationFormDialog
        open={!!opTarget}
        onOpenChange={(open) => !open && setOpTarget(null)}
        investment={opTarget ? { id: opTarget.id, name: opTarget.name, ticker: opTarget.ticker, quantity: opTarget.quantity } : null}
      />

      <ProventoFormDialog
        open={!!proventoTarget}
        onOpenChange={(open) => !open && setProventoTarget(null)}
        investment={proventoTarget ? { id: proventoTarget.id, name: proventoTarget.name, ticker: proventoTarget.ticker } : null}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir ativo"
        description={`Remover "${deleting?.ticker ?? deleting?.name}" da carteira? Operações e proventos vinculados também serão excluídos.`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Ativo inválido" };
          const res = await deleteInvestment(deleting.id);
          if (res.success) {
            router.refresh();
          }
          return res;
        }}
      />
    </div>
  );
}
