"use client";

import React, { useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteRule } from "@/actions/rule.actions";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategorizationRuleItem } from "@/types";
import { RuleFormDialog, type RuleCategoryItem } from "./RuleFormDialog";

export function RulesSection({
  rules,
  categories,
}: {
  rules: CategorizationRuleItem[];
  categories: RuleCategoryItem[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategorizationRuleItem | null>(null);
  const [deleting, setDeleting] = useState<CategorizationRuleItem | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Regras de categorização</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Nova regra
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Badge variant="secondary">
            <Wand2 size={12} className="mr-1" />
            Usadas na importação de extrato: com várias regras compatíveis, vence o texto mais longo.
          </Badge>
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<Wand2 size={20} />}
            title="Nenhuma regra"
            description="Crie regras aqui ou marque “lembrar” ao revisar uma importação."
          />
        ) : (
          <div className="divide-y divide-border/50 rounded-xl border border-border bg-zinc-950/30">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-900/60 transition group"
              >
                <code className="rounded bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-200 truncate max-w-[45%]">
                  {rule.pattern}
                </code>
                <ArrowRight size={14} className="text-zinc-600 shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                    style={{ backgroundColor: `${rule.categoryColor}22`, color: rule.categoryColor }}
                  >
                    <CategoryIcon name={rule.categoryIcon} size={14} />
                  </div>
                  <span className="text-sm text-zinc-200 truncate">{rule.categoryName}</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                    {rule.categoryType === "INCOME" ? "receita" : "despesa"}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditing(rule);
                      setFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleting(rule)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <RuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        rule={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir regra"
        description={`Tem certeza que deseja excluir a regra "${deleting?.pattern}"?`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Regra inválida" };
          const res = await deleteRule(deleting.id);
          if (res.success) router.refresh();
          return res;
        }}
      />
    </Card>
  );
}
