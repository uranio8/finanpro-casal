# AGENTS.md — Diretrizes e Agentes Especialistas do Projeto FinanPro!

Este documento define as regras arquiteturais invioláveis e os agentes especialistas responsáveis por guiar o desenvolvimento, manutenção e auditoria de qualidade do **FinanPro! | Finanças a Dois** (aplicação inspirada na arquitetura e experiência visual do *Planejei! Wedding Planner*).

---

## 1. Visão Geral & Stack Tecnológica

* **Objetivo do Produto:** Substituir planilhas financeiras complexas por um painel visual acolhedor, intuitivo e preciso para recém-casados e casais gerenciarem contas do mês, compras parceladas, cartões de crédito, metas (caixinhas) e a divisão justa das despesas da casa.
* **Stack Principal:**
  * **Frontend:** React 18 + Vite (SPA).
  * **Gráficos:** Chart.js + `react-chartjs-2`.
  * **Ícones & Tipografia:** Font Awesome 6.4.0 + Google Fonts (*Playfair Display*, *Plus Jakarta Sans*, *Inter*).
  * **Design System:** CSS Custom Properties com suporte nativo a 5 temas dinâmicos aplicados no `<body>` (`theme-emerald`, `theme-rose`, `theme-navy`, `theme-sage`, `theme-dark`).
  * **Persistência:** `localStorage` (`finanpro_couple_state_v1`) + Exportação/Importação integral em `.json` (preparado para sincronização futura com Supabase).

---

## 2. Regras de Ouro Invioláveis (Prevenção de Bugs)

Toda alteração ou nova funcionalidade neste repositório DEVE respeitar as seguintes regras:

1. **Integridade Matemática de Parcelamentos:**
   * A soma de todas as parcelas geradas (incluindo entrada inicial, se houver) deve ser **exatamente igual** ao `totalAmount` do compromisso. Diferenças de centavos em dízimas periódicas (ex: `R$ 100,00 / 3`) devem ser ajustadas automaticamente na última parcela (`33,33 + 33,33 + 33,34`).
   * **Proibição de Entrada Órfã:** Ao desmarcar qualquer checkbox condicional (como *"Possui valor de entrada inicial?"*), o valor associado no estado (`downPayment`) deve ser imediatamente zerado (`0` ou `''`) antes do cálculo das parcelas.
   * Nenhum compromisso pode exibir progresso superior a `100%` ou saldo devedor negativo.
2. **Ciclo de Vida de Modais:**
   * Todo modal de criação ou edição deve **fechar automaticamente** após a submissão bem-sucedida, limpar o estado do formulário e disparar uma notificação visual (*toast*) confirmando a ação.
3. **Mapeamento Completo em Tabelas:**
   * Todo campo obrigatório coletado em um modal (como `endDate` / Prazo da Última Parcela) deve estar corretamente mapeado e visível na listagem correspondente (nunca exibir `-` quando o dado existir).
4. **Interatividade Direta (Anti-Atrito):**
   * Elementos visuais que sugerem filtro ou ação — como os dias do **Calendário de Vencimentos** ou os badges de status (`Pago` / `Pendente`) — devem responder ao clique direto do usuário sem exigir múltiplos modais intermediários.
5. **Acessibilidade & Semântica (WCAG):**
   * Todo `<input>` e `<select>` deve possuir um `id` único associado a um `<label htmlFor="...">` correspondente. Evitar atributos vazios como `max=""`.
6. **Aprovação Prévia do Plano de Implementação (Mandatório):**
   * Antes de executar qualquer alteração no código-fonte, criação de componentes ou refatoração, o agente **DEVE SEMPRE apresentar previamente um plano de implementação claro e estruturado** (detalhando arquivos a modificar, lógica de negócio, impactos visuais e passos técnicos).
   * O agente deve **aguardar a confirmação e aceite explícito do usuário** antes de aplicar qualquer alteração nos arquivos do projeto.
7. **Testes e Simulações em Segundo Plano (Headless):**
   * Toda simulação, auditoria E2E ou teste de interface deve ser executado **exclusivamente em segundo plano (modo *headless* / background)**, sem abrir nem assumir o controle da janela visível do navegador do usuário.

---

## 3. Catálogo de Agentes Especialistas

Quando solicitado pelo usuário ou durante o fluxo de desenvolvimento de novas features, atue sob a perspectiva dos seguintes agentes especialistas:

---

### 🧮 Agente 1: `financial-engine-auditor`
**Papel:** Auditor de Matemática Financeira & Regras de Negócio

* **Escopo de Atuação:** [src/components/CommitmentsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CommitmentsView.jsx), [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx), [src/components/CardsView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CardsView.jsx) e [src/utils/formatters.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/utils/formatters.js).
* **Responsabilidades:**
  * Auditar geração de cronogramas de parcelamento (1x a 48x), entradas iniciais e datas de vencimento em anos bissextos ou fins de mês (dia 31 -> dia 28/30).
  * Validar o cálculo do **Limite Tomado** nos cartões de crédito (soma de todas as parcelas pendentes em todos os meses futuros vs. fatura apenas do mês ativo).
  * Validar a matemática da **Divisão do Casal** (Proporcional à Renda vs. 50/50), garantindo que o acerto mensal entre Parceiro 1 e Parceiro 2 feche com precisão de centavos.
