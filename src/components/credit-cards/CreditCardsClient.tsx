"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCreditCardInvoice } from "@/actions/credit-card.actions";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrivacyValue } from "@/components/shared/PrivacyValue";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreditCardItem {
  id: string;
  name: string;
  color: string;
  closingDay: number | null;
  dueDay: number | null;
}

export function CreditCardsClient({ creditCards }: { creditCards: CreditCardItem[] }) {
  const [selectedCardId, setSelectedCardId] = useState<string>(creditCards[0]?.id || "");
  const [monthOffset, setMonthOffset] = useState(0);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const activeMonth = addMonths(new Date(), monthOffset);
  const month = activeMonth.getMonth() + 1;
  const year = activeMonth.getFullYear();

  useEffect(() => {
    if (!selectedCardId) return;

    let cancelled = false;
    setLoading(true);
    
    getCreditCardInvoice(selectedCardId, month, year)
      .then((res) => {
        if (!cancelled && res.success) {
          setInvoiceData(res.data);
        } else if (!cancelled) {
          setInvoiceData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCardId, month, year]);

  if (creditCards.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState
          icon={<CreditCard size={20} />}
          title="Nenhum cartão de crédito"
          description="Você precisa cadastrar um cartão de crédito em Configurações > Contas para gerenciar faturas."
        />
      </div>
    );
  }

  const selectedCard = creditCards.find((c) => c.id === selectedCardId);

  return (
    <div className="space-y-4">
      {/* Seletores (Cartão e Mês) */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-64">
          <Select value={selectedCardId} onValueChange={setSelectedCardId}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Selecione um cartão" />
            </SelectTrigger>
            <SelectContent>
              {creditCards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-2 w-full sm:flex-1">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-200 capitalize">
              Fatura de {format(activeMonth, "MMMM yyyy", { locale: ptBR })}
            </p>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Voltar para o mês atual
              </button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Resumo da Fatura */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-zinc-500">
          Carregando fatura...
        </div>
      ) : invoiceData ? (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
              <div>
                <p className="text-sm text-zinc-400 mb-1">Total da Fatura</p>
                <PrivacyValue className="text-2xl font-bold text-white">
                  {formatCurrency(invoiceData.total)}
                </PrivacyValue>
                <p className="text-xs text-zinc-500 mt-1">
                  Período: {format(new Date(invoiceData.startDate), "dd/MM/yyyy")} a {format(new Date(invoiceData.endDate), "dd/MM/yyyy")}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-zinc-400 mb-1">Vencimento</p>
                <p className="text-sm font-medium text-zinc-200">
                  {invoiceData.dueDay ? `${invoiceData.dueDay} de ${format(activeMonth, "MMMM", { locale: ptBR })}` : "Não definido"}
                </p>
                <Button size="sm" className="mt-3 w-full sm:w-auto" disabled>
                  Pagar Fatura
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Transações da Fatura */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-[#090d16]/50">
              <h3 className="text-sm font-semibold text-zinc-200">Transações na Fatura</h3>
            </div>
            
            {invoiceData.transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Nenhuma transação registrada nesta fatura.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invoiceData.transactions.map((t: any) => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-xl"
                        style={{ backgroundColor: `${t.category?.color || '#6366f1'}22`, color: t.category?.color || '#6366f1' }}
                      >
                        <CategoryIcon name={t.category?.icon} size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{t.description}</p>
                        <p className="text-xs text-zinc-500">
                          {format(new Date(t.date), "dd/MM/yyyy")} • {t.category?.name || "Sem categoria"}
                          {t.installments ? ` (${t.installmentNum}/${t.installments})` : ""}
                        </p>
                      </div>
                    </div>
                    <PrivacyValue className={`text-sm font-semibold ${t.type === 'INCOME' || t.type === 'TRANSFER' ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {t.type === 'INCOME' || t.type === 'TRANSFER' ? "+" : ""}
                      {formatCurrency(Number(t.amount))}
                    </PrivacyValue>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-zinc-500">
          Não foi possível carregar a fatura.
        </div>
      )}
    </div>
  );
}
