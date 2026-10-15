import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "transacoes", label: "Transações", href: "/fluxo-de-caixa" },
  { value: "orcamentos", label: "Orçamentos", href: "/fluxo-de-caixa/orcamentos" },
  { value: "cartoes", label: "Faturas", href: "/fluxo-de-caixa/cartoes" },
  { value: "recorrencias", label: "Recorrências", href: "/fluxo-de-caixa/recorrencias" },
  { value: "projecao", label: "Projeção", href: "/fluxo-de-caixa/projecao" },
] as const;

export type CashFlowTab = (typeof TABS)[number]["value"];

/** Abas de navegação das páginas de Fluxo de Caixa (cada aba é uma rota). */
export function CashFlowTabs({ active }: { active: CashFlowTab }) {
  return (
    <Tabs defaultValue={active} className="mb-4">
      <TabsList className="max-w-full overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.value === active ? tab.label : <Link href={tab.href}>{tab.label}</Link>}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
