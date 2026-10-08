import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types/transaction';
import { currentYearExpenseEvidence } from '../expense-evidence';
import { planExpenseEvidence } from '@/components/plan/evidence';
import { budgetEvidence } from '@/components/budget/model';
import { incomeWindow } from '@/components/budget/income';

const tx = (date_iso: string, value: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: 1, date: date_iso, date_iso, value, currency: 'NZD', place: 'Synthetic', amount: '',
  category: 'Basic living', subcategory: 'Rent', record_type: 'expense', direction: 'outflow', ...extra,
});
function both(records: Transaction[], today: string) {
  const plan = planExpenseEvidence(records, today), budget = budgetEvidence(records, today);
  expect(plan).toMatchObject({ average: budget.total, start: budget.start, end: budget.end,
    months: budget.data.denominator, partial: budget.partial, excluded: budget.excluded });
  expect(budget.rows.reduce((sum, row) => sum + row.amount, 0)).toBeCloseTo(budget.total ?? 0, 10);
  return budget;
}
describe('shared current-year expense defaults', () => {
  it('reconciles nine current-year months and rent without prior-year or October spending', () => {
    const records = [tx('2024-10-20', 100000), tx('2025-12-31', 90000),
      ...Array.from({ length: 9 }, (_, i) => tx(`2026-${String(i + 1).padStart(2, '0')}-15`, 2600)),
      tx('2026-09-30', 37566.87, { subcategory: 'Home food' }), tx('2026-10-01', 99999)];
    const e = both(records, '2026-10-08');
    expect(e).toMatchObject({ start: '2026-01-01', end: '2026-09-30', years: ['2026'] });
    expect(e.data.denominator).toBe(9); expect(e.data.total).toBeCloseTo(60966.87, 8);
    expect(e.total).toBeCloseTo(6774.096666666667, 8);
    expect(e.rows.find(row => row.id === 'rent')!.amount).toBe(2600);
    expect(incomeWindow('2026-10-08')).toMatchObject({ start: '2026-04-01', end: '2026-09-30' });
  });
  it.each(['2026-01-01', '2026-01-31', '2027-01-02'])('has no previous-year fallback in January: %s', today => {
    const e = both([tx('2025-12-31', 6000), tx('2026-01-01', 100)], today);
    expect(e.total).toBeNull(); expect(e.known).toBe(false); expect(e.data.denominator).toBe(0);
  });
  it('does not fabricate an expense average when this year has no closed-month records', () => {
    for (const records of [[], [tx('2025-12-31', 6000)], [tx('2026-10-02', 100)]]) {
      const e = both(records, '2026-10-08');
      expect(e.total).toBeNull(); expect(e.known).toBe(false); expect(e.rows).toEqual([]);
    }
  });
  it('keeps sparse calendar months in the divisor and signals missing coverage', () => {
    const e = both([tx('2025-12-31', 99999), tx('2026-03-01', 300), tx('2026-05-31', 500)], '2026-10-08');
    expect(e.start).toBe('2026-01-01'); expect(e.end).toBe('2026-05-31');
    expect(e.data.denominator).toBe(5); expect(e.total).toBe(160); expect(e.partial).toBe(true);
    expect(e.data.monthly.filter(month => !month.total).map(month => month.key)).toEqual(['2026-01', '2026-02', '2026-04']);
  });
  it('uses available month bounds when imports start during the current year', () => {
    const e = both([tx('2026-03-20', 300), tx('2026-05-29', 500)], '2026-10-08');
    expect(e.start).toBe('2026-03-01'); expect(e.end).toBe('2026-05-31');
    expect(e.data.denominator).toBe(3); expect(e.partial).toBe(true);
  });
  it('ignores ineligible dates and movements when establishing expense bounds', () => {
    const ignored = [tx('2025-01-01', 999, { currency: 'USD' }), tx('2025-01-01', 999, { category: 'Savings' }),
      tx('2025-01-01', 999, { record_type: 'income', direction: 'inflow' }), tx('2025-01-01', 999, { record_type: 'transfer' }),
      tx('2026-09-01', -50), tx('invalid', 50), tx('2026-12-01', 999), tx('2026-05-01', Infinity)];
    const e = both([...ignored, tx('2026-03-01', 0, { currency: 'NZ$' }), tx('2026-03-31', 300)], '2026-10-08');
    expect(e.start).toBe('2026-03-01'); expect(e.end).toBe('2026-03-31'); expect(e.total).toBe(300);
    expect(e.excluded).toBe(true); expect(e.partial).toBe(false);
  });
  it('distinguishes recorded zero expense from missing expense data', () => {
    expect(both([tx('2026-03-01', 0)], '2026-04-04').total).toBe(0);
    expect(currentYearExpenseEvidence([], '2026-04-04').expense).toBeNull();
  });
});
