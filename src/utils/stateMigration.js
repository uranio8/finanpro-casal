import { INITIAL_STATE } from '../data/initialState';
import { syncMonthIncomeAndTitheTransactions } from './formatters';

export function mapLegacyCardId(cid) {
  if (!cid) return '';
  if (cid === 'card-2') return 'card-inter';
  if (cid === 'card-1' || cid === 'card-3') return 'card-nubank';
  return cid;
}

export function loadInitialFinanceState(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const hasOldDemoCards =
        Array.isArray(parsed.cards) &&
        parsed.cards.some((c) => c.id === 'card-1' || c.id === 'card-2');

      const cardsToUse =
        hasOldDemoCards || !Array.isArray(parsed.cards)
          ? INITIAL_STATE.cards
          : parsed.cards;

      const needsVersion130Upgrade = !parsed.version || parsed.version < '1.3.0';

      let migratedTransactions = Array.isArray(parsed.transactions)
        ? parsed.transactions.map((t) => ({
            ...t,
            cardId: mapLegacyCardId(t.cardId)
          }))
        : INITIAL_STATE.transactions;

      let migratedCommitments = Array.isArray(parsed.commitments)
        ? parsed.commitments.map((c) => ({
            ...c,
            cardId: mapLegacyCardId(c.cardId)
          }))
        : INITIAL_STATE.commitments;

      if (needsVersion130Upgrade) {
        const initialCommIds = new Set(INITIAL_STATE.commitments.map((c) => c.id));
        const userCustomCommitments = migratedCommitments.filter((c) => !initialCommIds.has(c.id));
        migratedCommitments = [...INITIAL_STATE.commitments, ...userCustomCommitments];

        const userCustomTransactions = migratedTransactions.filter(
          (t) => !t.commitmentId || !initialCommIds.has(t.commitmentId)
        );
        migratedTransactions = [...INITIAL_STATE.transactions, ...userCustomTransactions];
      }

      let migratedMonthlyIncomes =
        parsed.monthlyIncomes && typeof parsed.monthlyIncomes === 'object'
          ? { ...parsed.monthlyIncomes }
          : { ...INITIAL_STATE.monthlyIncomes };

      const needsVersion140Upgrade = !parsed.version || parsed.version < '1.4.0';
      if (needsVersion140Upgrade) {
        if (
          migratedMonthlyIncomes['2026-11']?.partner1Income === 5900 &&
          migratedMonthlyIncomes['2026-11']?.partner2Income === 700
        ) {
          migratedMonthlyIncomes['2026-11'] = {
            partner1Income: 6500,
            partner2Income: 5500,
            donationAmount: 0
          };
        }
      }

      const baseLoadedState = {
        ...INITIAL_STATE,
        ...parsed,
        version: '2.0.0',
        couple: {
          ...INITIAL_STATE.couple,
          ...(parsed.couple || {}),
          partner2Name:
            parsed.couple?.partner2Name === 'Esposa' || !parsed.couple?.partner2Name
              ? 'Beatriz'
              : parsed.couple.partner2Name
        },
        cards: cardsToUse,
        transactions: migratedTransactions,
        commitments: migratedCommitments,
        monthlyIncomes: migratedMonthlyIncomes,
        monthlySettlements: parsed.monthlySettlements || {},
        categoryBudgets: {
          ...INITIAL_STATE.categoryBudgets,
          ...(parsed.categoryBudgets || {})
        },
        extraIncomes: Array.isArray(parsed.extraIncomes)
          ? parsed.extraIncomes
          : INITIAL_STATE.extraIncomes,
        weeklyExtraFuelCosts: parsed.weeklyExtraFuelCosts || {},
        savedStudents: Array.isArray(parsed.savedStudents) ? parsed.savedStudents : [],
        deletedIds: parsed.deletedIds || {}
      };

      return {
        ...baseLoadedState,
        transactions: syncMonthIncomeAndTitheTransactions(
          baseLoadedState,
          baseLoadedState.selectedMonth || '2026-11'
        )
      };
    }
  } catch (e) {
    console.error('Erro ao ler localStorage:', e);
  }
  return {
    ...INITIAL_STATE,
    savedStudents: [],
    deletedIds: {},
    transactions: syncMonthIncomeAndTitheTransactions(
      INITIAL_STATE,
      INITIAL_STATE.selectedMonth || '2026-11'
    )
  };
}
