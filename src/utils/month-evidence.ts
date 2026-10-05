import type { Transaction } from '@/types/transaction';
import { isIsoDate } from '@/lib/api-validation';
import { currencyCode, isRent } from '@/utils/dashboard';

export function monthEvidence(transactions: Transaction[], start: string, end: string, today: string) {
  const expenses = transactions.filter(row => (!row.record_type || row.record_type === 'expense') && (!row.direction || row.direction === 'outflow') && isIsoDate(row.date_iso) && Number.isFinite(row.value) && row.value >= 0 && row.category !== 'Savings' && currencyCode(row.currency) === 'NZD' && !isRent(row));
  const rows = expenses.filter(row => row.date_iso >= start && row.date_iso <= end);
  const top = [...rows].sort((a, b) => b.value - a.value || b.date_iso.localeCompare(a.date_iso) || a.id - b.id).slice(0, 10);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const grouped = (field: 'category' | 'place') => [...rows.reduce((map, row) => map.set(row[field], (map.get(row[field]) ?? 0) + row.value), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const days = isIsoDate(start) && isIsoDate(end) ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 : 0;
  const previousEnd = days ? new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10) : '';
  const previousStart = days ? new Date(Date.parse(start) - days * 86400000).toISOString().slice(0, 10) : '';
  const previous = expenses.filter(row => row.date_iso >= previousStart && row.date_iso <= previousEnd);
  return { rows, top, total, topCategory: grouped('category')[0], topMerchant: grouped('place')[0],
    average: rows.length ? total / rows.length : 0, topTenTotal: top.reduce((sum, row) => sum + row.value, 0),
    activeDays: new Set(rows.map(row => row.date_iso)).size, days, partial: today < end,
    previousTotal: previous.length ? previous.reduce((sum, row) => sum + row.value, 0) : null, previousStart, previousEnd };
}
