export const CATEGORIES = [
  { id: 'dizimo', name: 'Dízimo & Ofertas (Igreja)', icon: 'fa-hands-praying', color: '#059669' },
  { id: 'moradia', name: 'Moradia & Contas Fixas', icon: 'fa-house-chimney', color: '#10b981' },
  { id: 'mercado', name: 'Mercado & Alimentação', icon: 'fa-cart-shopping', color: '#f59e0b' },
  { id: 'transporte', name: 'Transporte & Combustível', icon: 'fa-car', color: '#3b82f6' },
  { id: 'lazer', name: 'Lazer & Restaurantes', icon: 'fa-utensils', color: '#ec4899' },
  { id: 'eletro', name: 'Casa, Móveis & Eletros', icon: 'fa-couch', color: '#8b5cf6' },
  { id: 'saude', name: 'Saúde & Farmácia', icon: 'fa-heart-pulse', color: '#ef4444' },
  { id: 'assinaturas', name: 'Assinaturas & Serviços', icon: 'fa-tv', color: '#06b6d4' },
  { id: 'viagens', name: 'Viagens & Sonhos', icon: 'fa-plane-departure', color: '#f97316' },
  { id: 'outros', name: 'Outros Gastos', icon: 'fa-layer-group', color: '#64748b' }
];

export const INCOME_CATEGORIES = [
  { id: 'salario', name: 'Salário / Pró-labore', icon: 'fa-briefcase', color: '#10b981' },
  { id: 'aula', name: 'Aulas Particulares', icon: 'fa-chalkboard-user', color: '#3b82f6' },
  { id: 'venda', name: 'Vendas & Comércio', icon: 'fa-bag-shopping', color: '#8b5cf6' },
  { id: 'extra', name: 'Renda Extra / Freelance', icon: 'fa-bolt', color: '#06b6d4' },
  { id: 'rendimentos', name: 'Rendimentos / Dividendos', icon: 'fa-chart-line', color: '#f59e0b' }
];

export const THEMES = [
  {
    id: 'theme-emerald',
    name: 'Emerald Finance',
    subtitle: 'Verde Esmeralda Sofisticado',
    primary: '#059669',
    accent: '#d1fae5',
    bg: '#f8fafc'
  },
  {
    id: 'theme-rose',
    name: 'Rose Couple (Planejei!)',
    subtitle: 'Clássico Romântico Acolhedor',
    primary: '#e11d48',
    accent: '#ffe4e6',
    bg: '#fffbfa'
  },
  {
    id: 'theme-navy',
    name: 'Ocean Navy',
    subtitle: 'Azul Executivo Moderno',
    primary: '#2563eb',
    accent: '#dbeafe',
    bg: '#f8fafc'
  },
  {
    id: 'theme-sage',
    name: 'Verde Sálvia',
    subtitle: 'Natural, Suave & Minimalista',
    primary: '#4d7c0f',
    accent: '#ecfccb',
    bg: '#fafaf9'
  },
  {
    id: 'theme-dark',
    name: 'Midnight Dark',
    subtitle: 'Modo Escuro Confortável',
    primary: '#10b981',
    accent: '#1e293b',
    bg: '#0f172a'
  }
];

