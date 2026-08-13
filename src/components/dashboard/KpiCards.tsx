"use client";

import React from "react";
import { Wallet, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis: {
    totalBalance: number;
    monthIncome: number;
    monthExpense: number;
    savingsRate: number;
    totalInvested: number;
    netWorth: number;
  };
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const cards = [
    {
      label: "Saldo Disponível",
      value: kpis.totalBalance,
      icon: Wallet,
      color: "#22c55e",
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Patrimônio Líquido",
      value: kpis.netWorth,
      icon: Landmark,
      color: "#6366f1",
      accent: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Entradas do Mês",
      value: kpis.monthIncome,
      icon: ArrowDownLeft,
      color: "#10b981",
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Saídas do Mês",
      value: kpis.monthExpense,
      icon: ArrowUpRight,
      color: "#ef4444",
      accent: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Taxa de Poupança",
      value: kpis.savingsRate,
      icon: PiggyBank,
      color: "#f59e0b",
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
      percent: true,
    },
    {
      label: "Investido",
      value: kpis.totalInvested,
      icon: TrendingUp,
      color: "#3b82f6",
      accent: "text-blue-400",
      bg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-card p-4 hover:border-zinc-700 transition"
          >
            <div
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-xl mb-3",
                card.bg
              )}
              style={{ color: card.color }}
            >
              <Icon size={17} />
            </div>
            <p className="text-xs text-zinc-500 truncate">{card.label}</p>
            <PrivacyValue className={cn("mt-1 text-lg font-bold tracking-tight block", card.accent)}>
              {card.percent
                ? `${card.value.toFixed(1)}%`
                : formatCurrency(card.value)}
            </PrivacyValue>
          </div>
        );
      })}
    </div>
  );
}
