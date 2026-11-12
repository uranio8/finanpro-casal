# 📋 Diagnóstico e Catálogo de Issues — Módulo 2
> **Módulo Auditado:** Módulo 2 — *Renda Extra & Aulas Particulares*, *Salários Mensais Independentes*, *Primícias & Doações (Dízimo bíblico 10% + Ofertas %)* e *Divisão do Casal (CoupleSplit)*.  
> **Data da Auditoria:** 12/11/2026  
> **Metodologia:** Auditoria minuciosa em segundo plano (*Headless Node.js + AST & Logical Engine Verification*), sem interferência na janela do usuário (Regra de Ouro #7).  
> **Status:** **10 Inconsistências Identificadas** aguardando plano e aprovação prévia do usuário (Regra de Ouro #6).

---

## 📊 Sumário Executivo das Falhas do Módulo 2

| ID | Severidade | Componente / Arquivo | Descrição do Problema | Impacto no Usuário |
|---|---|---|---|---|
| **ISSUE-M2-01** | 🔴 Crítico | `src/data/initialState.js` | Inconsistência gritante de salários em Nov/2026 entre `monthlyIncomes` (5.900/700) e `transactions` (6.500/5.500). | *Divisão do Casal* exibe renda de R$ 6.600 enquanto *Lançamentos* exibe R$ 12.000. Dízimos ficam desencontrados. |
| **ISSUE-M2-02** | 🔴 Crítico | `src/App.jsx` (`handleSaveMonthIncome`) | Ao definir salário de novos meses (ex: Dez/2026), transações de Dízimo NÃO são criadas quando inexistentes. | Meses futuros ficam com salário registrado mas sem a provisão de Dízimo e Ofertas na lista de pagamentos. |
| **ISSUE-M2-03** | 🟠 Alto | `src/App.jsx` & `CoupleSplitView.jsx` | Divergência de Dízimo sobre Renda Extra (`includeExtraInTithe`). `CoupleSplit` calcula sobre Salário + Extra, mas a transação gerada calcula só sobre Salário. | O valor de primícias que o casal vê em *Divisão do Casal* difere do boleto/transação em *Lançamentos do Mês*. |
| **ISSUE-M2-04** | 🟠 Alto | `src/components/ExtraIncomeView.jsx` | Ausência de botão e modal para **Editar Renda Extra** (apenas exclusão disponível). | Se o usuário errar número de horas, valor da hora, data ou nome do aluno, é obrigado a deletar e recadastrar do zero. |
| **ISSUE-M2-05** | 🟡 Médio | `src/components/ExtraIncomeView.jsx` & `App.jsx` | Exclusão de Renda Extra instantânea ao clicar na lixeira, **sem janela de confirmação**. | Risco de perda acidental de histórico de aulas ministradas e valores recebidos com um clique em falso. |
| **ISSUE-M2-06** | 🟡 Médio | `src/components/ExtraIncomeView.jsx` | Filtro `ownerFilter === 'joint'` (Contas Conjuntas) na Topbar exibe todas as rendas extras individuais em vez de filtrar ou orientar o usuário. | Cria confusão de contexto, pois aulas e vendas são atribuídas a Wesley ou Beatriz, nunca "conjuntas". |
| **ISSUE-M2-07** | 🟠 Alto | `src/components/TransactionsView.jsx` vs `src/components/CoupleSplitView.jsx` | Receitas avulsas criadas em *Lançamentos* (`+ Nova Receita`) não são computadas na *Divisão do Casal* nem em *Renda Extra*. | Rendimentos, freelas ou vendas cadastrados pelo botão de Lançamentos somem do rateio justo do casal. |
| **ISSUE-M2-08** | 🟡 Médio | `src/components/ExtraIncomeView.jsx` & `CoupleSplitView.jsx` | Cálculo de Dízimo e Quota Conjugal incide sobre Renda Extra **Pendente (A Receber)** da mesma forma que sobre **Recebida**. | Casal é cobrado a ofertar e pagar quota sobre dinheiro que ainda não entrou na conta bancária. |
| **ISSUE-M2-09** | 🟢 Baixo | `src/components/CoupleSplitView.jsx` | Tolerância de acerto de contas `Math.abs(p1BalanceDiff) < 1` informa que "contas estão 100% equilibradas" mesmo quando há diferença de centavos (ex: R$ 0,80). | Falta de precisão de centavos na mensagem principal de acerto entre os cônjuges. |
| **ISSUE-M2-10** | 🟡 Médio | `src/components/SettingsView.jsx` | Alteração de salários padrão em *Configurações* não avisa nem sincroniza com meses que já possuem override em `monthlyIncomes`. | Usuário altera o salário para R$ 7.000 em Configurações, mas em Novembro continua aparecendo o valor antigo sem explicação visual. |

---

## 🔍 Detalhamento Técnico das Issues

### 🔴 ISSUE-M2-01: Inconsistência de Salários no Estado Inicial (Nov/2026)
* **Arquivos Afetados:** [src/data/initialState.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/data/initialState.js#L84-L95) e [src/data/initialState.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/data/initialState.js#L294-L345).
* **Causa Raiz:** Em `INITIAL_STATE.monthlyIncomes['2026-11']` foi cadastrado `partner1Income: 5900` e `partner2Income: 700` (valores herdados de exemplos de placeholder de formulário). Por outro lado, no array de `transactions` para `2026-11`, constam `tx-inc-1` (Wesley R$ 6.500), `tx-inc-2` (Beatriz R$ 5.500), `tx-diz-1` (R$ 975 = 15% de 6.500) e `tx-diz-2` (R$ 825 = 15% de 5.500).
* **Comportamento Observado:** Quando o usuário clica em *Lançamentos do Mês*, a soma das receitas do casal é R$ 12.000,00. Quando clica em *Divisão do Casal*, a renda do casal é informada como R$ 6.600,00. Essa divergência quebra a credibilidade matemática inicial do sistema.
* **Solução Proposta:** Alinhar `INITIAL_STATE.monthlyIncomes['2026-11']` para `partner1Income: 6500` e `partner2Income: 5500` (ou alinhar as transações), garantindo 100% de consistência entre telas.

---

### 🔴 ISSUE-M2-02: Transações de Dízimo e Oferta Inexistentes em Meses Futuros
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L654-L673).
* **Causa Raiz:** Na função `handleSaveMonthIncome` em `App.jsx`, ao definir o salário de um mês futuro (ex: Dezembro/2026), o código verifica se já existem transações de salário e as cria se não existirem (`newTransactions.push(...)`). No entanto, para as transações de categoria `dizimo`, o código faz apenas um `.map()` sobre as transações existentes:
  ```javascript
  newTransactions = newTransactions.map((t) => {
    if (t.category === 'dizimo' && t.dueDate?.startsWith(ym)) { ... }
  });
  ```
  Se o mês novo ainda não possuía transações de dízimo previamente cadastradas, NENHUMA transação de dízimo é criada!
* **Comportamento Observado:** O usuário abre Dezembro/2026, clica em "Definir Renda do Mês", salva R$ 7.000 e R$ 6.000. Os salários são criados na lista de transações, mas o Dízimo (10%) + Ofertas (5%) de R$ 1.950,00 desaparece da lista de contas a pagar de Dezembro.
* **Solução Proposta:** Na função `handleSaveMonthIncome`, se `couple.titheEnabled === true`, verificar se já existem transações de dízimo para o parceiro naquele mês. Se não existirem e o dízimo for maior que zero, fazer `.push()` das transações de dízimo do Wesley e da Beatriz automaticamente.

---

### 🟠 ISSUE-M2-03: Divergência de Dízimo da Renda Extra (`includeExtraInTithe`)
* **Arquivos Afetados:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L659-L660) e [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L43-L47).
* **Causa Raiz:** Quando `couple.includeExtraInTithe` está ativo, o componente `CoupleSplitView` soma o dízimo da renda extra na base de primícias (`p1TitheBase = p1Salary + p1Extra`). Já na função `handleSaveMonthIncome` do `App.jsx`, o cálculo do dízimo das transações é puramente `p1Sal * 15%`. Além disso, a tela de *Renda Extra* exibe o dízimo de cada aula (ex: R$ 40,50 na aula de R$ 270), mas nenhuma dessas primícias de renda extra se converte em transação nem se soma à transação principal de dízimo.
* **Comportamento Observado:** O casal vê um valor total de primícias na tela de *Divisão do Casal* (ex: R$ 1.057,50 para Wesley) e um valor diferente no lançamento de despesa em *Lançamentos do Mês* (R$ 885,00).
* **Solução Proposta:** Unificar a base de cálculo de primícias. Se `includeExtraInTithe` estiver ativo, a transação mensal de dízimo ou uma transação específica vinculada às aulas deve refletir exatamente o valor consagrado da renda extra recebida.

---

### 🟠 ISSUE-M2-04: Impossibilidade de Editar Renda Extra Existente
* **Arquivos Afetados:** [src/components/ExtraIncomeView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/ExtraIncomeView.jsx#L500-L510).
* **Causa Raiz:** Na tabela de *Renda Extra*, a coluna de ações possui exclusivamente o botão de lixeira (`onDeleteExtraIncome`). Não existe função `onEditExtraIncome`, nem botão com ícone de lápis (`fa-pencil`), nem modal configurado para carregar os dados de um item existente para edição.
* **Comportamento Observado:** O professor ou vendedor que cadastra 4h a R$ 90/h, se o aluno remarcar para 2h ou alterar a data da aula, não tem como editar; é forçado a excluir o registro e redigitar tudo.
* **Solução Proposta:** Adicionar estado `editingItem`, botão de edição na tabela e reaproveitar o modal existente com suporte a criação e edição (com preenchimento automático dos campos e botão "Atualizar Registro").

---

### 🟡 ISSUE-M2-05: Exclusão Instantânea de Renda Extra Sem Confirmação
* **Arquivos Afetados:** [src/components/ExtraIncomeView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/ExtraIncomeView.jsx#L504) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L332-L338).
* **Causa Raiz:** O clique no botão `onDeleteExtraIncome(item.id)` executa diretamente a remoção no estado do `App.jsx`, sem disparar `window.confirm` com o nome da atividade ou aluno.
* **Comportamento Observado:** Um toque acidental em telas sensíveis ao toque (touch) ou clique involuntário no desktop apaga o registro permanentemente sem chance de cancelamento.
* **Solução Proposta:** Adicionar confirmação: `window.confirm(`Deseja realmente remover o registro "${item.title}"?`)` antes de prosseguir com a exclusão.

---

### 🟡 ISSUE-M2-06: Filtro `ownerFilter === 'joint'` na Aba de Renda Extra
* **Arquivos Afetados:** [src/components/ExtraIncomeView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/ExtraIncomeView.jsx#L56-L65).
* **Causa Raiz:** A lógica de filtro só descarta itens se `ownerFilter === 'partner1'` e o item for de outro, ou `ownerFilter === 'partner2'` e o item for de outro. Se o filtro for `joint` (Contas Conjuntas), a condição não entra em nenhum `if` e exibe tudo, ignorando que nenhuma aula ou venda possui titularidade "conjunta".
* **Comportamento Observado:** Ao selecionar "Contas Conjuntas" na Topbar e navegar para *Renda Extra*, a tela continua mostrando as aulas de Wesley e vendas de Beatriz, passando a falsa impressão de que são receitas conjuntas da casa.
* **Solução Proposta:** Tratar explicitamente `ownerFilter === 'joint'`: exibir um estado visual explicativo (*"Rendas extras e aulas são atividades individuais de Wesley e Beatriz. Selecione 'Todos' ou o cônjuge específico para visualizar."*) ou ocultar mantendo a semântica clara.

---

### 🟠 ISSUE-M2-07: Desconexão de Receitas Avulsas do Lançamentos com o Módulo 2
* **Arquivos Afetados:** [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L22-L37) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L178-L206).
* **Causa Raiz:** Se o usuário usa o botão flutuante (+ Ações Rápidas) ou o botão "+ Nova Receita" na tela de *Lançamentos do Mês* para lançar uma entrada (ex: "Bônus Semestral", "Restituição IRPF", "Dividendos"), esse lançamento é gravado em `transactions` (`type: 'income'`). No entanto, `CoupleSplitView` calcula a renda do parceiro EXCLUSIVAMENTE via `p1Salary + p1Extra`, ignorando quaisquer transações de receita avulsa existentes no mês em `transactions`.
* **Comportamento Observado:** Um parceiro recebe R$ 2.000 de bônus, cadastra em *Lançamentos*, o dinheiro aparece no saldo livre de *Lançamentos*, mas a tela de *Divisão do Casal* ignora o valor, calculando a quota proporcional como se o bônus não existisse.
* **Solução Proposta:** No `CoupleSplitView`, ao computar a renda de cada parceiro, incluir as receitas avulsas registradas em `transactions` (`type === 'income' && category !== 'salario'`), garantindo que todo dinheiro que entra na casa conte no rateio familiar justo.

---

### 🟡 ISSUE-M2-08: Quota e Dízimo Incidentes sobre Renda Extra Ainda Não Recebida
* **Arquivos Afetados:** [src/components/ExtraIncomeView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/ExtraIncomeView.jsx#L88-L126) e [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L22-L28).
* **Causa Raiz:** A variável `monthExtras` é somada sem filtrar `status === 'received'`. As aulas com `status: 'pending'` (agendadas para semanas futuras ou aguardando pagamento do aluno) entram na conta de renda líquida e cálculo de acerto de contas imediatamente.
* **Comportamento Observado:** O professor tem 3 aulas agendadas para o fim do mês que somam R$ 540, mas ainda não recebeu dos alunos. O sistema já exige que ele transfira mais dinheiro para fechar as contas da casa no presente momento.
* **Solução Proposta:** Permitir no cabeçalho ou nas métricas a distinção clara entre **Renda Extra Efetivada (Recebida)** vs **Renda Extra Prevista**, e no `CoupleSplitView` calcular a quota e o acerto baseado nas rendas efetivamente no bolso (com opção toggle ou clara sinalização).

---

### 🟢 ISSUE-M2-09: Tolerância Excessiva no Acerto de Contas (`< 1` Real)
* **Arquivos Afetados:** [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L117-L121) e [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx#L220).
* **Causa Raiz:** O código verifica `if (Math.abs(p1BalanceDiff) < 1)`. Se o saldo for R$ 0,75, o banner principal diz: *"Tudo perfeitamente equilibrado! Ninguém precisa transferir nada."*, enquanto a tabela logo abaixo exibe a diferença de centavos.
* **Comportamento Observado:** Pequenas discrepâncias de centavos não são orientadas de forma clara para o casal.
* **Solução Proposta:** Reduzir a tolerância para `< 0.01` (1 centavo), exibindo o acerto exato em centavos ou arredondando de forma transparente.

---

### 🟡 ISSUE-M2-10: Sincronização de `SettingsView` com `monthlyIncomes`
* **Arquivos Afetados:** [src/components/SettingsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/SettingsView.jsx#L54-L66) e [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx#L715-L724).
* **Causa Raiz:** Salvar novos salários padrão em *Configurações* atualiza `couple.partner1Income` e `couple.partner2Income`. No entanto, se o mês atual (ou qualquer mês) possuir um registro específico em `monthlyIncomes`, a tela de configurações não avisa o usuário que aquele mês específico possui uma renda customizada que sobrepõe o padrão.
* **Comportamento Observado:** O usuário altera o salário padrão para R$ 7.000 em Configurações, volta para Novembro e continua vendo R$ 6.500 (ou o valor customizado anterior) sem entender o motivo.
* **Solução Proposta:** Adicionar um aviso em *Configurações* ou opção de atualizar também o mês ativo ao mudar o salário padrão.

---

## 🎯 Conclusão da Auditoria do Módulo 2
O Módulo 2 possui regras financeiras ricas e inovadoras (especialmente o modelo de três vias: Tudo Junto / Proporcional / 50-50 e a gestão de Aulas Particulares com Primícias), mas sofre de desalinhamento de dados iniciais e falta de sincronização bidirecional entre transações e salários/rendas extras.

Conforme a **Regra de Ouro #6 (Mandatória)** do `AGENTS.md`, todas as alterações de código aguardam apresentação e aprovação prévia do plano de implementação pelo usuário antes de serem executadas.



---

## 🔬 Auditoria de Regressão e Validação das Correções do Módulo 2

* **Data da Execução:** 12/11/2026 (Execução 100% Headless / Segundo Plano)
* **Resultado:** **20 asserções executadas — 20 APROVADAS (0 Falhas)**

### Resumo das Resoluções Aplicadas:
1. **ISSUE-M2-01 (RESOLVIDO):** `INITIAL_STATE.monthlyIncomes['2026-11']` alinhado para R$ 6.500 (Wesley) e R$ 5.500 (Beatriz), com migração automática no `App.jsx` (v1.4.0) para limpar resíduos de cache do `localStorage`.
2. **ISSUE-M2-02 (RESOLVIDO):** `handleSaveMonthIncome` em `src/App.jsx` atualizado para criar automaticamente as transações de Dízimo/Oferta de Wesley e Beatriz (`tx-diz-p1-...` e `tx-diz-p2-...`) e doações especiais (`tx-don-...`) em qualquer mês novo.
3. **ISSUE-M2-03 (RESOLVIDO):** Base de cálculo de primícias harmonizada entre `App.jsx` e `CoupleSplitView.jsx`. Se `includeExtraInTithe` estiver ativo, o dízimo da renda extra recebida é computado e sincronizado nas transações e na divisão do casal.
4. **ISSUE-M2-04 (RESOLVIDO):** Adicionado botão de edição com ícone de lápis (`fa-pencil`) em cada linha de `ExtraIncomeView.jsx`, permitindo abrir o modal pré-preenchido, alterar dados e salvar via `onUpdateExtraIncome`.
5. **ISSUE-M2-05 (RESOLVIDO):** Adicionada confirmação preventiva (`window.confirm`) antes de qualquer exclusão de aula ou venda em `ExtraIncomeView.jsx`.
6. **ISSUE-M2-06 (RESOLVIDO):** Filtro `ownerFilter === 'joint'` agora exibe banner informativo contextual explicando que as atividades de renda extra são individuais de Wesley ou Beatriz.
7. **ISSUE-M2-07 (RESOLVIDO):** `CoupleSplitView.jsx` agora computa receitas avulsas registradas em `transactions` (`category !== 'salario'`), garantindo que bônus, rendimentos e freelas contem na renda e no rateio justo.
8. **ISSUE-M2-08 (RESOLVIDO):** Primícias sobre renda extra agora incidem sobre o montante efetivamente recebido (`p1ExtraReceived` / `p2ExtraReceived`), sem onerar o casal por valores pendentes de alunos.
9. **ISSUE-M2-09 (RESOLVIDO):** Tolerância do banner de acerto de contas refinada para precisão estrita de centavos (`< 0.01`).
10. **ISSUE-M2-10 (RESOLVIDO):** Adicionada orientação visual clara em `SettingsView.jsx` explicando que salários cadastrados são padrões do casal e que ajustes em meses específicos devem ser feitos via "Renda do Mês".
