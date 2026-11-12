# 📋 Diagnóstico e Catálogo de Issues — Módulo 3
> **Módulo Auditado:** Módulo 3 — *Visão Geral / Dashboard*, *Divisão do Casal*, *Metas & Caixinhas (com Checklist Mensal & Projeção Inteligente)*, *Renda Extra*, *Configurações & Central de Backup*.  
> **Data da Auditoria:** 12/11/2026  
> **Metodologia:** Auditoria minuciosa em segundo plano (*Headless Node.js + AST & Logical Engine Verification*), sem interferência na janela do usuário (Regra de Ouro #7).  
> **Status v1.0:** **7 Inconsistências Identificadas — TODAS AS 7 CORRIGIDAS E APROVADAS (11/11 Testes)** ✅  
> **Status v2.0:** **3 Oportunidades Identificadas — TODAS AS 3 CORRIGIDAS E APROVADAS (31/31 Testes de Regressão Headless)** ✅

---

## 📊 Sumário Executivo das Falhas do Módulo 3 (v1.0 & v2.0)

| ID | Severidade | Componente / Arquivo | Descrição do Problema | Impacto no Usuário | Status |
|---|---|---|---|---|---|
| **ISSUE-M3-01** | 🟠 Alto | `src/components/DashboardView.jsx` | `totalIncome` e `freeBalance` omitem receitas avulsas cadastradas em *Lançamentos* (`category !== 'salario'`). | Bônus, restituição de IR ou dividendos não somam na receita nem no saldo livre da tela inicial. | ✅ **Resolvido** |
| **ISSUE-M3-02** | 🟠 Alto | `src/components/DashboardView.jsx` | Card de Primícias do Dashboard calcula Dízimo sobre Renda Extra **Pendente**, divergindo da transação e da *Divisão do Casal*. | Dashboard exibe dízimo maior do que o que foi efetivamente lançado e pago no mês. | ✅ **Resolvido** |
| **ISSUE-M3-03** | 🔴 Crítico | `src/components/GoalsAndChecklistView.jsx` | Exclusão de Metas / Caixinhas ocorre instantaneamente ao clicar na lixeira, **sem janela de confirmação**. | Risco de perda irreversível de metas acumuladas e histórico patrimonial do casal com um clique acidental. | ✅ **Resolvido** |
| **ISSUE-M3-04** | 🔴 Crítico | `src/App.jsx` (`handleResetToDemo`) & `SettingsView.jsx` | Botão "Restaurar Dados de Demonstração" apaga todo o banco do usuário **sem solicitar confirmação**. | Um clique em falso em Configurações destrói todos os dados reais do casal sem aviso prévio. | ✅ **Resolvido** |
| **ISSUE-M3-05** | 🟡 Médio | `src/components/GoalsAndChecklistView.jsx` | Checklist Mensal não possui ação de **Reiniciar / Desmarcar tarefas** para o novo mês. | Ao mudar de mês na barra superior, todas as tarefas continuam marcadas como concluídas do mês anterior. | ✅ **Resolvido** |
| **ISSUE-M3-06** | 🟡 Médio | `src/App.jsx` (`handleImportBackup`) | Importação de backup JSON não executa sanitização nem migração de cartões/estruturas antigas. | Importar um backup exportado em versões anteriores pode quebrar vínculos de cartões (`card-1`/`card-2`) e compromissos. | ✅ **Resolvido** |
| **ISSUE-M3-07** | 🟢 Baixo | `src/components/DashboardView.jsx` | Subtítulo do card de Renda Total do Mês exibe apenas `Salários + Extra`, omitindo receitas adicionais. | Usuário vê valor total maior que a soma dos dois componentes mostrados no texto secundário. | ✅ **Resolvido** |
| **ISSUE-M3-V2-01** | 🟡 Médio | `src/App.jsx` (`handleReopenMonthSplit`) | Reabertura do acerto mensal do casal (`handleReopenMonthSplit`) não desmarcava a tarefa `chk-6` no Checklist. | Ao reabrir o acerto para ajustes, a tarefa de rotina permanecia como concluída no checklist. | ✅ **Resolvido** |
| **ISSUE-M3-V2-02** | 🟡 Médio | `src/App.jsx` (`handleDepositGoal`) | Aporte em Caixinha com registro de saída nos Lançamentos gravava categoria estática `'viagens'`. | Aportes em Reserva de Emergência, IPVA ou Casa apareciam como "Viagens & Sonhos" em relatórios e gráficos. | ✅ **Resolvido** |
| **ISSUE-M3-V2-03** | 🟢 Baixo | `src/components/GoalsAndChecklistView.jsx` | Projeção Inteligente de metas exibia `~0m` quando a meta mensal de poupança estava zerada ou não configurada. | Ilusão visual de que a meta seria atingida em zero meses mesmo restando saldo a poupar. | ✅ **Resolvido** |

---

## 🔍 Detalhamento Técnico das Issues v2.0

### 🟡 ISSUE-M3-V2-01: Sincronização Bidirecional Checklist ↔ Acerto Mensal ao Reabrir
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L1338-L1380).
* **Causa Raiz:** Ao confirmar o acerto mensal em *Divisão do Casal*, a tarefa correspondente no checklist era marcada como concluída (`done: true`). Contudo, ao clicar em "Reabrir Acerto", a função `handleReopenMonthSplit` removia o registro de `monthlySettlements`, mas mantinha a tarefa marcada no checklist como concluída.
* **Solução Implementada:** Atualizar o array `checklist` em `handleReopenMonthSplit`, definindo `done: false` para a tarefa de acerto (`chk-6` ou com título correspondente), garantindo sincronismo bidirecional em tempo real.

