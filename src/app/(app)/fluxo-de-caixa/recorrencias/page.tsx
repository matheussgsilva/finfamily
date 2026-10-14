import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecurringSeries } from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { CashFlowTabs } from "@/components/shared/CashFlowTabs";
import { RecurrencesClient } from "@/components/recurrences/RecurrencesClient";

export default async function RecorrenciasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const series = await getRecurringSeries(userId);

  return (
    <div>
      <PageHeader
        title="Recorrências"
        description="Assinaturas e contas fixas que se repetem todo mês."
      />

      <CashFlowTabs active="recorrencias" />

      <RecurrencesClient series={series} />
    </div>
  );
}
