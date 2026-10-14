"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Calculator, Loader2, X } from "lucide-react";
import { queryCashFlowProjection } from "@/actions/query.actions";
import type { CashFlowProjectionInput } from "@/lib/queries";
import {
  buildProjection,
  simulatePurchase,
  type ProjectionEvent,
} from "@/lib/projectionMath";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { usePrivacy } from "@/components/shared/PrivacyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInputBR } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Horizon = 3 | 6 | 12;

// Slots 1 e 2 da paleta categórica (modo escuro), validados contra a superfície do card.
const COLOR_BASE = "#3987e5";
const COLOR_SIMULATED = "#d95926";

const HORIZONS: Horizon[] = [3, 6, 12];

const KIND_LABEL: Record<ProjectionEvent["kind"], string> = {
  transaction: "agendado",
  recurrence: "recorrência",
  invoice: "fatura",
  simulation: "simulação",
};

const dayToBR = (day: string) => day.split("-").reverse().join("/");
const dayToShort = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const monthLabel = (month: string) => formatDate(`${month}-01`, "month");

export function ProjectionClient({
  initialInput,
  initialMonths,
}: {
  initialInput: CashFlowProjectionInput;
  initialMonths: Horizon;
}) {
  const { isPrivate } = usePrivacy();
  const [months, setMonths] = useState<Horizon>(initialMonths);
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [useVariable, setUseVariable] = useState(initialInput.variable !== null);

  const [simAmount, setSimAmount] = useState<number | undefined>(undefined);
  const [simDay, setSimDay] = useState(initialInput.startDay);
  const [simInstallments, setSimInstallments] = useState(1);

  const changeHorizon = async (next: Horizon) => {
    if (next === months) return;
    setMonths(next);
    setLoading(true);
    try {
      setInput(await queryCashFlowProjection(next));
    } catch {
      toast.error("Erro ao recalcular a projeção.");
    } finally {
      setLoading(false);
    }
  };

  const variable = useVariable ? input.variable : null;

  const projection = useMemo(
    () =>
      buildProjection({
        startDay: input.startDay,
        endDay: input.endDay,
        startBalance: input.startBalance,
        events: input.events,
        variable,
      }),
    [input, variable]
  );

  const simEvents = useMemo(() => {
    const valid =
      !!simAmount && simAmount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(simDay) && simInstallments >= 1;
    return valid
      ? simulatePurchase({ amount: simAmount, day: simDay, installments: Math.min(simInstallments, 24) })
      : [];
  }, [simAmount, simDay, simInstallments]);

  const simulated = useMemo(
    () =>
      simEvents.length > 0
        ? buildProjection({
            startDay: input.startDay,
            endDay: input.endDay,
            startBalance: input.startBalance,
            events: [...input.events, ...simEvents],
            variable,
          })
        : null,
    [input, simEvents, variable]
  );

  const chartData = projection.points.map((p, i) => ({
    day: p.day,
    label: dayToShort(p.day),
    balance: p.balance,
    ...(simulated ? { simulated: simulated.points[i]?.balance } : {}),
  }));

  const visibleEvents = [...input.events, ...simEvents]
    .filter((e) => e.day <= input.endDay)
    .sort((a, b) => a.day.localeCompare(b.day));
  const eventsByMonth = new Map<string, ProjectionEvent[]>();
  for (const event of visibleEvents) {
    const key = (event.day < input.startDay ? input.startDay : event.day).slice(0, 7);
    eventsByMonth.set(key, [...(eventsByMonth.get(key) ?? []), event]);
  }

  const lowest = simulated?.lowest ?? projection.lowest;
  const overdue = input.events.filter((e) => e.overdue);

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 self-start rounded-lg bg-zinc-800/60 p-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => changeHorizon(h)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition",
                months === h ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {h} meses
            </button>
          ))}
          {loading && <Loader2 size={14} className="ml-1 animate-spin text-zinc-500" />}
        </div>

        {input.variable ? (
          <label className="flex cursor-pointer items-center gap-3 text-xs text-zinc-400">
            <Switch checked={useVariable} onCheckedChange={setUseVariable} />
            <span>
              Estimar gastos do dia a dia{" "}
              <span className="text-zinc-500">
                (média de {input.variable.basedOnMonths} {input.variable.basedOnMonths === 1 ? "mês" : "meses"}:{" "}
                <PrivacyValue>+{formatCurrency(input.variable.monthlyIncome)}</PrivacyValue> /{" "}
                <PrivacyValue>−{formatCurrency(input.variable.monthlyExpense)}</PrivacyValue> por mês)
              </span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-zinc-500">
            Sem histórico suficiente para estimar os gastos do dia a dia.
          </p>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            {overdue.length === 1 ? "Há uma fatura vencida" : `Há ${overdue.length} faturas vencidas`} sem
            pagamento registrado, descontada(s) já no saldo de hoje. Se já pagou, registre em
            Faturas → Pagar Fatura.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Saldo hoje" value={input.startBalance} hint="Contas, sem cartões" />
        <Kpi
          label={`Saldo em ${dayToBR(input.endDay)}`}
          value={simulated?.endBalance ?? projection.endBalance}
          hint={simulated ? `sem a compra: ${formatCurrency(projection.endBalance)}` : undefined}
          hidePrivateHint
        />
        <Kpi
          label="Menor saldo previsto"
          value={lowest.balance}
          hint={`em ${dayToBR(lowest.day)}`}
          danger={lowest.balance < 0}
        />
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-300">Saldo disponível projetado</h3>
          {simulated && (
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <LegendKey color={COLOR_BASE} label="Sem a compra" />
              <LegendKey color={COLOR_SIMULATED} label="Com a compra" />
            </div>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <CartesianGrid stroke="#1f2637" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={isPrivate ? 8 : 60}
                tickFormatter={(v: number) => (isPrivate ? "" : formatCurrency(v).replace(",00", ""))}
              />
              <ReferenceLine y={0} stroke="#52525b" />
              <Tooltip
                content={<ProjectionTooltip hideValues={isPrivate} />}
                cursor={{ stroke: "#52525b", strokeWidth: 1 }}
              />
              <Area
                type="stepAfter"
                dataKey="balance"
                name="Sem a compra"
                stroke={COLOR_BASE}
                strokeWidth={2}
                fill={COLOR_BASE}
                fillOpacity={simulated ? 0 : 0.1}
                activeDot={{ r: 4, stroke: "#0b101c", strokeWidth: 2 }}
              />
              {simulated && (
                <Area
                  type="stepAfter"
                  dataKey="simulated"
                  name="Com a compra"
                  stroke={COLOR_SIMULATED}
                  strokeWidth={2}
                  fill={COLOR_SIMULATED}
                  fillOpacity={0.1}
                  activeDot={{ r: 4, stroke: "#0b101c", strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Simulador */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator size={15} className="text-indigo-400" />
          <h3 className="text-sm font-medium text-zinc-300">Posso fazer essa compra?</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
          <div>
            <Label>Valor total</Label>
            <CurrencyInput placeholder="0,00" value={simAmount} onChange={setSimAmount} />
          </div>
          <div>
            <Label>Data da 1ª saída do caixa</Label>
            <DateInputBR value={simDay} onChange={setSimDay} />
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={simInstallments}
              onChange={(e) => setSimInstallments(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            />
          </div>
          <Button
            variant="outline"
            disabled={simAmount === undefined}
            onClick={() => {
              setSimAmount(undefined);
              setSimInstallments(1);
            }}
          >
            <X size={16} />
            Limpar
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          No cartão, use a data de vencimento da fatura em que a compra cai. Nada é salvo.
        </p>
        {simulated && (
          <p
            className={cn(
              "mt-3 text-sm",
              simulated.lowest.balance < 0 ? "text-red-400" : "text-emerald-400"
            )}
          >
            {simulated.lowest.balance < 0 ? "O saldo fica negativo: " : "Cabe no orçamento: "}
            <span className="text-zinc-300">
              menor saldo previsto passa de{" "}
              <PrivacyValue>{formatCurrency(projection.lowest.balance)}</PrivacyValue> para{" "}
              <PrivacyValue>{formatCurrency(simulated.lowest.balance)}</PrivacyValue> (em{" "}
              {dayToBR(simulated.lowest.day)}).
            </span>
          </p>
        )}
      </div>

      {/* Resumo mensal */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-[#090d16]/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Resumo por mês</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="px-4 py-2 font-medium">Mês</th>
                <th className="px-4 py-2 text-right font-medium">Entradas</th>
                <th className="px-4 py-2 text-right font-medium">Saídas</th>
                <th className="px-4 py-2 text-right font-medium">Faturas</th>
                {variable && <th className="px-4 py-2 text-right font-medium">Dia a dia</th>}
                <th className="px-4 py-2 text-right font-medium">Saldo no fim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(simulated ?? projection).months.map((m) => (
                <tr key={m.month} className="text-zinc-300">
                  <td className="px-4 py-2 capitalize">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2 text-right">
                    <PrivacyValue>{formatCurrency(m.income)}</PrivacyValue>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <PrivacyValue>{formatCurrency(m.expense)}</PrivacyValue>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <PrivacyValue>{formatCurrency(m.invoices)}</PrivacyValue>
                  </td>
                  {variable && (
                    <td className="px-4 py-2 text-right">
                      <PrivacyValue>{formatCurrency(m.variable)}</PrivacyValue>
                    </td>
                  )}
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-semibold",
                      m.endBalance < 0 ? "text-red-400" : "text-zinc-100"
                    )}
                  >
                    <PrivacyValue>{formatCurrency(m.endBalance)}</PrivacyValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Próximos lançamentos */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-[#090d16]/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Lançamentos previstos</h3>
        </div>
        {visibleEvents.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            Nenhum lançamento previsto no período.
          </p>
        ) : (
          [...eventsByMonth.entries()].map(([month, list]) => (
            <div key={month}>
              <p className="bg-zinc-950/40 px-4 py-1.5 text-xs font-semibold capitalize text-zinc-500">
                {monthLabel(month)}
              </p>
              <div className="divide-y divide-border/60">
                {list.map((event, i) => (
                  <div key={`${event.day}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-12 shrink-0 text-xs text-zinc-500">{dayToShort(event.day)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{event.description}</p>
                    </div>
                    {event.overdue ? (
                      <Badge variant="warning">vencida</Badge>
                    ) : (
                      <Badge variant="outline">{KIND_LABEL[event.kind]}</Badge>
                    )}
                    <PrivacyValue
                      className={cn(
                        "w-28 shrink-0 text-right text-sm font-semibold",
                        event.amount > 0 ? "text-emerald-400" : "text-zinc-200"
                      )}
                    >
                      {event.amount > 0 ? "+" : "-"}
                      {formatCurrency(Math.abs(event.amount))}
                    </PrivacyValue>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  danger = false,
  hidePrivateHint = false,
}: {
  label: string;
  value: number;
  hint?: string;
  danger?: boolean;
  hidePrivateHint?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <PrivacyValue className={cn("mt-1 block text-xl font-bold", danger ? "text-red-400" : "text-white")}>
        {formatCurrency(value)}
      </PrivacyValue>
      {hint &&
        (hidePrivateHint ? (
          <PrivacyValue className="mt-0.5 block text-xs text-zinc-500">{hint}</PrivacyValue>
        ) : (
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        ))}
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

interface TooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: { day: string };
}

function ProjectionTooltip({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  hideValues: boolean;
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0]?.payload?.day;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {day && <p className="mb-1 text-zinc-500">{format(new Date(`${day}T12:00:00`), "dd/MM/yyyy")}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5 text-zinc-200">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-400">{entry.name}:</span>
          {hideValues ? "••••" : formatCurrency(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}
