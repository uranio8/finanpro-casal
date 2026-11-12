import React, { useState, useEffect } from 'react';
import { INITIAL_STATE, CATEGORIES, INCOME_CATEGORIES } from './data/initialState';
import {
  formatCurrency,
  getMonthLabel,
  shiftYearMonth,
  getEffectiveMonthIncome
} from './utils/formatters';
import DashboardView from './components/DashboardView';
import CommitmentsView from './components/CommitmentsView';
import TransactionsView from './components/TransactionsView';
import ExtraIncomeView from './components/ExtraIncomeView';
import CardsView from './components/CardsView';
import GoalsAndChecklistView from './components/GoalsAndChecklistView';
import CoupleSplitView from './components/CoupleSplitView';
import SettingsView from './components/SettingsView';

const STORAGE_KEY = 'finanpro_couple_state_v1';

export default function App() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old demo cards (card-1, card-2, card-3) to Inter Platinum & Nubank Chroma
        const hasOldDemoCards =
          Array.isArray(parsed.cards) &&
          parsed.cards.some((c) => c.id === 'card-1' || c.id === 'card-2');

        const cardsToUse = hasOldDemoCards || !Array.isArray(parsed.cards)
          ? INITIAL_STATE.cards
          : parsed.cards;

        const mapCardId = (cid) => {
          if (!cid) return '';
          if (cid === 'card-2') return 'card-inter';
          if (cid === 'card-1' || cid === 'card-3') return 'card-nubank';
          return cid;
        };

        // If local state is version < 1.3.0, upgrade demo commitments and transactions with the complete schedules
        const needsVersion130Upgrade = !parsed.version || parsed.version < '1.3.0';

        let migratedTransactions = Array.isArray(parsed.transactions)
          ? parsed.transactions.map((t) => ({
              ...t,
              cardId: mapCardId(t.cardId)
            }))
          : INITIAL_STATE.transactions;

        let migratedCommitments = Array.isArray(parsed.commitments)
          ? parsed.commitments.map((c) => ({
              ...c,
              cardId: mapCardId(c.cardId)
            }))
          : INITIAL_STATE.commitments;

        if (needsVersion130Upgrade) {
          // Replace demo commitments comm-1..comm-5 and merge missing demo transactions
          const initialCommIds = new Set(INITIAL_STATE.commitments.map((c) => c.id));
          const userCustomCommitments = migratedCommitments.filter((c) => !initialCommIds.has(c.id));
          migratedCommitments = [...INITIAL_STATE.commitments, ...userCustomCommitments];

          const userCustomTransactions = migratedTransactions.filter((t) => !t.commitmentId || !initialCommIds.has(t.commitmentId));
          migratedTransactions = [...INITIAL_STATE.transactions, ...userCustomTransactions];
        }

        // v1.4.0 upgrade: corrigir inconsistência de salários em Nov/2026 (5900/700 -> 6500/5500)
        let migratedMonthlyIncomes = {
          ...INITIAL_STATE.monthlyIncomes,
          ...(parsed.monthlyIncomes || {})
        };
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

        return {
          ...INITIAL_STATE,
          ...parsed,
          version: '1.4.0',
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
          categoryBudgets: {
            ...INITIAL_STATE.categoryBudgets,
            ...(parsed.categoryBudgets || {})
          },
          extraIncomes:
            Array.isArray(parsed.extraIncomes) && parsed.extraIncomes.length > 0
              ? parsed.extraIncomes
              : INITIAL_STATE.extraIncomes
        };
      }
    } catch (e) {
      console.error('Erro ao ler localStorage:', e);
    }
    return INITIAL_STATE;
  });

  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Global Modal for New Transaction (Expense or Income)
  const [txModal, setTxModal] = useState({ open: false, type: 'expense' });
  const [externalCommitmentModal, setExternalCommitmentModal] = useState(false);

  const defaultCard = state.cards[0] || { id: 'card-inter', dueDay: 15, owner: 'partner1' };

  const [txForm, setTxForm] = useState({
    title: '',
    type: 'expense',
    category: 'mercado',
    amount: '',
    dueDate: `${state.selectedMonth}-${String(defaultCard.dueDay || 15).padStart(2, '0')}`,
    status: 'pending',
    owner: 'joint',
    paidBy: defaultCard.owner === 'partner2' ? 'partner2' : 'partner1',
    paymentMethod: 'Cartão de Crédito',
    cardId: defaultCard.id
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  // Sync to localStorage & apply theme class to <body>
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Erro ao salvar localStorage:', e);
    }
    document.body.className = state.couple?.theme || 'theme-emerald';
  }, [state]);

  const handleOpenNewTransaction = (type = 'expense', preselectedCardId = null) => {
    const chosenCard =
      (preselectedCardId && state.cards.find((c) => c.id === preselectedCardId)) ||
      state.cards[0] ||
      { id: 'card-inter', dueDay: 15, owner: 'partner1' };

    const isExpense = type === 'expense';
    const dueDayStr = String(chosenCard.dueDay || 15).padStart(2, '0');

    setTxForm({
      title: '',
      type,
      category: type === 'income' ? 'salario' : 'mercado',
      amount: '',
      dueDate: isExpense ? `${state.selectedMonth}-${dueDayStr}` : `${state.selectedMonth}-05`,
      status: type === 'income' ? 'paid' : 'pending',
      owner: type === 'income' ? 'partner1' : 'joint',
      paidBy: chosenCard.owner === 'partner2' ? 'partner2' : 'partner1',
      paymentMethod: isExpense ? 'Cartão de Crédito' : 'PIX',
      cardId: isExpense ? chosenCard.id : ''
    });
    setTxModal({ open: true, type });
    setFabOpen(false);
  };

  const handleSelectCardInTxModal = (newCardId) => {
    const chosen = state.cards.find((c) => c.id === newCardId);
    if (!chosen) {
      setTxForm((prev) => ({ ...prev, cardId: newCardId }));
      return;
    }
    const ym = txForm.dueDate ? txForm.dueDate.slice(0, 7) : state.selectedMonth;
    const newDueDate = `${ym}-${String(chosen.dueDay || 15).padStart(2, '0')}`;
    setTxForm((prev) => ({
      ...prev,
      cardId: newCardId,
      dueDate: newDueDate,
      paidBy: chosen.owner === 'partner2' ? 'partner2' : 'partner1'
    }));
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
    const amountNum = Number(txForm.amount);
    if (!txForm.title.trim() || amountNum <= 0) return;

    const chosenCard = state.cards.find((c) => c.id === txForm.cardId);

    const newTx = {
      id: `tx-${Date.now()}`,
      ...txForm,
      cardId: txForm.paymentMethod === 'Cartão de Crédito' ? txForm.cardId : '',
      amount: amountNum,
      paidDate: txForm.status === 'paid' ? txForm.dueDate : ''
    };

    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTx]
    }));

    setTxModal({ open: false, type: 'expense' });
    showToast(
      txForm.type === 'income'
        ? 'Receita registrada com sucesso!'
        : txForm.paymentMethod === 'Cartão de Crédito' && chosenCard
        ? `Gasto lançado na fatura do ${chosenCard.name}! 💳`
        : 'Despesa lançada com sucesso!'
    );
  };

  const handleQuickPayTransaction = (txId) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId
          ? {
              ...t,
              status: 'paid',
              paidDate: t.dueDate || `${prev.selectedMonth}-10`
            }
          : t
      )
    }));
    showToast('Conta quitada com sucesso! ✨');
  };

  const handleToggleTransactionStatus = (txId, updates) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId ? { ...t, ...updates } : t
      )
    }));
    showToast('Status do lançamento atualizado!');
  };

  const handleDeleteTransaction = (txId) => {
    setState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === txId);
      const remainingTransactions = prev.transactions.filter((t) => t.id !== txId);

      // If it belonged to a commitment, keep commitment and remaining transactions in sync
      if (targetTx && targetTx.commitmentId) {
        const commId = targetTx.commitmentId;
        const brotherTxs = remainingTransactions
          .filter((t) => t.commitmentId === commId)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        if (brotherTxs.length === 0) {
          // If all installments were deleted, remove the commitment master record
          return {
            ...prev,
            commitments: prev.commitments.filter((c) => c.id !== commId),
            transactions: remainingTransactions
          };
        }

        // Renumber remaining installments so counting stays consistent (e.g. 1/3, 2/3)
        const regularTxs = brotherTxs.filter((t) => t.installmentNumber > 0);
        const newTotalCount = regularTxs.length;
        const renumberedTxs = brotherTxs.map((t) => {
          if (t.installmentNumber === 0) return t; // down payment
          const newIdx = regularTxs.findIndex((rt) => rt.id === t.id) + 1;
          return {
            ...t,
            installmentNumber: newIdx,
            totalInstallments: newTotalCount
          };
        });

        // Update commitments master record
        const newTotalAmount = renumberedTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const newEndDate = renumberedTxs[renumberedTxs.length - 1].dueDate;

        const updatedCommitments = prev.commitments.map((c) =>
          c.id === commId
            ? {
                ...c,
                totalAmount: newTotalAmount,
                installmentsCount: newTotalCount,
                endDate: newEndDate
              }
            : c
        );

        const updatedTransactions = remainingTransactions.map((t) => {
          const renumbered = renumberedTxs.find((rt) => rt.id === t.id);
          return renumbered || t;
        });

        return {
          ...prev,
          commitments: updatedCommitments,
          transactions: updatedTransactions
        };
      }

      return {
        ...prev,
        transactions: remainingTransactions
      };
    });
    showToast('Lançamento removido.');
  };

  // Extra Income (Aulas Particulares & Vendas) Handlers
  const handleAddExtraIncome = (itemData) => {
    const newItem = {
      id: `ext-${Date.now()}`,
      ...itemData
    };
    setState((prev) => ({
      ...prev,
      extraIncomes: [...(prev.extraIncomes || []), newItem]
    }));
    showToast(
      itemData.type === 'class'
        ? 'Aula particular registrada na semana! 🎓'
        : 'Venda / ganho extra registrado com sucesso! 💰'
    );
  };

  const handleUpdateExtraIncome = (updatedItem) => {
    setState((prev) => ({
      ...prev,
      extraIncomes: (prev.extraIncomes || []).map((i) =>
        i.id === updatedItem.id ? { ...i, ...updatedItem } : i
      )
    }));
    showToast('Registro de renda extra atualizado com sucesso! ✨');
  };

  const handleToggleExtraIncomeStatus = (itemId) => {
    setState((prev) => ({
      ...prev,
      extraIncomes: (prev.extraIncomes || []).map((i) =>
        i.id === itemId
          ? { ...i, status: i.status === 'received' ? 'pending' : 'received' }
          : i
      )
    }));
    showToast('Status do recebimento atualizado!');
  };

  const handleDeleteExtraIncome = (itemId) => {
    setState((prev) => ({
      ...prev,
      extraIncomes: (prev.extraIncomes || []).filter((i) => i.id !== itemId)
    }));
    showToast('Registro de renda extra removido.');
  };

  const handleAddCommitment = (newCommData) => {
    const commId = `comm-${Date.now()}`;
    const { generatedInstallments, ...commRecord } = newCommData;

    const newCommitment = {
      id: commId,
      ...commRecord
    };

    const newTransactions = (generatedInstallments || []).map((inst) => ({
      id: `tx-${commId}-${inst.number}`,
      commitmentId: commId,
      title:
        inst.number === 0
          ? `${commRecord.title} (Entrada)`
          : commRecord.title,
      type: 'expense',
      category: commRecord.category,
      amount: inst.amount,
      dueDate: inst.dueDate,
      paidDate: inst.number === 0 ? inst.dueDate : '',
      status: inst.number === 0 ? 'paid' : 'pending',
      owner: commRecord.owner,
      paidBy: commRecord.paidBy,
      paymentMethod:
        inst.number === 0
          ? (commRecord.downPaymentMethod || 'PIX')
          : commRecord.paymentMethod,
      cardId:
        inst.number === 0
          ? '' // Entrada à vista não infla nem prende limite de fatura de cartão
          : commRecord.paymentMethod === 'Cartão de Crédito'
          ? commRecord.cardId
          : '',
      installmentNumber: inst.number,
      totalInstallments: commRecord.installmentsCount
    }));

    setState((prev) => ({
      ...prev,
      commitments: [newCommitment, ...prev.commitments],
      transactions: [...prev.transactions, ...newTransactions]
    }));

    showToast(
      `Compromisso "${commRecord.title}" salvo com ${newTransactions.length} lançamentos gerados!`
    );
  };

  const handleDeleteCommitment = (commId) => {
    setState((prev) => ({
      ...prev,
      commitments: prev.commitments.filter((c) => c.id !== commId),
      transactions: prev.transactions.filter((t) => t.commitmentId !== commId)
    }));
    showToast('Parcelamento e parcelas vinculadas excluídos.');
  };

  const handleAddCard = (cardData) => {
    const newCard = {
      id: `card-${Date.now()}`,
      ...cardData
    };
    setState((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
    showToast(`Cartão ${cardData.name} adicionado!`);
  };

  const handleUpdateCard = (cardId, updatedCardData) => {
    const newDueDayStr = String(updatedCardData.dueDay || 15).padStart(2, '0');
    setState((prev) => {
      // 1. Update card
      const updatedCards = prev.cards.map((c) =>
        c.id === cardId ? { ...c, ...updatedCardData } : c
      );

      // 2. Update pending transactions linked to this card
      const updatedTransactions = prev.transactions.map((t) => {
        if (t.cardId === cardId && t.status === 'pending' && t.dueDate) {
          const ym = t.dueDate.slice(0, 7);
          return { ...t, dueDate: `${ym}-${newDueDayStr}` };
        }
        return t;
      });

      // 3. Update commitments linked to this card (recalculate endDate to match new dueDay)
      const updatedCommitments = prev.commitments.map((comm) => {
        if (comm.cardId === cardId) {
          const linked = updatedTransactions
            .filter((t) => t.commitmentId === comm.id)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

          const newEndDate =
            linked.length > 0
              ? linked[linked.length - 1].dueDate
              : comm.endDate
              ? `${comm.endDate.slice(0, 7)}-${newDueDayStr}`
              : comm.endDate;

          const newStartDate = comm.startDate
            ? `${comm.startDate.slice(0, 7)}-${newDueDayStr}`
            : comm.startDate;

          return {
            ...comm,
            startDate: newStartDate,
            endDate: newEndDate
          };
        }
        return comm;
      });

      return {
        ...prev,
        cards: updatedCards,
        transactions: updatedTransactions,
        commitments: updatedCommitments
      };
    });
    showToast(`Cartão e datas de vencimento da fatura (dia ${updatedCardData.dueDay}) atualizados!`);
  };

  const handleDeleteCard = (cardId) => {
    setState((prev) => {
      const cardToDelete = prev.cards.find((c) => c.id === cardId);
      const remainingCards = prev.cards.filter((c) => c.id !== cardId);
      const fallbackCard = remainingCards[0] || null;

      // Safely reassign or clean transactions & commitments linked to deleted card
      const updatedTransactions = prev.transactions.map((t) => {
        if (t.cardId === cardId) {
          return {
            ...t,
            cardId: fallbackCard ? fallbackCard.id : '',
            paymentMethod: fallbackCard ? 'Cartão de Crédito' : 'Outros (Cartão Removido)'
          };
        }
        return t;
      });

      const updatedCommitments = prev.commitments.map((c) => {
        if (c.cardId === cardId) {
          return {
            ...c,
            cardId: fallbackCard ? fallbackCard.id : '',
            paymentMethod: fallbackCard ? 'Cartão de Crédito' : 'Outros (Cartão Removido)'
          };
        }
        return c;
      });

      return {
        ...prev,
        cards: remainingCards,
        transactions: updatedTransactions,
        commitments: updatedCommitments
      };
    });
    showToast('Cartão removido e lançamentos atualizados.');
  };

  const handlePayFullCardInvoice = (cardId, yearMonth) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.cardId === cardId &&
        t.dueDate &&
        t.dueDate.startsWith(yearMonth) &&
        t.status === 'pending'
          ? {
              ...t,
              status: 'paid',
              paidDate: t.dueDate || `${yearMonth}-15`
            }
          : t
      )
    }));
    showToast('Fatura do cartão marcada como paga neste mês! 💳');
  };

  const handleAddGoal = (goalData) => {
    const newGoal = {
      id: `goal-${Date.now()}`,
      ...goalData
    };
    setState((prev) => ({
      ...prev,
      goals: [...prev.goals, newGoal]
    }));
    showToast('Nova Caixinha / Meta criada!');
  };

  const handleDepositGoal = (goalId, depositVal) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === goalId
          ? { ...g, currentAmount: Number(g.currentAmount || 0) + depositVal }
          : g
      )
    }));
    showToast(`Aporte de ${formatCurrency(depositVal)} guardado na Caixinha! 🎉`);
  };

  const handleDeleteGoal = (goalId) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== goalId)
    }));
    showToast('Meta removida.');
  };

  const handleUpdateGoal = (goalId, updatedGoalData) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === goalId ? { ...g, ...updatedGoalData } : g
      )
    }));
    showToast(`Meta "${updatedGoalData.title || 'Caixinha'}" atualizada com sucesso! ✨`);
  };

  const [isMonthIncomeModalOpen, setIsMonthIncomeModalOpen] = useState(false);
  const effectiveIncome = getEffectiveMonthIncome(state, state.selectedMonth);

  const [monthIncomeForm, setMonthIncomeForm] = useState({
    partner1Income: '',
    partner2Income: '',
    donationAmount: ''
  });

  const openMonthIncomeModal = () => {
    setMonthIncomeForm({
      partner1Income: effectiveIncome.partner1Income,
      partner2Income: effectiveIncome.partner2Income,
      donationAmount: effectiveIncome.donationAmount
    });
    setIsMonthIncomeModalOpen(true);
  };

  const handleSaveMonthIncome = (e) => {
    e.preventDefault();
    const p1Sal = Number(monthIncomeForm.partner1Income) || 0;
    const p2Sal = Number(monthIncomeForm.partner2Income) || 0;
    const don = Number(monthIncomeForm.donationAmount) || 0;
    const ym = state.selectedMonth;

    setState((prev) => {
      const updatedMonthlyIncomes = {
        ...(prev.monthlyIncomes || {}),
        [ym]: {
          partner1Income: p1Sal,
          partner2Income: p2Sal,
          donationAmount: don
        }
      };

      const tx1Title = `Salário Mensal — ${prev.couple.partner1Name}`;
      const tx2Title = `Salário Mensal — ${prev.couple.partner2Name}`;

      let newTransactions = [...prev.transactions];

      // Salário Wesley
      const p1TxIndex = newTransactions.findIndex(
        (t) => t.type === 'income' && t.dueDate?.startsWith(ym) && t.owner === 'partner1'
      );
      if (p1TxIndex >= 0) {
        newTransactions[p1TxIndex] = {
          ...newTransactions[p1TxIndex],
          amount: p1Sal
        };
      } else if (p1Sal > 0) {
        newTransactions.push({
          id: `tx-inc-p1-${ym}`,
          title: tx1Title,
          type: 'income',
          category: 'salario',
          amount: p1Sal,
          dueDate: `${ym}-05`,
          paidDate: `${ym}-05`,
          status: 'paid',
          owner: 'partner1',
          paidBy: 'partner1',
          paymentMethod: 'PIX'
        });
      }

      // Salário Beatriz
      const p2TxIndex = newTransactions.findIndex(
        (t) => t.type === 'income' && t.dueDate?.startsWith(ym) && t.owner === 'partner2'
      );
      if (p2TxIndex >= 0) {
        newTransactions[p2TxIndex] = {
          ...newTransactions[p2TxIndex],
          amount: p2Sal
        };
      } else if (p2Sal > 0) {
        newTransactions.push({
          id: `tx-inc-p2-${ym}`,
          title: tx2Title,
          type: 'income',
          category: 'salario',
          amount: p2Sal,
          dueDate: `${ym}-05`,
          paidDate: `${ym}-05`,
          status: 'paid',
          owner: 'partner2',
          paidBy: 'partner2',
          paymentMethod: 'PIX'
        });
      }

      // Sincronizar transações de Dízimo e Ofertas daquele mês (atualizar ou criar se não existirem)
      const tithePct = prev.couple.titheEnabled ? Number(prev.couple.tithePercent ?? 10) : 0;
      const p1OffPct = prev.couple.titheEnabled ? Number(prev.couple.partner1OfferingPercent ?? 5) : 0;
      const p2OffPct = prev.couple.titheEnabled ? Number(prev.couple.partner2OfferingPercent ?? 5) : 0;

      // Se includeExtraInTithe estiver ativo, somar a renda extra recebida do mês
      const monthExtras = (prev.extraIncomes || []).filter((i) => i.date?.startsWith(ym));
      const p1Extra = prev.couple.includeExtraInTithe
        ? monthExtras.filter((i) => i.owner === 'partner1' && i.status === 'received').reduce((a, i) => a + Number(i.amount || 0), 0)
        : 0;
      const p2Extra = prev.couple.includeExtraInTithe
        ? monthExtras.filter((i) => i.owner === 'partner2' && i.status === 'received').reduce((a, i) => a + Number(i.amount || 0), 0)
        : 0;

      const p1TitheTotal = Number((((p1Sal + p1Extra) * (tithePct + p1OffPct)) / 100).toFixed(2));
      const p2TitheTotal = Number((((p2Sal + p2Extra) * (tithePct + p2OffPct)) / 100).toFixed(2));

      // Dízimo Wesley
      const p1DizIdx = newTransactions.findIndex(
        (t) => t.category === 'dizimo' && t.dueDate?.startsWith(ym) && t.owner === 'partner1'
      );
      if (p1DizIdx >= 0) {
        newTransactions[p1DizIdx] = { ...newTransactions[p1DizIdx], amount: p1TitheTotal };
      } else if (prev.couple.titheEnabled && p1TitheTotal > 0) {
        newTransactions.push({
          id: `tx-diz-p1-${ym}`,
          title: `Dízimo (10%) + Oferta (${p1OffPct}%) — ${prev.couple.partner1Name}`,
          type: 'expense',
          category: 'dizimo',
          amount: p1TitheTotal,
          dueDate: `${ym}-06`,
          paidDate: ym <= prev.selectedMonth ? `${ym}-06` : '',
          status: ym < prev.selectedMonth ? 'paid' : (ym === prev.selectedMonth ? 'paid' : 'pending'),
          owner: 'partner1',
          paidBy: 'partner1',
          paymentMethod: 'PIX'
        });
      }

      // Dízimo Beatriz
      const p2DizIdx = newTransactions.findIndex(
        (t) => t.category === 'dizimo' && t.dueDate?.startsWith(ym) && t.owner === 'partner2'
      );
      if (p2DizIdx >= 0) {
        newTransactions[p2DizIdx] = { ...newTransactions[p2DizIdx], amount: p2TitheTotal };
      } else if (prev.couple.titheEnabled && p2TitheTotal > 0) {
        newTransactions.push({
          id: `tx-diz-p2-${ym}`,
          title: `Dízimo (10%) + Oferta (${p2OffPct}%) — ${prev.couple.partner2Name}`,
          type: 'expense',
          category: 'dizimo',
          amount: p2TitheTotal,
          dueDate: `${ym}-06`,
          paidDate: ym <= prev.selectedMonth ? `${ym}-06` : '',
          status: ym < prev.selectedMonth ? 'paid' : (ym === prev.selectedMonth ? 'paid' : 'pending'),
          owner: 'partner2',
          paidBy: 'partner2',
          paymentMethod: 'PIX'
        });
      }

      // Doação especial / Caridade
      const donIdx = newTransactions.findIndex(
        (t) => t.id === `tx-don-${ym}` || (t.category === 'dizimo' && t.title?.includes('Doações Especiais') && t.dueDate?.startsWith(ym))
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

      return {
        ...prev,
        monthlyIncomes: updatedMonthlyIncomes,
        transactions: newTransactions
      };
    });

    setIsMonthIncomeModalOpen(false);
    showToast(`Renda de ${getMonthLabel(ym)} salva com sucesso! 💰`);
  };

  const handleToggleChecklist = (chkId) => {
    setState((prev) => ({
      ...prev,
      checklist: prev.checklist.map((c) =>
        c.id === chkId ? { ...c, done: !c.done } : c
      )
    }));
  };

  const handleAddChecklistItem = (group, title) => {
    const newItem = {
      id: `chk-${Date.now()}`,
      group,
      title,
      deadlineLabel: 'Mensal',
      done: false
    };
    setState((prev) => ({
      ...prev,
      checklist: [...prev.checklist, newItem]
    }));
  };

  const handleDeleteChecklistItem = (chkId) => {
    setState((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((c) => c.id !== chkId)
    }));
  };

  const handleUpdateCoupleSettings = (updates) => {
    setState((prev) => ({
      ...prev,
      couple: {
        ...prev.couple,
        ...updates
      }
    }));
    showToast('Configurações de Wesley & Beatriz atualizadas!');
  };

  const handleUpdateCategoryBudgets = (newBudgets) => {
    setState((prev) => ({
      ...prev,
      categoryBudgets: newBudgets
    }));
    showToast('Tetos de orçamento por categoria salvos!');
  };

  const handleExportBackup = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanpro_backup_${state.selectedMonth}.json`;
    a.click();
    showToast('Backup JSON exportado com sucesso!');
  };

  const handleImportBackup = (parsedState) => {
    setState({ ...INITIAL_STATE, ...parsedState });
    showToast('Backup JSON restaurado com sucesso!');
  };

  const handleResetToDemo = () => {
    setState(INITIAL_STATE);
    showToast('Dados de demonstração restaurados!');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'extra-income', label: 'Renda Extra & Aulas', icon: 'fa-chalkboard-user' },
    { id: 'commitments', label: 'Parcelados & Fixas', icon: 'fa-file-invoice-dollar' },
    { id: 'transactions', label: 'Lançamentos & Mês', icon: 'fa-calendar-check' },
    { id: 'cards', label: 'Cartões & Faturas', icon: 'fa-credit-card' },
    { id: 'goals', label: 'Metas & Checklist', icon: 'fa-piggy-bank' },
    { id: 'couple', label: 'Divisão do Casal', icon: 'fa-scale-balanced' },
    { id: 'settings', label: 'Configurações', icon: 'fa-gear' }
  ];

  const selectedCardInModal = state.cards.find((c) => c.id === txForm.cardId);

  return (
    <div className="app-shell">
      {/* SIDEBAR ESQUERDA */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div>
            <h1>FinanPro!</h1>
            <span>FINANÇAS A DOIS</span>
          </div>
        </div>

        {/* SELETOR DE MÊS NA SIDEBAR */}
        <div className="sidebar-month-picker">
          <button
            className="month-nav-btn"
            title="Mês anterior"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                selectedMonth: shiftYearMonth(prev.selectedMonth, -1)
              }))
            }
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div className="month-current">
            <small>Mês Ativo</small>
            <strong>{getMonthLabel(state.selectedMonth)}</strong>
          </div>
          <button
            className="month-nav-btn"
            title="Próximo mês"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                selectedMonth: shiftYearMonth(prev.selectedMonth, 1)
              }))
            }
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeRoute === item.id ? 'active' : ''}`}
              onClick={() => setActiveRoute(item.id)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-backup-sidebar" onClick={handleExportBackup}>
            <i className="fa-solid fa-cloud-arrow-down"></i> Backup Rápido (.json)
          </button>
          <div className="version-tag">
            <span>FinanPro v{state.version}</span>
            <span>Wesley &amp; {state.couple.partner2Name}</span>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="main-content">
        {/* TOPBAR DE FILTRO DE VISÃO */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-label">
              <i className="fa-solid fa-filter"></i> Filtrar Visão:
            </span>
            <div className="owner-filter-pills">
              {[
                { id: 'all', label: 'Visão Completa' },
                { id: 'joint', label: '🏠 Contas da Casa (Conjunto)' },
                { id: 'partner1', label: `👤 ${state.couple.partner1Name}` },
                { id: 'partner2', label: `👤 ${state.couple.partner2Name}` }
              ].map((f) => (
                <button
                  key={f.id}
                  className={`owner-pill ${state.ownerFilter === f.id ? 'active' : ''}`}
                  onClick={() =>
                    setState((prev) => ({ ...prev, ownerFilter: f.id }))
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="btn btn-sm btn-outline"
              style={{ gap: '6px' }}
              title="Clique para definir quanto cada um recebeu neste mês específico"
              onClick={openMonthIncomeModal}
            >
              <i className="fa-solid fa-money-bill-wave text-emerald"></i> Renda do Mês:{' '}
              <strong className="text-emerald">
                {formatCurrency(effectiveIncome.partner1Income + effectiveIncome.partner2Income)}
              </strong>
            </button>
            <button
              className="btn btn-sm btn-soft"
              onClick={() => setActiveRoute('extra-income')}
            >
              <i className="fa-solid fa-chalkboard-user text-emerald"></i> + Aula / Venda
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleOpenNewTransaction('expense')}
            >
              <i className="fa-solid fa-credit-card"></i> + Lançar Gasto
            </button>
          </div>
        </header>

        {/* ROTAS / VIEWS */}
        {activeRoute === 'dashboard' && (
          <DashboardView
            state={state}
            onNavigate={setActiveRoute}
            onOpenNewTransaction={handleOpenNewTransaction}
            onQuickPayTransaction={handleQuickPayTransaction}
            onOpenMonthIncomeModal={openMonthIncomeModal}
            onOpenCommitmentModal={() => {
              setActiveRoute('commitments');
              setExternalCommitmentModal(true);
            }}
          />
        )}

        {activeRoute === 'extra-income' && (
          <ExtraIncomeView
            state={state}
            onAddExtraIncome={handleAddExtraIncome}
            onUpdateExtraIncome={handleUpdateExtraIncome}
            onToggleExtraIncomeStatus={handleToggleExtraIncomeStatus}
            onDeleteExtraIncome={handleDeleteExtraIncome}
          />
        )}

        {activeRoute === 'commitments' && (
          <CommitmentsView
            state={state}
            onAddCommitment={handleAddCommitment}
            onDeleteCommitment={handleDeleteCommitment}
            onQuickPayTransaction={handleQuickPayTransaction}
            externalModalOpen={externalCommitmentModal}
            setExternalModalOpen={setExternalCommitmentModal}
          />
        )}

        {activeRoute === 'transactions' && (
          <TransactionsView
            state={state}
            onOpenNewTransaction={handleOpenNewTransaction}
            onToggleTransactionStatus={handleToggleTransactionStatus}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeRoute === 'cards' && (
          <CardsView
            state={state}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onPayFullCardInvoice={handlePayFullCardInvoice}
            onOpenNewTransactionWithCard={(cardId) =>
              handleOpenNewTransaction('expense', cardId)
            }
          />
        )}

        {activeRoute === 'goals' && (
          <GoalsAndChecklistView
            state={state}
            onAddGoal={handleAddGoal}
            onUpdateGoal={handleUpdateGoal}
            onDepositGoal={handleDepositGoal}
            onDeleteGoal={handleDeleteGoal}
            onToggleChecklist={handleToggleChecklist}
            onAddChecklistItem={handleAddChecklistItem}
            onDeleteChecklistItem={handleDeleteChecklistItem}
          />
        )}

        {activeRoute === 'couple' && (
          <CoupleSplitView
            state={state}
            onUpdateCoupleSettings={handleUpdateCoupleSettings}
            onOpenMonthIncomeModal={openMonthIncomeModal}
          />
        )}

        {activeRoute === 'settings' && (
          <SettingsView
            state={state}
            onUpdateCoupleSettings={handleUpdateCoupleSettings}
            onUpdateCategoryBudgets={handleUpdateCategoryBudgets}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetToDemo={handleResetToDemo}
          />
        )}
      </main>

      {/* BOTÃO FLUTUANTE DE "AÇÕES RÁPIDAS" (FAB) */}
      <div className={`fab-container ${fabOpen ? 'open' : ''}`}>
        {fabOpen && (
          <div className="fab-menu">
            <button onClick={() => handleOpenNewTransaction('expense', 'card-inter')}>
              <i className="fa-solid fa-credit-card"></i> Gasto no Inter Platinum (Wesley)
            </button>
            <button onClick={() => handleOpenNewTransaction('expense', 'card-nubank')}>
              <i className="fa-solid fa-credit-card"></i> Gasto no Nubank Chroma (Beatriz)
            </button>
            <button
              onClick={() => {
                setActiveRoute('extra-income');
                setFabOpen(false);
              }}
            >
              <i className="fa-solid fa-chalkboard-user"></i> Registrar Aula / Venda
            </button>
            <button
              onClick={() => {
                setActiveRoute('commitments');
                setExternalCommitmentModal(true);
                setFabOpen(false);
              }}
            >
              <i className="fa-solid fa-file-invoice-dollar"></i> Compra Parcelada no Cartão
            </button>
            <button
              onClick={() => {
                setActiveRoute('cards');
                setFabOpen(false);
              }}
            >
              <i className="fa-solid fa-calendar-day"></i> Ver Faturas &amp; Vencimentos
            </button>
          </div>
        )}
        <button
          className="fab-trigger"
          onClick={() => setFabOpen(!fabOpen)}
          title="Ações Rápidas"
        >
          <i className={`fa-solid ${fabOpen ? 'fa-xmark' : 'fa-bolt'}`}></i>
          <span>Ações Rápidas</span>
        </button>
      </div>

      {/* MODAL GLOBAL: NOVA DESPESA OU RECEITA AVULSA */}
      {txModal.open && (
        <div
          className="modal-backdrop"
          onClick={() => setTxModal({ open: false, type: 'expense' })}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i
                  className={`fa-solid ${
                    txForm.type === 'income'
                      ? 'fa-arrow-trend-up text-emerald'
                      : 'fa-credit-card'
                  }`}
                ></i>{' '}
                {txForm.type === 'income'
                  ? 'Nova Receita / Entrada no Mês'
                  : 'Cadastrar Gasto (Cartão de Crédito / Pix)'}
              </h3>
              <button
                className="close-btn"
                onClick={() => setTxModal({ open: false, type: 'expense' })}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveTransaction} className="modal-body">
              <div className="form-group">
                <label htmlFor="tx-title">Descrição da Compra ou Conta *</label>
                <input
                  id="tx-title"
                  type="text"
                  required
                  placeholder={
                    txForm.type === 'income'
                      ? 'Ex: Salário, Freelance, Dividendos...'
                      : 'Ex: Supermercado, Combustível, Farmácia, Jantar...'
                  }
                  value={txForm.title}
                  onChange={(e) => setTxForm({ ...txForm, title: e.target.value })}
                />
              </div>

              {/* VALOR E VENCIMENTO */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="tx-amount">Valor (R$) *</label>
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Ex: 150.00"
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tx-date">
                    {txForm.paymentMethod === 'Cartão de Crédito'
                      ? 'Vencimento da Fatura *'
                      : 'Data de Vencimento *'}
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={txForm.dueDate}
                    onChange={(e) => setTxForm({ ...txForm, dueDate: e.target.value })}
                  />
                </div>
              </div>

              {/* FORMA DE PAGAMENTO E CARTÃO (SEM BOXES APERTADAS) */}
              {txForm.type === 'expense' && (
                <>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label htmlFor="tx-method">Forma de Pagamento *</label>
                      <select
                        id="tx-method"
                        value={txForm.paymentMethod}
                        onChange={(e) => {
                          const method = e.target.value;
                          if (method === 'Cartão de Crédito' && state.cards[0]) {
                            handleSelectCardInTxModal(txForm.cardId || state.cards[0].id);
                          }
                          setTxForm((prev) => ({
                            ...prev,
                            paymentMethod: method
                          }));
                        }}
                      >
                        <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                        <option value="PIX">💠 PIX / Transferência</option>
                        <option value="Cartão de Débito">💳 Cartão de Débito</option>
                        <option value="Boleto">📄 Boleto Bancário</option>
                      </select>
                    </div>

                    {txForm.paymentMethod === 'Cartão de Crédito' ? (
                      <div className="form-group">
                        <label htmlFor="tx-card">Qual Cartão? *</label>
                        <select
                          id="tx-card"
                          value={txForm.cardId}
                          onChange={(e) => handleSelectCardInTxModal(e.target.value)}
                        >
                          {state.cards.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label htmlFor="tx-paidby-direct">Quem Pagou? *</label>
                        <select
                          id="tx-paidby-direct"
                          value={txForm.paidBy}
                          onChange={(e) => setTxForm({ ...txForm, paidBy: e.target.value })}
                        >
                          <option value="partner1">{state.couple.partner1Name}</option>
                          <option value="partner2">{state.couple.partner2Name}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {txForm.paymentMethod === 'Cartão de Crédito' && selectedCardInModal && (
                    <div className="modal-card-info-badge">
                      <i
                        className="fa-solid fa-credit-card"
                        style={{ color: selectedCardInModal.color, fontSize: '15px' }}
                      ></i>
                      <span>
                        Fatura <strong>{selectedCardInModal.name}</strong> · Fecha dia{' '}
                        <strong>{selectedCardInModal.closingDay}</strong> · Vence dia{' '}
                        <strong>{selectedCardInModal.dueDay}</strong> (Titular:{' '}
                        {selectedCardInModal.owner === 'partner1'
                          ? state.couple.partner1Name
                          : state.couple.partner2Name}
                        )
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* CATEGORIA E STATUS */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="tx-cat">Categoria</label>
                  <select
                    id="tx-cat"
                    value={txForm.category}
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                  >
                    {(txForm.type === 'income' ? INCOME_CATEGORIES : CATEGORIES).map(
                      (c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tx-status">Situação do Pagamento</label>
                  <select
                    id="tx-status"
                    value={txForm.status}
                    onChange={(e) => setTxForm({ ...txForm, status: e.target.value })}
                  >
                    <option value="pending">
                      {txForm.type === 'income'
                        ? '⏳ A Receber'
                        : txForm.paymentMethod === 'Cartão de Crédito'
                        ? '💳 Na Fatura do Mês (A Pagar)'
                        : '⏳ Pendente (A Pagar)'}
                    </option>
                    <option value="paid">
                      {txForm.type === 'income' ? '✅ Já Recebido' : '✅ Já Pago / Fatura Quitada'}
                    </option>
                  </select>
                </div>
              </div>

              {/* DIVISÃO DO GASTO */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="tx-owner">Divisão da Despesa</label>
                  <select
                    id="tx-owner"
                    value={txForm.owner}
                    onChange={(e) => setTxForm({ ...txForm, owner: e.target.value })}
                  >
                    <option value="joint">🏠 Conjunto da Casa (Casal)</option>
                    <option value="partner1">👤 Individual — {state.couple.partner1Name}</option>
                    <option value="partner2">👤 Individual — {state.couple.partner2Name}</option>
                  </select>
                </div>

                {txForm.paymentMethod === 'Cartão de Crédito' && (
                  <div className="form-group">
                    <label htmlFor="tx-paidby">Titular que Paga a Fatura</label>
                    <select
                      id="tx-paidby"
                      value={txForm.paidBy}
                      onChange={(e) => setTxForm({ ...txForm, paidBy: e.target.value })}
                    >
                      <option value="partner1">{state.couple.partner1Name}</option>
                      <option value="partner2">{state.couple.partner2Name}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setTxModal({ open: false, type: 'expense' })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Salvar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DEFINIR RENDA ESPECÍFICA DO MÊS */}
      {isMonthIncomeModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsMonthIncomeModalOpen(false)}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-money-bill-wave text-emerald"></i> Renda de{' '}
                {getMonthLabel(state.selectedMonth)}
              </h3>
              <button
                className="close-btn"
                onClick={() => setIsMonthIncomeModalOpen(false)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSaveMonthIncome} className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Defina quanto você e seu cônjuge receberam em{' '}
                <strong>{getMonthLabel(state.selectedMonth)}</strong>. Esta alteração se aplica{' '}
                <strong>apenas a este mês</strong>, mantendo intacto o histórico dos outros meses.
              </p>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="m-p1-inc">
                    Salário de {state.couple.partner1Name} (R$) *
                  </label>
                  <input
                    id="m-p1-inc"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Ex: 6500.00"
                    value={monthIncomeForm.partner1Income}
                    onChange={(e) =>
                      setMonthIncomeForm({
                        ...monthIncomeForm,
                        partner1Income: e.target.value
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="m-p2-inc">
                    Salário de {state.couple.partner2Name} (R$) *
                  </label>
                  <input
                    id="m-p2-inc"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="Ex: 5500.00"
                    value={monthIncomeForm.partner2Income}
                    onChange={(e) =>
                      setMonthIncomeForm({
                        ...monthIncomeForm,
                        partner2Income: e.target.value
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="m-don-inc">
                  Doações Esporádicas / Especiais deste Mês (R$)
                </label>
                <input
                  id="m-don-inc"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 0.00 (ajuda de custo ou caridade fora dízimo e oferta)"
                  value={monthIncomeForm.donationAmount}
                  onChange={(e) =>
                    setMonthIncomeForm({
                      ...monthIncomeForm,
                      donationAmount: e.target.value
                    })
                  }
                />
              </div>

              {/* SIMULAÇÃO EM TEMPO REAL DAS PRIMÍCIAS DESTE MÊS */}
              {(() => {
                const ym = state.selectedMonth;
                const p1 = Number(monthIncomeForm.partner1Income) || 0;
                const p2 = Number(monthIncomeForm.partner2Income) || 0;
                const don = Number(monthIncomeForm.donationAmount) || 0;
                const tithePct = state.couple.titheEnabled
                  ? Number(state.couple.tithePercent ?? 10)
                  : 0;
                const p1Off = state.couple.titheEnabled
                  ? Number(state.couple.partner1OfferingPercent ?? 5)
                  : 0;
                const p2Off = state.couple.titheEnabled
                  ? Number(state.couple.partner2OfferingPercent ?? 5)
                  : 0;

                const monthExtras = (state.extraIncomes || []).filter((i) => i.date?.startsWith(ym));
                const p1Extra = state.couple.includeExtraInTithe
                  ? monthExtras.filter((i) => i.owner === 'partner1' && i.status === 'received').reduce((a, i) => a + Number(i.amount || 0), 0)
                  : 0;
                const p2Extra = state.couple.includeExtraInTithe
                  ? monthExtras.filter((i) => i.owner === 'partner2' && i.status === 'received').reduce((a, i) => a + Number(i.amount || 0), 0)
                  : 0;
                const totalExtraM = p1Extra + p2Extra;

                const p1TitheTotal = Number((((p1 + p1Extra) * (tithePct + p1Off)) / 100).toFixed(2));
                const p2TitheTotal = Number((((p2 + p2Extra) * (tithePct + p2Off)) / 100).toFixed(2));
                const totalIncomeM = p1 + p2 + totalExtraM;
                const totalTitheDon = Number((p1TitheTotal + p2TitheTotal + don).toFixed(2));
                const netIncomeM = totalIncomeM - totalTitheDon;

                return (
                  <div className="installment-plan-box" style={{ background: 'var(--bg-subtle)' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '12px',
                        marginBottom: '8px',
                        color: 'var(--text-main)'
                      }}
                    >
                      <i className="fa-solid fa-calculator text-emerald"></i> Simulação de Primícias em{' '}
                      {getMonthLabel(state.selectedMonth)}:
                    </div>
                    <div className="form-grid-3">
                      <div className="preview-pill">
                        <span>Renda Total (Salários{totalExtraM > 0 ? ' + Extras' : ''})</span>
                        <strong className="text-emerald">{formatCurrency(totalIncomeM)}</strong>
                      </div>
                      <div className="preview-pill">
                        <span>Dízimo + Oferta Casal</span>
                        <strong style={{ color: '#059669' }}>{formatCurrency(totalTitheDon)}</strong>
                        <small>
                          10% + {p1Off}% / {p2Off}%
                        </small>
                      </div>
                      <div className="preview-pill">
                        <span>Sobra Líquida</span>
                        <strong className="text-emerald">{formatCurrency(netIncomeM)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsMonthIncomeModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Salvar Renda de{' '}
                  {getMonthLabel(state.selectedMonth)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST DE FEEDBACK */}
      {toast && (
        <div className="toast-notification">
          <i className="fa-solid fa-circle-check"></i>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
