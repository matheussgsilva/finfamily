"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { queryNetWorth } from "@/actions/query.actions";
import { formatCurrency } from "@/lib/utils";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { cn } from "@/lib/utils";

type NetWorthRange = "1M" | "6M" | "1Y" | "ALL";

interface NetWorthPoint {
  date: string;
  netWorth: number;
}

interface CashFlowPoint {
  label: string;
  income: number;
  expense: number;
}

interface CategorySlice {
  name: string;
  color: string;
  value: number;
}

const RANGES: { key: NetWorthRange; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1A" },
  { key: "ALL", label: "Tudo" },
];

interface TooltipEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currency?: boolean;
}

function ChartTooltip({ active, payload, label, currency = true }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-500 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} style={{ color: entry.color ?? entry.fill }}>
          <span className="text-zinc-400 capitalize">{entry.name}: </span>
          {currency ? formatCurrency(entry.value ?? 0) : entry.value}
        </p>
      ))}
    </div>
  );
}

export function NetWorthChart() {
  const [range, setRange] = useState<NetWorthRange>("6M");
  const [data, setData] = useState<NetWorthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    queryNetWorth(range)
      .then((series) => {
        if (!cancelled) setData(series);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const last = data[data.length - 1];
  const first = data[0];
  const diff = last && first ? last.netWorth - first.netWorth : 0;
  const pctChange = first && first.netWorth !== 0 ? (diff / Math.abs(first.netWorth)) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <TrendingUp size={15} className="text-indigo-400" />
            Evolução do Patrimônio
          </p>
          <PrivacyValue className="mt-2 text-2xl font-bold text-white block">
            {formatCurrency(last?.netWorth ?? 0)}
          </PrivacyValue>
          {first && last && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                diff >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {diff >= 0 ? "+" : ""}
              {formatCurrency(diff)} ({pctChange.toFixed(1)}%) no período
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer",
                range === r.key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            Carregando...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) => formatCurrency(v).replace(",00", "")}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Patrimônio"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#netWorthGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ArrowDownLeft size={15} className="text-emerald-400" />
        <h3 className="text-sm font-medium text-zinc-300">Fluxo de Caixa</h3>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={46}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#18181b" }} />
            <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[5, 5, 0, 0]} />
            <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExpenseDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ArrowUpRight size={15} className="text-red-400" />
        <h3 className="text-sm font-medium text-zinc-300">Gastos por Categoria</h3>
      </div>
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-zinc-500">
          Sem gastos neste mês
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-white">
                <PrivacyValue>{formatCurrency(total)}</PrivacyValue>
              </span>
              <span className="text-[11px] text-zinc-500">total do mês</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {data.slice(0, 5).map((slice) => {
              const pct = total > 0 ? (slice.value / total) * 100 : 0;
              return (
                <div key={slice.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-xs text-zinc-400 truncate flex-1">{slice.name}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            {data.length > 5 && (
              <p className="text-[11px] text-zinc-600 pt-1">
                +{data.length - 5} outras categorias
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
