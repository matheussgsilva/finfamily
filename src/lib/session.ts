import "server-only";
import { auth } from "@/lib/auth";

/**
 * Retorna o ID do usuário autenticado ou lança erro se não autenticado.
 * Deve ser usado apenas em Server Actions e Server Components.
 */
export async function getRequiredUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Não autenticado");
  }
  return userId;
}

/**
 * Retorna o ID do usuário autenticado ou null.
 */
export async function getOptionalUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
