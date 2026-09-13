"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  investmentSchema,
  operationSchema,
  proventoSchema,
  type InvestmentInput,
  type OperationInput,
  type ProventoInput,
} from "@/lib/validations";
import { fetchPriceForAsset } from "@/lib/marketData";
import { applyOperation, revertOperation } from "@/lib/investmentMath";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult, AssetClass } from "@/types";

const priceUpdateSchema = z.object({
  id: z.string().min(1, "Ativo inválido"),
  price: z.coerce.number().positive("Preço deve ser maior que zero"),
});

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

      const newPosition = applyOperation(
        { quantity: Number(investment.quantity), avgPrice: Number(investment.avgPrice) },
        { type: data.type, quantity: Number(data.quantity), price: Number(data.price), fees: Number(data.fees) }
      );

      await tx.investment.update({
        where: { id: investmentId },
        data: {
          quantity: newPosition.quantity,
          avgPrice: newPosition.avgPrice,
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
      const newPosition = revertOperation(
        { quantity: Number(investment.quantity), avgPrice: Number(investment.avgPrice) },
        { type: op.type, quantity: Number(op.quantity) }
      );

      await tx.investment.update({
        where: { id: op.investmentId },
        data: { quantity: newPosition.quantity, avgPrice: newPosition.avgPrice },
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

// ─────────────────────────────────────────────────────────────
// Atualização de preços (manual + API)
// ─────────────────────────────────────────────────────────────
export interface PriceFetchItem {
  id: string;
  ticker: string | null;
  assetClass: AssetClass;
}

export type PriceFetchResult =
  | { id: string; status: "ok"; symbol: string; price: number; currency: string }
  | { id: string; status: "no-ticker"; symbol: null; price: null; currency: null }
  | { id: string; status: "error"; symbol: null; price: null; currency: null };

export async function fetchInvestmentPrices(
  assets: PriceFetchItem[]
): Promise<ActionResult<PriceFetchResult[]>> {
  try {
    const userId = await getRequiredUserId();
    if (!Array.isArray(assets) || assets.length === 0) {
      return { success: false, error: "Nenhum ativo informado." };
    }

    const owned = await db.investment.findMany({
      where: { id: { in: assets.map((a) => a.id) }, userId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));

    const results = await Promise.all(
      assets
        .filter((asset) => ownedIds.has(asset.id))
        .map(async (asset): Promise<PriceFetchResult> => {
          if (!asset.ticker) {
            return { id: asset.id, status: "no-ticker", symbol: null, price: null, currency: null };
          }
          const quote = await fetchPriceForAsset(asset.ticker, asset.assetClass);
          if (!quote) {
            return { id: asset.id, status: "error", symbol: null, price: null, currency: null };
          }
          return {
            id: asset.id,
            status: "ok",
            symbol: quote.symbol,
            price: Number(quote.price.toFixed(6)),
            currency: quote.currency,
          };
        })
    );

    return { success: true, data: results };
  } catch (error) {
    console.error("Erro ao buscar preços:", error);
    return { success: false, error: "Erro interno ao buscar os preços." };
  }
}

export async function updateInvestmentPrices(
  input: { id: string; price: number }[]
): Promise<ActionResult<{ updated: number }>> {
  try {
    const userId = await getRequiredUserId();
    if (!Array.isArray(input) || input.length === 0) {
      return { success: false, error: "Nenhum preço para atualizar." };
    }

    const entries: { id: string; price: number }[] = [];
    for (const item of input) {
      const parsed = priceUpdateSchema.safeParse(item);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
      }
      entries.push(parsed.data);
    }

    const ids = [...new Set(entries.map((e) => e.id))];
    const owned = await db.investment.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));
    const valid = entries.filter((e) => ownedIds.has(e.id));
    if (valid.length === 0) {
      return { success: false, error: "Ativos não encontrados." };
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      for (const entry of valid) {
        await tx.investment.update({
          where: { id: entry.id },
          data: { currentPrice: entry.price, priceUpdatedAt: now },
        });
        await tx.investmentPriceHistory.create({
          data: { investmentId: entry.id, price: entry.price, date: now },
        });
      }
    });

    revalidatePath("/investimentos");
    revalidatePath("/dashboard");
    return { success: true, data: { updated: valid.length } };
  } catch (error) {
    console.error("Erro ao atualizar preços:", error);
    return { success: false, error: "Erro interno ao atualizar os preços." };
  }
}
