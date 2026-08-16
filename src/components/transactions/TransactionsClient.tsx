"use client";

import { queryTransactions } from "@/actions/query.actions";
import { deleteTransaction } from "@/actions/transaction.actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  type AccountType,
  type TransactionType,
  type TransactionWithRelations,
} from "@/types";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
  Receipt,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NewTransactionButton } from "./NewTransactionButton";
import { TransactionFormDialog } from "./TransactionFormDialog";

interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  color: string;
}

interface MemberItem {
  id: string;
  name: string;
  color: string;
}

interface TransactionsClientProps {
  accounts: AccountItem[];
  categories: CategoryItem[];
  members: MemberItem[];
}

export function TransactionsClient({ accounts, categories, members }: TransactionsClientProps) {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [type, setType] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [familyMemberId, setFamilyMemberId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithRelations | null>(null);
  const requestId = useRef(0);

  const activeMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTransactions = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const start = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
      const end = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0);
      const data = await queryTransactions({
        startDate: start,
        endDate: end,
        type: (type || undefined) as TransactionType | undefined,
        categoryId: categoryId || undefined,
        bankAccountId: bankAccountId || undefined,
        familyMemberId: familyMemberId || undefined,
        search: debouncedSearch || undefined,
      });
      if (id === requestId.current) {
        setTransactions(data);
      }
    } catch {
      // Sessão expirada, navega para o login
      router.push("/login");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [activeMonth, type, categoryId, bankAccountId, familyMemberId, debouncedSearch, router]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.type === "INCOME") acc.income += tx.amount;
        else if (tx.type === "EXPENSE") acc.expense += tx.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const groupByDate = useMemo(() => {
    const groups = new Map<string, TransactionWithRelations[]>();
    for (const tx of transactions) {
      const key = new Date(tx.date).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    return [...groups.entries()];
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Ação do header (botão nova transação) */}
      <div className="flex justify-end">
        <NewTransactionButton
          accounts={accounts}
          categories={categories}
          members={members}
          onSuccess={fetchTransactions}
        />
      </div>

      {/* Totais do mês */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-zinc-500">Receitas do mês</p>
          <PrivacyValue className="mt-1 text-lg font-bold text-emerald-400">
            {formatCurrency(totals.income)}
          </PrivacyValue>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-zinc-500">Despesas do mês</p>
          <PrivacyValue className="mt-1 text-lg font-bold text-red-400">
            {formatCurrency(totals.expense)}
          </PrivacyValue>
        </div>
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

      {/* Filtros */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            <SelectItem value="INCOME">Receita</SelectItem>
            <SelectItem value="EXPENSE">Despesa</SelectItem>
            <SelectItem value="TRANSFER">Transferência</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bankAccountId} onValueChange={setBankAccountId}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as contas</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={familyMemberId} onValueChange={setFamilyMemberId}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Membro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os membros</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            Carregando transações...
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />}
            title="Nenhuma transação encontrada"
            description="Nenhuma transação para os filtros selecionados neste mês."
          />
        ) : (
          <div>
            {/* Header desktop */}
            <div className="hidden md:grid grid-cols-[1.5fr_3fr_2fr_1fr_1.5fr] gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-border">
              <span>Data</span>
              <span>Descrição</span>
              <span>Categoria</span>
              <span>Conta</span>
              <span className="text-right">Valor</span>
            </div>

            {groupByDate.map(([date, items]) => (
              <div key={date}>
                <p className="px-4 py-2 text-xs font-medium text-zinc-500 bg-zinc-900/40">
                  {formatDate(date, "long")}
                </p>
                {items.map((tx) => {
                  const isExpense = tx.type === "EXPENSE";
                  const isIncome = tx.type === "INCOME";
                  return (
                    <div
                      key={tx.id}
                      className="group flex flex-col md:grid md:grid-cols-[1.5fr_3fr_2fr_1fr_1.5fr] md:items-center gap-1 md:gap-4 px-4 py-3 border-b border-border/50 hover:bg-zinc-900/50 transition last:border-b-0"
                    >
                      {/* Data (mobile) */}
                      <span className="md:hidden text-xs text-zinc-500">
                        {formatDate(tx.date, "short")}
                      </span>

                      {/* Descrição */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tx.isRecurring && (
                            <Repeat size={12} className="text-indigo-400" />
                          )}
                          {tx.installments && (
                            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                              <Layers size={11} />
                              {tx.installmentNum}/{tx.installments}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-zinc-200 truncate">
                          {tx.description}
                        </span>
                      </div>

                      {/* Categoria */}
                      <div className="flex items-center gap-2">
                        {tx.category ? (
                          <>
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: tx.category.color }}
                            />
                            <span className="text-sm text-zinc-400 truncate">
                              {tx.category.name}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-600">—</span>
                        )}
                        {tx.familyMember && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                            style={{
                              backgroundColor: `${tx.familyMember.color}22`,
                              color: tx.familyMember.color,
                            }}
                          >
                            {tx.familyMember.name}
                          </span>
                        )}
                      </div>

                      {/* Conta */}
                      <div className="text-sm text-zinc-500 truncate">
                        {tx.bankAccount.name}
                        {tx.destinationAccount && (
                          <span className="text-zinc-600"> → {tx.destinationAccount.name}</span>
                        )}
                      </div>

                      {/* Valor + ações */}
                      <div className="flex items-center justify-between md:justify-end gap-3">
                        <PrivacyValue
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            isExpense && "text-red-400",
                            isIncome && "text-emerald-400",
                            tx.type === "TRANSFER" && "text-zinc-400"
                          )}
                        >
                          {isExpense ? "−" : isIncome ? "+" : "→"}{" "}
                          {formatCurrency(tx.amount)}
                        </PrivacyValue>
                        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditing(tx);
                              setFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleting(tx)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        accounts={accounts}
        categories={categories}
        members={members}
        onSuccess={fetchTransactions}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir transação"
        description={`Excluir "${deleting?.description}"?${
          deleting?.installments ? " Esta ação excluirá toda a série de parcelas." : ""
        }`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Transação inválida" };
          const res = await deleteTransaction(deleting.id);
          if (res.success) {
            router.refresh();
            fetchTransactions();
          }
          return res;
        }}
      />
    </div>
  );
}