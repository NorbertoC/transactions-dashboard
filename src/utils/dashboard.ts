import { isIsoDate } from '@/lib/api-validation';
import type { Transaction } from '@/types/transaction';

export interface DashboardMonth {
  key: string;
  partial: boolean;
  total: number;
}

export function calendarMonths(start: string, end: string): string[] {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return [];
  const months: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  while (`${year}-${String(month).padStart(2, '0')}` <= end.slice(0, 7)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    if (++month > 12) { year++; month = 1; }
  }
  return months;
}

export function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

export function currencyCode(currency: string): string {
  return ['NZ$', 'NZD', '$'].includes(currency) ? 'NZD' : currency;
}

export function isRent(transaction: Transaction): boolean {
  return transaction.category === 'Housing' && transaction.subcategory === 'Rent';
}

export function buildDashboard(
  transactions: Transaction[], start: string, end: string,
  includeRent: boolean, currency: string, today: string
) {
  const months = calendarMonths(start, end);
  const records = transactions.filter(tx => tx.date_iso >= start && tx.date_iso <= end &&
    currencyCode(tx.currency) === currency && (includeRent || !isRent(tx)));
  // The existing import schema stores spending as positive magnitudes. A negative
  // record has no established direction; it must not become invented income.
  const expenses = records.filter(tx => Number.isFinite(tx.value) && tx.value >= 0 && isIsoDate(tx.date_iso) && tx.category !== 'Savings');
  const savings = records.filter(tx => tx.category === 'Savings' && Number.isFinite(tx.value) && tx.value >= 0 && isIsoDate(tx.date_iso))
    .reduce((sum, tx) => sum + tx.value, 0);
  const total = expenses.reduce((sum, tx) => sum + tx.value, 0);
  const categories = [...new Set(expenses.map(tx => tx.category))].map(name => {
    const rows = expenses.filter(tx => tx.category === name);
    const total = rows.reduce((sum, tx) => sum + tx.value, 0);
    return { name, total, average: months.length ? total / months.length : 0, records: rows,
      monthly: months.map(key => rows.filter(tx => tx.date_iso.startsWith(key)).reduce((sum, tx) => sum + tx.value, 0)) };
  }).sort((a, b) => b.total - a.total);
  const monthly: DashboardMonth[] = months.map(key => ({ key,
    partial: start > `${key}-01` || end < monthEnd(key) || today < monthEnd(key),
    total: expenses.filter(tx => tx.date_iso.startsWith(key)).reduce((sum, tx) => sum + tx.value, 0)
  }));
  return { expenses, categories, monthly, total, savings, outflow: total + savings,
    average: months.length ? total / months.length : 0, denominator: months.length,
    unsupported: records.filter(tx => !Number.isFinite(tx.value) || tx.value < 0 || !isIsoDate(tx.date_iso)).length };
}
