# 🧪 Auditoria QA & Motor Financeiro — Issues do Módulo 1

**Escopo Auditado:**
1. **Parcelados e Fixas** (`src/components/CommitmentsView.jsx`)
2. **Lançamentos do Mês** (`src/components/TransactionsView.jsx`)
3. **Cartões e Faturas** (`src/components/CardsView.jsx`)
4. **Estado Central e Handlers** (`src/App.jsx` & `src/data/initialState.js`)

---

## 📋 Checklist Geral de Correção (Módulo 1)

- [x] **ISSUE-M1-01 (Crítica):** Divergência nos Dados Iniciais (`initialState.js`) entre Total de Parcelas na Tabela (`2/3 parc.`) e no Modal (`Parcela 2/12`).
- [x] **ISSUE-M1-02 (Crítica):** Compra com Entrada Inicial soma `+1` no denominador de parcelas (`1/5 parc.` em compra de `4x`) e exibe `"Parcela 0/4"`.
- [x] **ISSUE-M1-03 (Crítica):** Entrada Inicial (`#0`) é lançada dentro da Fatura do Cartão de Crédito já com status `Pago`, inflando o total da fatura.
- [x] **ISSUE-M1-04 (Crítica):** Impossibilidade de criar `Conta Fixa Mensal` no Cartão de Crédito e divisão indevida do valor mensal pelo número de meses.
- [x] **ISSUE-M1-05 (Média):** Marcar `"Possui valor de entrada inicial?"` com valor vazio/zero já desloca a 1ª parcela para o mês seguinte.
- [x] **ISSUE-M1-06 (Média):** Clicar em `"Dar Baixa Agora"` dentro do modal de Cronograma (👁️) fecha o modal imediatamente em vez de atualizar a lista ao vivo.
- [x] **ISSUE-M1-07 (Crítica):** Excluir uma única parcela em *Lançamentos do Mês* encolhe o `"Valor Total"` e a contagem de parcelas do contrato em *Parcelados e Fixas*.
- [x] **ISSUE-M1-08 (Crítica):** Data de pagamento (`paidDate`) travada (hardcoded) em `'2026-11-11'` ao quitar contas em outros meses (ex.: Dezembro/2026, 2027).
- [x] **ISSUE-M1-09 (Média):** Trocar o cartão no modal `+ Novo Gasto` pode sobrescrever o mês escolhido pelo usuário na data de vencimento.
- [x] **ISSUE-M1-10 (Crítica):** Editar o Dia de Vencimento de um cartão (`Editar Cartão`) não atualiza a coluna `"Última Parcela (Prazo)"` (`endDate`) em *Parcelados e Fixas*.
- [x] **ISSUE-M1-11 (Crítica):** Exclusão de cartão (`Remover cartão`) ocorre sem confirmação e deixa compromissos e parcelas órfãos (`cardId` inválido).
- [x] **ISSUE-M1-12 (Média):** Conflito visual entre `"Fatura de [Mês]"` e `"Aberta (R$)"` quando um item individual de cartão é marcado como `Pago`.
- [x] **ISSUE-M1-13 (Média):** A aba *Cartões e Faturas* (`CardsView.jsx`) ignora o filtro global de titular (`ownerFilter`) da Barra Superior.
- [x] **ISSUE-M1-14 (Baixa / UX):** Textos fixos (hardcoded) citando `"Inter Platinum ou Nubank Chroma"` nos subtítulos e dropdowns.

---

## 🔍 Detalhamento Técnico das Issues Encontradas

---

### 🔴 `ISSUE-M1-01` — Divergência nos Dados Iniciais (`initialState.js`) entre Tabela (`2/3 parc.`) e Modal (`Parcela 2/12`)
* **Severidade:** Crítica (Integridade de Dados & Matemática)
* **Arquivos Afetados:** `src/data/initialState.js` e `src/components/CommitmentsView.jsx` (linhas 78–81 e 111)
* **Simulação Realizada:**
  * Ao abrir a aba **Parcelados e Fixas** com os dados padrão:
    * `Aluguel + Condomínio` exibe na tabela `Valor Total: R$ 7.200,00` e `Progresso: 2/3 parc. (67%)`, mas ao clicar no ícone 👁️ (*Ver Cronograma*), as linhas mostram `Parcela 2/12`, `Parcela 3/12` e `Parcela 4/12` e prazo `10/08/2027`.
    * `Geladeira Brastemp` exibe `R$ 1.800,00` e `1/3 parc. (33%)`, mas no modal mostra `Parcela 2/8`, `3/8`, `4/8`.
    * `Internet Fibra` exibe `R$ 960,00` e `0/2 parc.`, mas no modal mostra `Parcela 3/12` e `4/12`.
    * `Pacote Resort` exibe `R$ 1.800,00` e `2/4 parc.`, mas no modal mostra `Entrada Inicial` + `Parcela 1/6`, `2/6`, `3/6`.
