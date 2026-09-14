"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PrivacyProvider } from "./PrivacyContext";
import { generateDueRecurringTransactions } from "@/actions/recurrence.actions";

interface AppLayoutClientProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppLayoutClient({ children, user }: AppLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    generateDueRecurringTransactions()
      .then(({ createdCount, budgetAlerts }) => {
        if (createdCount > 0) {
          toast.success(
            createdCount === 1
              ? "1 transação recorrente foi lançada."
              : `${createdCount} transações recorrentes foram lançadas.`
          );
          router.refresh();
        }
        for (const alert of budgetAlerts) {
          toast.warning(alert, { duration: 6000 });
        }
      })
      .catch(() => {
        // Falha silenciosa: não é crítico bloquear o app por causa disso.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PrivacyProvider>
      <div className="flex h-screen overflow-hidden bg-[#030712] font-sans antialiased text-zinc-100">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
        />

        {/* Área de Conteúdo */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Topbar */}
          <Topbar
            onMenuClick={() => setSidebarOpen(true)}
            user={user}
          />

          {/* Área Principal de Scroll */}
          <main className="flex-1 overflow-y-auto bg-[#030712] relative">
            {/* Gradientes de fundo sutis */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

            <div className="p-6 max-w-7xl mx-auto w-full relative z-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PrivacyProvider>
  );
}
