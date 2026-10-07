import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FamilyBudget from '@/components/FamilyBudget';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { budgetMessages } from '../messages';
import { forecastMessages } from '../../forecast/messages';
import type { BudgetRow } from '../model';
vi.mock('../budget.css', () => ({}));
let root: Root, container: HTMLDivElement;
const stored = new Map<string, string>();
const rows: BudgetRow[] = [{ id: 'rent', category: 'Basic living', name: 'Rent', amount: 2600.004, kind: 'need', protected: true, travel: false, observed: true, count: 6 }, { id: 'tickets_transfers', category: 'Travel', name: 'Tickets & transfers', amount: 600, kind: 'want', protected: false, travel: true, observed: true, count: 5 }];
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) }); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); stored.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = (source = rows, known = true, account = 'synthetic-A') => act(() => root.render(<LocaleProvider><FamilyBudget key={account} rows={source} known={known} accountScope={account} coverage={<p>Synthetic source</p>} /></LocaleProvider>));
const input = (label: string) => [...container.querySelectorAll<HTMLInputElement>('input')].find(field => field.getAttribute('aria-label') === label)!;
const click = (label: string) => act(() => { (document.activeElement as HTMLElement)?.blur(); [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label)!.click(); });
function change(label: string, value: string) { act(() => { const field = input(label); field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); }
it('preserves income, chosen savings and category drafts across late evidence, scenarios, undo and reset', () => {
  render(); const m = budgetMessages.en;
  change(m.income, '10000.12345'); expect(input(m.income).value).toBe('10000.12345');
  act(() => input(m.income).blur()); expect(input(m.income).value).toBe('10000.12');
  expect(container.querySelector('.fb-guide')!.textContent).toContain('2,000.02');
  change(m.savings, '900'); change('Rent · Requested', '2800');
  render([{ ...rows[0], amount: 3000 }, rows[1]]); expect(input('Rent · Requested').value).toBe('2800'); expect(input(m.savings).value).toBe('900');
  click(m.scenarios[1]); expect(input(m.income).value).toBe('9924'); click(m.scenarios[0]); expect(input(m.income).value).toBe('10000.12'); expect(input(m.savings).value).toBe('900');
  click(m.reset); expect(input(m.income).value).toBe('13525.9'); expect(input('Rent · Requested').value).toBe('3000'); click(m.undo); expect(input(m.savings).value).toBe('900'); expect(input('Rent · Requested').value).toBe('2800');
});
it('saves new drafts by account and keeps legacy drafts untouched', () => {
  stored.set('gastos.forecast.selected11.v1', 'legacy raw draft'); render(); change(budgetMessages.en.income, '9999.123456'); click(forecastMessages.en.save);
  const saved = JSON.parse(stored.get('gastos.family-budget.v1:synthetic-A')!); expect(saved.drafts.current.income).toBe(9999.123456);
  render(rows, true, 'synthetic-B'); click(forecastMessages.en.load); expect(input(budgetMessages.en.income).value).toBe('13525.9');
  render(rows, true, 'synthetic-A'); click(forecastMessages.en.load); expect(input(budgetMessages.en.income).value).toBe('9999.12'); expect(stored.get('gastos.forecast.selected11.v1')).toBe('legacy raw draft');
});
it.each(['en', 'es', 'ja'] as const)('renders family scenarios and unknown totals with accessible controls in %s', locale => {
  stored.set('gastos.locale', locale); render([], false); const m = budgetMessages[locale];
  expect(container.querySelector('h1')!.textContent).toBe(m.title); expect(container.querySelectorAll('.fb-scenarios button')).toHaveLength(4);
  expect(container.querySelectorAll('.fb-travel-result strong')[1].textContent).toContain('—'); expect(input(m.income).disabled).toBe(false);
  expect(container.querySelector<HTMLInputElement>('[type=checkbox]')!.checked).toBe(false);
  expect(container.textContent).toContain(m.noCoverage); expect(container.innerHTML).not.toMatch(/Solo Nor|Mana|Norberto/);
  expect(container.querySelectorAll('input[type=range]')).toHaveLength(3);
});
it('retains requested amounts and visibly reports automatic changes and infeasible deficits', () => {
  render(); change(budgetMessages.en.income, '3000'); change(budgetMessages.en.savings, '0'); act(() => input(budgetMessages.en.income).blur());
  const toggle = container.querySelector<HTMLInputElement>('[type=checkbox]')!; act(() => toggle.click());
  expect(input('Tickets & transfers · Requested').value).toBe('600'); expect(container.querySelector('.fb-changes')!.textContent).toContain('600.00');
  change(budgetMessages.en.income, '1000'); expect(container.querySelector('.fb-alert')!.textContent).toContain('1,600.00'); expect(input('Rent · Requested').value).toBe('2600');
  change(budgetMessages.en.income, ''); expect(container.querySelector('[role=alert]')!.textContent).toBe(budgetMessages.en.invalid);
});
