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

