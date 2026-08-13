import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-800/60 text-zinc-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
