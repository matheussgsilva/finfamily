import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/PageHeader";
import { CashFlowTabs } from "@/components/shared/CashFlowTabs";
import { BudgetsClient } from "@/components/budgets/BudgetsClient";

export default async function OrcamentosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const expenseCategories = await db.category.findMany({
    where: { type: "EXPENSE", OR: [{ userId }, { userId: null }] },
    orderBy: { name: "asc" },
  });

  const categoryItems = expenseCategories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
  }));

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Defina limites mensais de gastos por categoria."
      />

      <CashFlowTabs active="orcamentos" />

      <BudgetsClient categories={categoryItems} />
    </div>
  );
}
