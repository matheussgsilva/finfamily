"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { operationSchema } from "@/lib/validations";
import { createOperation } from "@/actions/investment.actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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

type OperationFormValues = z.input<typeof operationSchema>;

interface OperationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: { id: string; name: string; ticker: string | null; quantity: number } | null;
}

export function OperationFormDialog({
  open,
  onOpenChange,
  investment,
}: OperationFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OperationFormValues>({
    resolver: zodResolver(operationSchema),
    defaultValues: { type: "BUY", quantity: undefined, price: undefined, fees: 0, date: new Date() },
  });

  useEffect(() => {
    if (open) {
      reset({
        type: "BUY",
        quantity: undefined,
        price: undefined,
        fees: 0,
        date: new Date(),
      });
    }
  }, [open, reset]);

  const type = watch("type");
  const quantity = watch("quantity");
  const price = watch("price");
  const fees = watch("fees") ?? 0;
  const total = (Number(quantity) || 0) * (Number(price) || 0) + (Number(fees) || 0);

  const onSubmit = async (data: OperationFormValues) => {
    if (!investment) return;
    const parsed = operationSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = await createOperation(investment.id, parsed.data);
      if (res.success) {
        toast.success(type === "BUY" ? "Compra registrada." : "Venda registrada.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao registrar a operação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "BUY" ? "Registrar compra" : "Registrar venda"}
            {investment ? ` — ${investment.ticker ?? investment.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Registre uma operação de compra ou venda do ativo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setValue("type", "BUY", { shouldValidate: true })}
              className={cn(
                "h-10 rounded-xl border text-sm font-medium transition cursor-pointer",
                type === "BUY"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
            >
              Compra
            </button>
            <button
              type="button"
              onClick={() => setValue("type", "SELL", { shouldValidate: true })}
              className={cn(
                "h-10 rounded-xl border text-sm font-medium transition cursor-pointer",
                type === "SELL"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
            >
              Venda
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" step="0.00000001" min="0" placeholder="0" {...register("quantity")} />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-400">{errors.quantity.message}</p>
              )}
            </div>
            <div>
              <Label>Preço unitário</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("price")} />
              {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Taxas</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("fees")} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" {...register("date")} />
              {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date.message}</p>}
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-right">
            Total: <span className="font-semibold text-zinc-300">{total.toFixed(2)}</span>
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={type === "SELL" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {type === "BUY" ? "Registrar compra" : "Registrar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
