"use server";

import { auth } from "@/lib/auth";

export async function getUserSession() {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    console.error("Erro ao recuperar sessão:", error);
    return null;
  }
}
