# 🔗 Diagnóstico de Integração Inter-Módulos (Módulos 1, 2, 3 e 4)
> **Escopo Auditado:** Fluxo de dados transversal entre o **Módulo 1** (*Parcelados, Lançamentos e Cartões*), **Módulo 2** (*Rendas, Primícias e Divisão do Casal*), **Módulo 3** (*Dashboard, Metas/Checklist e Projeções*) e **Módulo 4** (*Configurações, Central de Backup, Supabase Cloud e PWA*), cobrindo o **Mês Atual (`2026-11`)**, **Meses Passados (`2026-09` e `2026-10`)** e **Meses Futuros (`2026-12` a `2027-08`)**.  
> **Data da Auditoria:** 12/11/2026  
> **Metodologia:** Rastreamento completo da árvore de estado (`state`) em `src/App.jsx` e auditoria lógica/matemática em segundo plano (*Headless*), respeitando a Regra de Ouro #7.  
> **Status v1.0:** **✅ TODAS AS 9 FALHAS DE INTEGRAÇÃO CORRIGIDAS E VALIDADAS EM HEADLESS (7/7 Asserções)**  
> **Status v2.0:** **✅ 2 INCONSISTÊNCIAS IDENTIFICADAS E CORRIGIDAS (16/16 Asserções E2E Passaram)**

---

## 📊 Sumário Executivo das Falhas de Integração (v1.0 & v2.0)

