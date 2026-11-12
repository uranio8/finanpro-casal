import React, { useState } from 'react';
import { CATEGORIES, THEMES } from '../data/initialState';
import { formatCurrency } from '../utils/formatters';

export default function SettingsView({
  state,
  onUpdateCoupleSettings,
  onUpdateCategoryBudgets,
  onExportBackup,
  onImportBackup,
  onResetToDemo
}) {
  const { couple, categoryBudgets } = state;

  const [coupleForm, setCoupleForm] = useState({
    partner1Name: couple.partner1Name || 'Wesley',
    partner2Name: couple.partner2Name || 'Beatriz',
    partner1Income: couple.partner1Income ?? 6500,
    partner2Income: couple.partner2Income ?? 5500,
    titheEnabled: couple.titheEnabled ?? true,
    tithePercent: couple.tithePercent ?? 10,
    partner1OfferingPercent: couple.partner1OfferingPercent ?? 5,
    partner2OfferingPercent: couple.partner2OfferingPercent ?? 5,
    includeExtraInTithe: couple.includeExtraInTithe ?? true,
    monthlySavingsTarget: couple.monthlySavingsTarget ?? 2500,
    splitMode: couple.splitMode || 'proportional'
  });

  const [budgetsForm, setBudgetsForm] = useState({ ...categoryBudgets });

  const p1Sal = Number(coupleForm.partner1Income || 0);
  const p2Sal = Number(coupleForm.partner2Income || 0);
  const totalIncome = p1Sal + p2Sal;

  const tithePct = coupleForm.titheEnabled ? Number(coupleForm.tithePercent ?? 10) : 0;
  const p1OffPct = coupleForm.titheEnabled ? Number(coupleForm.partner1OfferingPercent ?? 0) : 0;
  const p2OffPct = coupleForm.titheEnabled ? Number(coupleForm.partner2OfferingPercent ?? 0) : 0;

  const p1Tithe = (p1Sal * tithePct) / 100;
  const p1Offering = (p1Sal * p1OffPct) / 100;
  const p2Tithe = (p2Sal * tithePct) / 100;
  const p2Offering = (p2Sal * p2OffPct) / 100;
  const totalChurchFromSalary = p1Tithe + p1Offering + p2Tithe + p2Offering;

  const totalBudgetAllocated = Object.values(budgetsForm).reduce(
    (acc, v) => acc + Number(v || 0),
    0
  );
  const allocationPct =
    totalIncome > 0 ? Math.round((totalBudgetAllocated / totalIncome) * 100) : 0;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    onUpdateCoupleSettings({
      ...coupleForm,
      partner1Income: Number(coupleForm.partner1Income) || 0,
      partner2Income: Number(coupleForm.partner2Income) || 0,
      tithePercent: Number(coupleForm.tithePercent) || 10,
      partner1OfferingPercent: Number(coupleForm.partner1OfferingPercent) || 0,
      partner2OfferingPercent: Number(coupleForm.partner2OfferingPercent) || 0,
      monthlySavingsTarget: Number(coupleForm.monthlySavingsTarget) || 0
    });
  };

  const handleSaveBudgets = (e) => {
    e.preventDefault();
    const cleaned = {};
    Object.keys(budgetsForm).forEach((k) => {
      cleaned[k] = Number(budgetsForm[k]) || 0;
    });
    onUpdateCategoryBudgets(cleaned);
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        onImportBackup(parsed);
      } catch (err) {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="view-container">
      <div className="section-header card">
        <div>
          <h2>
            <i className="fa-solid fa-sliders"></i> Configurações: Rendas, Dízimo/Ofertas &amp; Temas
          </h2>
          <p>
            Configure os salários do casal, a porcentagem direcionada às ofertas (além do Dízimo de
            10%), o tema visual e os tetos de gastos.
          </p>
        </div>
      </div>

      {/* SELETOR DE TEMAS VISUAIS */}
      <div className="card">
        <div className="card-header">
          <h3>
            <i className="fa-solid fa-palette"></i> Seletor de Temas Visuais
          </h3>
          <p className="card-subtitle">
            Alterne instantaneamente a identidade visual do FinanPro
          </p>
        </div>
        <div className="themes-grid">
          {THEMES.map((theme) => {
            const isActive = couple.theme === theme.id;
            return (
              <div
                key={theme.id}
                className={`theme-option-card ${isActive ? 'active' : ''}`}
                onClick={() => onUpdateCoupleSettings({ theme: theme.id })}
              >
                <div className="theme-swatches">
                  <span style={{ backgroundColor: theme.primary }} />
                  <span style={{ backgroundColor: theme.accent }} />
                  <span style={{ backgroundColor: theme.bg, border: '1px solid #cbd5e1' }} />
                </div>
                <strong>{theme.name}</strong>
                <small>{theme.subtitle}</small>
                {isActive && (
                  <span className="theme-active-badge">
                    <i className="fa-solid fa-check"></i> Ativo
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="charts-grid-2">
        {/* PERFIL DO CASAL, SALÁRIOS & DÍZIMO / OFERTAS */}
        <div className="card">
          <div className="card-header">
            <h3>
              <i className="fa-solid fa-hands-praying"></i> Salários, Dízimo (10%) &amp; Oferta Mensal
            </h3>
            <p className="card-subtitle">
              Defina os salários e o percentual de oferta mensal de cada um
            </p>
          </div>
          <form onSubmit={handleSaveProfile} className="settings-form">
            {/* PESSOA 1 */}
            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="p1-name">Nome — Marido</label>
                <input
                  id="p1-name"
                  type="text"
                  value={coupleForm.partner1Name}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, partner1Name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="p1-inc">Salário de {coupleForm.partner1Name} (R$)</label>
                <input
                  id="p1-inc"
                  type="number"
                  step="0.01"
                  value={coupleForm.partner1Income}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, partner1Income: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="p1-off">% de Oferta ({coupleForm.partner1Name})</label>
                <input
                  id="p1-off"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={coupleForm.partner1OfferingPercent}
                  onChange={(e) =>
                    setCoupleForm({
                      ...coupleForm,
                      partner1OfferingPercent: e.target.value
                    })
                  }
                />
              </div>
            </div>

            {/* PESSOA 2 */}
            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="p2-name">Nome — Esposa</label>
                <input
                  id="p2-name"
                  type="text"
                  value={coupleForm.partner2Name}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, partner2Name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="p2-inc">Salário de {coupleForm.partner2Name} (R$)</label>
                <input
                  id="p2-inc"
                  type="number"
                  step="0.01"
                  value={coupleForm.partner2Income}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, partner2Income: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="p2-off">% de Oferta ({coupleForm.partner2Name})</label>
                <input
                  id="p2-off"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={coupleForm.partner2OfferingPercent}
                  onChange={(e) =>
                    setCoupleForm({
                      ...coupleForm,
                      partner2OfferingPercent: e.target.value
                    })
                  }
                />
              </div>
            </div>

            {/* BOX DE SIMULAÇÃO AO VIVO DO DÍZIMO E OFERTAS */}
            <div className="installment-plan-box">
              <div className="flex-between wrap" style={{ marginBottom: '10px' }}>
                <strong>
                  <i className="fa-solid fa-church text-emerald"></i> Cálculo Automático das Primícias
                  (Dízimo 10% + Oferta)
                </strong>
                <label className="checkbox-inline" htmlFor="chk-extra-tithe">
                  <input
                    id="chk-extra-tithe"
                    type="checkbox"
                    checked={coupleForm.includeExtraInTithe}
                    onChange={(e) =>
                      setCoupleForm({
                        ...coupleForm,
                        includeExtraInTithe: e.target.checked
                      })
                    }
                  />
                  <span>Incluir também sobre a Renda Extra</span>
                </label>
              </div>

              <div className="form-grid-3">
                <div className="preview-pill">
                  <span>{coupleForm.partner1Name} (10% + {p1OffPct}%)</span>
                  <strong className="text-emerald">
                    {formatCurrency(p1Tithe + p1Offering)}
                  </strong>
                  <small>
                    Dízimo: {formatCurrency(p1Tithe)} · Oferta: {formatCurrency(p1Offering)}
                  </small>
                </div>

                <div className="preview-pill">
                  <span>{coupleForm.partner2Name} (10% + {p2OffPct}%)</span>
                  <strong className="text-emerald">
                    {formatCurrency(p2Tithe + p2Offering)}
                  </strong>
                  <small>
                    Dízimo: {formatCurrency(p2Tithe)} · Oferta: {formatCurrency(p2Offering)}
                  </small>
                </div>

                <div className="preview-pill">
                  <span>Total Primícias dos Salários</span>
                  <strong className="text-emerald">
                    {formatCurrency(totalChurchFromSalary)}
                  </strong>
                  <small>
                    Sobra Líquida Salários: {formatCurrency(totalIncome - totalChurchFromSalary)}
                  </small>
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="sav-target">Meta Mensal de Poupança (R$)</label>
                <input
                  id="sav-target"
                  type="number"
                  step="0.01"
                  value={coupleForm.monthlySavingsTarget}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, monthlySavingsTarget: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="split-mode">Regra de Divisão das Contas da Casa</label>
                <select
                  id="split-mode"
                  value={coupleForm.splitMode}
                  onChange={(e) =>
                    setCoupleForm({ ...coupleForm, splitMode: e.target.value })
                  }
                >
                  <option value="proportional">Proporcional à Renda de cada um</option>
                  <option value="equal">50% / 50% (Meio a Meio)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              <i className="fa-solid fa-floppy-disk"></i> Salvar Salários, Dízimo &amp; Ofertas
            </button>
          </form>
        </div>

        {/* CENTRAL DE BACKUP (.JSON) */}
        <div className="card">
          <div className="card-header">
            <h3>
              <i className="fa-solid fa-database"></i> Central de Backup &amp; Portabilidade (.json)
            </h3>
            <p className="card-subtitle">
              Exporte ou restaure todos os dados financeiros com 1 clique
            </p>
          </div>
          <div className="backup-actions-box">
            <div className="backup-item">
              <div>
                <strong>Exportar Backup Completo (.json)</strong>
                <p>
                  Baixe uma cópia de segurança com todos os lançamentos, aulas particulares,
                  cartões, metas e parcelamentos.
                </p>
              </div>
              <button className="btn btn-primary" onClick={onExportBackup}>
                <i className="fa-solid fa-download"></i> Baixar JSON
              </button>
            </div>

            <div className="backup-item">
              <div>
                <strong>Importar / Restaurar Backup (.json)</strong>
                <p>Carregue um arquivo salvo anteriormente para restaurar seus dados.</p>
              </div>
              <label className="btn btn-outline" htmlFor="import-json-file" style={{ cursor: 'pointer' }}>
                <i className="fa-solid fa-upload"></i> Importar JSON
                <input
                  id="import-json-file"
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleFileImport}
                />
              </label>
            </div>

            <div className="backup-item">
              <div>
                <strong>Restaurar Dados de Demonstração</strong>
                <p>Voltar aos exemplos iniciais pré-carregados de Wesley &amp; Beatriz.</p>
              </div>
              <button className="btn btn-soft" onClick={onResetToDemo}>
                <i className="fa-solid fa-rotate-left"></i> Restaurar Exemplo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TETOS ORÇAMENTÁRIOS POR CATEGORIA */}
      <div className="card">
        <div className="card-header flex-between">
          <div>
            <h3>
              <i className="fa-solid fa-sliders"></i> Tetos de Gastos Mensais por Categoria
            </h3>
            <p className="card-subtitle">
              Total Alocado nos Tetos: <strong>{formatCurrency(totalBudgetAllocated)}</strong> (
              {allocationPct}% da Renda Base de {formatCurrency(totalIncome)})
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveBudgets}>
          <div className="progress-bar-track" style={{ marginBottom: '18px' }}>
            <div
              className={`progress-bar-fill ${allocationPct > 100 ? 'danger' : 'emerald'}`}
              style={{ width: `${Math.min(100, allocationPct)}%` }}
            />
          </div>

          <div className="form-grid-3">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="form-group">
                <label htmlFor={`bud-${cat.id}`}>
                  <i className={`fa-solid ${cat.icon}`} style={{ color: cat.color }}></i>{' '}
                  {cat.name} (R$)
                </label>
                <input
                  id={`bud-${cat.id}`}
                  type="number"
                  step="10"
                  min="0"
                  value={budgetsForm[cat.id] ?? 0}
                  onChange={(e) =>
                    setBudgetsForm({ ...budgetsForm, [cat.id]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              <i className="fa-solid fa-check"></i> Salvar Tetos de Orçamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
