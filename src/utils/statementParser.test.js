import { describe, it, expect } from 'vitest';
import { parseStatementText, suggestCategory } from './statementParser';

describe('suggestCategory', () => {
  it('categorizes common Brazilian merchants accurately', () => {
    expect(suggestCategory('IFOOD *PIZZARIA')).toBe('lazer');
    expect(suggestCategory('POSTO SHELL CENTRO')).toBe('transporte');
    expect(suggestCategory('ATACADAO S.A.')).toBe('mercado');
    expect(suggestCategory('DROGASIL FILIAL 12')).toBe('saude');
    expect(suggestCategory('NETFLIX.COM')).toBe('assinaturas');
  });
});

describe('parseStatementText', () => {
  it('parses Nubank-style CSV statement', () => {
    const csv = `date,category,title,amount
2026-11-10,transporte,Posto Ipiranga,180.50
2026-11-11,alimentacao,Ifood *Burger,64.90`;
    const items = parseStatementText(csv, 'fatura.csv');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Posto Ipiranga',
      amount: 180.5,
      dueDate: '2026-11-10',
      category: 'transporte',
      type: 'expense'
    });
    expect(items[1].category).toBe('lazer');
  });

  it('parses OFX bank statement blocks', () => {
    const ofx = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261108120000
<TRNAMT>-245.30
<MEMO>ATACADAO SUPERMERCADO
</STMTTRN>
</OFX>`;
    const items = parseStatementText(ofx, 'extrato.ofx');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'ATACADAO SUPERMERCADO',
      amount: 245.3,
      dueDate: '2026-11-08',
      category: 'mercado',
      type: 'expense'
    });
  });
});
