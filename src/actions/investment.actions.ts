"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  investmentSchema,
  operationSchema,
  proventoSchema,
  type InvestmentInput,
  type OperationInput,
  type ProventoInput,
} from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";

// ─────────────────────────────────────────────────────────────
// Ativos
// ─────────────────────────────────────────────────────────────
export async function createInvestment(input: InvestmentInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = investmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    if (data.ticker) {
      const existing = await db.investment.findFirst({
        where: { ticker: data.ticker, userId },
      });
      if (existing) {
        return { success: false, error: "Já existe um ativo com este ticker." };
      }
    }

    await db.investment.create({
      data: {
        ticker: data.ticker || null,
        name: data.name,
        assetClass: data.assetClass,
        quantity: data.quantity,
        avgPrice: data.avgPrice,
        currentPrice: data.currentPrice ?? null,
        targetAlloc: data.targetAlloc ?? null,
        userId,
      },
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar ativo:", error);
    return { success: false, error: "Erro interno ao criar o ativo." };
  }
}

export async function updateInvestment(
  id: string,
  input: InvestmentInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = investmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const existing = await db.investment.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Ativo não encontrado." };
    }

    if (data.ticker) {
      const dup = await db.investment.findFirst({
        where: { ticker: data.ticker, userId, NOT: { id } },
      });
      if (dup) {
        return { success: false, error: "Já existe um ativo com este ticker." };
      }
    }

    await db.investment.update({
      where: { id },
      data: {
        ticker: data.ticker || null,
        name: data.name,
        assetClass: data.assetClass,
        quantity: data.quantity,
        avgPrice: data.avgPrice,
        currentPrice: data.currentPrice ?? null,
        targetAlloc: data.targetAlloc ?? null,
      },
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar ativo:", error);
    return { success: false, error: "Erro interno ao atualizar o ativo." };
  }
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.investment.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Ativo não encontrado." };
    }

    await db.investment.delete({ where: { id } });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir ativo:", error);
    return { success: false, error: "Erro interno ao excluir o ativo." };
  }
}

// ─────────────────────────────────────────────────────────────
// Operações (Compra / Venda)
// ─────────────────────────────────────────────────────────────
export async function createOperation(
  investmentId: string,
  input: OperationInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = operationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const investment = await db.investment.findFirst({
      where: { id: investmentId, userId },
    });
    if (!investment) {
      return { success: false, error: "Ativo não encontrado." };
    }

    const total = Number((data.quantity * data.price + data.fees).toFixed(2));

    await db.$transaction(async (tx) => {
      await tx.investOperation.create({
        data: {
          type: data.type,
          quantity: data.quantity,
          price: data.price,
          fees: data.fees,
          total,
          date: data.date,
          notes: data.notes ?? null,
          investmentId,
        },
      });

      const currentQty = Number(investment.quantity);
      const currentAvg = Number(investment.avgPrice);
      const qty = Number(data.quantity);
      const price = Number(data.price);

      let newQty: number;
      let newAvg: number;

      if (data.type === "BUY") {
        newQty = currentQty + qty;
        const costTotal = currentQty * currentAvg + qty * price + Number(data.fees);
        newAvg = newQty > 0 ? costTotal / newQty : 0;
      } else {
        if (qty > currentQty) {
          throw new Error("Quantidade de venda maior que a posição atual.");
        }
        newQty = currentQty - qty;
        newAvg = currentAvg;
      }

      await tx.investment.update({
        where: { id: investmentId },
        data: {
          quantity: newQty,
          avgPrice: newAvg,
        },
      });
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao registrar operação:", error);
    if (error instanceof Error && error.message === "Quantidade de venda maior que a posição atual.") {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erro interno ao registrar a operação." };
  }
}

export async function deleteOperation(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const op = await db.investOperation.findFirst({
      where: { id, investment: { userId } },
    });
    if (!op) {
      return { success: false, error: "Operação não encontrada." };
    }

    const investment = await db.investment.findUnique({
      where: { id: op.investmentId },
    });
    if (!investment) {
      return { success: false, error: "Ativo não encontrado." };
    }

    await db.$transaction(async (tx) => {
      const currentQty = Number(investment.quantity);
      const currentAvg = Number(investment.avgPrice);
      const qty = Number(op.quantity);
      const price = Number(op.price);

      let newQty: number;
      let newAvg: number;

      if (op.type === "BUY") {
        newQty = currentQty - qty;
        const totalInvested = currentQty * currentAvg;
        const removedValue = qty * currentAvg;
        newAvg = newQty > 0 ? (totalInvested - removedValue) / newQty : 0;
      } else {
        newQty = currentQty + qty;
        newAvg = currentAvg;
      }

      await tx.investment.update({
        where: { id: op.investmentId },
        data: { quantity: newQty, avgPrice: newAvg },
      });

      await tx.investOperation.delete({ where: { id } });
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir operação:", error);
    return { success: false, error: "Erro interno ao excluir a operação." };
  }
}

// ─────────────────────────────────────────────────────────────
// Proventos
// ─────────────────────────────────────────────────────────────
export async function createProvento(
  investmentId: string,
  input: ProventoInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = proventoSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const investment = await db.investment.findFirst({
      where: { id: investmentId, userId },
    });
    if (!investment) {
      return { success: false, error: "Ativo não encontrado." };
    }

    await db.provento.create({
      data: {
        type: data.type,
        amount: data.amount,
        paymentDate: data.paymentDate,
        referenceDate: data.referenceDate ?? null,
        notes: data.notes ?? null,
        investmentId,
      },
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar provento:", error);
    return { success: false, error: "Erro interno ao criar o provento." };
  }
}

export async function deleteProvento(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.provento.findFirst({
      where: { id, investment: { userId } },
    });
    if (!existing) {
      return { success: false, error: "Provento não encontrado." };
    }

    await db.provento.delete({ where: { id } });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir provento:", error);
    return { success: false, error: "Erro interno ao excluir o provento." };
  }
}
