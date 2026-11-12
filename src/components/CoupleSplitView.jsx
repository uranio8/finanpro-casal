import React, { useMemo } from 'react';
import { formatCurrency, getMonthLabel } from '../utils/formatters';

export default function CoupleSplitView({ state, onUpdateCoupleSettings }) {
  const { couple, transactions, extraIncomes = [], selectedMonth } = state;

  const monthTxs = useMemo(
    () => transactions.filter((t) => t.dueDate && t.dueDate.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const monthExtras = useMemo(
    () => extraIncomes.filter((i) => i.date && i.date.startsWith(selectedMonth)),
    [extraIncomes, selectedMonth]
  );

  const p1Extra = monthExtras
    .filter((i) => i.owner === 'partner1')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);

  const p2Extra = monthExtras
    .filter((i) => i.owner === 'partner2')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);

  const p1Salary = Number(couple.partner1Income || 0);
  const p2Salary = Number(couple.partner2Income || 0);

  const p1Income = p1Salary + p1Extra;
  const p2Income = p2Salary + p2Extra;
  const totalCoupleIncome = p1Income + p2Income;

  // Dízimo (10%) + Oferta (%) per partner
  const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
  const p1OffPct = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
  const p2OffPct = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

  const p1TitheBase = p1Salary + (couple.includeExtraInTithe ? p1Extra : 0);
  const p2TitheBase = p2Salary + (couple.includeExtraInTithe ? p2Extra : 0);

  const p1Consecrated = (p1TitheBase * (tithePct + p1OffPct)) / 100;
  const p2Consecrated = (p2TitheBase * (tithePct + p2OffPct)) / 100;

  const p1ShareRatio =
    couple.splitMode === 'equal'
      ? 0.5
      : totalCoupleIncome > 0
      ? p1Income / totalCoupleIncome
      : 0.5;
  const p2ShareRatio = 1 - p1ShareRatio;

  const jointExpenses = monthTxs.filter(
    (t) => t.type === 'expense' && t.owner === 'joint'
  );
  const p1IndividualExpenses = monthTxs.filter(
    (t) => t.type === 'expense' && t.owner === 'partner1' && t.category !== 'dizimo'
  );
  const p2IndividualExpenses = monthTxs.filter(
    (t) => t.type === 'expense' && t.owner === 'partner2' && t.category !== 'dizimo'
  );

  const totalJoint = jointExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const p1TargetJointContribution = totalJoint * p1ShareRatio;
  const p2TargetJointContribution = totalJoint * p2ShareRatio;

  const p1PaidForJoint = jointExpenses
    .filter((t) => t.paidBy === 'partner1')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const p2PaidForJoint = jointExpenses
    .filter((t) => t.paidBy === 'partner2')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const p1TotalIndividual = p1IndividualExpenses.reduce(
    (acc, t) => acc + Number(t.amount || 0),
    0
  );
  const p2TotalIndividual = p2IndividualExpenses.reduce(
    (acc, t) => acc + Number(t.amount || 0),
    0
  );

  const p1BalanceDiff = p1PaidForJoint - p1TargetJointContribution;

  const handleSendWhatsAppSummary = () => {
    const settlementText =
      Math.abs(p1BalanceDiff) < 1
        ? 'Contas 100% equilibradas!'
        : p1BalanceDiff > 0
        ? `${couple.partner2Name} transfere ${formatCurrency(p1BalanceDiff)} para ${couple.partner1Name}`
        : `${couple.partner1Name} transfere ${formatCurrency(Math.abs(p1BalanceDiff))} para ${couple.partner2Name}`;

    const message =
      `💚 *Resumo Financeiro de ${couple.partner1Name} & ${couple.partner2Name} — ${getMonthLabel(selectedMonth)}*\n\n` +
      `🙏 *Primícias (Dízimo 10% + Ofertas):*\n` +
      `• ${couple.partner1Name} (10% + ${p1OffPct}%): ${formatCurrency(p1Consecrated)}\n` +
      `• ${couple.partner2Name} (10% + ${p2OffPct}%): ${formatCurrency(p2Consecrated)}\n\n` +
      `🏠 *Total Contas da Casa (Conjuntas):* ${formatCurrency(totalJoint)}\n` +
      `• Quota ${couple.partner1Name} (${Math.round(p1ShareRatio * 100)}%): ${formatCurrency(p1TargetJointContribution)}\n` +
      `• Quota ${couple.partner2Name} (${Math.round(p2ShareRatio * 100)}%): ${formatCurrency(p2TargetJointContribution)}\n\n` +
      `⚖️ *Acerto do Mês:* ${settlementText}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="view-container">
      {/* HEADER */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-scale-balanced"></i> Divisão Inteligente: {couple.partner1Name} &amp; {couple.partner2Name}
          </h2>
          <p>
            Cálculo transparente das primícias (Dízimo + Oferta), rendas (Salário + Renda Extra) e
            divisão justa das contas da casa em <strong>{getMonthLabel(selectedMonth)}</strong>.
          </p>
        </div>
        <div className="header-btns">
          <button
            className={`btn ${
              couple.splitMode === 'proportional' ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onUpdateCoupleSettings({ splitMode: 'proportional' })}
          >
            <i className="fa-solid fa-percent"></i> Proporcional à Renda
          </button>
          <button
            className={`btn ${
              couple.splitMode === 'equal' ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onUpdateCoupleSettings({ splitMode: 'equal' })}
          >
            <i className="fa-solid fa-equals"></i> Meio a Meio (50/50)
          </button>
          <button className="btn btn-emerald-whatsapp" onClick={handleSendWhatsAppSummary}>
            <i className="fa-brands fa-whatsapp"></i> Enviar Resumo no WhatsApp
          </button>
        </div>
      </div>

      {/* BANNER DE ACERTO FINAL DO MÊS */}
      <div className="card settlement-banner">
        <div className="settlement-icon">
          <i className="fa-solid fa-handshake-simple"></i>
        </div>
        <div className="settlement-text">
          <span className="badge-pill badge-emerald">
            Resultado do Acerto das Contas da Casa ({getMonthLabel(selectedMonth)})
          </span>
          {Math.abs(p1BalanceDiff) < 1 ? (
            <h3>Tudo perfeitamente equilibrado! Ninguém precisa transferir nada.</h3>
          ) : p1BalanceDiff > 0 ? (
            <h3>
              Para fechar as contas da casa, <strong>{couple.partner2Name}</strong> deve transferir{' '}
              <span className="text-emerald">{formatCurrency(p1BalanceDiff)}</span> para{' '}
              <strong>{couple.partner1Name}</strong>.
            </h3>
          ) : (
            <h3>
              Para fechar as contas da casa, <strong>{couple.partner1Name}</strong> deve transferir{' '}
              <span className="text-emerald">{formatCurrency(Math.abs(p1BalanceDiff))}</span> para{' '}
              <strong>{couple.partner2Name}</strong>.
            </h3>
          )}
          <p>
            Total das despesas conjuntas da casa no mês: <strong>{formatCurrency(totalJoint)}</strong>{' '}
            · Modelo ativo:{' '}
            <strong>
              {couple.splitMode === 'proportional'
                ? `Proporcional à Renda (${Math.round(p1ShareRatio * 100)}% / ${Math.round(
                    p2ShareRatio * 100
                  )}%)`
                : 'Divisão Igualitária (50% / 50%)'}
            </strong>
          </p>
        </div>
      </div>

      {/* COMPARATIVO LADO A LADO DO CASAL */}
      <div className="charts-grid-2">
        {/* PARCEIRO 1 */}
        <div className="card partner-split-card">
          <div className="partner-card-header">
            <div className="partner-avatar p1">{couple.partner1Name.charAt(0)}</div>
            <div>
              <h3>{couple.partner1Name}</h3>
              <small>
                Salário: {formatCurrency(p1Salary)} + Extra: {formatCurrency(p1Extra)} ={' '}
                <strong>{formatCurrency(p1Income)}</strong>
              </small>
            </div>
          </div>

          <div className="partner-stats-list">
            <div className="p-stat-row">
              <span>
                <i className="fa-solid fa-hands-praying text-emerald"></i> Dízimo (10%) + Oferta (
                {p1OffPct}%):
              </span>
              <strong className="text-emerald">{formatCurrency(p1Consecrated)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Quota justa nas contas da Casa ({Math.round(p1ShareRatio * 100)}%):</span>
              <strong>{formatCurrency(p1TargetJointContribution)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Quanto já pagou das contas da Casa:</span>
              <strong className="text-emerald">{formatCurrency(p1PaidForJoint)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Gastos Individuais de {couple.partner1Name}:</span>
              <strong>{formatCurrency(p1TotalIndividual)}</strong>
            </div>
            <hr className="divider" />
            <div className="p-stat-row highlight">
              <span>Sobra Líquida (após Dízimo/Oferta e Contas):</span>
              <strong className="text-emerald">
                {formatCurrency(
                  p1Income - p1Consecrated - p1TargetJointContribution - p1TotalIndividual
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* PARCEIRO 2 */}
        <div className="card partner-split-card">
          <div className="partner-card-header">
            <div className="partner-avatar p2">{couple.partner2Name.charAt(0)}</div>
            <div>
              <h3>{couple.partner2Name}</h3>
              <small>
                Salário: {formatCurrency(p2Salary)} + Extra: {formatCurrency(p2Extra)} ={' '}
                <strong>{formatCurrency(p2Income)}</strong>
              </small>
            </div>
          </div>

          <div className="partner-stats-list">
            <div className="p-stat-row">
              <span>
                <i className="fa-solid fa-hands-praying text-emerald"></i> Dízimo (10%) + Oferta (
                {p2OffPct}%):
              </span>
              <strong className="text-emerald">{formatCurrency(p2Consecrated)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Quota justa nas contas da Casa ({Math.round(p2ShareRatio * 100)}%):</span>
              <strong>{formatCurrency(p2TargetJointContribution)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Quanto já pagou das contas da Casa:</span>
              <strong className="text-emerald">{formatCurrency(p2PaidForJoint)}</strong>
            </div>
            <div className="p-stat-row">
              <span>Gastos Individuais de {couple.partner2Name}:</span>
              <strong>{formatCurrency(p2TotalIndividual)}</strong>
            </div>
            <hr className="divider" />
            <div className="p-stat-row highlight">
              <span>Sobra Líquida (após Dízimo/Oferta e Contas):</span>
              <strong className="text-emerald">
                {formatCurrency(
                  p2Income - p2Consecrated - p2TargetJointContribution - p2TotalIndividual
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DETALHADA DAS CONTAS CONJUNTAS DA CASA */}
      <div className="card">
        <div className="card-header">
          <h3>
            <i className="fa-solid fa-house-user"></i> Detalhamento das Despesas Conjuntas da Casa em{' '}
            {getMonthLabel(selectedMonth)}
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Despesa da Casa</th>
              <th className="text-center">Valor Total</th>
              <th className="text-center">Parte de {couple.partner1Name}</th>
              <th className="text-center">Parte de {couple.partner2Name}</th>
              <th className="text-center">Pago por</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {jointExpenses.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <strong>{tx.title}</strong>
                </td>
                <td className="text-center">
                  <strong className="font-mono-val">{formatCurrency(tx.amount)}</strong>
                </td>
                <td className="text-center font-mono-val" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(tx.amount * p1ShareRatio)}
                </td>
                <td className="text-center font-mono-val" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(tx.amount * p2ShareRatio)}
                </td>
                <td className="text-center">
                  <span
                    className="owner-badge"
                    style={{
                      backgroundColor: tx.paidBy === 'partner1' ? '#dbeafe' : '#fce7f3',
                      color: tx.paidBy === 'partner1' ? '#1d4ed8' : '#be185d'
                    }}
                  >
                    {tx.paidBy === 'partner1' ? couple.partner1Name : couple.partner2Name}
                  </span>
                </td>
                <td className="text-center">
                  <span className={`status-tag ${tx.status}`}>
                    {tx.status === 'paid' ? 'Pago' : 'A Pagar'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
