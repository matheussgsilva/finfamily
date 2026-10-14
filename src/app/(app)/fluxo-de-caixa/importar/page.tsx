import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/PageHeader";
import { ImportClient } from "@/components/import/ImportClient";

export default async function ImportarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [accounts, categories] = await Promise.all([
    db.bankAccount.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div>
      <Link
        href="/fluxo-de-caixa"
        className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ChevronLeft size={14} />
        Fluxo de caixa
      </Link>
      <PageHeader
        title="Importar extrato"
        description="Envie o arquivo OFX exportado pelo seu banco, revise as categorias e importe."
      />

      <ImportClient
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, color: a.color }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
        }))}
      />
    </div>
  );
}
