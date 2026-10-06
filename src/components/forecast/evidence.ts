import type { Transaction } from '@/types/transaction';
import { isIsoDate } from '@/lib/api-validation';
import { buildDashboard, calendarMonths, monthEnd } from '@/utils/dashboard';
export function forecastEvidence(transactions: Transaction[], today: string) {
  const dates = transactions.map(row => row.date_iso).filter(isIsoDate).sort();
  const lastFullMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0)).toISOString().slice(0, 7);
  const months = calendarMonths(dates[0] ?? '', dates.at(-1) ?? '').filter(month => month <= lastFullMonth);
  const start = months[0] ? `${months[0]}-01` : '', end = months.at(-1) ? monthEnd(months.at(-1)!) : '';
  const data = buildDashboard(transactions, start, end, true, 'NZD', today);
  const incomeCents = data.income.reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  return { start, end, years: [...new Set(months.map(month => month.slice(0, 4)))], data, incomeCents,
    expense: data.denominator && data.expenses.length ? data.average : null,
    excluded: transactions.some(row => !['NZD', 'NZ$'].includes(row.currency)),
    partial: dates.length > 0 && (dates[0] > start || dates.at(-1)! < end || data.monthly.some(month => !data.expenses.some(row => row.date_iso.startsWith(month.key)))) };
}
