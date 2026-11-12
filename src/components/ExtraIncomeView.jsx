import React, { useState, useMemo, useEffect } from 'react';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel
} from '../utils/formatters';

const WEEKS = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];

export default function ExtraIncomeView({
  state,
  onAddExtraIncome,
  onUpdateExtraIncome,
  onToggleExtraIncomeStatus,
  onDeleteExtraIncome
}) {
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'class' | 'sale' | 'service'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'received' | 'pending'
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    type: 'class',
    studentOrClient: '',
    weekOfMonth: 'Semana 2',
    date: `${state.selectedMonth}-11`,
    hoursOrQty: 2,
    unitPrice: 90,
    fuelCost: 0,
    owner: 'partner1',
    status: 'received',
    applyTitheAndOffering: true,
    notes: ''
  });

  const { extraIncomes = [], selectedMonth, couple, ownerFilter } = state;
  const isJointFilter = ownerFilter === 'joint';

  // Fechar modal ao pressionar tecla Escape (WCAG)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setIsModalOpen(false);
          setEditingId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const openModalWithType = (type = 'class') => {
    setEditingId(null);
    setForm({
      title: type === 'class' ? 'Aula Particular — ' : 'Venda — ',
      type,
      studentOrClient: '',
      weekOfMonth: 'Semana 2',
      date: `${selectedMonth}-11`,
      hoursOrQty: type === 'class' ? 2 : 1,
      unitPrice: type === 'class' ? 90 : 100,
      fuelCost: 0,
      owner: type === 'class' ? 'partner1' : 'partner2',
      status: 'received',
      applyTitheAndOffering: true,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      type: item.type || 'class',
      studentOrClient: item.studentOrClient || '',
      weekOfMonth: item.weekOfMonth || 'Semana 2',
      date: item.date || `${selectedMonth}-11`,
      hoursOrQty: item.hoursOrQty || 1,
      unitPrice: item.unitPrice || item.amount,
      fuelCost: Number(item.fuelCost || 0),
      owner: item.owner || 'partner1',
      status: item.status || 'received',
      applyTitheAndOffering: item.applyTitheAndOffering !== false,
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  // Filter by active month & ownerFilter
  const monthItems = useMemo(() => {
    if (ownerFilter === 'joint') return [];
    return extraIncomes
      .filter((item) => {
        if (!item.date || !item.date.startsWith(selectedMonth)) return false;
        if (ownerFilter === 'partner1' && item.owner !== 'partner1') return false;
        if (ownerFilter === 'partner2' && item.owner !== 'partner2') return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [extraIncomes, selectedMonth, ownerFilter]);

  // Calculate Tithe (10%) + Offering (%) for an item
  const computeItemTitheAndOffering = (item) => {
    if (!couple.titheEnabled || !couple.includeExtraInTithe || item.applyTitheAndOffering === false) {
      return { tithe: 0, offering: 0, totalConsecrated: 0, netAmount: Number(item.amount || 0) };
    }
    const gross = Number(item.amount || 0);
    const tithePct = Number(couple.tithePercent ?? 10);
    const offeringPct =
      item.owner === 'partner2'
        ? Number(couple.partner2OfferingPercent ?? 5)
        : Number(couple.partner1OfferingPercent ?? 5);

    const tithe = Number(((gross * tithePct) / 100).toFixed(2));
    const offering = Number(((gross * offeringPct) / 100).toFixed(2));
    const totalConsecrated = Number((tithe + offering).toFixed(2));
    const netAmount = Number((gross - totalConsecrated).toFixed(2));

    return { tithe, offering, offeringPct, totalConsecrated, netAmount };
  };

  // Summary metrics
  const metrics = useMemo(() => {
    const totalGross = monthItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const totalReceived = monthItems
      .filter((i) => i.status === 'received')
      .reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const totalPending = Math.max(0, totalGross - totalReceived);

    const classItems = monthItems.filter((i) => i.type === 'class');
    const totalClassesAmount = classItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const totalClassHours = classItems.reduce((acc, i) => acc + Number(i.hoursOrQty || 0), 0);
    const totalFuelCost = monthItems.reduce((acc, i) => acc + Number(i.fuelCost || 0), 0);

    const salesItems = monthItems.filter((i) => i.type !== 'class');
    const totalSalesAmount = salesItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);

    let totalTithe = 0;
    let totalOffering = 0;
    let pendingConsecrated = 0;
    monthItems.forEach((item) => {
      const calc = computeItemTitheAndOffering(item);
      if (item.status === 'received') {
        totalTithe += calc.tithe;
        totalOffering += calc.offering;
      } else {
        pendingConsecrated += calc.totalConsecrated;
      }
    });

    const totalConsecrated = Number((totalTithe + totalOffering).toFixed(2));
    const totalNet = Math.max(0, totalGross - totalConsecrated - pendingConsecrated);

    return {
      totalGross,
      totalReceived,
      totalPending,
      totalClassesAmount,
      totalClassHours,
      totalFuelCost,
      totalSalesAmount,
      salesCount: salesItems.length,
      totalTithe,
      totalOffering,
      totalConsecrated,
      pendingConsecrated: Number(pendingConsecrated.toFixed(2)),
      totalNet
    };
  }, [monthItems, couple]);

  // Weekly breakdown
  const weeklySummary = useMemo(() => {
    return WEEKS.map((weekLabel) => {
      const items = monthItems.filter((i) => i.weekOfMonth === weekLabel);
      const total = items.reduce((acc, i) => acc + Number(i.amount || 0), 0);
      const received = items
        .filter((i) => i.status === 'received')
        .reduce((acc, i) => acc + Number(i.amount || 0), 0);
      const classesCount = items
        .filter((i) => i.type === 'class')
        .reduce((acc, i) => acc + Number(i.hoursOrQty || 0), 0);
      return {
        weekLabel,
        count: items.length,
        total,
        received,
        pending: Math.max(0, total - received),
        classesCount
      };
    });
  }, [monthItems]);

  const filteredItems = useMemo(() => {
    return monthItems.filter((item) => {
      if (selectedWeek !== 'all' && item.weekOfMonth !== selectedWeek) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (
        search &&
        !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !(item.studentOrClient || '').toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [monthItems, selectedWeek, typeFilter, statusFilter, search]);

  const computedFormGross = useMemo(() => {
    const q = Number(form.hoursOrQty) || 0;
    const u = Number(form.unitPrice) || 0;
    return Number((q * u).toFixed(2));
  }, [form.hoursOrQty, form.unitPrice]);

  const computedFormFuel = useMemo(() => {
    return Math.max(0, Number(form.fuelCost) || 0);
  }, [form.fuelCost]);

  const computedFormTotal = useMemo(() => {
    return Math.max(0, Number((computedFormGross - computedFormFuel).toFixed(2)));
  }, [computedFormGross, computedFormFuel]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || computedFormGross <= 0) return;

    if (editingId && onUpdateExtraIncome) {
      onUpdateExtraIncome({
        id: editingId,
        ...form,
        hoursOrQty: Number(form.hoursOrQty) || 1,
        unitPrice: Number(form.unitPrice) || computedFormGross,
        grossAmount: computedFormGross,
        fuelCost: computedFormFuel,
        amount: computedFormTotal
      });
    } else {
      onAddExtraIncome({
        ...form,
        hoursOrQty: Number(form.hoursOrQty) || 1,
        unitPrice: Number(form.unitPrice) || computedFormGross,
        grossAmount: computedFormGross,
        fuelCost: computedFormFuel,
        amount: computedFormTotal
      });
    }

    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleDeleteClick = (item) => {
    if (window.confirm(`Deseja realmente excluir o registro "${item.title}"?`)) {
      onDeleteExtraIncome(item.id);
    }
  };

  return (
    <div className="view-container">
      {/* HEADER DA SEÇÃO */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-chalkboard-user"></i> Renda Extra: Aulas Particulares, Vendas &amp; Serviços
          </h2>
          <p>
            Controle semanal das aulas particulares, vendas e ganhos extras de{' '}
            <strong>{getMonthLabel(selectedMonth)}</strong> — com cálculo automático de quanto você
            vai receber e da primícia (Dízimo + Oferta).
          </p>
        </div>
        <div className="header-btns">
          <button
            className="btn btn-outline"
            onClick={() => openModalWithType('sale')}
          >
            <i className="fa-solid fa-bag-shopping"></i> + Registrar Venda / Extra
          </button>
          <button
            className="btn btn-primary"
            onClick={() => openModalWithType('class')}
          >
            <i className="fa-solid fa-graduation-cap"></i> + Registrar Aula Particular
          </button>
        </div>
      </div>

      {/* KPIs DE RENDA EXTRA DO MÊS */}
      <div className="kpi-grid">
        <div className="kpi-card card">
          <div className="kpi-icon emerald">
            <i className="fa-solid fa-sack-dollar"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Renda Extra no Mês</span>
            <strong className="kpi-value">{formatCurrency(metrics.totalGross)}</strong>
            <span className="kpi-sub">
              Líquido livre: <strong>{formatCurrency(metrics.totalNet)}</strong>
            </span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon teal">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Já Recebido (No Bolso)</span>
            <strong className="kpi-value text-emerald">
              {formatCurrency(metrics.totalReceived)}
            </strong>
            <span className="kpi-sub">Aulas e vendas já pagas</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon amber">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Falta Receber (Previsto)</span>
            <strong className="kpi-value text-amber">
              {formatCurrency(metrics.totalPending)}
            </strong>
            <span className="kpi-sub">Agendado / pendente de clientes</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon blue">
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Ganhos com Aulas</span>
            <strong className="kpi-value">{formatCurrency(metrics.totalClassesAmount)}</strong>
            <span className="kpi-sub">
              <strong>{metrics.totalClassHours}h</strong> de aulas no mês
              {metrics.totalFuelCost > 0 && (
                <> · Gasolina: -{formatCurrency(metrics.totalFuelCost)}</>
              )}
            </span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon purple">
            <i className="fa-solid fa-bag-shopping"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Ganhos com Vendas &amp; Extras</span>
            <strong className="kpi-value">{formatCurrency(metrics.totalSalesAmount)}</strong>
            <span className="kpi-sub">{metrics.salesCount} vendas/serviços no mês</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon rose">
            <i className="fa-solid fa-hands-praying"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Dízimo + Oferta (Renda Extra)</span>
            <strong className="kpi-value">
              {formatCurrency(metrics.totalConsecrated)}
            </strong>
            <span className="kpi-sub">
              Dízimo: {formatCurrency(metrics.totalTithe)} · Oferta:{' '}
              {formatCurrency(metrics.totalOffering)}
            </span>
          </div>
        </div>
      </div>

      {/* VISÃO POR SEMANA DO MÊS (CLICÁVEL PARA FILTRAR) */}
      <div className="card">
        <div className="card-header flex-between wrap">
          <div>
            <h3>
              <i className="fa-solid fa-calendar-week"></i> Produção por Semana —{' '}
              {getMonthLabel(selectedMonth)}
            </h3>
            <p className="card-subtitle">
              Clique em uma semana abaixo para filtrar as aulas e vendas daquela semana específica
            </p>
          </div>
          {selectedWeek !== 'all' && (
            <button
              className="btn btn-sm btn-soft"
              onClick={() => setSelectedWeek('all')}
            >
              <i className="fa-solid fa-filter-circle-xmark"></i> Mostrando {selectedWeek} — Ver Mês
              Inteiro
            </button>
          )}
        </div>

        <div className="weeks-grid">
          {weeklySummary.map((w) => {
            const isSelected = selectedWeek === w.weekLabel;
            return (
              <div
                key={w.weekLabel}
                className={`week-card ${isSelected ? 'active' : ''}`}
                onClick={() =>
                  setSelectedWeek(isSelected ? 'all' : w.weekLabel)
                }
              >
                <div className="week-card-top">
                  <strong>{w.weekLabel}</strong>
                  <span className="badge-pill badge-emerald">
                    {w.count} {w.count === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div className="week-card-total">{formatCurrency(w.total)}</div>
                <div className="week-card-sub">
                  <span className="text-emerald">
                    Recebido: {formatCurrency(w.received)}
                  </span>
                  {w.pending > 0 && (
                    <span className="text-amber">
                      A receber: {formatCurrency(w.pending)}
                    </span>
                  )}
                </div>
                {w.classesCount > 0 && (
                  <small className="week-hours-tag">
                    <i className="fa-solid fa-clock"></i> {w.classesCount}h de aulas na semana
                  </small>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AVISO QUANDO FILTRO DE CONTAS CONJUNTAS ESTIVER ATIVO */}
      {isJointFilter && (
        <div className="card settlement-banner" style={{ background: 'var(--bg-subtle)', marginBottom: '16px' }}>
          <div className="settlement-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <i className="fa-solid fa-circle-info"></i>
          </div>
          <div className="settlement-text">
            <h4>Rendas Extras são Atividades Pessoais</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Aulas particulares, mentorias e vendas são geradas individualmente por <strong>{couple.partner1Name}</strong> ou <strong>{couple.partner2Name}</strong>.
              Para visualizá-las ou registrar novas, selecione <strong>Todos</strong> ou o cônjuge específico no topo.
            </p>
          </div>
        </div>
      )}

      {/* BARRA DE FILTROS & TABELA DE AULAS E VENDAS */}
      <div className="card table-card">
        <div className="tabs-and-filters">
          <div className="tab-buttons">
            {[
              { id: 'all', label: 'Todos os Ganhos' },
              { id: 'class', label: '🎓 Aulas Particulares' },
              { id: 'sale', label: '🛍️ Vendas & Produtos' },
              { id: 'service', label: '⚡ Serviços / Freelas' }
            ].map((t) => (
              <button
                key={t.id}
                className={`tab-btn ${typeFilter === t.id ? 'active' : ''}`}
                onClick={() => setTypeFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="inline-filters">
            <div className="search-input-wrap sm">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                id="ext-search"
                type="text"
                placeholder="Buscar aluno, cliente ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              id="ext-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os Status</option>
              <option value="received">Já Recebidos</option>
              <option value="pending">A Receber</option>
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="text-center">Data &amp; Semana</th>
              <th>Atividade / Descrição</th>
              <th>Aluno / Cliente</th>
              <th className="text-center">Qtd × Valor Unit.</th>
              <th className="text-center">Valor Bruto</th>
              <th className="text-center">Dízimo + Oferta</th>
              <th className="text-center">Quem Realizou</th>
              <th className="text-center">Status (1 Clique)</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const calc = computeItemTitheAndOffering(item);
              const isClass = item.type === 'class';

              return (
                <tr key={item.id}>
                  <td className="text-center">
                    <div>
                      <strong className="font-mono-val">{formatDateBR(item.date)}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.weekOfMonth}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-title-with-icon">
                      <span
                        className="cat-icon-badge"
                        style={{
                          backgroundColor: isClass ? '#dbeafe' : '#ede9fe',
                          color: isClass ? '#2563eb' : '#7c3aed'
                        }}
                      >
                        <i
                          className={`fa-solid ${
                            isClass ? 'fa-chalkboard-user' : 'fa-bag-shopping'
                          }`}
                        ></i>
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.notes || (isClass ? 'Aula Particular' : 'Venda / Extra')}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{item.studentOrClient || '-'}</strong>
                  </td>
                  <td className="text-center">
                    <span className="method-pill font-mono-val">
                      {item.hoursOrQty}
                      {isClass ? 'h' : ' un.'} × {formatCurrency(item.unitPrice)}
                    </span>
                  </td>
                  <td className="text-center">
                    <strong className="text-emerald font-mono-val">{formatCurrency(item.amount)}</strong>
                    {Number(item.fuelCost || 0) > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Bruto {formatCurrency(item.grossAmount || Number(item.amount || 0) + Number(item.fuelCost || 0))} − Gas. {formatCurrency(item.fuelCost)}
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    {calc.totalConsecrated > 0 ? (
                      <div>
                        <strong className="font-mono-val">{formatCurrency(calc.totalConsecrated)}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          10% + {calc.offeringPct}% (Líq: {formatCurrency(calc.netAmount)})
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Isento</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`owner-badge ${item.owner}`}>
                      {item.owner === 'partner1'
                        ? couple.partner1Name
                        : couple.partner2Name}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      className={`status-toggle-btn ${
                        item.status === 'received' ? 'paid' : 'pending'
                      }`}
                      title="Clique para alternar entre Recebido e A Receber"
                      onClick={() => onToggleExtraIncomeStatus(item.id)}
                    >
                      <i
                        className={`fa-solid ${
                          item.status === 'received' ? 'fa-circle-check' : 'fa-clock'
                        }`}
                      ></i>
                      {item.status === 'received' ? 'Recebido' : 'A Receber'}
                    </button>
                  </td>
                  <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="icon-btn"
                      title="Editar Registro"
                      style={{ marginRight: '6px' }}
                      onClick={() => openEditModal(item)}
                    >
                      <i className="fa-solid fa-pencil"></i>
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Excluir Registro"
                      onClick={() => handleDeleteClick(item)}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan="9" className="empty-table-cell">
                  {isJointFilter
                    ? 'Rendas extras são atividades individuais. Selecione "Todos", Wesley ou Beatriz no topo para gerenciar.'
                    : 'Nenhuma aula ou venda registrada para o filtro selecionado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NOVA AULA PARTICULAR OU VENDA */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-chalkboard-user"></i>{' '}
                {editingId
                  ? 'Editar Registro de Renda Extra'
                  : form.type === 'class'
                  ? 'Registrar Aula Particular da Semana'
                  : 'Registrar Venda ou Ganho Extra'}
              </h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="ext-type">Tipo de Ganho *</label>
                  <select
                    id="ext-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="class">🎓 Aula Particular / Mentoria</option>
                    <option value="sale">🛍️ Venda de Produto / Encomenda</option>
                    <option value="service">⚡ Serviço / Projeto Extra</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ext-week">Semana do Mês *</label>
                  <select
                    id="ext-week"
                    value={form.weekOfMonth}
                    onChange={(e) => setForm({ ...form, weekOfMonth: e.target.value })}
                  >
                    {WEEKS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ext-date">Data da Aula / Venda *</label>
                  <input
                    id="ext-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="ext-title">
                    {form.type === 'class'
                      ? 'Matéria / Descrição da Aula *'
                      : 'Produto / Serviço Vendido *'}
                  </label>
                  <input
                    id="ext-title"
                    type="text"
                    required
                    placeholder={
                      form.type === 'class'
                        ? 'Ex: Aula de Matemática / Física...'
                        : 'Ex: Kit Encomenda, Consultoria...'
                    }
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ext-client">
                    {form.type === 'class' ? 'Nome do Aluno / Turma' : 'Nome do Cliente'}
                  </label>
                  <input
                    id="ext-client"
                    type="text"
                    placeholder="Ex: João Pedro, Mariana..."
                    value={form.studentOrClient}
                    onChange={(e) => setForm({ ...form, studentOrClient: e.target.value })}
                  />
                </div>
              </div>

              {/* CÁLCULO AUTOMÁTICO DE HORAS x VALOR - GASOLINA */}
              <div className="installment-plan-box">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label htmlFor="ext-qty">
                      {form.type === 'class'
                        ? 'Quantidade de Horas / Aulas *'
                        : 'Quantidade Vendida *'}
                    </label>
                    <input
                      id="ext-qty"
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={form.hoursOrQty}
                      onChange={(e) => setForm({ ...form, hoursOrQty: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="ext-unit">
                      {form.type === 'class'
                        ? 'Valor da Hora / Aula (R$) *'
                        : 'Valor Unitário (R$) *'}
                    </label>
                    <input
                      id="ext-unit"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={form.unitPrice}
                      onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="ext-fuel-cost">Desconto Gasolina / Abastecimento (R$)</label>
                    <input
                      id="ext-fuel-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={form.fuelCost}
                      onChange={(e) => setForm({ ...form, fuelCost: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px dashed var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    Bruto: <strong>{formatCurrency(computedFormGross)}</strong>
                    {computedFormFuel > 0 && (
                      <>
                        {' '}− Gasolina: <strong>{formatCurrency(computedFormFuel)}</strong>
                      </>
                    )}
                  </span>
                  <span className="text-emerald" style={{ fontWeight: 700 }}>
                    Ganho Líquido da Renda: {formatCurrency(computedFormTotal)}
                  </span>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="ext-owner">Quem realizou?</label>
                  <select
                    id="ext-owner"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  >
                    <option value="partner1">{couple.partner1Name}</option>
                    <option value="partner2">{couple.partner2Name}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ext-status">Status do Pagamento</label>
                  <select
                    id="ext-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="received">Já Recebido (Pago pelo aluno/cliente)</option>
                    <option value="pending">A Receber (Pendente)</option>
                  </select>
                </div>

                <div className="form-group" style={{ justifyContent: 'center' }}>
                  <label className="checkbox-inline" htmlFor="ext-tithe-chk" style={{ marginTop: '22px' }}>
                    <input
                      id="ext-tithe-chk"
                      type="checkbox"
                      checked={form.applyTitheAndOffering}
                      onChange={(e) =>
                        setForm({ ...form, applyTitheAndOffering: e.target.checked })
                      }
                    />
                    <span>Calcular Dízimo (10%) + Oferta neste ganho</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="ext-notes">Observações</label>
                <input
                  id="ext-notes"
                  type="text"
                  placeholder="Opcional: dia do pagamento combinado, pacote mensal, etc."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
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
                  <i className="fa-solid fa-check"></i> {editingId ? 'Atualizar Registro' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

