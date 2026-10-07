import type { Transaction } from '@/types/transaction';
import { isIsoDate } from '@/lib/api-validation';
import { buildDashboard, calendarMonths, currencyCode, monthEnd } from '@/utils/dashboard';

// Plan and the family budget share the current year's available closed calendar
// months. Gaps remain in the divisor; recorded spending never proves coverage.
// Earlier years establish available calendar bounds, but contribute no amounts.
export function currentYearExpenseEvidence(transactions: Transaction[], today: string) {
  const expenses = transactions.filter(row => currencyCode(row.currency) === 'NZD' &&
    (!row.record_type || row.record_type === 'expense') && (!row.direction || row.direction === 'outflow') &&
    row.category !== 'Savings' && isIsoDate(row.date_iso) && row.date_iso <= today &&
    Number.isFinite(row.value) && row.value >= 0);
  const dates = expenses.map(row => row.date_iso).sort();
  const year = today.slice(0, 4), currentMonth = today.slice(0, 7);
  const months = calendarMonths(dates[0] ?? '', dates.at(-1) ?? '')
    .filter(month => month.startsWith(`${year}-`) && month < currentMonth);
  const start = months[0] ? `${months[0]}-01` : '';
  const end = months.at(-1) ? monthEnd(months.at(-1)!) : '';
  const data = buildDashboard(expenses, start, end, true, 'NZD', today);
  const recordedDates = data.expenses.map(row => row.date_iso).sort();
  return { start, end, years: months.length ? [year] : [], data,
    expense: data.denominator && data.expenses.length ? data.average : null,
    excluded: transactions.some(row => currencyCode(row.currency) !== 'NZD'),
    partial: data.denominator > 0 && (!recordedDates.length || recordedDates[0] > start ||
      recordedDates.at(-1)! < end || data.monthly.some(month => !data.expenses.some(row => row.date_iso.startsWith(month.key)))) };
}