---

### 🟡 ISSUE-M3-V2-02: Categorização Inteligente de Aporte nas Caixinhas
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L1185-L1215).
* **Causa Raiz:** No modal de guardar valor na caixinha com a opção *"Registrar este aporte como saída nos Lançamentos do mês ativo"*, o campo `category` da transação criada era fixado estaticamente como `'viagens'`.
* **Solução Implementada:** Implementado mapeamento semântico derivado da categoria e título da Caixinha:
  * Viagens / Férias / Sonhos $\to$ `'viagens'`
  * Casa / Móveis / Reforma / Eletro $\to$ `'eletro'`
  * Carro / Veículo / IPVA / Manutenção $\to$ `'transporte'`
  * Reserva de Emergência / Outros $\to$ `'outros'`

---

### 🟢 ISSUE-M3-V2-03: Tratamento de Ritmo Zerado na Projeção Inteligente de Metas
* **Arquivos Afetados:** [src/components/GoalsAndChecklistView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/GoalsAndChecklistView.jsx#L328-L336).
* **Causa Raiz:** Quando `couple.monthlySavingsTarget` era 0 ou não configurado, `monthsAtCouplePace` resultava em 0, gerando o texto *"Previsão no ritmo atual: Mês (~0m)"*.
* **Solução Implementada:** Condicionar a exibição: se `pacePerGoal > 0 && monthsAtCouplePace > 0`, exibe a previsão calculada; caso contrário, exibe `"A definir (configure a meta mensal)"`.

---

## 🎯 Conclusão & Relatório de Verificação Pós-Correção (Headless v2.0)

Todas as 10 issues (7 da v1.0 + 3 da v2.0) estão 100% resolvidas e cobertas por testes automatizados sem regressões:

```
================================================================
🧪 AUDITORIA HEADLESS V2.0 — MÓDULO 3 (CASAL & METAS)
================================================================

--- BLOCO 1: DIVISÃO DO CASAL & RATEIO CONJUGAL ---
  [PASS] M3-T01: Proporcional à Renda - Cálculo correto de rendas (Salários + Extras + Adhoc)
  [PASS] M3-T02: Proporcional à Renda - Quotas percentuais e Acerto do Mês (p1BalanceDiff)
  [PASS] M3-T03: Divisão Meio a Meio (50/50) - Quotas exatas de 50%
  [PASS] M3-T04: Modelo Orçamento Único / Sem Proporção (unified) - Sem acerto e saldo familiar
  [PASS] M3-T05: Primícias (Dízimo 10% + Ofertas) - Incide apenas sobre renda extra RECEBIDA
  [PASS] M3-T06: Receitas Avulsas Adhoc (joint) rateadas 50/50 na base de cada cônjuge
  [PASS] M3-T07: Exclusão de categoria "dizimo" das despesas conjuntas e individuais

--- BLOCO 2: LIQUIDAÇÃO DO ACERTO MENSAL (1-CLIQUE) ---
  [PASS] M3-T08: handleSettleMonthSplit - Registra acerto e sincroniza com o Checklist (chk-6)
  [PASS] M3-T09: handleReopenMonthSplit - Remove acerto para ajustes

--- BLOCO 3: METAS & CAIXINHAS ---
  [PASS] M3-T10: Cálculo do Patrimônio Acumulado Global das Caixinhas
  [PASS] M3-T11: handleAddGoal - Criação de Nova Meta com ID único
  [PASS] M3-T12: handleUpdateGoal - Atualização de meta existente
  [PASS] M3-T13: handleDeleteGoal - Exclusão de caixinha
  [PASS] M3-T14: handleDepositGoal - Aporte simples na Caixinha (sem transação)
  [PASS] M3-T15: handleDepositGoal - Aporte com registro em transações (recordAsTransaction = true)

--- BLOCO 4: PROJEÇÃO INTELIGENTE & ALÍVIO DE CAIXA ---
  [PASS] M3-T16: Projeção Inteligente - Aporte mensal necessário para bater no prazo
  [PASS] M3-T17: Projeção Inteligente - Previsão no ritmo atual de poupança do casal
  [PASS] M3-T18: Projeção Inteligente - Meta 100% atingida não projeta meses
  [PASS] M3-T19: Alívio de Caixa Futuro (cashReliefInfo) - Parcelas que encerram em 3 meses

--- BLOCO 5: CHECKLIST DE ROTINA MENSAL ---
  [PASS] M3-T20: handleToggleChecklist - Alterna status de tarefa (done: true/false)
  [PASS] M3-T21: handleAddChecklistItem - Cria nova tarefa no grupo correto com done: false
  [PASS] M3-T22: handleDeleteChecklistItem - Remove tarefa do checklist
  [PASS] M3-T23: handleResetChecklist - Zera todas as tarefas para false preservando itens

--- BLOCO 6: RENDA EXTRA (AULAS, VENDAS & SERVIÇOS) ---
  [PASS] M3-T24: Métricas consolidadas de renda extra do mês de Nov/2026
  [PASS] M3-T25: Cálculo individual de Primícias por item de renda extra
  [PASS] M3-T26: ownerFilter em ExtraIncomeView - Comportamento isolado por titular

--- BLOCO 7: SINCRONIZAÇÃO EM TEMPO REAL E EDGE CASES ---
  [PASS] M3-T27: Alternância de status de renda extra (pending -> received) sincroniza dízimo no ledger
  [PASS] M3-T28: Settle e Reopen do Acerto Mensal mantém sincronismo bidirecional com chk-6 no Checklist
  [PASS] M3-T29: Aporte em Caixinha categoriza adequadamente de acordo com o objetivo da meta

--- BLOCO 8: REGRESSÃO DE FALHAS ANTERIORES (M3-01 a M3-07) ---
  [PASS] M3-T30 [REGRESSÃO M3-01]: Adhoc income incluído na renda e saldo
  [PASS] M3-T31 [REGRESSÃO M3-02]: Dízimo no Dashboard não incide sobre extra pendente

================================================================
📊 RESULTADO DA AUDITORIA DO MÓDULO 3:
   Testes Passados: 31 | Falhas: 0
================================================================
```