| ID | Severidade | Módulos Afetados | Arquivos Principais | Descrição da Falha | Impacto no Sistema | Status |
|---|---|---|---|---|---|---|
| **INT-01** | 🔴 Crítico | M1 ↔ M2 ↔ M3 | `src/App.jsx`, `src/data/initialState.js`, `src/components/DashboardView.jsx` | Dupla fonte de verdade desconectada para Salários e Primícias (`tx-inc-*` e `tx-diz-*` ausentes nos meses futuros/passados e sem extra em `2026-11`). | Divergência de **R$ 139,50** no Saldo Livre em `Nov/2026` e de **R$ 1.800,00** entre Dashboard e Divisão do Casal em todos os meses futuros (`Dez/2026+`). | ✅ **Resolvido** |
| **INT-02** | 🔴 Crítico | M2 ↔ M1 ↔ M3 | `src/App.jsx` | Ações em `ExtraIncomeView` (criar, editar, excluir, alternar recebido) e `SettingsView` não atualizam os lançamentos de Dízimo/Salário em `state.transactions`. | Lançamentos de Dízimo na agenda (`TransactionsView`) e `totalExpense` do Dashboard ficam defasados após alterações de renda extra ou configurações. | ✅ **Resolvido** |
| **INT-03** | 🔴 Crítico | M2 ↔ M1 ↔ M3 | `src/components/CoupleSplitView.jsx`, `src/App.jsx` | `jointExpenses` em `CoupleSplitView.jsx` não filtra `t.category !== 'dizimo'`, incluindo a transação de Doação Especial (`tx-don-${ym}`, que tem `owner: 'joint'`). | Doações Especiais são **descontadas 2 vezes** do Saldo Livre na Divisão do Casal e entram indevidamente no rateio de contas domésticas da casa. | ✅ **Resolvido** |
| **INT-04** | 🟠 Alto | M1 ↔ M2 ↔ M3 | `src/App.jsx`, `src/components/DashboardView.jsx`, `src/components/CoupleSplitView.jsx` | Modal `+ Nova Receita` inicia com `category: 'salario'` (ignorada em `adhocIncome`), `CoupleSplitView` ignora receitas `owner: 'joint'` e `handleSaveMonthIncome` sobrescreve receitas avulsas. | Receitas extras lançadas com a categoria padrão somam R$ 0 no Dashboard/Divisão, e salvar Renda do Mês em meses futuros apaga receitas avulsas existentes. | ✅ **Resolvido** |
| **INT-05** | 🟠 Alto | M2 ↔ M3 | `src/components/CoupleSplitView.jsx`, `src/components/ExtraIncomeView.jsx`, `src/App.jsx` | Flag individual `item.applyTitheAndOffering` é ignorada no `CoupleSplitView` e no `App.jsx`; KPI de primícias em `ExtraIncomeView` inclui itens `pending`. | Desmarcar dízimo em uma venda específica funciona no Dashboard, mas continua cobrando dízimo na Divisão do Casal e na Agenda. | ✅ **Resolvido** |
| **INT-06** | 🟠 Alto | M3 ↔ M1 | `src/components/DashboardView.jsx` | `upcomingExpenses` e `recentPaidExpenses` não filtram pelo `selectedMonth`; `cashFlowYear` não acompanha mudança de ano na Sidebar e botões de ano omitem `2028+`. | Ao navegar para `2027-01`, o card "Próximo Vencimento" ainda mostra contas de `Nov/2026` e o gráfico de Fluxo de Caixa fica travado em `2026`. | ✅ **Resolvido** |
| **INT-07** | 🟠 Alto | M1 ↔ M2 ↔ M3 | `src/utils/formatters.js`, `src/App.jsx`, `src/components/CommitmentsView.jsx`, `src/components/CardsView.jsx` | Concatenação direta `${ym}-${dueDay}` sem limitar ao número de dias do mês (`28`, `29` ou `30`). | Cartões com vencimento dia 30 ou 31 geram datas inválidas (`2026-11-31`, `2027-02-30`), fazendo as faturas sumirem do Calendário de Vencimentos. | ✅ **Resolvido** |
| **INT-08** | 🟡 Médio | M1 ↔ M2 | `src/components/CardsView.jsx`, `src/components/TransactionsView.jsx`, `src/components/CommitmentsView.jsx`, `src/App.jsx` | `enrichedCards` sem `ownerFilter` nas dependências; `selectedDay` trava tabela ao mudar de mês; falta seletor `paidBy` p/ PIX/Boleto em `CommitmentsView`; falta trava `installmentPreview.valid` e confirmação de exclusão. | Filtros da Topbar não atualizam cartões; trocar de mês com dia selecionado oculta lançamentos; contas PIX conjuntas sem escolha de pagador. | ✅ **Resolvido** |
| **INT-09** | 🟡 Médio | M3 ↔ M1 ↔ M2 | `src/components/GoalsAndChecklistView.jsx`, `src/App.jsx` | Aportes em Caixinhas (`handleDepositGoal`) atualizam apenas o saldo acumulado da meta, sem opção de registrar o desembolso no fluxo do mês. | O Saldo Livre do mês não reflete os valores que o casal já separou e guardou nas Caixinhas naquele mês. | ✅ **Resolvido** |
| **ISSUE-INT-V2-01** | 🟡 Médio | M3 ↔ M1 | `src/App.jsx` (`handleDepositGoal`) | Substring `"casa"` gerava match acidental com a palavra `"casal"` em títulos de caixinhas (ex: *"Reserva de Emergência do Casal"*). | Aporte na Reserva de Emergência era categorizado como `eletro` (Casa, Móveis & Eletros) em vez de `outros`. | ✅ **Resolvido** |
| **ISSUE-INT-V2-02** | 🟢 Baixo | M4 ↔ M1 ↔ M2 ↔ M3 | `src/App.jsx` (`handleImportBackup`) | Versão do schema era forçada estaticamente como `'1.5.0'` na restauração de backup JSON. | Rebaixava a versão do FinanPro para 1.5.0 após importar backup em vez de manter a v2.0.0. | ✅ **Resolvido** |

---

## 🔍 Detalhamento Técnico das Falhas de Integração v2.0

