"use client";

import React, { useState } from "react";
import { Plus, Pencil, Trash2, CreditCard, Banknote, Wallet, PiggyBank, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/actions/account.actions";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/types";
import { AccountFormDialog } from "./AccountFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACCOUNT_ICONS: Record<AccountType, React.ComponentType<{ size?: number; className?: string }>> = {
  CHECKING: Banknote,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  INVESTMENT: Landmark,
  WALLET: Wallet,
};

interface BankAccountItem {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  color: string;
  icon: string | null;
}

export function AccountsSection({ accounts }: { accounts: BankAccountItem[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountItem | null>(null);
  const [deleting, setDeleting] = useState<BankAccountItem | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contas Bancárias</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Nova conta
        </Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Banknote size={20} />}
            title="Nenhuma conta criada"
            description="Crie uma conta bancária ou cartão para começar a registrar suas movimentações."
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const Icon = ACCOUNT_ICONS[account.type];
              const isCredit = account.type === "CREDIT_CARD";
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-zinc-950/40 hover:bg-zinc-900/60 transition group"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                    style={{ backgroundColor: `${account.color}22`, color: account.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {account.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </Badge>
                      {isCredit && account.dueDay && (
                        <span className="text-[11px] text-zinc-500">
                          Vencimento dia {account.dueDay}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isCredit ? "text-zinc-300" : "text-emerald-400"}`}>
                      {isCredit
                        ? `Fatura: ${formatCurrency(Math.abs(account.balance))}`
                        : formatCurrency(account.balance)}
                    </p>
                    {isCredit && account.creditLimit !== null && (
                      <p className="text-[11px] text-zinc-500">
                        Limite {formatCurrency(account.creditLimit)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => {
                        setEditing(account);
                        setFormOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleting(account)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir conta"
        description={`Tem certeza que deseja excluir a conta "${deleting?.name}"?`}
        actionLabel="Excluir conta"
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Conta inválida" };
          const res = await deleteAccount(deleting.id);
          if (res.success) {
            router.refresh();
          }
          return res;
        }}
      />
    </Card>
  );
}
