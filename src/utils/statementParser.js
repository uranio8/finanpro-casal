const CATEGORY_KEYWORDS = [
  { category: 'mercado', words: ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'pao de acucar', 'padaria', 'acougue', 'hortifruti', 'sacolao'] },
  { category: 'transporte', words: ['posto', 'shell', 'ipiranga', 'br mania', 'petrobras', 'combustivel', 'gasolina', 'etanol', 'uber', '99app', 'estacionamento', 'pedagio', 'sem parar'] },
  { category: 'lazer', words: ['ifood', 'rappi', 'restaurante', 'lanchonete', 'pizzaria', 'burger', 'mc donalds', 'mcdonalds', 'cafe', 'cinema', 'sorvete', 'bar '] },
  { category: 'saude', words: ['farmacia', 'drogaria', 'drogasil', 'pague menos', 'raia', 'unimed', 'hospital', 'clinica', 'odonto', 'exame'] },
  { category: 'assinaturas', words: ['netflix', 'spotify', 'amazon prime', 'disney', 'youtube', 'icloud', 'google one', 'globoplay', 'chatgpt', 'apple.com'] },
  { category: 'moradia', words: ['aluguel', 'condominio', 'energia', 'enel', 'cemig', 'copel', 'sabesp', 'sanepar', 'agua', 'internet', 'vivo', 'claro', 'tim', 'oi fibra', 'iptu'] },
  { category: 'eletro', words: ['leroy', 'tok stok', 'magalu', 'magazine luiza', 'casas bahia', 'moveis', 'ferragens'] },
  { category: 'viagens', words: ['latam', 'azul', 'gol ', 'airbnb', 'booking', 'hotel', 'pousada'] }
];

export function suggestCategory(title = '') {
  const norm = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const group of CATEGORY_KEYWORDS) {
    if (group.words.some((w) => norm.includes(w))) {
      return group.category;
    }
  }
  return 'outros';
}

function normalizeDateToISO(raw = '') {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // YYYYMMDD... (OFX)
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(raw = '') {
  let s = String(raw).trim().replace(/[R$\s]/g, '');
  // Brazilian format: 1.234,56 -> 1234.56
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function splitCsvLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseStatementText(rawText = '', fileName = '') {
  const text = rawText.trim();
  if (!text) return [];

  const isOfx = fileName.toLowerCase().endsWith('.ofx') || text.includes('<STMTTRN>');
  if (isOfx) {
    const blocks = text.split(/<STMTTRN>/i).slice(1);
    return blocks
      .map((blk, idx) => {
        const getTag = (tag) => {
          const m = blk.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
          return m ? m[1].trim() : '';
        };
        const rawAmt = parseAmount(getTag('TRNAMT'));
        const title = getTag('MEMO') || getTag('NAME') || `Lançamento OFX #${idx + 1}`;
        const dueDate = normalizeDateToISO(getTag('DTPOSTED'));
        const type = rawAmt > 0 ? 'income' : 'expense';
        const amount = Math.abs(rawAmt);
        if (amount <= 0) return null;
        return {
          tempId: `imp-${Date.now()}-${idx}`,
          title,
          type,
          amount: Number(amount.toFixed(2)),
          dueDate,
          category: type === 'income' ? 'salario' : suggestCategory(title),
          selected: true
        };
      })
      .filter(Boolean);
  }

  // CSV parsing
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headerCols = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const hasHeader = headerCols.some((h) =>
    ['data', 'date', 'valor', 'amount', 'title', 'titulo', 'descrição', 'descricao', 'historico'].some((k) =>
      h.includes(k)
    )
  );

  const dataLines = hasHeader ? lines.slice(1) : lines;
  let dateIdx = headerCols.findIndex((h) => h.includes('data') || h.includes('date'));
  let titleIdx = headerCols.findIndex((h) =>
    ['title', 'titulo', 'descri', 'historico', 'estabelecimento', 'memo'].some((k) => h.includes(k))
  );
  let amountIdx = headerCols.findIndex((h) => h.includes('valor') || h.includes('amount'));

  if (!hasHeader || dateIdx < 0) dateIdx = 0;
  if (!hasHeader || titleIdx < 0) titleIdx = 1;
  if (!hasHeader || amountIdx < 0) amountIdx = 2;

  return dataLines
    .map((line, idx) => {
      const cols = splitCsvLine(line, delimiter);
      if (cols.length < 3) return null;
      const dueDate = normalizeDateToISO(cols[dateIdx]);
      const title = (cols[titleIdx] || `Lançamento CSV #${idx + 1}`).replace(/^"|"$/g, '');
      const rawAmt = parseAmount(cols[amountIdx]);
      if (rawAmt === 0) return null;
      // Em faturas de cartão CSV (ex: Nubank), gastos vêm positivos e pagamentos vêm negativos
      const looksLikeCardBill = headerCols.some((h) => h === 'category' || h === 'title');
      const isIncome = looksLikeCardBill ? rawAmt < 0 : rawAmt > 0;
      const type = isIncome ? 'income' : 'expense';
      return {
        tempId: `imp-${Date.now()}-${idx}`,
        title,
        type,
        amount: Number(Math.abs(rawAmt).toFixed(2)),
        dueDate,
        category: type === 'income' ? 'salario' : suggestCategory(title),
        selected: true
      };
    })
    .filter(Boolean);
}
