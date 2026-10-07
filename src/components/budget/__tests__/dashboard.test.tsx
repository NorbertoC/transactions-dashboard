import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FamilyBudget from '@/components/FamilyBudget';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { budgetMessages } from '../messages';
import { forecastMessages } from '../../forecast/messages';
import { defaults, SCENARIOS, type BudgetRow } from '../model';
import { verifiedIncome } from './income-fixtures';
import type { HouseholdIncomeEvidence } from '../income';
vi.mock('../budget.css', () => ({}));
let root: Root, container: HTMLDivElement;
const stored = new Map<string, string>();
const rows: BudgetRow[] = [{ id: 'rent', category: 'Basic living', name: 'Rent', amount: 2600.004, kind: 'need', protected: true, travel: false, observed: true, count: 6 }, { id: 'tickets_transfers', category: 'Travel', name: 'Tickets & transfers', amount: 600, kind: 'want', protected: false, travel: true, observed: true, count: 5 }];
beforeEach(() => { vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) }); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); stored.clear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = (source = rows, known = true, account = 'synthetic-A', incomeEvidence: HouseholdIncomeEvidence | null = verifiedIncome) => act(() => root.render(<LocaleProvider><FamilyBudget key={account} rows={source} known={known} accountScope={account} coverage={<p>Synthetic source</p>} incomeEvidence={incomeEvidence} /></LocaleProvider>));
const input = (label: string) => [...container.querySelectorAll<HTMLInputElement>('input')].find(field => field.getAttribute('aria-label') === label)!;
const click = (label: string) => act(() => { (document.activeElement as HTMLElement)?.blur(); [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label)!.click(); });
function change(label: string, value: string) { act(() => { const field = input(label); field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); }
it('keeps calculated income read only in all scenarios while preserving savings, expenses, undo and reset', () => {
  render(); const m = budgetMessages.en;
  expect(input(m.income).readOnly).toBe(true); expect(input(m.income).value).toBe('13,492.56');
  expect(container.querySelector('.fb-income-breakdown')!.textContent).toContain('2,012.67');
  change(m.savings, '900'); change('Rent · Requested', '2800');
  render([{ ...rows[0], amount: 3000 }, rows[1]]); expect(input('Rent · Requested').value).toBe('2800'); expect(input(m.savings).value).toBe('900');
  for (const scenario of m.scenarios.slice(1)) { click(scenario); expect(input(m.income).value).toBe('9,890.66'); expect(input(m.income).readOnly).toBe(true); }
  click(m.scenarios[0]); expect(input(m.income).value).toBe('13,492.56'); expect(input(m.savings).value).toBe('900');
  click(m.reset); expect(input(m.income).value).toBe('13,492.56'); expect(input('Rent · Requested').value).toBe('3000'); click(m.undo); expect(input(m.savings).value).toBe('900'); expect(input('Rent · Requested').value).toBe('2800');
});
it('explicitly loads legacy assumptions without changing their stored income or silently using it', () => {
  const drafts = Object.fromEntries(SCENARIOS.map(id => [id, { ...defaults(id, 7777.123456), savings: 777, amounts: { rent: 2800 } }]));
  const legacy = JSON.stringify({ version: 1, drafts });
  stored.set('gastos.family-budget.v1:synthetic-A', legacy); stored.set('gastos.forecast.selected11.v1', 'legacy raw draft');
  render(); expect(input(budgetMessages.en.savings).value).toBe('2705.18');
  click(forecastMessages.en.load); expect(input(budgetMessages.en.income).value).toBe('13,492.56'); expect(input(budgetMessages.en.savings).value).toBe('777');
  expect(container.textContent).toContain(budgetMessages.en.legacyIncomeNote); expect(container.textContent).toContain('7,777.12');
  click(forecastMessages.en.save);
  const saved = JSON.parse(stored.get('gastos.family-budget.v3:synthetic-A')!); expect(saved.drafts.current.income).toBe(7777.123456); expect(saved).toMatchObject({ version: 3, taxonomyVersion: 'purpose-v4' });
  expect(stored.get('gastos.family-budget.v1:synthetic-A')).toBe(legacy); expect(stored.get('gastos.forecast.selected11.v1')).toBe('legacy raw draft');
  render(rows, true, 'synthetic-B'); click(forecastMessages.en.load); expect(input(budgetMessages.en.savings).value).toBe('2705.18');
  render(); click(forecastMessages.en.load); expect(input(budgetMessages.en.savings).value).toBe('777'); expect(input(budgetMessages.en.income).value).toBe('13,492.56');
});
it('refreshes calculated receipts without overriding an expense or saving draft', () => {
  render(); change(budgetMessages.en.savings, '900'); change('Rent · Requested', '2800');
  render(rows, true, 'synthetic-A', { ...verifiedIncome, selectedCents: verifiedIncome.selectedCents + 6000 });
  expect(input(budgetMessages.en.income).value).toBe('13,502.56'); expect(input(budgetMessages.en.savings).value).toBe('900'); expect(input('Rent · Requested').value).toBe('2800');
  render(rows, true, 'synthetic-A', null); expect(input(budgetMessages.en.income).value).toBe('—'); expect(container.querySelectorAll('.fb-travel-result strong')[1].textContent).toContain('—');
  expect(input(budgetMessages.en.savings).value).toBe('900');
});
it.each(['en', 'es', 'ja'] as const)('renders localized read-only income and unknown totals with accessible controls in %s', locale => {
  stored.set('gastos.locale', locale); render([], false, 'synthetic-A', null); const m = budgetMessages[locale];
  expect(container.querySelector('h1')!.textContent).toBe(m.title); expect(container.querySelectorAll('.fb-scenarios button')).toHaveLength(4);
  expect(container.querySelectorAll('.fb-travel-result strong')[1].textContent).toContain('—'); expect(input(m.income).readOnly).toBe(true); expect(input(m.income).value).toBe('—');
  expect(container.textContent).toContain(m.incomeUnavailable); expect(container.innerHTML).not.toMatch(/Solo Nor|Mana|Norberto/);
  expect(container.querySelectorAll('input[type=range]')).toHaveLength(2);
});
it('retains requested amounts and visibly reports automatic changes and infeasible deficits', () => {
  render(); change(budgetMessages.en.savings, '0'); change('Rent · Requested', '14000');
  const toggle = container.querySelector<HTMLInputElement>('[type=checkbox]')!; act(() => toggle.click());
  expect(input('Tickets & transfers · Requested').value).toBe('600'); expect(container.querySelector('.fb-changes')!.textContent).toContain('600.00');
  expect(container.querySelector('.fb-alert')!.textContent).toContain('507.44'); expect(input('Rent · Requested').value).toBe('14000');
  change(budgetMessages.en.savings, ''); expect(container.querySelector('[role=alert]')!.textContent).toBe(budgetMessages.en.invalid);
});

it.each([
  { version: 1, taxonomyVersion: undefined, legacy: true },
  { version: 2, taxonomyVersion: undefined, legacy: true },
  { version: 2, taxonomyVersion: 'purpose-v3', legacy: true },
  { version: 2, taxonomyVersion: 'purpose-v4', legacy: false },
])('preserves explicit legacy loads and category overrides for $version/$taxonomyVersion', ({ version, taxonomyVersion, legacy }) => {
  const mixedId = JSON.stringify(['Outings & entertainment', 'Meals & treats']);
  const originalId = legacy ? 'food_treats' : 'restaurants';
  const targetId = legacy ? mixedId : 'restaurants';
  const original = Object.fromEntries(SCENARIOS.map(id => [id, { ...defaults(id, 9000), savings: 555, amounts: { [originalId]: 123.45 }, kinds: { [originalId]: 'want' }, lastEdited: originalId }]));
  const key = `gastos.family-budget.v${version}:synthetic-A`, raw = JSON.stringify({ version, taxonomyVersion, drafts: original });
  stored.set(key, raw);
  const source = { ...rows[1], id: targetId, category: legacy ? 'Outings & entertainment' : 'Meals & outings', name: legacy ? 'Meals & treats' : 'Restaurants', protected: legacy, travel: false };
  render([rows[0], source]);
  expect(input(budgetMessages.en.savings).value).toBe('2705.18');
  click(forecastMessages.en.load);
  expect(input(`${source.name} · Requested`).value).toBe('123.45');
  expect(input(budgetMessages.en.income).value).toBe('13,492.56');
  expect(input(budgetMessages.en.savings).value).toBe('555');
  expect(container.textContent).toContain(budgetMessages.en.legacyIncomeNote);
  click(forecastMessages.en.save);
  const saved = JSON.parse(stored.get('gastos.family-budget.v3:synthetic-A')!);
  expect(saved).toMatchObject({ version: 3, taxonomyVersion: 'purpose-v4', legacyIncomePreserved: true });
  expect(saved.drafts.current).toMatchObject({ income: 9000, savings: 555, amounts: { [targetId]: 123.45 }, kinds: { [targetId]: 'want' }, lastEdited: targetId });
  expect(stored.get(key)).toBe(raw);
  render([rows[0], source], true, 'synthetic-B'); click(forecastMessages.en.load);
  expect(input(budgetMessages.en.savings).value).toBe('2705.18');
});
it('loads the newest schema without re-keying narrower v4 purposes or overwriting older saves', () => {
  const makeDrafts = (amount: number) => Object.fromEntries(SCENARIOS.map(id => [id, { ...defaults(id, 8888), amounts: { food_treats: amount } }]));
  const older = JSON.stringify({ version: 2, taxonomyVersion: 'purpose-v4', drafts: makeDrafts(42) });
  stored.set('gastos.family-budget.v2:synthetic-A', older);
  stored.set('gastos.family-budget.v3:synthetic-A', JSON.stringify({ version: 3, taxonomyVersion: 'purpose-v4', drafts: makeDrafts(77), legacyIncomePreserved: true }));
  render(); click(forecastMessages.en.load); click(forecastMessages.en.save);
  const saved = JSON.parse(stored.get('gastos.family-budget.v3:synthetic-A')!);
  expect(saved.drafts.current.amounts).toEqual({ food_treats: 77 });
  expect(saved.drafts.current.income).toBe(8888);
  expect(stored.get('gastos.family-budget.v2:synthetic-A')).toBe(older);
});
it('rejects unknown taxonomy metadata without replacing current edits or changing the stored draft', () => {
  const raw = JSON.stringify({ version: 3, taxonomyVersion: 'purpose-unknown', drafts: Object.fromEntries(SCENARIOS.map(id => [id, defaults(id)]) ) });
  stored.set('gastos.family-budget.v3:synthetic-A', raw);
  render(); change(budgetMessages.en.savings, '456'); click(forecastMessages.en.load);
  expect(input(budgetMessages.en.savings).value).toBe('456');
  expect(container.textContent).toContain(budgetMessages.en.storageFailed);
  expect(stored.get('gastos.family-budget.v3:synthetic-A')).toBe(raw);
});