* **Causa-Raiz:**
  * `initialState.js` cadastrou apenas 2 a 4 transações de exemplo em `state.transactions` para cada compromisso, embora os contratos tenham `installmentsCount` de `12`, `8` e `6`.
  * Em `CommitmentsView.jsx`, `totalScheduled` soma apenas `linked` (`linked.reduce(...)`) e `totalInstallmentsCount` usa `linked.length`, ignorando as demais parcelas previstas no contrato.
* **Solução Proposta:**
  * Gerar em `initialState.js` o cronograma completo de parcelas de cada compromisso inicial (ex.: `1/4` a `4/4`, `1/8` a `8/8`, etc.) para que a soma de `transactions` bata 100% com `totalAmount` e `installmentsCount`.

---

### 🔴 `ISSUE-M1-02` — Compra com Entrada Inicial soma `+1` no denominador (`1/5 parc.` em compra de `4x`) e exibe `"Parcela 0/4"`
* **Severidade:** Crítica (Matemática & UX)
* **Arquivos Afetados:** `src/components/CommitmentsView.jsx` (linhas 91, 111, 426), `src/components/TransactionsView.jsx` (linha 325) e `src/components/CardsView.jsx` (linha 361)
* **Simulação Realizada:**
  * Criamos o compromisso `Notebook Gamer` com Valor Total `R$ 5.000,00`, Entrada Inicial `R$ 1.000,00` e `4x` parcelas no `Inter Platinum`.
  * Na tabela de **Parcelados e Fixas**, a coluna *Progresso* exibiu **`1/5 parc. (20%)`** em vez de indicar `0/4 parc. (+ Entrada paga)`.
  * Na tabela de **Lançamentos do Mês** e no modal **Ver Fatura** do cartão, a entrada apareceu rotulada como **`Parcela 0/4`** (`0/4`).
* **Causa-Raiz:**
  * A entrada é salva como uma transação com `installmentNumber: 0` e `totalInstallments: 4`.
  * `CommitmentsView.jsx` calcula `totalInstallmentsCount: linked.length` (`1 entrada + 4 parcelas = 5`).
  * `TransactionsView.jsx` e `CardsView.jsx` checam apenas `tx.totalInstallments ? "Parcela X/Y" : ...`, sem tratar `tx.installmentNumber === 0` como `"Entrada Inicial"`.
* **Solução Proposta:**
  * Em `TransactionsView.jsx` e `CardsView.jsx`, exibir `"Entrada Inicial"` quando `tx.installmentNumber === 0`.
  * Em `CommitmentsView.jsx`, separar a contagem de parcelas regulares (`installmentNumber > 0`) da entrada inicial (`installmentNumber === 0`), mantendo o progresso em R\$ fiel (`totalPaid / totalScheduled`), mas exibindo na etiqueta de parcelas `X/4 parc.` (ou `Entrada + X/4`).

---

### 🔴 `ISSUE-M1-03` — Entrada Inicial (`#0`) é lançada na Fatura do Cartão de Crédito já com status `Pago`
* **Severidade:** Crítica (Regra de Negócio Financeira)
* **Arquivos Afetados:** `src/App.jsx` (linhas 271–293) e `src/components/CommitmentsView.jsx`
* **Simulação Realizada:**
  * Ao criar `Notebook Gamer` (`R$ 5.000`, Entrada `R$ 1.000`, `4x` no cartão `Inter Platinum`), a transação `Notebook Gamer (Entrada)` recebeu `cardId: 'card-inter'`, `paymentMethod: 'Cartão de Crédito'` e `status: 'paid'`.
  * Em **Cartões e Faturas**, o destaque `Fatura de Novembro` do Inter subiu em `+R$ 1.000,00` (`R$ 2.653,33`), enquanto o badge mostrava `Aberta (R$ 1.620,00)`.
* **Causa-Raiz:**
  * `handleAddCommitment` em `src/App.jsx` atribui `cardId: commRecord.cardId` inclusive para a parcela `inst.number === 0` (Entrada Inicial), ao mesmo tempo em que define `status: 'paid'`.
