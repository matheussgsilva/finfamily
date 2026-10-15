# Pendências e Funcionalidades Faltantes - FinFamily

Abaixo estão as principais funcionalidades que restam ser implementadas de acordo com o plano original do projeto e com base no que já foi desenvolvido.

## 1. Pagamento de Faturas de Cartão de Crédito ✅ Concluído
- O botão **Pagar Fatura** em `/fluxo-de-caixa/cartoes` gera uma transação `TRANSFER` da conta escolhida para o cartão (pagamento total ou parcial).
- Regra: um pagamento abate a fatura do mês X quando a data cai entre o dia seguinte ao fechamento de X e o fechamento seguinte (`getInvoicePaymentPeriod` em `src/lib/creditCardMath.ts`). A tela mostra Total, Pago e Em aberto.

## 2. Rebalanceamento de Investimentos ✅ Concluído
- Metas por classe em **Investimentos → Onde aportar → Definir metas** (somam 100%), e "Peso na classe (%)" opcional em cada ativo.
- O card **Onde aportar** divide o valor do aporte entre o que está abaixo da meta (sem vendas), até o ativo, com cotas inteiras para Ações/FIIs.

## 3. Exportação de Relatórios ✅ Concluído
- **Fluxo de Caixa → Exportar**: período (mês exibido, ano ou intervalo) e, opcionalmente, os filtros da tela.
  - **CSV** (`/api/export/transacoes`) no formato do Excel pt-BR (";", vírgula decimal, acentos).
  - **Relatório** (`/relatorio/transacoes`) com resumo, totais por categoria e lançamentos, pronto para "Imprimir → Salvar como PDF".
- **Configurações → Perfil → Backup dos dados**: JSON com todos os dados do usuário (sem a senha). Restaurar a partir do backup ainda não existe.

## 4. Atualização de Cotações ✅ Concluído
- O botão "Atualizar preços" busca as cotações no Yahoo Finance; preços em outra moeda (cripto, internacionais) são convertidos para BRL pelo câmbio do momento, e a tela mostra a cotação original e o câmbio usado.
- Ainda manual (sem rotina automática agendada).
