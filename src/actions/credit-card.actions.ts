"use server";

import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import { calculateInvoiceTotal, getInvoicePeriod } from "@/lib/creditCardMath";
import type { Prisma } from "@/generated/prisma";
import type { ActionResult } from "@/types";

export interface CreditCardInvoiceData {
  transactions: Prisma.TransactionGetPayload<{ include: { category: true } }>[];
  total: number;
  startDate: Date;
  endDate: Date;
  closingDay: number;
  dueDay: number | null;
}

export async function getCreditCardInvoice(
  accountId: string,
  month: number,
  year: number
): Promise<ActionResult<CreditCardInvoiceData>> {
  try {
    const userId = await getRequiredUserId();
    const account = await db.bankAccount.findFirst({
      where: { id: accountId, userId, type: "CREDIT_CARD" },
    });

    if (!account) {
      return { success: false, error: "Cartão não encontrado." };
    }

    const { startDate, endDate } = getInvoicePeriod(month, year, account.closingDay);

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

    const total = calculateInvoiceTotal(transactions.map((t) => ({ type: t.type, amount: Number(t.amount) })));

    return {
      success: true,
      data: {
        transactions,
        total,
        startDate,
        endDate,
        closingDay: account.closingDay || 1,
        dueDay: account.dueDay,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar fatura:", error);
    return { success: false, error: "Erro ao carregar os dados da fatura." };
  }
}
