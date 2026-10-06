import { describe, expect, it } from 'vitest';
import { calculatePlan, planDefaults } from '../model';
import { planExpenseEvidence } from '../evidence';
import type { Transaction } from '@/types/transaction';
const example = () => ({ ...planDefaults(), expense: 5000 });
describe('purchase calculation on explicitly synthetic fixtures', () => {
  it('starts with unknown expense, zero savings and tax, hypothetical editable income', () => {
    expect(planDefaults()).toMatchObject({ expense: null, savings: 0, tax: 0, income: 10000 });
    expect(calculatePlan(planDefaults()).valid).toBe(false);
  });
  it('matches reference end-of-month effective annual compounding without double counting', () => {
    const c = calculatePlan(example()); expect(c.cash.months).toBe(60); expect(c.mixed.months).toBe(55);
    expect(c.mixed.ending!.reserve).toBe(165000);
    expect(c.mixed.ending!.investment).toBeCloseTo(137395.58, 2);
    expect(c.mixed.ending!.mixed).toBeCloseTo(300000 + 2395.58, 2);
    expect(c.mixed.ending!.mixed).toBeCloseTo(c.mixed.ending!.cash + c.mixed.ending!.gain, 6);
  });
  it('keeps net income untaxed and applies selected gross tax once', () => {
    expect(calculatePlan({ ...example(), tax: 30 }).net).toBe(10000);
    const gross = calculatePlan({ ...example(), mode: 'gross', tax: 30 }); expect(gross.net).toBe(7000); expect(gross.surplus).toBe(2000);
    expect(calculatePlan({ ...example(), mode: 'gross', tax: 101 }).valid).toBe(false);
  });
  it('accepts zero expenses and zero goal as valid', () => {
    expect(calculatePlan({ ...example(), expense: 0 }).cash.months).toBe(30);
    expect(calculatePlan({ ...example(), price: 0 }).mixed).toMatchObject({ months: 0, status: 'met' });
  });
  it('does not fund a future purchase with zero or negative surplus', () => {
    for (const expense of [10000, 12000]) {
      const c = calculatePlan({ ...example(), expense, invest: 0 });
      expect(c.cash.status).toBe('unreachable'); expect(c.mixed.status).toBe('unreachable');
    }
  });
  it('keeps an already met goal immediate even with a deficit or excess investment', () => {
    const c = calculatePlan({ ...example(), savings: 300000, expense: 12000 });
    expect(c.cash.status).toBe('met'); expect(c.mixed.months).toBe(0);
  });
  it('refuses overallocated contributions, retaining the independent cash path', () => {
    const c = calculatePlan({ ...example(), invest: 5001 });
    expect(c.mixed.status).toBe('overallocated'); expect(c.cash.months).toBe(60);
  });
  it('zero return gives identical timelines, with initial savings in cash', () => {
    const c = calculatePlan({ ...example(), rate: 0, savings: 10000 }); expect(c.mixed.months).toBe(c.cash.months);
    expect(c.mixed.ending!.reserve).toBe(10000 + 3000 * c.mixed.months!);
  });
  it('negative return can prevent an all-investment goal or delay a mixed goal', () => {
    expect(calculatePlan({ ...example(), rate: -50, invest: 5000 }).mixed.status).toBe('unreachable');
    const c = calculatePlan({ ...example(), rate: -10 }); expect(c.mixed.months).toBeGreaterThan(c.cash.months!);
    expect(calculatePlan({ ...example(), rate: -100 }).valid).toBe(false);
  });
  it('bounds both paths to the disclosed 100-year horizon', () => {
    const c = calculatePlan({ ...example(), income: 5001, invest: 0 }); expect(c.cash.status).toBe('beyond'); expect(c.mixed.status).toBe('beyond');
  });
  it('rejects missing or nonfinite values and negative initial balances', () => {
    for (const value of [null, NaN, Infinity, -1]) expect(calculatePlan({ ...example(), savings: value }).valid).toBe(false);
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
