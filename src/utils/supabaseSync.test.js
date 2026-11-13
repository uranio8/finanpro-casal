import { describe, it, expect } from 'vitest';
import { mergeCloudAndLocalState } from './supabaseSync';

describe('mergeCloudAndLocalState', () => {
  it('merges distinct offline items created on different devices without losing either', () => {
    const localState = {
      transactions: [{ id: 'tx-pc-1', title: 'Mercado PC', amount: 150, updatedAt: '2026-11-13T10:00:00Z' }],
      cards: [],
      commitments: [],
      extraIncomes: [],
      goals: [],
      checklist: [],
      savedStudents: []
    };
    const remoteState = {
      transactions: [{ id: 'tx-mob-1', title: 'Farmácia Celular', amount: 45, updatedAt: '2026-11-13T10:01:00Z' }],
      cards: [],
      commitments: [],
      extraIncomes: [],
      goals: [],
      checklist: [],
      savedStudents: []
    };

    const merged = mergeCloudAndLocalState(localState, remoteState);
    expect(merged.transactions.map((t) => t.id).sort()).toEqual(['tx-mob-1', 'tx-pc-1']);
  });

  it('respects deletedIds when an item was removed', () => {
    const localState = {
      transactions: [{ id: 'tx-1', title: 'Antigo', amount: 50, updatedAt: '2026-11-13T09:00:00Z' }],
      deletedIds: {}
    };
    const remoteState = {
      transactions: [],
      deletedIds: { 'tx-1': '2026-11-13T10:00:00Z' }
    };

    const merged = mergeCloudAndLocalState(localState, remoteState);
    expect(merged.transactions).toHaveLength(0);
  });
});
