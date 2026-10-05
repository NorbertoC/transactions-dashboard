import { describe, expect, it } from 'vitest';
import { buildDashboard } from '@/utils/dashboard';
import { incomeWindows, combineIncomeSummaries, validateIncomeSummary } from '@/utils/income';
import type { Transaction } from '@/types/transaction';
const row = (id: number, value: number, type?: Transaction['record_type'], direction?: Transaction['direction'], category = 'Groceries'): Transaction => ({ id, value, record_type: type, direction, category, currency: 'NZD', date_iso: '2026-01-02', date: '', amount: String(value), place: 'Synthetic fixture' });
describe('explicit movement arithmetic', () => {
  it('keeps income and both transfer legs out of expense and net outflow totals', () => {
    const data = buildDashboard([row(1, 20), row(2, 100, 'income', 'inflow'), row(3, 50, 'transfer', 'inflow', 'Savings'), row(4, 50, 'transfer', 'outflow', 'Savings'), row(5, 10, 'expense', 'outflow', 'Savings'), row(6, -500)], '2026-01-01', '2026-01-31', true, 'NZD', '2026-02-01');
    expect(data.total).toBe(20); expect(data.outflow).toBe(30); expect(data.savings).toBe(10);
    expect(data.income.map(row => row.id)).toEqual([2]); expect(data.transfers).toHaveLength(2); expect(data.records).toHaveLength(5);
    expect(data.unsupported).toBe(1); expect(data.categories.map(row => row.name)).toEqual(['Groceries']);
  });
  it('does not invent income from legacy positive or negative signs', () => {
    const data = buildDashboard([row(1, 100), row(2, -100)], '2026-01-01', '2026-01-31', true, 'NZD', '2026-02-01');
    expect(data.income).toEqual([]); expect(data.total).toBe(100);
  });
});
describe('income verified coverage windows', () => {
  it('does not widen noncontiguous selected years or cross-year statement bounds', () => {
    expect(incomeWindows('2024-10-01', '2026-09-30', ['2024', '2026'])).toEqual([{ start: '2024-10-01', end: '2024-12-31' }, { start: '2026-01-01', end: '2026-09-30' }]);
    expect(incomeWindows('2025-12-27', '2026-01-26', ['2026'])).toEqual([{ start: '2026-01-01', end: '2026-01-26' }]);
    expect(incomeWindows('2026-02-30', '2026-09-30', ['2026'])).toEqual([]);
  });
  it('combines integer cents and covered partial calendar months without exchanging currencies', () => {
    const first = validateIncomeSummary({ start_date: '2025-03-01', end_date: '2025-06-30', totals_by_currency: { NZD: { cents: 3000, total: 30, monthly_average: 10 }, USD: { cents: 2000, total: 20, monthly_average: 20 / 3 } }, coverage: [{ start: '2025-03-03', end: '2025-05-01' }], covered_calendar_months: 3, coverage_complete: false, basis: 'Synthetic actual receipt coverage' });
    const next = { ...first, start_date: '2026-01-01', end_date: '2026-01-31', covered_calendar_months: 1, totals_by_currency: { NZD: { cents: 101, total: 1.01, monthly_average: 1.01 } } };
    const result = combineIncomeSummaries([first, next], 'NZD');
    expect(result.cents).toBe(3101); expect(result.denominator).toBe(4); expect(result.average).toBe(31.01 / 4); expect(result.complete).toBe(false); expect(result.windows).toHaveLength(2);
    expect(combineIncomeSummaries([], 'NZD').average).toBeNull();
  });
  it('rejects incomplete/malformed coverage and fractional or mismatched cents', () => {
    for (const value of [null, {}, { start_date: '2026-01-01', end_date: '2026-02-30' }]) expect(() => validateIncomeSummary(value)).toThrow();
    const base = { start_date: '2026-01-01', end_date: '2026-01-31', coverage: [], covered_calendar_months: 0, coverage_complete: false, totals_by_currency: { NZD: { cents: 1.5, total: 1, monthly_average: 1 } } };
    expect(() => validateIncomeSummary(base)).toThrow();
    expect(() => validateIncomeSummary({ ...base, totals_by_currency: { NZD: { cents: 100, total: 2, monthly_average: 1 } } })).toThrow();
  });
});
