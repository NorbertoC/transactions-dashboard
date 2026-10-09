import { afterEach, expect, it, vi } from 'vitest';
import { CATEGORIES, getLocalizedCategoryName } from '@/constants/categories';
import { LEGACY_CATEGORIES } from '@/constants/legacy-categories';
import { resolveCategoryView, matchesCategoryView, editorPair, categoryViewOptions, viewCategoryLabel } from '@/utils/category-view';
import { buildDashboard } from '@/utils/dashboard';
import { buildMesaReading } from '@/utils/mesa-reading';
import { buildCategoryComparison } from '@/utils/category-comparison';
import { useFilteredTransactions } from '@/hooks/useTransactions';
import { ApiService } from '@/services/api';
import { saveVerifiedCategory } from '@/utils/category-review';
import { budgetEvidence, defaults, preservePurposeV4Draft, calculate } from '@/components/budget/model';
import type { Transaction } from '@/types/transaction';

const row = (id: number, category: string, subcategory?: string): Transaction => ({ id, category, subcategory, value: 10, amount: '10.00', currency: 'NZD', place: 'Synthetic fixture', date: '2026-01-15', date_iso: '2026-01-15', record_type: 'expense', direction: 'outflow', category_source: 'manual', statement_id: '2026-01-26', statement_start: '2025-12-27', statement_end: '2026-01-26' });
const dashboard = (rows: Transaction[]) => buildDashboard(rows, '2026-01-01', '2026-01-31', true, 'NZD', '2026-02-01');
afterEach(() => vi.unstubAllGlobals());

