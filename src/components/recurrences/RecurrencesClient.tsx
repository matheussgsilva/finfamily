"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Square } from "lucide-react";
import { stopRecurrence } from "@/actions/recurrence.actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecurringSeriesItem } from "@/types";

export function RecurrencesClient({ series }: { series: RecurringSeriesItem[] }) {
  const router = useRouter();
  const [stopping, setStopping] = useState<RecurringSeriesItem | null>(null);

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState
          icon={<Repeat size={20} />}
          title="Nenhuma recorrência"
          description='Marque "Transação recorrente" ao criar uma despesa ou receita para vê-la aqui.'
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {series.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3"
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style={{
              backgroundColor: `${item.categoryColor ?? "#6366f1"}22`,
              color: item.categoryColor ?? "#6366f1",
            }}
          >
            <CategoryIcon name={item.categoryIcon} size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-200 truncate">{item.description}</p>
              <Badge variant={item.active ? "success" : "outline"}>
                {item.active ? "Ativa" : "Encerrada"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              {item.categoryName ?? "Sem categoria"} · {item.bankAccountName} ·{" "}
              {item.occurrenceCount}{" "}
              {item.occurrenceCount === 1 ? "lançamento" : "lançamentos"}
            </p>
            {item.active && item.nextDate && (
              <p className="text-xs text-indigo-400 mt-0.5">
                Próxima em {formatDate(item.nextDate, "long")}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <PrivacyValue
              className={
                item.type === "EXPENSE" ? "text-sm font-semibold text-red-400" : "text-sm font-semibold text-emerald-400"
              }
            >
              {item.type === "EXPENSE" ? "-" : "+"}
              {formatCurrency(item.amount)}
            </PrivacyValue>
          </div>

          {item.active && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setStopping(item)}
            >
              <Square size={14} />
              Encerrar
            </Button>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!stopping}
        onOpenChange={(open) => !open && setStopping(null)}
        title="Encerrar recorrência"
        description={`"${stopping?.description}" não vai mais gerar novos lançamentos. O histórico já lançado continua no Fluxo de Caixa.`}
        actionLabel="Encerrar"
        icon={<Square size={18} />}
        variant="default"
        onConfirm={async () => {
          if (!stopping) return { success: false, error: "Recorrência inválida" };
          const res = await stopRecurrence(stopping.id);
          if (res.success) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
