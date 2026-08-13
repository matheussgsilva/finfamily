import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccountsSection } from "@/components/settings/AccountsSection";
import { CategoriesSection } from "@/components/settings/CategoriesSection";
import { MembersSection } from "@/components/settings/MembersSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Tags, Users } from "lucide-react";

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [accounts, categories, members] = await Promise.all([
    db.bankAccount.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.familyMember.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  const accountItems = accounts.map((a) => ({
    ...a,
    balance: Number(a.balance),
    creditLimit: a.creditLimit !== null ? Number(a.creditLimit) : null,
  }));

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie suas contas, categorias e membros da família."
      />

      <Tabs defaultValue="contas">
        <TabsList className="w-full sm:w-auto grid grid-cols-3">
          <TabsTrigger value="contas" className="flex items-center gap-2">
            <Building2 size={15} />
            Contas
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-2">
            <Tags size={15} />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="membros" className="flex items-center gap-2">
            <Users size={15} />
            Membros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas">
          <AccountsSection accounts={accountItems} />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriesSection categories={categories} />
        </TabsContent>
        <TabsContent value="membros">
          <MembersSection members={members} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
