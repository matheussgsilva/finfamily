"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequiredUserId } from "@/lib/session";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/types";
import { z } from "zod";

export async function updateProfile(name: string): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();

    if (!name || name.trim().length < 2) {
      return { success: false, error: "O nome deve ter pelo menos 2 caracteres." };
    }

    await db.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return { success: false, error: "Erro interno ao atualizar perfil." };
  }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "A senha atual é obrigatória"),
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});

export async function updatePassword(data: z.infer<typeof passwordSchema>): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();
    const parsed = passwordSchema.safeParse(data);
    
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return { success: false, error: "Usuário não encontrado ou sem senha configurada." };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return { success: false, error: "A senha atual está incorreta." };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar senha:", error);
    return { success: false, error: "Erro interno ao atualizar senha." };
  }
}

export async function deleteAccount(): Promise<ActionResult> {
  try {
    const userId = await getRequiredUserId();

    // The database has cascading deletes set up on relationships to User in schema.prisma 
    // (e.g. onDelete: Cascade for accounts, sessions, categories, transactions, etc.)
    await db.user.delete({
      where: { id: userId },
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    return { success: false, error: "Erro ao excluir conta. Certifique-se de que não existam conflitos de dados." };
  }
}
