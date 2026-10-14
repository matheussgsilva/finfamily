"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeDescription } from "@/lib/categorization";
import { getRequiredUserId } from "@/lib/session";
import { categorizationRuleSchema, type CategorizationRuleInput } from "@/lib/validations";
import type { ActionResult } from "@/types";

/** Valida a regra e a categoria (própria ou global, só receita/despesa). Retorna o erro ou null. */
async function validateRule(userId: string, data: CategorizationRuleInput, ignoreId?: string) {
  if (normalizeDescription(data.pattern).length < 2) {
    return "O padrão precisa ter ao menos 2 letras (números e símbolos são ignorados).";
  }

  const category = await db.category.findFirst({
    where: { id: data.categoryId, OR: [{ userId }, { userId: null }] },
  });
  if (!category) return "Categoria inválida.";

  const duplicate = await db.categorizationRule.findFirst({
    where: {
      userId,
      pattern: data.pattern,
      categoryId: data.categoryId,
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
  });
  if (duplicate) return "Já existe uma regra igual.";

  return null;
}

export async function createRule(input: CategorizationRuleInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = categorizationRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const error = await validateRule(userId, data);
    if (error) return { success: false, error };

    await db.categorizationRule.create({
      data: { pattern: data.pattern, categoryId: data.categoryId, userId },
    });

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar regra:", error);
    return { success: false, error: "Erro interno ao criar a regra." };
  }
}

export async function updateRule(id: string, input: CategorizationRuleInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = categorizationRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const existing = await db.categorizationRule.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Regra não encontrada." };
    }

    const error = await validateRule(userId, data, id);
    if (error) return { success: false, error };

    await db.categorizationRule.update({
      where: { id },
      data: { pattern: data.pattern, categoryId: data.categoryId },
    });

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar regra:", error);
    return { success: false, error: "Erro interno ao atualizar a regra." };
  }
}

export async function deleteRule(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.categorizationRule.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Regra não encontrada." };
    }

    await db.categorizationRule.delete({ where: { id } });

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir regra:", error);
    return { success: false, error: "Erro interno ao excluir a regra." };
  }
}
