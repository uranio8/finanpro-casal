# 📋 Diagnóstico e Catálogo de Issues — Módulo 3
> **Módulo Auditado:** Módulo 3 — *Visão Geral / Dashboard*, *Metas & Caixinhas (com Checklist Mensal)*, *Configurações & Central de Backup*.  
> **Data da Auditoria:** 12/11/2026  
> **Metodologia:** Auditoria minuciosa em segundo plano (*Headless Node.js + AST & Logical Engine Verification*), sem interferência na janela do usuário (Regra de Ouro #7).  
> **Status:** **7 Inconsistências Identificadas** aguardando plano e aprovação prévia do usuário (Regra de Ouro #6).

---

## 📊 Sumário Executivo das Falhas do Módulo 3

| ID | Severidade | Componente / Arquivo | Descrição do Problema | Impacto no Usuário |
|---|---|---|---|---|
| **ISSUE-M3-01** | 🟠 Alto | `src/components/DashboardView.jsx` | `totalIncome` e `freeBalance` omitem receitas avulsas cadastradas em *Lançamentos* (`category !== 'salario'`). | Bônus, restituição de IR ou dividendos não somam na receita nem no saldo livre da tela inicial. |
| **ISSUE-M3-02** | 🟠 Alto | `src/components/DashboardView.jsx` | Card de Primícias do Dashboard calcula Dízimo sobre Renda Extra **Pendente**, divergindo da transação e da *Divisão do Casal*. | Dashboard exibe dízimo maior do que o que foi efetivamente lançado e pago no mês. |
| **ISSUE-M3-03** | 🔴 Crítico | `src/components/GoalsAndChecklistView.jsx` | Exclusão de Metas / Caixinhas ocorre instantaneamente ao clicar na lixeira, **sem janela de confirmação**. | Risco de perda irreversível de metas acumuladas e histórico patrimonial do casal com um clique acidental. |
| **ISSUE-M3-04** | 🔴 Crítico | `src/App.jsx` (`handleResetToDemo`) & `SettingsView.jsx` | Botão "Restaurar Dados de Demonstração" apaga todo o banco do usuário **sem solicitar confirmação**. | Um clique em falso em Configurações destrói todos os dados reais do casal sem aviso prévio. |
| **ISSUE-M3-05** | 🟡 Médio | `src/components/GoalsAndChecklistView.jsx` | Checklist Mensal não possui ação de **Reiniciar / Desmarcar tarefas** para o novo mês. | Ao mudar de mês na barra superior, todas as tarefas continuam marcadas como concluídas do mês anterior. |
| **ISSUE-M3-06** | 🟡 Médio | `src/App.jsx` (`handleImportBackup`) | Importação de backup JSON não executa sanitização nem migração de cartões/estruturas antigas. | Importar um backup exportado em versões anteriores pode quebrar vínculos de cartões (`card-1`/`card-2`) e compromissos. |
| **ISSUE-M3-07** | 🟢 Baixo | `src/components/DashboardView.jsx` | Subtítulo do card de Renda Total do Mês exibe apenas `Salários + Extra`, omitindo receitas adicionais. | Usuário vê valor total maior que a soma dos dois componentes mostrados no texto secundário. |

---

## 🔍 Detalhamento Técnico das Issues

### 🟠 ISSUE-M3-01: Omissão de Receitas Avulsas no Total Income do Dashboard
* **Arquivos Afetados:** [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L87-L94).
* **Causa Raiz:** Em `DashboardView.jsx`, a variável `totalIncome` é definida puramente como:
  ```javascript
  const totalIncome = baseSalaryIncome + totalExtraIncomeMonth;
  ```
  Embora o componente filtre `monthIncomes = monthTransactions.filter(tx => tx.type === 'income')`, ele nunca soma as receitas avulsas registradas em `transactions` (como bonificações, restituições, vendas avulsas ou rendimentos com categoria diferente de `salario`).
* **Comportamento Observado:** Se o casal registrar um bônus de R$ 2.000 em *Lançamentos do Mês*, a tela inicial (Dashboard) continua mostrando a renda sem o bônus, e o Saldo Livre Previsto (`freeBalance = totalIncome - totalExpense`) fica subestimado em R$ 2.000.
* **Solução Proposta:** Somar as receitas de `monthTransactions` que não sejam salário (`category !== 'salario'`) à composição de `totalIncome`.

---

### 🟠 ISSUE-M3-02: Dízimo sobre Renda Extra Pendente no Dashboard
* **Arquivos Afetados:** [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L104-L123).
* **Causa Raiz:** No `titheSummary` do `DashboardView`, a base de renda extra para cálculo de dízimo soma todas as entradas onde `applyTitheAndOffering` é verdadeiro, sem verificar se `i.status === 'received'`.
* **Comportamento Observado:** Em Novembro/2026, Wesley tem R$ 610 de renda extra recebida e R$ 540 pendente. Em *Lançamentos* e *Divisão do Casal*, o dízimo incide sobre os R$ 610 recebidos (R$ 1.066,50 total). No Dashboard, o dízimo é calculado sobre os R$ 1.150 brutos (R$ 1.147,50 total), gerando divergência de R$ 81,00 entre telas do mesmo sistema.
* **Solução Proposta:** Adicionar `i.status === 'received'` no filtro de extra incomes do `titheSummary`, alinhando perfeitamente com os Módulos 1 e 2.

---

### 🔴 ISSUE-M3-03: Exclusão de Caixinhas / Metas Sem Confirmação Preventiva
* **Arquivos Afetados:** [src/components/GoalsAndChecklistView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/GoalsAndChecklistView.jsx#L187-L193) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L577-L583).
* **Causa Raiz:** O clique no botão da lixeira executa `onDeleteGoal(goal.id)` de forma direta e síncrona.
* **Comportamento Observado:** Metas importantes (como Reserva de Emergência com R$ 18.000 acumulados) são deletadas imediatamente ao toque acidental na lixeira, sem qualquer diálogo de aviso ou chance de cancelamento.
* **Solução Proposta:** Adicionar `if (window.confirm(`Deseja realmente excluir a caixinha "${goal.title}"? O saldo guardado será removido.`))` antes de invocar `onDeleteGoal`.

---

### 🔴 ISSUE-M3-04: Exclusão Global Sem Confirmação ao Restaurar Dados de Exemplo
* **Arquivos Afetados:** [src/components/SettingsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/SettingsView.jsx#L405-L408) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L848-L851).
* **Causa Raiz:** A função `handleResetToDemo` no `App.jsx` executa cegamente `setState(INITIAL_STATE)` sem questionar o usuário.
* **Comportamento Observado:** Na aba *Configurações*, ao clicar em "Restaurar Exemplo", o sistema apaga instantaneamente todos os lançamentos reais, cartões personalizados e históricos salvos pelo usuário, sem pedir confirmação.
* **Solução Proposta:** Adicionar confirmação de segurança com texto explícito de alerta de perda de dados: `window.confirm('Tem certeza de que deseja restaurar os dados de exemplo? Todos os seus dados atuais serão substituídos pelo modelo inicial.')`.

---

### 🟡 ISSUE-M3-05: Falta de Ação para Reiniciar o Checklist Mensal
* **Arquivos Afetados:** [src/components/GoalsAndChecklistView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/GoalsAndChecklistView.jsx#L236-L255) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L782-L812).
* **Causa Raiz:** O checklist de rotina mensal armazena o status `done` diretamente em cada item. Ao mudar de mês (ex: de Novembro para Dezembro), as tarefas concluídas continuam marcadas, não permitindo iniciar a nova rotina sem desmarcar uma a uma manualmente.
* **Comportamento Observado:** O casal não possui forma prática de reaproveitar o checklist padrão a cada novo mês que começa.
* **Solução Proposta:** Adicionar botão no cabeçalho do Checklist: `"🔄 Reiniciar Tarefas do Mês"` com confirmação, desmarcando todos os itens (`done: false`) com 1 clique para iniciar o ciclo do mês ativo.

---

### 🟡 ISSUE-M3-06: Falta de Sanitização e Migração na Importação de Backup JSON
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L843-L847).
* **Causa Raiz:** A função `handleImportBackup` aceita o objeto parseado e executa `setState({ ...INITIAL_STATE, ...parsedState })` sem rodar os mesmos tratamentos de migração (como conversão de IDs legados de cartões `card-1`/`card-2` para `card-nubank`/`card-inter` e garantia de integridade de datas).
* **Comportamento Observado:** Se o usuário importar um arquivo JSON de backup gerado em versões anteriores, compromissos vinculados a cartões perdem a referência e causam inconsistências visuais.
* **Solução Proposta:** Fazer com que `handleImportBackup` execute as mesmas funções de sanitização e migração já presentes no boot do `localStorage`.

---

### 🟢 ISSUE-M3-07: Detalhamento Incompleto no Subtítulo do Card de Renda Total
* **Arquivos Afetados:** [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx#L457-L460).
* **Causa Raiz:** O texto auxiliar exibe estaticamente: `Salários: R$ X + Extra: R$ Y`. Quando existem receitas avulsas, o valor total no card é superior à soma desses dois valores.
* **Solução Proposta:** Quando houver receitas avulsas, incluir `+ Outras Entradas: R$ Z` no texto explicativo do KPI.

---

## 🎯 Conclusão da Auditoria do Módulo 3
O Módulo 3 consolida visualmente toda a experiência do casal com gráficos ricos e ferramentas motivacionais, mas necessita de proteção contra exclusões acidentais de patrimônio/dados e alinhamento do cálculo de renda/primícias com os Módulos 1 e 2.

Conforme a **Regra de Ouro #6 (Mandatória)** do `AGENTS.md`, todas as alterações de código aguardam apresentação e aprovação prévia do plano de implementação pelo usuário antes de serem executadas.
