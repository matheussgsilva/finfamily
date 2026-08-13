"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { PrivacyProvider } from "./PrivacyContext";

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