* **Solução Proposta:**
  * A Entrada Inicial (`inst.number === 0`) paga no ato da compra deve ser registrada como pagamento à vista fora do limite/fatura do cartão (`paymentMethod: 'PIX'`, `cardId: ''`, `status: 'paid'`) — ou permitir escolher o meio da entrada, evitando inflar indevidamente a fatura mensal do cartão de crédito com um valor já quitado.

---

### 🔴 `ISSUE-M1-04` — Impossibilidade de criar `Conta Fixa Mensal` no Cartão de Crédito e divisão indevida do valor mensal
* **Severidade:** Crítica (Funcionalidade & Matemática)
* **Arquivos Afetados:** `src/components/CommitmentsView.jsx` (linhas 131–173 e 532–559)
* **Simulação Realizada:**
  * Tentamos cadastrar `Academia Casal` (`Conta Fixa Recorrente`, `R$ 200,00/mês` durante `6 meses`).
  * **Problema 1:** Quando `Onde foi feito o gasto?` é `Cartão de Crédito`, o campo `Tipo de Compromisso` (`Compra Parcelada` vs. `Conta Fixa Mensal`) é ocultado do modal (substituído pelo seletor de cartão), tornando impossível criar uma assinatura/conta fixa recorrente no cartão!
  * **Problema 2:** Mesmo mudando para `PIX` e escolhendo `Conta Fixa Mensal`, o formulário exige `"Valor Total da Compra / Compromisso (R$)"` e divide `R$ 200,00 / 6`, gerando 6 parcelas de `R$ 33,33` em vez de 6 mensalidades fixas de `R$ 200,00` (Total `R$ 1.200,00`).
* **Causa-Raiz:**
  * Renderização condicional mutuamente exclusiva entre `Qual Cartão foi utilizado?` e `Tipo de Compromisso` nas linhas 532–559.
  * `installmentPreview` sempre divide `totalAmount / count`, sem diferenciar se `form.type === 'recurring'` (onde o usuário informa o valor da mensalidade fixa e o total é `mensalidade * meses`).
* **Solução Proposta:**
  * Exibir sempre o seletor `Tipo de Compromisso` (`Compra Parcelada` vs. `Conta Fixa Mensal`), inclusive para Cartão de Crédito.
  * Quando `form.type === 'recurring'`, alterar o rótulo do campo para `"Valor Mensal da Conta Fixa (R$)"` e multiplicar pelo número de meses (`totalAmount = monthlyValue * count`), gerando N mensalidades iguais ao valor informado.

---

### 🟠 `ISSUE-M1-05` — Marcar `"Possui valor de entrada inicial?"` com valor vazio/zero já desloca a 1ª parcela para o mês seguinte
* **Severidade:** Média (Matemática de Datas)
* **Arquivo Afetado:** `src/components/CommitmentsView.jsx` (linha 158)
* **Simulação Realizada:**
  * No modal *Novo Parcelamento*, antes de digitar qualquer valor no campo `Valor de Entrada (R$)`, apenas marcar o checkbox `"Possui valor de entrada inicial?"` fez a `Parcela 1` pular de `15/11/2026` para `15/12/2026`.
* **Causa-Raiz:**
  * A linha 158 usa `addMonthsToDate(form.startDate, form.hasDownPayment ? i : i - 1)` em vez de checar `const hasValidDown = form.hasDownPayment && effectiveDownPayment > 0`.
* **Solução Proposta:**
  * Deslocar as parcelas em `+1 mês` apenas quando `form.hasDownPayment && effectiveDownPayment > 0`.

---

### 🟠 `ISSUE-M1-06` — Clicar em `"Dar Baixa Agora"` dentro do modal de Cronograma (👁️) fecha o modal imediatamente
* **Severidade:** Média (UX / Anti-Atrito)
* **Arquivo Afetado:** `src/components/CommitmentsView.jsx` (linhas 22, 443, 706 e 759–762)
* **Simulação Realizada:**
  * Ao clicar no ícone 👁️ de um compromisso e clicar em `Dar Baixa Agora` em uma das parcelas, o modal fecha imediatamente, obrigando o usuário a clicar no 👁️ de novo se quiser quitar outra parcela ou conferir o novo progresso.
* **Causa-Raiz:**
  * `selectedDetails` armazena o objeto estático (`item`) em vez do `id` (`selectedDetailsId`), e o `onClick` chama `setSelectedDetails(null)`.
