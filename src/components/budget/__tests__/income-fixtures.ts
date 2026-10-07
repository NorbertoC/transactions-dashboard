import type { Transaction } from '@/types/transaction';
import { combineIncomeSummaries } from '@/utils/income';
import { householdIncomeEvidence } from '../income';

// Aggregate-only synthetic receipts; no account details or individual payment records.
export const incomeRecords: Transaction[] = [3342.56, 3325.73, 3388.84, 3004.29, 3443.55, 5106.43].flatMap((amount, i) => [
  { id: i * 2, value: amount, income_source: 'BearPark', currency: 'NZD', category: 'Income', date_iso: `2026-${String(i + 4).padStart(2, '0')}-15`, date: '', amount: '', place: 'Synthetic fixture', record_type: 'income', direction: 'inflow' },
  { id: i * 2 + 1, value: [12320, 12320, 11760, 11760, 12880, 11760][i], income_source: 'Survesy', currency: 'NZD', category: 'Income', date_iso: `2026-${String(i + 4).padStart(2, '0')}-15`, date: '', amount: '', place: 'Synthetic fixture', record_type: 'income', direction: 'inflow' },
] as Transaction[]);
export const incomeSummary = combineIncomeSummaries([{ start_date: '2026-04-01', end_date: '2026-09-30', covered_calendar_months: 6, coverage_complete: true, basis: 'Synthetic verified fixture', coverage: [{ start: '2026-04-01', end: '2026-09-30' }], totals_by_currency: { NZD: { cents: 9441140, total: 94411.4, monthly_average: 94411.4 / 6 } } }], 'NZD');
export const verifiedIncome = householdIncomeEvidence(incomeRecords, '2026-10-07', incomeSummary);
