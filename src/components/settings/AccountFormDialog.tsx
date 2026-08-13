"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { accountSchema } from "@/lib/validations";
import { createAccount, updateAccount } from "@/actions/account.actions";
import { useRouter } from "next/navigation";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/types";
import { ColorPicker } from "@/components/shared/ColorPicker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
    creditLimit: number | null;
    closingDay: number | null;
    dueDay: number | null;
    color: string;
    icon: string | null;
  } | null;
}

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function AccountFormDialog({ open, onOpenChange, account }: AccountFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  type AccountFormValues = z.input<typeof accountSchema>;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "CHECKING",
      balance: 0,
      creditLimit: null,
      closingDay: null,
      dueDay: null,
      color: "#6366f1",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: account?.name ?? "",
        type: account?.type ?? "CHECKING",
        balance: account?.balance ?? 0,
        creditLimit: account?.creditLimit ?? null,
        closingDay: account?.closingDay ?? null,
        dueDay: account?.dueDay ?? null,
        color: account?.color ?? "#6366f1",
      });
    }
  }, [open, account, reset]);

  const type = watch("type");
  const color = watch("color");
  const isCreditCard = type === "CREDIT_CARD";

  const onSubmit = async (data: AccountFormValues) => {
    const parsed = accountSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const input = parsed.data;
    setLoading(true);
    try {
      const res = account
        ? await updateAccount(account.id, input)
        : await createAccount(input);
      if (res.success) {
        toast.success(account ? "Conta atualizada." : "Conta criada.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar a conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Configure as contas bancárias e cartões da sua família.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome da conta</Label>
              <Input placeholder="Ex.: Nubank, Bradesco, Carteira" {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setValue("type", v as AccountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isCreditCard ? "Fatura atual" : "Saldo atual"}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register("balance")}
              />
              {errors.balance && (
                <p className="mt-1 text-xs text-red-400">{errors.balance.message}</p>
              )}
            </div>

            {isCreditCard && (
              <div>
                <Label>Limite do cartão</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="5000,00"
                  {...register("creditLimit")}
                />
              </div>
            )}

            {isCreditCard && (
              <div>
                <Label>Dia de fechamento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex.: 19"
                  {...register("closingDay")}
                />
              </div>
            )}

            {isCreditCard && (
              <div>
                <Label>Dia de vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex.: 25"
                  {...register("dueDay")}
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>Cor de identificação</Label>
              <ColorPicker value={color} onChange={(c) => setValue("color", c)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {account ? "Salvar alterações" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
