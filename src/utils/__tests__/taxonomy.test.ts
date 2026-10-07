import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, getTaxonomyPair, getLocalizedCategoryName, getLocalizedSubcategoryName, normalizeCategoryPair } from '@/constants/categories';
import { previewCategoryChanges } from '@/utils/category-preview';
import { ApiService } from '@/services/api';
import { buildDashboard, isRent } from '@/utils/dashboard';
import type { Transaction } from '@/types/transaction';

const row = (id: number, category: string, subcategory: string, extra: Partial<Transaction> = {}): Transaction => ({ id, category, subcategory, place: 'Synthetic fixture', value: 10, amount: '10', date: '', date_iso: '2026-01-10', currency: 'NZ$', ...extra });
afterEach(() => vi.unstubAllGlobals());

describe('seven purpose groups and preserved evidence', () => {
  it('renames personal purchases and Home with stable keys while essentials stay in Basic living', () => {
    expect(getTaxonomyPair('personal_purchases', 'home_purchases')).toEqual({ category: 'Personal purchases', subcategory: 'Home' });
    expect(getLocalizedCategoryName('Personal purchases', 'es')).toBe('Compras personales');
    expect(getLocalizedSubcategoryName('Home', 'es')).toBe('Hogar');
    expect(getLocalizedCategoryName('Personal purchases', 'ja')).toBe('個人の買い物');
    expect(normalizeCategoryPair('Housing', 'Household items')).toEqual({ category: 'Personal purchases', subcategory: 'Home' });
    expect(normalizeCategoryPair('Housing', 'Rent')).toEqual({ category: 'Basic living', subcategory: 'Rent' });
    expect(normalizeCategoryPair('Housing', 'Utilities')).toEqual({ category: 'Basic living', subcategory: 'Power & internet' });
    expect(normalizeCategoryPair('Groceries', 'Food')).toEqual({ category: 'Basic living', subcategory: 'Food for home' });
    expect(normalizeCategoryPair('Personal needs & purchases', 'Purchases for home')).toEqual({ category: 'Personal purchases', subcategory: 'Home' });
    for (const [category, subcategory] of [['Personal needs & purchases', 'Purchases for home'], ['Housing', 'Household items'], ['Housing', 'My custom purpose']]) {
      expect(normalizeCategoryPair(category, subcategory, 'manual')).toEqual({ category, subcategory });
    }
  });
  it('offers exactly seven purpose groups plus review and separate savings', () => {
    expect(CATEGORIES.filter(cat => !['Others', 'Savings'].includes(cat.name)).map(cat => cat.name)).toEqual(['Basic living', 'Personal purchases', 'Work & learning', 'Subscriptions', 'Meals & outings', 'Entertainment', 'Travel']);
    expect(CATEGORIES.slice(0, 7).flatMap(group => group.subcategories)).toHaveLength(25);
    expect(new Set(CATEGORIES.map(group => group.key)).size).toBe(8);
    expect(CATEGORIES.some(cat => cat.subcategories.some(sub => sub.name === 'Subscriptions' || sub.name === 'Personal Allowance'))).toBe(false);
    for (const cat of CATEGORIES) {
      expect(cat.nameJa).toBeTruthy(); expect(cat.nameEs).toBeTruthy();
      for (const sub of cat.subcategories) { expect(sub.nameJa).toBeTruthy(); expect(sub.nameEs).toBeTruthy(); }
    }
    expect(getLocalizedCategoryName('Work & learning', 'es')).toBe('Trabajo y formación');
    expect(getLocalizedCategoryName('Outings & entertainment', 'ja')).toBe('外出・娯楽');
    expect(getLocalizedSubcategoryName('Subscriptions', 'ja')).toBe('サブスク');
  });
  it('projects unambiguous legacy purpose and flags mixed buckets without assigning work', () => {
    expect(normalizeCategoryPair('Housing', 'Rent')).toEqual({ category: 'Basic living', subcategory: 'Rent' });
    expect(normalizeCategoryPair('Groceries', 'Medicine & Supplements')).toEqual({ category: 'Personal purchases', subcategory: 'Health' });
    for (const [cat, sub] of [['Fun & Social', 'Subscriptions'], ['Personal spending', 'Hobbies & Shopping']]) {
      expect(normalizeCategoryPair(cat, sub)).toEqual({ category: 'Others', subcategory: 'Miscellaneous' });
    }
    expect(normalizeCategoryPair('Personal spending', 'Personal Allowance')).toEqual({ category: 'Others', subcategory: 'Miscellaneous' });
    expect(normalizeCategoryPair('Entertainment', 'User-defined purpose')).toEqual({ category: 'Entertainment', subcategory: 'User-defined purpose' });
  });
  it('preserves explicit manual legacy/custom choices in the client and preview', async () => {
    const rows = [row(1, 'Shopping', 'Clothing', { category_source: 'manual' }), row(2, 'Fun & Social', 'Subscriptions', { category_source: 'manual' }), row(3, 'Custom bucket', 'Custom purpose', { category_source: 'manual' })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(rows))));
    const result = await ApiService.fetchTransactionsClient();
    expect(result.map(({ category, subcategory, category_source }) => ({ category, subcategory, category_source }))).toEqual(rows.map(({ category, subcategory, category_source }) => ({ category, subcategory, category_source })));
    expect(previewCategoryChanges(rows).every(change => change.protectedRecord && !change.changed)).toBe(true);
    expect(rows[0].category).toBe('Shopping');
  });
  it('leaves income/transfer provenance and financial fields intact, without duplicate transfer expenses', async () => {
    const rows = [row(1, 'Housing', 'Rent', { record_type: 'expense', direction: 'outflow' }), row(2, 'Income', '', { record_type: 'income', direction: 'inflow', owner: 'Synthetic owner', income_source: 'Synthetic payer' }), row(3, 'Transfer', '', { record_type: 'transfer', direction: 'outflow' }), row(4, 'Transfer', '', { record_type: 'transfer', direction: 'inflow' })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(rows))));
    const result = await ApiService.fetchTransactionsClient('all');
    expect(result.slice(1)).toEqual(rows.slice(1));
    expect(result.map(({ id, value, amount, date_iso, currency }) => ({ id, value, amount, date_iso, currency }))).toEqual(rows.map(({ id, value, amount, date_iso, currency }) => ({ id, value, amount, date_iso, currency })));
    expect(buildDashboard(result, '2026-01-01', '2026-01-31', true, 'NZD', '2026-10-05').total).toBe(10);
    expect(previewCategoryChanges(rows).slice(1).every(change => !change.changed)).toBe(true);
    expect(isRent(result[0])).toBe(true); expect(isRent(rows[0])).toBe(true);
    expect(buildDashboard(result, '2026-01-01', '2026-01-31', false, 'NZD', '2026-10-05').total).toBe(0);
    expect(rows[0].category).toBe('Housing');
  });
  it('produces a read-only review plan without inventing essential or recurrence attributes', () => {
    const records = [row(1, 'Personal spending', 'Personal Allowance'), row(2, 'Housing', 'Rent'), row(3, 'Savings', 'Savings')];
    const original = JSON.stringify(records); const preview = previewCategoryChanges(records);
    expect(preview[0]).toMatchObject({ needsReview: true, proposed: { category: 'Others', subcategory: 'Miscellaneous' } });
    expect(preview[1].needsReview).toBe(false); expect(preview[2].changed).toBe(false);
    expect(JSON.stringify(records)).toBe(original);
    expect(preview[0]).not.toHaveProperty('expense_flexibility'); expect(records[0]).not.toHaveProperty('cadence');
  });
});

