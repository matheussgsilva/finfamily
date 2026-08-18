import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes CSS de forma segura com suporte ao Tailwind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor decimal para moeda BRL
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

/**
 * Formata um número como percentual
 */
export function formatPercent(value: number | null | undefined, decimals = 2): string {
  const num = value ?? 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num / 100);
}

export function formatDate(date: Date | string | null | undefined, format: "short" | "long" | "month" = "short"): string {
  if (!date) return "—";
  
  // Se for string apenas com "YYYY-MM-DD", o new Date() assume UTC (ex: "2026-08-18" -> "2026-08-18T00:00:00.000Z")
  const d = typeof date === "string" ? new Date(date) : date;

  if (format === "month") {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  }
  if (format === "long") {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(d);
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);
}

/**
 * Retorna a variação percentual entre dois valores
 */
export function calcVariation(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Trunca texto longo com reticências
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Gera uma cor hex aleatória pastéis
 */
export function randomColor(): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444",
    "#f97316", "#eab308", "#22c55e", "#10b981", "#14b8a6",
    "#06b6d4", "#3b82f6", "#a855f7",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Obtém as iniciais de um nome
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Formata número compacto (1.2k, 1.5M)
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
}
