import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES } from '../data/initialState';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel,
  getEffectiveMonthIncome,
  getMonthlyExtraNetSummary,
  isAutoSalaryTransaction,
  isAutoTitheOrDonationTransaction
} from '../utils/formatters';

export default function ReportPrintModal({ state, onClose }) {
  const {
    selectedMonth,
    couple,
    transactions = [],
    extraIncomes = [],
    cards = [],
    goals = [],
    categoryBudgets = {},
    monthlySettlements = {}
  } = state;

  // Fechar modal ao pressionar tecla Escape (WCAG)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [reportMode, setReportMode] = useState('monthly'); // 'monthly' | 'annual'
  const [selectedYear, setSelectedYear] = useState(
    selectedMonth ? selectedMonth.slice(0, 4) : '2026'
  );

  const availableYears = useMemo(() => {
    const yrs = new Set(['2026', '2027']);
    if (selectedMonth) yrs.add(selectedMonth.slice(0, 4));
    transactions.forEach((t) => {
      if (t.dueDate && t.dueDate.length >= 4) yrs.add(t.dueDate.slice(0, 4));
    });
    return Array.from(yrs).sort();
  }, [transactions, selectedMonth]);

  // Helper to compute any month's complete summary
  const computeMonthSummary = (ym) => {
    const eff = getEffectiveMonthIncome(state, ym);
    const extraNetSummary = getMonthlyExtraNetSummary(state, ym);
    const extraTotal = extraNetSummary.totalNet;

    const monthTxs = transactions.filter((t) => t.dueDate && t.dueDate.startsWith(ym));
    const adhocIncome = monthTxs
      .filter((t) => t.type === 'income' && !isAutoSalaryTransaction(t))
      .reduce((a, t) => a + Number(t.amount || 0), 0);

    const totalIncome = eff.partner1Income + eff.partner2Income + extraTotal + adhocIncome;

    const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
    const p1OffPct = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
    const p2OffPct = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

    const p1ExtraTithe = couple.includeExtraInTithe ? extraNetSummary.p1TitheableNet : 0;
    const p2ExtraTithe = couple.includeExtraInTithe ? extraNetSummary.p2TitheableNet : 0;

    const p1Consecrated = Number(
      (((eff.partner1Income + p1ExtraTithe) * (tithePct + p1OffPct)) / 100).toFixed(2)
    );
    const p2Consecrated = Number(
      (((eff.partner2Income + p2ExtraTithe) * (tithePct + p2OffPct)) / 100).toFixed(2)
    );
    const monthExpenses = monthTxs.filter((t) => t.type === 'expense');
    const manualTitheTotal = monthExpenses
      .filter((t) => t.category === 'dizimo' && !isAutoTitheOrDonationTransaction(t))
      .reduce((a, t) => a + Number(t.amount || 0), 0);
    const totalPrimicias = Number(
      (p1Consecrated + p2Consecrated + Number(eff.donationAmount || 0) + manualTitheTotal).toFixed(2)
    );

    const nonTitheExpenses = monthExpenses.filter((t) => t.category !== 'dizimo');
    const regularExpensesTotal = nonTitheExpenses.reduce(
      (a, t) => a + Number(t.amount || 0),
      0
    );
    const totalOutflow = totalPrimicias + regularExpensesTotal;
    const freeBalance = totalIncome - totalOutflow;

    return {
      ym,
      label: getMonthLabel(ym),
      salaryTotal: eff.partner1Income + eff.partner2Income,
      extraTotal: extraTotal + adhocIncome,
      totalIncome,
      totalPrimicias,
      regularExpensesTotal,
      totalOutflow,
      freeBalance,
      monthExpenses,
      nonTitheExpenses
    };
  };

  const currentMonthData = useMemo(
    () => computeMonthSummary(selectedMonth),
    [state, selectedMonth]
  );

  const annualMonthsData = useMemo(() => {
    const months = [];
    let cumulativeBalance = 0;
    for (let m = 1; m <= 12; m++) {
      const ym = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const summary = computeMonthSummary(ym);
      cumulativeBalance += summary.freeBalance;
      months.push({
        ...summary,
        cumulativeBalance
      });
    }
    return months;
  }, [state, selectedYear]);

  const annualTotals = useMemo(() => {
    return annualMonthsData.reduce(
      (acc, m) => ({
        income: acc.income + m.totalIncome,
        primicias: acc.primicias + m.totalPrimicias,
        expenses: acc.expenses + m.regularExpensesTotal,
        freeBalance: acc.freeBalance + m.freeBalance
      }),
      { income: 0, primicias: 0, expenses: 0, freeBalance: 0 }
    );
  }, [annualMonthsData]);

  const settlementInfo = monthlySettlements[selectedMonth] || null;

  return (
    <div className="modal-backdrop print-modal-backdrop" onClick={onClose}>
      <div
        className="modal-box lg print-report-modal"
        style={{ maxWidth: '940px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header no-print">
          <h3>
            <i className="fa-solid fa-file-pdf text-emerald"></i> Central de Relatórios &amp;
            Fechamento em PDF — {couple.partner1Name} &amp; {couple.partner2Name}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* BARRA DE CONTROLES (OCULTA NA IMPRESSÃO) */}
          <div
            className="flex-between wrap no-print"
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'var(--bg-main)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${reportMode === 'monthly' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setReportMode('monthly')}
              >
                <i className="fa-solid fa-calendar-day"></i> Fechamento Mensal (
                {getMonthLabel(selectedMonth)})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reportMode === 'annual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setReportMode('annual')}
              >
                <i className="fa-solid fa-calendar-days"></i> Balanço Anual Consolidado (
                {selectedYear})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {reportMode === 'annual' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label
                    htmlFor="report-year-select"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
                  >
                    Ano:
                  </label>
                  <select
                    id="report-year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '8px' }}
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Ano {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => window.print()}
              >
                <i className="fa-solid fa-print"></i> Imprimir / Salvar PDF (A4)
              </button>
            </div>
          </div>

          {/* CABEÇALHO DO DOCUMENTO IMPRESSO */}
          <div
            className="report-print-header"
            style={{
              borderBottom: '2px solid var(--primary)',
              paddingBottom: '14px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>
                FinanPro! —{' '}
                {reportMode === 'monthly'
                  ? `Fechamento Mensal (${getMonthLabel(selectedMonth)})`
                  : `Balanço Anual Consolidado (${selectedYear})`}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Casal: <strong>{couple.partner1Name} &amp; {couple.partner2Name}</strong> · Modelo de
                Divisão:{' '}
                <strong>
                  {couple.splitMode === 'unified'
                    ? 'Tudo Junto (Caixa Único)'
                    : couple.splitMode === 'proportional'
                    ? 'Proporcional à Renda'
                    : 'Divisão 50/50'}
                </strong>
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div>Documento Executivo do Casal</div>
              <strong>Referência: {reportMode === 'monthly' ? selectedMonth : selectedYear}</strong>
            </div>
          </div>

          {reportMode === 'monthly' ? (
            <div>
              {/* 4 KPIs DO MÊS */}
              <div className="kpi-grid-4" style={{ marginBottom: '18px' }}>
                <div className="card mini-kpi">
                  <span>1. Receita Total do Mês</span>
                  <strong className="text-emerald">
                    {formatCurrency(currentMonthData.totalIncome)}
                  </strong>
                  <small>
                    Salários: {formatCurrency(currentMonthData.salaryTotal)} | Extras:{' '}
                    {formatCurrency(currentMonthData.extraTotal)}
                  </small>
                </div>
                <div className="card mini-kpi">
                  <span>2. Primícias (Dízimo &amp; Ofertas)</span>
                  <strong style={{ color: 'var(--primary)' }}>
                    {formatCurrency(currentMonthData.totalPrimicias)}
                  </strong>
                  <small>Fidelidade &amp; Gratidão no Mês</small>
                </div>
                <div className="card mini-kpi">
                  <span>3. Contas &amp; Cartões do Mês</span>
                  <strong className="text-amber">
                    {formatCurrency(currentMonthData.regularExpensesTotal)}
                  </strong>
                  <small>{currentMonthData.nonTitheExpenses.length} lançamentos no mês</small>
                </div>
                <div className="card mini-kpi">
                  <span>4. Saldo Livre do Mês</span>
                  <strong
                    className={
                      currentMonthData.freeBalance >= 0 ? 'text-emerald' : 'text-danger'
                    }
                  >
                    {formatCurrency(currentMonthData.freeBalance)}
                  </strong>
                  <small>
                    {settlementInfo?.settled
                      ? `✅ Acerto quitado em ${formatDateBR(settlementInfo.settledAt)}`
                      : 'Disponível p/ Caixinhas & Lazer'}
                  </small>
                </div>
              </div>

              {/* RESUMO POR CATEGORIA E POR CARTÃO */}
              <div className="form-grid-2" style={{ gap: '16px', marginBottom: '18px' }}>
                <div className="card" style={{ padding: '14px' }}>
                  <h4 style={{ marginBottom: '10px' }}>
                    <i className="fa-solid fa-layer-group"></i> Despesas por Categoria vs. Meta
                  </h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th className="text-center">Gasto no Mês</th>
                          <th className="text-center">Teto Mensal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CATEGORIES.map((cat) => {
                          const spent =
                            cat.id === 'dizimo'
                              ? currentMonthData.totalPrimicias
                              : currentMonthData.nonTitheExpenses
                                  .filter((t) => t.category === cat.id)
                                  .reduce((a, t) => a + Number(t.amount || 0), 0);
                          const budget = Number(categoryBudgets[cat.id] || 0);
                          if (spent === 0 && budget === 0) return null;
                          return (
                            <tr key={cat.id}>
                              <td>{cat.name}</td>
                              <td className="text-center font-mono-val">
                                <strong>{formatCurrency(spent)}</strong>
                              </td>
                              <td className="text-center font-mono-val">
                                {budget > 0 ? formatCurrency(budget) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{ padding: '14px' }}>
                  <h4 style={{ marginBottom: '10px' }}>
                    <i className="fa-solid fa-credit-card"></i> Faturas dos Cartões &amp; Caixinhas
                  </h4>
                  <div className="table-responsive">
                    <table className="data-table" style={{ marginBottom: '14px' }}>
                      <thead>
                        <tr>
                          <th>Cartão</th>
                          <th className="text-center">Vencimento</th>
                          <th className="text-center">Fatura do Mês</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cards.map((c) => {
                          const invTotal = currentMonthData.monthExpenses
                            .filter((t) => t.cardId === c.id)
                            .reduce((a, t) => a + Number(t.amount || 0), 0);
                          return (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                              </td>
                              <td className="text-center">Dia {c.dueDay}</td>
                              <td className="text-center font-mono-val">
                                <strong>{formatCurrency(invTotal)}</strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h4 style={{ marginBottom: '8px', marginTop: '12px' }}>
                    <i className="fa-solid fa-piggy-bank"></i> Progresso das Caixinhas (Metas)
                  </h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Meta / Caixinha</th>
                          <th className="text-center">Guardado</th>
                          <th className="text-center">Alvo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goals.map((g) => (
                          <tr key={g.id}>
                            <td>{g.title}</td>
                            <td className="text-center font-mono-val text-emerald">
                              <strong>{formatCurrency(g.currentAmount)}</strong>
                            </td>
                            <td className="text-center font-mono-val">
                              {formatCurrency(g.targetAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* RELATÓRIO ANUAL CONSOLIDADO (12 MESES) */
            <div>
              <div className="kpi-grid-4" style={{ marginBottom: '18px' }}>
                <div className="card mini-kpi">
                  <span>Receita Bruta Anual ({selectedYear})</span>
                  <strong className="text-emerald">{formatCurrency(annualTotals.income)}</strong>
                  <small>Soma dos 12 meses de {selectedYear}</small>
                </div>
                <div className="card mini-kpi">
                  <span>Primícias Consagradas no Ano</span>
                  <strong style={{ color: 'var(--primary)' }}>
                    {formatCurrency(annualTotals.primicias)}
                  </strong>
                  <small>Dízimos, Ofertas &amp; Doações em {selectedYear}</small>
                </div>
                <div className="card mini-kpi">
                  <span>Despesas &amp; Faturas no Ano</span>
                  <strong className="text-amber">{formatCurrency(annualTotals.expenses)}</strong>
                  <small>Contas fixas, cartões e parcelamentos</small>
                </div>
                <div className="card mini-kpi">
                  <span>Saldo Livre Acumulado ({selectedYear})</span>
                  <strong
                    className={annualTotals.freeBalance >= 0 ? 'text-emerald' : 'text-danger'}
                  >
                    {formatCurrency(annualTotals.freeBalance)}
                  </strong>
                  <small>Capacidade anual de poupança do casal</small>
                </div>
              </div>

              <div className="card" style={{ padding: '14px' }}>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mês ({selectedYear})</th>
                        <th className="text-center">Receitas</th>
                        <th className="text-center">Primícias (Dízimo/Oferta)</th>
                        <th className="text-center">Despesas &amp; Parcelas</th>
                        <th className="text-center">Saldo Livre do Mês</th>
                        <th className="text-center">Acumulado no Ano</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annualMonthsData.map((m) => (
                        <tr key={m.ym}>
                          <td>
                            <strong>{m.label}</strong>
                          </td>
                          <td className="text-center font-mono-val">
                            {formatCurrency(m.totalIncome)}
                          </td>
                          <td className="text-center font-mono-val" style={{ color: 'var(--primary)' }}>
                            {formatCurrency(m.totalPrimicias)}
                          </td>
                          <td className="text-center font-mono-val">
                            {formatCurrency(m.regularExpensesTotal)}
                          </td>
                          <td
                            className={`text-center font-mono-val ${
                              m.freeBalance >= 0 ? 'text-emerald' : 'text-danger'
                            }`}
                          >
                            <strong>{formatCurrency(m.freeBalance)}</strong>
                          </td>
                          <td className="text-center font-mono-val">
                            <strong>{formatCurrency(m.cumulativeBalance)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 800, background: 'var(--bg-main)' }}>
                        <td>TOTAL ANUAL ({selectedYear})</td>
                        <td className="text-center font-mono-val">
                          {formatCurrency(annualTotals.income)}
                        </td>
                        <td className="text-center font-mono-val">
                          {formatCurrency(annualTotals.primicias)}
                        </td>
                        <td className="text-center font-mono-val">
                          {formatCurrency(annualTotals.expenses)}
                        </td>
                        <td className="text-center font-mono-val text-emerald">
                          {formatCurrency(annualTotals.freeBalance)}
                        </td>
                        <td className="text-center font-mono-val text-emerald">
                          {formatCurrency(annualTotals.freeBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer no-print">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Fechar Visualização
          </button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <i className="fa-solid fa-print"></i> Imprimir / Salvar em PDF
          </button>
        </div>
      </div>
    </div>
  );
}

