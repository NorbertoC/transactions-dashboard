import { describe, expect, it } from 'vitest';
import { budgetEvidence, calculate, defaults, SCENARIOS, validDraft, type BudgetRow } from '../model';
import type { Transaction } from '@/types/transaction';
const row = (id: string, amount: number, kind: BudgetRow['kind'] = 'want', protectedCost = false, travel = false): BudgetRow => ({ id, amount, kind, protected: protectedCost, travel, category: 'Test', name: id, observed: true, count: 1 });
const rows = [row('rent', 2600, 'need', true), row('health', 212, 'need', true), row('home_purchases', 80, 'want', true), row('tickets_transfers', 600, 'want', false, true), row('accommodation', 650, 'want', false, true), row('food_treats', 140), row('manual', 200, 'unknown', true)];
describe('family budget', () => {
  it.each(SCENARIOS)('conserves every scenario without rounding intermediate amounts: %s', id => {
    for (const auto of [false, true]) for (const income of [0, 3000, 9924, 13525.90, 20000]) {
      const d = { ...defaults(id), auto, income }, c = calculate(d, rows, true);
      expect(c.committed + c.unallocated - c.gap).toBeCloseTo(income, 8);
      expect(c.needs + c.otherWants + c.unknown + c.travel).toBeCloseTo(c.spending, 8);
      expect(c.annualCapacity).toBe(c.capacity * 12); expect(c.annualTravel).toBe(c.travel * 12);
      expect(c.savings).toBe(d.savings); expect(c.rent).toBe(2600);
    }
  });
  it('uses actual recorded expenses, keeps travel in capacity once, and updates guides without editing savings', () => {
    const d = defaults('current'), c = calculate(d, rows, true);
    expect(c.capacity).toBeCloseTo(c.travel + c.unallocated); expect(c.capacity).toBeCloseTo(c.income - c.costs - c.savings);
    d.income = 8000; expect(calculate(d, rows, true).savingsGuide).toBe(1600); expect(calculate(d, rows, true).savings).toBe(2705.18);
  });
  it('cuts travel before other wants and preserves protected costs, unknowns, chosen savings and the last edited concept', () => {
    const d = { ...defaults('single'), income: 3600, savings: 0, auto: true }, c = calculate(d, rows, true);
    expect(c.changes.map(item => item.id)).toEqual(['tickets_transfers', 'accommodation']);
    expect(c.rows.find(item => item.id === 'food_treats')!.proposed).toBe(140);
    expect(c.rows.find(item => item.id === 'manual')!.proposed).toBe(200);
    expect(c.rows.find(item => item.id === 'home_purchases')!.proposed).toBe(80);
    const locked = calculate({ ...d, income: 1000, lastEdited: 'tickets_transfers' }, rows, true);
    expect(locked.rows.find(item => item.id === 'tickets_transfers')!.proposed).toBe(600); expect(locked.gap).toBeGreaterThan(0);
    expect(locked.rent).toBe(2600); expect(locked.rows.find(item => item.id === 'health')!.proposed).toBe(212);
  });
  it('does not mutate requested amounts and recovers them when auto is off', () => {
    const d = { ...defaults('single'), income: 1000, auto: true }, serialized = JSON.stringify(d);
    calculate(d, rows, true); expect(JSON.stringify(d)).toBe(serialized);
    expect(calculate({ ...d, auto: false }, rows, true).travel).toBe(1250);
  });
  it('keeps missing coverage and invalid amounts unknown', () => {
    expect(calculate(defaults('current'), [], false).known).toBe(false);
    for (const income of [null, -1, Infinity, 1000001]) expect(calculate({ ...defaults('current'), income }, rows, true).valid).toBe(false);
    expect(calculate({ ...defaults('current'), baby: null }, rows, true).valid).toBe(false);
    expect(validDraft(defaults('baby2'))).toBe(true); expect(validDraft({ ...defaults('single'), kinds: { a: 'fake' } })).toBe(false);
  });
});
const tx = (id: number, value: number, category: string, subcategory: string, date = '2026-03-15'): Transaction => ({ id, value, category, subcategory, date_iso: date, date, place: 'Synthetic', amount: '', currency: 'NZD', record_type: 'expense', direction: 'outflow' });
it('reconciles observed spending exactly, isolates manual names and protects unknown concepts without fabricated balancing rows', () => {
  const records = [tx(1, 3000.01, 'Basic living', 'Rent'), tx(2, 10.03, 'Basic living', 'Rent', '2026-05-15'), tx(3, 31.22, 'My manual group', 'My own purpose')]; records[2].category_source = 'manual';
  records.push({ ...tx(4, 900, 'Basic living', 'Rent', '2020-01-01'), currency: 'USD' }, { ...tx(5, 500, 'Savings', '') }, { ...tx(6, 1000, 'Pay', ''), record_type: 'income', direction: 'inflow' });
  const e = budgetEvidence(records, '2026-10-07');
  expect(e.start).toBe('2026-03-01'); expect(e.end).toBe('2026-05-31'); expect(e.data.denominator).toBe(3);
  expect(e.rows.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo((3000.01 + 10.03 + 31.22) / 3, 10);
  expect(e.total).toBeCloseTo(e.rows.reduce((sum, item) => sum + item.amount, 0), 10); expect(e.incomeCents).toBe(100000);
  expect(e.rows).toHaveLength(2); expect(e.rows[1]).toMatchObject({ category: 'My manual group', name: 'My own purpose', kind: 'unknown', protected: true });
  expect(records[2].category).toBe('My manual group'); expect(e.partial).toBe(true); expect(e.excluded).toBe(true);
  expect(budgetEvidence([], '2026-10-07').total).toBeNull();
});
