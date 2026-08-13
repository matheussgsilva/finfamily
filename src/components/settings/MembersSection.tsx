"use client";

import React, { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteFamilyMember } from "@/actions/family.actions";
import { MemberFormDialog } from "./MemberFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MemberItem {
  id: string;
  name: string;
  color: string;
}

export function MembersSection({ members }: { members: MemberItem[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemberItem | null>(null);
  const [deleting, setDeleting] = useState<MemberItem | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Membros da Família</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Novo membro
        </Button>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Nenhum membro"
            description="Adicione membros para acompanhar os gastos individuais."
          />
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-zinc-950/40 hover:bg-zinc-900/60 transition group"
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold"
                  style={{ backgroundColor: `${member.color}22`, color: member.color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{member.name}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditing(member);
                      setFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 cursor-pointer"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleting(member)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} member={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir membro"
        description={`Tem certeza que deseja excluir "${deleting?.name}"?`}
        onConfirm={async () => {
          if (!deleting) return { success: false, error: "Membro inválido" };
          const res = await deleteFamilyMember(deleting.id);
          if (res.success) router.refresh();
          return res;
        }}
      />
    </Card>
  );
}
