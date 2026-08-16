"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, MinusCircle, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  fetchInvestmentPrices,
  updateInvestmentPrices,
  type PriceFetchResult,
} from "@/actions/investment.actions";
import { ASSET_CLASS_LABELS, type AssetClass } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "fetching" | "ok" | "error" | "no-ticker";

export interface PriceAssetItem {
  id: string;
  ticker: string | null;
  name: string;
  assetClass: AssetClass;
  currentPrice: number | null;
  priceUpdatedAt: Date | null;
}

interface PriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: PriceAssetItem[];
}

function initialPrices(assets: PriceAssetItem[]): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const asset of assets) {
    initial[asset.id] = asset.currentPrice !== null ? String(asset.currentPrice) : "";
  }
  return initial;
}

function initialStatuses(assets: PriceAssetItem[]): Record<string, Status> {
  const initial: Record<string, Status> = {};
  for (const asset of assets) {
    initial[asset.id] = "idle";
  }
  return initial;
}

function PriceUpdateDialogInner({
  onOpenChange,
  assets,
}: Omit<PriceUpdateDialogProps, "open">) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(() => initialPrices(assets));
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => initialStatuses(assets));
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFetch = async () => {
    const withTicker = assets.map((a) => ({
      id: a.id,
      ticker: a.ticker,
      assetClass: a.assetClass,
    }));
    setFetching(true);
    setStatuses((prev) => {
      const next: Record<string, Status> = { ...prev };
      for (const asset of assets) {
        if (asset.ticker) next[asset.id] = "fetching";
      }
      return next;
    });
    try {
      const res = await fetchInvestmentPrices(withTicker);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const nextStatus: Record<string, Status> = { ...statuses };
      const nextPrices: Record<string, string> = { ...prices };
      let ok = 0;
      for (const result of res.data as PriceFetchResult[]) {
        if (result.status === "ok") {
          nextPrices[result.id] = String(result.price);
          nextStatus[result.id] = "ok";
          ok++;
        } else if (result.status === "error") {
          nextStatus[result.id] = "error";
        } else {
          nextStatus[result.id] = "no-ticker";
        }
      }
      setPrices(nextPrices);
      setStatuses(nextStatus);
      toast.success(
        ok > 0
          ? `${ok} ${ok === 1 ? "preço atualizado" : "preços atualizados"}.`
          : "Nenhum preço encontrado."
      );
    } catch {
      toast.error("Erro ao buscar os preços.");
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    const entries: { id: string; price: number }[] = [];
    for (const asset of assets) {
      const raw = prices[asset.id];
      const price = Number(raw);
      if (!raw || !Number.isFinite(price) || price <= 0) {
        toast.error(`Preço inválido para ${asset.ticker ?? asset.name}.`);
        return;
      }
      entries.push({ id: asset.id, price });
    }
    setSaving(true);
    try {
      const res = await updateInvestmentPrices(entries);
      if (res.success) {
        toast.success("Preços atualizados.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar os preços.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atualizar preços</DialogTitle>
          <DialogDescription>
            Busque os preços automaticamente pelo ticker ou ajuste manualmente. O histórico de
            preços é registrado a cada atualização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {assets.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Nenhum ativo cadastrado.</p>
          ) : (
            assets.map((asset) => {
              const status = statuses[asset.id] ?? "idle";
              return (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-zinc-950/40 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {asset.ticker ?? asset.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {ASSET_CLASS_LABELS[asset.assetClass]}
                      {asset.priceUpdatedAt && (
                        <>
                          {" · "}Atualizado em{" "}
                          {format(asset.priceUpdatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={prices[asset.id] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [asset.id]: e.target.value }))
                      }
                      className="h-9 text-right tabular-nums"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="w-6 shrink-0 flex justify-center">
                    {status === "fetching" && (
                      <Loader2 size={16} className="animate-spin text-zinc-500" />
                    )}
                    {status === "ok" && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {status === "error" && (
                      <span title="Ticker não encontrado na internet">
                        <AlertCircle size={16} className="text-red-400" />
                      </span>
                    )}
                    {status === "no-ticker" && (
                      <span title="Sem ticker — atualize manualmente">
                        <MinusCircle size={16} className="text-zinc-600" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleFetch}
            disabled={fetching || saving || assets.every((a) => !a.ticker)}
          >
            {fetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Buscar na internet
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || fetching || assets.length === 0}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar preços
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PriceUpdateDialog(props: PriceUpdateDialogProps) {
  if (!props.open) return null;
  return <PriceUpdateDialogInner {...props} />;
}
