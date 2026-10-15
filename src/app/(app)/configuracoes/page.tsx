import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccountBalances, getCategorizationRules } from "@/lib/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccountsSection } from "@/components/settings/AccountsSection";
import { CategoriesSection } from "@/components/settings/CategoriesSection";
import { MembersSection } from "@/components/settings/MembersSection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { DataExportSection } from "@/components/settings/DataExportSection";
import { RulesSection } from "@/components/settings/RulesSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Tags, Users, User as UserIcon, Wand2 } from "lucide-react";

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [userProfile, accounts, categories, members, rules] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    }),
    getAccountBalances(userId),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.familyMember.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    getCategorizationRules(userId),
  ]);

  const accountItems = accounts
    .map((a) => ({
      ...a,
      creditLimit: a.creditLimit !== null ? Number(a.creditLimit) : null,
    }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie suas contas, categorias e membros da família."
      />

      <Tabs defaultValue="perfil">
        <TabsList className="w-full sm:w-auto grid grid-cols-5">
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <UserIcon size={15} />
            Perfil
          </TabsTrigger>
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
          <TabsTrigger value="regras" className="flex items-center gap-2">
            <Wand2 size={15} />
            Regras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          {userProfile && <ProfileSection user={userProfile} />}
          <DataExportSection />
        </TabsContent>
        <TabsContent value="contas">
          <AccountsSection accounts={accountItems} />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriesSection categories={categories} />
        </TabsContent>
        <TabsContent value="membros">
          <MembersSection members={members} />
        </TabsContent>
        <TabsContent value="regras">
          <RulesSection
            rules={rules}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              icon: c.icon,
              color: c.color,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