* **Solução Proposta:**
  * Guardar apenas `selectedDetailsId` no estado e derivar `selectedDetails = enrichedCommitments.find(c => c.id === selectedDetailsId)`, mantendo o modal aberto e atualizando seus KPIs e status em tempo real ao dar baixa.

---

### 🔴 `ISSUE-M1-07` — Excluir uma parcela individual em "Lançamentos do Mês" encolhe o Valor Total do contrato em "Parcelados e Fixas"
* **Severidade:** Crítica (Sincronização Cruzada)
* **Arquivos Afetados:** `src/App.jsx` (`handleDeleteTransaction`, linhas 217–223) e `src/components/CommitmentsView.jsx` (linhas 78–114)
* **Simulação Realizada:**
  * Criamos `Teste Dízima 100 em 3x` (`R$ 100,00` -> `33,33 + 33,33 + 33,34`).
  * Em **Lançamentos do Mês**, excluímos a parcela 1 (`R$ 33,33`).
  * Em **Parcelados e Fixas**, o `Valor Total` da compra caiu para `R$ 66,67` e o progresso virou `0/2 parc.`, enquanto no modal 👁️ as parcelas restantes continuaram numeradas como `Parcela 2/3` e `Parcela 3/3`.
* **Causa-Raiz:**
  * `handleDeleteTransaction` apaga a transação sem renumerar as parcelas irmãs nem atualizar `commitment.totalAmount` / `installmentsCount` (ou sem perguntar se o usuário deseja excluir apenas a parcela ou recalcular o compromisso).
* **Solução Proposta:**
  * Quando o usuário excluir uma parcela vinculada a um `commitmentId` em `TransactionsView`, atualizar automaticamente a numeração (`installmentNumber` / `totalInstallments`), o `totalAmount` e o `endDate` do compromisso correspondente em `state.commitments` (e remover o `commitment` caso todas as suas parcelas tenham sido excluídas).

---

### 🔴 `ISSUE-M1-08` — Data de pagamento (`paidDate`) travada (hardcoded) em `'2026-11-11'` mesmo em outros meses
* **Severidade:** Crítica (Consistência Temporal)
* **Arquivos Afetados:** `src/App.jsx` (linhas 200 e 362) e `src/components/TransactionsView.jsx` (linhas 22, 93 e 383)
* **Simulação Realizada:**
  * Navegamos para **Dezembro de 2026** e quitamos uma parcela com vencimento em `18/12/2026`. O sistema gravou `paidDate: '2026-11-11'` (um mês antes da existência da fatura!).
* **Causa-Raiz:**
  * A data `'2026-11-11'` está hardcoded em `handleQuickPayTransaction`, `handlePayFullCardInvoice` e `TransactionsView`.
* **Solução Proposta:**
  * Utilizar a própria data de vencimento da transação (`tx.dueDate`) ou uma função utilitária baseada no `selectedMonth` ativo / data atual como padrão para `paidDate`.

---

### 🟠 `ISSUE-M1-09` — Trocar o Cartão dentro do modal `+ Novo Gasto` pode sobrescrever o mês escolhido na data
* **Severidade:** Média (UX em Formulário)
* **Arquivo Afetado:** `src/App.jsx` (`handleSelectCardInTxModal`, linhas 149–163)
* **Simulação Realizada:**
  * Ao abrir `+ Novo Gasto`, editar a data e trocar o cartão no dropdown, é necessário garantir que o `YYYY-MM` digitado no campo de data seja sempre preservado, trocando apenas o dia (`DD`) pelo `dueDay` do novo cartão.

---

### 🔴 `ISSUE-M1-10` — Editar o Dia de Vencimento de um cartão (`Editar Cartão`) não atualiza `Última Parcela (Prazo)` em Parcelados e Fixas
* **Severidade:** Crítica (Sincronização Cruzada Cartões ↔ Parcelados)
* **Arquivos Afetados:** `src/App.jsx` (`handleUpdateCard`, linhas 327–344) e `src/components/CommitmentsView.jsx` (linhas 94–98)
* **Simulação Realizada:**
  * Em **Cartões e Faturas**, editamos o `Inter Platinum` mudando o vencimento do dia `15` para o dia `18`.
  * Em **Lançamentos do Mês**, todas as parcelas pendentes mudaram para o dia `18`.
  * Porém, em **Parcelados e Fixas**, a coluna **Última Parcela (Prazo)** continuou exibindo `15/03/2027` e `15/01/2027`! No modal 👁️, o topo mostrava `Prazo final: 15/03/2027` enquanto a última parcela abaixo mostrava `Vencimento: 18/03/2027`.
