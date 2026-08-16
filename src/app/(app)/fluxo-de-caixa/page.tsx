import { PageHeader } from "@/components/shared/PageHeader";
import { TransactionsClient } from "@/components/transactions/TransactionsClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function FluxoDeCaixaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [accounts, categories, members] = await Promise.all([
    db.bankAccount.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.familyMember.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  const accountItems = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    color: a.color,
  }));

  const categoryItems = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
  }));

  const memberItems = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
  }));

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        description="Acompanhe e registre todas as movimentações da família."
      />

      <Tabs defaultValue="transacoes" className="mb-4">
        <TabsList>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="orcamentos">
            <Link href="/fluxo-de-caixa/orcamentos">Orçamentos</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <TransactionsClient
        accounts={accountItems}
        categories={categoryItems}
        members={memberItems}
      />
    </div>
  );
}