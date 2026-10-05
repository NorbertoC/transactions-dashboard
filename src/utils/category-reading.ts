import type { Transaction } from '@/types/transaction';
import type { DashboardMonth } from '@/utils/dashboard';

export function categoryReading(records: Transaction[], months: DashboardMonth[]) {
  const total = records.reduce((sum, row) => sum + row.value, 0);
  const observed = months.map(month => {
    const rows = records.filter(row => row.date_iso.startsWith(month.key));
    return { ...month, total: rows.reduce((sum, row) => sum + row.value, 0), count: rows.length };
  }).filter(month => month.count > 0);
  const maximum = observed.length ? Math.max(...observed.map(month => month.total)) : null;
  return {
    total,
    average: months.length ? total / months.length : null,
    denominator: months.length,
    recordedMonths: observed.length,
    peaks: observed.filter(month => month.total === maximum),
    partial: months.some(month => month.partial),
    count: records.length,
  };
}
