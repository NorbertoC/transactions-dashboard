import { CATEGORIES, normalizeCategoryPair } from '@/constants/categories';
import { isIsoDate } from '@/lib/api-validation';
import type { Transaction } from '@/types/transaction';
import { currentYearExpenseEvidence } from '@/utils/expense-evidence';

export const SCENARIOS = ['current', 'single', 'baby1', 'baby2'] as const;
export type Scenario = typeof SCENARIOS[number];
export type Kind = 'need' | 'want' | 'unknown';
export interface BudgetRow { id: string; category: string; name: string; amount: number; kind: Kind; protected: boolean; travel: boolean; observed: boolean; count: number; }
export interface Draft { income: number | null; savings: number | null; baby: number | null; auto: boolean; amounts: Record<string, number | null>; kinds: Record<string, Kind>; lastEdited: string | null; }
/** Re-key a device draft in memory; preserve old mixed buckets instead of splitting amounts. */
export function preservePurposeV3Draft(draft: Draft): Draft {
  const legacyIds: Record<string, string> = {
    food_treats: JSON.stringify(['Outings & entertainment', 'Meals & treats']),
    activities_entertainment: JSON.stringify(['Outings & entertainment', 'Activities & entertainment']),
    streaming_content: JSON.stringify(['Personal subscriptions', 'Streaming & content']),
    memberships_services: JSON.stringify(['Personal subscriptions', 'Memberships & other services']),
  };
  const rekey = <T,>(items: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(items).map(([key, value]) => [legacyIds[key] ?? key, value]));
  return { ...draft, amounts: rekey(draft.amounts), kinds: rekey(draft.kinds), lastEdited: draft.lastEdited === null ? null : legacyIds[draft.lastEdited] ?? draft.lastEdited };
}
export function defaults(scenario: Scenario, income: number | null = null): Draft {
  return { income, savings: scenario === 'current' ? 2705.18 : 1984.80,
    baby: scenario === 'baby1' ? 800 : scenario === 'baby2' ? 1400 : 0, auto: false, amounts: {}, kinds: {}, lastEdited: null };
}
const NEEDS = new Set(['rent', 'power_internet', 'home_food', 'transport', 'phone', 'health', 'software_tools', 'equipment_training', 'subscription_work']);
const PROTECTED = new Set(['rent', 'power_internet', 'home_food', 'transport', 'phone', 'health', 'home_purchases', 'software_tools', 'equipment_training', 'subscription_work']);
const CUT_ORDER = ['tickets_transfers', 'accommodation', 'travel_food_activities', 'restaurants', 'cafes', 'delivery', 'food_treats', 'video_games', 'cinema', 'events', 'activities', 'subscription_entertainment', 'subscription_other', 'clothing_footwear', 'personal_care'];
export function budgetEvidence(transactions: Transaction[], today: string) {
  const period = currentYearExpenseEvidence(transactions, today);
  // Reuse the expense-derived calendar window for receipts too.
  const incomeCents = transactions.filter(row => ['NZD', 'NZ$'].includes(row.currency) && isIsoDate(row.date_iso) && row.date_iso >= period.start && row.date_iso <= period.end && row.record_type === 'income' && row.direction === 'inflow' && Number.isFinite(row.value) && row.value >= 0).reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const groups = new Map<string, BudgetRow>();
  for (const row of period.data.expenses) {
    const pair = normalizeCategoryPair(row.category, row.subcategory, row.category_source);
    const category = CATEGORIES.find(group => group.name === pair.category);
    const sub = category?.subcategories.find(item => item.name === pair.subcategory);
    const id = sub && category?.key !== 'others' ? sub.key : JSON.stringify([pair.category, pair.subcategory]);
    const prior = groups.get(id);
    if (prior) { prior.amount += row.value; prior.count++; }
    else groups.set(id, { id, category: pair.category, name: pair.subcategory || pair.category, amount: row.value,
      kind: sub && category?.key !== 'others' ? NEEDS.has(id) ? 'need' : 'want' : 'unknown',
      protected: PROTECTED.has(id) || !sub || category?.key === 'others', travel: category?.key === 'travel', observed: true, count: 1 });
  }
  const rows = [...groups.values()].map(row => ({ ...row, amount: row.amount / period.data.denominator }));
  return { ...period, incomeCents, rows,
    known: period.expense !== null, total: period.expense };
}
export function calculate(draft: Draft, source: BudgetRow[], known: boolean) {
  const rows = source.map(row => ({ ...row, amount: Object.hasOwn(draft.amounts, row.id) ? draft.amounts[row.id] : row.amount, kind: draft.kinds[row.id] ?? row.kind }));
  rows.push({ id: 'baby', category: 'family', name: 'baby', amount: draft.baby, kind: 'need', protected: true, travel: false, observed: false, count: 0 });
  const valid = [draft.income, draft.savings, ...rows.map(row => row.amount)].every(value => value !== null && Number.isFinite(value) && value >= 0 && value <= 1000000);
  const income = draft.income ?? 0, savings = draft.savings ?? 0;
  const proposed = rows.map(row => ({ ...row, amount: row.amount ?? 0, proposed: row.amount ?? 0 }));
  const changes: { id: string; from: number; to: number }[] = [];
  let shortage = Math.max(0, proposed.reduce((sum, row) => sum + row.proposed, 0) + savings - income);
  if (valid && known && draft.auto) {
    for (const id of CUT_ORDER) {
      const row = proposed.find(item => item.id === id);
      if (!row || row.protected || row.kind !== 'want' || row.id === draft.lastEdited || !shortage) continue;
      const cut = Math.min(shortage, row.proposed);
      row.proposed -= cut; shortage -= cut;
      if (cut > 0) changes.push({ id: row.id, from: row.amount, to: row.proposed });
    }
  }
  const sum = (predicate: (row: typeof proposed[number]) => boolean) => proposed.filter(predicate).reduce((sum, row) => sum + row.proposed, 0);
  const travel = sum(row => row.travel), costs = sum(row => !row.travel), spending = costs + travel, committed = spending + savings;
  const needs = sum(row => !row.travel && row.kind === 'need'), otherWants = sum(row => !row.travel && row.kind === 'want'), unknown = sum(row => !row.travel && row.kind === 'unknown');
  const capacity = Math.max(0, income - costs - savings), unallocated = Math.max(0, income - committed), gap = Math.max(0, committed - income);
  const rent = proposed.find(row => row.id === 'rent')?.proposed ?? null;
  return { valid, known, rows: proposed, income, savings, costs, needs, otherWants, unknown, travel, spending, committed, capacity, annualCapacity: capacity * 12, annualTravel: travel * 12, unallocated, gap, changes,
    needsGuide: income * .5, wantsGuide: income * .3, savingsGuide: income * .2,
    rent, rentMax: rent === null ? null : Math.max(0, income * .5 - (needs - rent)) };
}
export type Result = ReturnType<typeof calculate>;
export function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const d = value as Draft;
  const amount = (n: unknown) => n === null || typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000000;
  return amount(d.income) && amount(d.savings) && amount(d.baby) && typeof d.auto === 'boolean' && (d.lastEdited === null || typeof d.lastEdited === 'string') && !!d.amounts && typeof d.amounts === 'object' && !Array.isArray(d.amounts) && Object.values(d.amounts).every(amount) && !!d.kinds && typeof d.kinds === 'object' && !Array.isArray(d.kinds) && Object.values(d.kinds).every(kind => ['need', 'want', 'unknown'].includes(kind));
}