it('retains all manual purpose subcategories on repeated client reloads without merchant fallback', async () => {
  const pairs = CATEGORIES.slice(0, 7).flatMap(group => group.subcategories.map(sub => [group.name, sub.name]));
  expect(pairs).toHaveLength(25);
  pairs.push(['Dining', 'Restaurants'], ['Shopping', 'Clothing'], ['Fun & Social', 'Subscriptions'], ['Custom bucket', 'Custom purpose']);
  const rows = pairs.map(([category, subcategory], index) => row(index + 1, category, subcategory, {
    category_source: 'manual', record_type: 'expense', direction: 'outflow', place: 'NETFLIX CHEMIST WAREHOUSE',
    statement_id: '2026-01-26', statement_start: '2025-12-27', statement_end: '2026-01-26'
  }));
  const original = structuredClone(rows);
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(rows))));
  for (let reload = 0; reload < 3; reload++) {
    expect(await ApiService.fetchTransactionsClient('all')).toEqual(original);
    expect(rows).toEqual(original);
  }
});

it('preserves manual blank/legacy/custom pairs and nonmanual custom subcategories without wildcard guesses', () => {
  for (const [category, subcategory] of [['Housing', 'User-defined purpose'], ['Groceries', 'Custom essential'], ['Entertainment', 'Custom activity'], ['Basic living', ''], ['Custom bucket', '']]) {
    expect(normalizeCategoryPair(category, subcategory, 'manual')).toEqual({ category, subcategory });
    expect(normalizeCategoryPair(category, subcategory)).toEqual({ category, subcategory });
  }
  expect(normalizeCategoryPair('', '', 'manual')).toEqual({ category: '', subcategory: '' });
  expect(normalizeCategoryPair('Housing', 'Rent', 'manual')).toEqual({ category: 'Housing', subcategory: 'Rent' });
  expect(normalizeCategoryPair('Transport', 'Fuel')).toEqual({ category: 'Basic living', subcategory: 'Transport' });
  expect(normalizeCategoryPair('Transport', 'Insurance')).toEqual({ category: 'Basic living', subcategory: 'Transport' });
});

