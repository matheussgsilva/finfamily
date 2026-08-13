import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getDashboardKPIs,
  getExpenseByCategory,
  getMonthlyCashFlow,
  getTransactions,
} from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCards } from "@/components/dashboard/KpiCards";
import {
  NetWorthChart,
  CashFlowChart,
  ExpenseDonut,
} from "@/components/dashboard/DashboardCharts";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [kpis, expenseByCategory, cashFlow, recentTransactions] = await Promise.all([
    getDashboardKPIs(userId),
    getExpenseByCategory(userId, month, year),
    getMonthlyCashFlow(userId, 6),
    getTransactions(userId),
  ]);

  const monthTotalExpense = expenseByCategory.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Visão geral das suas finanças."
      />

      <KpiCards kpis={kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <NetWorthChart />
        <CashFlowChart data={cashFlow} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ExpenseDonut data={expenseByCategory} total={monthTotalExpense} />
        <RecentTransactions transactions={recentTransactions} />
      </div>
    </div>
  );
}
