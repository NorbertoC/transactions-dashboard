import { describe, expect, it } from 'vitest';
import { disposableIncome, householdIncomeEvidence, incomeWindow } from '../income';
import { SCENARIOS } from '../model';
import { incomeRecords, incomeSummary, verifiedIncome } from './income-fixtures';

describe('verified household income and planning reserves', () => {
  it.each(SCENARIOS)('reconciles the displayed cent-based equation for %s without changing historical cents', scenario => {
    const before = JSON.stringify(verifiedIncome), result = disposableIncome(verifiedIncome, scenario);
    expect(result.income).toBe(scenario === 'current' ? 13492.56 : 9890.66);
    expect(Math.round(result.receipts! * 100) - Math.round(result.tax * 100) - Math.round(result.acc * 100)).toBe(Math.round(result.income! * 100));
    expect(result.annualTax).toBe(24152); expect(result.annualAcc).toBe(2760); expect(result.tax).toBe(2012.67); expect(result.acc).toBe(230);
    expect(result.exactReceipts).toBeCloseTo(scenario === 'current' ? 94411.4 / 6 : 72800 / 6, 10);
    expect(JSON.stringify(verifiedIncome)).toBe(before);
  });
  it('always uses the latest six completed calendar months across years and leap days', () => {
    expect(incomeWindow('2026-10-07')).toMatchObject({ start: '2026-04-01', end: '2026-09-30', years: ['2026'] });
    expect(incomeWindow('2026-04-01')).toMatchObject({ start: '2025-10-01', end: '2026-03-31', years: ['2025', '2026'] });
    expect(incomeWindow('2024-03-01')!.end).toBe('2024-02-29'); expect(incomeWindow('2026-02-30')).toBeNull();
  });
  it('rejects absent, partial, mismatched and gapped coverage even if the response claims completeness', () => {
    for (const summary of [null, { ...incomeSummary, complete: false }, { ...incomeSummary, denominator: 5 }, { ...incomeSummary, cents: 1 }, { ...incomeSummary, windows: [{ start: '2026-04-01', end: '2026-09-30', coverage: [{ start: '2026-04-02', end: '2026-09-30' }] }] }, { ...incomeSummary, windows: [{ start: '2026-04-01', end: '2026-09-30', coverage: [{ start: '2026-04-01', end: '2026-06-30' }, { start: '2026-07-02', end: '2026-09-30' }] }] }]) {
      const proof = householdIncomeEvidence(incomeRecords, '2026-10-07', summary);
      expect(proof.complete).toBe(false); expect(disposableIncome(proof, 'current').income).toBeNull();
    }
    expect(householdIncomeEvidence(incomeRecords, '2026-10-07', incomeSummary, false).complete).toBe(false);
  });
  it('includes only the two selected payer groups and NZD, excludes open October, and verifies all receipt cents', () => {
    const other = { ...incomeRecords[0], id: 100, income_source: 'Another payer', value: 999 };
    const records = [...incomeRecords, other, { ...other, id: 101, currency: 'USD' }, { ...other, id: 102, date_iso: '2026-10-01' }, { ...other, id: 103, record_type: 'transfer' as const }];
    const proof = householdIncomeEvidence(records, '2026-10-07', { ...incomeSummary, cents: incomeSummary.cents + 99900 });
    expect(proof.complete).toBe(true); expect(proof.selectedCents).toBe(9441140); expect(proof.retainedCents).toBe(7280000); expect(disposableIncome(proof, 'current').income).toBe(13492.56);
    expect(householdIncomeEvidence(incomeRecords.map(row => ({ ...row, currency: 'NZ$' })), '2026-10-07', incomeSummary).complete).toBe(true);
  });
  it('keeps missing payer months and insufficient receipts unknown rather than inventing zero disposable income', () => {
    const missing = incomeRecords.filter(row => row.id !== 0);
    expect(householdIncomeEvidence(missing, '2026-10-07', { ...incomeSummary, cents: incomeSummary.cents - 334256 }).complete).toBe(false);
    expect(disposableIncome({ ...verifiedIncome, selectedCents: 0 }, 'current').income).toBeNull();
  });
});
