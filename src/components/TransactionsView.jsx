import React, { useState, useMemo } from 'react';
import { CATEGORIES, INCOME_CATEGORIES } from '../data/initialState';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel
} from '../utils/formatters';

export default function TransactionsView({
  state,
  onOpenNewTransaction,
  onToggleTransactionStatus,
  onDeleteTransaction
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'paid' | 'income'
  const [selectedDay, setSelectedDay] = useState(null); // e.g., '2026-11-15'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [payModalTx, setPayModalTx] = useState(null);
  const [payForm, setPayForm] = useState({
    paidDate: '2026-11-11',
    paidBy: 'partner1',
    receiptFileName: ''
  });

  const { selectedMonth, transactions, couple, cards = [], ownerFilter } = state;

  const monthTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (!t.dueDate || !t.dueDate.startsWith(selectedMonth)) return false;
        if (ownerFilter !== 'all' && t.owner !== ownerFilter) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [transactions, selectedMonth, ownerFilter]);

  // Build Calendar Grid for selectedMonth
  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayTxs = monthTransactions.filter((t) => t.dueDate === dateStr);
      const dayExpenses = dayTxs.filter((t) => t.type === 'expense');
      const dayIncomes = dayTxs.filter((t) => t.type === 'income');
      const pendingCount = dayExpenses.filter((t) => t.status === 'pending').length;
      const totalExpenseDay = dayExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);

      // Check if any credit card invoice is due on this day
      const cardsDueToday = cards.filter((c) => Number(c.dueDay) === day);

      cells.push({
        empty: false,
        day,
        dateStr,
        dayTxs,
        expenseCount: dayExpenses.length,
        incomeCount: dayIncomes.length,
        pendingCount,
        totalExpenseDay,
        cardsDueToday
      });
    }
    return cells;
  }, [selectedMonth, monthTransactions, cards]);

  const filteredTransactions = useMemo(() => {
    return monthTransactions.filter((t) => {
      if (selectedDay && t.dueDate !== selectedDay) return false;
      if (activeTab === 'pending' && (t.type !== 'expense' || t.status !== 'pending')) return false;
      if (activeTab === 'paid' && (t.type !== 'expense' || t.status !== 'paid')) return false;
      if (activeTab === 'income' && t.type !== 'income') return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (cardFilter === 'pix' && t.paymentMethod !== 'PIX') return false;
      if (cardFilter !== 'all' && cardFilter !== 'pix' && t.cardId !== cardFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [monthTransactions, selectedDay, activeTab, categoryFilter, cardFilter, search]);

  const openConfirmPayModal = (tx) => {
    setPayModalTx(tx);
    setPayForm({
      paidDate: '2026-11-11',
      paidBy: tx.paidBy || 'partner1',
      receiptFileName: ''
    });
  };

  const handleConfirmPaySubmit = (e) => {
    e.preventDefault();
    if (!payModalTx) return;
    onToggleTransactionStatus(payModalTx.id, {
      status: 'paid',
      paidDate: payForm.paidDate,
      paidBy: payForm.paidBy,
      receiptFileName: payForm.receiptFileName
    });
    setPayModalTx(null);
  };

  const totalMonthPending = monthTransactions
    .filter((t) => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalMonthPaid = monthTransactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  return (
    <div className="view-container">
      {/* HEADER */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-calendar-check"></i> Lançamentos &amp; Calendário de Vencimentos
          </h2>
          <p>
            Controle todas as compras feitas no <strong>Inter Platinum</strong>,{' '}
            <strong>Nubank Chroma</strong> e contas de <strong>{getMonthLabel(selectedMonth)}</strong>.
            Clique em um dia do calendário para filtrar!
          </p>
        </div>
        <div className="header-btns">
          <button
            className="btn btn-outline"
            onClick={() => onOpenNewTransaction('income')}
          >
            <i className="fa-solid fa-arrow-trend-up text-emerald"></i> + Nova Receita
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onOpenNewTransaction('expense')}
          >
            <i className="fa-solid fa-plus"></i> + Novo Gasto (Cartão / Pix)
          </button>
        </div>
      </div>

      {/* CALENDÁRIO INTERATIVO DE VENCIMENTOS */}
      <div className="card calendar-card">
        <div className="card-header flex-between wrap">
          <div>
            <h3>
              <i className="fa-regular fa-calendar-days"></i> Calendário de Vencimentos —{' '}
              {getMonthLabel(selectedMonth)}
            </h3>
            <p className="card-subtitle">
              A Pagar no mês: <strong className="text-amber">{formatCurrency(totalMonthPending)}</strong> ·
              Já Quitado: <strong className="text-emerald">{formatCurrency(totalMonthPaid)}</strong>
            </p>
          </div>
          {selectedDay && (
            <button
              className="btn btn-sm btn-soft"
              onClick={() => setSelectedDay(null)}
            >
              <i className="fa-solid fa-filter-circle-xmark"></i> Mostrando dia{' '}
              {formatDateBR(selectedDay)} — Limpar Filtro
            </button>
          )}
        </div>

        <div className="calendar-weekdays">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="cal-weekday">
              {d}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((cell) => {
            if (cell.empty) {
              return <div key={cell.key} className="cal-day empty" />;
            }
            const isSelected = selectedDay === cell.dateStr;
            const hasExpenses = cell.expenseCount > 0;
            const hasPending = cell.pendingCount > 0;

            return (
              <div
                key={cell.dateStr}
                className={`cal-day ${isSelected ? 'selected' : ''} ${
                  hasExpenses ? 'has-events' : ''
                }`}
                onClick={() =>
                  setSelectedDay(isSelected ? null : cell.dateStr)
                }
              >
                <div className="cal-day-top">
                  <span className="cal-day-num">{cell.day}</span>
                  {cell.incomeCount > 0 && (
                    <span className="cal-income-dot" title="Receita neste dia">
                      +R$
                    </span>
                  )}
                </div>
                {cell.cardsDueToday && cell.cardsDueToday.length > 0 && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)' }}>
                    💳 Vence {cell.cardsDueToday[0].name.split(' ')[0]}
                  </div>
                )}
                {hasExpenses && (
                  <div className="cal-day-badges">
                    <span className={`cal-badge ${hasPending ? 'pending' : 'paid'}`}>
                      {cell.expenseCount} {cell.expenseCount === 1 ? 'item' : 'itens'}
                    </span>
                    <small className="cal-day-sum">
                      {formatCurrency(cell.totalExpenseDay)}
                    </small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ABAS & FILTROS DA TABELA */}
      <div className="card">
        <div className="tabs-and-filters">
          <div className="tab-buttons">
            {[
              { id: 'all', label: 'Todos do Mês' },
              { id: 'pending', label: 'Contas / Faturas a Pagar' },
              { id: 'paid', label: 'Histórico Pago' },
              { id: 'income', label: 'Receitas / Entradas' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-filters" style={{ flexWrap: 'wrap' }}>
            <div className="search-input-wrap sm">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                id="tx-search-input"
                type="text"
                placeholder="Buscar lançamento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              id="tx-card-filter"
              value={cardFilter}
              onChange={(e) => setCardFilter(e.target.value)}
            >
              <option value="all">Todos os Cartões / Meios</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name}
                </option>
              ))}
              <option value="pix">💠 PIX / Outros</option>
            </select>
            <select
              id="tx-cat-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas Categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LISTAGEM DE LANÇAMENTOS */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center">Vencimento</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th className="text-center">Divisão</th>
              <th className="text-center">Onde foi feito (Cartão / Meio)</th>
              <th className="text-center">Valor</th>
              <th className="text-center">Status (Clique Rápido)</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => {
              const allCats = [...CATEGORIES, ...INCOME_CATEGORIES];
              const cat = allCats.find((c) => c.id === tx.category) || CATEGORIES[8];
              const cardObj = cards.find((c) => c.id === tx.cardId) || null;

              return (
                <tr key={tx.id}>
                  <td className="text-center">
                    <strong className="font-mono-val">{formatDateBR(tx.dueDate)}</strong>
                  </td>
                  <td>
                    <div className="cell-title-with-icon">
                      <span
                        className="cat-icon-badge"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <i className={`fa-solid ${cat.icon}`}></i>
                      </span>
                      <div>
                        <strong>{tx.title}</strong>
                        <small>
                          {tx.totalInstallments
                            ? `Parcela ${tx.installmentNumber}/${tx.totalInstallments}`
                            : tx.type === 'income'
                            ? 'Entrada / Receita'
                            : 'Gasto do Mês'}
                          {tx.receiptFileName ? ` · 📎 ${tx.receiptFileName}` : ''}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{cat.name}</td>
                  <td className="text-center">
                    <span className={`owner-badge ${tx.owner}`}>
                      {tx.owner === 'joint'
                        ? 'Conjunto (Casa)'
                        : tx.owner === 'partner1'
                        ? couple.partner1Name
                        : couple.partner2Name}
                    </span>
                  </td>
                  <td className="text-center">
                    {cardObj ? (
                      <span
                        className="method-pill"
                        style={{
                          borderColor: cardObj.color,
                          color: cardObj.color,
                          backgroundColor: `${cardObj.color}15`,
                          fontWeight: 700
                        }}
                      >
                        <i className="fa-solid fa-credit-card"></i>{' '}
                        {cardObj.name.includes('Inter')
                          ? 'Inter Platinum'
                          : cardObj.name.includes('Nubank')
                          ? 'Nubank Chroma'
                          : cardObj.name}
                      </span>
                    ) : (
                      <span className="method-pill">{tx.paymentMethod || 'PIX'}</span>
                    )}
                  </td>
                  <td className="text-center">
                    <strong
                      className={`font-mono-val ${
                        tx.type === 'income' ? 'text-emerald' : ''
                      }`}
                    >
                      {tx.type === 'income' ? '+ ' : ''}
                      {formatCurrency(tx.amount)}
                    </strong>
                  </td>
                  <td className="text-center">
                    <button
                      className={`status-toggle-btn ${tx.status}`}
                      title="Clique para alternar entre Pago e Pendente"
                      onClick={() =>
                        onToggleTransactionStatus(tx.id, {
                          status: tx.status === 'paid' ? 'pending' : 'paid',
                          paidDate: tx.status === 'paid' ? '' : '2026-11-11'
                        })
                      }
                    >
                      <i
                        className={`fa-solid ${
                          tx.status === 'paid' ? 'fa-circle-check' : 'fa-clock'
                        }`}
                      ></i>
                      {tx.status === 'paid'
                        ? tx.type === 'income'
                          ? 'Recebido'
                          : 'Pago'
                        : 'Pendente'}
                    </button>
                  </td>
                  <td className="text-center">
                    <div className="row-actions">
                      {tx.status === 'pending' && tx.type === 'expense' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openConfirmPayModal(tx)}
                        >
                          <i className="fa-solid fa-receipt"></i> Quitar
                        </button>
                      )}
                      <button
                        className="icon-btn danger"
                        title="Excluir Lançamento"
                        onClick={() => onDeleteTransaction(tx.id)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  Nenhum lançamento encontrado para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE QUITAÇÃO COM COMPROVANTE */}
      {payModalTx && (
        <div className="modal-backdrop" onClick={() => setPayModalTx(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-file-invoice-dollar"></i> Registrar Pagamento da Conta
              </h3>
              <button className="close-btn" onClick={() => setPayModalTx(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleConfirmPaySubmit} className="modal-body">
              <div className="summary-strip-box">
                <div>
                  <small>Conta selecionada</small>
                  <strong>{payModalTx.title}</strong>
                </div>
                <div>
                  <small>Valor da Parcela / Conta</small>
                  <strong className="text-emerald">{formatCurrency(payModalTx.amount)}</strong>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="pay-date">Data do Pagamento *</label>
                  <input
                    id="pay-date"
                    type="date"
                    required
                    value={payForm.paidDate}
                    onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pay-who">Quem efetuou o pagamento?</label>
                  <select
                    id="pay-who"
                    value={payForm.paidBy}
                    onChange={(e) => setPayForm({ ...payForm, paidBy: e.target.value })}
                  >
                    <option value="partner1">{couple.partner1Name}</option>
                    <option value="partner2">{couple.partner2Name}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pay-receipt">Comprovante Bancário (PDF, PNG ou JPG)</label>
                <div className="upload-dropzone">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <p>Arraste o comprovante do Pix/Boleto ou selecione o arquivo</p>
                  <input
                    id="pay-receipt"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPayForm({ ...payForm, receiptFileName: file.name });
                      }
                    }}
                  />
                  {payForm.receiptFileName && (
                    <span className="attached-file-pill">
                      <i className="fa-solid fa-paperclip"></i> {payForm.receiptFileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPayModalTx(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Confirmar Quitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
