import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MesaDashboard from '@/components/MesaDashboard';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY, type Locale } from '@/i18n/types';
import { mesaReadingMessages } from '@/i18n/mesa-reading-messages';
import { formatCurrency } from '@/utils/format';
import type { Transaction } from '@/types/transaction';

vi.mock('@/components/TransactionsTable', () => ({ default: ({ transactions }: { transactions: Transaction[] }) => <div data-testid="mock-ledger" data-count={transactions.length} /> }));
vi.mock('@/components/charts/CategoryComparison', () => ({ default: () => <div /> }));
vi.mock('@/hooks/useIncomeSummary', () => ({ useIncomeSummary: () => ({ summaries: null, loading: false, updating: false, slow: false, error: false, retry: vi.fn() }) }));

let root: Root, container: HTMLDivElement;
const tx = (id: number, date_iso: string, value: number, category: string, subcategory = ''): Transaction => ({ id, date_iso, date: date_iso, amount: String(value), value, category, subcategory, currency: 'NZD', place: 'Synthetic fixture' });
const rows = [tx(1, '2026-01-05', 900, 'Basic living', 'Rent'), tx(2, '2026-03-05', 90, 'Basic living', 'Phone'), tx(3, '2026-03-06', 60, 'Travel', 'Accommodation'), tx(4, '2026-01-06', 30, 'Basic living', '')];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), clear: () => storage.clear() });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = async (locale: Locale = 'en', transactions = rows) => {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  await act(async () => root.render(<LocaleProvider><MesaDashboard transactions={transactions} onTransactionUpdated={vi.fn()} onTransactionDeleted={vi.fn()} /></LocaleProvider>));
};
const reading = () => container.querySelector<HTMLElement>('[data-testid="period-reading"]')!;
const breakdown = () => container.querySelector<HTMLElement>('[data-testid="period-average-bars"]')!;
const chooseCategory = async (index: number) => act(async () => container.querySelectorAll<HTMLButtonElement>('.mesa-category-rail button')[index].click());

