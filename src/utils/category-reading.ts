import type { Transaction } from '@/types/transaction';
import type { DashboardMonth } from '@/utils/dashboard';

export function categoryReading(records: Transaction[], months: DashboardMonth[]) {
  const total = records.reduce((sum, row) => sum + row.value, 0);
  const monthly = months.map(month => {
    const rows = records.filter(row => row.date_iso.startsWith(month.key));
    return { ...month, total: rows.reduce((sum, row) => sum + row.value, 0), count: rows.length };
  });
  const observed = monthly.filter(month => month.count > 0);
  const changes = monthly.flatMap((month, index) => {
    const previous = monthly[index - 1];
    if (!previous || month.partial || previous.partial || !month.count || !previous.count) return [];
    const nextMonth = new Date(`${previous.key}-01T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    if (nextMonth.toISOString().slice(0, 7) !== month.key) return [];
    return [{ from: previous.key, to: month.key, difference: month.total - previous.total }];
  });
  const maximum = observed.length ? Math.max(...observed.map(month => month.total)) : null;
  const peak = observed.find(month => month.total === maximum);
  const merchants = new Map<string, number>();
  records.filter(row => peak && row.date_iso.startsWith(peak.key)).forEach(row => {
    merchants.set(row.place, (merchants.get(row.place) ?? 0) + row.value);
  });
  const topMerchant = [...merchants].sort((a, b) => b[1] - a[1])[0];
  return {
    monthly,
    changes,
    latestChange: changes.at(-1) ?? null,
    peakShare: peak && total > 0 ? peak.total / total : null,
    topMerchant: topMerchant ? { place: topMerchant[0], total: topMerchant[1], month: peak!.key } : null,
    total,
    average: months.length ? total / months.length : null,
    denominator: months.length,
    recordedMonths: observed.length,
    peaks: observed.filter(month => month.total === maximum),
    partial: months.some(month => month.partial),
    count: records.length,
  };
}
