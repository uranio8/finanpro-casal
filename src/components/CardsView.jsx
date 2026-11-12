import React, { useState, useMemo, useEffect } from 'react';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel,
  buildSafeDueDate
} from '../utils/formatters';

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
  const [selectedCardInvoiceId, setSelectedCardInvoiceId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    brand: 'Mastercard Platinum',
    owner: 'partner1',
    limit: '',
    closingDay: 8,
    dueDay: 15,
    color: '#ea580c'
  });

  const { cards, transactions, selectedMonth, couple, ownerFilter } = state;

  // Fechar modais ao pressionar tecla Escape (WCAG)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setIsModalOpen(false);
          setEditingCardId(null);
        }
        if (selectedCardInvoiceId) {
          setSelectedCardInvoiceId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedCardInvoiceId]);

  const openNewCardModal = () => {
    setEditingCardId(null);
    setForm({
      name: '',
      brand: 'Mastercard Platinum',
      owner: 'partner1',
      limit: '',
      closingDay: 8,
      dueDay: 15,
      color: '#ea580c'
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
      color: card.color || '#ea580c'
    });
    setIsModalOpen(true);
  };

  const filteredCards = useMemo(() => {
    if (!ownerFilter || ownerFilter === 'all' || ownerFilter === 'joint') return cards;
    return cards.filter((c) => c.owner === ownerFilter || c.owner === 'joint');
  }, [cards, ownerFilter]);

  const enrichedCards = useMemo(() => {
    return filteredCards.map((card) => {
      const allCardTxs = transactions.filter((t) => {
        if (t.type !== 'expense' || t.cardId !== card.id) return false;
        if (ownerFilter === 'joint' && t.owner !== 'joint') return false;
        if (ownerFilter === 'partner1' && t.owner !== 'partner1' && t.owner !== 'joint') return false;
        if (ownerFilter === 'partner2' && t.owner !== 'partner2' && t.owner !== 'joint') return false;
        return true;
      });

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

      const invoiceDueDateStr = buildSafeDueDate(selectedMonth, card.dueDay || 15);

      return {
        ...card,
        monthInvoiceTxs,
        monthInvoiceTotal,
        monthInvoicePending,
        totalUsedLimit,
        availableLimit,
        usagePct,
        invoiceDueDateStr
      };
    });
  }, [filteredCards, transactions, selectedMonth, ownerFilter]);

  const selectedCardInvoice = useMemo(
    () => enrichedCards.find((c) => c.id === selectedCardInvoiceId) || null,
    [enrichedCards, selectedCardInvoiceId]
  );

  const totalInvoicesMonth = enrichedCards.reduce((acc, c) => acc + c.monthInvoiceTotal, 0);
  const totalAvailableAllCards = enrichedCards.reduce((acc, c) => acc + c.availableLimit, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || Number(form.limit) <= 0) return;

    const payload = {
      ...form,
      limit: Number(form.limit),
      closingDay: Number(form.closingDay) || 10,
      dueDay: Number(form.dueDay) || 15
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
            <i className="fa-solid fa-credit-card"></i> Cartões de Crédito &amp; Faturas (
            {couple.partner1Name} &amp; {couple.partner2Name})
          </h2>
          <p>
            Gerencie os cartões do casal, ajuste limites, altere dias de fechamento/vencimento e
            acompanhe faturas de <strong>{getMonthLabel(selectedMonth)}</strong>.
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
          <span>Limite Disponível Somado</span>
          <strong className="text-emerald">{formatCurrency(totalAvailableAllCards)}</strong>
          <small>Soma dos limites livres de todos os cartões</small>
        </div>
        <div className="card mini-kpi">
          <span>Cartões Ativos do Casal</span>
          <strong>{enrichedCards.length} cartões</strong>
          <small>Clique em "Editar Cartão" para gerenciar</small>
        </div>
      </div>

      {/* GRID DE CARTÕES */}
      <div className="credit-cards-grid">
        {enrichedCards.map((card) => (
          <div key={card.id} className="credit-card-box card">
            {/* VISUAL DO CARTÃO (LIMPO E SEM NÚMEROS FAKE) */}
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

              <div className="cc-bottom">
                <div>
                  <small>Fecha todo dia {card.closingDay}</small>
                  <strong>Vencimento: Todo dia {card.dueDay}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
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
                    <div>
                      <span className="status-tag pending">
                        Aberta ({formatCurrency(card.monthInvoicePending)})
                      </span>
                      {card.monthInvoiceTotal > card.monthInvoicePending && (
                        <div style={{ fontSize: '10.5px', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                          Pago: {formatCurrency(card.monthInvoiceTotal - card.monthInvoicePending)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="status-tag paid">Fatura Quitada</span>
                  )}
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
                    className="progress-bar-fill"
                    style={{
                      width: `${card.usagePct}%`,
                      backgroundColor: card.usagePct > 85 ? '#ef4444' : card.color
                    }}
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
                  onClick={() => setSelectedCardInvoiceId(card.id)}
                >
                  <i className="fa-solid fa-list-check"></i> Ver Fatura ({card.monthInvoiceTxs.length})
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openEditCardModal(card)}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Editar Cartão
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
                    onClick={() => {
                      if (window.confirm(`Tem certeza que deseja remover o cartão "${card.name}"? As despesas vinculadas a ele serão preservadas.`)) {
                        onDeleteCard(card.id);
                      }
                    }}
                  >
                    <i className="fa-solid fa-trash"></i> Remover cartão
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: VER DETALHES DA FATURA */}
      {selectedCardInvoice && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCardInvoiceId(null)}
        >
          <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-receipt"></i> Fatura de{' '}
                {selectedCardInvoice.name} — {getMonthLabel(selectedMonth)}
              </h3>
              <button
                className="close-btn"
                onClick={() => setSelectedCardInvoiceId(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="flex-between wrap" style={{ marginBottom: '16px' }}>
                <div>
                  <small style={{ color: 'var(--text-muted)' }}>Total da Fatura deste Mês:</small>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>
                    {formatCurrency(selectedCardInvoice.monthInvoiceTotal)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: 'var(--text-muted)' }}>Vencimento da Fatura:</small>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>
                    Todo dia {selectedCardInvoice.dueDay} ({formatDateBR(selectedCardInvoice.invoiceDueDateStr)})
                  </div>
                </div>
              </div>

              {selectedCardInvoice.monthInvoiceTxs.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum lançamento no cartão para o mês de {getMonthLabel(selectedMonth)}.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="text-center">Data</th>
                        <th>Descrição</th>
                        <th className="text-center">Parcela</th>
                        <th className="text-center">Divisão</th>
                        <th className="text-center">Valor</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCardInvoice.monthInvoiceTxs.map((t) => (
                        <tr key={t.id}>
                          <td className="text-center font-mono-val">{formatDateBR(t.dueDate)}</td>
                          <td>
                            <strong>{t.title}</strong>
                          </td>
                          <td className="text-center">
                            {t.totalInstallments
                              ? `${t.installmentNumber}/${t.totalInstallments}`
                              : 'À vista'}
                          </td>
                          <td className="text-center">
                            <span className={`owner-badge ${t.owner}`}>
                              {t.owner === 'joint'
                                ? 'Casa (Casal)'
                                : t.owner === 'partner1'
                                  ? couple.partner1Name
                                  : couple.partner2Name}
                            </span>
                          </td>
                          <td className="text-center">
                            <strong className="font-mono-val">{formatCurrency(t.amount)}</strong>
                          </td>
                          <td className="text-center">
                            <span className={`status-tag ${t.status}`}>
                              {t.status === 'paid' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setSelectedCardInvoiceId(null)}
              >
                Fechar Fatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR CARTÃO */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-credit-card"></i>{' '}
                {editingCardId ? 'Editar Cartão de Crédito' : 'Cadastrar Novo Cartão de Crédito'}
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

              <div className="form-grid-2">
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
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="card-owner">Titular / Responsável</label>
                  <select
                    id="card-owner"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  >
                    <option value="partner1">{couple.partner1Name}</option>
                    <option value="partner2">{couple.partner2Name}</option>
                    <option value="joint">Conjunto da Casa</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="card-brand">Bandeira / Categoria</label>
                  <select
                    id="card-brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  >
                    <option value="Mastercard Platinum">Mastercard Platinum</option>
                    <option value="Mastercard Black">Mastercard Black</option>
                    <option value="Visa Platinum">Visa Platinum</option>
                    <option value="Visa Infinite">Visa Infinite</option>
                    <option value="Elo Nanquim">Elo Nanquim</option>
                    <option value="Outro">Outro</option>
                  </select>
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
                  {editingCardId ? 'Salvar Alterações do Cartão' : 'Salvar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
