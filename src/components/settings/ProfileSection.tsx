"use client";

import React, { useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, updatePassword, deleteAccount } from "@/actions/user.actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { signOut } from "next-auth/react";

interface ProfileSectionProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [name, setName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMsg({ type: "", text: "" });

    const res = await updateProfile(name);
    if (res.success) {
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso." });
    } else {
      setProfileMsg({ type: "error", text: res.error || "Erro ao atualizar." });
    }
    setLoadingProfile(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPassword(true);
    setPasswordMsg({ type: "", text: "" });

    const res = await updatePassword({ currentPassword, newPassword });
    if (res.success) {
      setPasswordMsg({ type: "success", text: "Senha atualizada com sucesso." });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPasswordMsg({ type: "error", text: res.error || "Erro ao atualizar senha." });
    }
    setLoadingPassword(false);
  };

  const handleDeleteAccount = async () => {
    const res = await deleteAccount();
    if (res.success) {
      signOut({ callbackUrl: "/login" });
    }
    return res;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Informações Básicas */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Informações Pessoais</h2>
            <p className="text-sm text-zinc-500">Atualize seu nome de exibição</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-zinc-900/50 text-zinc-500 mt-1.5" />
          </div>
          <div>
            <Label htmlFor="name">Nome de Exibição</Label>
            <Input 
              id="name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Seu nome"
              className="mt-1.5"
            />
          </div>

          {profileMsg.text && (
            <p className={`text-sm ${profileMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {profileMsg.text}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loadingProfile || !name.trim()}>
              {loadingProfile ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>

      {/* Alterar Senha */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-100">Alterar Senha</h2>
          <p className="text-sm text-zinc-500">Mantenha sua conta segura utilizando uma senha forte</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Senha Atual</Label>
            <Input 
              id="currentPassword"
              type="password"
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
              placeholder="••••••••"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input 
              id="newPassword"
              type="password"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="Mínimo 6 caracteres"
              className="mt-1.5"
            />
          </div>

          {passwordMsg.text && (
            <p className={`text-sm ${passwordMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {passwordMsg.text}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loadingPassword || !currentPassword || newPassword.length < 6}>
              {loadingPassword ? "Atualizando..." : "Atualizar Senha"}
            </Button>
          </div>
        </form>
      </div>

      {/* Zona de Perigo */}
      <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-6 mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-red-400">Zona de Perigo</h2>
          <p className="text-sm text-zinc-400">Ações irreversíveis para a sua conta e dados.</p>
        </div>
        
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-red-900/20">
          <div>
            <h3 className="font-medium text-zinc-200">Excluir Conta</h3>
            <p className="text-sm text-zinc-500">Isso apagará permanentemente todos os seus dados e registros do sistema.</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Excluir Conta
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Tem certeza absoluta?"
        description="Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta, todas as suas transações, categorias personalizadas e removerá seus dados dos nossos servidores."
        actionLabel="Excluir Permanentemente"
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
