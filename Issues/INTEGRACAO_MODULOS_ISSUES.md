# 🔗 Diagnóstico de Integração Inter-Módulos (Módulos 1, 2 e 3)
> **Escopo Auditado:** Fluxo de dados transversal entre o **Módulo 1** (*Parcelados, Lançamentos e Cartões*), **Módulo 2** (*Rendas, Primícias e Divisão do Casal*) e **Módulo 3** (*Dashboard, Metas/Checklist e Configurações/Backup*), cobrindo o **Mês Atual (`2026-11`)**, **Meses Passados (`2026-09` e `2026-10`)** e **Meses Futuros (`2026-12` a `2027-08`)**.  
> **Data da Auditoria:** 12/11/2026  
> **Metodologia:** Rastreamento completo da árvore de estado (`state`) em `src/App.jsx` e auditoria lógica/matemática em segundo plano (*Headless*), respeitando a Regra de Ouro #7.  
> **Status:** **✅ TODAS AS 9 FALHAS DE INTEGRAÇÃO CORRIGIDAS E VALIDADAS EM HEADLESS (7/7 Asserções E2E Passaram)**

---

## 📊 Sumário Executivo das Falhas de Integração

| ID | Severidade | Módulos Afetados | Arquivos Principais | Descrição da Falha | Impacto no Mês Atual e Meses Futuros |
|---|---|---|---|---|---|
| **INT-01** | 🔴 Crítico | M1 ↔ M2 ↔ M3 | `src/App.jsx`, `src/data/initialState.js`, `src/components/DashboardView.jsx` | Dupla fonte de verdade desconectada para Salários e Primícias (`tx-inc-*` e `tx-diz-*` ausentes nos meses futuros/passados e sem extra em `2026-11`). | Divergência de **R$ 139,50** no Saldo Livre em `Nov/2026` e de **R$ 1.800,00** entre Dashboard e Divisão do Casal em todos os meses futuros (`Dez/2026+`). |
| **INT-02** | 🔴 Crítico | M2 ↔ M1 ↔ M3 | `src/App.jsx` | Ações em `ExtraIncomeView` (criar, editar, excluir, alternar recebido) e `SettingsView` não atualizam os lançamentos de Dízimo/Salário em `state.transactions`. | Lançamentos de Dízimo na agenda (`TransactionsView`) e `totalExpense` do Dashboard ficam defasados após alterações de renda extra ou configurações. |
| **INT-03** | 🔴 Crítico | M2 ↔ M1 ↔ M3 | `src/components/CoupleSplitView.jsx`, `src/App.jsx` | `jointExpenses` em `CoupleSplitView.jsx` não filtra `t.category !== 'dizimo'`, incluindo a transação de Doação Especial (`tx-don-${ym}`, que tem `owner: 'joint'`). | Doações Especiais são **descontadas 2 vezes** do Saldo Livre na Divisão do Casal e entram indevidamente no rateio de contas domésticas da casa. |
| **INT-04** | 🟠 Alto | M1 ↔ M2 ↔ M3 | `src/App.jsx`, `src/components/DashboardView.jsx`, `src/components/CoupleSplitView.jsx` | Modal `+ Nova Receita` inicia com `category: 'salario'` (ignorada em `adhocIncome`), `CoupleSplitView` ignora receitas `owner: 'joint'` e `handleSaveMonthIncome` sobrescreve receitas avulsas. | Receitas extras lançadas com a categoria padrão somam R$ 0 no Dashboard/Divisão, e salvar Renda do Mês em meses futuros apaga receitas avulsas existentes. |
| **INT-05** | 🟠 Alto | M2 ↔ M3 | `src/components/CoupleSplitView.jsx`, `src/components/ExtraIncomeView.jsx`, `src/App.jsx` | Flag individual `item.applyTitheAndOffering` é ignorada no `CoupleSplitView` e no `App.jsx`; KPI de primícias em `ExtraIncomeView` inclui itens `pending`. | Desmarcar dízimo em uma venda específica funciona no Dashboard, mas continua cobrando dízimo na Divisão do Casal e na Agenda. |
| **INT-06** | 🟠 Alto | M3 ↔ M1 | `src/components/DashboardView.jsx` | `upcomingExpenses` e `recentPaidExpenses` não filtram pelo `selectedMonth`; `cashFlowYear` não acompanha mudança de ano na Sidebar e botões de ano omitem `2028+`. | Ao navegar para `2027-01`, o card "Próximo Vencimento" ainda mostra contas de `Nov/2026` e o gráfico de Fluxo de Caixa fica travado em `2026`. |
| **INT-07** | 🟠 Alto | M1 ↔ M2 ↔ M3 | `src/utils/formatters.js`, `src/App.jsx`, `src/components/CommitmentsView.jsx`, `src/components/CardsView.jsx` | Concatenação direta `${ym}-${dueDay}` sem limitar ao número de dias do mês (`28`, `29` ou `30`). | Cartões com vencimento dia 30 ou 31 geram datas inválidas (`2026-11-31`, `2027-02-30`), fazendo as faturas sumirem do Calendário de Vencimentos. |
| **INT-08** | 🟡 Médio | M1 ↔ M2 | `src/components/CardsView.jsx`, `src/components/TransactionsView.jsx`, `src/components/CommitmentsView.jsx`, `src/App.jsx` | `enrichedCards` sem `ownerFilter` nas dependências; `selectedDay` trava tabela ao mudar de mês; falta seletor `paidBy` p/ PIX/Boleto em `CommitmentsView`; falta trava `installmentPreview.valid` e confirmação de exclusão. | Filtros da Topbar não atualizam cartões; trocar de mês com dia selecionado oculta lançamentos; contas PIX conjuntas sem escolha de pagador. |
| **INT-09** | 🟡 Médio | M3 ↔ M1 ↔ M2 | `src/components/GoalsAndChecklistView.jsx`, `src/App.jsx` | Aportes em Caixinhas (`handleDepositGoal`) atualizam apenas o saldo acumulado da meta, sem opção de registrar o desembolso no fluxo do mês. | O Saldo Livre do mês não reflete os valores que o casal já separou e guardou nas Caixinhas naquele mês. |

