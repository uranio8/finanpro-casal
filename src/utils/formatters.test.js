import { describe, it, expect } from 'vitest';
import {
  buildSafeDueDate,
  getMonthlyExtraNetSummary,
  getMonthlyCdiReserveSummary,
  syncMonthIncomeAndTitheTransactions
} from './formatters';

describe('getMonthlyCdiReserveSummary', () => {
  it('deducts CDI reserve in purchase month and covers invoice month without going negative', () => {
    const txs = [
      {
        id: 'tx-card-1',
        type: 'expense',
        title: 'Compra Novembro p/ Fatura Dezembro',
        amount: 500,
        dueDate: '2026-12-15',
        owner: 'joint',
        paymentMethod: 'Cartão de Crédito',
        alreadyFundedInCdi: true,
        fundedMonth: '2026-11'
      }
    ];

    const nov = getMonthlyCdiReserveSummary(txs, '2026-11');
    expect(nov.provisionedForFutureInvoices).toBe(500);
    expect(nov.coveredFromPriorReserve).toBe(0);
    expect(nov.netBudgetDelta).toBe(-500);

    const dec = getMonthlyCdiReserveSummary(txs, '2026-12');
    expect(dec.monthInvoiceFunded).toBe(500);
    expect(dec.coveredFromPriorReserve).toBe(500);
    expect(dec.provisionedForFutureInvoices).toBe(0);
    expect(dec.netBudgetDelta).toBe(500);
  });
});

describe('buildSafeDueDate', () => {
  it('clamps day 31 to 28 in non-leap February and 29 in leap February', () => {
    expect(buildSafeDueDate('2026-02', 31)).toBe('2026-02-28');
    expect(buildSafeDueDate('2024-02', 31)).toBe('2024-02-29');
    expect(buildSafeDueDate('2026-04', 31)).toBe('2026-04-30');
  });
});

describe('getMonthlyExtraNetSummary', () => {
  it('deducts full 2-week fuel cost from monthly total without losing carryover', () => {
    const state = {
      extraIncomes: [
        {
          id: 'e1',
          date: '2026-11-05',
          weekOfMonth: 'Semana 1',
          amount: 150,
          owner: 'partner1',
          status: 'received',
          type: 'class',
          hoursOrQty: 2,
          applyTitheAndOffering: true
        },
        {
          id: 'e2',
          date: '2026-11-12',
          weekOfMonth: 'Semana 2',
          amount: 225,
          owner: 'partner1',
          status: 'received',
          type: 'class',
          hoursOrQty: 3,
          applyTitheAndOffering: true
        }
      ],
      weeklyExtraFuelCosts: {
        '2026-11': {
          'Semana 1': 230
        }
      }
    };

    const summary = getMonthlyExtraNetSummary(state, '2026-11');
    expect(summary.totalGross).toBe(375);
    expect(summary.totalWeeklyFuel).toBe(230);
    expect(summary.totalNet).toBe(145);
    expect(summary.p1TitheableNet).toBe(145);
    expect(summary.byWeek['Semana 1'].fuelCarryOver).toBe(80);
  });
});

describe('syncMonthIncomeAndTitheTransactions', () => {
  it('calculates tithe and offering on salary plus net extra income after weekly fuel', () => {
    const state = {
      selectedMonth: '2026-11',
      couple: {
        partner1Name: 'Wesley',
        partner2Name: 'Beatriz',
        partner1Income: 1000,
        partner2Income: 0,
        titheEnabled: true,
        tithePercent: 10,
        partner1OfferingPercent: 5,
        partner2OfferingPercent: 5,
        donationAmount: 0,
        includeExtraInTithe: true
      },
      monthlyIncomes: {},
      extraIncomes: [
        {
          id: 'e1',
          date: '2026-11-05',
          weekOfMonth: 'Semana 1',
          amount: 300,
          owner: 'partner1',
          status: 'received',
          applyTitheAndOffering: true
        }
      ],
      weeklyExtraFuelCosts: {
        '2026-11': { 'Semana 1': 100 }
      },
      transactions: []
    };

    const txs = syncMonthIncomeAndTitheTransactions(state, '2026-11');
    const p1Tithe = txs.find((t) => t.category === 'dizimo' && t.owner === 'partner1');
    // (1000 salary + (300 - 100) net extra) * 15% = 1200 * 0.15 = 180
    expect(p1Tithe).toBeDefined();
    expect(p1Tithe.amount).toBe(180);
  });

  it('removes salary and tithe transactions when incomes are zeroed', () => {
    const state = {
      selectedMonth: '2026-11',
      couple: {
        partner1Name: 'Wesley',
        partner2Name: 'Beatriz',
        partner1Income: 0,
        partner2Income: 0,
        titheEnabled: true,
        tithePercent: 10,
        partner1OfferingPercent: 5,
        partner2OfferingPercent: 5,
        donationAmount: 0,
        includeExtraInTithe: true
      },
      monthlyIncomes: {},
      extraIncomes: [],
      weeklyExtraFuelCosts: {},
      transactions: [
        { id: 'tx-inc-p1-2026-11', type: 'income', category: 'salario', owner: 'partner1', dueDate: '2026-11-05', title: 'Salário Mensal — Wesley', amount: 6500 },
        { id: 'tx-diz-p1-2026-11', type: 'expense', category: 'dizimo', owner: 'partner1', dueDate: '2026-11-06', title: 'Dízimo', amount: 975 }
      ]
    };

    const txs = syncMonthIncomeAndTitheTransactions(state, '2026-11');
    expect(txs).toHaveLength(0);
  });
});

