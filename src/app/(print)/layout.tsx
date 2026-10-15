import { redirect } from "next/navigation";
import { getOptionalUserId } from "@/lib/session";

/** Páginas feitas para imprimir / salvar como PDF: fundo branco e sem a barra lateral do app. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const userId = await getOptionalUserId();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          thead { display: table-header-group; }
          tr, .avoid-break { break-inside: avoid; }
        }
      `}</style>
      <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