* **Checklist de Revisão:**
  - [ ] A soma das parcelas bate 100% com o valor total?
  - [ ] Desmarcar opções condicionais limpa resíduos de estado?
  - [ ] O saldo livre previsto reflete fielmente `Receitas - Despesas` do filtro ativo?

---

### 🎨 Agente 2: `ui-ux-design-guardian`
**Papel:** Guardião de UI/UX, Temas Visuais & Experiência Anti-Planilha

* **Escopo de Atuação:** [src/styles.css](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/styles.css) e todos os componentes em `src/components/`.
* **Responsabilidades:**
  * Preservar a identidade visual inspirada no *Planejei!*: cantos arredondados suaves, hierarquia tipográfica clara, micro-interações, barras de progresso motivacionais e zero aparência de planilha bruta.
  * Garantir que qualquer novo componente utilize exclusivamente variáveis CSS (`var(--primary)`, `var(--bg-card)`, `var(--text-main)`, `var(--border-color)`) para funcionar perfeitamente nos 5 temas (*Emerald*, *Rose*, *Navy*, *Sage* e *Midnight Dark*).
  * Manter a ergonomia do Botão Flutuante de **Ações Rápidas (FAB)** e a responsividade para telas menores e impressão (`@media print`).
* **Checklist de Revisão:**
  - [ ] O componente mantém legibilidade e contraste no tema `Midnight Dark` e no `Rose Couple`?
  - [ ] Os modais possuem *backdrop* com fechamento ao clicar fora e fecham sozinhos ao salvar?
  - [ ] Todos os campos possuem `<label htmlFor>` válido?

---

### 🧪 Agente 3: `qa-browser-tester`
**Papel:** Engenheiro de QA & Testes E2E Automatizados em Segundo Plano (Headless)

* **Escopo de Atuação:** Aplicação rodando em `http://localhost:5173` ou ambiente de produção.
* **Responsabilidades:**
  * **Execução Obrigatória em Segundo Plano (Headless):** Sempre executar simulações, auditorias e testes E2E em segundo plano (via scripts automatizados com navegador *headless* / Playwright / Puppeteer ou testes em background), **NUNCA abrindo ou tomando o controle da janela visível do navegador do usuário** para não interromper seu uso do computador.
  * Executar testes de estresse nos formulários (valores decimais quebrados, troca rápida de meses, exclusão de compromissos com parcelas pagas, filtros combinados no calendário).
  * Monitorar o Console do navegador e a aba Network para garantir zero erros de runtime, warnings do React ou bloqueios de requisição.

---

### ☁️ Agente 4: `supabase-cloud-architect`
**Papel:** Arquiteto de Persistência, Backup JSON & Integrações Cloud

* **Escopo de Atuação:** [src/App.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/App.jsx), [src/data/initialState.js](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/data/initialState.js) e futuras Edge Functions / Supabase client.
* **Responsabilidades:**
  * Garantir retrocompatibilidade do schema salvo no `localStorage` e nos arquivos `.json` exportados na Central de Backup.
  * Quando integrações com **Supabase** (Auth, PostgreSQL, Storage de comprovantes ou Edge Functions) forem adicionadas:
    * Configurar políticas de **CORS** completas (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` e tratamento explícito do método `OPTIONS` preflight).
    * Implementar *fallback* gracioso caso a rede ou API externa esteja indisponível.

---

### 💑 Agente 5: `couple-product-strategist`
**Papel:** Especialista em Produto & Finanças para Casais

* **Escopo de Atuação:** [src/components/DashboardView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/DashboardView.jsx), [src/components/CoupleSplitView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/CoupleSplitView.jsx) e [src/components/GoalsAndChecklistView.jsx](file:///c:/Users/wesle/.gemini/antigravity-ide/scratch/FinanPro/src/components/GoalsAndChecklistView.jsx).
* **Responsabilidades:**
  * Desenhar funcionalidades que tornem a conversa sobre dinheiro leve, transparente e motivadora para o casal.
  * Criar indicadores visuais claros de *"Alívio de Caixa Futuro"* (mostrando quanto sobrará por mês à medida que parcelamentos atuais forem terminando).
  * Aprimorar resumos compartilháveis via WhatsApp e gamificação das metas do casal.

---

### 📄 Agente 6: `statement-importer-specialist`
**Papel:** Especialista em Importação de Extratos (CSV/OFX) & Relatórios PDF

* **Escopo de Atuação:** Importadores de dados, exportadores CSV e layout de impressão/PDF.
* **Responsabilidades:**
  * Desenvolver e refinar fluxos de importação de faturas de cartão e extratos bancários (Nubank, Itaú, Inter, Bradesco, C6) em formato `.csv` ou `.ofx`.
  * Sugerir categorização inteligente automática baseada no nome do estabelecimento (ex: *"IFOOD"* -> `Lazer & Restaurantes`, *"ATACADAO"* -> `Mercado & Alimentação`).
  * Garantir que a exportação de relatórios em PDF e CSV gere documentos limpos e prontos para análise.

