import { describe, expect, it } from 'vitest';
import { calculatePlan, planDefaults } from '../model';
import { planExpenseEvidence } from '../evidence';
import type { Transaction } from '@/types/transaction';
const example = () => ({ ...planDefaults(), savings: 50000, income: 10000, expense: 5000 });
describe('equal-capital purchase comparison on synthetic fixtures', () => {
  it('preserves defaults and unknown expense without inventing recorded spending', () => {
    expect(planDefaults()).toMatchObject({ expense: null, savings: 0, tax: 0, income: null, invest: 2000, rate: 10 });
    const c = calculatePlan(planDefaults());
    expect(c.valid).toBe(true); expect(c.surplus).toBe(null); expect(c.budgetError).toBe('amounts');
  });
  it('reaches 300000 from 50000 plus 2000 per month in 125 months in both paths at zero return', () => {
    const c = calculatePlan({ ...example(), rate: 0 });
    expect(c.cash.months).toBe(125); expect(c.mixed.months).toBe(125);
    expect(c.rows[124].cash).toBe(298000);
    expect(c.cash.ending!.cash).toBe(300000); expect(c.mixed.ending!.investment).toBe(300000);
    expect(c.rows.every(row => row.cash === row.investment && row.gain === 0)).toBe(true);
  });
  it('compounds all initial capital and end-of-month contributions at an effective annual rate', () => {
    const c = calculatePlan(example()), r = Math.pow(1.1, 1 / 12) - 1;
    const balance = (month: number) => 50000 * Math.pow(1 + r, month) + 2000 * (Math.pow(1 + r, month) - 1) / r;
    expect(c.monthlyRate).toBeCloseTo(r, 12);
    expect(c.cash.months).toBe(125); expect(c.mixed.months).toBe(77);
    expect(balance(c.mixed.months! - 1)).toBeLessThan(300000);
    expect(c.mixed.ending!.investment).toBeCloseTo(balance(c.mixed.months!), 6);
    expect(c.rows[1].investment).toBeCloseTo(50000 * (1 + r) + 2000, 8);
    expect(c.rows[1].cash).toBe(52000);
    expect(c.mixed.ending!.paid + c.mixed.ending!.gain).toBeCloseTo(c.mixed.ending!.investment, 6);
  });
  it('grows invested initial capital with zero contribution while cash stays flat', () => {
    const c = calculatePlan({ ...example(), invest: 0 });
    expect(c.cash.status).toBe('unreachable'); expect(c.mixed.status).toBe('reached');
    expect(c.rows[12].cash).toBe(50000); expect(c.rows[12].investment).toBeCloseTo(55000, 7);
    expect(c.rows.every(row => row.cash === 50000)).toBe(true);
    expect(calculatePlan({ ...example(), invest: 0, rate: 0 }).mixed.status).toBe('unreachable');
    expect(calculatePlan({ ...example(), invest: 0, savings: 0 }).mixed.status).toBe('unreachable');
  });
  it.each([0, 10, 25])('income, expenses and affordability never alter either projection at %s percent', rate => {
    const original = calculatePlan({ ...example(), rate });
    for (const budget of [{ income: 16000, expense: 8000 }, { income: 12000, expense: 10001 }, { income: 1000, expense: 12000 }, { income: 1000, expense: 1000 }, { income: null, expense: null }]) {
      const next = calculatePlan({ ...example(), rate, ...budget });
      expect(next.cash).toEqual(original.cash); expect(next.mixed).toEqual(original.mixed);
      expect(next.rows).toEqual(original.rows);
    }
    expect(calculatePlan({ ...example(), income: 12000, expense: 10001 }).excess).toBe(1);
  });
  it('applies tax only to gross income and keeps budget validation independent of projections', () => {
    expect(calculatePlan({ ...example(), tax: 30 }).net).toBe(10000);
    const gross = calculatePlan({ ...example(), mode: 'gross', tax: 30 });
    expect(gross.net).toBe(7000); expect(gross.surplus).toBe(2000);
    expect(gross.rows).toEqual(calculatePlan(example()).rows);
    const invalid = calculatePlan({ ...example(), mode: 'gross', tax: 101 });
    expect(invalid.budgetError).toBe('tax'); expect(invalid.valid).toBe(true); expect(invalid.surplus).toBe(null);
    expect(invalid.rows).toEqual(gross.rows);
  });
  it.each([300000, 400000])('an initial balance of %s already meets the goal even with a budget deficit', savings => {
    const c = calculatePlan({ ...example(), savings, expense: 12000 });
    expect(c.cash).toMatchObject({ months: 0, status: 'met' }); expect(c.mixed).toMatchObject({ months: 0, status: 'met' });
  });
  it('accepts zero expenses and zero goal without changing the chosen contribution', () => {
    expect(calculatePlan({ ...example(), expense: 0 }).cash.months).toBe(125);
    expect(calculatePlan({ ...example(), price: 0 }).mixed).toMatchObject({ months: 0, status: 'met' });
  });
  it('handles negative returns and discloses the 100-year horizon', () => {
    expect(calculatePlan({ ...example(), rate: -50, invest: 5000 }).mixed.status).toBe('unreachable');
    expect(calculatePlan({ ...example(), rate: -10 }).mixed.status).toBe('unreachable');
    const c = calculatePlan({ ...example(), invest: 1, rate: 0 });
    expect(c.cash.status).toBe('beyond'); expect(c.mixed.status).toBe('beyond');
    expect(c.rows).toHaveLength(1201);
  });
  it('rejects missing or nonfinite projection inputs and invalid returns', () => {
    for (const key of ['price', 'savings', 'invest'] as const) {
      for (const value of [null, NaN, Infinity, -1]) expect(calculatePlan({ ...example(), [key]: value }).valid).toBe(false);
    }
    for (const rate of [null, NaN, Infinity, -100, 1001]) expect(calculatePlan({ ...example(), rate }).valid).toBe(false);
  });
});
const row = (date_iso: string, value: number, extra: Partial<Transaction> = {}) => ({ id: 1, date_iso, value, currency: 'NZD', category: 'Housing', subcategory: 'Rent', record_type: 'expense', direction: 'outflow', ...extra }) as Transaction;
describe('observed expenses', () => {
  it('uses full calendar months including gaps and rent, excluding current partial, savings, income, transfers and other currencies', () => {
    const data = [row('2026-01-01', 100), row('2026-03-31', 300), row('2026-04-03', 9999),
      row('2026-01-04', 100, { category: 'Savings' }), row('2026-01-05', 100, { record_type: 'income', direction: 'inflow' }),
      row('2026-01-06', 100, { record_type: 'transfer' }), row('2026-01-07', 100, { currency: 'USD' })];
    const e = planExpenseEvidence(data, '2026-04-04'); expect(e.months).toBe(3); expect(e.average).toBeCloseTo(400 / 3); expect(e.partial).toBe(true); expect(e.excluded).toBe(true);
    expect(e.start).toBe('2026-01-01'); expect(e.end).toBe('2026-03-31');
  });
  it('supports different years without fixing the denominator to 2026', () => {
    const e = planExpenseEvidence([row('2025-12-01', 100), row('2026-01-31', 300)], '2026-02-10');
    expect(e.months).toBe(2); expect(e.average).toBe(200);
  });
  it('does not extend the NZD expense denominator for older foreign currency, income, savings or transfers', () => {
    const eligible = [row('2026-01-01', 100), row('2026-03-31', 300)];
    const excluded = [row('2024-01-01', 1, { currency: 'USD' }), row('2024-02-01', 1, { record_type: 'transfer' }),
      row('2024-03-01', 1, { record_type: 'income', direction: 'inflow' }), row('2024-04-01', 1, { category: 'Savings' })];
    const e = planExpenseEvidence([...eligible, ...excluded], '2026-04-04');
    expect(e.months).toBe(3); expect(e.average).toBeCloseTo(400 / 3); expect(e.start).toBe('2026-01-01');
  });
  it('does not replace unavailable evidence with zero or a demo expense', () => {
    expect(planExpenseEvidence([], '2026-04-04').average).toBe(null);
    expect(planExpenseEvidence([row('2026-04-03', 1)], '2026-04-04').average).toBe(null);
    expect(planExpenseEvidence([row('2026-03-01', 0)], '2026-04-04').average).toBe(0);
  });
});