it('resolves all 297 current language combinations to stable pair IDs without changing rows', () => {
  for (const group of CATEGORIES) for (const sub of group.subcategories) for (const category of [group.name, group.nameEs, group.nameJa]) for (const subcategory of [sub.name, sub.nameEs, sub.nameJa]) {
    const source = row(1, category, subcategory), before = structuredClone(source);
    expect(resolveCategoryView(source)).toMatchObject({ groupId: group.key, subcategoryId: sub.key });
    expect(source).toEqual(before);
    expect(resolveCategoryView(row(2, getLocalizedCategoryName(group.name, 'en'), sub.name))).toMatchObject({ groupId: group.key, subcategoryId: sub.key });
  }
});
it('reconciles every v4 pair across languages, retaining the four mixed buckets instead of assigning subtypes', () => {
  let equivalent = 0, historical = 0;
  for (const group of LEGACY_CATEGORIES) for (const sub of group.subcategories) {
    const expected = resolveCategoryView(row(1, group.name, sub.name));
    if (expected.status === 'historical') historical++; else equivalent++;
    for (const category of [group.name, group.nameEs, group.nameJa]) for (const subcategory of [sub.name, sub.nameEs, sub.nameJa]) {
      const source = row(1, category, subcategory), before = structuredClone(source);
      expect(resolveCategoryView(source)).toMatchObject({ groupId: expected.groupId, subcategoryId: expected.subcategoryId });
      expect(source).toEqual(before);
    }
  }
  expect(equivalent).toBe(22); expect(historical).toBe(4);
});
it('keeps grouping, selection, filters, reading and comparisons coherent across equivalent eating-out labels', () => {
  const rows = [row(1, 'Meals & outings', 'Restaurants'), row(2, 'Meals & outings', 'Cafés'), row(3, 'Comidas y salidas', 'Salir a comer'), row(4, '外食・食の楽しみ', '外食'), row(5, 'Travel', 'Accommodation')], before = structuredClone(rows);
  const data = dashboard(rows);
  expect(data.total).toBe(50); expect(data.categories.find(group => group.id === 'meals_outings')?.total).toBe(40);
  expect(useFilteredTransactions(rows, null, null, 'meals_outings').map(row => row.id)).toEqual([1, 2, 3, 4]);
  expect(useFilteredTransactions(rows, '2026-01-16', null, 'meals_outings')).toEqual([]);
  expect(buildMesaReading(data.expenses, data.monthly, 'meals_outings').rows).toMatchObject([{ id: 'eating_out', name: 'Eating out', total: 40, count: 4 }]);
  expect(categoryViewOptions(rows, 'meals_outings')).toHaveLength(1);
  expect(buildCategoryComparison(rows, 'meals_outings', 'eating_out')).toMatchObject([{ total: 40, count: 4 }]);
  expect(rows).toEqual(before);
});
it('unifies work aliases that have the same Japanese display text while retaining mixed purposes for review', () => {
  const rows = [row(1, 'Work & learning', 'Software & tools'), row(2, 'Work & Study', 'API usage'), row(3, 'Trabajo y estudio', 'Consumo de API'), row(4, '仕事・学習', 'APIの使用量')];
  const data = dashboard(rows); expect(data.categories).toHaveLength(1); expect(data.categories[0]).toMatchObject({ id: 'work_learning', total: 40 });
  expect(new Set(rows.map(row => viewCategoryLabel(resolveCategoryView(row), 'ja'))).size).toBe(1);
  expect(buildMesaReading(rows, data.monthly, 'work_learning').rows.find(row => row.historical)).toMatchObject({ name: 'Software & tools', total: 10 });
});
it('preserves precise original work purposes before the API service can collapse them into a mixed bucket', async () => {
  const rows = [row(1, 'Work & learning', 'Work equipment'), row(2, 'Work & learning', 'Education & training')].map(row => ({ ...row, category_source: 'imported' as const }));
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(rows)));
  for (let i = 0; i < 3; i++) {
    const refreshed = await ApiService.fetchTransactionsClient(); expect(refreshed).toEqual(rows);
    expect(refreshed.map(row => resolveCategoryView(row).subcategoryId)).toEqual(['work_equipment', 'courses_study']);
  }
});
it('does not split mixed purposes or assign undecided car purposes using merchant text', () => {
  for (const [category, subcategory] of [['Basic living', 'Transport'], ['Work & learning', 'Equipment & training'], ['Travel', 'Tickets & transfers'], ['Transport', 'Insurance'], ['Car', 'Car maintenance']]) {
    const source = { ...row(1, category, subcategory), place: 'UBER OPENAI RESTAURANT' };
    const view = resolveCategoryView(source); expect(view.status).toBe('historical'); expect(view.subcategoryId).toMatch(/^historical:/);
    expect(editorPair(source, view.groupId, view.subcategoryId)).toEqual({ category, subcategory }); expect(dashboard([source]).total).toBe(10);
  }
  expect(resolveCategoryView(row(1, 'Transport', 'Fuel'))).toMatchObject({ groupId: 'basic_living', subcategoryId: 'fuel' });
  expect(resolveCategoryView(row(1, 'Transport', 'Taxi & Rideshare'))).toMatchObject({ groupId: 'personal_purchases', subcategoryId: 'occasional_mobility' });
});
it('groups exact translations of the same historical bucket once and permits an explicit canonical selection', () => {
  const rows = [row(1, 'Work & learning', 'Software & tools'), row(2, 'Trabajo y formación', 'Software y herramientas'), row(3, '仕事・学習', 'ソフトウェア・ツール')];
  const reading = buildMesaReading(rows, dashboard(rows).monthly, 'work_learning');
  expect(reading.rows).toHaveLength(1); expect(reading.rows[0]).toMatchObject({ historical: true, total: 30 });
  const original = row(4, 'Meals & outings', 'Restaurants');
  expect(editorPair(original, 'meals_outings', 'eating_out', true)).toEqual({ category: 'Meals & outings', subcategory: 'Eating out' });
});
it('preserves literal manual custom, empty, missing and null values and does not invent a cross-group pair', () => {
  const rows = [row(1, '  My exact group  ', '  My exact purpose  '), row(2, '', ''), row(3, 'Others'), { ...row(4, 'Others'), subcategory: null }, row(5, 'Work & Study', 'Eating out')] as Transaction[];
  const before = structuredClone(rows); expect(dashboard(rows).total).toBe(50);
  for (const source of rows) { const view = resolveCategoryView(source); expect(editorPair(source, view.groupId, view.subcategoryId)).toEqual({ category: source.category, subcategory: source.subcategory ?? '' }); }
  expect(matchesCategoryView(rows[0], 'My exact group')).toBe(false);
  expect(editorPair(rows[4], 'work_learning', 'eating_out')).toBeNull(); expect(rows).toEqual(before);
});
it('rejects newly invalid and arbitrary pairs before any request while allowing an unchanged historical pair', async () => {
  const source = row(1, 'Meals & outings', 'Restaurants'), fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  for (const [category, subcategory] of [['Work & Study', 'Eating out'], ['Meals & outings', 'Cafés'], ['Unknown', 'Random'], ['Meals & outings', '']]) await expect(saveVerifiedCategory(source, category, subcategory)).rejects.toMatchObject({ reason: 'saveFailed' });
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps totals and equivalent IDs invariant after explicit save confirmation and three client reloads', async () => {
  let rows = [row(1, 'Meals & outings', 'Restaurants'), row(2, 'Meals & outings', 'Cafés'), row(3, 'Comidas y salidas', 'Salir a comer')];
  const before = structuredClone(rows), writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') { const pair = JSON.parse(String(init.body)); writes.push(pair); rows = rows.map(row => row.id === 1 ? { ...row, ...pair, category_source: 'manual' } : row); return Response.json({}); }
    if (url.includes('taxonomy')) return Response.json({ version: 'purpose-v5', manual_category_persistence: true, categories: CATEGORIES.map(({ key, name, subcategories }) => ({ key, name, subcategories: subcategories.map(({ key, name }) => ({ key, name })) })) });
    return Response.json(rows);
  }));
  await saveVerifiedCategory(rows[0], 'Meals & outings', 'Eating out');
  for (let i = 0; i < 3; i++) {
    const refreshed = await ApiService.fetchTransactionsClient(), data = dashboard(refreshed);
    expect(data.categories).toHaveLength(1); expect(data.total).toBe(30);
    expect(buildMesaReading(refreshed, data.monthly, 'meals_outings').rows).toMatchObject([{ id: 'eating_out', total: 30 }]);
    expect(refreshed).toEqual([{ ...before[0], subcategory: 'Eating out' }, ...before.slice(1)]);
  }
  expect(writes).toEqual([{ category: 'Meals & outings', subcategory: 'Eating out' }]);
});
it('does not merge or overwrite historical budget drafts when equivalent labels unify in Mesa', () => {
  const rows = [row(1, 'Meals & outings', 'Restaurants'), row(2, 'Meals & outings', 'Cafés')];
  const saved = { ...defaults('single'), amounts: { restaurants: 123, cafes: 45 }, kinds: {}, income: 1000, savings: 0 }, before = structuredClone(saved);
  const draft = preservePurposeV4Draft(saved), source = budgetEvidence(rows, '2026-02-01');
  const result = calculate(draft, source.rows, true);
  expect(result.spending).toBe(168); expect(saved).toEqual(before);
  expect(dashboard(rows).categories).toHaveLength(1); expect(buildMesaReading(rows, dashboard(rows).monthly, 'meals_outings').rows).toHaveLength(1);
});
