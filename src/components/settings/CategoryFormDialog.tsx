"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { categorySchema } from "@/lib/validations";
import { createCategory, updateCategory } from "@/actions/category.actions";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { CategoryIcon, ICON_OPTIONS } from "@/components/shared/CategoryIcon";
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
import { cn } from "@/lib/utils";

interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
  parentId: string | null;
  userId: string | null;
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryItem | null;
  parentCategories: { id: string; name: string; type: string }[];
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentCategories,
}: CategoryFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  type CategoryFormValues = z.input<typeof categorySchema>;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "#6366f1",
      icon: null,
      parentId: null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? "",
        type: category?.type ?? "EXPENSE",
        color: category?.color ?? "#6366f1",
        icon: category?.icon ?? null,
        parentId: category?.parentId ?? null,
      });
    }
  }, [open, category, reset]);

  const type = watch("type");
  const color = watch("color");
  const icon = watch("icon");

  const filteredParents = parentCategories.filter(
    (p) => p.type === type && p.id !== category?.id
  );

  const onSubmit = async (data: CategoryFormValues) => {
    const parsed = categorySchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const input = parsed.data;
    setLoading(true);
    try {
      const res = category
        ? await updateCategory(category.id, input)
        : await createCategory(input);
      if (res.success) {
        toast.success(category ? "Categoria atualizada." : "Categoria criada.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar a categoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            Organize seus gastos e receitas com categorias personalizadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome</Label>
              <Input placeholder="Ex.: Mercado, Farmácia, Cinema..." {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setValue("type", v as "INCOME" | "EXPENSE")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria pai (opcional)</Label>
              <Select
                value={category?.parentId ?? ""}
                onValueChange={(v) => setValue("parentId", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (categoria raiz)</SelectItem>
                  {filteredParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 rounded-xl border border-input bg-zinc-950/60">
                {ICON_OPTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setValue("icon", icon === name ? null : name)}
                    className={cn(
                      "p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer",
                      icon === name && "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40"
                    )}
                  >
                    <CategoryIcon name={name} size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label>Cor</Label>
              <ColorPicker value={color} onChange={(c) => setValue("color", c)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {category ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
