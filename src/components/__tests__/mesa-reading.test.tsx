import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MesaDashboard from '@/components/MesaDashboard';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY, type Locale } from '@/i18n/types';
import { mesaReadingMessages } from '@/i18n/mesa-reading-messages';
import { formatCurrency } from '@/utils/format';
import type { Transaction } from '@/types/transaction';

vi.mock('@/components/TransactionsTable', () => ({ default: () => <div data-testid="mock-ledger" /> }));
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
const chooseCategory = async (index: number) => act(async () => container.querySelectorAll<HTMLButtonElement>('.mesa-category-rail button')[index].click());

it.each(['en', 'es', 'ja'] as const)('shows localized scope and per-category/subcategory averages in %s', async locale => {
  await render(locale);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].all);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].categoryRows);
  expect(reading().querySelectorAll('dl > div')).toHaveLength(2);
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(360, locale));
  const summary = container.querySelector('[data-testid="summary"]')!.textContent;
  await chooseCategory(1);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].basic);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].subcategoryRows);
  expect(reading().querySelectorAll('dl > div')).toHaveLength(3);
  expect(reading().textContent).toContain(mesaReadingMessages[locale].missingSubcategory);
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
  expect(reading().querySelectorAll('dl > div')).toHaveLength(2);
  expect(reading().querySelector('dl')!.textContent).not.toContain('Rent');
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
  expect(reading().querySelector('dl')!.textContent).toContain('Custom manual purpose');
  expect(reading().querySelector('.mesa-reading-metrics')!.textContent).toContain(formatCurrency(10));
});
it('leaves monthly average unknown when no years are selected', async () => {
  localStorage.setItem('gastos.mesa.years.v1', JSON.stringify({ version: 1, selection: [] }));
  await render();
  expect(reading().textContent).toContain(mesaReadingMessages.en.noMonths);
  expect(reading().querySelectorAll('.mesa-reading-metrics strong')[1].textContent).toBe('—');
  expect(reading().querySelectorAll('dl > div')).toHaveLength(0);
});
it.each(['en', 'es', 'ja'] as const)('explains pending approved category labels accurately in %s', async locale => {
  for (const [category, key] of [['Personal purchases', 'personal'], ['Subscriptions', 'subscriptionsGeneral'], ['Meals & outings', 'meals'], ['Entertainment', 'entertainment']] as const) {
    await render(locale, [tx(1, '2026-01-05', 30, category, 'Custom recorded purpose')]);
    await chooseCategory(1);
    expect(reading().querySelector('.mesa-reading-meaning')!.textContent).toBe(mesaReadingMessages[locale][key]);
    expect(reading().querySelector('dl')!.textContent).toContain('Custom recorded purpose');
  }
});
