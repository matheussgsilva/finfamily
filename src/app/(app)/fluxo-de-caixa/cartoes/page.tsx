import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccountBalances } from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { CashFlowTabs } from "@/components/shared/CashFlowTabs";
import { CreditCardsClient } from "@/components/credit-cards/CreditCardsClient";

export default async function CartoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [creditCards, balances] = await Promise.all([
    db.bankAccount.findMany({
      where: { userId, type: "CREDIT_CARD" },
      orderBy: { name: "asc" },
    }),
    getAccountBalances(userId),
  ]);

  const paymentAccounts = balances
    .filter((a) => a.type !== "CREDIT_CARD")
    .map((a) => ({ id: a.id, name: a.name, color: a.color, balance: a.balance }));

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

      <CashFlowTabs active="cartoes" />

      <CreditCardsClient creditCards={cardItems} paymentAccounts={paymentAccounts} />
    </div>
  );
}
