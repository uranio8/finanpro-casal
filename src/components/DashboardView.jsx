import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { CATEGORIES } from '../data/initialState';
import {
  formatCurrency,
  formatShortDateBR,
  getMonthLabel,
  getDaysDiffFromToday,
  getEffectiveMonthIncome,
  isAutoSalaryTransaction,
  isAutoTitheOrDonationTransaction
} from '../utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function DashboardView({
  state,
  onNavigate,
  onOpenNewTransaction,
  onQuickPayTransaction,
  onOpenCommitmentModal,
  onOpenMonthIncomeModal,
  onOpenReportModal
}) {
  const [cashFlowYear, setCashFlowYear] = useState(state.selectedMonth.split('-')[0] || '2026');
  const [cashFlowFilter, setCashFlowFilter] = useState('all'); // 'all' | 'paid' | 'pending'

  const {
    couple,
    selectedMonth,
    ownerFilter,
    categoryBudgets,
    transactions,
    extraIncomes = []
  } = state;

  // Sincronizar ano do gráfico de Fluxo de Caixa ao navegar entre anos na Sidebar
  useEffect(() => {
    const activeYr = selectedMonth ? selectedMonth.split('-')[0] : '2026';
    if (activeYr) {
      setCashFlowYear(activeYr);
    }
  }, [selectedMonth]);

  // Anos disponíveis dinamicamente para o gráfico de Fluxo de Caixa (suporta parcelamentos 36x em 2028/2029)
  const availableYears = useMemo(() => {
    const yrs = new Set(['2026', '2027']);
    if (selectedMonth) yrs.add(selectedMonth.split('-')[0]);
    transactions.forEach((t) => {
      if (t.dueDate && t.dueDate.length >= 4) {
        yrs.add(t.dueDate.slice(0, 4));
      }
    });
    return Array.from(yrs).sort();
  }, [transactions, selectedMonth]);

  // Filter transactions by ownerFilter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (ownerFilter === 'all') return true;
      return tx.owner === ownerFilter;
    });
  }, [transactions, ownerFilter]);

  // Extra incomes in selectedMonth
  const monthExtraIncomes = useMemo(() => {
    return extraIncomes.filter((item) => {
      if (!item.date || !item.date.startsWith(selectedMonth)) return false;
      if (ownerFilter === 'partner1' && item.owner !== 'partner1') return false;
      if (ownerFilter === 'partner2' && item.owner !== 'partner2') return false;
      if (ownerFilter === 'joint') return false;
      return true;
    });
  }, [extraIncomes, selectedMonth, ownerFilter]);

  const totalExtraIncomeMonth = useMemo(
    () => monthExtraIncomes.reduce((acc, i) => acc + Number(i.amount || 0), 0),
    [monthExtraIncomes]
  );

  // Current month transactions
  const monthTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.dueDate && tx.dueDate.startsWith(selectedMonth));
  }, [filteredTransactions, selectedMonth]);

  const monthIncomes = useMemo(
    () => monthTransactions.filter((tx) => tx.type === 'income'),
    [monthTransactions]
  );

  const monthExpenses = useMemo(
    () => monthTransactions.filter((tx) => tx.type === 'expense'),
    [monthTransactions]
  );

  const effectiveMonthIncome = useMemo(
    () => getEffectiveMonthIncome(state, selectedMonth),
    [state, selectedMonth]
  );

  const baseSalaryIncome = useMemo(() => {
    if (ownerFilter === 'partner1') return effectiveMonthIncome.partner1Income;
    if (ownerFilter === 'partner2') return effectiveMonthIncome.partner2Income;
    return effectiveMonthIncome.partner1Income + effectiveMonthIncome.partner2Income;
  }, [effectiveMonthIncome, ownerFilter]);

  // Receitas Avulsas adicionadas diretamente via "+ Nova Receita" em Lançamentos (excluindo salários automáticos)
  const adhocIncome = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'income' && !isAutoSalaryTransaction(tx))
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
  }, [monthTransactions]);

  const totalIncome = baseSalaryIncome + totalExtraIncomeMonth + adhocIncome;

  // Dízimo (10%) + Oferta (% configurada) Calculation sobre a renda específica do mês
  const titheSummary = useMemo(() => {
    const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
    const p1OffPct = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
    const p2OffPct = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

    const p1Sal = effectiveMonthIncome.partner1Income;
    const p2Sal = effectiveMonthIncome.partner2Income;

    const p1Extra = extraIncomes
      .filter(
        (i) =>
          i.date &&
          i.date.startsWith(selectedMonth) &&
          i.owner === 'partner1' &&
          i.applyTitheAndOffering !== false &&
          i.status === 'received'
      )
      .reduce((acc, i) => acc + Number(i.amount || 0), 0);

    const p2Extra = extraIncomes
      .filter(
        (i) =>
          i.date &&
          i.date.startsWith(selectedMonth) &&
          i.owner === 'partner2' &&
          i.applyTitheAndOffering !== false &&
          i.status === 'received'
      )
      .reduce((acc, i) => acc + Number(i.amount || 0), 0);

    const p1BaseForTithe = p1Sal + (couple.includeExtraInTithe ? p1Extra : 0);
    const p2BaseForTithe = p2Sal + (couple.includeExtraInTithe ? p2Extra : 0);

    const p1Tithe = (p1BaseForTithe * tithePct) / 100;
    const p1Offering = (p1BaseForTithe * p1OffPct) / 100;
    const p2Tithe = (p2BaseForTithe * tithePct) / 100;
    const p2Offering = (p2BaseForTithe * p2OffPct) / 100;

    const donation = effectiveMonthIncome.donationAmount;

    return {
      tithePct,
      p1OffPct,
      p2OffPct,
      p1Tithe,
      p1Offering,
      p1Total: p1Tithe + p1Offering,
      p2Tithe,
      p2Offering,
      p2Total: p2Tithe + p2Offering,
      donation,
      totalTithe: p1Tithe + p2Tithe,
      totalOffering: p1Offering + p2Offering,
      grandTotal: p1Tithe + p1Offering + p2Tithe + p2Offering + donation
    };
  }, [couple, extraIncomes, selectedMonth, effectiveMonthIncome]);

  const totalExpense = useMemo(
    () => monthExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [monthExpenses]
  );

  const totalPaidExpense = useMemo(
    () =>
      monthExpenses
        .filter((t) => t.status === 'paid')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [monthExpenses]
  );

  const totalPendingExpense = Math.max(0, totalExpense - totalPaidExpense);
  const freeBalance = totalIncome - totalExpense;
  const paidPercentage = totalExpense > 0 ? Math.round((totalPaidExpense / totalExpense) * 100) : 0;
  const committedIncomePct = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

  const paidCount = monthExpenses.filter((t) => t.status === 'paid').length;
  const totalCount = monthExpenses.length;
  const overdueExpenses = useMemo(() => {
    return monthExpenses.filter((t) => {
      if (t.status === 'paid') return false;
      const diff = getDaysDiffFromToday(t.dueDate);
      return diff !== null && diff < 0;
    });
  }, [monthExpenses]);

  // Próximos vencimentos e pagamentos realizados restritos ao mês selecionado (selectedMonth)
  const upcomingExpenses = useMemo(() => {
    return monthExpenses
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [monthExpenses]);

  const nextDue = upcomingExpenses[0] || null;
  const nextDueDays = nextDue ? getDaysDiffFromToday(nextDue.dueDate) : null;

  const recentPaidExpenses = useMemo(() => {
    return monthExpenses
      .filter((t) => t.status === 'paid')
      .sort((a, b) => (b.paidDate || b.dueDate).localeCompare(a.paidDate || a.dueDate))
      .slice(0, 5);
  }, [monthExpenses]);

  // Category Breakdown for Doughnut & Budgets
  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const spent = monthExpenses
        .filter((t) => t.category === cat.id)
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const budget = Number(categoryBudgets[cat.id] || 0);
      const pct = totalExpense > 0 ? Math.round((spent / totalExpense) * 100) : 0;
      return {
        ...cat,
        spent,
        budget,
        pct
      };
    }).sort((a, b) => b.spent - a.spent);
  }, [monthExpenses, categoryBudgets, totalExpense]);

  const activeCategories = categoryBreakdown.filter((c) => c.spent > 0);

  const categoryChartData = {
    labels: activeCategories.map((c) => c.name),
    datasets: [
      {
        data: activeCategories.map((c) => c.spent),
        backgroundColor: activeCategories.map((c) => c.color),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }
    ]
  };

  const paidVsPendingChartData = {
    labels: ['Já Pago', 'Falta Pagar'],
    datasets: [
      {
        data: [totalPaidExpense, totalPendingExpense || (totalPaidExpense === 0 ? 1 : 0)],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6
      }
    ]
  };

  // Monthly Cash Flow
  const monthlyCashFlow = useMemo(() => {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    const values = months.map((label, idx) => {
      const ym = `${cashFlowYear}-${String(idx + 1).padStart(2, '0')}`;
      const allMonthExpenses = transactions.filter(
        (t) => t.type === 'expense' && t.dueDate && t.dueDate.startsWith(ym)
      );
      const list = filteredTransactions.filter(
        (t) => t.type === 'expense' && t.dueDate && t.dueDate.startsWith(ym)
      );
      const filteredList = list.filter((t) => {
        if (cashFlowFilter === 'paid') return t.status === 'paid';
        if (cashFlowFilter === 'pending') return t.status === 'pending';
        return true;
      });
      let sum = filteredList.reduce((acc, t) => acc + Number(t.amount || 0), 0);

      // Se o mês possui compromissos ativos mas ainda não foi visitado na Sidebar (sem tx-diz materializado),
      // somar a primícia prevista do mês para manter consistência 100% estável no gráfico anual
      const hasMaterializedAutoTithe = allMonthExpenses.some((t) =>
        isAutoTitheOrDonationTransaction(t)
      );
      if (couple.titheEnabled && !hasMaterializedAutoTithe && allMonthExpenses.length > 0) {
        const isPastOrCurrentRef = ym <= '2026-11';
        const autoStatus = isPastOrCurrentRef ? 'paid' : 'pending';
        if (cashFlowFilter === 'all' || cashFlowFilter === autoStatus) {
          const eff = getEffectiveMonthIncome(state, ym);
          const tithePct = Number(couple.tithePercent ?? 10);
          const p1OffPct = Number(couple.partner1OfferingPercent ?? 5);
          const p2OffPct = Number(couple.partner2OfferingPercent ?? 5);
          const mExtras = (extraIncomes || []).filter((i) => i.date?.startsWith(ym));
          const p1Ex = couple.includeExtraInTithe
            ? mExtras
                .filter(
                  (i) =>
                    i.owner === 'partner1' &&
                    i.status === 'received' &&
                    i.applyTitheAndOffering !== false
                )
                .reduce((a, i) => a + Number(i.amount || 0), 0)
            : 0;
          const p2Ex = couple.includeExtraInTithe
            ? mExtras
                .filter(
                  (i) =>
                    i.owner === 'partner2' &&
                    i.status === 'received' &&
                    i.applyTitheAndOffering !== false
                )
                .reduce((a, i) => a + Number(i.amount || 0), 0)
            : 0;
          const p1TitheVal = Number(
            (((eff.partner1Income + p1Ex) * (tithePct + p1OffPct)) / 100).toFixed(2)
          );
          const p2TitheVal = Number(
            (((eff.partner2Income + p2Ex) * (tithePct + p2OffPct)) / 100).toFixed(2)
          );
          if (ownerFilter === 'all' || ownerFilter === 'partner1') sum += p1TitheVal;
          if (ownerFilter === 'all' || ownerFilter === 'partner2') sum += p2TitheVal;
        }
      }

      return { label, ym, sum: Number(sum.toFixed(2)) };
    });

    const activeMonths = values.filter((v) => v.sum > 0);
    const totalYearVolume = values.reduce((acc, v) => acc + v.sum, 0);
    const avgActiveMonth = activeMonths.length > 0 ? totalYearVolume / activeMonths.length : 0;
    const peakMonth = values.reduce(
      (max, cur) => (cur.sum > max.sum ? cur : max),
      { label: '-', sum: 0 }
    );

    return {
      months,
      values,
      activeMonthsCount: activeMonths.length,
      totalYearVolume,
      avgActiveMonth,
      peakMonth
    };
  }, [filteredTransactions, transactions, extraIncomes, couple, state, ownerFilter, cashFlowYear, cashFlowFilter]);

  const cashFlowChartData = {
    labels: monthlyCashFlow.months,
    datasets: [
      {
        label: 'Desembolso Mensal (R$)',
        data: monthlyCashFlow.values.map((v) => v.sum),
        backgroundColor: monthlyCashFlow.values.map((v) =>
          v.ym === selectedMonth ? '#059669' : '#94a3b8'
        ),
        borderRadius: 8,
        maxBarThickness: 38
      }
    ]
  };

  const totalBudgetCeiling = Object.values(categoryBudgets).reduce(
    (acc, v) => acc + Number(v || 0),
    0
  );

  const motivationalMessage =
    paidPercentage >= 80
      ? 'Quase tudo quitado neste mês! Vocês estão dando um show de organização ✨'
      : paidPercentage >= 40
      ? 'Mais da metade do caminho! O controle financeiro do mês está indo muito bem 🌱'
      : 'Mês começando! Acompanhem os próximos vencimentos para manter tudo em dia 💡';

  return (
    <div className="view-container">
      {/* HERO HEADER */}
      <div className="hero-banner card">
        <div className="hero-left">
          <div className="couple-avatar">
            <i className="fa-solid fa-heart-circle-check"></i>
          </div>
          <div>
            <div className="hero-greeting">
              Olá, <strong>{couple.partner1Name} &amp; {couple.partner2Name}</strong>! ✨
            </div>
            <div className="hero-subtitle">
              Visão de <strong>{getMonthLabel(selectedMonth)}</strong> ·{' '}
              {freeBalance >= 0 ? (
                <span className="text-emerald">
                  Saldo livre previsto de <strong>{formatCurrency(freeBalance)}</strong> no mês!
                </span>
              ) : (
                <span className="text-danger">
                  Atenção: despesas superam a renda em{' '}
                  <strong>{formatCurrency(Math.abs(freeBalance))}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hero-actions">
          {onOpenMonthIncomeModal && (
            <button
              className="btn btn-outline"
              title="Informar quanto você e seu cônjuge receberam especificamente neste mês"
              onClick={onOpenMonthIncomeModal}
            >
              <i className="fa-solid fa-money-bill-wave text-emerald"></i> Renda de {getMonthLabel(selectedMonth).split(' ')[0]}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => onOpenNewTransaction('expense')}
          >
            <i className="fa-solid fa-plus"></i> Nova Despesa
          </button>
          <button
            className="btn btn-outline"
            onClick={() => onNavigate('extra-income')}
          >
            <i className="fa-solid fa-chalkboard-user"></i> Aulas &amp; Renda Extra
          </button>
          <button
            className="btn btn-soft"
            onClick={() => onOpenCommitmentModal()}
          >
            <i className="fa-solid fa-file-invoice-dollar"></i> Novo Parcelamento
          </button>
        </div>
      </div>

      {/* PAINEL DE FIDELIDADE: DÍZIMO (10%) & OFERTAS DO CASAL */}
      {couple.titheEnabled && (
        <div className="card tithe-banner-card">
          <div className="flex-between wrap">
            <div className="tithe-banner-left">
              <div className="tithe-icon-circle">
                <i className="fa-solid fa-hands-praying"></i>
              </div>
              <div>
                <span className="badge-pill badge-emerald">
                  Primícias &amp; Fidelidade — Dízimo (10%) + Oferta Mensal
                </span>
                <h4>
                  Total Consagrado em {getMonthLabel(selectedMonth)}:{' '}
                  <span className="text-emerald">{formatCurrency(titheSummary.grandTotal)}</span>
                </h4>
                <small>
                  Dízimo (10%): <strong>{formatCurrency(titheSummary.totalTithe)}</strong> · Ofertas
                  ({titheSummary.p1OffPct}% / {titheSummary.p2OffPct}%):{' '}
                  <strong>{formatCurrency(titheSummary.totalOffering)}</strong>{' '}
                  {couple.includeExtraInTithe ? '(inclui Salários + Renda Extra)' : '(apenas Salários)'}
                </small>
              </div>
            </div>

            <div className="tithe-partner-pills">
              <div className="tithe-mini-box">
                <small>
                  {couple.partner1Name} (10% + {titheSummary.p1OffPct}%)
                </small>
                <strong>{formatCurrency(titheSummary.p1Total)}</strong>
              </div>
              <div className="tithe-mini-box">
                <small>
                  {couple.partner2Name} (10% + {titheSummary.p2OffPct}%)
                </small>
                <strong>{formatCurrency(titheSummary.p2Total)}</strong>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onNavigate('settings')}
              >
                <i className="fa-solid fa-Sliders"></i> Ajustar % Oferta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE PROGRESSO DO MÊS */}
      <div className="card progress-hero-card">
        <div className="progress-hero-top">
          <div>
            <span className="badge-pill badge-emerald">
              <i className="fa-solid fa-sparkles"></i> Progresso de Quitação do Mês
            </span>
            <h3 className="progress-motivation">{motivationalMessage}</h3>
          </div>
          <div className="progress-hero-right">
            <div className="big-pct">{paidPercentage}% quitado</div>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => (onOpenReportModal ? onOpenReportModal() : window.print())}
            >
              <i className="fa-solid fa-file-pdf"></i> Relatório Mensal &amp; Anual (PDF)
            </button>
          </div>
        </div>

        <div className="progress-bar-track lg">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(100, paidPercentage)}%` }}
          />
        </div>

        <div className="progress-hero-footer">
          <span>
            Pago no mês: <strong>{formatCurrency(totalPaidExpense)}</strong> de{' '}
            <strong>{formatCurrency(totalExpense)}</strong>
          </span>
          <span>
            Comprometimento da Renda: <strong>{committedIncomePct}%</strong> da receita total (
            {formatCurrency(totalIncome)})
          </span>
        </div>
      </div>

      {/* 6 CARDS DE INDICADORES CHAVE (KPIs) */}
      <div className="kpi-grid">
        <div className="kpi-card card">
          <div className="kpi-icon emerald">
            <i className="fa-solid fa-sack-dollar"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Renda Total do Mês</span>
            <strong className="kpi-value">{formatCurrency(totalIncome)}</strong>
            <span className="kpi-sub">
              Salários: {formatCurrency(baseSalaryIncome)} + Extra:{' '}
              {formatCurrency(totalExtraIncomeMonth)}
              {adhocIncome > 0 && ` + Outras: ${formatCurrency(adhocIncome)}`}
            </span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon blue">
            <i className="fa-solid fa-file-invoice"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total de Contas do Mês</span>
            <strong className="kpi-value">{formatCurrency(totalExpense)}</strong>
            <span className="kpi-sub">
              Teto orçado: {formatCurrency(totalBudgetCeiling)}
            </span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon teal">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Já Pago</span>
            <strong className="kpi-value text-emerald">{formatCurrency(totalPaidExpense)}</strong>
            <span className="kpi-sub">{paidPercentage}% das contas quitadas</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon amber">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Restante (A Pagar)</span>
            <strong className="kpi-value text-amber">{formatCurrency(totalPendingExpense)}</strong>
            <span className="kpi-sub">{100 - paidPercentage}% pendente no mês</span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon purple">
            <i className="fa-solid fa-piggy-bank"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Saldo Livre Previsto</span>
            <strong className={`kpi-value ${freeBalance >= 0 ? 'text-emerald' : 'text-danger'}`}>
              {formatCurrency(freeBalance)}
            </strong>
            <span className="kpi-sub">
              Meta de poupança: {formatCurrency(couple.monthlySavingsTarget)}
            </span>
          </div>
        </div>

        <div className="kpi-card card">
          <div className="kpi-icon rose">
            <i className="fa-solid fa-calendar-day"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Próximo Vencimento</span>
            {nextDue ? (
              <>
                <strong className="kpi-value">
                  {formatCurrency(nextDue.amount)} em {formatShortDateBR(nextDue.dueDate)}
                </strong>
                <span className="kpi-sub">
                  {nextDue.title} ·{' '}
                  {nextDueDays === 0
                    ? 'Vence hoje!'
                    : nextDueDays > 0
                    ? `faltam ${nextDueDays} dias`
                    : `${Math.abs(nextDueDays)} dias em atraso`}
                </span>
              </>
            ) : (
              <>
                <strong className="kpi-value">Tudo em dia!</strong>
                <span className="kpi-sub">
                  {paidCount} de {totalCount} contas pagas
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICOS DE DISTRIBUIÇÃO */}
      <div className="charts-grid-2">
        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h3>
                <i className="fa-solid fa-chart-pie"></i> Gastos por Categoria
              </h3>
              <p className="card-subtitle">
                Total no mês: <strong>{formatCurrency(totalExpense)}</strong>
              </p>
            </div>
          </div>
          <div className="chart-split">
            <div className="doughnut-wrapper">
              {activeCategories.length > 0 ? (
                <Doughnut
                  data={categoryChartData}
                  options={{
                    cutout: '66%',
                    plugins: { legend: { display: false } },
                    maintainAspectRatio: false
                  }}
                />
              ) : (
                <div className="empty-chart">Sem gastos neste mês</div>
              )}
            </div>
            <div className="chart-legend-list">
              {activeCategories.map((c) => (
                <div key={c.id} className="legend-row">
                  <span className="legend-dot" style={{ backgroundColor: c.color }} />
                  <span className="legend-name">{c.name}</span>
                  <strong className="legend-val">{formatCurrency(c.spent)}</strong>
                  <span className="legend-pct">({c.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <div>
              <h3>
                <i className="fa-solid fa-scale-unbalanced"></i> Pago vs. Restante no Mês
              </h3>
              <p className="card-subtitle">
                Adimplência: <strong>{paidCount} de {totalCount} contas pagas</strong> ·{' '}
                {overdueExpenses.length} vencidas
              </p>
            </div>
          </div>
          <div className="chart-split">
            <div className="doughnut-wrapper">
              <Doughnut
                data={paidVsPendingChartData}
                options={{
                  cutout: '66%',
                  plugins: { legend: { display: false } },
                  maintainAspectRatio: false
                }}
              />
            </div>
            <div className="chart-legend-list">
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#10b981' }} />
                <span className="legend-name">Já Pago</span>
                <strong className="legend-val">{formatCurrency(totalPaidExpense)}</strong>
                <span className="legend-pct">({paidPercentage}%)</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />
                <span className="legend-name">Falta Pagar</span>
                <strong className="legend-val">{formatCurrency(totalPendingExpense)}</strong>
                <span className="legend-pct">({100 - paidPercentage}%)</span>
              </div>
              <hr className="divider" />
              <div className="couple-mini-summary">
                <div>
                  <small>Gastos Conjuntos (Casa)</small>
                  <strong>
                    {formatCurrency(
                      monthExpenses
                        .filter((t) => t.owner === 'joint')
                        .reduce((a, b) => a + Number(b.amount), 0)
                    )}
                  </strong>
                </div>
                <div>
                  <small>Individuais ({couple.partner1Name} / {couple.partner2Name})</small>
                  <strong>
                    {formatCurrency(
                      monthExpenses
                        .filter((t) => t.owner !== 'joint')
                        .reduce((a, b) => a + Number(b.amount), 0)
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLUXO DE CAIXA — DESEMBOLSOS POR MÊS */}
      <div className="card">
        <div className="card-header flex-between wrap">
          <div>
            <h3>
              <i className="fa-solid fa-chart-column"></i> Fluxo de Caixa – Contas &amp; Parcelas por Mês ({cashFlowYear})
            </h3>
            <p className="card-subtitle">
              Visualize o impacto das compras parceladas e contas fixas ao longo do ano
            </p>
          </div>
          <div className="filter-pills">
            {availableYears.map((yr) => (
              <button
                key={yr}
                className={`pill-btn ${cashFlowYear === yr ? 'active' : ''}`}
                onClick={() => setCashFlowYear(yr)}
              >
                {yr}
              </button>
            ))}
            <span className="pill-sep">|</span>
            {[
              { id: 'all', label: 'Todos (Total)' },
              { id: 'paid', label: 'Já Pagos' },
              { id: 'pending', label: 'A Pagar' }
            ].map((f) => (
              <button
                key={f.id}
                className={`pill-btn ${cashFlowFilter === f.id ? 'active' : ''}`}
                onClick={() => setCashFlowFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cashflow-summary-strip">
          <div className="cf-stat">
            <span>Volume no período ({cashFlowYear})</span>
            <strong>{formatCurrency(monthlyCashFlow.totalYearVolume)}</strong>
            <small>{monthlyCashFlow.activeMonthsCount} meses com lançamentos</small>
          </div>
          <div className="cf-stat">
            <span>Média mensal ativa</span>
            <strong>{formatCurrency(monthlyCashFlow.avgActiveMonth)}</strong>
            <small>por mês com desembolso</small>
          </div>
          <div className="cf-stat">
            <span>Mês de maior impacto</span>
            <strong>
              {monthlyCashFlow.peakMonth.label} ({formatCurrency(monthlyCashFlow.peakMonth.sum)})
            </strong>
            <small>pico de compromissos no ano</small>
          </div>
        </div>

        <div className="bar-chart-wrapper">
          <Bar
            data={cashFlowChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (val) => `R$ ${val}`
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* TETOS ORÇAMENTÁRIOS POR CATEGORIA */}
      <div className="card">
        <div className="card-header flex-between">
          <div>
            <h3>
              <i className="fa-solid fa-sliders"></i> Limites de Orçamento vs. Gasto Real por Categoria
            </h3>
            <p className="card-subtitle">
              Total Orçado: <strong>{formatCurrency(totalBudgetCeiling)}</strong> · Gasto no Mês:{' '}
              <strong>{formatCurrency(totalExpense)}</strong>
            </p>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigate('settings')}>
            <i className="fa-solid fa-pen"></i> Ajustar Tetos
          </button>
        </div>

        <div className="budget-categories-grid">
          {categoryBreakdown.map((cat) => {
            const usagePct =
              cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0;
            const statusClass =
              usagePct > 100 ? 'danger' : usagePct >= 80 ? 'warning' : 'emerald';

            return (
              <div key={cat.id} className="budget-cat-card">
                <div className="budget-cat-top">
                  <div className="budget-cat-title">
                    <span
                      className="cat-icon-badge"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <i className={`fa-solid ${cat.icon}`}></i>
                    </span>
                    <strong>{cat.name}</strong>
                  </div>
                  <span className={`budget-pct-badge ${statusClass}`}>
                    {cat.budget > 0 ? `${usagePct}%` : 'Sem teto'}
                  </span>
                </div>
                <div className="budget-cat-numbers">
                  <span>
                    Gasto: <strong>{formatCurrency(cat.spent)}</strong>
                  </span>
                  <span>
                    Teto:{' '}
                    <strong>{cat.budget > 0 ? formatCurrency(cat.budget) : 'Não definido'}</strong>
                  </span>
                </div>
                <div className="progress-bar-track sm">
                  <div
                    className={`progress-bar-fill ${statusClass}`}
                    style={{ width: `${Math.min(100, usagePct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GESTÃO DE PRAZOS E PARCELAS */}
      <div className="bottom-lists-grid">
        <div className="card">
          <div className="card-header flex-between">
            <h3>
              <i className="fa-solid fa-hourglass-half text-amber"></i> Próximas Contas a Pagar
            </h3>
            <button className="btn-link" onClick={() => onNavigate('transactions')}>
              Ver todas
            </button>
          </div>
          <div className="mini-tx-list">
            {upcomingExpenses.slice(0, 5).map((tx) => (
              <div key={tx.id} className="mini-tx-item">
                <div className="mini-date-badge pending">
                  {formatShortDateBR(tx.dueDate)}
                </div>
                <div className="mini-tx-info">
                  <strong>{tx.title}</strong>
                  <small>
                    {tx.paymentMethod}{' '}
                    {tx.totalInstallments
                      ? `· Parc. ${tx.installmentNumber}/${tx.totalInstallments}`
                      : ''}
                  </small>
                </div>
                <div className="mini-tx-right">
                  <strong>{formatCurrency(tx.amount)}</strong>
                  <button
                    className="btn-xs-pay"
                    title="Dar baixa agora"
                    onClick={() => onQuickPayTransaction(tx.id)}
                  >
                    <i className="fa-solid fa-check"></i> Pagar
                  </button>
                </div>
              </div>
            ))}
            {upcomingExpenses.length === 0 && (
              <div className="empty-state-sm">
                <i className="fa-solid fa-circle-check text-emerald"></i>
                <p>Nenhuma conta pendente!</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex-between">
            <h3>
              <i className="fa-solid fa-circle-check text-emerald"></i> Últimos Pagamentos Realizados
            </h3>
            <button className="btn-link" onClick={() => onNavigate('transactions')}>
              Histórico
            </button>
          </div>
          <div className="mini-tx-list">
            {recentPaidExpenses.map((tx) => (
              <div key={tx.id} className="mini-tx-item">
                <div className="mini-date-badge paid">
                  {formatShortDateBR(tx.paidDate || tx.dueDate)}
                </div>
                <div className="mini-tx-info">
                  <strong>{tx.title}</strong>
                  <small>
                    Pago por {tx.paidBy === 'partner1' ? couple.partner1Name : couple.partner2Name}
                  </small>
                </div>
                <div className="mini-tx-right">
                  <strong className="text-emerald">{formatCurrency(tx.amount)}</strong>
                  <span className="status-tag paid">Pago</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>
              <i className="fa-solid fa-triangle-exclamation text-danger"></i> Contas em Atraso no Mês
            </h3>
          </div>
          {overdueExpenses.length === 0 ? (
            <div className="all-good-box">
              <div className="all-good-icon">
                <i className="fa-solid fa-shield-heart"></i>
              </div>
              <h4>Tudo sob controle!</h4>
              <p>Nenhuma conta ou parcela possui vencimento em atraso neste mês.</p>
            </div>
          ) : (
            <div className="mini-tx-list">
              {overdueExpenses.map((tx) => (
                <div key={tx.id} className="mini-tx-item overdue">
                  <div className="mini-date-badge danger">
                    {formatShortDateBR(tx.dueDate)}
                  </div>
                  <div className="mini-tx-info">
                    <strong>{tx.title}</strong>
                    <small className="text-danger">Vencida</small>
                  </div>
                  <div className="mini-tx-right">
                    <strong className="text-danger">{formatCurrency(tx.amount)}</strong>
                    <button
                      className="btn-xs-pay"
                      onClick={() => onQuickPayTransaction(tx.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
