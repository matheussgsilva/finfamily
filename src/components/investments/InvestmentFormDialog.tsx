"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { investmentSchema } from "@/lib/validations";
import { createInvestment, updateInvestment } from "@/actions/investment.actions";
import { useRouter } from "next/navigation";
import { ASSET_CLASS_LABELS, type AssetClass } from "@/types";
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

type InvestmentFormValues = z.input<typeof investmentSchema>;

const ASSET_CLASSES = Object.keys(ASSET_CLASS_LABELS) as AssetClass[];

interface AssetItem {
  id: string;
  ticker: string | null;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
  targetAlloc: number | null;
}

interface InvestmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: AssetItem | null;
}

export function InvestmentFormDialog({
  open,
  onOpenChange,
  investment,
}: InvestmentFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      ticker: "",
      name: "",
      assetClass: "STOCKS",
      quantity: undefined,
      avgPrice: undefined,
      currentPrice: undefined,
      targetAlloc: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        ticker: investment?.ticker ?? "",
        name: investment?.name ?? "",
        assetClass: investment?.assetClass ?? "STOCKS",
        quantity: investment?.quantity ?? undefined,
        avgPrice: investment?.avgPrice ?? undefined,
        currentPrice: investment?.currentPrice ?? undefined,
        targetAlloc: investment?.targetAlloc ?? undefined,
      });
    }
  }, [open, investment, reset]);

  const onSubmit = async (data: InvestmentFormValues) => {
    const parsed = investmentSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = investment
        ? await updateInvestment(investment.id, parsed.data)
        : await createInvestment(parsed.data);
      if (res.success) {
        toast.success(investment ? "Ativo atualizado." : "Ativo criado.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar o ativo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{investment ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          <DialogDescription>
            Cadastre um ativo da carteira de investimentos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Classe de ativo</Label>
            <Controller
              control={control}
              name="assetClass"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSES.map((ac) => (
                      <SelectItem key={ac} value={ac}>
                        {ASSET_CLASS_LABELS[ac]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assetClass && (
              <p className="mt-1 text-xs text-red-400">{errors.assetClass.message}</p>
            )}
          </div>

          <div>
            <Label>Nome</Label>
            <Input placeholder="Ex.: Fundo de Renda Fixa" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <Label>Ticker (opcional)</Label>
            <Input placeholder="Ex.: PETR4, MXRF11, BTC" {...register("ticker")} />
            {errors.ticker && (
              <p className="mt-1 text-xs text-red-400">{errors.ticker.message}</p>
            )}
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
              <Label>Preço médio</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("avgPrice")} />
              {errors.avgPrice && (
                <p className="mt-1 text-xs text-red-400">{errors.avgPrice.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço atual</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("currentPrice")} />
            </div>
            <div>
              <Label>Alocação meta (%)</Label>
              <Input type="number" step="0.5" min="0" max="100" placeholder="Ex.: 20" {...register("targetAlloc")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {investment ? "Salvar" : "Criar ativo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
