"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { familyMemberSchema } from "@/lib/validations";
import { createFamilyMember, updateFamilyMember } from "@/actions/family.actions";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/shared/ColorPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: { id: string; name: string; color: string } | null;
}

export function MemberFormDialog({ open, onOpenChange, member }: MemberFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  type MemberFormValues = z.input<typeof familyMemberSchema>;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(familyMemberSchema),
    defaultValues: { name: "", color: "#6366f1" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: member?.name ?? "",
        color: member?.color ?? "#6366f1",
      });
    }
  }, [open, member, reset]);

  const color = watch("color");

  const onSubmit = async (data: MemberFormValues) => {
    const parsed = familyMemberSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    const input = parsed.data;
    setLoading(true);
    try {
      const res = member
        ? await updateFamilyMember(member.id, input)
        : await createFamilyMember(input);
      if (res.success) {
        toast.success(member ? "Membro atualizado." : "Membro adicionado.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar o membro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? "Editar membro" : "Novo membro"}</DialogTitle>
          <DialogDescription>
            Adicione membros da família para identificar os gastos de cada um.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input placeholder="Ex.: Ana, João..." {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div>
            <Label>Cor de identificação</Label>
            <ColorPicker value={color} onChange={(c) => setValue("color", c)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {member ? "Salvar alterações" : "Adicionar membro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
