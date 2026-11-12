import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDateBR, getMonthLabel } from '../utils/formatters';

export default function CardsView({
  state,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onPayFullCardInvoice,
  onOpenNewTransactionWithCard
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [selectedCardInvoice, setSelectedCardInvoice] = useState(null);

  const [form, setForm] = useState({
    name: '',
    brand: 'Mastercard Platinum',
    owner: 'partner1',
    limit: '',
    closingDay: 8,
    dueDay: 15,
    pointsPerReal: 1.0,
    rewardProgram: 'Pontos / Cashback',
    color: '#ea580c',
    lastDigits: ''
  });

  const { cards, transactions, selectedMonth, couple } = state;

  const openNewCardModal = () => {
    setEditingCardId(null);
    setForm({
      name: '',
      brand: 'Mastercard Platinum',
      owner: 'partner1',
      limit: '',
      closingDay: 8,
      dueDay: 15,
      pointsPerReal: 1.0,
      rewardProgram: 'Pontos / Cashback',
      color: '#ea580c',
      lastDigits: ''
    });
    setIsModalOpen(true);
  };

  const openEditCardModal = (card) => {
    setEditingCardId(card.id);
    setForm({
      name: card.name,
      brand: card.brand || 'Mastercard Platinum',
      owner: card.owner || 'partner1',
      limit: card.limit,
      closingDay: card.closingDay || 10,
      dueDay: card.dueDay || 15,
      pointsPerReal: card.pointsPerReal ?? 1.0,
      rewardProgram: card.rewardProgram || 'Pontos Platinum',
      color: card.color || '#ea580c',
      lastDigits: card.lastDigits || '0000'
    });
    setIsModalOpen(true);
  };

  const enrichedCards = useMemo(() => {
    return cards.map((card) => {
      const allCardTxs = transactions.filter(
        (t) => t.type === 'expense' && t.cardId === card.id
      );

      // Current month invoice items
      const monthInvoiceTxs = allCardTxs.filter(
        (t) => t.dueDate && t.dueDate.startsWith(selectedMonth)
      );
      const monthInvoiceTotal = monthInvoiceTxs.reduce(
        (acc, t) => acc + Number(t.amount || 0),
        0
      );
      const monthInvoicePending = monthInvoiceTxs
        .filter((t) => t.status === 'pending')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      // Total credit limit blocked by all pending installments across all months
      const totalUsedLimit = allCardTxs
        .filter((t) => t.status === 'pending')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      const availableLimit = Math.max(0, Number(card.limit || 0) - totalUsedLimit);
      const usagePct =
        card.limit > 0
          ? Math.min(100, Math.round((totalUsedLimit / card.limit) * 100))
          : 0;

      const ptsFactor = Number(card.pointsPerReal ?? 1.0);
      const monthPoints = Math.round(monthInvoiceTotal * ptsFactor);
      const totalAllTimeSpent = allCardTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const totalPointsAccumulated = Math.round(totalAllTimeSpent * ptsFactor);

      const invoiceDueDateStr = `${selectedMonth}-${String(card.dueDay || 15).padStart(2, '0')}`;

      return {
        ...card,
        monthInvoiceTxs,
        monthInvoiceTotal,
        monthInvoicePending,
        totalUsedLimit,
        availableLimit,
        usagePct,
        monthPoints,
        totalPointsAccumulated,
        invoiceDueDateStr
      };
    });
  }, [cards, transactions, selectedMonth]);

  const totalInvoicesMonth = enrichedCards.reduce((acc, c) => acc + c.monthInvoiceTotal, 0);
  const totalPointsMonth = enrichedCards.reduce((acc, c) => acc + c.monthPoints, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || Number(form.limit) <= 0) return;

    const payload = {
      ...form,
      limit: Number(form.limit),
      closingDay: Number(form.closingDay) || 10,
      dueDay: Number(form.dueDay) || 15,
      pointsPerReal: Number(form.pointsPerReal) || 1.0,
      lastDigits: form.lastDigits || '0000'
    };

    if (editingCardId) {
      onUpdateCard(editingCardId, payload);
    } else {
      onAddCard(payload);
    }

    setIsModalOpen(false);
    setEditingCardId(null);
  };

  return (
    <div className="view-container">
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-credit-card"></i> Cartões Platinum, Faturas &amp; Pontos (
            {couple.partner1Name} &amp; {couple.partner2Name})
          </h2>
          <p>
            Centralize as compras no <strong>Inter Platinum</strong> e no{' '}
            <strong>Nubank Chroma Platinum</strong>, configure o dia de vencimento de cada um e
            acompanhe faturas e pontos de <strong>{getMonthLabel(selectedMonth)}</strong>.
          </p>
        </div>
        <div className="header-btns">
          <button className="btn btn-primary" onClick={openNewCardModal}>
            <i className="fa-solid fa-plus"></i> + Adicionar Novo Cartão
          </button>
        </div>
      </div>

      {/* RESUMO CONSOLIDADO DOS CARTÕES NO MÊS */}
      <div className="kpi-grid-3">
        <div className="card mini-kpi">
          <span>Soma das Faturas em {getMonthLabel(selectedMonth)}</span>
          <strong>{formatCurrency(totalInvoicesMonth)}</strong>
          <small>Total concentrado nos cartões neste mês</small>
        </div>
        <div className="card mini-kpi">
          <span>Pontos Estimados no Mês (Platinum)</span>
          <strong className="text-emerald">+{totalPointsMonth.toLocaleString('pt-BR')} pts</strong>
          <small>Acumulados pelas compras na fatura atual</small>
        </div>
        <div className="card mini-kpi">
          <span>Cartões Ativos do Casal</span>
          <strong>{enrichedCards.length} cartões</strong>
          <small>Clique em "Editar Vencimento" para ajustar datas</small>
        </div>
      </div>

      {/* GRID DE CARTÕES */}
      <div className="credit-cards-grid">
        {enrichedCards.map((card) => (
          <div key={card.id} className="credit-card-box card">
            {/* VISUAL DO CARTÃO */}
            <div
              className="credit-card-visual"
              style={{
                background: `linear-gradient(135deg, ${card.color}, #0f172a)`
              }}
            >
              <div className="cc-top">
                <div>
                  <span className="cc-owner-tag">
                    {card.owner === 'joint'
                      ? 'Cartão da Casa (Casal)'
                      : card.owner === 'partner1'
                      ? `Titular: ${couple.partner1Name}`
                      : `Titular: ${couple.partner2Name}`}
                  </span>
                  <h4>{card.name}</h4>
                </div>
                <i className="fa-solid fa-wifi cc-chip-icon"></i>
              </div>

              <div className="cc-number">•••• •••• •••• {card.lastDigits}</div>

              <div className="cc-bottom">
                <div>
                  <small>Fecha todo dia {card.closingDay}</small>
                  <strong>Vencimento: Todo dia {card.dueDay}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ display: 'block', opacity: 0.85 }}>
                    {card.rewardProgram || 'Pontos Platinum'}
                  </small>
                  <span className="cc-brand">{card.brand}</span>
                </div>
              </div>
            </div>

            {/* MÉTRICAS DO CARTÃO */}
            <div className="cc-metrics">
              <div className="cc-invoice-highlight">
                <div>
                  <span>
                    Fatura de {getMonthLabel(selectedMonth)} (Vence{' '}
                    <strong>{formatDateBR(card.invoiceDueDateStr)}</strong>)
                  </span>
                  <strong className="cc-invoice-val">
                    {formatCurrency(card.monthInvoiceTotal)}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {card.monthInvoicePending > 0 ? (
                    <span className="status-tag pending">
                      Aberta ({formatCurrency(card.monthInvoicePending)})
                    </span>
                  ) : (
                    <span className="status-tag paid">Fatura Quitada</span>
                  )}
                  <small
                    style={{
                      display: 'block',
                      marginTop: '4px',
                      color: 'var(--primary)',
                      fontWeight: 700
                    }}
                  >
                    <i className="fa-solid fa-star"></i> +{card.monthPoints.toLocaleString('pt-BR')}{' '}
                    pts no mês
                  </small>
                </div>
              </div>

              <div className="cc-limit-bar-wrap">
                <div className="flex-between">
                  <small>
                    Limite tomado (com parcelas futuras):{' '}
                    <strong>{formatCurrency(card.totalUsedLimit)}</strong>
                  </small>
                  <small>
                    <strong>{card.usagePct}%</strong>
                  </small>
                </div>
                <div className="progress-bar-track sm">
                  <div
                    className={`progress-bar-fill ${
                      card.usagePct > 85 ? 'danger' : 'emerald'
                    }`}
                    style={{ width: `${card.usagePct}%` }}
                  />
                </div>
                <div className="flex-between" style={{ marginTop: '4px' }}>
                  <small className="text-emerald">
                    Disponível: <strong>{formatCurrency(card.availableLimit)}</strong>
                  </small>
                  <small>Limite Total: {formatCurrency(card.limit)}</small>
                </div>
              </div>

              <div className="cc-actions-grid">
                <button
                  className="btn btn-sm btn-soft"
                  onClick={() => onOpenNewTransactionWithCard(card.id)}
                >
                  <i className="fa-solid fa-cart-plus"></i> + Lançar Gasto
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setSelectedCardInvoice(card)}
                >
                  <i className="fa-solid fa-list-check"></i> Ver Fatura ({card.monthInvoiceTxs.length})
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openEditCardModal(card)}
                >
                  <i className="fa-solid fa-calendar-day"></i> Editar Vencimento
                </button>
                {card.monthInvoicePending > 0 ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onPayFullCardInvoice(card.id, selectedMonth)}
                  >
                    <i className="fa-solid fa-check-double"></i> Pagar Fatura
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-outline"
                    disabled
                    style={{ opacity: 0.65, cursor: 'default' }}
                  >
                    <i className="fa-solid fa-circle-check text-emerald"></i> Fatura Paga
                  </button>
                )}
              </div>
              {cards.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    className="btn-link"
                    style={{ color: '#ef4444', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => onDeleteCard(card.id)}
                  >
                    <i className="fa-solid fa-trash"></i> Remover cartão
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DETALHES DA FATURA */}
      {selectedCardInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedCardInvoice(null)}>
          <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>
                  Fatura: {selectedCardInvoice.name} — {getMonthLabel(selectedMonth)}
                </h3>
                <small>
                  Fechamento dia {selectedCardInvoice.closingDay} · Vencimento dia{' '}
                  {selectedCardInvoice.dueDay} (
                  {formatDateBR(selectedCardInvoice.invoiceDueDateStr)}) · Total:{' '}
                  <strong>{formatCurrency(selectedCardInvoice.monthInvoiceTotal)}</strong>
                </small>
              </div>
              <button className="close-btn" onClick={() => setSelectedCardInvoice(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="schedule-list">
                {selectedCardInvoice.monthInvoiceTxs.map((tx) => (
                  <div key={tx.id} className="schedule-row">
                    <div>
                      <strong>{tx.title}</strong>
                      <small>
                        Vencimento da Fatura: {formatDateBR(tx.dueDate)}{' '}
                        {tx.totalInstallments
                          ? `· Parcela ${tx.installmentNumber}/${tx.totalInstallments}`
                          : '· Compra à vista no crédito'}
                      </small>
                    </div>
                    <div className="schedule-row-right">
                      <strong>{formatCurrency(tx.amount)}</strong>
                      <span className={`status-tag ${tx.status}`}>
                        {tx.status === 'paid' ? 'Pago' : 'Na Fatura'}
                      </span>
                    </div>
                  </div>
                ))}
                {selectedCardInvoice.monthInvoiceTxs.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '18px' }}>
                    Nenhuma compra lançada neste cartão em {getMonthLabel(selectedMonth)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO OU EDITAR CARTÃO (COM CONFIGURAÇÃO DE VENCIMENTO) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-credit-card"></i>{' '}
                {editingCardId
                  ? 'Editar Cartão & Dia de Vencimento'
                  : 'Cadastrar Novo Cartão de Crédito'}
              </h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="card-name">Nome do Cartão *</label>
                  <input
                    id="card-name"
                    type="text"
                    required
                    placeholder="Ex: Inter Platinum, Nubank Chroma..."
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="card-limit">Limite Total (R$) *</label>
                  <input
                    id="card-limit"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Ex: 10000"
                    value={form.limit}
                    onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="card-close">Dia que Fecha a Fatura *</label>
                  <input
                    id="card-close"
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={form.closingDay}
                    onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="card-due">Dia de Vencimento *</label>
                  <input
                    id="card-due"
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={form.dueDay}
                    onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="card-digits">4 Últimos Dígitos</label>
                  <input
                    id="card-digits"
                    type="text"
                    maxLength={4}
                    placeholder="Ex: 9034"
                    value={form.lastDigits}
                    onChange={(e) => setForm({ ...form, lastDigits: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="card-owner">Titular do Cartão</label>
                  <select
                    id="card-owner"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  >
                    <option value="partner1">{couple.partner1Name} (Inter Platinum)</option>
                    <option value="partner2">{couple.partner2Name} (Nubank Chroma)</option>
                    <option value="joint">Conjunto da Casa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="card-pts">Pontos por R$ 1 gasto</label>
                  <input
                    id="card-pts"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.pointsPerReal}
                    onChange={(e) => setForm({ ...form, pointsPerReal: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="card-color">Cor Visual do Cartão</label>
                  <input
                    id="card-color"
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i>{' '}
                  {editingCardId ? 'Salvar Alterações e Atualizar Vencimentos' : 'Salvar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
