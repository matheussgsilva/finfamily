import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppLayoutClient } from "@/components/shared/AppLayoutClient";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  return (
    <AppLayoutClient user={session.user}>
      {children}
    </AppLayoutClient>
  );
}
