# Pendências e Funcionalidades Faltantes - FinFamily

Abaixo estão as principais funcionalidades que restam ser implementadas de acordo com o plano original do projeto e com base no que já foi desenvolvido.

## 1. Pagamento de Faturas de Cartão de Crédito
- **Onde estamos:** A visualização das faturas (gastos do mês agrupados por fechamento) já foi concluída na página `/fluxo-de-caixa/cartoes`.
- **O que falta:** Implementar o fluxo de "Pagar Fatura". Quando o usuário fecha o mês, ele precisa de um botão que gere uma transação do tipo `TRANSFER` (Transferência) saindo de uma conta corrente (ex: Nubank Conta) para a conta do cartão de crédito (ex: Nubank Cartão). Isso atualizará o saldo da conta corrente e abaterá a dívida do cartão no sistema.

## 2. Rebalanceamento de Investimentos
- **Onde estamos:** A gestão básica de investimentos existe, mas a inteligência de alocação não está completa.
- **O que falta:** Na aba de investimentos, criar um painel interativo de **Rebalanceamento da Carteira**.
  - Permitir definir o *Target* (Peso Ideal) em porcentagem para cada classe de ativo (ex: 50% Ações, 30% Renda Fixa, 20% Cripto).
  - O sistema deve comparar a alocação *Atual* com o *Target* e recomendar automaticamente onde o usuário deve investir o próximo aporte para balancear a carteira (ex: "Aporte sugerido: R$ 500 em Renda Fixa").

## 3. Exportação de Relatórios
- **Onde estamos:** O dashboard e o fluxo de caixa mostram tabelas e gráficos, mas os dados estão "presos" na plataforma.
- **O que falta:** Implementar uma funcionalidade de **Exportação (CSV / Excel / PDF)**.
  - No Fluxo de Caixa, adicionar um botão de "Exportar".
  - Chamar uma Server Route (ex: `route.ts` API do Next.js) que busque as transações filtradas do mês e gere um arquivo CSV estruturado para download.

## 4. Atualização de Cotações (Opcional/Avançado)
- **Onde estamos:** Os investimentos dependem de atualização manual do `currentPrice` (preço atual).
- **O que falta:** Uma rotina ou botão para buscar automaticamente a cotação de Tickers (ex: BOVA11, PETR4) integrando uma API pública gratuita (como a da Brapi ou Yahoo Finance), atualizando os valores do portfólio em tempo real.
