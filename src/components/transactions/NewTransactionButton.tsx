"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "./TransactionFormDialog";
import type { AccountType } from "@/types";

interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string;
}

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  color: string;
}

interface MemberItem {
  id: string;
  name: string;
  color: string;
}

export function NewTransactionButton({
  accounts,
  categories,
  members,
  onSuccess,
}: {
  accounts: AccountItem[];
  categories: CategoryItem[];
  members: MemberItem[];
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        Nova transação
      </Button>
      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        transaction={null}
        accounts={accounts}
        categories={categories}
        members={members}
        onSuccess={onSuccess}
      />
    </>
  );
}