* **Causa-Raiz:**
  * `CommitmentsView.jsx` (linha 94) faz `const computedEndDate = c.endDate || (linked.length > 0 ? linked[linked.length - 1].dueDate : ...)`. Como `c.endDate` foi gravado na criação com dia `15` e `handleUpdateCard` não atualizou `c.endDate`, o valor antigo prevaleceu sobre a data real da última parcela!
* **Solução Proposta:**
  * Em `CommitmentsView.jsx`, priorizar a data real da última parcela (`linked.length > 0 ? linked[linked.length - 1].dueDate : c.endDate`).
  * Em `handleUpdateCard` (`src/App.jsx`), atualizar também `startDate` e `endDate` dos `commitments` vinculados àquele cartão.

---

### 🔴 `ISSUE-M1-11` — Exclusão de Cartão (`Remover cartão`) sem confirmação e deixando compras/parcelas órfãs
* **Severidade:** Crítica (Integridade Referencial)
* **Arquivo Afetado:** `src/App.jsx` (`handleDeleteCard`, linhas 346–352) e `src/components/CardsView.jsx` (linha 290)
* **Simulação Realizada:**
  * Clicar em `Remover cartão` no *Nubank Chroma* excluiu o cartão instantaneamente sem confirmação.
  * Todos os compromissos e parcelas vinculados a `card-nubank` ficaram com `cardId` órfão, perdendo o badge do cartão e sumindo do filtro de cartões.
* **Solução Proposta:**
  * Exigir confirmação antes de excluir um cartão e, caso possua lançamentos/compromissos vinculados, migrá-los para outro cartão ou limpar `cardId` atualizando `paymentMethod` de forma consistente.

---

### 🟠 `ISSUE-M1-12` — Conflito visual entre `"Fatura de [Mês]"` e `"Aberta (R$)"` quando um item de cartão é pago individualmente
* **Severidade:** Média (Clareza Financeira)
* **Arquivo Afetado:** `src/components/CardsView.jsx` (linhas 62–73 e 201–220)
* **Simulação Realizada:**
  * Quando uma parcela de cartão está com `status: 'paid'` no mês e outras estão `pending`, o card mostra `Fatura de Novembro: R$ 2.653,33` e ao lado `Aberta (R$ 1.620,00)`, sem explicitar quanto já foi pago/adiantado daquela fatura.
* **Solução Proposta:**
  * Quando houver parte paga e parte pendente na fatura do mês, exibir subtítulo claro: `"Já pago/abatido: R$ X · Restante em aberto: R$ Y"`.

---

### 🟠 `ISSUE-M1-13` — A aba "Cartões e Faturas" ignora o Filtro Global de Titular (`ownerFilter`) da Barra Superior
* **Severidade:** Média (Consistência de Filtros Globais)
* **Arquivo Afetado:** `src/components/CardsView.jsx` (linhas 26 e 56–98)
* **Simulação Realizada:**
  * Ao selecionar `Beatriz` ou `Wesley` no filtro global da Topbar, *Parcelados e Fixas* e *Lançamentos do Mês* filtram seus itens, mas *Cartões e Faturas* continua mostrando todos os cartões sem filtrar por titular.
* **Solução Proposta:**
  * Respeitar `state.ownerFilter` em `CardsView.jsx` (exibindo os cartões do titular filtrado ou filtrando os lançamentos da fatura quando um filtro específico estiver ativo).

---

### 🟡 `ISSUE-M1-14` — Textos fixos (hardcoded) citando `"Inter Platinum ou Nubank Chroma"` nos cabeçalhos e selects
* **Severidade:** Baixa (UX / Dinamismo)
* **Arquivos Afetados:** `src/components/CommitmentsView.jsx` (linhas 258–259, 525), `src/components/TransactionsView.jsx` (linhas 128–129) e `src/App.jsx` (linha 943)
* **Simulação Realizada:**
  * Mesmo renomeando ou alterando os cartões cadastrados, os textos de cabeçalho e o `<option value="Cartão de Crédito">💳 Cartão de Crédito (Inter / Nubank)</option>` permanecem estáticos.
* **Solução Proposta:**
  * Gerar os nomes dos cartões dinamicamente a partir de `state.cards` (ex.: `cards.map(c => c.name).join(' / ')`) ou usar rótulo neutro.

