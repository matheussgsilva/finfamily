import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getInvestmentsWithCalcs,
  getAllocationData,
  getMonthlyProventos,
} from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { InvestmentsClient } from "@/components/investments/InvestmentsClient";

export default async function InvestimentosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const year = new Date().getFullYear();

  const [portfolio, allocation, monthlyProventos] = await Promise.all([
    getInvestmentsWithCalcs(userId),
    getAllocationData(userId),
    getMonthlyProventos(userId, year),
  ]);

  return (
    <div>
      <PageHeader
        title="Investimentos"
        description="Acompanhe seus ativos, operações e proventos."
      />

      <InvestmentsClient
        assets={portfolio.assets}
        totalValue={portfolio.totalValue}
        allocation={allocation}
        monthlyProventos={monthlyProventos}
      />
    </div>
  );
}