---

## 🔍 Detalhamento Técnico de Cada Falha

### 🔴 INT-01: Dupla Fonte de Verdade para Salários e Primícias (Mês Atual e Meses Futuros)
* **Onde ocorre:** [src/data/initialState.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/data/initialState.js#L290-L345), [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L613-L781), [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L103-L175) e [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L58-L113).
* **Diagnóstico:**
  1. Em `2026-11`, `tx-diz-1` (`R$ 975,00`) e `tx-diz-2` (`R$ 825,00`) em `initialState.js` não contemplam os `R$ 139,50` de primícias sobre as rendas extras já recebidas (`ext-1`, `ext-2`, `ext-4`). Por isso, `DashboardView` soma `R$ 1.800,00` de dízimo nas despesas (`Saldo Livre: R$ 5.495,00`), enquanto `CoupleSplitView` e o próprio Banner de Primícias do Dashboard calculam `R$ 1.939,50` (`Saldo Livre: R$ 5.355,50`).
  2. Em **qualquer mês futuro (`2026-12`, `2027-01`...)** ou passado (`2026-09`, `2026-10`), `state.transactions` não possui lançamentos de Salário (`tx-inc-p1-${ym}`, `tx-inc-p2-${ym}`) nem de Dízimo (`tx-diz-p1-${ym}`, `tx-diz-p2-${ym}`). Isso deixa a aba *Receitas* vazia em `TransactionsView` e gera uma diferença de **R$ 1.800,00** entre o Saldo Livre do Dashboard (`R$ 7.520,00` em Dez/2026) e o Saldo Livre da Divisão do Casal (`R$ 5.720,00` em Dez/2026).

### 🔴 INT-02: Mutações em `ExtraIncomeView` e `SettingsView` Não Sincronizam `state.transactions`
* **Onde ocorre:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L325-L369) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L821-L830).
* **Diagnóstico:** A função que sincroniza os lançamentos `tx-inc-p1-${ym}`, `tx-inc-p2-${ym}`, `tx-diz-p1-${ym}`, `tx-diz-p2-${ym}` e `tx-don-${ym}` só roda ao salvar o modal *Renda do Mês*. Ao adicionar/editar/excluir/quitar uma aula particular ou alterar configurações do casal, os lançamentos da agenda não são recalculados.

