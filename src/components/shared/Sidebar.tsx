"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, 
  Receipt, 
  TrendingUp, 
  Settings, 
  LogOut, 
  X,
  User as UserIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Fluxo de Caixa", href: "/fluxo-de-caixa", icon: Receipt },
    { label: "Investimentos", href: "/investimentos", icon: TrendingUp },
    { label: "Configurações", href: "/configuracoes", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 border-r border-zinc-800 bg-[#090d16] text-zinc-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header (Logo) */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-zinc-800">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/20">
              <span className="text-base font-bold text-white">F</span>
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              FinFamily
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 lg:hidden focus:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-semibold"
                    : "hover:bg-zinc-800/50 hover:text-zinc-100 border border-transparent"
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "transition-transform group-hover:scale-105 duration-200",
                    isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                />
                {item.label}
                {isActive && (
                  <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer (User info & logout) */}
        <div className="p-4 border-t border-zinc-800 bg-[#070a12]/50">
          <div className="flex items-center gap-3 px-2 py-1 mb-3">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "Avatar"}
                className="w-9 h-9 rounded-full object-cover border border-zinc-700"
              />
            ) : (
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 text-sm font-bold">
                {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={16} />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">
                {user.name || "Membro"}
              </p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-zinc-800 hover:bg-red-950/20 hover:border-red-900/30 hover:text-red-400 text-zinc-400 text-sm font-medium transition cursor-pointer"
          >
            <LogOut size={16} />
            Sair do App
          </button>
        </div>
      </aside>
    </>
  );
}
