import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES } from '../data/initialState';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel,
  shiftYearMonth,
  getEffectiveMonthIncome,
  addMonthsToDate,
  buildSafeDueDate
} from '../utils/formatters';

export default function CommitmentsView({
  state,
  onAddCommitment,
  onUpdateCommitment,
  onAnticipateInstallments,
  onDeleteCommitment,
  onQuickPayTransaction,
  externalModalOpen,
  setExternalModalOpen
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'installment' | 'recurring'
  const [cardFilter, setCardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'settled' | 'active'
  const [selectedDetailsId, setSelectedDetailsId] = useState(null);

  // Estado para Edição de Contrato Existente
  const [editingComm, setEditingComm] = useState(null);

  // Estado para Antecipação de Parcelas com Desconto (dentro do modal de detalhes)
  const [anticipateCount, setAnticipateCount] = useState(2);
  const [anticipateDiscount, setAnticipateDiscount] = useState('');
  const [anticipateMarkPaid, setAnticipateMarkPaid] = useState(true);

  // Estado para o Simulador "Posso Comprar?" (What-If)
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const modalVisible = isModalOpen || externalModalOpen;

  const { commitments, transactions, couple, cards, ownerFilter } = state;

  const defaultCard = cards[0] || { id: 'card-inter', dueDay: 15, owner: 'partner1' };

  const [simForm, setSimForm] = useState({
    title: 'Nova Compra Planejada',
    totalAmount: '2400',
    installmentsCount: 10,
    cardId: defaultCard.id,
    startMonth: state.selectedMonth || '2026-11'
  });

  const closeNewModal = () => {
    setIsModalOpen(false);
    setFormError('');
    if (setExternalModalOpen) setExternalModalOpen(false);
  };

  // Fechar modais ao pressionar tecla Escape (WCAG)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen || externalModalOpen) {
          closeNewModal();
        }
        if (selectedDetailsId) {
          setSelectedDetailsId(null);
        }
        if (editingComm) {
          setEditingComm(null);
        }
        if (simulatorOpen) {
          setSimulatorOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, externalModalOpen, selectedDetailsId, editingComm, simulatorOpen]);

  // Form State for New Commitment
  const [form, setForm] = useState({
    title: '',
    category: 'eletro',
    type: 'installment',
    totalAmount: '',
    hasDownPayment: false,
    downPayment: '',
    installmentsCount: 6,
    startDate: buildSafeDueDate(state.selectedMonth, defaultCard.dueDay || 15),
    paymentMethod: 'Cartão de Crédito',
    cardId: defaultCard.id,
    owner: 'joint',
    paidBy: defaultCard.owner === 'partner2' ? 'partner2' : 'partner1',
    notes: ''
  });

  // Atualiza a data inicial sugerida quando o mês selecionado muda e o formulário está em branco
  useEffect(() => {
    setForm((prev) => {
      if (prev.title.trim() || prev.totalAmount) return prev;
      const chosenCard = cards.find((c) => c.id === prev.cardId) || defaultCard;
      return {
        ...prev,
        startDate: buildSafeDueDate(state.selectedMonth, chosenCard?.dueDay || 15)
      };
    });
  }, [state.selectedMonth, cards]);

  const handleSelectCardInForm = (newCardId) => {
    const chosen = cards.find((c) => c.id === newCardId);
    if (!chosen) {
      setForm((prev) => ({ ...prev, cardId: newCardId }));
      return;
    }
    const ym = form.startDate ? form.startDate.slice(0, 7) : state.selectedMonth;
    const newStartDate = buildSafeDueDate(ym, chosen.dueDay || 15);
    setForm((prev) => ({
      ...prev,
      cardId: newCardId,
      startDate: newStartDate,
      paidBy: chosen.owner === 'partner2' ? 'partner2' : 'partner1'
    }));
  };

  // Enrich commitments with live progress from linked transactions
  const enrichedCommitments = useMemo(() => {
    return commitments
      .filter((c) => (ownerFilter === 'all' ? true : c.owner === ownerFilter))
      .map((c) => {
        const linked = transactions
          .filter((t) => t.commitmentId === c.id)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        const regularLinked = linked.filter((t) => t.installmentNumber > 0);
        const hasDownPaymentTx = linked.some((t) => t.installmentNumber === 0);

        const totalScheduled =
          linked.length > 0
            ? linked.reduce((acc, t) => acc + Number(t.amount || 0), 0)
            : Number(c.totalAmount || 0);

        const totalPaid = linked
          .filter((t) => t.status === 'paid')
          .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const remaining = Math.max(0, totalScheduled - totalPaid);
        const progressPct =
          totalScheduled > 0 ? Math.min(100, Math.round((totalPaid / totalScheduled) * 100)) : 0;

        const paidInstallmentsCount = regularLinked.filter((t) => t.status === 'paid').length;
        const totalInstallmentsCount = regularLinked.length || c.installmentsCount || 1;
        const isSettled = remaining <= 0.01 && linked.length > 0;

        // Prioritize actual real last transaction date so editing card due date propagates immediately!
        const computedEndDate =
          linked.length > 0
            ? linked[linked.length - 1].dueDate
            : c.endDate ||
              addMonthsToDate(c.startDate, Math.max(0, (c.installmentsCount || 1) - 1));

        const cardObj = cards.find((cd) => cd.id === c.cardId) || null;

        return {
          ...c,
          cardObj,
          linked,
          hasDownPaymentTx,
          totalScheduled,
          totalPaid,
          remaining,
          progressPct,
          paidInstallmentsCount,
          totalInstallmentsCount,
          isSettled,
          computedEndDate
        };
      });
  }, [commitments, transactions, ownerFilter, cards]);

  const filteredList = useMemo(() => {
    return enrichedCommitments.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (cardFilter !== 'all' && c.cardId !== cardFilter) return false;
      if (statusFilter === 'settled' && !c.isSettled) return false;
      if (statusFilter === 'active' && c.isSettled) return false;
      return true;
    });
  }, [enrichedCommitments, search, categoryFilter, typeFilter, cardFilter, statusFilter]);

  // Dynamic Preview of Installments inside Modal
  const installmentPreview = useMemo(() => {
    const rawVal = Number(form.totalAmount) || 0;
    const isRecurring = form.type === 'recurring';
    const effectiveDownPayment = (!isRecurring && form.hasDownPayment) ? Number(form.downPayment) || 0 : 0;
    const count = Math.max(1, parseInt(form.installmentsCount, 10) || 1);

    if (rawVal <= 0) return { list: [], endDate: form.startDate, valid: false, totalCalculated: 0 };

    // For recurring accounts, rawVal is the monthly fee! Total is monthlyFee * count.
    // For installment purchases, rawVal is the total purchase value!
    const totalContract = isRecurring ? Number((rawVal * count).toFixed(2)) : rawVal;

    const remainingToParcel = Math.max(0, totalContract - effectiveDownPayment);
    const baseInstallment = isRecurring ? rawVal : Math.floor((remainingToParcel / count) * 100) / 100;
    const list = [];

    const hasValidDown = !isRecurring && form.hasDownPayment && effectiveDownPayment > 0;
    if (hasValidDown) {
      list.push({
        number: 0,
        label: 'Entrada Inicial',
        amount: effectiveDownPayment,
        dueDate: form.startDate
      });
    }

    let sumSoFar = effectiveDownPayment;
    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const amount = isRecurring
        ? rawVal
        : isLast
        ? Number((totalContract - sumSoFar).toFixed(2))
        : baseInstallment;

      sumSoFar += amount;
      const dueDate = addMonthsToDate(form.startDate, hasValidDown ? i : i - 1);
      list.push({
        number: i,
        label: isRecurring ? `Mensalidade ${i}/${count}` : `Parcela ${i}/${count}`,
        amount,
        dueDate
      });
    }

    const lastDate = list.length > 0 ? list[list.length - 1].dueDate : form.startDate;
    return {
      list,
      endDate: lastDate,
      totalCalculated: totalContract,
      valid: effectiveDownPayment < totalContract
    };
  }, [form]);

  const handleToggleDownPayment = (checked) => {
    setForm((prev) => ({
      ...prev,
      hasDownPayment: checked,
      downPayment: checked ? prev.downPayment : ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const total = Number(form.totalAmount);
    const isRecurring = form.type === 'recurring';
    if (!form.title.trim() || total <= 0 || !form.startDate) return;
    if (!installmentPreview.valid) {
      setFormError('O valor da entrada inicial deve ser menor que o valor total do compromisso.');
      return;
    }

    onAddCommitment({
      ...form,
      totalAmount: installmentPreview.totalCalculated || total,
      downPayment: (!isRecurring && form.hasDownPayment) ? Number(form.downPayment) || 0 : 0,
      installmentsCount: parseInt(form.installmentsCount, 10) || 1,
      endDate: installmentPreview.endDate,
      generatedInstallments: installmentPreview.list
    });

    setForm({
      title: '',
      category: 'eletro',
      type: 'installment',
      totalAmount: '',
      hasDownPayment: false,
      downPayment: '',
      installmentsCount: 6,
      startDate: buildSafeDueDate(state.selectedMonth, defaultCard.dueDay || 15),
      paymentMethod: 'Cartão de Crédito',
      cardId: defaultCard.id,
      owner: 'joint',
      paidBy: defaultCard.owner === 'partner2' ? 'partner2' : 'partner1',
      notes: ''
    });
    closeNewModal();
  };

  const handleExportCSV = () => {
    const headers = [
      'Descricao',
      'Tipo',
      'Categoria',
      'Valor Total',
      'Ja Pago',
      'Falta Pagar',
      'Onde Foi Feito',
      'Prazo Limite'
    ];
    const rows = filteredList.map((c) => {
      const catObj = CATEGORIES.find((cat) => cat.id === c.category);
      return [
        `"${c.title}"`,
        c.type === 'installment' ? 'Parcelamento' : 'Fixa Recorrente',
        `"${catObj ? catObj.name : c.category}"`,
        c.totalScheduled.toFixed(2),
        c.totalPaid.toFixed(2),
        c.remaining.toFixed(2),
        `"${c.cardObj ? c.cardObj.name : c.paymentMethod}"`,
        formatDateBR(c.computedEndDate)
      ];
    });
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanpro_compromissos_${state.selectedMonth}.csv`;
    a.click();
  };

  const totalCommittedAll = filteredList.reduce((acc, c) => acc + c.totalScheduled, 0);
  const totalPaidAll = filteredList.reduce((acc, c) => acc + c.totalPaid, 0);
  const totalRemainingAll = filteredList.reduce((acc, c) => acc + c.remaining, 0);

  // Simulador "Posso Comprar?" (Projeção de 12 meses + Limite do Cartão + Melhor Mês)
  const simulationResult = useMemo(() => {
    const simTotal = Math.max(0, Number(simForm.totalAmount) || 0);
    const simCount = Math.max(1, parseInt(simForm.installmentsCount, 10) || 1);
    const monthlyInstallment = simCount > 0 ? Number((simTotal / simCount).toFixed(2)) : 0;
    const baseStartYm = simForm.startMonth || state.selectedMonth || '2026-11';

    const isNoCard = simForm.cardId === 'pix';
    const chosenCard = !isNoCard ? (cards.find((c) => c.id === simForm.cardId) || null) : null;
    const cardUsedLimit = chosenCard
      ? transactions
          .filter(
            (t) => t.cardId === chosenCard.id && t.type === 'expense' && t.status === 'pending'
          )
          .reduce((a, t) => a + Number(t.amount || 0), 0)
      : 0;
    const cardAvailableLimit = chosenCard
      ? Math.max(0, Number(chosenCard.limit || 0) - cardUsedLimit)
      : Infinity;
    const fitsCardLimit = isNoCard || !chosenCard || simTotal <= cardAvailableLimit;

    const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
    const p1Off = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
    const p2Off = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

    const monthsProjection = [];
    for (let i = 0; i < 12; i++) {
      const ym = shiftYearMonth(baseStartYm, i);
      const eff = getEffectiveMonthIncome(state, ym);
      const monthExtras = (state.extraIncomes || []).filter(
        (ex) => ex.date && ex.date.startsWith(ym)
      );
      const extraTotal = monthExtras.reduce((a, ex) => a + Number(ex.amount || 0), 0);

      const p1Tithe = ((eff.partner1Income || 0) * (tithePct + p1Off)) / 100;
      const p2Tithe = ((eff.partner2Income || 0) * (tithePct + p2Off)) / 100;
      const autoPrimicias = Number((p1Tithe + p2Tithe + (eff.donationAmount || 0)).toFixed(2));

      const monthExpenses = transactions.filter(
        (t) => t.type === 'expense' && t.dueDate && t.dueDate.startsWith(ym)
      );
      const hasDizimoTx = monthExpenses.some((t) => t.category === 'dizimo');
      const currentExpenses =
        monthExpenses.reduce((a, t) => a + Number(t.amount || 0), 0) +
        (hasDizimoTx ? 0 : autoPrimicias);

      const totalIncome = eff.partner1Income + eff.partner2Income + extraTotal;
      const currentFreeBalance = totalIncome - currentExpenses;
      const hasSimInstallment = i < simCount;
      const newFreeBalance =
        currentFreeBalance - (hasSimInstallment ? monthlyInstallment : 0);

      monthsProjection.push({
        ym,
        label: getMonthLabel(ym),
        currentFreeBalance,
        newFreeBalance,
        hasSimInstallment
      });
    }

    const activeMonths = monthsProjection.filter((m) => m.hasSimInstallment);
    const minNewBalance =
      activeMonths.length > 0
        ? Math.min(...activeMonths.map((m) => m.newFreeBalance))
        : 0;
    const tightestMonth =
      activeMonths.find((m) => m.newFreeBalance === minNewBalance) || activeMonths[0];

    // Melhor mês para começar (maior folga de caixa nos próximos 6 meses)
    const bestStartCandidate = [...monthsProjection.slice(0, 6)].sort(
      (a, b) => b.currentFreeBalance - a.currentFreeBalance
    )[0];

    let status = 'safe'; // 'safe' | 'warning' | 'danger'
    if (!fitsCardLimit || minNewBalance < 0) {
      status = 'danger';
    } else if (minNewBalance < Number(couple.monthlySavingsTarget || 1500) * 0.5) {
      status = 'warning';
    }

    return {
      simTotal,
      simCount,
      monthlyInstallment,
      chosenCard,
      cardAvailableLimit,
      fitsCardLimit,
      monthsProjection,
      minNewBalance,
      tightestMonth,
      bestStartCandidate,
      status
    };
  }, [simForm, state, cards, transactions, couple]);

  const handleConvertSimulationToReal = () => {
    const isNoCard = simForm.cardId === 'pix';
    const chosen = !isNoCard ? (cards.find((c) => c.id === simForm.cardId) || defaultCard) : null;
    const startYm = simForm.startMonth || state.selectedMonth;
    setForm({
      title: simForm.title || 'Nova Compra Parcelada',
      category: 'eletro',
      type: 'installment',
      totalAmount: String(simForm.totalAmount || ''),
      hasDownPayment: false,
      downPayment: '',
      installmentsCount: Number(simForm.installmentsCount) || 6,
      startDate: buildSafeDueDate(startYm, chosen?.dueDay || 15),
      paymentMethod: isNoCard ? 'PIX' : 'Cartão de Crédito',
      cardId: isNoCard ? '' : (chosen?.id || defaultCard.id),
      owner: 'joint',
      paidBy: chosen?.owner === 'partner2' ? 'partner2' : 'partner1',
      notes: 'Criado a partir do Simulador Posso Comprar'
    });
    setIsModalOpen(true);
  };

  const openEditCommitmentModal = (comm) => {
    const pendingRegular = (comm.linked || []).filter(
      (t) => t.status === 'pending' && t.installmentNumber > 0
    );
    const sampleAmount =
      pendingRegular.length > 0 ? pendingRegular[0].amount : '';
    setEditingComm({
      id: comm.id,
      title: comm.title || '',
      category: comm.category || 'eletro',
      owner: comm.owner || 'joint',
      paidBy: comm.paidBy || 'partner1',
      paymentMethod: comm.paymentMethod || 'Cartão de Crédito',
      cardId: comm.cardId || defaultCard.id,
      notes: comm.notes || '',
      pendingInstallmentAmount: sampleAmount,
      pendingCount: pendingRegular.length
    });
  };

  const handleSaveEditedCommitment = (e) => {
    e.preventDefault();
    if (!editingComm || !editingComm.title.trim()) return;
    if (onUpdateCommitment) {
      onUpdateCommitment(editingComm.id, editingComm);
    }
    setEditingComm(null);
  };

  return (
    <div className="view-container">
      {/* HEADER DA SEÇÃO */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-file-contract"></i> Contas Fixas &amp; Compras Parceladas nos Cartões
          </h2>
          <p>
            Cadastre suas compras parceladas nos cartões{' '}
            <strong>{cards.map((c) => c.name.split(' ')[0]).join(' e ')}</strong>, simule novas compras e acompanhe quando cada parcelamento termina!
          </p>
        </div>
        <div className="header-btns" style={{ flexWrap: 'wrap' }}>
          <button
            className={`btn ${simulatorOpen ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setSimulatorOpen(!simulatorOpen)}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>{' '}
            {simulatorOpen ? 'Fechar Simulador' : '🔮 Simulador: Posso Comprar?'}
          </button>
          <button className="btn btn-outline" onClick={handleExportCSV}>
            <i className="fa-solid fa-file-csv"></i> Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <i className="fa-solid fa-plus"></i> Novo Parcelamento / Conta Fixa
          </button>
        </div>
      </div>

      {/* PAINEL EXPANSÍVEL: SIMULADOR "POSSO COMPRAR?" (WHAT-IF) */}
      {simulatorOpen && (
        <div
          className="card"
          style={{
            border: '2px solid var(--primary)',
            background: 'var(--bg-card)'
          }}
        >
          <div className="card-header flex-between wrap" style={{ marginBottom: '14px' }}>
            <div>
              <h3>
                <i className="fa-solid fa-crystal-ball text-emerald"></i> Simulador Inteligente:
                &ldquo;Posso Comprar?&rdquo; (Projeção nos Próximos 12 Meses)
              </h3>
              <p className="card-subtitle">
                Teste o impacto de um novo parcelamento no Saldo Livre futuro do casal e no limite do
                cartão antes de passar a compra!
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleConvertSimulationToReal}
            >
              <i className="fa-solid fa-check-double"></i> Transformar em Parcelamento Real
            </button>
          </div>

          <div className="form-grid-4" style={{ marginBottom: '16px' }}>
            <div className="form-group">
              <label htmlFor="sim-title">O que vocês pensam em comprar?</label>
              <input
                id="sim-title"
                type="text"
                value={simForm.title}
                onChange={(e) => setSimForm({ ...simForm, title: e.target.value })}
                placeholder="Ex: Ar-Condicionado, Viagem..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="sim-amount">Valor Total da Compra (R$)</label>
              <input
                id="sim-amount"
                type="number"
                min="1"
                step="10"
                value={simForm.totalAmount}
                onChange={(e) => setSimForm({ ...simForm, totalAmount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="sim-inst">Parcelar em quantas vezes?</label>
              <select
                id="sim-inst"
                value={simForm.installmentsCount}
                onChange={(e) =>
                  setSimForm({ ...simForm, installmentsCount: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n}x de {formatCurrency((Number(simForm.totalAmount) || 0) / n)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sim-card">Onde será feito o pagamento?</label>
              <select
                id="sim-card"
                value={simForm.cardId}
                onChange={(e) => setSimForm({ ...simForm, cardId: e.target.value })}
              >
                <optgroup label="Cartões de Crédito">
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Outros Meios (Sem Cartão)">
                  <option value="pix">💠 PIX / Boleto / Conta da Casa</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* VEREDITO INTELIGENTE */}
          <div
            className="installment-plan-box"
            style={{
              marginBottom: '14px',
              borderLeft: `5px solid ${
                simulationResult.status === 'safe'
                  ? '#10b981'
                  : simulationResult.status === 'warning'
                  ? '#f59e0b'
                  : '#ef4444'
              }`
            }}
          >
            <div className="flex-between wrap" style={{ gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '15px', display: 'block' }}>
                  {simulationResult.status === 'safe'
                    ? '✅ Compra Segura! Cabe com folga no orçamento de todos os meses.'
                    : simulationResult.status === 'warning'
                    ? '⚠️ Atenção: A compra cabe, mas reduzirá a margem de poupança em alguns meses.'
                    : '🛑 Alerta de Risco: Limite insuficiente no cartão ou Saldo Livre negativo em meses futuros!'}
                </strong>
                <small style={{ color: 'var(--text-secondary)' }}>
                  Parcela simulada: <strong>{formatCurrency(simulationResult.monthlyInstallment)}/mês</strong>{' '}
                  durante {simulationResult.simCount} meses · Menor Saldo Livre no período:{' '}
                  <strong>
                    {formatCurrency(simulationResult.minNewBalance)} (
                    {simulationResult.tightestMonth?.label})
                  </strong>
                </small>
              </div>
              <div style={{ textAlign: 'right' }}>
                {simulationResult.chosenCard ? (
                  <div style={{ fontSize: '12px' }}>
                    Limite disponível no {simulationResult.chosenCard.name.split(' ')[0]}:{' '}
                    <strong
                      className={simulationResult.fitsCardLimit ? 'text-emerald' : 'text-danger'}
                    >
                      {formatCurrency(simulationResult.cardAvailableLimit)}
                    </strong>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Meio de pagamento: <strong className="text-emerald">PIX / Sem Cartão (Não compromete limite)</strong>
                  </div>
                )}
                {simulationResult.bestStartCandidate && (
                  <small style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    💡 Mês mais folgado p/ iniciar: {simulationResult.bestStartCandidate.label} (Sobra
                    atual de {formatCurrency(simulationResult.bestStartCandidate.currentFreeBalance)})
                  </small>
                )}
              </div>
            </div>
          </div>

          {/* MINI-CARROSSEL DOS PRÓXIMOS 12 MESES */}
          <div className="preview-pills-scroll">
            {simulationResult.monthsProjection.map((m) => (
              <div
                key={m.ym}
                className="preview-pill"
                style={{
                  minWidth: '155px',
                  borderColor: m.newFreeBalance < 0 ? '#ef4444' : 'var(--border-color)'
                }}
              >
                <span>{m.label}</span>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  Atual: {formatCurrency(m.currentFreeBalance)}
                </small>
                <strong className={m.newFreeBalance >= 0 ? 'text-emerald' : 'text-danger'}>
                  Com compra: {formatCurrency(m.newFreeBalance)}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMO RÁPIDO DOS COMPROMISSOS */}
      <div className="kpi-grid-3">
        <div className="card mini-kpi">
          <span>Volume Total Contratado / Parcelado</span>
          <strong>{formatCurrency(totalCommittedAll)}</strong>
          <small>{filteredList.length} compromissos ativos na lista</small>
        </div>
        <div className="card mini-kpi">
          <span>Total Já Amortizado / Quitado</span>
          <strong className="text-emerald">{formatCurrency(totalPaidAll)}</strong>
          <small>Parcelas já pagas até agora</small>
        </div>
        <div className="card mini-kpi">
          <span>Saldo Devedor Futuro (Para Quitar Tudo)</span>
          <strong className="text-amber">{formatCurrency(totalRemainingAll)}</strong>
          <small>Soma das parcelas restantes nos próximos meses</small>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="card filters-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            id="comm-search"
            type="text"
            placeholder="Buscar compra parcelada, financiamento ou conta fixa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          id="comm-card-filter"
          value={cardFilter}
          onChange={(e) => setCardFilter(e.target.value)}
        >
          <option value="all">Todos os Cartões / Meios</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              💳 {c.name}
            </option>
          ))}
        </select>
        <select
          id="comm-cat-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas as Categorias</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          id="comm-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Qualquer Situação</option>
          <option value="active">Em Andamento</option>
          <option value="settled">100% Quitado</option>
        </select>
      </div>

      {/* TABELA DE PARCELAMENTOS E CONTAS FIXAS */}
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Compromisso / Descrição</th>
              <th className="text-center">Divisão</th>
              <th className="text-center">Valor Total</th>
              <th className="text-center">Já Pago</th>
              <th className="text-center">Falta Pagar</th>
              <th className="text-center">Onde Foi Feito (Cartão / Meio)</th>
              <th className="text-center">Última Parcela (Prazo)</th>
              <th className="text-center">Progresso</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((item) => {
              const cat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[8];
              return (
                <tr key={item.id}>
                  <td>
                    <div className="cell-title-with-icon">
                      <span
                        className="cat-icon-badge"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <i className={`fa-solid ${cat.icon}`}></i>
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {cat.name} ·{' '}
                          {item.type === 'installment' ? 'Compra Parcelada' : 'Conta Fixa Recorrente'}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={`owner-badge ${item.owner}`}>
                      {item.owner === 'joint'
                        ? 'Casal (Casa)'
                        : item.owner === 'partner1'
                        ? couple.partner1Name
                        : couple.partner2Name}
                    </span>
                  </td>
                  <td className="text-center">
                    <strong className="font-mono-val">{formatCurrency(item.totalScheduled)}</strong>
                  </td>
                  <td className="text-center text-emerald">
                    <strong className="font-mono-val">{formatCurrency(item.totalPaid)}</strong>
                  </td>
                  <td className="text-center text-amber">
                    <strong className="font-mono-val">{formatCurrency(item.remaining)}</strong>
                  </td>
                  <td className="text-center">
                    {item.cardObj ? (
                      <div className="card-badge-wrap">
                        <span
                          className="method-pill card-pill"
                          style={{
                            borderColor: item.cardObj.color,
                            color: item.cardObj.color,
                            backgroundColor: `${item.cardObj.color}15`,
                            fontWeight: 700
                          }}
                        >
                          <i className="fa-solid fa-credit-card"></i>{' '}
                          {item.cardObj.name.includes('Inter')
                            ? 'Inter Platinum'
                            : item.cardObj.name.includes('Nubank')
                            ? 'Nubank Chroma'
                            : item.cardObj.name}
                        </span>
                        <small className="card-due-sub">Vence dia {item.cardObj.dueDay}</small>
                      </div>
                    ) : (
                      <span className="method-pill">{item.paymentMethod}</span>
                    )}
                  </td>
                  <td className="text-center">
                    <strong style={{ fontSize: '13px' }}>{formatDateBR(item.computedEndDate)}</strong>
                  </td>
                  <td className="text-center" style={{ minWidth: '140px' }}>
                    <div className="table-progress-wrap" style={{ margin: '0 auto' }}>
                      <div className="table-progress-labels">
                        <span>
                          {item.paidInstallmentsCount}/{item.totalInstallmentsCount} parc.
                          {item.hasDownPaymentTx && <small style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>+ Ent.</small>}
                        </span>
                        <span>{item.progressPct}%</span>
                      </div>
                      <div className="progress-bar-track sm">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="Ver Cronograma e Antecipar Parcelas"
                        onClick={() => {
                          setSelectedDetailsId(item.id);
                          setAnticipateCount(1);
                          setAnticipateDiscount('');
                        }}
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button
                        className="icon-btn"
                        title="Editar Contrato / Parcelamento"
                        onClick={() => openEditCommitmentModal(item)}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Excluir Compromisso"
                        onClick={() => onDeleteCommitment(item.id)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredList.length === 0 && (
              <tr>
                <td colSpan="9" className="empty-table-cell">
                  Nenhum parcelamento ou conta fixa encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NOVO PARCELAMENTO / CONTA FIXA */}
      {modalVisible && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-file-circle-plus"></i> Novo Parcelamento ou Conta Fixa
              </h3>
              <button className="close-btn" onClick={closeNewModal}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {formError && (
                <div className="form-error-banner">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{formError}</span>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="comm-title">Descrição da Compra ou Conta Fixa *</label>
                  <input
                    id="comm-title"
                    type="text"
                    required
                    placeholder="Ex: TV 65 Polegadas, Seguro do Carro, Aluguel..."
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="comm-cat">Categoria *</label>
                  <select
                    id="comm-cat"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="comm-type">Tipo de Compromisso *</label>
                  <select
                    id="comm-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="installment">🛍️ Compra Parcelada</option>
                    <option value="recurring">🔄 Conta Fixa Recorrente / Assinatura</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="comm-owner">De quem é este gasto? *</label>
                  <select
                    id="comm-owner"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  >
                    <option value="joint">Conjunto da Casa (Dividido pelo Casal)</option>
                    <option value="partner1">Individual — {couple.partner1Name}</option>
                    <option value="partner2">Individual — {couple.partner2Name}</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="comm-method">Onde foi feito o gasto? *</label>
                  <select
                    id="comm-method"
                    value={form.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value;
                      if (method === 'Cartão de Crédito' && cards[0]) {
                        handleSelectCardInForm(form.cardId || cards[0].id);
                      }
                      setForm((prev) => ({ ...prev, paymentMethod: method }));
                    }}
                  >
                    <option value="Cartão de Crédito">
                      💳 Cartão de Crédito ({cards.map((c) => c.name.split(' ')[0]).join(' / ')})
                    </option>
                    <option value="PIX">💠 PIX / Conta Corrente</option>
                    <option value="Boleto">📄 Boleto Bancário</option>
                    <option value="Débito Automático">🔄 Débito Automático</option>
                  </select>
                </div>

                {form.paymentMethod === 'Cartão de Crédito' ? (
                  <div className="form-group">
                    <label htmlFor="comm-card">Qual Cartão foi utilizado? *</label>
                    <select
                      id="comm-card"
                      value={form.cardId}
                      onChange={(e) => handleSelectCardInForm(e.target.value)}
                    >
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name} (Vence dia {card.dueDay})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="comm-paidby">Quem Paga a Conta? *</label>
                    <select
                      id="comm-paidby"
                      value={form.paidBy}
                      onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
                    >
                      <option value="partner1">{couple.partner1Name}</option>
                      <option value="partner2">{couple.partner2Name}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="comm-total">
                    {form.type === 'recurring'
                      ? 'Valor Mensal da Conta Fixa (R$) *'
                      : 'Valor Total da Compra / Compromisso (R$) *'}
                  </label>
                  <input
                    id="comm-total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={form.type === 'recurring' ? 'Ex: 200.00 (por mês)' : 'Ex: 2400.00 (total)'}
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  />
                  {form.type === 'recurring' && Number(form.totalAmount) > 0 && (
                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                      Total projetado: {formatCurrency(Number(form.totalAmount) * (parseInt(form.installmentsCount, 10) || 1))} em {form.installmentsCount} meses.
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="comm-start">
                    Data do 1º Vencimento (ajustado ao vencimento do cartão) *
                  </label>
                  <input
                    id="comm-start"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
              </div>

              {/* PLANO DE PARCELAMENTO DINÂMICO */}
              <div className="installment-plan-box">
                <div className="flex-between">
                  <h4>
                    <i className="fa-solid fa-calculator"></i>{' '}
                    {form.type === 'recurring'
                      ? 'Projeção das Mensalidades Recorrentes'
                      : 'Plano de Parcelamento Automático'}
                  </h4>
                  {form.type !== 'recurring' && (
                    <label className="checkbox-inline" htmlFor="comm-has-down">
                      <input
                        id="comm-has-down"
                        type="checkbox"
                        checked={form.hasDownPayment}
                        onChange={(e) => handleToggleDownPayment(e.target.checked)}
                      />
                      <span>Possui valor de entrada inicial?</span>
                    </label>
                  )}
                </div>

                <div className="form-grid-3" style={{ marginTop: '12px' }}>
                  {form.type !== 'recurring' && form.hasDownPayment && (
                    <div className="form-group">
                      <label htmlFor="comm-down">Valor de Entrada (R$)</label>
                      <input
                        id="comm-down"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex: 500.00"
                        value={form.downPayment}
                        onChange={(e) => setForm({ ...form, downPayment: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="comm-count">
                      {form.type === 'recurring' ? 'Meses de Duração (1 a 36 meses)' : 'Quantidade de Parcelas (1x a 36x)'}
                    </label>
                    <select
                      id="comm-count"
                      value={form.installmentsCount}
                      onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}
                    >
                      {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x {n === 1 ? (form.type === 'recurring' ? 'mês' : '(À Vista na Fatura)') : 'mensais'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="comm-end-preview">
                      {form.type === 'recurring' ? 'Término Previsto (Calculado)' : 'Data da Última Parcela (Calculada)'}
                    </label>
                    <input
                      id="comm-end-preview"
                      type="text"
                      disabled
                      value={formatDateBR(installmentPreview.endDate)}
                    />
                  </div>
                </div>

                {installmentPreview.list.length > 0 && (
                  <div className="preview-pills-wrap">
                    <small>
                      Prévia do Cronograma Gerado ({installmentPreview.list.length} {form.type === 'recurring' ? 'mensalidades' : 'lançamentos'}):
                    </small>
                    <div className="preview-pills-scroll">
                      {installmentPreview.list.map((p) => (
                        <div key={p.number} className="preview-pill">
                          <span>{p.label}</span>
                          <strong>{formatCurrency(p.amount)}</strong>
                          <small>{formatDateBR(p.dueDate)}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="comm-notes">Observações</label>
                <input
                  id="comm-notes"
                  type="text"
                  placeholder="Opcional: loja, pontos extras, garantia..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeNewModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Salvar e Lançar no Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SECUNDÁRIO: DETALHES, ANTECIPAÇÃO COM DESCONTO E CRONOGRAMA DE PARCELAS */}
      {(() => {
        const activeDetails = enrichedCommitments.find((c) => c.id === selectedDetailsId);
        if (!activeDetails) return null;

        const pendingInstallments = activeDetails.linked
          .filter((t) => t.status === 'pending' && t.installmentNumber > 0)
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate)); // Das últimas p/ as primeiras (padrão Nubank/Inter)

        const clampedCount = Math.min(
          Math.max(1, Number(anticipateCount) || 1),
          Math.max(1, pendingInstallments.length)
        );
        const selectedToAnticipate = pendingInstallments.slice(0, clampedCount);
        const originalSumToAnticipate = selectedToAnticipate.reduce(
          (a, t) => a + Number(t.amount || 0),
          0
        );
        const discountNum = Math.max(0, Number(anticipateDiscount) || 0);
        const finalDiscountedSum = Math.max(
          0.01 * clampedCount,
          Number((originalSumToAnticipate - discountNum).toFixed(2))
        );

        return (
          <div className="modal-backdrop" onClick={() => setSelectedDetailsId(null)}>
            <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3>{activeDetails.title}</h3>
                  <small>
                    Prazo final: {formatDateBR(activeDetails.computedEndDate)} · Progresso:{' '}
                    {activeDetails.progressPct}%
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setSelectedDetailsId(null);
                      openEditCommitmentModal(activeDetails);
                    }}
                  >
                    <i className="fa-solid fa-pen-to-square"></i> Editar Contrato
                  </button>
                  <button className="close-btn" onClick={() => setSelectedDetailsId(null)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <div className="kpi-grid-3" style={{ marginBottom: '16px' }}>
                  <div className="mini-kpi card">
                    <span>Total Contratado</span>
                    <strong>{formatCurrency(activeDetails.totalScheduled)}</strong>
                  </div>
                  <div className="mini-kpi card">
                    <span>Total Pago</span>
                    <strong className="text-emerald">{formatCurrency(activeDetails.totalPaid)}</strong>
                  </div>
                  <div className="mini-kpi card">
                    <span>Saldo Restante</span>
                    <strong className="text-amber">{formatCurrency(activeDetails.remaining)}</strong>
                  </div>
                </div>

                {/* PAINEL DE ANTECIPAÇÃO DE PARCELAS COM DESCONTO */}
                {pendingInstallments.length > 0 && onAnticipateInstallments && (
                  <div
                    className="installment-plan-box"
                    style={{
                      marginBottom: '18px',
                      border: '1px solid var(--primary)',
                      background: 'var(--bg-subtle)'
                    }}
                  >
                    <div className="flex-between wrap" style={{ marginBottom: '10px', gap: '8px' }}>
                      <h4 style={{ margin: 0 }}>
                        <i className="fa-solid fa-bolt text-emerald"></i> Antecipar Parcelas Futuras
                        com Desconto ({getMonthLabel(state.selectedMonth)})
                      </h4>
                      <span className="badge-pill badge-emerald">
                        {pendingInstallments.length} parcela(s) pendente(s)
                      </span>
                    </div>

                    <div className="form-grid-3" style={{ marginBottom: '12px' }}>
                      <div className="form-group">
                        <label htmlFor="ant-count">Quantas parcelas finais antecipar?</label>
                        <select
                          id="ant-count"
                          value={clampedCount}
                          onChange={(e) => setAnticipateCount(Number(e.target.value))}
                        >
                          {Array.from(
                            { length: pendingInstallments.length },
                            (_, idx) => idx + 1
                          ).map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'última parcela' : 'últimas parcelas'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="ant-disc">Desconto Obtido no App do Banco (R$)</label>
                        <input
                          id="ant-disc"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 45.00"
                          value={anticipateDiscount}
                          onChange={(e) => setAnticipateDiscount(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="ant-status">Como registrar em {getMonthLabel(state.selectedMonth)}?</label>
                        <select
                          id="ant-status"
                          value={anticipateMarkPaid ? 'paid' : 'pending'}
                          onChange={(e) => setAnticipateMarkPaid(e.target.value === 'paid')}
                        >
                          <option value="paid">✅ Já Quitado / Pago Agora</option>
                          <option value="pending">💳 Na Fatura Atual (Pendente)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex-between wrap" style={{ gap: '12px' }}>
                      <div style={{ fontSize: '13px' }}>
                        Valor original: <strong>{formatCurrency(originalSumToAnticipate)}</strong> ·{' '}
                        Valor final com desconto:{' '}
                        <strong className="text-emerald">
                          {formatCurrency(finalDiscountedSum)}
                        </strong>
                        {discountNum > 0 && (
                          <span style={{ marginLeft: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                            (Economia de {formatCurrency(discountNum)})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          onAnticipateInstallments(
                            activeDetails.id,
                            selectedToAnticipate.map((t) => t.id),
                            discountNum,
                            anticipateMarkPaid
                          );
                          setAnticipateDiscount('');
                        }}
                      >
                        <i className="fa-solid fa-check-double"></i> Confirmar Antecipação de{' '}
                        {clampedCount} Parcela(s)
                      </button>
                    </div>
                  </div>
                )}

                <h4>Cronograma Completo de Parcelas</h4>
                <div className="schedule-list">
                  {activeDetails.linked.map((tx) => (
                    <div key={tx.id} className="schedule-row">
                      <div>
                        <strong>
                          {tx.installmentNumber === 0
                            ? 'Entrada Inicial'
                            : `Parcela ${tx.installmentNumber}/${tx.totalInstallments}`}
                        </strong>
                        <small>Vencimento: {formatDateBR(tx.dueDate)}</small>
                      </div>
                      <div className="schedule-row-right">
                        <strong>{formatCurrency(tx.amount)}</strong>
                        {tx.status === 'paid' ? (
                          <span className="status-tag paid">
                            <i className="fa-solid fa-check"></i> Pago em{' '}
                            {formatDateBR(tx.paidDate || tx.dueDate)}
                          </span>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onQuickPayTransaction(tx.id)}
                          >
                            Dar Baixa Agora
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: EDITAR PARCELAMENTO / CONTA FIXA EXISTENTE */}
      {editingComm && (
        <div className="modal-backdrop" onClick={() => setEditingComm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-pen-to-square text-emerald"></i> Editar Contrato /
                Parcelamento
              </h3>
              <button className="close-btn" onClick={() => setEditingComm(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveEditedCommitment} className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-comm-title">Descrição do Contrato / Compra *</label>
                <input
                  id="edit-comm-title"
                  type="text"
                  required
                  value={editingComm.title}
                  onChange={(e) => setEditingComm({ ...editingComm, title: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="edit-comm-cat">Categoria *</label>
                  <select
                    id="edit-comm-cat"
                    value={editingComm.category}
                    onChange={(e) => setEditingComm({ ...editingComm, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-comm-owner">Divisão do Gasto *</label>
                  <select
                    id="edit-comm-owner"
                    value={editingComm.owner}
                    onChange={(e) => setEditingComm({ ...editingComm, owner: e.target.value })}
                  >
                    <option value="joint">🏠 Conjunto da Casa (Casal)</option>
                    <option value="partner1">👤 Individual — {couple.partner1Name}</option>
                    <option value="partner2">👤 Individual — {couple.partner2Name}</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="edit-comm-method">Forma de Pagamento *</label>
                  <select
                    id="edit-comm-method"
                    value={editingComm.paymentMethod}
                    onChange={(e) =>
                      setEditingComm({ ...editingComm, paymentMethod: e.target.value })
                    }
                  >
                    <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                    <option value="PIX">💠 PIX / Conta Corrente</option>
                    <option value="Boleto">📄 Boleto Bancário</option>
                    <option value="Débito Automático">🔄 Débito Automático</option>
                  </select>
                </div>

                {editingComm.paymentMethod === 'Cartão de Crédito' ? (
                  <div className="form-group">
                    <label htmlFor="edit-comm-card">Qual Cartão? *</label>
                    <select
                      id="edit-comm-card"
                      value={editingComm.cardId}
                      onChange={(e) => {
                        const chosen = cards.find((c) => c.id === e.target.value);
                        setEditingComm({
                          ...editingComm,
                          cardId: e.target.value,
                          paidBy: chosen?.owner === 'partner2' ? 'partner2' : 'partner1'
                        });
                      }}
                    >
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Vence dia {c.dueDay})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="edit-comm-paidby">Quem Paga? *</label>
                    <select
                      id="edit-comm-paidby"
                      value={editingComm.paidBy}
                      onChange={(e) => setEditingComm({ ...editingComm, paidBy: e.target.value })}
                    >
                      <option value="partner1">{couple.partner1Name}</option>
                      <option value="partner2">{couple.partner2Name}</option>
                    </select>
                  </div>
                )}
              </div>

              {editingComm.pendingCount > 0 && (
                <div className="form-group">
                  <label htmlFor="edit-comm-pending-val">
                    Valor das {editingComm.pendingCount} Parcelas Pendentes Futuras (R$)
                  </label>
                  <input
                    id="edit-comm-pending-val"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editingComm.pendingInstallmentAmount}
                    onChange={(e) =>
                      setEditingComm({
                        ...editingComm,
                        pendingInstallmentAmount: e.target.value
                      })
                    }
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    As parcelas já pagas permanecem intactas; apenas as pendentes serão reajustadas.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="edit-comm-notes">Observações</label>
                <input
                  id="edit-comm-notes"
                  type="text"
                  value={editingComm.notes}
                  onChange={(e) => setEditingComm({ ...editingComm, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingComm(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Salvar Alterações do Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
