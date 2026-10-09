import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '@/constants/categories';
import { categoryReviewAvailable, isReviewExpense, saveVerifiedCategory, supportsCategoryReview } from '@/utils/category-review';
import type { Transaction } from '@/types/transaction';
import { getClientSessionGeneration, setClientSessionScope } from '@/utils/client-session';

export const capability = () => ({ version: 'purpose-v5', manual_category_persistence: true,
  categories: CATEGORIES.filter(group => group.name !== 'Savings').map(group => ({ key: group.key, name: group.name,
    subcategories: group.subcategories.map(sub => ({ key: sub.key, name: sub.name })) })) });
const fixture: Transaction = { id: 42, place: 'Synthetic Netflix', amount: '12.00', value: 12, date: '2026-01-10', date_iso: '2026-01-10', currency: 'NZD', category: 'Others', subcategory: '', record_type: 'expense', direction: 'outflow' };
const category = 'Subscriptions', subcategory = 'Entertainment';
const stored = () => ({ ...fixture, category, subcategory, category_source: 'manual' as const });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

describe('review queue and capability', () => {
  it('includes manual Others in the review queue but never income/transfer or known categories', () => {
    expect(isReviewExpense(fixture)).toBe(true);
    expect(isReviewExpense({ ...fixture, category_source: 'manual' })).toBe(true);
    expect(isReviewExpense({ ...fixture, record_type: 'income' })).toBe(false);
    expect(isReviewExpense({ ...fixture, record_type: 'transfer' })).toBe(false);
    expect(isReviewExpense({ ...fixture, category })).toBe(true);
    expect(isReviewExpense({ ...fixture, category, subcategory })).toBe(false);
    expect(isReviewExpense({ ...fixture, category: 'Outings & entertainment', subcategory: 'Meals & treats' })).toBe(true);
    expect(isReviewExpense({ ...fixture, category: 'Outings & entertainment', subcategory: 'Meals & treats', category_source: 'manual' })).toBe(false);
  });
  it('requires the eight groups/thirty-three pairs and exact persistence capability', () => {
    expect(supportsCategoryReview(capability())).toBe(true);
    for (const bad of [null, {}, { ...capability(), version: 'legacy' }, { ...capability(), manual_category_persistence: false }, { ...capability(), categories: [] }]) expect(supportsCategoryReview(bad)).toBe(false);
    const partial = capability(); partial.categories[0].subcategories.pop();
    expect(supportsCategoryReview(partial)).toBe(false);
  });
  it('treats old API404 as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 404)));
    expect(await categoryReviewAvailable()).toBe(false);
  });
  it('rejects v3/v4 metadata, duplicated keys and cross-group subcategory pairs', () => {
    for (const version of ['purpose-v3', 'purpose-v4']) expect(supportsCategoryReview({ ...capability(), version })).toBe(false);
    const duplicate = capability(); duplicate.categories[1].key = duplicate.categories[0].key;
    expect(supportsCategoryReview(duplicate)).toBe(false);
    const crossed = capability(); [crossed.categories[3].subcategories[0], crossed.categories[4].subcategories[0]] = [crossed.categories[4].subcategories[0], crossed.categories[3].subcategories[0]];
    expect(supportsCategoryReview(crossed)).toBe(false);
  });
});
describe('actual stored category confirmation', () => {
  it('returns the backend row only after capability, one PUT and a no-cache reload', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(capability())).mockResolvedValueOnce(json({ message: 'updated' })).mockResolvedValueOnce(json([stored()])); vi.stubGlobal('fetch', fetch);
    expect(await saveVerifiedCategory(fixture, category, subcategory)).toEqual(stored());
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ category, subcategory });
    expect(fetch.mock.calls[2][1].cache).toBe('no-store');
  });
  it('makes no write against a missing/incompatible service', async () => {
    const fetch = vi.fn(async () => json({}, 404)); vi.stubGlobal('fetch', fetch);
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unavailable' }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['income', 'transfer'] as const)('does not write %s records', async record_type => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(saveVerifiedCategory({ ...fixture, record_type }, category, subcategory)).rejects.toMatchObject({ reason: 'saveFailed' }); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { category: 'Legacy category' }, { subcategory: 'Legacy subcategory' }, { subcategory: null }, { category_source: 'merchant' }, { value: 999 }, { currency: 'JPY' }, { date_iso: '2026-01-11' }, { record_type: 'transfer' },
  ])('rejects misleading200 when persisted fields changed: %j', async difference => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(capability())).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json([{ ...stored(), ...difference }])));
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unconfirmed' });
  });
  it('does not retry a write whose response is lost', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(capability())).mockRejectedValueOnce(new Error('lost response')); vi.stubGlobal('fetch', fetch);
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unconfirmed' }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not claim success if the confirmation read fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(capability())).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({}, 502)));
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unconfirmed' });
  });
  it.each(['transport', 'json'])('marks a post-write %s confirmation failure as unconfirmed', async failure => {
    const fetch = vi.fn().mockResolvedValueOnce(json(capability())).mockResolvedValueOnce(json({}));
    if (failure === 'transport') fetch.mockRejectedValueOnce(new Error('read failed'));
    else fetch.mockResolvedValueOnce(new Response('invalid JSON'));
    vi.stubGlobal('fetch', fetch);
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unconfirmed' }); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('does not submit an old row under a replacement session during the capability probe', async () => {
    setClientSessionScope('synthetic-account-A');
    let finish: (response: Response) => void = () => {};
    const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetch);
    const save = saveVerifiedCategory(fixture, category, subcategory);
    setClientSessionScope('synthetic-account-B'); finish(json(capability()));
    await expect(save).rejects.toMatchObject({ reason: 'unconfirmed' }); expect(fetch).toHaveBeenCalledTimes(1);
    setClientSessionScope(null);
  });
  it('rejects an ambiguous confirmation containing duplicate record IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(capability())).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json([stored(), stored()])));
    await expect(saveVerifiedCategory(fixture, category, subcategory)).rejects.toMatchObject({ reason: 'unconfirmed' });
  });
  it('ignores an aborted late401 instead of invalidating the current session', async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const request = new AbortController(), generation = getClientSessionGeneration();
    const probe = categoryReviewAvailable(request.signal); request.abort(); finish(json({}, 401));
    await expect(probe).rejects.toMatchObject({ name: 'AbortError' }); expect(getClientSessionGeneration()).toBe(generation);
  });
});

 it('confirms and refreshes all 33 approved pairs without touching other fields', async () => {
  let persisted = { ...fixture, category_source: 'manual' as const };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') { persisted = { ...persisted, ...JSON.parse(String(init.body)) }; return json({}); }
    return json(url.includes('/api/taxonomy') ? capability() : [persisted]);
  });
  vi.stubGlobal('fetch', fetch);
  for (const group of CATEGORIES) for (const sub of group.subcategories) {
    const saved = await saveVerifiedCategory(persisted, group.name, sub.name);
    expect(saved).toEqual({ ...fixture, category: group.name, subcategory: sub.name, category_source: 'manual' });
    const refresh = await import('@/services/api').then(({ ApiService }) => ApiService.fetchTransactionsClient());
    expect(refresh).toMatchObject([saved]);
  }
  expect(fetch.mock.calls.filter(([,init]) => init?.method === 'PUT')).toHaveLength(33);
 });
