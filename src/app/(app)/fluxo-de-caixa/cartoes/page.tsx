import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCardsClient } from "@/components/credit-cards/CreditCardsClient";

export default async function CartoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const creditCards = await db.bankAccount.findMany({
    where: { userId, type: "CREDIT_CARD" },
    orderBy: { name: "asc" },
  });

  const cardItems = creditCards.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    closingDay: c.closingDay,
    dueDay: c.dueDay,
  }));

  return (
    <div>
      <PageHeader
        title="Faturas de Cartão"
        description="Acompanhe e pague as faturas dos seus cartões de crédito."
      />

      <Tabs defaultValue="cartoes" className="mb-4">
        <TabsList>
          <TabsTrigger value="transacoes">
            <Link href="/fluxo-de-caixa">Transações</Link>
          </TabsTrigger>
          <TabsTrigger value="orcamentos">
            <Link href="/fluxo-de-caixa/orcamentos">Orçamentos</Link>
          </TabsTrigger>
          <TabsTrigger value="cartoes">Faturas</TabsTrigger>
        </TabsList>
      </Tabs>

      <CreditCardsClient creditCards={cardItems} />
    </div>
  );
}
