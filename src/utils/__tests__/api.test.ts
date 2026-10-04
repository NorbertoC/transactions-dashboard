import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '@/services/api';
afterEach(() => vi.unstubAllGlobals());
describe('real transaction API integration', () => {
  it('surfaces authentication failure rather than replacing it with sample records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(ApiService.fetchTransactionsClient()).rejects.toThrow('401');
  });
  it('surfaces network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(ApiService.fetchTransactionsClient()).rejects.toThrow('offline');
  });
  it('preserves an unspecified subcategory for a stored category', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 1, place: 'Synthetic transport fixture', value: 12, category: 'Transport', subcategory: '', date_iso: '2026-01-01', currency: 'NZD' }] }));
    expect((await ApiService.fetchTransactionsClient())[0].subcategory).toBe('');
  });
  it('keeps an empty real response empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await ApiService.fetchTransactionsClient()).toEqual([]);
  });
});
