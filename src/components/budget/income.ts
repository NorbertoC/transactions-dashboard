import { isIsoDate } from '@/lib/api-validation';
import type { Transaction } from '@/types/transaction';
import type { combineIncomeSummaries } from '@/utils/income';
import type { Scenario } from './model';

// Previously agreed planning reserves, not a tax assessment or withholding calculation.
export const ANNUAL_TAX_CENTS = 2415200;
export const ANNUAL_ACC_CENTS = 276000;
const PAYERS = ['BearPark', 'Survesy'] as const;
type Summary = ReturnType<typeof combineIncomeSummaries>;

export function incomeWindow(today: string) {
  if (!isIsoDate(today)) return null;
  const current = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const start = new Date(current); start.setUTCMonth(start.getUTCMonth() - 6);
  const end = new Date(current); end.setUTCDate(0);
  const first = start.toISOString().slice(0, 10), last = end.toISOString().slice(0, 10);
  const years = Array.from({ length: end.getUTCFullYear() - start.getUTCFullYear() + 1 }, (_, i) => String(start.getUTCFullYear() + i));
  return { start: first, end: last, months: 6, years };
}

function fullyCovered(start: string, end: string, summary: Summary) {
  const ranges = summary.windows.flatMap(window => window.coverage).sort((a, b) => a.start.localeCompare(b.start));
  let cursor = start;
  for (const range of ranges) {
    if (range.end < cursor) continue;
    if (range.start > cursor) return false;
    if (range.end >= end) return true;
    const next = new Date(`${range.end}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return false;
}

export function householdIncomeEvidence(transactions: Transaction[], today: string, summary: Summary | null, available = true) {
  const window = incomeWindow(today);
  const receipts = window ? transactions.filter(row => ['NZD', 'NZ$'].includes(row.currency) && isIsoDate(row.date_iso) && row.date_iso >= window.start && row.date_iso <= window.end && row.record_type === 'income' && row.direction === 'inflow' && Number.isFinite(row.value) && row.value >= 0) : [];
  const allCents = receipts.reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const selected = receipts.filter(row => PAYERS.some(payer => row.income_source === payer));
  const selectedCents = selected.reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const retainedCents = selected.filter(row => row.income_source === 'Survesy').reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const months = new Set(receipts.map(row => row.date_iso.slice(0, 7)));
  const eachPayerPresent = months.size === 6 && PAYERS.every(payer => [...months].every(month => selected.some(row => row.income_source === payer && row.date_iso.startsWith(month))));
  const complete = !!(available && window && summary?.complete && summary.denominator === 6 && Number.isSafeInteger(allCents) && Number.isSafeInteger(selectedCents) && Number.isSafeInteger(retainedCents) && summary.cents === allCents && fullyCovered(window.start, window.end, summary) && eachPayerPresent);
  return { window, allCents, selectedCents, retainedCents, complete, selectedCount: selected.length };
}
export type HouseholdIncomeEvidence = ReturnType<typeof householdIncomeEvidence>;

export function disposableIncome(evidence: HouseholdIncomeEvidence | null, scenario: Scenario) {
  const taxCents = Math.round(ANNUAL_TAX_CENTS / 12), accCents = Math.round(ANNUAL_ACC_CENTS / 12);
  // Keep receipt cents unchanged. The monthly budget rounds each component to cents
  // before subtraction, so the displayed equation and all budget calculations agree.
  const exactReceipts = evidence?.complete ? (scenario === 'current' ? evidence.selectedCents : evidence.retainedCents) / 100 / 6 : null;
  const receiptCents = exactReceipts === null ? null : Math.round(exactReceipts * 100);
  const netCents = receiptCents === null ? null : receiptCents - taxCents - accCents;
  return { receipts: receiptCents === null ? null : receiptCents / 100, exactReceipts, tax: taxCents / 100, acc: accCents / 100,
    income: netCents === null || netCents < 0 ? null : netCents / 100, annualTax: ANNUAL_TAX_CENTS / 100, annualAcc: ANNUAL_ACC_CENTS / 100 };
}
