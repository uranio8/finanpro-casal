export function formatCurrency(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatShortDateBR(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const mIdx = parseInt(parts[1], 10) - 1;
  return `${parts[2]}/${months[mIdx] || parts[1]}`;
}

export function getMonthLabel(yearMonth) {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const names = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(month, 10) - 1;
  return `${names[idx] || month} de ${year}`;
}

export function addMonthsToDate(dateStr, monthsToAdd) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetYear = y + Math.floor((m - 1 + monthsToAdd) / 12);
  const targetMonth = ((m - 1 + monthsToAdd) % 12) + 1;
  const maxDayInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const safeDay = Math.min(d, maxDayInMonth);
  const mm = String(targetMonth).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function buildSafeDueDate(yearMonth, day = 15) {
  if (!yearMonth || !yearMonth.includes('-')) return `${yearMonth || '2026-11'}-15`;
  const [y, m] = yearMonth.split('-').map(Number);
  const maxDayInMonth = new Date(y, m, 0).getDate() || 28;
  const parsedDay = parseInt(day, 10);
  const safeDay = Math.max(1, Math.min(isNaN(parsedDay) ? 15 : parsedDay, maxDayInMonth));
  return `${yearMonth}-${String(safeDay).padStart(2, '0')}`;
}

export function isAutoSalaryTransaction(tx) {
  if (!tx || tx.type !== 'income') return false;
  if (
    tx.id === 'tx-inc-1' ||
    tx.id === 'tx-inc-2' ||
    (typeof tx.id === 'string' &&
      (tx.id.startsWith('tx-inc-p1-') || tx.id.startsWith('tx-inc-p2-')))
  ) {
    return true;
  }
  if (tx.category === 'salario' && typeof tx.title === 'string' && tx.title.startsWith('Salário Mensal —')) {
    return true;
  }
  return false;
}

export function isAutoTitheOrDonationTransaction(tx) {
  if (!tx || tx.type !== 'expense' || tx.category !== 'dizimo') return false;
  if (
    tx.id === 'tx-diz-1' ||
    tx.id === 'tx-diz-2' ||
    (typeof tx.id === 'string' &&
      (tx.id.startsWith('tx-diz-p1-') ||
        tx.id.startsWith('tx-diz-p2-') ||
        tx.id.startsWith('tx-don-')))
  ) {
    return true;
  }
  if (
    typeof tx.title === 'string' &&
    (tx.title.startsWith('Dízimo (') || tx.title.startsWith('Doações Especiais & Caridade —'))
  ) {
    return true;
  }
  return false;
}

export function getDaysDiffFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date('2026-11-11T00:00:00');
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function shiftYearMonth(yearMonth, deltaMonths) {
  const [y, m] = yearMonth.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

export function getEffectiveMonthIncome(state, yearMonth) {
  if (!state) return { partner1Income: 0, partner2Income: 0, donationAmount: 0, isCustom: false };
  const ym = yearMonth || state.selectedMonth;
  const monthData = state.monthlyIncomes?.[ym];
  const p1Sal = monthData?.partner1Income ?? state.couple?.partner1Income ?? 0;
  const p2Sal = monthData?.partner2Income ?? state.couple?.partner2Income ?? 0;
  const don = monthData?.donationAmount ?? state.couple?.donationAmount ?? 0;
  return {
    partner1Income: Number(p1Sal),
    partner2Income: Number(p2Sal),
    donationAmount: Number(don),
    isCustom: !!monthData
  };
}

export function syncMonthIncomeAndTitheTransactions(state, targetYearMonth) {
  if (!state || !state.couple) return state?.transactions || [];
  const ym = targetYearMonth || state.selectedMonth || '2026-11';
  const effective = getEffectiveMonthIncome(state, ym);
  const p1Sal = effective.partner1Income;
  const p2Sal = effective.partner2Income;
  const don = effective.donationAmount;
  const couple = state.couple;

  let newTransactions = [...(state.transactions || [])];
  const isPastOrCurrentRef = ym <= '2026-11';

  // 1. Salário Partner 1
  const tx1Title = `Salário Mensal — ${couple.partner1Name || 'Wesley'}`;
  const p1TxIndex = newTransactions.findIndex(
    (t) =>
      t.type === 'income' &&
      t.dueDate?.startsWith(ym) &&
      t.owner === 'partner1' &&
      isAutoSalaryTransaction(t)
  );
  if (p1Sal > 0) {
    if (p1TxIndex >= 0) {
      newTransactions[p1TxIndex] = {
        ...newTransactions[p1TxIndex],
        title: tx1Title,
        amount: p1Sal
      };
    } else {
      newTransactions.push({
        id: `tx-inc-p1-${ym}`,
        title: tx1Title,
        type: 'income',
        category: 'salario',
        amount: p1Sal,
        dueDate: `${ym}-05`,
        paidDate: isPastOrCurrentRef ? `${ym}-05` : '',
        status: isPastOrCurrentRef ? 'paid' : 'pending',
        owner: 'partner1',
        paidBy: 'partner1',
        paymentMethod: 'PIX'
      });
    }
  } else if (p1TxIndex >= 0) {
    newTransactions.splice(p1TxIndex, 1);
  }

  // 2. Salário Partner 2
  const tx2Title = `Salário Mensal — ${couple.partner2Name || 'Beatriz'}`;
  const p2TxIndex = newTransactions.findIndex(
    (t) =>
      t.type === 'income' &&
      t.dueDate?.startsWith(ym) &&
      t.owner === 'partner2' &&
      isAutoSalaryTransaction(t)
  );
  if (p2Sal > 0) {
    if (p2TxIndex >= 0) {
      newTransactions[p2TxIndex] = {
        ...newTransactions[p2TxIndex],
        title: tx2Title,
        amount: p2Sal
      };
    } else {
      newTransactions.push({
        id: `tx-inc-p2-${ym}`,
        title: tx2Title,
        type: 'income',
        category: 'salario',
        amount: p2Sal,
        dueDate: `${ym}-05`,
        paidDate: isPastOrCurrentRef ? `${ym}-05` : '',
        status: isPastOrCurrentRef ? 'paid' : 'pending',
        owner: 'partner2',
        paidBy: 'partner2',
        paymentMethod: 'PIX'
      });
    }
  } else if (p2TxIndex >= 0) {
    newTransactions.splice(p2TxIndex, 1);
  }

  // 3. Primícias (Dízimo + Ofertas) sobre Salário + Renda Extra Recebida (com applyTitheAndOffering)
  const tithePct = couple.titheEnabled ? Number(couple.tithePercent ?? 10) : 0;
  const p1OffPct = couple.titheEnabled ? Number(couple.partner1OfferingPercent ?? 5) : 0;
  const p2OffPct = couple.titheEnabled ? Number(couple.partner2OfferingPercent ?? 5) : 0;

  const monthExtras = (state.extraIncomes || []).filter((i) => i.date?.startsWith(ym));
  const p1Extra = couple.includeExtraInTithe
    ? monthExtras
        .filter((i) => i.owner === 'partner1' && i.status === 'received' && i.applyTitheAndOffering !== false)
        .reduce((a, i) => a + Number(i.amount || 0), 0)
    : 0;
  const p2Extra = couple.includeExtraInTithe
    ? monthExtras
        .filter((i) => i.owner === 'partner2' && i.status === 'received' && i.applyTitheAndOffering !== false)
        .reduce((a, i) => a + Number(i.amount || 0), 0)
    : 0;

  const p1TitheTotal = Number((((p1Sal + p1Extra) * (tithePct + p1OffPct)) / 100).toFixed(2));
  const p2TitheTotal = Number((((p2Sal + p2Extra) * (tithePct + p2OffPct)) / 100).toFixed(2));

  // Dízimo Partner 1
  const p1DizIdx = newTransactions.findIndex(
    (t) =>
      t.category === 'dizimo' &&
      t.dueDate?.startsWith(ym) &&
      t.owner === 'partner1' &&
      (t.id === 'tx-diz-1' || t.id === `tx-diz-p1-${ym}` || t.title?.includes('Dízimo'))
  );
  const p1DizTitle = `Dízimo (${tithePct}%) + Oferta (${p1OffPct}%) — ${couple.partner1Name || 'Wesley'}`;
  if (couple.titheEnabled && p1TitheTotal > 0) {
    if (p1DizIdx >= 0) {
      newTransactions[p1DizIdx] = {
        ...newTransactions[p1DizIdx],
        title: p1DizTitle,
        amount: p1TitheTotal
      };
    } else {
      newTransactions.push({
        id: `tx-diz-p1-${ym}`,
        title: p1DizTitle,
        type: 'expense',
        category: 'dizimo',
        amount: p1TitheTotal,
        dueDate: `${ym}-06`,
        paidDate: isPastOrCurrentRef ? `${ym}-06` : '',
        status: isPastOrCurrentRef ? 'paid' : 'pending',
        owner: 'partner1',
        paidBy: 'partner1',
        paymentMethod: 'PIX'
      });
    }
  } else if (p1DizIdx >= 0) {
    newTransactions.splice(p1DizIdx, 1);
  }

  // Dízimo Partner 2
  const p2DizIdx = newTransactions.findIndex(
    (t) =>
      t.category === 'dizimo' &&
      t.dueDate?.startsWith(ym) &&
      t.owner === 'partner2' &&
      (t.id === 'tx-diz-2' || t.id === `tx-diz-p2-${ym}` || t.title?.includes('Dízimo'))
  );
  const p2DizTitle = `Dízimo (${tithePct}%) + Oferta (${p2OffPct}%) — ${couple.partner2Name || 'Beatriz'}`;
  if (couple.titheEnabled && p2TitheTotal > 0) {
    if (p2DizIdx >= 0) {
      newTransactions[p2DizIdx] = {
        ...newTransactions[p2DizIdx],
        title: p2DizTitle,
        amount: p2TitheTotal
      };
    } else {
      newTransactions.push({
        id: `tx-diz-p2-${ym}`,
        title: p2DizTitle,
        type: 'expense',
        category: 'dizimo',
        amount: p2TitheTotal,
        dueDate: `${ym}-06`,
        paidDate: isPastOrCurrentRef ? `${ym}-06` : '',
        status: isPastOrCurrentRef ? 'paid' : 'pending',
        owner: 'partner2',
        paidBy: 'partner2',
        paymentMethod: 'PIX'
      });
    }
  } else if (p2DizIdx >= 0) {
    newTransactions.splice(p2DizIdx, 1);
  }

  // 4. Doação Especial / Caridade
  const donIdx = newTransactions.findIndex(
    (t) =>
      t.id === `tx-don-${ym}` ||
      (t.category === 'dizimo' && t.title?.includes('Doações Especiais') && t.dueDate?.startsWith(ym))
  );
  if (don > 0) {
    if (donIdx >= 0) {
      newTransactions[donIdx] = { ...newTransactions[donIdx], amount: don };
    } else {
      newTransactions.push({
        id: `tx-don-${ym}`,
        title: `Doações Especiais & Caridade — ${getMonthLabel(ym)}`,
        type: 'expense',
        category: 'dizimo',
        amount: don,
        dueDate: `${ym}-10`,
        paidDate: '',
        status: 'pending',
        owner: 'joint',
        paidBy: 'partner1',
        paymentMethod: 'PIX'
      });
    }
  } else if (donIdx >= 0) {
    newTransactions.splice(donIdx, 1);
  }

  return newTransactions;
}

