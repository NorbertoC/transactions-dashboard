import { isIsoDate } from '@/lib/api-validation';
import type { IncomeSummary } from '@/types/income';

export function incomeWindows(start: string, end: string, years: readonly string[]) {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return [];
  return [...new Set(years)].sort().flatMap(year => {
    const first = start > `${year}-01-01` ? start : `${year}-01-01`;
    const last = end < `${year}-12-31` ? end : `${year}-12-31`;
    return first <= last ? [{ start: first, end: last }] : [];
  });
}

export function validateIncomeSummary(value: unknown): IncomeSummary {
  const data = value as IncomeSummary;
  if (!data || !isIsoDate(data.start_date) || !isIsoDate(data.end_date) || data.end_date < data.start_date || !Array.isArray(data.coverage) || !data.coverage.every(range => isIsoDate(range.start) && isIsoDate(range.end) && range.start <= range.end) || !Number.isSafeInteger(data.covered_calendar_months) || data.covered_calendar_months < 0 || typeof data.coverage_complete !== 'boolean' || !data.totals_by_currency || typeof data.totals_by_currency !== 'object' || !Object.values(data.totals_by_currency).every(total => Number.isSafeInteger(total.cents) && total.cents >= 0 && Number.isFinite(total.total) && Math.round(total.total * 100) === total.cents && Number.isFinite(total.monthly_average))) throw new Error('Income coverage unavailable');
  return data;
}

export function combineIncomeSummaries(summaries: IncomeSummary[], currency: string) {
  const cents = summaries.reduce((sum, item) => sum + (item.totals_by_currency[currency]?.cents ?? 0), 0);
  const denominator = summaries.reduce((sum, item) => sum + item.covered_calendar_months, 0);
  return { cents, total: cents / 100, denominator, average: denominator ? cents / 100 / denominator : null,
    complete: summaries.length > 0 && summaries.every(item => item.coverage_complete),
    windows: summaries.map(item => ({ start: item.start_date, end: item.end_date, coverage: item.coverage })) };
}
