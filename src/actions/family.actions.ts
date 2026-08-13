"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { familyMemberSchema, type FamilyMemberInput } from "@/lib/validations";
import { getRequiredUserId } from "@/lib/session";
import type { ActionResult } from "@/types";

export async function createFamilyMember(input: FamilyMemberInput): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = familyMemberSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    await db.familyMember.create({
      data: {
        name: data.name,
        color: data.color,
        userId,
      },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar membro:", error);
    return { success: false, error: "Erro interno ao criar o membro." };
  }
}

export async function updateFamilyMember(
  id: string,
  input: FamilyMemberInput
): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = familyMemberSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const data = parsed.data;

    const existing = await db.familyMember.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Membro não encontrado." };
    }

    await db.familyMember.update({
      where: { id },
      data: { name: data.name, color: data.color },
    });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar membro:", error);
    return { success: false, error: "Erro interno ao atualizar o membro." };
  }
}

export async function deleteFamilyMember(id: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const existing = await db.familyMember.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false, error: "Membro não encontrado." };
    }

    const txCount = await db.transaction.count({ where: { familyMemberId: id } });
    if (txCount > 0) {
      return {
        success: false,
        error: "Este membro possui transações vinculadas. Exclua-as primeiro.",
      };
    }

    await db.familyMember.delete({ where: { id } });

    revalidatePath("/configuracoes");
    revalidatePath("/fluxo-de-caixa");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir membro:", error);
    return { success: false, error: "Erro interno ao excluir o membro." };
  }
}
