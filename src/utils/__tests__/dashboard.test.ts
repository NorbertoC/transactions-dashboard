import { describe, expect, it } from 'vitest';
import { buildDashboard, calendarMonths, monthEnd } from '@/utils/dashboard';
import type { Transaction } from '@/types/transaction';
const tx = (id: number, date_iso: string, value: number, category = 'Groceries', subcategory = 'Food', currency = 'NZ$'): Transaction =>
  ({ id, date_iso, value, category, subcategory, currency, place: 'Synthetic fixture', date: date_iso, amount: String(value) });

describe('calendar dashboard calculation with synthetic records', () => {
  it('includes zero-record months in the same category and global denominator', () => {
    const data = buildDashboard([tx(1, '2026-01-02', 100.25), tx(2, '2026-03-12', 200.5)], '2026-01-01', '2026-03-31', true, 'NZD', '2026-04-04');
    expect(data.denominator).toBe(3);
    expect(data.total).toBe(300.75);
    expect(data.average).toBe(100.25);
    expect(data.categories[0].average).toBe(100.25);
    expect(data.monthly[1].total).toBe(0);
  });
  it('keeps rent, savings allocations, unsupported signs and currencies distinct', () => {
    const rows = [tx(1, '2026-01-02', 400, 'Housing', 'Rent'), tx(2, '2026-01-03', 15), tx(3, '2026-01-04', 100, 'Savings'), tx(4, '2026-01-05', -25), tx(5, '2026-01-05', 900, 'Groceries', 'Food', 'USD')];
    const data = buildDashboard(rows, '2026-01-01', '2026-01-31', false, 'NZD', '2026-02-01');
    expect(data.total).toBe(15);
    expect(data.savings).toBe(100);
    expect(data.outflow).toBe(115);
    expect(data.unsupported).toBe(1);
    expect(data.expenses.map(row => row.id)).toEqual([2]);
  });
  it('marks partial buckets without extrapolating', () => {
    const data = buildDashboard([tx(1, '2026-02-01', 10)], '2026-01-27', '2026-02-26', true, 'NZD', '2026-03-01');
    expect(data.denominator).toBe(2);
    expect(data.average).toBe(5);
    expect(data.monthly.every(month => month.partial)).toBe(true);
  });
  it('omits nonfinite savings and invalid calendar dates without polluting totals', () => {
    const data = buildDashboard([tx(1, '2026-02-10', Infinity, 'Savings'), tx(2, '2026-02-30', 30), tx(3, '2026-02-11', 10)], '2026-02-01', '2026-02-28', true, 'NZD', '2026-03-01');
    expect(data.total).toBe(10); expect(data.savings).toBe(0); expect(data.outflow).toBe(10);
    expect(calendarMonths('2026-99-01', '2027-01-01')).toEqual([]);
  });
  it('enumerates gaps across years and handles leap years', () => {
    expect(calendarMonths('2025-12-01', '2026-02-28')).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    expect(calendarMonths('2026-03-01', '2026-01-31')).toEqual([]);
  });
  it('uses only selected calendar years including gaps within them', () => {
    const rows = [tx(1, '2024-10-10', 30), tx(2, '2025-02-10', 999), tx(3, '2026-03-10', 90)];
    const data = buildDashboard(rows, '2024-10-01', '2026-03-31', true, 'NZD', '2026-04-01', ['2024', '2026']);
    expect(data.total).toBe(120);
    expect(data.denominator).toBe(6);
    expect(data.average).toBe(20);
    expect(data.categories[0].average).toBe(20);
    expect(data.expenses.map(row => row.id)).toEqual([1, 3]);
    expect(data.monthly.map(row => row.key)).toEqual(['2024-10', '2024-11', '2024-12', '2026-01', '2026-02', '2026-03']);
    const empty = buildDashboard(rows, '2024-10-01', '2026-03-31', true, 'NZD', '2026-04-01', []);
    expect(empty.total).toBe(0); expect(empty.denominator).toBe(0); expect(empty.expenses).toEqual([]);
  });
  it('intersects a cross-year statement with the explicitly selected posted year', () => {
    const data = buildDashboard([tx(1, '2025-12-28', 20), tx(2, '2026-01-10', 40)], '2025-12-27', '2026-01-26', true, 'NZD', '2026-02-01', ['2026']);
    expect(data.total).toBe(40); expect(data.denominator).toBe(1);
    expect(data.monthly).toEqual([{ key: '2026-01', total: 40, partial: true }]);
  });
});