### 🔴 INT-03: Dupla Contagem de Doações Especiais (`tx-don-${ym}`) em `CoupleSplitView.jsx`
* **Onde ocorre:** [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L80-L82).
* **Diagnóstico:** `jointExpenses` filtra `t.type === 'expense' && t.owner === 'joint'`, sem excluir `t.category !== 'dizimo'`. Como `tx-don-${ym}` tem `owner: 'joint'` e `category: 'dizimo'`, ela é somada em `totalJoint` e também em `totalConsecrated`, duplicando seu desconto no Saldo Livre da Família.

### 🟠 INT-04: Armadilha de Receitas Avulsas (`category: 'salario'`, `owner: 'joint'` e Sobrescrita)
* **Onde ocorre:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L170), [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L636-L664) e [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L40-L47).
* **Diagnóstico:**
  1. `+ Nova Receita` inicia com `category: 'salario'`, que é filtrada fora de `adhocIncome` (que deveria ignorar apenas os lançamentos automáticos de salário mensal `id.startsWith('tx-inc-')`, e não lançamentos manuais do usuário).
  2. `CoupleSplitView` não inclui receitas avulsas com `owner === 'joint'`.
  3. `handleSaveMonthIncome` busca `t.type === 'income' && t.owner === 'partner1'` sem filtrar pelos lançamentos de salário mensal (`tx-inc-p1-${ym}` / `tx-inc-1`), podendo sobrescrever receitas avulsas do parceiro.

### 🟠 INT-05: Unificação da Regra `applyTitheAndOffering` e `includeExtraInTithe`
* **Onde ocorre:** [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L23-L38), [src/components/ExtraIncomeView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/ExtraIncomeView.jsx#L91-L135) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L692-L697).
* **Diagnóstico:** `CoupleSplitView` e `App.jsx` devem verificar `i.applyTitheAndOffering !== false && i.status === 'received'` ao calcular a base de dízimo da renda extra, exatamente como `DashboardView`. Em `ExtraIncomeView`, o KPI de primícias deve refletir `couple.includeExtraInTithe` e destacar o valor sobre o recebido vs. previsto.

### 🟠 INT-06: Listas de Vencimentos e Ano do Fluxo de Caixa no `DashboardView.jsx`
* **Onde ocorre:** [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L31), [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L188-L202) e [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L673).
* **Diagnóstico:**
  1. `upcomingExpenses` e `recentPaidExpenses` devem filtrar `monthExpenses` (os lançamentos do `selectedMonth` ativo) para que o card *Próximo Vencimento*, *Próximas Contas a Pagar* e *Últimos Pagamentos* reflitam o mês selecionado na Sidebar.
  2. `cashFlowYear` deve sincronizar automaticamente com `selectedMonth.split('-')[0]` via `useEffect` e oferecer dinamicamente todos os anos que possuem lançamentos (`2026`, `2027`, `2028`...).

### 🟠 INT-07: Clamp Seguro de Datas (`clampDayToMonth`) para Cartões com Vencimento Dia 29, 30 ou 31
* **Onde ocorre:** [src/utils/formatters.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/utils/formatters.js), [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx), [src/components/CommitmentsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CommitmentsView.jsx) e [src/components/CardsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CardsView.jsx).
* **Diagnóstico:** Criar helper `buildSafeDueDate(yearMonth, day)` em `formatters.js` que limita `day` ao máximo de dias reais do mês (`new Date(year, month, 0).getDate()`), impedindo datas inválidas como `2026-11-31` ou `2027-02-30`.

### 🟡 INT-08: Correções de Estado, Filtros e Validações no Módulo 1
* **Onde ocorre:** [src/components/CardsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CardsView.jsx), [src/components/TransactionsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/TransactionsView.jsx), [src/components/CommitmentsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CommitmentsView.jsx) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx).
* **Diagnóstico:**
  1. Adicionar `ownerFilter` e `filteredCards` às dependências do `useMemo` de `enrichedCards` em `CardsView.jsx` e derivar a fatura aberta pelo `selectedCardInvoiceId`.
  2. Atualizar `paidBy` nas transações pendentes quando o `owner` do cartão for alterado em `handleUpdateCard`.
  3. Limpar `selectedDay` automaticamente em `TransactionsView.jsx` quando `selectedMonth` mudar, e incluir `INCOME_CATEGORIES` no filtro de categorias.
  4. Em `CommitmentsView.jsx`: sincronizar `form.startDate` quando `selectedMonth` mudar; exibir seletor `Quem Paga (paidBy)` quando o meio for PIX/Boleto/Débito; bloquear submissão se `!installmentPreview.valid` (entrada $\ge$ total); e adicionar confirmação (`window.confirm`) ao excluir parcelamentos ou lançamentos.

