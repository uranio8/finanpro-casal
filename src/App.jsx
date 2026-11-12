import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_STATE, CATEGORIES, INCOME_CATEGORIES } from './data/initialState';
import {
  formatCurrency,
  getMonthLabel,
  shiftYearMonth,
  getEffectiveMonthIncome,
  buildSafeDueDate,
  isAutoSalaryTransaction,
  syncMonthIncomeAndTitheTransactions
} from './utils/formatters';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
  pushStateToSupabase,
  pullStateFromSupabase
} from './utils/supabaseSync';
import DashboardView from './components/DashboardView';
import CommitmentsView from './components/CommitmentsView';
import TransactionsView from './components/TransactionsView';
import ExtraIncomeView from './components/ExtraIncomeView';
import CardsView from './components/CardsView';
import GoalsAndChecklistView from './components/GoalsAndChecklistView';
import CoupleSplitView from './components/CoupleSplitView';
import SettingsView from './components/SettingsView';
import ReportPrintModal from './components/ReportPrintModal';

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
          extraIncomes:
            Array.isArray(parsed.extraIncomes) && parsed.extraIncomes.length > 0
              ? parsed.extraIncomes
              : INITIAL_STATE.extraIncomes
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
      transactions: syncMonthIncomeAndTitheTransactions(
        INITIAL_STATE,
        INITIAL_STATE.selectedMonth || '2026-11'
      )
    };
  });

  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Supabase Cloud Sync & PWA State
  const [supabaseConfig, setSupabaseConfig] = useState(() => getSupabaseConfig());
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(null);
  const skipNextAutoPushRef = useRef(false);

  // Global Modal for New or Edited Transaction (Expense or Income)
  const [txModal, setTxModal] = useState({
    open: false,
    type: 'expense',
    editingId: null,
    commitmentId: null
  });
  const [externalCommitmentModal, setExternalCommitmentModal] = useState(false);

  const defaultCard = state.cards[0] || { id: 'card-inter', dueDay: 15, owner: 'partner1' };

  const [txForm, setTxForm] = useState({
    title: '',
    type: 'expense',
    category: 'mercado',
    amount: '',
    dueDate: buildSafeDueDate(state.selectedMonth, defaultCard.dueDay || 15),
    status: 'pending',
    owner: 'joint',
    paidBy: defaultCard.owner === 'partner2' ? 'partner2' : 'partner1',
    paymentMethod: 'Cartão de Crédito',
    cardId: defaultCard.id,
    propagateToPendingInstallments: true
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPwaPrompt) {
      showToast(
        'Para instalar no celular: abra o menu do navegador e toque em "Adicionar à Tela de Início"! 📲'
      );
      return;
    }
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    setDeferredPwaPrompt(null);
  };

  // Sync to localStorage, apply theme class & optional auto-sync to Supabase
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Erro ao salvar localStorage:', e);
    }
    document.body.className = state.couple?.theme || 'theme-emerald';

    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false;
      return;
    }

    if (isSupabaseConfigured(supabaseConfig) && supabaseConfig.autoSync) {
      setCloudSyncStatus('syncing');
      const timer = setTimeout(async () => {
        const res = await pushStateToSupabase(state, supabaseConfig);
        if (res.ok) {
          setCloudSyncStatus('synced');
          setSupabaseConfig((prev) => ({ ...prev, lastSyncAt: res.syncedAt }));
        } else {
          setCloudSyncStatus('error');
        }
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleSaveSupabaseConfig = (newCfg) => {
    const saved = saveSupabaseConfig(newCfg);
    setSupabaseConfig(saved);
    showToast('Configuração de nuvem (Supabase) salva!');
  };

  const handlePushToCloud = async (customCfg) => {
    const cfgToUse = customCfg || supabaseConfig;
    if (!isSupabaseConfigured(cfgToUse)) {
      showToast('Preencha a URL, Anon Key e Código do Casal primeiro.');
      return { ok: false };
    }
    setCloudSyncStatus('syncing');
    const res = await pushStateToSupabase(state, cfgToUse);
    if (res.ok) {
      setCloudSyncStatus('synced');
      setSupabaseConfig(getSupabaseConfig());
      showToast('Dados sincronizados na nuvem com sucesso! ☁️✨');
    } else {
      setCloudSyncStatus('error');
      showToast('Falha ao enviar para o Supabase. Verifique a tabela e chaves.');
    }
    return res;
  };

  const handlePullFromCloud = async (customCfg) => {
    const cfgToUse = customCfg || supabaseConfig;
    if (!isSupabaseConfigured(cfgToUse)) {
      showToast('Preencha a URL, Anon Key e Código do Casal primeiro.');
      return { ok: false };
    }
    setCloudSyncStatus('syncing');
    const res = await pullStateFromSupabase(cfgToUse);
    if (res.ok && res.payload) {
      skipNextAutoPushRef.current = true;
      handleImportBackup(res.payload);
      setCloudSyncStatus('synced');
      setSupabaseConfig(getSupabaseConfig());
      showToast('Dados atualizados a partir da nuvem! 📲☁️');
    } else if (res.ok && res.empty) {
      setCloudSyncStatus('idle');
      showToast('Nenhum dado encontrado para este Código do Casal ainda. Envie primeiro!');
    } else {
      setCloudSyncStatus('error');
      showToast('Erro ao buscar dados da nuvem.');
    }
    return res;
  };

  // Navegação de Mês na Sidebar garantindo sincronização de Salários e Primícias para qualquer mês passado ou futuro
  const handleNavigateMonth = (delta) => {
    setState((prev) => {
      const nextMonth = shiftYearMonth(prev.selectedMonth, delta);
      const nextState = {
        ...prev,
        selectedMonth: nextMonth
      };
      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, nextMonth)
      };
    });
  };

  const handleOpenNewTransaction = (type = 'expense', preselectedCardId = null) => {
    const chosenCard =
      (preselectedCardId && state.cards.find((c) => c.id === preselectedCardId)) ||
      state.cards[0] ||
      { id: 'card-inter', dueDay: 15, owner: 'partner1' };

    const isExpense = type === 'expense';

    setTxForm({
      title: '',
      type,
      category: type === 'income' ? 'extra' : 'mercado',
      amount: '',
      dueDate: isExpense
        ? buildSafeDueDate(state.selectedMonth, chosenCard.dueDay || 15)
        : `${state.selectedMonth}-05`,
      status: type === 'income' ? 'paid' : 'pending',
      owner: type === 'income' ? 'partner1' : 'joint',
      paidBy: chosenCard.owner === 'partner2' ? 'partner2' : 'partner1',
      paymentMethod: isExpense ? 'Cartão de Crédito' : 'PIX',
      cardId: isExpense ? chosenCard.id : '',
      propagateToPendingInstallments: false
    });
    setTxModal({ open: true, type, editingId: null, commitmentId: null });
    setFabOpen(false);
  };

  const handleOpenEditTransaction = (tx) => {
    if (!tx) return;
    setTxForm({
      title: tx.title || '',
      type: tx.type || 'expense',
      category: tx.category || (tx.type === 'income' ? 'extra' : 'outros'),
      amount: tx.amount ?? '',
      dueDate: tx.dueDate || `${state.selectedMonth}-10`,
      status: tx.status || 'pending',
      owner: tx.owner || 'joint',
      paidBy: tx.paidBy || 'partner1',
      paymentMethod: tx.paymentMethod || (tx.cardId ? 'Cartão de Crédito' : 'PIX'),
      cardId: tx.cardId || state.cards[0]?.id || '',
      propagateToPendingInstallments: Boolean(tx.commitmentId)
    });
    setTxModal({
      open: true,
      type: tx.type || 'expense',
      editingId: tx.id,
      commitmentId: tx.commitmentId || null
    });
  };

  const handleSelectCardInTxModal = (newCardId) => {
    const chosen = state.cards.find((c) => c.id === newCardId);
    if (!chosen) {
      setTxForm((prev) => ({ ...prev, cardId: newCardId }));
      return;
    }
    const ym = txForm.dueDate ? txForm.dueDate.slice(0, 7) : state.selectedMonth;
    const newDueDate = buildSafeDueDate(ym, chosen.dueDay || 15);
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
    const effectiveCardId =
      txForm.type === 'expense' && txForm.paymentMethod === 'Cartão de Crédito'
        ? txForm.cardId
        : '';

    if (txModal.editingId) {
      setState((prev) => {
        const originalTx = prev.transactions.find((t) => t.id === txModal.editingId);
        const commId = txModal.commitmentId;
        const shouldPropagate = Boolean(commId && txForm.propagateToPendingInstallments);

        const updatedTransactions = prev.transactions.map((t) => {
          if (t.id === txModal.editingId) {
            return {
              ...t,
              title: txForm.title.trim(),
              type: txForm.type,
              category: txForm.category,
              amount: amountNum,
              dueDate: txForm.dueDate,
              status: txForm.status,
              paidDate: txForm.status === 'paid' ? t.paidDate || txForm.dueDate : '',
              owner: txForm.owner,
              paidBy: txForm.paidBy,
              paymentMethod: txForm.paymentMethod,
              cardId: effectiveCardId
            };
          }
          if (shouldPropagate && t.commitmentId === commId && t.status === 'pending') {
            const ym = t.dueDate ? t.dueDate.slice(0, 7) : prev.selectedMonth;
            const nextDueDate =
              effectiveCardId && chosenCard
                ? buildSafeDueDate(ym, chosenCard.dueDay || 15)
                : t.dueDate;
            return {
              ...t,
              title: t.installmentNumber === 0 ? `${txForm.title.trim()} (Entrada)` : txForm.title.trim(),
              category: txForm.category,
              owner: txForm.owner,
              paidBy: txForm.paidBy,
              paymentMethod: txForm.paymentMethod,
              cardId: effectiveCardId,
              dueDate: nextDueDate
            };
          }
          return t;
        });

        let updatedCommitments = prev.commitments;
        if (commId) {
          const linked = updatedTransactions
            .filter((t) => t.commitmentId === commId)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          const newTotal = Number(
            linked.reduce((acc, t) => acc + Number(t.amount || 0), 0).toFixed(2)
          );
          const newEnd = linked.length > 0 ? linked[linked.length - 1].dueDate : undefined;

          updatedCommitments = prev.commitments.map((c) =>
            c.id === commId
              ? {
                  ...c,
                  ...(shouldPropagate
                    ? {
                        title: txForm.title.trim(),
                        category: txForm.category,
                        owner: txForm.owner,
                        paidBy: txForm.paidBy,
                        paymentMethod: txForm.paymentMethod,
                        cardId: effectiveCardId
                      }
                    : {}),
                  totalAmount: newTotal,
                  endDate: newEnd || c.endDate
                }
              : c
          );
        }

        // Se o usuário editou diretamente um Salário Mensal automático na tabela, sincronizar monthlyIncomes e recalcular Dízimo
        if (originalTx && isAutoSalaryTransaction(originalTx)) {
          const targetYm = (txForm.dueDate || originalTx.dueDate || prev.selectedMonth).slice(0, 7);
          const currentEff = getEffectiveMonthIncome(prev, targetYm);
          const isP2 = (txForm.owner || originalTx.owner) === 'partner2';
          const updatedMonthIncome = {
            partner1Income: isP2 ? currentEff.partner1Income : amountNum,
            partner2Income: isP2 ? amountNum : currentEff.partner2Income,
            donationAmount: currentEff.donationAmount
          };
          const nextState = {
            ...prev,
            couple:
              targetYm === prev.selectedMonth
                ? {
                    ...prev.couple,
                    ...(isP2 ? { partner2Income: amountNum } : { partner1Income: amountNum })
                  }
                : prev.couple,
            monthlyIncomes: {
              ...(prev.monthlyIncomes || {}),
              [targetYm]: updatedMonthIncome
            },
            transactions: updatedTransactions,
            commitments: updatedCommitments
          };
          return {
            ...nextState,
            transactions: syncMonthIncomeAndTitheTransactions(nextState, targetYm)
          };
        }

        return {
          ...prev,
          transactions: updatedTransactions,
          commitments: updatedCommitments
        };
      });

      setTxModal({ open: false, type: 'expense', editingId: null, commitmentId: null });
      showToast('Lançamento atualizado com sucesso! ✏️');
      return;
    }

    const { propagateToPendingInstallments, ...cleanForm } = txForm;
    const newTx = {
      id: `tx-${Date.now()}`,
      ...cleanForm,
      cardId: effectiveCardId,
      amount: amountNum,
      paidDate: txForm.status === 'paid' ? txForm.dueDate : ''
    };

    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTx]
    }));

    setTxModal({ open: false, type: 'expense', editingId: null, commitmentId: null });
    showToast(
      txForm.type === 'income'
        ? 'Receita registrada com sucesso!'
        : txForm.paymentMethod === 'Cartão de Crédito' && chosenCard
        ? `Gasto lançado na fatura do ${chosenCard.name}! 💳`
        : 'Despesa lançada com sucesso!'
    );
  };

  // Clonagem Automática de Contas Fixas do Mês Anterior (Luz, Água, Condomínio, Internet, Feira, etc.)
  const handleClonePreviousMonthFixedExpenses = () => {
    const targetYm = state.selectedMonth;
    const prevYm = shiftYearMonth(targetYm, -1);

    const isEligibleFixedExpense = (t) =>
      t.type === 'expense' &&
      t.category !== 'dizimo' &&
      !t.commitmentId &&
      t.installmentNumber !== 0 &&
      !String(t.id || '').startsWith('tx-goal-') &&
      (t.category === 'moradia' ||
        t.category === 'assinaturas' ||
        t.category === 'saude' ||
        t.paymentMethod !== 'Cartão de Crédito');

    // Search previous month first; if empty, fallback to reference month '2026-11'
    const candidateSourceTxs = state.transactions.filter(
      (t) => t.dueDate && t.dueDate.startsWith(prevYm) && isEligibleFixedExpense(t)
    );

    const sourceList =
      candidateSourceTxs.length > 0
        ? candidateSourceTxs
        : state.transactions.filter(
            (t) => t.dueDate && t.dueDate.startsWith('2026-11') && isEligibleFixedExpense(t)
          );

    const existingTitlesInTarget = new Set(
      state.transactions
        .filter((t) => t.dueDate && t.dueDate.startsWith(targetYm))
        .map((t) => (t.title || '').trim().toLowerCase())
    );

    const clonedTxs = [];
    sourceList.forEach((src, idx) => {
      const normalizedTitle = (src.title || '').trim().toLowerCase();
      if (!normalizedTitle || existingTitlesInTarget.has(normalizedTitle)) return;
      existingTitlesInTarget.add(normalizedTitle);

      const dayNum = Number(src.dueDate.slice(8, 10)) || 10;
      clonedTxs.push({
        id: `tx-clone-${targetYm}-${Date.now()}-${idx}`,
        title: src.title,
        type: 'expense',
        category: src.category,
        amount: Number(src.amount || 0),
        dueDate: buildSafeDueDate(targetYm, dayNum),
        paidDate: '',
        status: 'pending',
        owner: src.owner || 'joint',
        paidBy: src.paidBy || 'partner1',
        paymentMethod: src.paymentMethod || 'PIX',
        cardId: src.paymentMethod === 'Cartão de Crédito' ? src.cardId : ''
      });
    });

    if (clonedTxs.length === 0) {
      showToast(
        `Todas as contas fixas recorrentes já estão lançadas em ${getMonthLabel(targetYm)}! ✅`
      );
      return 0;
    }

    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, ...clonedTxs]
    }));
    showToast(
      `${clonedTxs.length} conta(s) fixa(s) clonada(s) para ${getMonthLabel(targetYm)} como Pendentes! ⚡`
    );
    return clonedTxs.length;
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
    const targetToConfirm = state.transactions.find((t) => t.id === txId);
    if (
      targetToConfirm &&
      !window.confirm(
        `Deseja realmente excluir o lançamento "${targetToConfirm.title}" (${formatCurrency(
          targetToConfirm.amount
        )})?`
      )
    ) {
      return;
    }

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

  // Extra Income (Aulas Particulares & Vendas) Handlers — Sincronizados automaticamente com Primícias na Agenda
  const handleAddExtraIncome = (itemData) => {
    const newItem = {
      id: `ext-${Date.now()}`,
      ...itemData
    };
    setState((prev) => {
      const nextExtraIncomes = [...(prev.extraIncomes || []), newItem];
      const targetYm = newItem.date ? newItem.date.slice(0, 7) : prev.selectedMonth;
      const nextState = {
        ...prev,
        extraIncomes: nextExtraIncomes
      };
      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, targetYm)
      };
    });
    showToast(
      itemData.type === 'class'
        ? 'Aula particular registrada na semana! 🎓'
        : 'Venda / ganho extra registrado com sucesso! 💰'
    );
  };

  const handleUpdateExtraIncome = (updatedItem) => {
    setState((prev) => {
      const oldItem = (prev.extraIncomes || []).find((i) => i.id === updatedItem.id);
      const oldYm = oldItem?.date ? oldItem.date.slice(0, 7) : prev.selectedMonth;
      const newYm = updatedItem.date ? updatedItem.date.slice(0, 7) : prev.selectedMonth;
      const nextExtraIncomes = (prev.extraIncomes || []).map((i) =>
        i.id === updatedItem.id ? { ...i, ...updatedItem } : i
      );
      let nextState = {
        ...prev,
        extraIncomes: nextExtraIncomes
      };
      nextState = {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, oldYm)
      };
      if (newYm !== oldYm) {
        nextState = {
          ...nextState,
          transactions: syncMonthIncomeAndTitheTransactions(nextState, newYm)
        };
      }
      return nextState;
    });
    showToast('Registro de renda extra atualizado com sucesso! ✨');
  };

  const handleToggleExtraIncomeStatus = (itemId) => {
    setState((prev) => {
      const targetItem = (prev.extraIncomes || []).find((i) => i.id === itemId);
      const targetYm = targetItem?.date ? targetItem.date.slice(0, 7) : prev.selectedMonth;
      const nextExtraIncomes = (prev.extraIncomes || []).map((i) =>
        i.id === itemId
          ? { ...i, status: i.status === 'received' ? 'pending' : 'received' }
          : i
      );
      const nextState = {
        ...prev,
        extraIncomes: nextExtraIncomes
      };
      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, targetYm)
      };
    });
    showToast('Status do recebimento e primícias atualizados!');
  };

  const handleDeleteExtraIncome = (itemId) => {
    setState((prev) => {
      const targetItem = (prev.extraIncomes || []).find((i) => i.id === itemId);
      const targetYm = targetItem?.date ? targetItem.date.slice(0, 7) : prev.selectedMonth;
      const nextExtraIncomes = (prev.extraIncomes || []).filter((i) => i.id !== itemId);
      const nextState = {
        ...prev,
        extraIncomes: nextExtraIncomes
      };
      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, targetYm)
      };
    });
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
    const targetComm = state.commitments.find((c) => c.id === commId);
    if (
      targetComm &&
      !window.confirm(
        `Deseja realmente excluir o compromisso "${targetComm.title}" e todas as suas parcelas vinculadas?`
      )
    ) {
      return;
    }

    setState((prev) => ({
      ...prev,
      commitments: prev.commitments.filter((c) => c.id !== commId),
      transactions: prev.transactions.filter((t) => t.commitmentId !== commId)
    }));
    showToast('Parcelamento e parcelas vinculadas excluídos.');
  };

  // Edição completa de Parcelamento / Conta Fixa existente
  const handleUpdateCommitment = (commId, updates) => {
    setState((prev) => {
      const targetCard =
        updates.paymentMethod === 'Cartão de Crédito'
          ? prev.cards.find((c) => c.id === updates.cardId)
          : null;
      const effectiveCardId =
        updates.paymentMethod === 'Cartão de Crédito' ? updates.cardId || '' : '';
      const newPendingInstallmentAmount =
        updates.pendingInstallmentAmount !== undefined &&
        Number(updates.pendingInstallmentAmount) > 0
          ? Number(updates.pendingInstallmentAmount)
          : null;

      const updatedTransactions = prev.transactions.map((t) => {
        if (t.commitmentId !== commId) return t;
        const isDownPayment = t.installmentNumber === 0;
        const isPending = t.status === 'pending';
        const ym = t.dueDate ? t.dueDate.slice(0, 7) : prev.selectedMonth;
        const nextDueDate =
          isPending && !isDownPayment && targetCard
            ? buildSafeDueDate(ym, targetCard.dueDay || 15)
            : t.dueDate;

        return {
          ...t,
          title: isDownPayment ? `${updates.title} (Entrada)` : updates.title,
          category: updates.category,
          owner: updates.owner,
          paidBy: isPending ? updates.paidBy : t.paidBy,
          paymentMethod: isDownPayment ? t.paymentMethod : updates.paymentMethod,
          cardId: isDownPayment ? '' : effectiveCardId,
          dueDate: nextDueDate,
          amount:
            isPending && !isDownPayment && newPendingInstallmentAmount !== null
              ? newPendingInstallmentAmount
              : t.amount
        };
      });

      const linkedAfter = updatedTransactions
        .filter((t) => t.commitmentId === commId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const newTotalAmount = Number(
        linkedAfter.reduce((acc, t) => acc + Number(t.amount || 0), 0).toFixed(2)
      );
      const newEndDate =
        linkedAfter.length > 0 ? linkedAfter[linkedAfter.length - 1].dueDate : undefined;

      const updatedCommitments = prev.commitments.map((c) =>
        c.id === commId
          ? {
              ...c,
              title: updates.title,
              category: updates.category,
              owner: updates.owner,
              paidBy: updates.paidBy,
              paymentMethod: updates.paymentMethod,
              cardId: effectiveCardId,
              notes: updates.notes ?? c.notes,
              totalAmount: newTotalAmount,
              endDate: newEndDate || c.endDate
            }
          : c
      );

      return {
        ...prev,
        commitments: updatedCommitments,
        transactions: updatedTransactions
      };
    });

    showToast(`Contrato "${updates.title}" e parcelas pendentes atualizados! ✏️`);
  };

  // Antecipação de Parcelas com Desconto (Estilo Nubank / Inter)
  const handleAnticipateInstallments = (
    commId,
    txIdsToAnticipate = [],
    discountAmount = 0,
    markAsPaid = true
  ) => {
    if (!commId || !Array.isArray(txIdsToAnticipate) || txIdsToAnticipate.length === 0) return;

    const cleanDiscount = Math.max(0, Number(discountAmount) || 0);
    const idSet = new Set(txIdsToAnticipate);

    setState((prev) => {
      const targetYm = prev.selectedMonth;
      const targetTxs = prev.transactions.filter(
        (t) => t.commitmentId === commId && idSet.has(t.id) && t.status === 'pending'
      );
      if (targetTxs.length === 0) return prev;

      const count = targetTxs.length;
      const baseDiscountPerTx =
        count > 0 ? Math.floor((cleanDiscount / count) * 100) / 100 : 0;
      let discountDistributedSoFar = 0;

      const discountMap = {};
      targetTxs.forEach((t, idx) => {
        const isLast = idx === count - 1;
        const disc = isLast
          ? Number((cleanDiscount - discountDistributedSoFar).toFixed(2))
          : baseDiscountPerTx;
        discountDistributedSoFar += disc;
        discountMap[t.id] = disc;
      });

      const updatedTransactions = prev.transactions.map((t) => {
        if (!idSet.has(t.id) || t.commitmentId !== commId || t.status !== 'pending') {
          return t;
        }
        const cardObj = prev.cards.find((c) => c.id === t.cardId);
        const dayToUse = cardObj?.dueDay || Number(t.dueDate?.slice(8, 10)) || 15;
        const newDueDate = buildSafeDueDate(targetYm, dayToUse);
        const disc = discountMap[t.id] || 0;
        const newAmount = Math.max(0.01, Number((Number(t.amount || 0) - disc).toFixed(2)));
        const suffix = t.title.includes('(Antecipada)') ? '' : ' (Antecipada)';

        return {
          ...t,
          title: `${t.title}${suffix}`,
          amount: newAmount,
          dueDate: newDueDate,
          status: markAsPaid ? 'paid' : 'pending',
          paidDate: markAsPaid ? newDueDate : ''
        };
      });

      const linkedAfter = updatedTransactions
        .filter((t) => t.commitmentId === commId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const newTotalAmount = Number(
        linkedAfter.reduce((acc, t) => acc + Number(t.amount || 0), 0).toFixed(2)
      );
      const newEndDate =
        linkedAfter.length > 0 ? linkedAfter[linkedAfter.length - 1].dueDate : undefined;

      const updatedCommitments = prev.commitments.map((c) =>
        c.id === commId
          ? {
              ...c,
              totalAmount: newTotalAmount,
              endDate: newEndDate || c.endDate
            }
          : c
      );

      return {
        ...prev,
        commitments: updatedCommitments,
        transactions: updatedTransactions
      };
    });

    showToast(
      cleanDiscount > 0
        ? `${txIdsToAnticipate.length} parcela(s) antecipada(s) com economia de ${formatCurrency(
            cleanDiscount
          )}! ⚡🎉`
        : `${txIdsToAnticipate.length} parcela(s) antecipada(s) para ${getMonthLabel(
            state.selectedMonth
          )}! ⚡`
    );
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
    const dueDayNum = Number(updatedCardData.dueDay) || 15;
    const newPaidBy =
      updatedCardData.owner === 'partner2'
        ? 'partner2'
        : updatedCardData.owner === 'partner1'
        ? 'partner1'
        : null;

    setState((prev) => {
      // 1. Update card
      const updatedCards = prev.cards.map((c) =>
        c.id === cardId ? { ...c, ...updatedCardData } : c
      );

      // 2. Update pending transactions linked to this card with safe month day clamping & updated paidBy
      const updatedTransactions = prev.transactions.map((t) => {
        if (t.cardId === cardId && t.status === 'pending' && t.dueDate) {
          const ym = t.dueDate.slice(0, 7);
          return {
            ...t,
            dueDate: buildSafeDueDate(ym, dueDayNum),
            paidBy: newPaidBy || t.paidBy
          };
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
              ? buildSafeDueDate(comm.endDate.slice(0, 7), dueDayNum)
              : comm.endDate;

          const newStartDate = comm.startDate
            ? buildSafeDueDate(comm.startDate.slice(0, 7), dueDayNum)
            : comm.startDate;

          return {
            ...comm,
            startDate: newStartDate,
            endDate: newEndDate,
            paidBy: newPaidBy || comm.paidBy
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
    showToast(`Cartão e datas de vencimento da fatura (dia ${dueDayNum}) atualizados!`);
  };

  const handleDeleteCard = (cardId) => {
    setState((prev) => {
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

  const handleDepositGoal = (goalId, depositVal, recordAsTransaction = false, paidBy = 'partner1') => {
    setState((prev) => {
      const targetGoal = prev.goals.find((g) => g.id === goalId);
      const updatedGoals = prev.goals.map((g) =>
        g.id === goalId
          ? { ...g, currentAmount: Number(g.currentAmount || 0) + depositVal }
          : g
      );

      let updatedTransactions = prev.transactions;
      if (recordAsTransaction && targetGoal) {
        const depositTx = {
          id: `tx-goal-${Date.now()}`,
          title: `Aporte na Caixinha: ${targetGoal.title}`,
          type: 'expense',
          category: 'viagens',
          amount: depositVal,
          dueDate: `${prev.selectedMonth}-10`,
          paidDate: `${prev.selectedMonth}-10`,
          status: 'paid',
          owner: 'joint',
          paidBy: paidBy || 'partner1',
          paymentMethod: 'PIX'
        };
        updatedTransactions = [...prev.transactions, depositTx];
      }

      return {
        ...prev,
        goals: updatedGoals,
        transactions: updatedTransactions
      };
    });
    showToast(
      recordAsTransaction
        ? `Aporte de ${formatCurrency(depositVal)} guardado na Caixinha e registrado no mês! 🎉`
        : `Aporte de ${formatCurrency(depositVal)} guardado na Caixinha! 🎉`
    );
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

      const nextState = {
        ...prev,
        monthlyIncomes: updatedMonthlyIncomes
      };

      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, ym)
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

  const handleResetChecklist = () => {
    setState((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).map((c) => ({ ...c, done: false }))
    }));
    showToast('Checklist reiniciado para a nova rotina mensal! ✨');
  };

  // Liquidação do Acerto Mensal do Casal com 1 Clique
  const handleSettleMonthSplit = (yearMonth, settlementPayload) => {
    const ym = yearMonth || state.selectedMonth;
    const todayIso = new Date().toISOString().slice(0, 10);

    setState((prev) => {
      const updatedSettlements = {
        ...(prev.monthlySettlements || {}),
        [ym]: {
          settled: true,
          settledAt: todayIso,
          ...settlementPayload
        }
      };

      // Marca automaticamente a tarefa de fechamento/acerto no Checklist do Mês
      const updatedChecklist = (prev.checklist || []).map((item) => {
        const lower = (item.title || '').toLowerCase();
        if (lower.includes('acerto') || lower.includes('fechamento') || item.id === 'chk-8') {
          return { ...item, done: true };
        }
        return item;
      });

      return {
        ...prev,
        monthlySettlements: updatedSettlements,
        checklist: updatedChecklist
      };
    });

    showToast(`Acerto do casal de ${getMonthLabel(ym)} confirmado e marcado no Checklist! 🤝✨`);
  };

  const handleReopenMonthSplit = (yearMonth) => {
    const ym = yearMonth || state.selectedMonth;
    setState((prev) => {
      const nextSettlements = { ...(prev.monthlySettlements || {}) };
      delete nextSettlements[ym];
      return {
        ...prev,
        monthlySettlements: nextSettlements
      };
    });
    showToast(`Acerto de ${getMonthLabel(ym)} reaberto para ajustes.`);
  };

  const handleUpdateCoupleSettings = (updates) => {
    setState((prev) => {
      const ym = prev.selectedMonth;
      const hasIncomeOrDonationUpdate =
        updates.partner1Income !== undefined ||
        updates.partner2Income !== undefined ||
        updates.donationAmount !== undefined;

      const updatedMonthlyIncomes =
        hasIncomeOrDonationUpdate && prev.monthlyIncomes?.[ym]
          ? {
              ...prev.monthlyIncomes,
              [ym]: {
                ...prev.monthlyIncomes[ym],
                ...(updates.partner1Income !== undefined
                  ? { partner1Income: Number(updates.partner1Income) }
                  : {}),
                ...(updates.partner2Income !== undefined
                  ? { partner2Income: Number(updates.partner2Income) }
                  : {}),
                ...(updates.donationAmount !== undefined
                  ? { donationAmount: Number(updates.donationAmount) }
                  : {})
              }
            }
          : prev.monthlyIncomes;

      const nextState = {
        ...prev,
        couple: {
          ...prev.couple,
          ...updates
        },
        monthlyIncomes: updatedMonthlyIncomes
      };
      return {
        ...nextState,
        transactions: syncMonthIncomeAndTitheTransactions(nextState, ym)
      };
    });
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
    try {
      if (!parsedState || typeof parsedState !== 'object') {
        alert('Arquivo de backup inválido.');
        return;
      }

      const mapCardId = (cid) => {
        if (!cid) return '';
        if (cid === 'card-2') return 'card-inter';
        if (cid === 'card-1' || cid === 'card-3') return 'card-nubank';
        return cid;
      };

      const sanitizedCards = Array.isArray(parsedState.cards) && parsedState.cards.length > 0
        ? parsedState.cards
        : INITIAL_STATE.cards;

      const sanitizedTransactions = Array.isArray(parsedState.transactions)
        ? parsedState.transactions.map((t) => ({ ...t, cardId: mapCardId(t.cardId) }))
        : INITIAL_STATE.transactions;

      const sanitizedCommitments = Array.isArray(parsedState.commitments)
        ? parsedState.commitments.map((c) => ({ ...c, cardId: mapCardId(c.cardId) }))
        : INITIAL_STATE.commitments;

      const importedBase = {
        ...INITIAL_STATE,
        ...parsedState,
        version: '1.5.0',
        cards: sanitizedCards,
        transactions: sanitizedTransactions,
        commitments: sanitizedCommitments,
        couple: {
          ...INITIAL_STATE.couple,
          ...(parsedState.couple || {})
        }
      };

      setState({
        ...importedBase,
        transactions: syncMonthIncomeAndTitheTransactions(
          importedBase,
          importedBase.selectedMonth || '2026-11'
        )
      });
      showToast('Backup JSON restaurado com sucesso! ✨');
    } catch (err) {
      console.error('Erro na importação de backup:', err);
      alert('Falha ao processar arquivo de backup.');
    }
  };

  const handleResetToDemo = () => {
    if (
      window.confirm(
        'Tem certeza de que deseja restaurar os dados de demonstração? Todas as suas alterações, contas, metas e rendas cadastradas serão substituídas pelo modelo inicial.'
      )
    ) {
      setState({
        ...INITIAL_STATE,
        transactions: syncMonthIncomeAndTitheTransactions(
          INITIAL_STATE,
          INITIAL_STATE.selectedMonth || '2026-11'
        )
      });
      showToast('Dados de demonstração restaurados!');
    }
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
            onClick={() => handleNavigateMonth(-1)}
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
            onClick={() => handleNavigateMonth(1)}
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
            {isSupabaseConfigured(supabaseConfig) && (
              <button
                className="btn btn-sm btn-outline"
                style={{ gap: '6px' }}
                title="Status da Sincronização em Nuvem (Supabase). Clique para buscar atualizações."
                onClick={() => handlePullFromCloud()}
              >
                <i
                  className={`fa-solid ${
                    cloudSyncStatus === 'syncing'
                      ? 'fa-arrows-rotate fa-spin'
                      : cloudSyncStatus === 'error'
                      ? 'fa-triangle-exclamation text-amber'
                      : 'fa-cloud-check text-emerald'
                  }`}
                ></i>{' '}
                <span>
                  {cloudSyncStatus === 'syncing'
                    ? 'Sincronizando...'
                    : cloudSyncStatus === 'error'
                    ? 'Erro Nuvem'
                    : 'Nuvem Ativa'}
                </span>
              </button>
            )}
            <button
              className="btn btn-sm btn-outline"
              style={{ gap: '6px' }}
              title="Gerar Relatório de Fechamento Mensal ou Anual em PDF / Impressão"
              onClick={() => setIsReportModalOpen(true)}
            >
              <i className="fa-solid fa-file-pdf text-emerald"></i> Relatório PDF
            </button>
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
            onOpenReportModal={() => setIsReportModalOpen(true)}
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
            onUpdateCommitment={handleUpdateCommitment}
            onAnticipateInstallments={handleAnticipateInstallments}
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
            onOpenEditTransaction={handleOpenEditTransaction}
            onClonePreviousMonthFixedExpenses={handleClonePreviousMonthFixedExpenses}
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
            onResetChecklist={handleResetChecklist}
          />
        )}

        {activeRoute === 'couple' && (
          <CoupleSplitView
            state={state}
            onUpdateCoupleSettings={handleUpdateCoupleSettings}
            onOpenMonthIncomeModal={openMonthIncomeModal}
            onSettleMonthSplit={handleSettleMonthSplit}
            onReopenMonthSplit={handleReopenMonthSplit}
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
            supabaseConfig={supabaseConfig}
            cloudSyncStatus={cloudSyncStatus}
            onSaveSupabaseConfig={handleSaveSupabaseConfig}
            onPushToCloud={handlePushToCloud}
            onPullFromCloud={handlePullFromCloud}
            onInstallPwa={handleInstallPwa}
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

      {/* MODAL GLOBAL: NOVA OU EDITAR DESPESA / RECEITA AVULSA */}
      {txModal.open && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setTxModal({ open: false, type: 'expense', editingId: null, commitmentId: null })
          }
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i
                  className={`fa-solid ${
                    txModal.editingId
                      ? 'fa-pen-to-square text-emerald'
                      : txForm.type === 'income'
                      ? 'fa-arrow-trend-up text-emerald'
                      : 'fa-credit-card'
                  }`}
                ></i>{' '}
                {txModal.editingId
                  ? 'Editar Lançamento Existente'
                  : txForm.type === 'income'
                  ? 'Nova Receita / Entrada no Mês'
                  : 'Cadastrar Gasto (Cartão de Crédito / Pix)'}
              </h3>
              <button
                className="close-btn"
                onClick={() =>
                  setTxModal({ open: false, type: 'expense', editingId: null, commitmentId: null })
                }
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

              {txModal.editingId && txModal.commitmentId && (
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label className="checkbox-label" htmlFor="tx-propagate-comm">
                    <input
                      id="tx-propagate-comm"
                      type="checkbox"
                      checked={Boolean(txForm.propagateToPendingInstallments)}
                      onChange={(e) =>
                        setTxForm({
                          ...txForm,
                          propagateToPendingInstallments: e.target.checked
                        })
                      }
                    />
                    <span>
                      Propagar descrição, categoria, cartão e divisão para as demais parcelas
                      pendentes deste parcelamento
                    </span>
                  </label>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    setTxModal({
                      open: false,
                      type: 'expense',
                      editingId: null,
                      commitmentId: null
                    })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i>{' '}
                  {txModal.editingId ? 'Salvar Alterações' : 'Salvar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CENTRAL DE RELATÓRIOS MENSAL E ANUAL (PDF / IMPRESSÃO) */}
      {isReportModalOpen && (
        <ReportPrintModal state={state} onClose={() => setIsReportModalOpen(false)} />
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
                  ? monthExtras
                      .filter(
                        (i) =>
                          i.owner === 'partner1' &&
                          i.status === 'received' &&
                          i.applyTitheAndOffering !== false
                      )
                      .reduce((a, i) => a + Number(i.amount || 0), 0)
                  : 0;
                const p2Extra = state.couple.includeExtraInTithe
                  ? monthExtras
                      .filter(
                        (i) =>
                          i.owner === 'partner2' &&
                          i.status === 'received' &&
                          i.applyTitheAndOffering !== false
                      )
                      .reduce((a, i) => a + Number(i.amount || 0), 0)
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
