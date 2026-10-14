import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCashFlowProjectionInput } from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { CashFlowTabs } from "@/components/shared/CashFlowTabs";
import { ProjectionClient } from "@/components/projection/ProjectionClient";

export default async function ProjecaoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const input = await getCashFlowProjectionInput(session.user.id, 6);

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        description="Quanto dinheiro você terá nos próximos meses, com parcelas, recorrências e faturas."
      />
      <CashFlowTabs active="projecao" />
      <ProjectionClient initialInput={input} initialMonths={6} />
    </div>
  );
}
