"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { categorizationRuleSchema } from "@/lib/validations";
import { createRule, updateRule } from "@/actions/rule.actions";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import type { CategorizationRuleItem } from "@/types";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RuleFormValues = z.input<typeof categorizationRuleSchema>;

export interface RuleCategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
}

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RuleCategoryItem[];
  rule?: CategorizationRuleItem | null;
}

export function RuleFormDialog({ open, onOpenChange, categories, rule }: RuleFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(categorizationRuleSchema),
    defaultValues: { pattern: "", categoryId: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ pattern: rule?.pattern ?? "", categoryId: rule?.categoryId ?? "" });
    }
  }, [open, rule, reset]);

  const onSubmit = async (data: RuleFormValues) => {
    const parsed = categorizationRuleSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const res = rule ? await updateRule(rule.id, parsed.data) : await createRule(parsed.data);
      if (res.success) {
        toast.success(rule ? "Regra atualizada." : "Regra criada.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar a regra.");
    } finally {
      setLoading(false);
    }
  };

  const renderGroup = (type: "EXPENSE" | "INCOME", label: string) => {
    const list = categories.filter((c) => c.type === type);
    if (list.length === 0) return null;
    return (
      <SelectGroup>
        <SelectLabel>{label}</SelectLabel>
        {list.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span className="flex items-center gap-2">
              <CategoryIcon name={category.icon} size={14} />
              {category.name}
            </span>
          </SelectItem>
        ))}
      </SelectGroup>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra"}</DialogTitle>
          <DialogDescription>
            Na importação de extrato, lançamentos cuja descrição contém o texto recebem a
            categoria escolhida. Maiúsculas, acentos, números e símbolos são ignorados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Descrição contém</Label>
            <Input placeholder="Ex.: IFOOD, UBER, NETFLIX" {...register("pattern")} />
            {errors.pattern && <p className="mt-1 text-xs text-red-400">{errors.pattern.message}</p>}
          </div>

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
                    {renderGroup("EXPENSE", "Despesas")}
                    {renderGroup("INCOME", "Receitas")}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-400">{errors.categoryId.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Salvar regra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