it.each(['en', 'es', 'ja'] as const)('shows localized scope and per-category/subcategory averages in %s', async locale => {
  await render(locale);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].all);
  expect(breakdown().textContent).toContain(mesaReadingMessages[locale].categoryRows);
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(2);
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(360, locale));
  const summary = container.querySelector('[data-testid="summary"]')!.textContent;
  await chooseCategory(1);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].basic);
  expect(breakdown().textContent).toContain(mesaReadingMessages[locale].subcategoryRows);
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(3);
  expect(breakdown().textContent).toContain(mesaReadingMessages[locale].missingSubcategory);
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(340, locale));
  expect(container.querySelector('[data-testid="summary"]')!.textContent).toBe(summary);
});
it('updates breakdown when rent is excluded, retaining the same selected month denominator', async () => {
  await render();
  const checkbox = container.querySelector<HTMLInputElement>('.mesa-period-options input')!;
  await act(async () => checkbox.click());
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(60));
  expect(reading().querySelector('.mesa-reading-period')!.textContent).toContain('3 calendar months');
  await chooseCategory(1);
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(2);
  expect(breakdown().querySelector('dl')!.textContent).not.toContain('Rent');
});
it('shows separated selected years and keeps month detail selection out of the reading scope', async () => {
  localStorage.setItem('gastos.mesa.years.v1', JSON.stringify({ version: 1, selection: ['2024', '2026'] }));
  await render('en', [tx(1, '2024-10-05', 30, 'Travel'), tx(2, '2025-02-05', 999, 'Travel'), tx(3, '2026-03-05', 90, 'Travel')]);
  const periods = [...reading().querySelectorAll('.mesa-reading-period li')].map(row => row.textContent);
  expect(periods).toHaveLength(2);
  expect(periods.join(' ')).toContain('2024'); expect(periods.join(' ')).toContain('2026'); expect(periods.join(' ')).not.toContain('2025');
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(20));
  const before = reading().textContent;
  await act(async () => container.querySelector<HTMLButtonElement>('.mesa-month-card')!.click());
  expect(reading().textContent).toBe(before);
});
it('supports an explicitly selected blank category and its custom subcategory', async () => {
  await render('en', [tx(1, '2026-01-05', 30, '', 'Custom manual purpose'), tx(2, '2026-03-05', 90, 'Travel')]);
  await chooseCategory(2);
  expect(reading().textContent).toContain(mesaReadingMessages.en.missingCategory);
  expect(reading().textContent).toContain(mesaReadingMessages.en.unclassified);
  expect(breakdown().querySelector('dl')!.textContent).toContain('Custom manual purpose');
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(10));
});
it('leaves monthly average unknown when no years are selected', async () => {
  localStorage.setItem('gastos.mesa.years.v1', JSON.stringify({ version: 1, selection: [] }));
  await render();
  expect(breakdown().textContent).toContain(mesaReadingMessages.en.noMonths);
  expect(reading().querySelectorAll('.mesa-reading-metrics strong')[1].textContent).toBe('—');
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(0);
});
it('keeps distribution at the full filtered scope while category and month select the detail and ledger', async () => {
  const original = structuredClone(rows);
  await render();
  const summary = container.querySelector('[data-testid="summary"]')!.textContent;
  const distribution = () => container.querySelector('.mesa-category-distribution')!;
  const shares = [...distribution().querySelectorAll('.mesa-distribution-legend strong')].map(row => row.textContent);
  expect(shares).toEqual(['94.44%', '5.56%']);
  await act(async () => distribution().querySelectorAll<HTMLButtonElement>('button')[1].click());
  expect(reading().querySelector('.mesa-reading-title')!.textContent).toBe('Travel');
  expect(container.querySelector('[data-testid="summary"]')!.textContent).toBe(summary);
  expect(container.querySelector('[data-testid="mock-ledger"]')!.getAttribute('data-count')).toBe('1');
  await act(async () => container.querySelector<HTMLButtonElement>('.mesa-chart button')!.click());
  expect([...distribution().querySelectorAll('.mesa-distribution-legend strong')].map(row => row.textContent)).toEqual(shares);
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(20));
  await act(async () => container.querySelector<HTMLInputElement>('.mesa-period-options input')!.click());
  expect([...distribution().querySelectorAll('.mesa-distribution-legend strong')].map(row => row.textContent)).toEqual(['66.67%', '33.33%']);
  expect(rows).toEqual(original);
});
it('keeps custom categories directly selectable without adding category or subcategory assumptions', async () => {
  const records = [tx(1, '2026-01-05', 30, 'A custom manual category', 'Only the recorded custom purpose'), tx(2, '2026-03-05', 90, 'Travel')];
  await render('en', records);
  expect(container.querySelectorAll('.mesa-category-rail button')).toHaveLength(3);
  expect(container.querySelector('.mesa-category-rail select')).toBeNull();
  await chooseCategory(2);
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(1);
  expect(breakdown().querySelector('dl')!.textContent).toContain('Only the recorded custom purpose');
  expect(container.querySelector('.mesa-detail-panel')!.contains(reading())).toBe(true);
  expect(container.querySelector('.mesa-detail-panel')!.contains(container.querySelector('.mesa-bars'))).toBe(true);
});
it('does not invent a percentage or chart segment for missing or zero recorded spending', async () => {
  await render('en', [tx(1, '2026-01-05', 0, 'Travel')]);
  expect(container.querySelector('.mesa-category-distribution')!.textContent).not.toMatch(/NaN|Infinity/);
  expect(container.querySelector('.mesa-distribution-stack')).toBeNull();
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(1);
  localStorage.setItem('gastos.mesa.years.v1', JSON.stringify({ version: 1, selection: [] }));
  await act(async () => root.unmount()); root = createRoot(container);
  await render();
  expect(container.querySelector('.mesa-distribution-stack')).toBeNull();
  expect(reading().querySelectorAll('.mesa-reading-metrics strong')[1].textContent).toBe('—');
});
it('renders proportional horizontal monthly-average bars for categories and selected subcategories', async () => {
  const original = structuredClone(rows);
  await render();
  const widths = () => [...breakdown().querySelectorAll<HTMLElement>('.mesa-average-fill')].map(bar => parseFloat(bar.style.width));
  expect(widths()).toHaveLength(2);
  expect(widths()[0]).toBe(100);
  expect(widths()[1]).toBeCloseTo(20 / 340 * 100, 8);
  expect(breakdown().querySelectorAll('strong')[0].textContent).toBe(formatCurrency(340));
  await chooseCategory(1);
  expect(widths()).toHaveLength(3);
  expect(widths()[0]).toBe(100);
  expect(widths()[1]).toBe(10);
  expect(widths()[2]).toBeCloseTo(10 / 300 * 100, 8);
  const before = breakdown().textContent;
  await act(async () => container.querySelector<HTMLButtonElement>('.mesa-chart button')!.click());
  expect(breakdown().textContent).toBe(before);
  expect(rows).toEqual(original);
});
it('places the two metrics beside the explanation and the horizontal distribution before the monthly trend', async () => {
  await render();
  const header = reading().querySelector('.mesa-reading-header')!;
  expect(header.children[0].classList.contains('mesa-reading-intro')).toBe(true);
  expect(header.children[1].classList.contains('mesa-reading-metrics')).toBe(true);
  const body = container.querySelector('.mesa-detail-charts')!;
  expect(body.children[0]).toBe(breakdown());
  expect(body.children[1].classList.contains('mesa-bars')).toBe(true);
  expect(container.querySelector('.mesa-board-layout')!.children).toHaveLength(2);
  expect(container.querySelector('.mesa-global-distribution')!.hasAttribute('open')).toBe(false);
});
it('uses an empty bar for a recorded zero average and draws no bars for an unknown denominator', async () => {
  await render('en', [tx(1, '2026-01-05', 0, 'Travel', 'Accommodation')]);
  expect(breakdown().querySelector<HTMLElement>('.mesa-average-fill')!.style.width).toBe('0%');
  expect(breakdown().querySelector('strong')!.textContent).toBe(formatCurrency(0));
  expect(breakdown().innerHTML).not.toMatch(/NaN|Infinity/);
  await act(async () => container.querySelector<HTMLInputElement>('.mesa-years input')!.click());
  expect(breakdown().querySelectorAll('.mesa-average-fill')).toHaveLength(0);
  expect(reading().querySelectorAll('.mesa-reading-metrics strong')[1].textContent).toBe('—');
});
it.each(['en', 'es', 'ja'] as const)('explains pending approved category labels accurately in %s', async locale => {
  for (const [category, key] of [['Personal purchases', 'personal'], ['Subscriptions', 'subscriptionsGeneral'], ['Meals & outings', 'meals'], ['Entertainment', 'entertainment']] as const) {
    await render(locale, [tx(1, '2026-01-05', 30, category, 'Custom recorded purpose')]);
    await chooseCategory(1);
    expect(reading().querySelector('.mesa-reading-meaning')!.textContent).toBe(mesaReadingMessages[locale][key]);
    expect(breakdown().querySelector('dl')!.textContent).toContain('Custom recorded purpose');
  }
});

