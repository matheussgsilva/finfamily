"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Loader2, Upload } from "lucide-react";
import { confirmOfxImport, previewOfxImport } from "@/actions/import.actions";
import { decodeOfx, parseOfx, type OfxStatement } from "@/lib/ofx";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountType, ImportPreviewRow } from "@/types";

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  color: string;
}

interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
}

interface ReviewRow extends ImportPreviewRow {
  include: boolean;
  remember: boolean;
  rememberPattern: string;
}

/** Radix Select não aceita value vazio; representa "sem categoria". */
const NO_CATEGORY = "__none__";

export function ImportClient({
  accounts,
  categories,
}: {
  accounts: AccountItem[];
  categories: CategoryItem[];
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [statement, setStatement] = useState<OfxStatement | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const kindMismatch =
    statement && account
      ? (statement.kind === "CREDIT_CARD") !== (account.type === "CREDIT_CARD")
      : false;

  const categoriesByType = useMemo(
    () => ({
      INCOME: categories.filter((c) => c.type === "INCOME"),
      EXPENSE: categories.filter((c) => c.type === "EXPENSE"),
    }),
    [categories]
  );

  const handleFile = async (file: File | undefined) => {
    setRows(null);
    setStatement(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const parsed = parseOfx(decodeOfx(await file.arrayBuffer()));
      if (parsed.transactions.length === 0) {
        toast.error("Nenhum lançamento encontrado. O arquivo é um OFX válido?");
        return;
      }
      setStatement(parsed);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const handlePreview = async () => {
    if (!statement || !accountId) return;
    setLoading(true);
    try {
      const res = await previewOfxImport({ bankAccountId: accountId, rows: statement.transactions });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setRows(
        (res.data?.rows ?? []).map((row) => ({
          ...row,
          include: !row.defaultSkip,
          remember: false,
          rememberPattern: row.description,
        }))
      );
    } catch {
      toast.error("Erro ao ler o extrato.");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (fitId: string, patch: Partial<ReviewRow>) =>
    setRows((current) => current?.map((r) => (r.fitId === fitId ? { ...r, ...patch } : r)) ?? null);

  const selected = rows?.filter((r) => r.include) ?? [];
  const totals = selected.reduce(
    (acc, r) => {
      if (r.amount > 0) acc.income += r.amount;
      else acc.expense += -r.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const uncategorized = selected.filter((r) => !r.categoryId).length;

  const handleConfirm = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const res = await confirmOfxImport({
        bankAccountId: accountId,
        rows: selected.map((r) => ({
          fitId: r.fitId,
          date: r.date,
          amount: r.amount,
          description: r.description,
          categoryId: r.categoryId,
          rememberPattern: r.remember && r.categoryId ? r.rememberPattern : null,
        })),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { created = 0, skipped = 0, rulesCreated = 0 } = res.data ?? {};
      const parts = [`${created} lançamento(s) importado(s)`];
      if (skipped > 0) parts.push(`${skipped} já existia(m)`);
      if (rulesCreated > 0) parts.push(`${rulesCreated} regra(s) criada(s)`);
      toast.success(parts.join(" · "));
      router.push("/fluxo-de-caixa");
    } catch {
      toast.error("Erro ao importar o extrato.");
    } finally {
      setLoading(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState
          icon={<Upload size={20} />}
          title="Nenhuma conta cadastrada"
          description="Cadastre uma conta em Configurações > Contas antes de importar um extrato."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Passo 1: conta e arquivo */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[16rem_1fr_auto] sm:items-end">
          <div>
            <Label>Conta</Label>
            <Select
              value={accountId}
              onValueChange={(value) => {
                setAccountId(value);
                setRows(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Arquivo OFX</Label>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-zinc-950/40 px-3 text-sm text-zinc-400 hover:border-zinc-600">
              <FileUp size={16} />
              <span className="truncate">{fileName ?? "Escolher arquivo .ofx"}</span>
              <input
                type="file"
                accept=".ofx,.OFX,application/x-ofx"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <Button onClick={handlePreview} disabled={!statement || !accountId || loading}>
            {loading && !rows ? <Loader2 size={16} className="animate-spin" /> : null}
            Revisar lançamentos
          </Button>
        </div>

        {statement && (
          <p className="mt-3 text-xs text-zinc-500">
            {statement.transactions.length} lançamento(s) no arquivo · extrato de{" "}
            {statement.kind === "CREDIT_CARD" ? "cartão de crédito" : "conta"}
          </p>
        )}
        {kindMismatch && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle size={14} />
            O arquivo parece ser de {statement?.kind === "CREDIT_CARD" ? "cartão" : "conta"}, mas a
            conta escolhida {account?.type === "CREDIT_CARD" ? "é um cartão" : "não é um cartão"}.
          </p>
        )}
      </div>

      {/* Passo 2: revisão */}
      {rows && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-border bg-[#090d16]/50">
            <h3 className="text-sm font-semibold text-zinc-200">Revisão</h3>
            <div className="flex gap-2 text-xs">
              <button
                className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
                onClick={() => setRows(rows.map((r) => ({ ...r, include: r.status === "new" })))}
              >
                Selecionar novos
              </button>
              <span className="text-zinc-700">·</span>
              <button
                className="text-zinc-400 hover:text-zinc-300 cursor-pointer"
                onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          {account?.type === "CREDIT_CARD" && (
            <p className="px-4 pt-3 text-xs text-zinc-500">
              Créditos no cartão vêm desmarcados: pagamentos de fatura devem ser registrados pelo
              botão “Pagar Fatura” (senão contam em dobro). Marque só estornos.
            </p>
          )}

          <div className="divide-y divide-border">
            {rows.map((row) => (
              <ReviewRowItem
                key={row.fitId}
                row={row}
                categories={categoriesByType[row.type]}
                onChange={(patch) => updateRow(row.fitId, patch)}
              />
            ))}
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span>{selected.length} selecionado(s)</span>
              <span>
                Entradas:{" "}
                <PrivacyValue className="text-emerald-400">{formatCurrency(totals.income)}</PrivacyValue>
              </span>
              <span>
                Saídas: <PrivacyValue className="text-red-400">{formatCurrency(totals.expense)}</PrivacyValue>
              </span>
              {uncategorized > 0 && <span className="text-amber-400">{uncategorized} sem categoria</span>}
            </div>
            <Button onClick={handleConfirm} disabled={selected.length === 0 || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Importar {selected.length} lançamento(s)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRowItem({
  row,
  categories,
  onChange,
}: {
  row: ReviewRow;
  categories: CategoryItem[];
  onChange: (patch: Partial<ReviewRow>) => void;
}) {
  // "Lembrar" faz sentido quando há categoria que não veio de uma regra existente.
  const canRemember = !!row.categoryId && row.suggestionSource !== "rule";

  return (
    <div className={cn("p-3 sm:px-4 transition-opacity", !row.include && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="h-4 w-4 accent-indigo-500 cursor-pointer"
          aria-label="Importar este lançamento"
        />
        <span className="w-20 shrink-0 text-xs text-zinc-500">{formatDate(row.date)}</span>

        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate text-sm text-zinc-200" title={row.description}>
            {row.description}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {row.status === "imported" && <Badge variant="secondary">já importado</Badge>}
            {row.status === "possible-duplicate" && <Badge variant="warning">possível duplicata</Badge>}
            {row.suggestionSource === "rule" && <Badge variant="outline">regra</Badge>}
            {row.suggestionSource === "history" && <Badge variant="outline">histórico</Badge>}
          </div>
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={row.categoryId ?? NO_CATEGORY}
            onValueChange={(value) =>
              onChange({
                categoryId: value === NO_CATEGORY ? null : value,
                suggestionSource: null,
                remember: value === NO_CATEGORY ? false : row.remember,
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>
                <span className="text-zinc-500">Sem categoria</span>
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <CategoryIcon name={c.icon} size={14} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PrivacyValue
          className={cn(
            "w-28 shrink-0 text-right text-sm font-semibold",
            row.amount > 0 ? "text-emerald-400" : "text-zinc-200"
          )}
        >
          {row.amount > 0 ? "+" : "-"}
          {formatCurrency(Math.abs(row.amount))}
        </PrivacyValue>
      </div>

      {canRemember && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={row.remember}
              onChange={(e) => onChange({ remember: e.target.checked })}
              className="h-3.5 w-3.5 accent-indigo-500"
            />
            Lembrar: descrição contém
          </label>
          {row.remember && (
            <Input
              value={row.rememberPattern}
              onChange={(e) => onChange({ rememberPattern: e.target.value })}
              className="h-7 w-full text-xs sm:w-64"
              placeholder="Ex.: IFOOD"
            />
          )}
        </div>
      )}
    </div>
  );
}
