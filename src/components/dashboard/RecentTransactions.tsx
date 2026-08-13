import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import type { TransactionWithRelations } from "@/types";

export function RecentTransactions({ transactions }: { transactions: TransactionWithRelations[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-300">Transações Recentes</h3>
        <Link
          href="/fluxo-de-caixa"
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition"
        >
          Ver todas
          <ChevronRight size={13} />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">Nenhuma transação ainda.</p>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {transactions.slice(0, 8).map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                style={{
                  backgroundColor: tx.category ? `${tx.category.color}22` : "#27272a",
                  color: tx.category?.color ?? "#a1a1aa",
                }}
              >
                <CategoryIcon name={tx.category?.icon ?? null} size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{tx.description}</p>
                <p className="text-xs text-zinc-500">
                  {tx.category?.name ?? "Sem categoria"} · {formatDate(tx.date)}
                </p>
              </div>
              <PrivacyValue
                className={
                  tx.type === "INCOME"
                    ? "text-sm font-semibold text-emerald-400 tabular-nums"
                    : "text-sm font-semibold text-red-400 tabular-nums"
                }
              >
                {tx.type === "INCOME" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </PrivacyValue>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
