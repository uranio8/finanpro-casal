import React, { useState, useMemo } from 'react';
import { CATEGORIES } from '../data/initialState';
import {
  formatCurrency,
  formatDateBR,
  addMonthsToDate
} from '../utils/formatters';

export default function CommitmentsView({
  state,
  onAddCommitment,
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
  const [selectedDetails, setSelectedDetails] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalVisible = isModalOpen || externalModalOpen;

  const { commitments, transactions, couple, cards, ownerFilter } = state;

  const defaultCard = cards[0] || { id: 'card-inter', dueDay: 15, owner: 'partner1' };

  const closeNewModal = () => {
    setIsModalOpen(false);
    if (setExternalModalOpen) setExternalModalOpen(false);
  };

  // Form State for New Commitment
  const [form, setForm] = useState({
    title: '',
    category: 'eletro',
    type: 'installment',
    totalAmount: '',
    hasDownPayment: false,
    downPayment: '',
    installmentsCount: 6,
    startDate: `${state.selectedMonth}-${String(defaultCard.dueDay || 15).padStart(2, '0')}`,
    paymentMethod: 'Cartão de Crédito',
    cardId: defaultCard.id,
    owner: 'joint',
    paidBy: defaultCard.owner === 'partner2' ? 'partner2' : 'partner1',
    notes: ''
  });

  const handleSelectCardInForm = (newCardId) => {
    const chosen = cards.find((c) => c.id === newCardId);
    if (!chosen) {
      setForm((prev) => ({ ...prev, cardId: newCardId }));
      return;
    }
    const ym = form.startDate ? form.startDate.slice(0, 7) : state.selectedMonth;
    const newStartDate = `${ym}-${String(chosen.dueDay || 15).padStart(2, '0')}`;
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

        const paidInstallmentsCount = linked.filter((t) => t.status === 'paid').length;
        const isSettled = remaining <= 0.01 && linked.length > 0;

        const computedEndDate =
          c.endDate ||
          (linked.length > 0
            ? linked[linked.length - 1].dueDate
            : addMonthsToDate(c.startDate, Math.max(0, (c.installmentsCount || 1) - 1)));

        const cardObj = cards.find((cd) => cd.id === c.cardId) || null;

        return {
          ...c,
          cardObj,
          linked,
          totalScheduled,
          totalPaid,
          remaining,
          progressPct,
          paidInstallmentsCount,
          totalInstallmentsCount: linked.length || c.installmentsCount,
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
    const total = Number(form.totalAmount) || 0;
    const effectiveDownPayment = form.hasDownPayment ? Number(form.downPayment) || 0 : 0;
    const count = Math.max(1, parseInt(form.installmentsCount, 10) || 1);

    if (total <= 0) return { list: [], endDate: form.startDate, valid: false };

    const remainingToParcel = Math.max(0, total - effectiveDownPayment);
    const baseInstallment = Math.floor((remainingToParcel / count) * 100) / 100;
    const list = [];

    if (form.hasDownPayment && effectiveDownPayment > 0) {
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
      const amount = isLast
        ? Number((total - sumSoFar).toFixed(2))
        : baseInstallment;
      sumSoFar += amount;
      const dueDate = addMonthsToDate(form.startDate, form.hasDownPayment ? i : i - 1);
      list.push({
        number: i,
        label: `Parcela ${i}/${count}`,
        amount,
        dueDate
      });
    }

    const lastDate = list.length > 0 ? list[list.length - 1].dueDate : form.startDate;
    return {
      list,
      endDate: lastDate,
      valid: effectiveDownPayment < total
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
    const total = Number(form.totalAmount);
    if (!form.title.trim() || total <= 0 || !form.startDate) return;

    onAddCommitment({
      ...form,
      totalAmount: total,
      downPayment: form.hasDownPayment ? Number(form.downPayment) || 0 : 0,
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
      startDate: `${state.selectedMonth}-${String(defaultCard.dueDay || 15).padStart(2, '0')}`,
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
    const rows = filteredList.map((c) => [
      `"${c.title}"`,
      c.type === 'installment' ? 'Parcelamento' : 'Fixa Recorrente',
      c.category,
      c.totalScheduled.toFixed(2),
      c.totalPaid.toFixed(2),
      c.remaining.toFixed(2),
      `"${c.cardObj ? c.cardObj.name : c.paymentMethod}"`,
      formatDateBR(c.computedEndDate)
    ]);
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

  return (
    <div className="view-container">
      {/* HEADER DA SEÇÃO */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-file-contract"></i> Contas Fixas &amp; Compras Parceladas nos Cartões
          </h2>
          <p>
            Cadastre suas compras parceladas no <strong>Inter Platinum</strong> ou{' '}
            <strong>Nubank Chroma</strong> e acompanhe quando cada parcelamento termina!
          </p>
        </div>
        <div className="header-btns">
          <button className="btn btn-outline" onClick={handleExportCSV}>
            <i className="fa-solid fa-file-csv"></i> Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <i className="fa-solid fa-plus"></i> Novo Parcelamento / Conta Fixa
          </button>
        </div>
      </div>

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
              <th>Divisão</th>
              <th>Valor Total</th>
              <th>Já Pago</th>
              <th>Falta Pagar</th>
              <th>Onde Foi Feito (Cartão / Meio)</th>
              <th>Última Parcela (Prazo)</th>
              <th>Progresso</th>
              <th>Ações</th>
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
                  <td>
                    <span className={`owner-badge ${item.owner}`}>
                      {item.owner === 'joint'
                        ? 'Casal (Casa)'
                        : item.owner === 'partner1'
                        ? couple.partner1Name
                        : couple.partner2Name}
                    </span>
                  </td>
                  <td>
                    <strong>{formatCurrency(item.totalScheduled)}</strong>
                  </td>
                  <td className="text-emerald">
                    <strong>{formatCurrency(item.totalPaid)}</strong>
                  </td>
                  <td className="text-amber">
                    <strong>{formatCurrency(item.remaining)}</strong>
                  </td>
                  <td>
                    {item.cardObj ? (
                      <span
                        className="method-pill"
                        style={{
                          borderColor: item.cardObj.color,
                          color: item.cardObj.color,
                          fontWeight: 700
                        }}
                      >
                        <i className="fa-solid fa-credit-card"></i> {item.cardObj.name} (Vence dia{' '}
                        {item.cardObj.dueDay})
                      </span>
                    ) : (
                      <span className="method-pill">{item.paymentMethod}</span>
                    )}
                  </td>
                  <td>
                    <strong>{formatDateBR(item.computedEndDate)}</strong>
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div className="table-progress-wrap">
                      <div className="table-progress-labels">
                        <span>
                          {item.paidInstallmentsCount}/{item.totalInstallmentsCount} parc.
                        </span>
                        <strong>{item.progressPct}%</strong>
                      </div>
                      <div className="progress-bar-track sm">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${item.progressPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="Ver Cronograma de Parcelas"
                        onClick={() => setSelectedDetails(item)}
                      >
                        <i className="fa-solid fa-eye"></i>
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

              <div className="form-grid-3">
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
                    <option value="Cartão de Crédito">💳 Cartão de Crédito (Inter / Nubank)</option>
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
                    <label htmlFor="comm-type">Tipo de Compromisso</label>
                    <select
                      id="comm-type"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option value="installment">Compra Parcelada</option>
                      <option value="recurring">Conta Fixa Mensal</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="comm-owner">De quem é este gasto?</label>
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
                  <label htmlFor="comm-total">Valor Total da Compra / Compromisso (R$) *</label>
                  <input
                    id="comm-total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 2400.00"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  />
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
                    <i className="fa-solid fa-calculator"></i> Plano de Parcelamento Automático
                  </h4>
                  <label className="checkbox-inline" htmlFor="comm-has-down">
                    <input
                      id="comm-has-down"
                      type="checkbox"
                      checked={form.hasDownPayment}
                      onChange={(e) => handleToggleDownPayment(e.target.checked)}
                    />
                    <span>Possui valor de entrada inicial?</span>
                  </label>
                </div>

                <div className="form-grid-3" style={{ marginTop: '12px' }}>
                  {form.hasDownPayment && (
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
                    <label htmlFor="comm-count">Quantidade de Parcelas (1x a 36x)</label>
                    <select
                      id="comm-count"
                      value={form.installmentsCount}
                      onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}
                    >
                      {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x {n === 1 ? '(À Vista na Fatura)' : 'mensais'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="comm-end-preview">Data da Última Parcela (Calculada)</label>
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
                      Prévia do Cronograma Gerado ({installmentPreview.list.length} lançamentos):
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

      {/* MODAL SECUNDÁRIO: DETALHES E CRONOGRAMA DE PARCELAS */}
      {selectedDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedDetails(null)}>
          <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedDetails.title}</h3>
                <small>
                  Prazo final: {formatDateBR(selectedDetails.computedEndDate)} · Progresso:{' '}
                  {selectedDetails.progressPct}%
                </small>
              </div>
              <button className="close-btn" onClick={() => setSelectedDetails(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="kpi-grid-3" style={{ marginBottom: '16px' }}>
                <div className="mini-kpi card">
                  <span>Total Contratado</span>
                  <strong>{formatCurrency(selectedDetails.totalScheduled)}</strong>
                </div>
                <div className="mini-kpi card">
                  <span>Total Pago</span>
                  <strong className="text-emerald">{formatCurrency(selectedDetails.totalPaid)}</strong>
                </div>
                <div className="mini-kpi card">
                  <span>Saldo Restante</span>
                  <strong className="text-amber">{formatCurrency(selectedDetails.remaining)}</strong>
                </div>
              </div>

              <h4>Cronograma Completo de Parcelas</h4>
              <div className="schedule-list">
                {selectedDetails.linked.map((tx) => (
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
                          onClick={() => {
                            onQuickPayTransaction(tx.id);
                            setSelectedDetails(null);
                          }}
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
      )}
    </div>
  );
}
