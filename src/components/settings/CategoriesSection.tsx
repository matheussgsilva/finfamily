"use client";

import React, { useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/actions/category.actions";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
  parentId: string | null;
  userId: string | null;
}

export function CategoriesSection({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);

  const expenses = categories.filter((c) => c.type === "EXPENSE");
  const incomes = categories.filter((c) => c.type === "INCOME");

  const renderRow = (category: CategoryItem, isSystem: boolean) => (
    <div
      key={category.id}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-900/60 transition group"
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
        style={{ backgroundColor: `${category.color}22`, color: category.color }}
      >
        <CategoryIcon name={category.icon} size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">
          {category.name}
          {isSystem && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-600">
              padrão
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => {
            setEditing(category);
            setFormOpen(true);
          }}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        {!isSystem && (
          <button
            onClick={() => setDeleting(category)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );

  const renderList = (list: CategoryItem[], title: string) => (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-3 mb-2">
        {title}
      </h3>
      <div className="divide-y divide-border/50 rounded-xl border border-border bg-zinc-950/30">
        {list.length === 0 ? (
          <p className="text-sm text-zinc-600 p-4">Nenhuma categoria.</p>
        ) : (
          list.map((c) => renderRow(c, c.userId === null))
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Categorias</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Nova categoria
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Badge variant="secondary" className="mb-2">
            <Tag size={12} className="mr-1" />
            As categorias padrão podem ser usadas por todos, mas só é possível excluir as suas.
          </Badge>
        </div>
        {categories.length === 0 ? (
          <EmptyState
            icon={<Tag size={20} />}
            title="Nenhuma categoria"
            description="Crie categorias para organizar suas receitas e despesas."
          />
        ) : (
          <>
            {renderList(expenses, "Despesas")}
            {renderList(incomes, "Receitas")}
          </>
        )}
      </CardContent>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        parentCategories={categories}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir categoria"
        description={`Tem certeza que deseja excluir a categoria "${deleting?.name}"?`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Categoria inválida" };
          const res = await deleteCategory(deleting.id);
          if (res.success) router.refresh();
          return res;
        }}
      />
    </Card>
  );
}
