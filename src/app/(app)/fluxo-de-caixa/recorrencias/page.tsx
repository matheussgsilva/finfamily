import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecurringSeries } from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

      <Tabs defaultValue="recorrencias" className="mb-4">
        <TabsList>
          <TabsTrigger value="transacoes">
            <Link href="/fluxo-de-caixa">Transações</Link>
          </TabsTrigger>
          <TabsTrigger value="orcamentos">
            <Link href="/fluxo-de-caixa/orcamentos">Orçamentos</Link>
          </TabsTrigger>
          <TabsTrigger value="cartoes">
            <Link href="/fluxo-de-caixa/cartoes">Faturas</Link>
          </TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
        </TabsList>
      </Tabs>

      <RecurrencesClient series={series} />
    </div>
  );
}
