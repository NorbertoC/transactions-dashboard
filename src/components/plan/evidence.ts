import type { Transaction } from '@/types/transaction';
import { currentYearExpenseEvidence } from '@/utils/expense-evidence';

// Same current-year closed-calendar-month spending source as the family budget.
// No hardcoded year, account balance, or expense example becomes observed evidence.
export function planExpenseEvidence(transactions: Transaction[], today: string) {
  const observed = currentYearExpenseEvidence(transactions, today);
  return { average: observed.expense, start: observed.start, end: observed.end,
    months: observed.data.denominator, partial: observed.partial,
    excluded: observed.excluded };
}
export type PlanExpenseEvidence = ReturnType<typeof planExpenseEvidence>;
