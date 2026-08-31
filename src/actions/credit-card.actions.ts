"use server";

import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import { endOfDay, startOfDay } from "date-fns";

export async function getCreditCardInvoice(accountId: string, month: number, year: number) {
  try {
    const userId = await getRequiredUserId();
    const account = await db.bankAccount.findFirst({
      where: { id: accountId, userId, type: "CREDIT_CARD" },
    });

    if (!account) {
      return { success: false, error: "Cartão não encontrado." };
    }

    const closingDay = account.closingDay || 1;

    // Fatura do mês X fecha no dia closingDay do mês X.
    // Ex: Fatura de Setembro (Mês 9) fecha em 05/09.
    // As compras vão de 06/08 até 05/09.
    
    // Meses no JS são 0-indexed (0 = Jan, 8 = Set)
    const startDate = startOfDay(new Date(year, month - 2, closingDay + 1));
    const endDate = endOfDay(new Date(year, month - 1, closingDay));

    const transactions = await db.transaction.findMany({
      where: {
        bankAccountId: accountId,
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
      orderBy: { date: "desc" },
    });

    const total = transactions.reduce((acc, t) => {
      // Entradas na fatura (pagamento da fatura) reduzem o valor, despesas aumentam
      if (t.type === "EXPENSE") return acc + Number(t.amount);
      if (t.type === "INCOME" || t.type === "TRANSFER") return acc - Number(t.amount);
      return acc;
    }, 0);

    return {
      success: true,
      data: {
        transactions,
        total,
        startDate,
        endDate,
        closingDay,
        dueDay: account.dueDay,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar fatura:", error);
    return { success: false, error: "Erro ao carregar os dados da fatura." };
  }
}
