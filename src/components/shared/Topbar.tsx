"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu, Eye, EyeOff, User as UserIcon } from "lucide-react";
import { usePrivacy } from "./PrivacyContext";

interface TopbarProps {
  onMenuClick: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Topbar({ onMenuClick, user }: TopbarProps) {
  const pathname = usePathname();
  const { isPrivate, togglePrivacy } = usePrivacy();

  // Determinar o título da página atual
  const getPageTitle = () => {
    if (pathname.startsWith("/dashboard")) return "Painel Geral";
    if (pathname.startsWith("/fluxo-de-caixa")) return "Fluxo de Caixa";
    if (pathname.startsWith("/investimentos")) return "Investimentos";
    if (pathname.startsWith("/configuracoes")) return "Configurações";
    return "FinFamily";
  };

  return (
    <header className="h-16 px-6 border-b border-zinc-800 bg-[#090d16]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      {/* Lado Esquerdo: Menu Hamburguer (Mobile) & Título */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 lg:hidden focus:outline-none"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-lg font-bold text-white tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      {/* Lado Direito: Modo Privacidade & Avatar */}
      <div className="flex items-center gap-4">
        {/* Toggle de Modo Privacidade */}
        <button
          onClick={togglePrivacy}
          className="flex items-center justify-center p-2 rounded-xl border border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800/80 transition-all duration-200 cursor-pointer"
          title={isPrivate ? "Mostrar valores" : "Ocultar valores (Modo Privacidade)"}
        >
          {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || "Avatar"}
              className="w-8 h-8 rounded-full object-cover border border-zinc-700"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold">
              {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={14} />}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
