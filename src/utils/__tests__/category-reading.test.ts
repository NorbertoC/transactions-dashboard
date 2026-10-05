import { describe, expect, it } from 'vitest';
import { buildDashboard } from '@/utils/dashboard';
import { categoryReading } from '@/utils/category-reading';
import { transactionLabel } from '@/utils/transaction-label';
import type { Transaction } from '@/types/transaction';

const row = (id: number, date_iso: string, value: number, extra: Partial<Transaction> = {}): Transaction => ({ id, date_iso, value, place: 'Fixture', category: 'Entertainment', currency: 'NZ$', date: '', amount: String(value), ...extra });

describe('category reading from the selected dashboard records', () => {
  it('excludes unselected years, other categories, currencies, income and rent', () => {
    const data = buildDashboard([row(1, '2024-01-10', 120), row(2, '2026-01-10', 240), row(3, '2025-01-10', 900), row(4, '2026-01-10', 900, { currency: 'USD' }), row(5, '2026-01-10', 900, { record_type: 'income', direction: 'inflow' }), row(6, '2026-01-10', 900, { category: 'Housing', subcategory: 'Rent' })], '2024-01-01', '2026-01-31', false, 'NZD', '2026-10-05', ['2024', '2026']);
    const category = data.categories.find(row => row.name === 'Entertainment')!;
    const reading = categoryReading(category.records, data.monthly);
    expect(reading.total).toBe(360);
    expect(reading.denominator).toBe(13);
    expect(reading.average).toBe(360 / 13);
    expect(reading.recordedMonths).toBe(2);
    expect(reading.peaks.map(row => row.key)).toEqual(['2026-01']);
    expect(data.categories.some(row => row.name === 'Housing')).toBe(false);
  });
  it('retains partial statement months and tied observed peaks without inventing completeness', () => {
    const data = buildDashboard([row(1, '2026-01-30', 40), row(2, '2026-02-02', 40)], '2026-01-27', '2026-02-26', true, 'NZD', '2026-02-10');
    const reading = categoryReading(data.expenses, data.monthly);
    expect(reading.average).toBe(40);
    expect(reading.partial).toBe(true);
    expect(reading.peaks).toHaveLength(2);
    expect(reading.peaks.every(row => row.partial)).toBe(true);
  });
  it('distinguishes an observed zero record from an absent month and an empty period', () => {
    const data = buildDashboard([row(1, '2026-01-10', 0)], '2026-01-01', '2026-02-28', true, 'NZD', '2026-10-05');
    const reading = categoryReading(data.expenses, data.monthly);
    expect(reading.recordedMonths).toBe(1);
    expect(reading.peaks.map(row => row.key)).toEqual(['2026-01']);
    expect(categoryReading([], []).average).toBeNull();
    expect(categoryReading([], data.monthly).peaks).toEqual([]);
  });
});

describe('income presentation', () => {
  it('uses actual sources independently of owner and preserves records', () => {
    const income = row(1, '2026-01-10', 50, { record_type: 'income', owner: 'Mana', income_source: 'Other actual payer', place: 'Ingresos - Mana' });
    expect(transactionLabel(income)).toBe('Other actual payer');
    expect(income.owner).toBe('Mana');
    expect(income.place).toBe('Ingresos - Mana');
    expect(transactionLabel({ ...income, income_source: '   ' })).toBe('Ingresos - Mana');
    expect(transactionLabel({ ...income, record_type: 'expense' })).toBe('Ingresos - Mana');
  });
});

describe('recorded monthly narrative evidence', () => {
  it('reports changes only between adjacent complete observed months', () => {
    const rows = [row(1, '2024-01-10', 100), row(2, '2024-02-10', 160), row(3, '2024-04-10', 500), row(4, '2026-01-10', 80), row(5, '2026-02-10', 30)];
    const data = buildDashboard(rows, '2024-01-01', '2026-02-28', true, 'NZD', '2026-10-05', ['2024', '2026']);
    const reading = categoryReading(data.expenses, data.monthly);
    expect(reading.changes).toEqual([{ from: '2024-01', to: '2024-02', difference: 60 }, { from: '2026-01', to: '2026-02', difference: -50 }]);
    expect(reading.latestChange?.difference).toBe(-50);
    expect(reading.monthly.find(month => month.key === '2024-03')?.count).toBe(0);
    expect(reading.peakShare).toBe(500 / 870);
    expect(reading.topMerchant).toEqual({ place: 'Fixture', total: 500, month: '2024-04' });
    expect(reading.total).toBe(data.total);
    expect(reading.average).toBe(data.average);
  });
  it('does not compare partial months or divide by zero; preserves tied peaks', () => {
    const data = buildDashboard([row(1, '2026-01-30', 0), row(2, '2026-02-10', 0)], '2026-01-27', '2026-02-26', true, 'NZD', '2026-10-05');
    const reading = categoryReading(data.expenses, data.monthly);
    expect(reading.changes).toEqual([]);
    expect(reading.latestChange).toBeNull();
    expect(reading.peakShare).toBeNull();
    expect(reading.peaks).toHaveLength(2);
    expect(categoryReading([], data.monthly).topMerchant).toBeNull();
  });
});
