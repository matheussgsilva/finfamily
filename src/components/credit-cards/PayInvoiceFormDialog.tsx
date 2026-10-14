"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { invoicePaymentSchema } from "@/lib/validations";
import { payCreditCardInvoice } from "@/actions/credit-card.actions";
import { formatCurrency } from "@/lib/utils";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInputBR } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InvoicePaymentFormValues = z.input<typeof invoicePaymentSchema>;

export interface PaymentAccountItem {
  id: string;
  name: string;
  color: string;
  balance: number;
}

interface PayInvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardName: string;
  month: number;
  year: number;
  openAmount: number;
  /** Janela de pagamento da fatura, em yyyy-MM-dd. */
  paymentStartDay: string;
  paymentEndDay: string;
  accounts: PaymentAccountItem[];
  onSuccess: () => void;
}

const isoDayToBR = (day: string) => day.split("-").reverse().join("/");

/** Hoje puxado para dentro da janela (strings yyyy-MM-dd comparam em ordem cronológica). */
function defaultPaymentDay(startDay: string, endDay: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  if (today < startDay) return startDay;
  if (today > endDay) return endDay;
  return today;
}

export function PayInvoiceFormDialog({
  open,
  onOpenChange,
  cardId,
  cardName,
  month,
  year,
  openAmount,
  paymentStartDay,
  paymentEndDay,
  accounts,
  onSuccess,
}: PayInvoiceFormDialogProps) {
  const [loading, setLoading] = useState(false);

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InvoicePaymentFormValues>({
    resolver: zodResolver(invoicePaymentSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        cardId,
        sourceAccountId: accounts[0]?.id ?? "",
        amount: openAmount,
        date: defaultPaymentDay(paymentStartDay, paymentEndDay),
        month,
        year,
      });
    }
  }, [open, cardId, accounts, openAmount, paymentStartDay, paymentEndDay, month, year, reset]);

  const onSubmit = async (data: InvoicePaymentFormValues) => {
    const parsed = invoicePaymentSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = await payCreditCardInvoice(parsed.data);
      if (res.success) {
        toast.success("Pagamento registrado.");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao registrar o pagamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            Registra uma transferência da conta escolhida para o cartão {cardName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Pagar com</Label>
            <Controller
              control={control}
              name="sourceAccountId"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          {account.name}
                          <PrivacyValue className="text-xs text-zinc-500">
                            {formatCurrency(account.balance)}
                          </PrivacyValue>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.sourceAccountId && (
              <p className="mt-1 text-xs text-red-400">{errors.sourceAccountId.message}</p>
            )}
          </div>

          <div>
            <Label>Valor</Label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <CurrencyInput
                  placeholder="0,00"
                  value={field.value as number | undefined}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
            <p className="mt-1 text-xs text-zinc-500">
              Em aberto: <PrivacyValue>{formatCurrency(openAmount)}</PrivacyValue>. Pagamentos
              parciais são permitidos.
            </p>
          </div>

          <div>
            <Label>Data do pagamento</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DateInputBR value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date.message}</p>}
            <p className="mt-1 text-xs text-zinc-500">
              Para abater esta fatura: entre {isoDayToBR(paymentStartDay)} e{" "}
              {isoDayToBR(paymentEndDay)}.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Registrar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
