import React, { useState } from 'react';
import { formatCurrency, formatDateBR } from '../utils/formatters';

export default function GoalsAndChecklistView({
  state,
  onAddGoal,
  onUpdateGoal,
  onDepositGoal,
  onDeleteGoal,
  onToggleChecklist,
  onAddChecklistItem,
  onDeleteChecklistItem,
  onResetChecklist
}) {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [depositModalGoal, setDepositModalGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');

  const [goalForm, setGoalForm] = useState({
    title: '',
    category: 'Viagens & Sonhos',
    icon: 'fa-piggy-bank',
    targetAmount: '',
    currentAmount: '',
    deadline: '2027-06-30',
    color: '#10b981',
    notes: ''
  });

  const [newTaskByGroup, setNewTaskByGroup] = useState({});

  const { goals, checklist } = state;

  const handleDeleteGoalClick = (goal) => {
    if (
      window.confirm(
        `Deseja realmente excluir a caixinha "${goal.title}"? O saldo guardado de ${formatCurrency(
          goal.currentAmount
        )} será removido.`
      )
    ) {
      onDeleteGoal(goal.id);
    }
  };

  const handleResetChecklistClick = () => {
    if (
      window.confirm(
        'Deseja desmarcar todas as tarefas concluídas para iniciar a rotina do novo mês?'
      )
    ) {
      if (onResetChecklist) {
        onResetChecklist();
      }
    }
  };

  const totalTargetAll = goals.reduce((acc, g) => acc + Number(g.targetAmount || 0), 0);
  const totalSavedAll = goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0);
  const overallGoalsPct =
    totalTargetAll > 0 ? Math.min(100, Math.round((totalSavedAll / totalTargetAll) * 100)) : 0;

  const checklistDoneCount = checklist.filter((c) => c.done).length;
  const checklistPct =
    checklist.length > 0 ? Math.round((checklistDoneCount / checklist.length) * 100) : 0;

  const checklistGroups = [
    'Início do Mês (Dia 01 a 10)',
    'Meio do Mês (Dia 11 a 20)',
    'Fechamento & Revisão do Casal (Dia 21 a 30)'
  ];

  const openNewGoalModal = () => {
    setEditingGoalId(null);
    setGoalForm({
      title: '',
      category: 'Viagens & Sonhos',
      icon: 'fa-piggy-bank',
      targetAmount: '',
      currentAmount: '',
      deadline: '2027-06-30',
      color: '#10b981',
      notes: ''
    });
    setIsGoalModalOpen(true);
  };

  const openEditGoalModal = (goal) => {
    setEditingGoalId(goal.id);
    setGoalForm({
      title: goal.title || '',
      category: goal.category || 'Geral',
      icon: goal.icon || 'fa-bullseye',
      targetAmount: goal.targetAmount || '',
      currentAmount: goal.currentAmount ?? '',
      deadline: goal.deadline || '',
      color: goal.color || '#10b981',
      notes: goal.notes || ''
    });
    setIsGoalModalOpen(true);
  };

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalForm.title.trim() || Number(goalForm.targetAmount) <= 0) return;

    const payload = {
      ...goalForm,
      targetAmount: Number(goalForm.targetAmount),
      currentAmount: Number(goalForm.currentAmount) || 0
    };

    if (editingGoalId) {
      if (onUpdateGoal) {
        onUpdateGoal(editingGoalId, payload);
      }
    } else {
      onAddGoal(payload);
    }

    setIsGoalModalOpen(false);
    setEditingGoalId(null);
  };

  const handleDepositSubmit = (e) => {
    e.preventDefault();
    const val = Number(depositAmount);
    if (!depositModalGoal || val <= 0) return;
    onDepositGoal(depositModalGoal.id, val);
    setDepositAmount('');
    setDepositModalGoal(null);
  };

  return (
    <div className="view-container">
      {/* HEADER */}
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-bullseye"></i> Metas, Caixinhas &amp; Checklist Mensal
          </h2>
          <p>
            Transformem os sonhos da vida de casados em metas claras com barra de progresso, rotina
            organizada e total liberdade para editar seus objetivos!
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewGoalModal}>
          <i className="fa-solid fa-plus"></i> + Nova Meta / Caixinha
        </button>
      </div>

      {/* BARRA DE PATRIMÔNIO ACUMULADO NAS CAIXINHAS */}
      <div className="card progress-hero-card">
        <div className="progress-hero-top">
          <div>
            <span className="badge-pill badge-emerald">
              <i className="fa-solid fa-vault"></i> Patrimônio Guardado nas Caixinhas
            </span>
            <h3 className="progress-motivation">
              Vocês já acumularam <strong>{formatCurrency(totalSavedAll)}</strong> para os seus
              objetivos! ({overallGoalsPct}% da meta global)
            </h3>
          </div>
          <div className="big-pct">{overallGoalsPct}%</div>
        </div>
        <div className="progress-bar-track lg">
          <div
            className="progress-bar-fill"
            style={{ width: `${overallGoalsPct}%` }}
          />
        </div>
        <div className="progress-hero-footer">
          <span>Total Já Guardado: <strong>{formatCurrency(totalSavedAll)}</strong></span>
          <span>Meta Global Somada: <strong>{formatCurrency(totalTargetAll)}</strong></span>
        </div>
      </div>

      {/* GRID DE CAIXINHAS / METAS */}
      <div className="goals-grid">
        {goals.map((goal) => {
          const pct =
            goal.targetAmount > 0
              ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
              : 0;
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div key={goal.id} className="goal-card card">
              <div className="goal-top">
                <div className="goal-title-wrap">
                  <span
                    className="goal-icon"
                    style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                  >
                    <i className={`fa-solid ${goal.icon || 'fa-piggy-bank'}`}></i>
                  </span>
                  <div>
                    <span className="goal-cat-tag">{goal.category}</span>
                    <h4>{goal.title}</h4>
                  </div>
                </div>
                <div className="goal-top-actions">
                  <button
                    className="icon-btn"
                    title="Editar Meta / Caixinha"
                    onClick={() => openEditGoalModal(goal)}
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Excluir Meta"
                    onClick={() => handleDeleteGoalClick(goal)}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              <p className="goal-notes">{goal.notes || 'Objetivo financeiro do casal'}</p>

              <div className="goal-numbers">
                <div>
                  <small>Guardado</small>
                  <strong className="text-emerald">{formatCurrency(goal.currentAmount)}</strong>
                </div>
                <div>
                  <small>Meta Total</small>
                  <strong>{formatCurrency(goal.targetAmount)}</strong>
                </div>
                <div>
                  <small>Falta</small>
                  <strong className="text-amber">{formatCurrency(remaining)}</strong>
                </div>
              </div>

              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${pct}%`, backgroundColor: goal.color }}
                />
              </div>

              <div className="goal-footer">
                <small>
                  <i className="fa-regular fa-calendar"></i> Prazo: {formatDateBR(goal.deadline)} ({pct}%)
                </small>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setDepositModalGoal(goal)}
                >
                  <i className="fa-solid fa-coins"></i> + Guardar Valor
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHECKLIST FINANCEIRO DO MÊS */}
      <div className="card">
        <div className="card-header flex-between wrap" style={{ gap: '12px' }}>
          <div>
            <h3>
              <i className="fa-solid fa-list-check"></i> Checklist de Rotina Financeira do Mês
            </h3>
            <p className="card-subtitle">
              Passo a passo mensal do casal para manter as contas em dia e sem atritos
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {checklistDoneCount > 0 && onResetChecklist && (
              <button
                className="btn btn-sm btn-soft"
                title="Desmarcar todas as tarefas para o novo mês"
                onClick={handleResetChecklistClick}
              >
                <i className="fa-solid fa-rotate-left"></i> Reiniciar Checklist
              </button>
            )}
            <div className="checklist-progress-badge">
              <strong>{checklistDoneCount}/{checklist.length} concluídos ({checklistPct}%)</strong>
            </div>
          </div>
        </div>

        <div className="checklist-groups-wrap">
          {checklistGroups.map((group) => {
            const items = checklist.filter((c) => c.group === group);
            return (
              <div key={group} className="chk-group-box">
                <h4 className="chk-group-title">
                  <i className="fa-solid fa-clock-rotate-left"></i> {group}
                </h4>
                <div className="chk-items-list">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`chk-item-row ${item.done ? 'done' : ''}`}
                    >
                      <label className="chk-checkbox-label">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => onToggleChecklist(item.id)}
                        />
                        <span className="chk-custom-box">
                          <i className="fa-solid fa-check"></i>
                        </span>
                        <div className="chk-text-wrap">
                          <span className="chk-title">{item.title}</span>
                          <small className="chk-sub">{item.deadlineLabel}</small>
                        </div>
                      </label>
                      <button
                        className="btn-delete-chk"
                        title="Remover item da lista"
                        onClick={() => onDeleteChecklistItem(item.id)}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Nenhuma tarefa neste bloco.
                    </p>
                  )}
                </div>

                <div className="add-chk-row">
                  <input
                    type="text"
                    placeholder={`+ Adicionar tarefa em "${group}"...`}
                    value={newTaskByGroup[group] || ''}
                    onChange={(e) =>
                      setNewTaskByGroup({ ...newTaskByGroup, [group]: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskByGroup[group]?.trim()) {
                        onAddChecklistItem(group, newTaskByGroup[group].trim());
                        setNewTaskByGroup({ ...newTaskByGroup, [group]: '' });
                      }
                    }}
                  />
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      if (newTaskByGroup[group]?.trim()) {
                        onAddChecklistItem(group, newTaskByGroup[group].trim());
                        setNewTaskByGroup({ ...newTaskByGroup, [group]: '' });
                      }
                    }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: GUARDAR VALOR NA CAIXINHA */}
      {depositModalGoal && (
        <div className="modal-backdrop" onClick={() => setDepositModalGoal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-coins text-emerald"></i> Guardar Valor na Caixinha: {depositModalGoal.title}
              </h3>
              <button className="close-btn" onClick={() => setDepositModalGoal(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleDepositSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="dep-amount">Quanto você quer guardar agora? (R$) *</label>
                <input
                  id="dep-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ex: 500.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="installment-plan-box">
                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                  Saldo atual guardado: <strong>{formatCurrency(depositModalGoal.currentAmount)}</strong>
                </small>
                {Number(depositAmount) > 0 && (
                  <small style={{ display: 'block', marginTop: '4px', color: 'var(--primary)', fontWeight: 700 }}>
                    Novo saldo após aporte: {formatCurrency(Number(depositModalGoal.currentAmount) + Number(depositAmount))}
                  </small>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setDepositModalGoal(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i> Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR META / CAIXINHA */}
      {isGoalModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsGoalModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-bullseye"></i>{' '}
                {editingGoalId ? 'Editar Meta / Caixinha' : 'Criar Nova Meta / Caixinha'}
              </h3>
              <button className="close-btn" onClick={() => setIsGoalModalOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleGoalSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="g-title">Título do Objetivo *</label>
                <input
                  id="g-title"
                  type="text"
                  required
                  placeholder="Ex: Reserva de Emergência, Reforma da Cozinha, Viagem..."
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="g-target">Valor da Meta (R$) *</label>
                  <input
                    id="g-target"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Ex: 10000"
                    value={goalForm.targetAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="g-curr">Valor Já Guardado (R$)</label>
                  <input
                    id="g-curr"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 1500"
                    value={goalForm.currentAmount}
                    onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="g-dead">Prazo Desejado</label>
                  <input
                    id="g-dead"
                    type="date"
                    value={goalForm.deadline}
                    onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="g-cat">Categoria</label>
                  <input
                    id="g-cat"
                    type="text"
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="g-color">Cor da Barra de Progresso</label>
                  <input
                    id="g-color"
                    type="color"
                    value={goalForm.color}
                    onChange={(e) => setGoalForm({ ...goalForm, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="g-notes">Observações / Estratégia</label>
                  <input
                    id="g-notes"
                    type="text"
                    placeholder="Ex: Aplicar no CDB 100% CDI..."
                    value={goalForm.notes}
                    onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsGoalModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-check"></i>{' '}
                  {editingGoalId ? 'Salvar Alterações da Meta' : 'Criar Caixinha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
