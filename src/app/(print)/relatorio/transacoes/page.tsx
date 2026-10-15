import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOptionalUserId } from "@/lib/session";
import { getTransactionsForExport } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";
import {
  exportDay,
  parseExportParams,
  signedAmount,
  summarizeTransactions,
  toTransactionFilters,
  type CategoryTotal,
} from "@/lib/transactionExport";
import { TRANSACTION_TYPE_LABELS } from "@/types";
import { PrintButton } from "@/components/report/PrintButton";

export const metadata: Metadata = { title: "Relatório de transações" };

const dayToBR = (day: string) => day.split("-").reverse().join("/");

export default async function RelatorioTransacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await getOptionalUserId();
  if (!userId) redirect("/login");

  const parsed = parseExportParams(await searchParams);
  if (!parsed.success) {
    return (
      <p className="text-sm text-red-600">
        Não foi possível gerar o relatório: {parsed.error.issues[0]?.message ?? "parâmetros inválidos"}.
      </p>
    );
  }
  const filters = parsed.data;

  const [transactions, category, account, member] = await Promise.all([
    getTransactionsForExport(userId, toTransactionFilters(filters)),
    filters.categoryId
      ? db.category.findFirst({
          where: { id: filters.categoryId, OR: [{ userId }, { userId: null }] },
          select: { name: true },
        })
      : null,
    filters.bankAccountId
      ? db.bankAccount.findFirst({ where: { id: filters.bankAccountId, userId }, select: { name: true } })
      : null,
    filters.familyMemberId
      ? db.familyMember.findFirst({ where: { id: filters.familyMemberId, userId }, select: { name: true } })
      : null,
  ]);
  const summary = summarizeTransactions(transactions);

  const appliedFilters = [
    filters.type && `Tipo: ${TRANSACTION_TYPE_LABELS[filters.type]}`,
    category && `Categoria: ${category.name}`,
    account && `Conta: ${account.name}`,
    member && `Membro: ${member.name}`,
    filters.search && `Busca: "${filters.search}"`,
  ].filter(Boolean);

  return (
    <article className="space-y-6 text-sm">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">FinFamily</p>
          <h1 className="mt-1 text-2xl font-bold">Relatório de transações</h1>
          <p className="mt-1 text-zinc-600">
            {dayToBR(filters.start)} a {dayToBR(filters.end)} · {summary.count} lançamento(s)
          </p>
          {appliedFilters.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">Filtros: {appliedFilters.join(" · ")}</p>
          )}
        </div>
        <PrintButton />
      </header>

      <section className="avoid-break grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Receitas" value={summary.income} tone="positive" />
        <SummaryCard label="Despesas" value={summary.expense} tone="negative" />
        <SummaryCard label="Saldo do período" value={summary.balance} tone={summary.balance >= 0 ? "positive" : "negative"} />
        <SummaryCard label="Transferências" value={summary.transfers} />
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CategoryTable title="Despesas por categoria" rows={summary.expenseByCategory} />
        <CategoryTable title="Receitas por categoria" rows={summary.incomeByCategory} />
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Lançamentos</h2>
        {transactions.length === 0 ? (
          <p className="text-zinc-500">Nenhum lançamento no período.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-zinc-500">
                <th className="py-1.5 pr-2 font-medium">Data</th>
                <th className="py-1.5 pr-2 font-medium">Descrição</th>
                <th className="py-1.5 pr-2 font-medium">Categoria</th>
                <th className="py-1.5 pr-2 font-medium">Conta</th>
                <th className="py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{exportDay(t.date)}</td>
                  <td className="py-1.5 pr-2">
                    {t.description}
                    {t.installments && t.installmentNum ? (
                      <span className="text-zinc-400"> ({t.installmentNum}/{t.installments})</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 text-zinc-600">
                    {t.type === "TRANSFER" ? "Transferência" : (t.category?.name ?? "Sem categoria")}
                  </td>
                  <td className="py-1.5 pr-2 text-zinc-600">
                    {t.bankAccount.name}
                    {t.destinationAccount ? ` → ${t.destinationAccount.name}` : ""}
                  </td>
                  <td
                    className={`whitespace-nowrap py-1.5 text-right font-medium tabular-nums ${
                      t.type === "INCOME" ? "text-emerald-700" : t.type === "EXPENSE" ? "text-zinc-900" : "text-zinc-500"
                    }`}
                  >
                    {formatCurrency(signedAmount(t))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-t border-zinc-200 pt-2 text-[10px] text-zinc-400">
        Gerado em {new Date().toLocaleString("pt-BR")}
      </footer>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-base font-bold tabular-nums ${
          tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-zinc-900"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function CategoryTable({ title, rows }: { title: string; rows: CategoryTotal[] }) {
  return (
    <section className="avoid-break">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">Nada no período.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? "none"} className="border-b border-zinc-100">
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </span>
                  <span className="mt-1 block h-1 rounded-full bg-zinc-100">
                    <span
                      className="block h-1 rounded-full bg-zinc-400"
                      style={{ width: `${Math.min(row.percent, 100)}%` }}
                    />
                  </span>
                </td>
                <td className="w-12 py-1.5 pr-2 text-right tabular-nums text-zinc-500">
                  {row.percent.toFixed(1)}%
                </td>
                <td className="w-28 py-1.5 text-right font-medium tabular-nums">{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
