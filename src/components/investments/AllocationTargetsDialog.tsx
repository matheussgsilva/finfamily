"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveAllocationTargets } from "@/actions/investment.actions";
import { cn } from "@/lib/utils";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS, type AssetClass } from "@/types";
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

const CLASSES = Object.keys(ASSET_CLASS_LABELS) as AssetClass[];

interface AllocationTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: { assetClass: AssetClass; percent: number }[];
}

/** Montado só com o diálogo aberto, para começar sempre das metas salvas. */
export function AllocationTargetsDialog(props: AllocationTargetsDialogProps) {
  if (!props.open) return null;
  return <AllocationTargetsDialogInner {...props} />;
}

function AllocationTargetsDialogInner({ open, onOpenChange, targets }: AllocationTargetsDialogProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(targets.map((t) => [t.assetClass, String(t.percent)]))
  );
  const [saving, setSaving] = useState(false);

  const percents = CLASSES.map((c) => ({ assetClass: c, percent: Number(values[c] || 0) }));
  const total = Math.round(percents.reduce((s, t) => s + (Number.isFinite(t.percent) ? t.percent : 0), 0) * 100) / 100;
  const invalid = percents.some((t) => !Number.isFinite(t.percent) || t.percent < 0 || t.percent > 100);
  const canSave = !invalid && (total === 100 || total === 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveAllocationTargets(total === 0 ? [] : percents.filter((t) => t.percent > 0));
      if (res.success) {
        toast.success(total === 0 ? "Metas removidas." : "Metas salvas.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar as metas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Metas de alocação</DialogTitle>
          <DialogDescription>
            Quanto da carteira cada classe deve ter. Para dividir o aporte entre ativos da mesma
            classe, defina o &quot;Peso na classe&quot; em cada ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {CLASSES.map((assetClass) => (
            <div key={assetClass} className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ASSET_CLASS_COLORS[assetClass] }}
              />
              <span className="flex-1 text-sm text-zinc-300">{ASSET_CLASS_LABELS[assetClass]}</span>
              <div className="relative w-28">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={values[assetClass] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [assetClass]: e.target.value }))}
                  className="h-9 pr-7 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  %
                </span>
              </div>
            </div>
          ))}
        </div>

        <p
          className={cn(
            "text-right text-xs tabular-nums",
            total === 100 ? "text-emerald-400" : total === 0 ? "text-zinc-500" : "text-amber-400"
          )}
        >
          Total: {total.toLocaleString("pt-BR")}%
          {total > 0 && total < 100 && ` (faltam ${(100 - total).toLocaleString("pt-BR")}%)`}
          {total > 100 && ` (sobram ${(total - 100).toLocaleString("pt-BR")}%)`}
          {total === 0 && " (salvar sem valores remove as metas)"}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Salvar metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
