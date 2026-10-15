import { getOptionalUserId } from "@/lib/session";
import { getTransactionsForExport } from "@/lib/queries";
import { toCsv } from "@/lib/csv";
import { parseExportParams, toTransactionFilters, transactionCsvRows } from "@/lib/transactionExport";

// O proxy não cobre /api: a sessão é checada aqui.
export async function GET(request: Request) {
  const userId = await getOptionalUserId();
  if (!userId) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const parsed = parseExportParams(new URL(request.url).searchParams);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" },
      { status: 400 }
    );
  }

  const filters = parsed.data;
  const transactions = await getTransactionsForExport(userId, toTransactionFilters(filters));

  return new Response(toCsv(transactionCsvRows(transactions)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacoes_${filters.start}_${filters.end}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
