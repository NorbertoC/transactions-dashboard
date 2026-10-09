import type { Transaction } from '@/types/transaction';
import { monthEnd, type DashboardMonth } from '@/utils/dashboard';
import { matchesCategoryView, resolveCategoryView } from '@/utils/category-view';

/** Read the dashboard's already-filtered expenses; never introduce another scope. */
export function buildMesaReading(expenses: readonly Transaction[], months: readonly DashboardMonth[], category: string | null) {
  const records = category === null ? expenses : expenses.filter(row => matchesCategoryView(row, category));
  const groups = new Map<string, { name: string | null; historical: boolean; total: number; count: number }>();
  for (const row of records) {
    const view = resolveCategoryView(row);
    const raw = category === null ? view.category : view.subcategory;
    const name = typeof raw === 'string' && raw.trim() ? raw : null;
    const id = category === null ? view.groupId : name === null ? 'missing' : view.subcategoryId;
    const group = groups.get(id) ?? { name, historical: category !== null && view.status === 'historical', total: 0, count: 0 };
    group.total += row.value;
    group.count++;
    groups.set(id, group);
  }
  const total = records.reduce((sum, row) => sum + row.value, 0);
  return {
    total,
    average: months.length ? total / months.length : null,
    denominator: months.length,
    count: records.length,
    partial: months.some(month => month.partial),
    rows: [...groups].map(([id, group]) => ({ id, ...group, average: months.length ? group.total / months.length : null }))
      .sort((a, b) => b.total - a.total || (a.name ?? '').localeCompare(b.name ?? '')),
  };
}

/** Keep deselected years visibly absent; clip statement edges to actual dates. */
export function mesaReadingPeriods(months: readonly DashboardMonth[], start: string, end: string) {
  const periods: { start: string; end: string; months: string[] }[] = [];
  for (const month of months) {
    const first = `${month.key}-01`;
    const last = monthEnd(month.key);
    const previous = periods.at(-1);
    const next = previous ? new Date(`${previous.months.at(-1)}-01T00:00:00Z`) : null;
    next?.setUTCMonth(next.getUTCMonth() + 1);
    const clippedStart = start > first ? start : first;
    const clippedEnd = end < last ? end : last;
    if (previous && next?.toISOString().slice(0, 7) === month.key) {
      previous.end = clippedEnd;
      previous.months.push(month.key);
    } else {
      periods.push({ start: clippedStart, end: clippedEnd, months: [month.key] });
    }
  }
  return periods;
}