### 🟡 INT-09: Integração Opcional de Aportes nas Caixinhas com o Fluxo do Mês
* **Onde ocorre:** [src/components/GoalsAndChecklistView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/GoalsAndChecklistView.jsx#L126-L133) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L565-L575).
* **Diagnóstico:** No modal `+ Guardar Valor na Caixinha`, adicionar um checkbox marcado por padrão (*"Registrar este aporte nos lançamentos do mês para atualizar o Saldo Livre"*) que cria o lançamento correspondente em `state.transactions` no `selectedMonth`.

---

## ✅ Validação Automatizada em Segundo Plano (Headless) — 12/11/2026

Todos os 9 pontos de integração foram corrigidos e validados via suíte automatizada em Node.js (`audit_integracao_headless.mjs`) e build de produção (`vite build`):

1. **`[PASS]` INT-01 & INT-02:** `syncMonthIncomeAndTitheTransactions` mantém `tx-inc-p1-${ym}`, `tx-inc-p2-${ym}`, `tx-diz-p1-${ym}`, `tx-diz-p2-${ym}` e `tx-don-${ym}` 100% sincronizados. `DashboardView` e `CoupleSplitView` exibem exatamente o mesmo **Saldo Livre Previsto** em `2026-10`, `2026-11` (`R$ 5.355,50`), `2026-12` (`R$ 5.720,00`), `2027-01` e `2027-02`.
2. **`[PASS]` INT-02 & INT-03:** Doações Especiais (`donationAmount`) geram `tx-don-${ym}` e são filtradas de `jointExpenses` em `CoupleSplitView.jsx` (`t.category !== 'dizimo'`), eliminando a dupla dedução. Além disso, alterações em `SettingsView` propagam para `monthlyIncomes[selectedMonth]`.
3. **`[PASS]` INT-04:** Receitas avulsas criadas em `+ Nova Receita` iniciam com `category: 'extra'`, usam `isAutoSalaryTransaction(tx)` para não colidirem com o salário mensal automático e contemplam `owner: 'joint'` (50/50) na Divisão do Casal.
4. **`[PASS]` INT-05:** A flag individual `applyTitheAndOffering` é respeitada de forma unificada em `DashboardView`, `CoupleSplitView`, `ExtraIncomeView` e `syncMonthIncomeAndTitheTransactions`.
5. **`[PASS]` INT-06:** `DashboardView` filtra `upcomingExpenses` e `recentPaidExpenses` pelo `selectedMonth` ativo, sincroniza `cashFlowYear` automaticamente ao navegar entre anos e gera botões de ano dinâmicos (`2026`, `2027`, `2028`...).
6. **`[PASS]` INT-07:** `buildSafeDueDate(yearMonth, day)` limita dias `29`, `30` e `31` ao último dia real do mês (`2026-11-30`, `2027-02-28`, `2028-02-29`), evitando faturas invisíveis no Calendário de Vencimentos.
7. **`[PASS]` INT-08 & INT-09:** Filtros, seletores `paidBy` para PIX/Boleto, limpeza automática de `selectedDay`, trava `installmentPreview.valid`, confirmação de exclusão (`window.confirm`) e registro opcional de aportes das Caixinhas no fluxo do mês implementados com zero erros de compilação.


