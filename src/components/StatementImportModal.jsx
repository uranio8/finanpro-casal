import React, { useState } from 'react';
import { CATEGORIES } from '../data/initialState';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import { parseStatementText } from '../utils/statementParser';

export default function StatementImportModal({
  cards = [],
  couple,
  onImportTransactions,
  onClose
}) {
  const [items, setItems] = useState([]);
  const [fileName, setFileName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(
    cards.length > 0 ? 'Cartão de Crédito' : 'PIX'
  );
  const [cardId, setCardId] = useState(cards[0]?.id || '');
  const [owner, setOwner] = useState('joint');
  const [status, setStatus] = useState('paid');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseStatementText(text, file.name);
    setItems(parsed);
  };

  const toggleSelect = (tempId) => {
    setItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, selected: !it.selected } : it))
    );
  };

  const updateCategory = (tempId, category) => {
    setItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, category } : it))
    );
  };

  const selectedItems = items.filter((it) => it.selected);

  const handleConfirmImport = () => {
    if (selectedItems.length === 0) return;
    const nowIso = new Date().toISOString();
    const txs = selectedItems.map((it, idx) => ({
      id: `tx-imp-${Date.now()}-${idx}`,
      title: it.title,
      type: it.type,
      category: it.category,
      amount: it.amount,
      dueDate: it.dueDate,
      paidDate: status === 'paid' ? it.dueDate : '',
      status,
      owner,
      paidBy: owner === 'partner2' ? 'partner2' : 'partner1',
      paymentMethod,
      cardId: paymentMethod === 'Cartão de Crédito' ? cardId : '',
      updatedAt: nowIso
    }));
    onImportTransactions(txs);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-lg"
        style={{ maxWidth: '820px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-file-import text-emerald"></i> Importar Extrato / Fatura (CSV ou OFX)
          </h3>
          <button type="button" className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="stmt-file-input">
              Selecione o arquivo `.csv` (Nubank, Inter, Itaú, C6) ou `.ofx`
            </label>
            <input
              id="stmt-file-input"
              type="file"
              accept=".csv,.ofx,.txt"
              onChange={handleFileChange}
            />
          </div>

          <div className="form-grid-3" style={{ marginBottom: '14px' }}>
            <div className="form-group">
              <label htmlFor="stmt-method">Meio de Pagamento</label>
              <select
                id="stmt-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="PIX">PIX / Débito</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>

            {paymentMethod === 'Cartão de Crédito' && cards.length > 0 && (
              <div className="form-group">
                <label htmlFor="stmt-card">Cartão</label>
                <select
                  id="stmt-card"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="stmt-owner">Responsável</label>
              <select
                id="stmt-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="joint">Casal (Conjunto)</option>
                <option value="partner1">{couple.partner1Name}</option>
                <option value="partner2">{couple.partner2Name}</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="stmt-status">Status Inicial</label>
              <select
                id="stmt-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="paid">Pago / Já faturado</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>

          {fileName && items.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhum lançamento reconhecido em "{fileName}". Verifique se o arquivo possui colunas Data, Descrição e Valor.
            </p>
          )}

          {items.length > 0 && (
            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usar</th>
                    <th>Data</th>
                    <th>Estabelecimento / Descrição</th>
                    <th>Categoria (Sugerida)</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.tempId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={it.selected}
                          aria-label={`Selecionar ${it.title}`}
                          onChange={() => toggleSelect(it.tempId)}
                        />
                      </td>
                      <td>{formatDateBR(it.dueDate)}</td>
                      <td>{it.title}</td>
                      <td>
                        <select
                          value={it.category}
                          aria-label={`Categoria de ${it.title}`}
                          onChange={(e) => updateCategory(it.tempId, e.target.value)}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-right font-mono-val">
                        <strong className={it.type === 'income' ? 'text-emerald' : 'text-rose'}>
                          {it.type === 'income' ? '+' : '-'} {formatCurrency(it.amount)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedItems.length === 0}
            onClick={handleConfirmImport}
          >
            <i className="fa-solid fa-check"></i> Importar {selectedItems.length} lançamento(s)
          </button>
        </div>
      </div>
    </div>
  );
}
