"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { proventoSchema } from "@/lib/validations";
import { createProvento } from "@/actions/investment.actions";
import { useRouter } from "next/navigation";
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

type ProventoFormValues = z.input<typeof proventoSchema>;

const PROVENTO_TYPES = [
  { value: "DIVIDEND", label: "Dividendo" },
  { value: "JCP", label: "Juros sobre Capital" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "AMORTIZACAO", label: "Amortização" },
  { value: "OUTROS", label: "Outros" },
];

interface ProventoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: { id: string; name: string; ticker: string | null } | null;
}

export function ProventoFormDialog({ open, onOpenChange, investment }: ProventoFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProventoFormValues>({
    resolver: zodResolver(proventoSchema),
    defaultValues: {
      type: "DIVIDEND",
      amount: undefined,
      paymentDate: new Date(),
      referenceDate: undefined,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        type: "DIVIDEND",
        amount: undefined,
        paymentDate: new Date(),
        referenceDate: undefined,
        notes: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: ProventoFormValues) => {
    if (!investment) return;
    const parsed = proventoSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = await createProvento(investment.id, parsed.data);
      if (res.success) {
        toast.success("Provento registrado.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao registrar o provento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Registrar provento{investment ? ` — ${investment.ticker ?? investment.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Registre dividendos, JCP ou outros rendimentos recebidos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <select
              {...register("type")}
              className="flex h-10 w-full rounded-xl border border-input bg-zinc-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {PROVENTO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("amount")} />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>
              )}
            </div>
            <div>
              <Label>Data de pagamento</Label>
              <Input type="date" {...register("paymentDate")} />
              {errors.paymentDate && (
                <p className="mt-1 text-xs text-red-400">{errors.paymentDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Data-base (opcional)</Label>
            <Input type="date" {...register("referenceDate")} />
          </div>

          <div>
            <Label>Observações</Label>
            <Input placeholder="Ex.: Amortização parcial" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Registrar provento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
