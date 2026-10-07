import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PurchasePlan from '@/components/PurchasePlan';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { planMessages } from '../messages';
import type { PlanExpenseEvidence } from '../evidence';
import { verifiedIncome } from '../../budget/__tests__/income-fixtures';
import type { HouseholdIncomeEvidence } from '../../budget/income';
vi.mock('../plan.css', () => ({}));
let root: Root, container: HTMLDivElement;
const stored = new Map<string, string>();
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), clear: () => stored.clear() }); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const evidence = (average: number | null): PlanExpenseEvidence => ({ average, start: '2026-01-01', end: '2026-03-31', months: 3, partial: true, excluded: false });
const render = (average: number | null, loading = false, key = 'account-A', incomeEvidence: HouseholdIncomeEvidence | null = verifiedIncome) => act(() => root.render(<LocaleProvider><PurchasePlan key={key} evidence={evidence(average)} loading={loading} incomeLoading={loading} incomeEvidence={incomeEvidence} /></LocaleProvider>));
const input = (key: string) => container.querySelector<HTMLInputElement>(`[data-field="${key}"]`)!;
const change = (key: string, value: string) => act(() => { const el = input(key); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
it('keeps all assumptions editable while only expense evidence loads; finishes busy on failure', () => {
  render(null, true); expect(input('expense').value).toBe(''); expect(input('expense').disabled).toBe(false); expect(input('income').value).toBe(''); expect(container.querySelector('[aria-busy=true]')).not.toBeNull();
  render(null, false); expect(container.querySelector('[aria-busy=true]')).toBeNull(); expect(container.textContent).toContain(planMessages.en.unavailable);
});
it('late evidence fills only untouched expenses and preserves focus and manual edits', () => {
  render(null); change('expense', '3200'); act(() => input('expense').focus()); render(4000); expect(input('expense').value).toBe('3200'); expect(document.activeElement).toBe(input('expense'));
  const button = [...container.querySelectorAll('button')].find(el => el.textContent?.startsWith(planMessages.en.apply))!;
  act(() => { input('expense').blur(); button.click(); }); expect(input('expense').value).toBe('4000'); render(4100); expect(input('expense').value).toBe('4100');
});
it('clears assumptions across account changes without persisting financial inputs', () => {
  render(4000); change('savings', '12345'); render(null, false, 'account-B'); expect(input('savings').value).toBe('0'); expect(input('expense').value).toBe(''); expect([...stored.keys()].some(key => key.includes('plan'))).toBe(false);
});
it('retains expanded calculation disclosure during typing and correctly toggles optional tax', () => {
  render(5000); change('income', '10000'); const details = container.querySelector('details')!; details.open = true; change('rate', '0'); expect(details.open).toBe(true);
  expect(input('tax').disabled).toBe(true); const gross = [...container.querySelectorAll('button')].find(el => el.textContent === planMessages.en.gross)!; act(() => gross.click()); expect(input('tax').disabled).toBe(false);
  change('tax', '30'); expect(container.querySelector('.margin')!.textContent).toContain('2,000');
});
it.each(['en', 'es', 'ja'] as const)('renders all plan copy and labeled controls in %s', locale => {
  localStorage.setItem('gastos.locale', locale); render(5000);
  expect(container.querySelector('h1')!.textContent).toBe(planMessages[locale].title);
  expect(input('expense').getAttribute('aria-label')).toBe(planMessages[locale].expense);
  expect(container.querySelectorAll('.result')).toHaveLength(2);
  expect(container.textContent).toContain(planMessages[locale].fairness);
  expect(container.querySelector('.result-invest')!.textContent).toContain(planMessages[locale].initialCapital);
});
it('shows equal initial capital and contributions, preserving both results while the budget changes', () => {
  render(8000); change('income', '12000'); change('savings', '50000'); change('rate', '0');
  const investment = () => container.querySelector('.result-invest')!;
  const time = '10 years 5 months';
  const cash = () => container.querySelector('.result-cash .result-time')!.textContent;
  expect(cash()).toBe(time);
  expect(investment().querySelector('.result-time')!.textContent).toBe(time);
  expect(investment().textContent).toContain(planMessages.en.initialCapital);
  expect(investment().textContent).not.toContain(planMessages.en.toCash);
  change('income', '16000'); expect(investment().querySelector('.result-time')!.textContent).toBe(time); expect(cash()).toBe(time);
  change('expense', '14000'); expect(investment().querySelector('.result-time')!.textContent).toBe(time); expect(cash()).toBe(time);
  change('expense', '14001'); expect(investment().querySelector('.result-time')!.textContent).toBe(time); expect(cash()).toBe(time);
  expect(container.querySelector('[role=alert]')!.textContent).toBe(planMessages.en.overAlert);
  change('rate', '10'); expect(investment().querySelector('.result-time')!.textContent).not.toBe(time); expect(cash()).toBe(time);
  expect(input('savings').value).toBe('50000'); expect(input('income').value).toBe('16000');
});
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'synthetic-A', email: 'synthetic@example.test', authorized: true } } }) }));
vi.mock('@/components/AuthGuard', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/Header', () => ({ default: () => <nav>Visible navigation</nav> }));
const resource = vi.hoisted(() => ({ transactions: [], loading: true, updating: false, slow: false, error: null as string | null, refetch: vi.fn() }));
vi.mock('@/hooks/useTransactions', () => ({ useTransactions: () => resource }));
import PlanPage from '@/app/plan/page';
it('real Plan route preserves shell, shows retry on error and never seeds demo spending', async () => {
  await act(async () => root.render(<LocaleProvider><PlanPage /></LocaleProvider>));
  expect(container.textContent).toContain('Visible navigation'); expect(input('expense').value).toBe('');
  resource.loading = false; resource.error = 'Synthetic failure';
  await act(async () => root.render(<LocaleProvider><PlanPage /></LocaleProvider>));
  expect(container.querySelector('[aria-busy=true]')).toBeNull();
  expect(container.querySelector('.data-feedback')).not.toBeNull();
  expect(input('expense').value).toBe('');
});

it('prefills shared disposable income and all spending, preserves manual inputs on refetch, and resets only income and expenses', () => {
  render(4000); expect(input('income').value).toBe('13492.56'); expect(input('expense').value).toBe('4000'); expect(input('tax').value).toBe('0'); expect(input('tax').disabled).toBe(true);
  change('income', '9000'); change('expense', '3200'); change('price', '500000'); change('savings', '50000'); change('invest', '1234'); change('rate', '8');
  render(4100, false, 'account-A', { ...verifiedIncome, selectedCents: verifiedIncome.selectedCents + 6000 });
  expect(input('income').value).toBe('9000'); expect(input('expense').value).toBe('3200');
  const reset = [...container.querySelectorAll('button')].find(el => el.textContent === planMessages.en.reset)!;
  act(() => reset.click()); expect(input('income').value).toBe('13502.56'); expect(input('expense').value).toBe('4100');
  expect(input('price').value).toBe('500000'); expect(input('savings').value).toBe('50000'); expect(input('invest').value).toBe('1234'); expect(input('rate').value).toBe('8'); expect(input('tax').value).toBe('0');
  render(4200, false, 'account-A', { ...verifiedIncome, selectedCents: verifiedIncome.selectedCents + 12000 });
  expect(input('income').value).toBe('13512.56'); expect(input('expense').value).toBe('4200');
});
it('never falls back to demo income during absent coverage, keeps manual assumptions through failures and leaves old drafts untouched', () => {
  stored.set('gastos.family-budget.v1:account-A', 'legacy budget draft');
  render(null, false, 'account-A', null); expect(input('income').value).toBe(''); expect(input('expense').value).toBe('');
  change('income', '8000'); change('expense', '3000'); render(null, true, 'account-A', null);
  expect(input('income').value).toBe('8000'); expect(input('expense').value).toBe('3000');
  render(null, false, 'account-A', null); expect(input('income').value).toBe('8000');
  act(() => [...container.querySelectorAll('button')].find(el => el.textContent === planMessages.en.reset)!.click());
  expect(input('income').value).toBe(''); expect(input('expense').value).toBe(''); expect(stored.get('gastos.family-budget.v1:account-A')).toBe('legacy budget draft');
});
