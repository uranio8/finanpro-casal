import React, { useMemo } from 'react';
import {
  formatCurrency,
  formatDateBR,
  getMonthLabel,
  getEffectiveMonthIncome,
  isAutoSalaryTransaction
} from '../utils/formatters';

export default function CoupleSplitView({
  state,
  onUpdateCoupleSettings,
  onOpenMonthIncomeModal,
  onSettleMonthSplit,
  onReopenMonthSplit
}) {
  const {
    couple,
    transactions,
    extraIncomes = [],
    selectedMonth,
    monthlySettlements = {}
  } = state;
  const activeSettlement = monthlySettlements[selectedMonth] || null;

  const monthTxs = useMemo(
    () => transactions.filter((t) => t.dueDate && t.dueDate.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const monthExtras = useMemo(
    () => extraIncomes.filter((i) => i.date && i.date.startsWith(selectedMonth)),
    [extraIncomes, selectedMonth]
  );

  const effectiveMonthIncome = useMemo(
    () => getEffectiveMonthIncome(state, selectedMonth),
    [state, selectedMonth]
  );

  // Rendas extras recebidas e pendentes
  const p1ExtraReceived = monthExtras
    .filter((i) => i.owner === 'partner1' && i.status === 'received')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p1ExtraTitheable = monthExtras
    .filter((i) => i.owner === 'partner1' && i.status === 'received' && i.applyTitheAndOffering !== false)
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p1ExtraPending = monthExtras
    .filter((i) => i.owner === 'partner1' && i.status === 'pending')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p1ExtraTotal = p1ExtraReceived + p1ExtraPending;

  const p2ExtraReceived = monthExtras
    .filter((i) => i.owner === 'partner2' && i.status === 'received')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p2ExtraTitheable = monthExtras
    .filter((i) => i.owner === 'partner2' && i.status === 'received' && i.applyTitheAndOffering !== false)
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p2ExtraPending = monthExtras
    .filter((i) => i.owner === 'partner2' && i.status === 'pending')
    .reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const p2ExtraTotal = p2ExtraReceived + p2ExtraPending;

  // Receitas Avulsas adicionadas diretamente via "+ Nova Receita" em Lançamentos (excluindo salários automáticos)
  const p1DirectAdhoc = monthTxs
    .filter((t) => t.type === 'income' && !isAutoSalaryTransaction(t) && t.owner === 'partner1')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const p2DirectAdhoc = monthTxs
    .filter((t) => t.type === 'income' && !isAutoSalaryTransaction(t) && t.owner === 'partner2')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const jointAdhoc = monthTxs
    .filter((t) => t.type === 'income' && !isAutoSalaryTransaction(t) && t.owner === 'joint')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const p1AdhocIncomes = p1DirectAdhoc + jointAdhoc / 2;
  const p2AdhocIncomes = p2DirectAdhoc + jointAdhoc / 2;

  const p1Salary = effectiveMonthIncome.partner1Income;
  const p2Salary = effectiveMonthIncome.partner2Income;
  const donationAmount = effectiveMonthIncome.donationAmount;

  // Renda Total do Mês (Salário + Renda Extra + Receitas Avulsas)
  const p1Income = p1Salary + p1ExtraTotal + p1AdhocIncomes;
  const p2Income = p2Salary + p2ExtraTotal + p2AdhocIncomes;
  const totalCoupleIncome = p1Income + p2Income;

  // Dízimo (10%) + Oferta (%) per partner + Doações adicionais
  const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
  const p1OffPct = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
  const p2OffPct = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

  // Dízimo sobre Renda Extra incide sobre o montante efetivamente recebido com applyTitheAndOffering ativo
  const p1TitheBase = p1Salary + (couple.includeExtraInTithe ? p1ExtraTitheable : 0);
  const p2TitheBase = p2Salary + (couple.includeExtraInTithe ? p2ExtraTitheable : 0);

  const p1Consecrated = Number(((p1TitheBase * (tithePct + p1OffPct)) / 100).toFixed(2));
  const p2Consecrated = Number(((p2TitheBase * (tithePct + p2OffPct)) / 100).toFixed(2));
  const totalConsecrated = Number((p1Consecrated + p2Consecrated + donationAmount).toFixed(2));

  const isUnified = couple.splitMode === 'unified';

  const p1ShareRatio =
    couple.splitMode === 'equal'
      ? 0.5
      : totalCoupleIncome > 0
      ? p1Income / totalCoupleIncome
      : 0.5;
  const p2ShareRatio = 1 - p1ShareRatio;

  // Excluir 'dizimo' das despesas conjuntas para evitar dupla contagem de Doações Especiais (tx-don-*)
  const jointExpenses = monthTxs.filter(
    (t) => t.type === 'expense' && t.owner === 'joint' && t.category !== 'dizimo'
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

  const totalAllExpenses = totalJoint + p1TotalIndividual + p2TotalIndividual;
  const familyFreeBalance = totalCoupleIncome - totalConsecrated - totalAllExpenses;

  const p1BalanceDiff = p1PaidForJoint - p1TargetJointContribution;

  const handleSendWhatsAppSummary = () => {
    let message = '';
    if (isUnified) {
      message =
        `💚 *Resumo Financeiro de ${couple.partner1Name} & ${couple.partner2Name} — ${getMonthLabel(selectedMonth)}*\n` +
        `🤝 *Modelo: Tudo Junto / Sem Proporção (Orçamento Familiar Único)*\n\n` +
        `💰 *Renda Familiar Total:* ${formatCurrency(totalCoupleIncome)}\n` +
        `• ${couple.partner1Name}: ${formatCurrency(p1Income)} (Salário + Extras)\n` +
        `• ${couple.partner2Name}: ${formatCurrency(p2Income)} (Salário + Extras)\n\n` +
        `🙏 *Primícias & Doações do Casal:* ${formatCurrency(totalConsecrated)}\n` +
        `• Dízimo + Oferta ${couple.partner1Name}: ${formatCurrency(p1Consecrated)}\n` +
        `• Dízimo + Oferta ${couple.partner2Name}: ${formatCurrency(p2Consecrated)}\n` +
        (donationAmount > 0 ? `• Doações Especiais / Caridade: ${formatCurrency(donationAmount)}\n\n` : `\n`) +
        `🏠 *Despesas Totais da Família:* ${formatCurrency(totalAllExpenses)}\n` +
        `• Contas Conjuntas da Casa: ${formatCurrency(totalJoint)}\n` +
        `• Gastos Individuais ${couple.partner1Name}: ${formatCurrency(p1TotalIndividual)}\n` +
        `• Gastos Individuais ${couple.partner2Name}: ${formatCurrency(p2TotalIndividual)}\n\n` +
        `✨ *Saldo Livre Conjunto da Família:* ${formatCurrency(familyFreeBalance)}\n\n` +
        `❤️ *Zero acertos ou transferências: todo o dinheiro pertence aos dois!*`;
    } else {
      const settlementText =
        Math.abs(p1BalanceDiff) < 0.01
          ? 'Contas 100% equilibradas!'
          : p1BalanceDiff > 0
          ? `${couple.partner2Name} transfere ${formatCurrency(p1BalanceDiff)} para ${couple.partner1Name}`
          : `${couple.partner1Name} transfere ${formatCurrency(Math.abs(p1BalanceDiff))} para ${couple.partner2Name}`;

      message =
        `💚 *Resumo Financeiro de ${couple.partner1Name} & ${couple.partner2Name} — ${getMonthLabel(selectedMonth)}*\n\n` +
        `🙏 *Primícias (Dízimo 10% + Ofertas):*\n` +
        `• ${couple.partner1Name} (10% + ${p1OffPct}%): ${formatCurrency(p1Consecrated)}\n` +
        `• ${couple.partner2Name} (10% + ${p2OffPct}%): ${formatCurrency(p2Consecrated)}\n` +
        (donationAmount > 0 ? `• Doações Especiais: ${formatCurrency(donationAmount)}\n\n` : `\n`) +
        `🏠 *Total Contas da Casa (Conjuntas):* ${formatCurrency(totalJoint)}\n` +
        `• Quota ${couple.partner1Name} (${Math.round(p1ShareRatio * 100)}%): ${formatCurrency(p1TargetJointContribution)}\n` +
        `• Quota ${couple.partner2Name} (${Math.round(p2ShareRatio * 100)}%): ${formatCurrency(p2TargetJointContribution)}\n\n` +
        `⚖️ *Acerto do Mês:* ${settlementText}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="view-container">
      {/* HEADER */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-scale-balanced"></i> Finanças a Dois: {couple.partner1Name} &amp; {couple.partner2Name}
          </h2>
          <p>
            Alterne entre o modelo <strong>Sem Proporção (Tudo Junto)</strong>,{' '}
            <strong>Proporcional</strong> ou <strong>50/50</strong> para o mês de{' '}
            <strong>{getMonthLabel(selectedMonth)}</strong>.
          </p>
        </div>
        <div className="header-btns">
          {onOpenMonthIncomeModal && (
            <button
              className="btn btn-soft"
              onClick={onOpenMonthIncomeModal}
              title="Informar ou alterar salários deste mês sem afetar os outros meses"
            >
              <i className="fa-solid fa-money-bill-wave"></i> Definir Renda do Mês
            </button>
          )}
          <button
            className={`btn ${
              isUnified ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onUpdateCoupleSettings({ splitMode: 'unified' })}
          >
            <i className="fa-solid fa-hand-holding-heart"></i> 🤝 Sem Proporção (Tudo Junto)
          </button>
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

      {/* BANNER DE ACERTO OU VISÃO TUDO JUNTO */}
      {isUnified ? (
        <div className="card settlement-banner unified-banner">
          <div className="settlement-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
            <i className="fa-solid fa-heart"></i>
          </div>
          <div className="settlement-text" style={{ flex: 1 }}>
            <span className="badge-pill badge-emerald">
              Modelo Orçamento Único / Sem Proporção Ativo
            </span>
            <h3>
              Todo o dinheiro que vocês ganham é para os dois! Ninguém deve nada para ninguém.
            </h3>
            <p>
              Neste modelo, 100% das rendas (Salários + Aulas + Vendas) são da família, todas as primícias/doações
              são honradas juntos e todas as despesas da casa são pagas pelo casal. Todo o saldo restante pertence a ambos!
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {activeSettlement?.settled ? (
              <>
                <span className="badge-pill badge-emerald">
                  <i className="fa-solid fa-circle-check"></i> Fechamento Concluído em{' '}
                  {formatDateBR(activeSettlement.settledAt)}
                </span>
                {onReopenMonthSplit && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onReopenMonthSplit(selectedMonth)}
                  >
                    <i className="fa-solid fa-rotate-left"></i> Reabrir Mês
                  </button>
                )}
              </>
            ) : (
              onSettleMonthSplit && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    onSettleMonthSplit(selectedMonth, {
                      mode: 'unified',
                      amount: 0,
                      freeBalance: familyFreeBalance
                    })
                  }
                >
                  <i className="fa-solid fa-check-double"></i> Confirmar Fechamento do Mês
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="card settlement-banner">
          <div className="settlement-icon">
            <i className="fa-solid fa-handshake-simple"></i>
          </div>
          <div className="settlement-text" style={{ flex: 1 }}>
            <span className="badge-pill badge-emerald">
              Resultado do Acerto das Contas da Casa ({getMonthLabel(selectedMonth)})
            </span>
            {Math.abs(p1BalanceDiff) < 0.01 ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {activeSettlement?.settled ? (
              <>
                <span className="badge-pill badge-emerald">
                  <i className="fa-solid fa-circle-check"></i> Acerto Quitado em{' '}
                  {formatDateBR(activeSettlement.settledAt)}
                </span>
                {onReopenMonthSplit && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onReopenMonthSplit(selectedMonth)}
                  >
                    <i className="fa-solid fa-rotate-left"></i> Reabrir Acerto
                  </button>
                )}
              </>
            ) : (
              onSettleMonthSplit && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    onSettleMonthSplit(selectedMonth, {
                      mode: couple.splitMode,
                      amount: Number(Math.abs(p1BalanceDiff).toFixed(2)),
                      from: p1BalanceDiff > 0 ? 'partner2' : 'partner1',
                      to: p1BalanceDiff > 0 ? 'partner1' : 'partner2'
                    })
                  }
                >
                  <i className="fa-solid fa-check-double"></i> Confirmar Acerto / PIX Realizado
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* KPIS CONSOLIDADOS DO CASAL */}
      <div className="kpi-grid-4">
        <div className="card mini-kpi">
          <span>Renda Familiar Total</span>
          <strong className="text-emerald">{formatCurrency(totalCoupleIncome)}</strong>
          <small>Salários + Aulas Particulares &amp; Vendas</small>
        </div>
        <div className="card mini-kpi">
          <span>Primícias &amp; Doações</span>
          <strong style={{ color: '#059669' }}>{formatCurrency(totalConsecrated)}</strong>
          <small>Dízimos + Ofertas {donationAmount > 0 ? '+ Doações' : ''}</small>
        </div>
        <div className="card mini-kpi">
          <span>Despesas Totais da Casa</span>
          <strong>{formatCurrency(totalAllExpenses)}</strong>
          <small>Contas conjuntas + gastos individuais</small>
        </div>
        <div className="card mini-kpi">
          <span>Saldo Livre do Casal</span>
          <strong className="text-emerald">{formatCurrency(familyFreeBalance)}</strong>
          <small>Disponível para Caixinhas e Sonhos</small>
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
                Salário: {formatCurrency(p1Salary)} + Extras:{' '}
                {formatCurrency(p1ExtraTotal + p1AdhocIncomes)}
                {p1ExtraPending > 0 && ` (${formatCurrency(p1ExtraPending)} a receber)`} ={' '}
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

            {!isUnified ? (
              <>
                <div className="p-stat-row">
                  <span>Quota justa nas contas da Casa ({Math.round(p1ShareRatio * 100)}%):</span>
                  <strong>{formatCurrency(p1TargetJointContribution)}</strong>
                </div>
                <div className="p-stat-row">
                  <span>Quanto já pagou das contas da Casa:</span>
                  <strong className="text-emerald">{formatCurrency(p1PaidForJoint)}</strong>
                </div>
              </>
            ) : (
              <div className="p-stat-row">
                <span>Pagou diretamente das contas da Casa:</span>
                <strong className="text-emerald">{formatCurrency(p1PaidForJoint)}</strong>
              </div>
            )}

            <div className="p-stat-row">
              <span>Gastos Registrados de {couple.partner1Name}:</span>
              <strong>{formatCurrency(p1TotalIndividual)}</strong>
            </div>

            <hr className="divider" />
            <div className="p-stat-row highlight">
              <span>{isUnified ? 'Contribuição Líquida p/ Família:' : 'Sobra Líquida Individual:'}</span>
              <strong className="text-emerald">
                {formatCurrency(
                  isUnified
                    ? p1Income - p1Consecrated - p1PaidForJoint - p1TotalIndividual
                    : p1Income - p1Consecrated - p1TargetJointContribution - p1TotalIndividual
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
                Salário: {formatCurrency(p2Salary)} + Extras:{' '}
                {formatCurrency(p2ExtraTotal + p2AdhocIncomes)}
                {p2ExtraPending > 0 && ` (${formatCurrency(p2ExtraPending)} a receber)`} ={' '}
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

            {!isUnified ? (
              <>
                <div className="p-stat-row">
                  <span>Quota justa nas contas da Casa ({Math.round(p2ShareRatio * 100)}%):</span>
                  <strong>{formatCurrency(p2TargetJointContribution)}</strong>
                </div>
                <div className="p-stat-row">
                  <span>Quanto já pagou das contas da Casa:</span>
                  <strong className="text-emerald">{formatCurrency(p2PaidForJoint)}</strong>
                </div>
              </>
            ) : (
              <div className="p-stat-row">
                <span>Pagou diretamente das contas da Casa:</span>
                <strong className="text-emerald">{formatCurrency(p2PaidForJoint)}</strong>
              </div>
            )}

            <div className="p-stat-row">
              <span>Gastos Registrados de {couple.partner2Name}:</span>
              <strong>{formatCurrency(p2TotalIndividual)}</strong>
            </div>

            <hr className="divider" />
            <div className="p-stat-row highlight">
              <span>{isUnified ? 'Contribuição Líquida p/ Família:' : 'Sobra Líquida Individual:'}</span>
              <strong className="text-emerald">
                {formatCurrency(
                  isUnified
                    ? p2Income - p2Consecrated - p2PaidForJoint - p2TotalIndividual
                    : p2Income - p2Consecrated - p2TargetJointContribution - p2TotalIndividual
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
            <i className="fa-solid fa-house-user"></i> Detalhamento das Despesas da Casa em{' '}
            {getMonthLabel(selectedMonth)}
          </h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Despesa da Casa</th>
                <th className="text-center">Valor Total</th>
                {!isUnified && (
                  <>
                    <th className="text-center">Parte de {couple.partner1Name}</th>
                    <th className="text-center">Parte de {couple.partner2Name}</th>
                  </>
                )}
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
                  {!isUnified && (
                    <>
                      <td className="text-center font-mono-val" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(tx.amount * p1ShareRatio)}
                      </td>
                      <td className="text-center font-mono-val" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(tx.amount * p2ShareRatio)}
                      </td>
                    </>
                  )}
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
    </div>
  );
}
