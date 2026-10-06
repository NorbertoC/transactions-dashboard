import type { Transaction } from '@/types/transaction';
import { forecastEvidence } from '@/components/forecast/evidence';
import { isIsoDate } from '@/lib/api-validation';
import { currencyCode } from '@/utils/dashboard';

// Same completed-calendar-month spending aggregation as Forecast, including rent.
// No hardcoded year, account balance, or expense example becomes observed evidence.
export function planExpenseEvidence(transactions: Transaction[], today: string) {
  // Bound the observed period using eligible NZD spending only: an older
  // foreign-currency receipt or transfer must not dilute the denominator.
  const expenses = transactions.filter(row => currencyCode(row.currency) === 'NZD' &&
    (!row.record_type || row.record_type === 'expense') && (!row.direction || row.direction === 'outflow') &&
    row.category !== 'Savings' && isIsoDate(row.date_iso) && Number.isFinite(row.value) && row.value >= 0);
  const observed = forecastEvidence(expenses, today);
  return { average: observed.expense, start: observed.start, end: observed.end,
    months: observed.data.denominator, partial: observed.partial,
    excluded: transactions.some(row => currencyCode(row.currency) !== 'NZD') };
}
export type PlanExpenseEvidence = ReturnType<typeof planExpenseEvidence>;