export const INITIAL_STATE = {
  version: '1.2.0',
  selectedMonth: '2026-11',
  ownerFilter: 'all', // 'all' | 'joint' | 'partner1' | 'partner2'
  couple: {
    partner1Name: 'Wesley',
    partner2Name: 'Beatriz',
    partner1Income: 6500,
    partner2Income: 5500,
    titheEnabled: true,
    tithePercent: 10, // 10% Dízimo bíblico padrão
    partner1OfferingPercent: 5, // % da oferta sobre salário do Wesley
    partner2OfferingPercent: 5, // % da oferta sobre salário da Beatriz
    donationAmount: 0, // Doações adicionais / esporádicas fora dízimo e oferta
    includeExtraInTithe: true, // Calcular Dízimo + Oferta também sobre a Renda Extra
    splitMode: 'unified', // 'unified' (Sem Proporção / Tudo Junto) | 'proportional' | 'equal'
    theme: 'theme-emerald',
    monthlySavingsTarget: 2500
  },
  monthlyIncomes: {
    '2026-11': {
      partner1Income: 5900,
      partner2Income: 700,
      donationAmount: 0
    },
    '2026-10': {
      partner1Income: 6500,
      partner2Income: 5500,
      donationAmount: 0
    }
  },
  categoryBudgets: {
    dizimo: 1950,
    moradia: 3200,
    mercado: 1600,
    transporte: 900,
    lazer: 800,
    eletro: 1000,
    saude: 650,
    assinaturas: 350,
    viagens: 600,
    outros: 400
  },
  extraIncomes: [
    {
      id: 'ext-1',
      title: 'Aula Particular — Cálculo / Matemática (Aluno Pedro)',
      type: 'class',
      studentOrClient: 'Pedro Henrique',
      weekOfMonth: 'Semana 1',
      date: '2026-11-04',
      hoursOrQty: 3,
      unitPrice: 90,
      amount: 270,
      owner: 'partner1',
      status: 'received',
      applyTitheAndOffering: true,
      notes: 'Pacote de 3h preparatório para prova.'
    },
    {
      id: 'ext-2',
      title: 'Aula Particular — Física & Exatas (Aluna Mariana)',
      type: 'class',
      studentOrClient: 'Mariana Costa',
      weekOfMonth: 'Semana 2',
      date: '2026-11-10',
      hoursOrQty: 4,
      unitPrice: 85,
      amount: 340,
      owner: 'partner1',
      status: 'received',
      applyTitheAndOffering: true,
      notes: 'Duas aulas duplas na semana.'
    },
    {
      id: 'ext-3',
      title: 'Aula Particular — Reforço Semanal (Aluno Lucas)',
      type: 'class',
      studentOrClient: 'Lucas Almeida',
      weekOfMonth: 'Semana 2',
      date: '2026-11-12',
      hoursOrQty: 2,
      unitPrice: 90,
      amount: 180,
      owner: 'partner1',
      status: 'pending',
      applyTitheAndOffering: true,
      notes: 'A receber na sexta-feira via Pix.'
    },
    {
      id: 'ext-4',
      title: 'Venda de Kit / Encomenda Especial',
      type: 'sale',
      studentOrClient: 'Cliente Instagram',
      weekOfMonth: 'Semana 2',
      date: '2026-11-09',
      hoursOrQty: 2,
      unitPrice: 160,
      amount: 320,
      owner: 'partner2',
      status: 'received',
      applyTitheAndOffering: true,
      notes: 'Venda paga à vista no Pix.'
    },
    {
      id: 'ext-5',
      title: 'Intensivo de Revisão Final de Mês (Turma Dupla)',
      type: 'class',
      studentOrClient: 'Gabriel & Sofia',
      weekOfMonth: 'Semana 3',
      date: '2026-11-19',
      hoursOrQty: 3,
      unitPrice: 120,
      amount: 360,
      owner: 'partner1',
      status: 'pending',
      applyTitheAndOffering: true,
      notes: 'Agendado para quinta-feira à noite.'
    }
  ],
  cards: [
    {
      id: 'card-inter',
      name: 'Inter Platinum (Wesley)',
      brand: 'Mastercard Platinum',
      owner: 'partner1',
      limit: 10000,
      closingDay: 8,
      dueDay: 15,
      color: '#ea580c'
    },
    {
      id: 'card-nubank',
      name: 'Nubank Chroma Platinum (Beatriz)',
      brand: 'Mastercard Platinum',
      owner: 'partner2',
      limit: 12000,
      closingDay: 15,
      dueDay: 22,
      color: '#6d28d9'
    }
  ],
  commitments: [
    {
      id: 'comm-1',
      title: 'Aluguel + Condomínio',
      category: 'moradia',
      type: 'recurring',
      totalAmount: 2400,
      downPayment: 0,
      installmentsCount: 12,
      startDate: '2026-09-10',
      endDate: '2027-08-10',
      paymentMethod: 'PIX',
      cardId: '',
      owner: 'joint',
      paidBy: 'partner1',
      notes: 'Vencimento todo dia 10 com desconto de pontualidade.'
    },
    {
      id: 'comm-2',
      title: 'Geladeira Brastemp Inverse Inox',
      category: 'eletro',
      type: 'installment',
      totalAmount: 4800,
      downPayment: 0,
      installmentsCount: 8,
      startDate: '2026-09-22',
      endDate: '2027-04-22',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      owner: 'joint',
      paidBy: 'partner2',
      notes: 'Comprada no Nubank Chroma em 8x sem juros para acumular pontos.'
    },
    {
      id: 'comm-3',
      title: 'Seguro Anual do Carro',
      category: 'transporte',
      type: 'installment',
      totalAmount: 2400,
      downPayment: 0,
      installmentsCount: 4,
      startDate: '2026-10-15',
      endDate: '2027-01-15',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      owner: 'partner1',
      paidBy: 'partner1',
      notes: 'Parcelado no Inter Platinum (Wesley) em 4x.'
    },
    {
      id: 'comm-4',
      title: 'Internet Fibra 600MB + Energia + Água',
      category: 'moradia',
      type: 'recurring',
      totalAmount: 480,
      downPayment: 0,
      installmentsCount: 12,
      startDate: '2026-09-15',
      endDate: '2027-08-15',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      owner: 'joint',
      paidBy: 'partner1',
      notes: 'Contas da casa concentradas no Inter Platinum para pontuar.'
    },
    {
      id: 'comm-5',
      title: 'Pacote Resort Aniversário de Casamento',
      category: 'viagens',
      type: 'installment',
      totalAmount: 3000,
      downPayment: 600,
      installmentsCount: 6,
      startDate: '2026-10-22',
      endDate: '2027-03-22',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      owner: 'joint',
      paidBy: 'partner2',
      notes: 'Entrada de R$ 600 no Pix + 6x de R$ 400 no Nubank Chroma.'
    }
  ],
  transactions: [
    // RECEITAS NOVEMBRO 2026
    {
      id: 'tx-inc-1',
      title: 'Salário Mensal — Wesley',
      type: 'income',
      category: 'salario',
      amount: 6500,
      dueDate: '2026-11-05',
      paidDate: '2026-11-05',
      status: 'paid',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'PIX'
    },
    {
      id: 'tx-inc-2',
      title: 'Salário Mensal — Beatriz',
      type: 'income',
      category: 'salario',
      amount: 5500,
      dueDate: '2026-11-05',
      paidDate: '2026-11-05',
      status: 'paid',
      owner: 'partner2',
      paidBy: 'partner2',
      paymentMethod: 'PIX'
    },

    // DÍZIMO E OFERTAS NOVEMBRO 2026
    {
      id: 'tx-diz-1',
      title: 'Dízimo (10%) + Oferta (5%) — Salário Wesley',
      type: 'expense',
      category: 'dizimo',
      amount: 975,
      dueDate: '2026-11-06',
      paidDate: '2026-11-06',
      status: 'paid',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'PIX'
    },
    {
      id: 'tx-diz-2',
      title: 'Dízimo (10%) + Oferta (5%) — Salário Beatriz',
      type: 'expense',
      category: 'dizimo',
      amount: 825,
      dueDate: '2026-11-06',
      paidDate: '2026-11-06',
      status: 'paid',
      owner: 'partner2',
      paidBy: 'partner2',
      paymentMethod: 'PIX'
    },

    // OUTUBRO 2026 (Histórico)
    {
      id: 'tx-oct-1',
      commitmentId: 'comm-1',
      title: 'Aluguel + Condomínio',
      type: 'expense',
      category: 'moradia',
      amount: 2400,
      dueDate: '2026-10-10',
      paidDate: '2026-10-09',
      status: 'paid',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'PIX',
      installmentNumber: 2,
      totalInstallments: 12
    },
    {
      id: 'tx-oct-2',
      commitmentId: 'comm-2',
      title: 'Geladeira Brastemp Inverse Inox',
      type: 'expense',
      category: 'eletro',
      amount: 600,
      dueDate: '2026-10-22',
      paidDate: '2026-10-22',
      status: 'paid',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 2,
      totalInstallments: 8
    },
    {
      id: 'tx-oct-3',
      commitmentId: 'comm-3',
      title: 'Seguro Anual do Carro',
      type: 'expense',
      category: 'transporte',
      amount: 600,
      dueDate: '2026-10-15',
      paidDate: '2026-10-15',
      status: 'paid',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      installmentNumber: 1,
      totalInstallments: 4
    },
    {
      id: 'tx-oct-4',
      commitmentId: 'comm-5',
      title: 'Pacote Resort Aniversário (Entrada)',
      type: 'expense',
      category: 'viagens',
      amount: 600,
      dueDate: '2026-10-18',
      paidDate: '2026-10-18',
      status: 'paid',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'PIX',
      installmentNumber: 0,
      totalInstallments: 6
    },
    {
      id: 'tx-oct-5',
      commitmentId: 'comm-5',
      title: 'Pacote Resort Aniversário de Casamento',
      type: 'expense',
      category: 'viagens',
      amount: 400,
      dueDate: '2026-10-22',
      paidDate: '2026-10-22',
      status: 'paid',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 1,
      totalInstallments: 6
    },

    // NOVEMBRO 2026 (Mês Atual)
    {
      id: 'tx-nov-1',
      commitmentId: 'comm-1',
      title: 'Aluguel + Condomínio',
      type: 'expense',
      category: 'moradia',
      amount: 2400,
      dueDate: '2026-11-10',
      paidDate: '2026-11-10',
      status: 'paid',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'PIX',
      installmentNumber: 3,
      totalInstallments: 12
    },
    {
      id: 'tx-nov-2',
      commitmentId: 'comm-3',
      title: 'Seguro Anual do Carro',
      type: 'expense',
      category: 'transporte',
      amount: 600,
      dueDate: '2026-11-15',
      paidDate: '',
      status: 'pending',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      installmentNumber: 2,
      totalInstallments: 4
    },
    {
      id: 'tx-nov-3',
      commitmentId: 'comm-4',
      title: 'Internet Fibra 600MB + Energia + Água',
      type: 'expense',
      category: 'moradia',
      amount: 480,
      dueDate: '2026-11-15',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      installmentNumber: 3,
      totalInstallments: 12
    },
    {
      id: 'tx-nov-4',
      commitmentId: 'comm-5',
      title: 'Pacote Resort Aniversário de Casamento',
      type: 'expense',
      category: 'viagens',
      amount: 400,
      dueDate: '2026-11-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 2,
      totalInstallments: 6
    },
    {
      id: 'tx-nov-5',
      commitmentId: 'comm-2',
      title: 'Geladeira Brastemp Inverse Inox',
      type: 'expense',
      category: 'eletro',
      amount: 600,
      dueDate: '2026-11-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 3,
      totalInstallments: 8
    },
    {
      id: 'tx-nov-6',
      title: 'Compra do Mês — Atacadão & Hortifruti',
      type: 'expense',
      category: 'mercado',
      amount: 1180,
      dueDate: '2026-11-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank'
    },
    {
      id: 'tx-nov-7',
      title: 'Jantar Romântico Fim de Semana',
      type: 'expense',
      category: 'lazer',
      amount: 260,
      dueDate: '2026-11-15',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter'
    },
    {
      id: 'tx-nov-8',
      title: 'Plano de Saúde Casal',
      type: 'expense',
      category: 'saude',
      amount: 540,
      dueDate: '2026-11-25',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Boleto'
    },
    {
      id: 'tx-nov-9',
      title: 'Combustível & Lavagem',
      type: 'expense',
      category: 'transporte',
      amount: 280,
      dueDate: '2026-11-15',
      paidDate: '',
      status: 'pending',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter'
    },
    {
      id: 'tx-nov-10',
      title: 'Netflix + Spotify Duo + Amazon Prime',
      type: 'expense',
      category: 'assinaturas',
      amount: 115,
      dueDate: '2026-11-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank'
    },

    // DEZEMBRO 2026 (Projeção Futura)
    {
      id: 'tx-dec-1',
      commitmentId: 'comm-1',
      title: 'Aluguel + Condomínio',
      type: 'expense',
      category: 'moradia',
      amount: 2400,
      dueDate: '2026-12-10',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'PIX',
      installmentNumber: 4,
      totalInstallments: 12
    },
    {
      id: 'tx-dec-2',
      commitmentId: 'comm-2',
      title: 'Geladeira Brastemp Inverse Inox',
      type: 'expense',
      category: 'eletro',
      amount: 600,
      dueDate: '2026-12-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 4,
      totalInstallments: 8
    },
    {
      id: 'tx-dec-3',
      commitmentId: 'comm-3',
      title: 'Seguro Anual do Carro',
      type: 'expense',
      category: 'transporte',
      amount: 600,
      dueDate: '2026-12-15',
      paidDate: '',
      status: 'pending',
      owner: 'partner1',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      installmentNumber: 3,
      totalInstallments: 4
    },
    {
      id: 'tx-dec-4',
      commitmentId: 'comm-4',
      title: 'Internet Fibra 600MB + Energia + Água',
      type: 'expense',
      category: 'moradia',
      amount: 480,
      dueDate: '2026-12-15',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner1',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-inter',
      installmentNumber: 4,
      totalInstallments: 12
    },
    {
      id: 'tx-dec-5',
      commitmentId: 'comm-5',
      title: 'Pacote Resort Aniversário de Casamento',
      type: 'expense',
      category: 'viagens',
      amount: 400,
      dueDate: '2026-12-22',
      paidDate: '',
      status: 'pending',
      owner: 'joint',
      paidBy: 'partner2',
      paymentMethod: 'Cartão de Crédito',
      cardId: 'card-nubank',
      installmentNumber: 3,
      totalInstallments: 6
    }
  ],
  goals: [
    {
      id: 'goal-1',
      title: 'Reserva de Emergência do Casal (6 meses)',
      category: 'Segurança Financeira',
      icon: 'fa-shield-halved',
      targetAmount: 30000,
      currentAmount: 18500,
      deadline: '2027-06-30',
      color: '#10b981',
      notes: 'Aplicado no CDB Liquidez Diária 102% CDI.'
    },
    {
      id: 'goal-2',
      title: 'Viagem Internacional de 1 Ano de Casados',
      category: 'Viagens & Sonhos',
      icon: 'fa-plane-up',
      targetAmount: 12000,
      currentAmount: 5400,
      deadline: '2027-10-15',
      color: '#3b82f6',
      notes: 'Passagens com milhas/pontos dos cartões Platinum + hospedagem.'
    },
    {
      id: 'goal-3',
      title: 'Sofá Retrátil + Marcenaria da Sala',
      category: 'Casa & Reforma',
      icon: 'fa-couch',
      targetAmount: 8500,
      currentAmount: 6200,
      deadline: '2027-02-28',
      color: '#8b5cf6',
      notes: 'Guardar para comprar à vista com desconto.'
    },
    {
      id: 'goal-4',
      title: 'Fundo IPVA, Licenciamento & Manutenção',
      category: 'Planejamento Anual',
      icon: 'fa-car-side',
      targetAmount: 3600,
      currentAmount: 3000,
      deadline: '2027-01-15',
      color: '#f59e0b',
      notes: 'Para pagar o IPVA de Janeiro à vista com desconto.'
    }
  ],
  checklist: [
    {
      id: 'chk-0',
      group: 'Início do Mês (Dia 01 a 10)',
      title: 'Separar e entregar as primícias: Dízimo (10%) e Ofertas do Casal',
      deadlineLabel: 'Assim que receber',
      done: true
    },
    {
      id: 'chk-1',
      group: 'Início do Mês (Dia 01 a 10)',
      title: 'Confirmar recebimento dos salários e separar aporte das Caixinhas',
      deadlineLabel: 'Até dia 05',
      done: true
    },
    {
      id: 'chk-2',
      group: 'Início do Mês (Dia 01 a 10)',
      title: 'Pagar Aluguel + Condomínio com desconto de pontualidade',
      deadlineLabel: 'Até dia 10',
      done: true
    },
    {
      id: 'chk-3',
      group: 'Meio do Mês (Dia 11 a 20)',
      title: 'Conferir e pagar a fatura do Inter Platinum (Wesley)',
      deadlineLabel: 'Vencimento do cartão',
      done: false
    },
    {
      id: 'chk-4',
      group: 'Fechamento & Revisão do Casal (Dia 21 a 30)',
      title: 'Conferir e pagar a fatura do Nubank Chroma Platinum (Beatriz)',
      deadlineLabel: 'Vencimento do cartão',
      done: false
    },
    {
      id: 'chk-5',
      group: 'Fechamento & Revisão do Casal (Dia 21 a 30)',
      title: 'Conferir recebimento das Aulas Particulares e Vendas da semana',
      deadlineLabel: 'Toda sexta-feira',
      done: false
    },
    {
      id: 'chk-6',
      group: 'Fechamento & Revisão do Casal (Dia 21 a 30)',
      title: 'Fazer o acerto mensal das despesas conjuntas na aba Divisão do Casal',
      deadlineLabel: 'Até dia 28',
      done: false
    }
  ]
};