### 🟡 ISSUE-INT-V2-01: Colisão Semântica de "casa" com a palavra "casal" nos Aportes
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L1187-L1197).
* **Causa Raiz:** Em `handleDepositGoal`, a heurística de categorização automática verificava `gCat.includes('casa')`. Como o título de metas frequentemente inclui a palavra *"Casal"* (ex: *"Reserva de Emergência do Casal"*), o método `.includes('casa')` retornava `true` porque `"casal"` contém a substring `"casa"`.
* **Solução Implementada:** Substituir por expressão regular com limite de palavra (`/\bcasa\b/i.test(gCat)`). Dessa forma, palavras como "Casal" não disparam a categoria `eletro`, preservando o enquadramento correto em `outros`.

---

### 🟢 ISSUE-INT-V2-02: Versão 1.5.0 Estática na Restauração de Backup JSON
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L1482).
* **Causa Raiz:** A função `handleImportBackup` continha `version: '1.5.0'` hardcoded na composição do estado reconstruído.
* **Solução Implementada:** Utilizar `version: parsedState.version || '2.0.0'`, respeitando a evolução para a versão 2.0.0 da aplicação.

---

## ✅ Validação Automatizada em Segundo Plano (Headless) — 12/11/2026

Bateria completa de regressão executada com 16 asserções E2E cobrindo todos os 4 módulos:

```text
================================================================
🧪 AUDITORIA HEADLESS V2.0 — MÓDULO 4 & INTEGRAÇÃO GLOBAL
================================================================

--- BLOCO 1: CONFIGURAÇÕES DO CASAL & DESIGN SYSTEM DE TEMAS ---
  [PASS] M4-T01: Design System de Temas - 5 temas oficiais completos com paleta válida
  [PASS] M4-T02: Atualização de Configurações do Casal (Salários, Primícias & Metas)
  [PASS] M4-T03: Tetos de Gastos por Categoria - Alocação orçamentária

--- BLOCO 2: CENTRAL DE BACKUP JSON & SANITIZAÇÃO ---
  [PASS] M4-T04: Exportação de Backup - Estrutura e integridade do JSON exportado
  [PASS] M4-T05: Importação de Backup - Migração de cartões legados (card-1/card-2 -> card-nubank/card-inter)
  [PASS] M4-T06: Importação de Backup - Preservação da versão 2.0.0 sem downgrade para 1.5.0
  [PASS] M4-T07: Reset para Dados de Demonstração (handleResetToDemo) exige confirmação preventiva

--- BLOCO 3: SINCRONIZAÇÃO EM NUVEM SUPABASE ---
  [PASS] M4-T08: isSupabaseConfigured - Valida parâmetros obrigatórios (URL, AnonKey, CoupleCode)
  [PASS] M4-T09: saveSupabaseConfig - Sanitiza barras finais de URLs e faz trim nos campos
  [PASS] M4-T10: SUPABASE_SQL_SETUP - Contém DDL completo para couple_sync com RLS e política pública
  [PASS] M4-T11: Modo Offline / Não Configurado - push e pull retornam fallback gracioso sem travar

--- BLOCO 4: PWA INSTALÁVEL & SERVICE WORKER ---
  [PASS] M4-T12: Integridade de manifest.json para PWA Instalável no Celular
  [PASS] M4-T13: Integridade de sw.js (Service Worker para Suporte Offline e Cache)

--- BLOCO 5: FLUXO DE DADOS DE PONTA A PONTA (E2E) ---
  [PASS] M4-T14 [E2E FLUXO 1]: M2 -> M1 -> M3 -> M4 (Novo parcelamento reflete em faturas, extrato, alívio e backup)
  [PASS] M4-T15 [E2E FLUXO 2]: M3 -> M1 -> M3 -> M4 (Aporte em Caixinha -> Extrato -> Acerto do Casal -> Backup)
  [PASS] M4-T16 [E2E FLUXO 3]: M1 -> M3 (Edição de salário em Lançamentos propaga para Divisão do Casal e Dízimo)
================================================================
Total de Asserções: 16 | Aprovados: 16 | Falhas: 0 ✅
================================================================
```
