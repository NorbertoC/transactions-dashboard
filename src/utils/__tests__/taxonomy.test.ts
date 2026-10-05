import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, getLocalizedCategoryName, getLocalizedSubcategoryName, normalizeCategoryPair } from '@/constants/categories';
import { previewCategoryChanges } from '@/utils/category-preview';
import { ApiService } from '@/services/api';
import { buildDashboard, isRent } from '@/utils/dashboard';
import type { Transaction } from '@/types/transaction';

const row = (id: number, category: string, subcategory: string, extra: Partial<Transaction> = {}): Transaction => ({ id, category, subcategory, place: 'Synthetic fixture', value: 10, amount: '10', date: '', date_iso: '2026-01-10', currency: 'NZ$', ...extra });
afterEach(() => vi.unstubAllGlobals());

describe('four purpose groups and preserved evidence', () => {
  it('offers exactly four purpose groups plus review and separate savings', () => {
    expect(CATEGORIES.filter(cat => !['Others', 'Savings'].includes(cat.name)).map(cat => cat.name)).toEqual(['Home & daily living', 'Work & learning', 'Personal needs', 'Entertainment']);
    expect(CATEGORIES.some(cat => cat.subcategories.some(sub => sub.name === 'Subscriptions' || sub.name === 'Personal Allowance'))).toBe(false);
    for (const cat of CATEGORIES) {
      expect(cat.nameJa).toBeTruthy(); expect(cat.nameEs).toBeTruthy();
      for (const sub of cat.subcategories) { expect(sub.nameJa).toBeTruthy(); expect(sub.nameEs).toBeTruthy(); }
    }
    expect(getLocalizedCategoryName('Work & learning', 'es')).toBe('Trabajo y formación');
    expect(getLocalizedCategoryName('Entertainment', 'ja')).toBe('娯楽');
    expect(getLocalizedSubcategoryName('Subscriptions', 'ja')).toBe('サブスク');
  });
  it('projects unambiguous legacy purpose and flags mixed buckets without assigning work', () => {
    expect(normalizeCategoryPair('Housing', 'Rent')).toEqual({ category: 'Home & daily living', subcategory: 'Rent' });
    expect(normalizeCategoryPair('Groceries', 'Medicine & Supplements')).toEqual({ category: 'Personal needs', subcategory: 'Health' });
    for (const [cat, sub] of [['Fun & Social', 'Subscriptions'], ['Personal spending', 'Hobbies & Shopping'], ['Transport', 'Fuel']]) {
      expect(normalizeCategoryPair(cat, sub)).toEqual({ category: 'Others', subcategory: 'Purpose unconfirmed' });
    }
    expect(normalizeCategoryPair('Personal spending', 'Personal Allowance')).toEqual({ category: 'Others', subcategory: 'Personal allocation' });
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
    expect(preview[0]).toMatchObject({ needsReview: true, proposed: { category: 'Others', subcategory: 'Personal allocation' } });
    expect(preview[1].needsReview).toBe(false); expect(preview[2].changed).toBe(false);
    expect(JSON.stringify(records)).toBe(original);
    expect(preview[0]).not.toHaveProperty('expense_flexibility'); expect(records[0]).not.toHaveProperty('cadence');
  });
});
