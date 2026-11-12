import React, { useState } from 'react';
import { formatCurrency, formatDateBR } from '../utils/formatters';

export default function GoalsAndChecklistView({
  state,
  onAddGoal,
  onDepositGoal,
  onDeleteGoal,
  onToggleChecklist,
  onAddChecklistItem,
  onDeleteChecklistItem
}) {
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
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

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalForm.title.trim() || Number(goalForm.targetAmount) <= 0) return;
    onAddGoal({
      ...goalForm,
      targetAmount: Number(goalForm.targetAmount),
      currentAmount: Number(goalForm.currentAmount) || 0
    });
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
    setIsNewGoalOpen(false);
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
            Transformem os sonhos da vida de casados em metas claras com barra de progresso e rotina
            financeira organizada!
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsNewGoalOpen(true)}>
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
                <button
                  className="icon-btn danger"
                  title="Excluir Meta"
                  onClick={() => onDeleteGoal(goal.id)}
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
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

      {/* CHECKLIST FINANCEIRO DO MÊS (ESTILO PLANEJEI!) */}
      <div className="card">
        <div className="card-header flex-between">
          <div>
            <h3>
              <i className="fa-solid fa-list-check"></i> Checklist de Rotina Financeira do Mês
            </h3>
            <p className="card-subtitle">
              Hábitos simples em casal para manter as contas 100% em dia todos os meses
            </p>
          </div>
          <span className="badge-pill badge-emerald">
            {checklistDoneCount}/{checklist.length} concluídas ({checklistPct}%)
          </span>
        </div>

        <div className="checklist-groups-grid">
          {checklistGroups.map((groupName) => {
            const items = checklist.filter((i) => i.group === groupName);
            const doneInGroup = items.filter((i) => i.done).length;
            const groupPct = items.length > 0 ? Math.round((doneInGroup / items.length) * 100) : 0;
            const draft = newTaskByGroup[groupName] || '';

            return (
              <div key={groupName} className="checklist-group-box">
                <div className="checklist-group-header">
                  <strong>{groupName}</strong>
                  <span>{groupPct}%</span>
                </div>
                <div className="progress-bar-track sm" style={{ marginBottom: '12px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${groupPct}%` }}
                  />
                </div>

                <div className="checklist-items-list">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`checklist-item-row ${item.done ? 'done' : ''}`}
                    >
                      <label className="chk-label">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => onToggleChecklist(item.id)}
                        />
                        <span>{item.title}</span>
                      </label>
                      <div className="chk-right">
                        <small className="chk-deadline">{item.deadlineLabel}</small>
                        <button
                          className="icon-btn-xs"
                          onClick={() => onDeleteChecklistItem(item.id)}
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="checklist-inline-add">
                  <input
                    type="text"
                    placeholder="Nova tarefa nesta etapa..."
                    value={draft}
                    onChange={(e) =>
                      setNewTaskByGroup({ ...newTaskByGroup, [groupName]: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) {
                        onAddChecklistItem(groupName, draft.trim());
                        setNewTaskByGroup({ ...newTaskByGroup, [groupName]: '' });
                      }
                    }}
                  />
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      if (!draft.trim()) return;
                      onAddChecklistItem(groupName, draft.trim());
                      setNewTaskByGroup({ ...newTaskByGroup, [groupName]: '' });
                    }}
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL APORTE NA CAIXINHA */}
      {depositModalGoal && (
        <div className="modal-backdrop" onClick={() => setDepositModalGoal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-piggy-bank"></i> Guardar na Caixinha: {depositModalGoal.title}
              </h3>
              <button className="close-btn" onClick={() => setDepositModalGoal(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleDepositSubmit} className="modal-body">
              <div className="summary-strip-box">
                <div>
                  <small>Saldo Atual Guardado</small>
                  <strong className="text-emerald">
                    {formatCurrency(depositModalGoal.currentAmount)}
                  </strong>
                </div>
                <div>
                  <small>Meta Final</small>
                  <strong>{formatCurrency(depositModalGoal.targetAmount)}</strong>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="dep-val">Valor do Novo Aporte (R$) *</label>
                <input
                  id="dep-val"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Ex: 500.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
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
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA META */}
      {isNewGoalOpen && (
        <div className="modal-backdrop" onClick={() => setIsNewGoalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-bullseye"></i> Criar Nova Meta / Caixinha
              </h3>
              <button className="close-btn" onClick={() => setIsNewGoalOpen(false)}>
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
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsNewGoalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Caixinha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

