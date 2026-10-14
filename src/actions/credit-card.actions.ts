"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import { getInvoicePaymentPeriod } from "@/lib/creditCardMath";
import { invoicePaymentSchema, type InvoicePaymentInput } from "@/lib/validations";
import type { ActionResult } from "@/types";

/**
 * Paga (total ou parcialmente) a fatura do mês/ano informado criando uma
 * transferência da conta de origem para o cartão. A data precisa cair na
 * janela de pagamento da fatura — a mesma regra usada em getCreditCardInvoice —
 * para que o pagamento abata exatamente esta fatura.
 */
export async function payCreditCardInvoice(input: InvoicePaymentInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = invoicePaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const [card, source] = await Promise.all([
      db.bankAccount.findFirst({ where: { id: data.cardId, userId, type: "CREDIT_CARD" } }),
      db.bankAccount.findFirst({
        where: { id: data.sourceAccountId, userId, type: { not: "CREDIT_CARD" } },
      }),
    ]);
    if (!card) {
      return { success: false, error: "Cartão não encontrado." };
    }
    if (!source) {
      return { success: false, error: "Conta de origem inválida." };
    }

    // Meio-dia no fuso do servidor: o mesmo referencial de getInvoicePaymentPeriod,
    // então o dia escolhido nunca escorrega para a fatura vizinha.
    const [y, m, d] = data.date.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    const window = getInvoicePaymentPeriod(data.month, data.year, card.closingDay);
    if (Number.isNaN(date.getTime()) || date < window.startDate || date > window.endDate) {
      return {
        success: false,
        error: `Para abater esta fatura, o pagamento deve ser entre ${format(
          window.startDate,
          "dd/MM/yyyy"
        )} e ${format(window.endDate, "dd/MM/yyyy")}.`,
      };
    }

    const reference = `${String(data.month).padStart(2, "0")}/${data.year}`;
    await db.transaction.create({
      data: {
        description: `Pagamento fatura ${card.name} ${reference}`,
        amount: data.amount,
        type: "TRANSFER",
        date,
        bankAccountId: source.id,
        destinationAccountId: card.id,
        categoryId: null,
        userId,
      },
    });

    revalidatePath("/fluxo-de-caixa/cartoes");
    revalidatePath("/fluxo-de-caixa");
    revalidatePath("/dashboard");
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao pagar fatura:", error);
    return { success: false, error: "Erro interno ao registrar o pagamento." };
  }
}