it.each(['en', 'es', 'ja'] as const)('keeps equivalent category selection and ledger scope after a refreshed label change in %s', async locale => {
  const records = [tx(1, '2026-01-05', 30, 'Work & learning', 'Software & tools'), tx(2, '2026-01-06', 30, 'Trabajo y estudio', 'Consumo de API'), tx(3, '2026-01-07', 30, '仕事・学習', 'APIの使用量'), tx(4, '2026-01-08', 10, 'Meals & outings', 'Cafés')];
  await render(locale, records);
  const rail = () => [...container.querySelectorAll('.mesa-category-rail button span')].map(node => node.textContent);
  expect(rail()).toHaveLength(3); expect(new Set(rail()).size).toBe(3);
  await chooseCategory(1);
  expect(container.querySelector('[data-testid="mock-ledger"]')!.getAttribute('data-count')).toBe('3');
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(2);
  const summary = container.querySelector('[data-testid="summary"]')!.textContent;
  await render(locale, records.map(row => row.id === 1 ? { ...row, category: 'Work & Study', subcategory: 'API usage', category_source: 'manual' } : row));
  expect(container.querySelector('[data-testid="mock-ledger"]')!.getAttribute('data-count')).toBe('3');
  expect(breakdown().querySelectorAll('dl > div')).toHaveLength(1);
  expect(container.querySelector('[data-testid="summary"]')!.textContent).toBe(summary);
  expect(container.querySelector('.mesa-category-rail button[aria-pressed="true"]')).not.toBeNull();
});
