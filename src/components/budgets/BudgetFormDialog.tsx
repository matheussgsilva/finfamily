"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { budgetSchema } from "@/lib/validations";
import { upsertBudget } from "@/actions/budget.actions";
import { useRouter } from "next/navigation";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
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

type BudgetFormValues = z.input<typeof budgetSchema>;

interface CategoryItem {
  id: string;
  name: string;
  icon: string | null;
  color: string;
}

interface BudgetItem {
  id: string;
  categoryId: string;
  amount: number;
}

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  budget?: BudgetItem | null;
  month: number;
  year: number;
  usedCategoryIds: string[];
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  categories,
  budget,
  month,
  year,
  usedCategoryIds,
}: BudgetFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { categoryId: "", amount: undefined, month, year },
  });

  useEffect(() => {
    if (open) {
      reset({
        categoryId: budget?.categoryId ?? "",
        amount: budget?.amount ?? undefined,
        month,
        year,
      });
    }
  }, [open, budget, month, year, reset]);

  const availableCategories = budget
    ? categories
    : categories.filter((c) => !usedCategoryIds.includes(c.id));

  const onSubmit = async (data: BudgetFormValues) => {
    const parsed = budgetSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = await upsertBudget(parsed.data);
      if (res.success) {
        toast.success("Orçamento salvo.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar o orçamento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>
            Defina um limite mensal de gastos por categoria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Categoria</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
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
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-400">{errors.categoryId.message}</p>
            )}
          </div>

          <div>
            <Label>Limite mensal</Label>
            <Input type="number" step="0.01" min="0" placeholder="0,00" {...register("amount")} />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Salvar orçamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
