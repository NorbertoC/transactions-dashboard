import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TransactionsTable from '@/components/TransactionsTable';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { CATEGORIES } from '@/constants/categories';
import { categoryReviewMessages } from '@/i18n/category-review-messages';
import type { Transaction } from '@/types/transaction';

let root: Root, container: HTMLDivElement;
const fixture: Transaction = { id: 42, place: 'Netflix synthetic', amount: '12.00', value: 12, date: '2026-01-10', date_iso: '2026-01-10', currency: 'NZD', category: 'Others', subcategory: '', record_type: 'expense', direction: 'outflow' };
const capability = () => ({ version: 'purpose-v4', manual_category_persistence: true,
  categories: CATEGORIES.filter(group => group.name !== 'Savings').map(group => ({ key: group.key, name: group.name,
    subcategories: group.subcategories.map(sub => ({ key: sub.key, name: sub.name })) })) });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), clear: () => storage.clear() });
  localStorage.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (rows = [fixture], updated = vi.fn()) => {
  await act(async () => root.render(<LocaleProvider><TransactionsTable transactions={rows} onTransactionUpdated={updated} /></LocaleProvider>));
};
const findButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label)!;
const edit = async () => { const button = container.querySelector<HTMLButtonElement>('button[aria-label^="Edit"]')!; await act(async () => button.click()); };
const choose = async (suffix: string, value: string) => {
  const select = container.querySelector<HTMLSelectElement>(`select[id$="desktop-${suffix}"]`)!;
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
};

it('blocks saves against old API and exposes a local capability retry', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({}, 404))); await render(); await edit();
  expect(findButton('Save').disabled).toBe(true); expect(container.textContent).toContain(categoryReviewMessages.en.unavailable);
  expect(findButton(categoryReviewMessages.en.retry)).toBeDefined();
});
it('keeps an unknown merchant in Others without an invented Apply action', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(capability()))); await render([{ ...fixture, place: 'Amazon PayPal synthetic' }]);
  expect(container.textContent).toContain(categoryReviewMessages.en.unknown); expect(findButton('Apply')).toBeUndefined();
});
it('does not suggest over a manual label, including a manual Others label', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(capability()))); await render([{ ...fixture, category_source: 'manual' }]);
  expect(container.textContent).toContain(categoryReviewMessages.en.manual); expect(findButton('Apply')).toBeUndefined();
});
it('clears an invalid subcategory when changing category and requires an explicit choice', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(capability()))); await render([{ ...fixture, category: 'Housing', subcategory: 'Rent', category_source: 'manual' }]); await edit();
  await choose('category', 'Subscriptions');
  expect(container.querySelector<HTMLSelectElement>('select[id$="desktop-subcategory"]')!.value).toBe('');
  await act(async () => findButton('Save').click()); expect(container.textContent).toContain(categoryReviewMessages.en.chooseSubcategory);
});
it('preserves custom manual subcategories verbatim when saving an unchanged category', async () => {
  const manual = { ...fixture, category: '  Personal subscriptions  ', subcategory: '  Custom manual subscription  ', category_source: 'manual' as const };
  const updated = vi.fn();
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return json({ message: 'updated' });
    return json(_url.includes('/api/transactions?') ? [manual] : capability());
  }); vi.stubGlobal('fetch', fetch); await render([manual], updated); await edit();
  await act(async () => findButton('Save').click());
  const write = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!;
  expect(JSON.parse(String(write[1]!.body))).toEqual({ category: manual.category, subcategory: manual.subcategory }); expect(updated).toHaveBeenCalledWith(manual);
});
it('prevents repeated one-click writes while waiting and updates only after stored pair confirmation', async () => {
  let finish: (response: Response) => void = () => {};
  const updated = vi.fn(); const stored = { ...fixture, category: 'Subscriptions', subcategory: 'Entertainment', category_source: 'manual' as const };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return new Promise<Response>(resolve => { finish = resolve; });
    return json(url.includes('/api/transactions?') ? [stored] : capability());
  }); vi.stubGlobal('fetch', fetch); await render([fixture], updated);
  const apply = findButton('Apply'); await act(async () => { apply.click(); apply.click(); });
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1); expect(updated).not.toHaveBeenCalled();
  await act(async () => finish(json({ message: 'updated' }))); expect(updated).toHaveBeenCalledWith(stored);
});
it('shows misleading successful writes as unconfirmed, retaining the displayed original category', async () => {
  const updated = vi.fn(); vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => json(init?.method === 'PUT' ? {} : url.includes('/api/transactions?') ? [fixture] : capability())));
  await render([fixture], updated); await act(async () => findButton('Apply').click());
  expect(updated).not.toHaveBeenCalled(); expect(container.querySelector('[role=alert]')!.textContent).toBe(categoryReviewMessages.en.unconfirmed);
});
it.each(['en', 'es', 'ja'] as const)('renders accessible queue-empty and unknown guidance in %s', async locale => {
  localStorage.setItem('gastos.locale', locale); vi.stubGlobal('fetch', vi.fn(async () => json(capability())));
  await render([{ ...fixture, place: 'Unknown synthetic' }]);
  const queue = findButton(categoryReviewMessages[locale].queue.replace('{count}', '1')); expect(queue.getAttribute('aria-pressed')).toBe('false');
  await act(async () => queue.click());
  await render([{ ...fixture, category: 'Basic living', subcategory: 'Rent' }]);
  expect(container.textContent).toContain(categoryReviewMessages[locale].empty);
});
