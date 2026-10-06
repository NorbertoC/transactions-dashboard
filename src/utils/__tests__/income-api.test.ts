import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService, IncomeCapabilityUnavailable } from '@/services/api';
import type { Transaction } from '@/types/transaction';
const base: Transaction = { id: 1, place: 'Synthetic Barfoot Thompson salary', value: 100, date_iso: '2026-01-01', date: '2026-01-01', amount: '100', currency: 'NZD', category: 'Income', owner: 'Synthetic owner', income_source: 'Synthetic employer' };
afterEach(() => vi.unstubAllGlobals());
describe('typed income API client boundary', () => {
  it('preserves income attribution/category and avoids merchant expense/statement classification', async () => {
    const income = { ...base, record_type: 'income', direction: 'inflow' };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([income]))); vi.stubGlobal('fetch', fetch);
    expect(await ApiService.fetchTransactionsClient('all')).toEqual([income]);
    expect(fetch.mock.calls[0]).toEqual(['/api/transactions?record_type=all', { cache: 'no-store' }]);
  });
  it('rejects older untyped all responses instead of reporting zero income', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([base]))));
    await expect(ApiService.fetchTransactionsClient('all')).rejects.toBeInstanceOf(IncomeCapabilityUnavailable);
  });
  it('rejects mismatched explicit direction instead of signing an income as an expense', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...base, record_type: 'income', direction: 'outflow' }]))));
    await expect(ApiService.fetchTransactionsClient('all')).rejects.toBeInstanceOf(IncomeCapabilityUnavailable);
  });
  it('keeps default legacy expense reads explicit', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...base, category: 'Groceries' }]))); vi.stubGlobal('fetch', fetch);
    const rows = await ApiService.fetchTransactionsClient(); expect(rows[0].category).toBe('Groceries');
    expect(fetch.mock.calls[0][0]).toBe('/api/transactions?record_type=expense');
  });
});
