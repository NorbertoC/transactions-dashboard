import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types/transaction';
import { buildDashboard } from '@/utils/dashboard';
import { buildMesaReading, mesaReadingPeriods } from '@/utils/mesa-reading';

const tx = (id: number, value: number, category: string, subcategory?: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id, value, category, subcategory, date_iso: '2026-01-10', date: '2026-01-10', amount: String(value),
  place: 'Synthetic fixture', currency: 'NZD', ...overrides,
});
const dashboard = (rows: Transaction[], rent = true, years?: string[]) => buildDashboard(rows, '2026-01-01', '2026-03-31', rent, 'NZD', '2026-04-01', years);

describe('Mesa reading shares dashboard scope and denominator', () => {
  it('lists every observed category and reconciles with the dashboard average, including empty months', () => {
    const data = dashboard([tx(1, 300, 'Basic living', 'Rent'), tx(2, 90, 'Travel', 'Tickets & transfers'), tx(3, 30, 'Custom manual', 'Custom purpose', { category_source: 'manual' }), tx(4, 12, '', '')]);
    const reading = buildMesaReading(data.expenses, data.monthly, null);
    expect(reading.denominator).toBe(data.denominator);
    expect(reading.total).toBe(data.total);
    expect(reading.average).toBe(data.average);
    expect(reading.rows.map(row => row.name)).toEqual(['Basic living', 'Travel', 'Custom manual', null]);
    expect(reading.rows.reduce((sum, row) => sum + row.average!, 0)).toBe(data.average);
    expect(data.monthly.map(row => row.total)).toEqual([432, 0, 0]);
  });
  it('lists custom and missing subcategories without changing manual classification', () => {
    const rows = [tx(1, 90, 'Basic living', 'Rent'), tx(2, 30, 'Basic living', 'Custom manual', { category_source: 'manual' }), tx(3, 9, 'Basic living', ''), tx(4, 6, 'Basic living'), tx(5, 15, 'Basic living', '   ')];
    const before = structuredClone(rows);
    const data = dashboard(rows);
    const reading = buildMesaReading(data.expenses, data.monthly, 'Basic living');
    expect(reading.rows).toEqual([
      { name: 'Rent', total: 90, average: 30, count: 1 },
      { name: null, total: 30, average: 10, count: 3 },
      { name: 'Custom manual', total: 30, average: 10, count: 1 },
    ]);
    expect(reading.rows.reduce((sum, row) => sum + row.total, 0)).toBe(reading.total);
    expect(rows).toEqual(before);
  });
  it('inherits rent, currency, direction, income, transfer and savings exclusions exactly', () => {
    const data = dashboard([tx(1, 900, 'Basic living', 'Rent'), tx(2, 60, 'Basic living', 'Phone', { currency: 'NZ$' }),
      tx(3, 800, 'Travel', 'Accommodation', { currency: 'USD' }), tx(4, 500, 'Others', '', { record_type: 'income', direction: 'inflow' }),
      tx(5, 200, 'Others', '', { record_type: 'transfer' }), tx(6, 20, 'Savings'), tx(7, -30, 'Travel'),
      tx(8, 40, 'Basic living', 'Phone', { direction: 'inflow' })], false);
    const reading = buildMesaReading(data.expenses, data.monthly, null);
    expect(reading.total).toBe(60);
    expect(reading.rows).toEqual([{ name: 'Basic living', total: 60, average: 20, count: 1 }]);
  });
  it('represents noncontiguous selected years as separate exact periods', () => {
    const data = buildDashboard([tx(1, 30, 'Travel', '', { date_iso: '2024-10-15' }), tx(2, 999, 'Travel', '', { date_iso: '2025-02-10' }), tx(3, 90, 'Travel', '', { date_iso: '2026-03-10' })], '2024-10-01', '2026-03-31', true, 'NZD', '2026-04-01', ['2024', '2026']);
    expect(buildMesaReading(data.expenses, data.monthly, null).average).toBe(20);
    expect(mesaReadingPeriods(data.monthly, '2024-10-01', '2026-03-31')).toEqual([
      { start: '2024-10-01', end: '2024-12-31', months: ['2024-10', '2024-11', '2024-12'] },
      { start: '2026-01-01', end: '2026-03-31', months: ['2026-01', '2026-02', '2026-03'] },
    ]);
  });
  it('clips statement dates and counts partial buckets once without extrapolation', () => {
    const data = buildDashboard([tx(1, 60, 'Travel', '', { date_iso: '2026-02-01' })], '2026-01-27', '2026-02-26', true, 'NZD', '2026-03-01');
    const reading = buildMesaReading(data.expenses, data.monthly, null);
    expect(reading.average).toBe(30); expect(reading.partial).toBe(true);
    expect(mesaReadingPeriods(data.monthly, '2026-01-27', '2026-02-26')[0]).toEqual({ start: '2026-01-27', end: '2026-02-26', months: ['2026-01', '2026-02'] });
  });
  it('does not turn an empty year selection into a fabricated zero monthly average', () => {
    const data = dashboard([tx(1, 100, 'Basic living')], true, []);
    expect(buildMesaReading(data.expenses, data.monthly, null)).toEqual({ total: 0, average: null, denominator: 0, count: 0, partial: false, rows: [] });
    expect(mesaReadingPeriods(data.monthly, '2026-01-01', '2026-03-31')).toEqual([]);
    const covered = dashboard([]);
    expect(buildMesaReading(covered.expenses, covered.monthly, null).average).toBe(0);
  });
  it('can read a blank category selected explicitly', () => {
    const data = dashboard([tx(1, 30, '', 'Custom purpose'), tx(2, 90, 'Travel')]);
    const reading = buildMesaReading(data.expenses, data.monthly, '');
    expect(reading.total).toBe(30); expect(reading.average).toBe(10);
    expect(reading.rows[0].name).toBe('Custom purpose');
  });
});
