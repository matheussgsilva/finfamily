"use client";

import React, { useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { exportFiltersSchema, type ExportFilters } from "@/lib/validations";
import { exportQueryString } from "@/lib/transactionExport";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInputBR } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";

type PeriodMode = "month" | "year" | "range";

export interface ScreenFilters {
  type?: TransactionType;
  categoryId?: string;
  bankAccountId?: string;
  familyMemberId?: string;
  search?: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeMonth: Date;
  filters: ScreenFilters;
  /** Descrição legível dos filtros ativos (ex.: "Conta: Nubank"). */
  filterLabels: string[];
}

const day = (date: Date) => format(date, "yyyy-MM-dd");

/** Montado só com o diálogo aberto, para começar sempre do mês exibido. */
export function ExportDialog(props: ExportDialogProps) {
  if (!props.open) return null;
  return <ExportDialogInner {...props} />;
}

function ExportDialogInner({ open, onOpenChange, activeMonth, filters, filterLabels }: ExportDialogProps) {
  const monthStart = day(startOfMonth(activeMonth));
  const monthEnd = day(endOfMonth(activeMonth));
  const year = activeMonth.getFullYear();

  const [mode, setMode] = useState<PeriodMode>("month");
  const [rangeStart, setRangeStart] = useState(monthStart);
  const [rangeEnd, setRangeEnd] = useState(monthEnd);
  const [applyFilters, setApplyFilters] = useState(true);

  const period =
    mode === "month"
      ? { start: monthStart, end: monthEnd }
      : mode === "year"
        ? { start: `${year}-01-01`, end: `${year}-12-31` }
        : { start: rangeStart, end: rangeEnd };

  const candidate: ExportFilters = { ...period, ...(applyFilters ? filters : {}) };
  const parsed = exportFiltersSchema.safeParse(candidate);
  const query = parsed.success ? exportQueryString(parsed.data) : null;

  const options: { value: PeriodMode; label: string }[] = [
    { value: "month", label: `Mês exibido (${format(activeMonth, "MMMM 'de' yyyy", { locale: ptBR })})` },
    { value: "year", label: `Ano de ${year}` },
    { value: "range", label: "Intervalo de datas" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar transações</DialogTitle>
          <DialogDescription>
            CSV para planilhas (Excel, Google Sheets) ou relatório para imprimir / salvar em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Período</Label>
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  mode === option.value ? "border-indigo-500/60 bg-indigo-500/10 text-zinc-100" : "border-border text-zinc-400"
                )}
              >
                <input
                  type="radio"
                  name="export-period"
                  className="accent-indigo-500"
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                />
                <span className="first-letter:uppercase">{option.label}</span>
              </label>
            ))}
            {mode === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>De</Label>
                  <DateInputBR value={rangeStart} onChange={setRangeStart} />
                </div>
                <div>
                  <Label>Até</Label>
                  <DateInputBR value={rangeEnd} onChange={setRangeEnd} />
                </div>
              </div>
            )}
          </div>

          {filterLabels.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="mt-0.5 accent-indigo-500"
                checked={applyFilters}
                onChange={(e) => setApplyFilters(e.target.checked)}
              />
              <span>
                Aplicar os filtros da tela
                <span className="block text-xs text-zinc-500">{filterLabels.join(" · ")}</span>
              </span>
            </label>
          )}

          {!parsed.success && (
            <p className="text-xs text-red-400">{parsed.error.issues[0]?.message ?? "Período inválido"}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {query ? (
            <>
              <Button variant="outline" asChild>
                <a href={`/relatorio/transacoes?${query}`} target="_blank" rel="noopener">
                  <FileText size={16} />
                  Relatório (PDF)
                </a>
              </Button>
              <Button asChild>
                <a href={`/api/export/transacoes?${query}`} download onClick={() => onOpenChange(false)}>
                  <Download size={16} />
                  Baixar CSV
                </a>
              </Button>
            </>
          ) : (
            <Button disabled>
              <Download size={16} />
              Baixar CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
