"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { queryBudgets } from "@/actions/query.actions";
import { deleteBudget } from "@/actions/budget.actions";
import { formatCurrency } from "@/lib/utils";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryItem {
  id: string;
  name: string;
  icon: string | null;
  color: string;
}

interface BudgetWithProgress {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: "ok" | "warning" | "over";
}

export function BudgetsClient({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithProgress | null>(null);
  const [deleting, setDeleting] = useState<BudgetWithProgress | null>(null);

  const activeMonth = addMonths(new Date(), monthOffset);
  const month = activeMonth.getMonth() + 1;
  const year = activeMonth.getFullYear();

  async function refresh() {
    setLoading(true);
    try {
      setBudgets(await queryBudgets(month, year));
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    queryBudgets(month, year)
      .then((data) => {
        if (!cancelled) setBudgets(data);
      })
      .catch(() => {
        if (!cancelled) router.push("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, year, router]);

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-zinc-400">Total orçado no mês</p>
          <p className="text-sm text-zinc-300">{budgets.length} categorias</p>
        </div>
        <div className="flex items-end justify-between mb-2">
          <div>
            <PrivacyValue className="text-xl font-bold text-white">
              {formatCurrency(totalSpent)}
            </PrivacyValue>
            <p className="text-xs text-zinc-500">gasto de {formatCurrency(totalBudget)}</p>
          </div>
          <PrivacyValue
            className={cn(
              "text-sm font-semibold",
              totalBudget > 0 && totalSpent > totalBudget ? "text-red-400" : "text-emerald-400"
            )}
          >
            {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}%` : "—"}
          </PrivacyValue>
        </div>
        <Progress
          value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
          indicatorClassName={
            totalBudget > 0 && totalSpent > totalBudget ? "bg-red-500" : "bg-indigo-500"
          }
        />
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-2">
        <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
          <ChevronLeft size={18} />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-200 capitalize">
            {format(activeMonth, "MMMM yyyy", { locale: ptBR })}
          </p>
          {monthOffset !== 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              Voltar para hoje
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m + 1)}>
          <ChevronRight size={18} />
        </Button>
      </div>

      {/* Cabeçalho com botão */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={16} />
          Adicionar orçamento
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-zinc-500">
          Carregando orçamentos...
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={<Wallet size={20} />}
            title="Nenhum orçamento"
            description="Defina limites de gastos por categoria para controlar melhor suas despesas."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const over = budget.status === "over";
            const warning = budget.status === "warning";
            return (
              <div
                key={budget.id}
                className="rounded-2xl border border-border bg-card p-4 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ backgroundColor: `${budget.categoryColor}22`, color: budget.categoryColor }}
                  >
                    <CategoryIcon name={budget.categoryIcon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {budget.categoryName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Gasto <PrivacyValue>{formatCurrency(budget.spent)}</PrivacyValue> de{" "}
                      {formatCurrency(budget.amount)}
                    </p>
                  </div>
                  <Badge
                    variant={over ? "destructive" : warning ? "warning" : "success"}
                    className="shrink-0"
                  >
                    {Math.round(budget.percentUsed)}%
                  </Badge>
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition">
                    <button
                      onClick={() => { setEditing(budget); setFormOpen(true); }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(budget)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <Progress
                  value={Math.min(budget.percentUsed, 100)}
                  indicatorClassName={
                    over ? "bg-red-500" : warning ? "bg-amber-500" : "bg-indigo-500"
                  }
                />
                <p className={cn("mt-1.5 text-xs", over ? "text-red-400" : "text-zinc-500")}>
                  {over
                    ? `Acima do limite em ${formatCurrency(Math.abs(budget.remaining))}`
                    : `Restam ${formatCurrency(budget.remaining)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        budget={editing ? { id: editing.id, categoryId: editing.categoryId, amount: editing.amount } : null}
        month={month}
        year={year}
        usedCategoryIds={budgets.map((b) => b.categoryId)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir orçamento"
        description={`Remover o orçamento de "${deleting?.categoryName}"?`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Orçamento inválido" };
          const res = await deleteBudget(deleting.id);
          if (res.success) {
            router.refresh();
            refresh();
          }
          return res;
        }}
      />
    </div>
  );
}
