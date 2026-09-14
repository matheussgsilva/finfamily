"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel?: string;
  icon?: React.ReactNode;
  variant?: "destructive" | "default";
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel = "Excluir",
  icon,
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await onConfirm();
      if (res.success) {
        toast.success("Operação concluída com sucesso.");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Erro ao executar a operação.");
      }
    } catch {
      toast.error("Erro interno ao executar a operação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", variant === "destructive" ? "text-red-400" : "text-zinc-200")}>
            {icon ?? <Trash2 size={18} />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
