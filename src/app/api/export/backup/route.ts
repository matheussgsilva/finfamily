import { format } from "date-fns";
import { getOptionalUserId } from "@/lib/session";
import { getBackupData } from "@/lib/queries";

// O proxy não cobre /api: a sessão é checada aqui.
export async function GET() {
  const userId = await getOptionalUserId();
  if (!userId) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const backup = {
    app: "FinFamily",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: await getBackupData(userId),
  };

  // Decimal do Prisma serializa como texto (toJSON), sem perder precisão.
  const body = JSON.stringify(backup, null, 2);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="finfamily-backup-${format(new Date(), "yyyy-MM-dd")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