it('keeps the dry run read-only, manual-safe and separated from actual financial fields', () => {
  const records = [row(1, 'Others', 'Miscellaneous', { place: 'ALFAJORES ONLINE' }), row(2, 'Others', '', { place: 'PAYPAL *ALFAJORES' }), row(3, 'Housing', 'Rent', { category_source: 'manual', place: 'OPENAI' }), row(4, 'Income', '', { place: 'NETFLIX' })];
  const snapshot = structuredClone(records);
  const preview = previewCategoryChanges(records);
  expect(preview[0]).toMatchObject({ taxonomyVersion: 'purpose-v4', needsReview: true, requiresConfirmation: true, suggestion: { category: 'Meals & outings', subcategory: 'Treats & alfajores', requiresConfirmation: true } });
  expect(preview[1]).toMatchObject({ protectedRecord: true, changed: false, requiresConfirmation: false, suggestion: null });
  for (const protectedRow of preview.slice(2)) {
    expect(protectedRow).toMatchObject({ protectedRecord: true, changed: false, requiresConfirmation: false, suggestion: null });
  }
  expect(records).toEqual(snapshot);
  expect(preview[0]).not.toHaveProperty('place');
  expect(preview[0]).not.toHaveProperty('value');
});

it('resolves stable keys to exact canonical pairs and rejects cross-group subkeys', () => {
  for (const group of CATEGORIES) for (const sub of group.subcategories) expect(getTaxonomyPair(group.key, sub.key)).toEqual({ category: group.name, subcategory: sub.name });
  expect(getTaxonomyPair('basic_living', 'software_tools')).toBeNull();
  expect(getTaxonomyPair('unknown', 'rent')).toBeNull();
});

it('keeps mixed v3 and older affected pairs literal through repeated reads without guessing a split', async () => {
  const pairs = [
    ['Outings & entertainment', 'Meals & treats'], ['Outings & entertainment', 'Activities & entertainment'],
    ['Personal subscriptions', 'Streaming & content'], ['Personal subscriptions', 'Memberships & other services'],
    ['Work & learning', 'Software & tools'], ['Entertainment', 'Gaming'], ['Entertainment', 'Streaming'], ['Fun & Social', 'Eating out'],
  ];
  const records = pairs.map(([category, subcategory], id) => row(id + 1, category, subcategory, { place: 'OPENAI NETFLIX RESTAURANT PLAYSTATION', category_source: 'imported', statement_id: '2026-01-26', statement_start: '2025-12-27', statement_end: '2026-01-26' }));
  const original = structuredClone(records);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(records))));
  for (let attempt = 0; attempt < 3; attempt++) expect(await ApiService.fetchTransactionsClient()).toEqual(original);
  const preview = previewCategoryChanges(records);
  expect(preview.every(item => !item.changed)).toBe(true);
  expect(preview[0]).toMatchObject({ needsReview: true, proposed: { category: 'Outings & entertainment', subcategory: 'Meals & treats' } });
  expect(preview[5].needsReview).toBe(true);
  expect(records).toEqual(original);
});

it('preserves intentional blanks, null subcategories and literal whitespace in custom/manual evidence', async () => {
  const records = [row(1, '', ''), row(2, '  My custom group  ', '  Exact purpose  '), row(3, ' Housing ', ' Rent ', { category_source: 'manual' }),
    { ...row(4, 'Personal subscriptions', ''), subcategory: null }].map(item => ({ ...item, statement_id: '2026-01-26', statement_start: '2025-12-27', statement_end: '2026-01-26' })) as unknown as Transaction[];
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(records))));
  expect(await ApiService.fetchTransactionsClient()).toEqual(records);
  expect(previewCategoryChanges(records.slice(0, 1))).toMatchObject([{ protectedRecord: true, changed: false, suggestion: null }]);
});
