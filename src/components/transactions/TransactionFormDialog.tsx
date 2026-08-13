"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { transactionSchema } from "@/lib/validations";
import { createTransaction, updateTransaction } from "@/actions/transaction.actions";
import { useRouter } from "next/navigation";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { cn } from "@/lib/utils";
import type { AccountType, TransactionType } from "@/types";
import type { TransactionWithRelations } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TransactionFormValues = z.input<typeof transactionSchema>;

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

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionWithRelations | null;
  accounts: AccountItem[];
  categories: CategoryItem[];
  members: MemberItem[];
}

const TYPE_OPTIONS: { value: TransactionType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: "EXPENSE", label: "Despesa", icon: ArrowUpRight },
  { value: "INCOME", label: "Receita", icon: ArrowDownLeft },
  { value: "TRANSFER", label: "Transferência", icon: ArrowLeftRight },
];

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
  members,
}: TransactionFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: undefined,
      type: "EXPENSE",
      date: new Date().toISOString().split("T")[0] as unknown as Date,
      categoryId: null,
      bankAccountId: "",
      destinationAccountId: null,
      familyMemberId: null,
      notes: null,
      isRecurring: false,
      installments: null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        description: transaction?.description ?? "",
        amount: transaction?.amount ?? undefined,
        type: transaction?.type ?? "EXPENSE",
        date: (() => {
          const d = transaction?.date
            ? new Date(transaction.date)
            : new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
          ).padStart(2, "0")}` as unknown as Date;
        })(),
        categoryId: transaction?.categoryId ?? null,
        bankAccountId: transaction?.bankAccountId ?? (accounts[0]?.id ?? ""),
        destinationAccountId: transaction?.destinationAccountId ?? null,
        familyMemberId: transaction?.familyMemberId ?? null,
        notes: transaction?.notes ?? null,
        isRecurring: transaction?.isRecurring ?? false,
        installments: transaction?.installments ?? null,
      });
    }
  }, [open, transaction, reset, accounts]);

  const type = watch("type");

  const filteredCategories = useMemo(() => {
    if (type === "TRANSFER") return [];
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const onSubmit = async (data: TransactionFormValues) => {
    const payload: TransactionFormValues = {
      ...data,
      installments: data.installments ? Number(data.installments) : null,
    };
    const parsed = transactionSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const input = parsed.data;
    setLoading(true);
    try {
      const res = transaction
        ? await updateTransaction(transaction.id, input)
        : await createTransaction(input);
      if (res.success) {
        toast.success(transaction ? "Transação atualizada." : "Transação registrada.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar a transação.");
    } finally {
      setLoading(false);
    }
  };

  const isSeriesChild = !!transaction?.installmentNum && transaction.installmentNum > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar transação" : "Nova transação"}
          </DialogTitle>
          <DialogDescription>
            Registre receitas, despesas e transferências de forma rápida.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValue("type", option.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition cursor-pointer",
                    active
                      ? option.value === "EXPENSE"
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : option.value === "INCOME"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                      : "border-border text-zinc-500 hover:bg-zinc-900"
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>

          {isSeriesChild && (
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              Esta é uma parcela de uma série. As alterações abaixo afetarão apenas a
              parcela original.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex.: Supermercado, Salário, Netflix..." {...register("description")} />
              {errors.description && (
                <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("amount")} />
              {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" {...register("date")} />
              {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date.message}</p>}
            </div>

            {/* Conta */}
            <div>
              <Label>Conta</Label>
              <Controller
                control={control}
                name="bankAccountId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.bankAccountId && (
                <p className="mt-1 text-xs text-red-400">{errors.bankAccountId.message}</p>
              )}
            </div>

            {/* Conta destino (transferência) */}
            {type === "TRANSFER" && (
              <div>
                <Label>Conta de destino</Label>
                <Controller
                  control={control}
                  name="destinationAccountId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter((a) => a.id !== watch("bankAccountId"))
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Categoria */}
            {type !== "TRANSFER" && (
              <div>
                <Label>Categoria</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon name={category.icon} size={14} />
                              {category.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Membro da família */}
            <div>
              <Label>Membro (opcional)</Label>
              <Controller
                control={control}
                name="familyMemberId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem membro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem membro</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Parcelas */}
            {type === "EXPENSE" && (
              <div>
                <Label>Parcelas (opcional)</Label>
                <Input
                  type="number"
                  min="2"
                  max="120"
                  placeholder="Ex.: 12"
                  {...register("installments")}
                />
                {errors.installments && (
                  <p className="mt-1 text-xs text-red-400">{errors.installments.message}</p>
                )}
              </div>
            )}

            {/* Recorrente */}
            {type !== "TRANSFER" && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-zinc-950/40 px-4 py-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Transação recorrente</p>
                  <p className="text-xs text-zinc-500">
                    Marque se este gasto se repete todos os meses.
                  </p>
                </div>
                <Controller
                  control={control}
                  name="isRecurring"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>Observações (opcional)</Label>
              <Textarea placeholder="Notas adicionais..." {...register("notes")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {transaction ? "Salvar alterações" : "Registrar transação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
