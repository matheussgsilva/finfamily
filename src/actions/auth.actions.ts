"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ActionResult } from "@/types";
import { auth } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerUser(data: RegisterInput): Promise<ActionResult<string>> {
  try {
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const { name, email, password } = parsed.data;

    // Verificar se o email já está em uso
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: "Este email já está em uso" };
    }

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário, membro da família padrão e conta inicial em transação
    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Criar membro da família titular
      await tx.familyMember.create({
        data: {
          name: name.split(" ")[0] || "Titular",
          color: "#6366f1",
          userId: user.id,
        },
      });

      // Criar conta carteira inicial
      await tx.bankAccount.create({
        data: {
          name: "Carteira",
          type: "WALLET",
          balance: 0,
          color: "#10b981",
          userId: user.id,
        },
      });

      return user;
    });

    return { success: true, data: newUser.id };
  } catch {
    console.error("Erro ao registrar usuário.");
    return { success: false, error: "Erro interno ao registrar usuário. Tente novamente." };
  }
}

export async function getUserSession() {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    console.error("Erro ao recuperar sessão:", error);
    return null;
  }
}
