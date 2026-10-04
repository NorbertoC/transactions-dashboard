import type { Transaction } from '@/types/transaction';

export interface CategoryComparisonPeriod {
  key: string;
  statementEnd: string;
  total: number;
  count: number;
}

interface PeriodAccumulator extends CategoryComparisonPeriod {
  sortDate: string;
}

export function buildCategoryComparison(
  transactions: Transaction[],
  category: string,
  subcategory: string | null,
  limit = 12
): CategoryComparisonPeriod[] {
  const periods = new Map<string, PeriodAccumulator>();

  for (const transaction of transactions) {
    if (!transaction.date_iso) continue;

    const fallbackMonth = transaction.date_iso.slice(0, 7);
    const key = transaction.statement_id ?? fallbackMonth;
    const statementEnd = transaction.statement_end ?? transaction.date_iso;
    const existing = periods.get(key) ?? {
      key,
      statementEnd,
      sortDate: statementEnd,
      total: 0,
      count: 0
    };

    if (statementEnd > existing.sortDate) {
      existing.statementEnd = statementEnd;
      existing.sortDate = statementEnd;
    }

    const matchesCategory = transaction.category === category;
    const matchesSubcategory = subcategory === null || transaction.subcategory === subcategory;
    if (matchesCategory && matchesSubcategory) {
      existing.total += transaction.value;
      existing.count += 1;
    }

    periods.set(key, existing);
  }

  const ordered = [...periods.values()].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  if (ordered.length && ordered.every(period => /^\d{4}-\d{2}-26$/.test(period.key))) {
    const first = ordered[0].statementEnd.slice(0, 7);
    const last = ordered.at(-1)!.statementEnd.slice(0, 7);
    const cursor = new Date(`${last}-26T00:00:00Z`);
    for (let index = 0; index < limit; index++) {
      const key = cursor.toISOString().slice(0, 10);
      if (key.slice(0, 7) < first) break;
      if (!periods.has(key)) periods.set(key, { key, statementEnd: key, sortDate: key, total: 0, count: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
  }
  return [...periods.values()]
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate))
    .slice(-limit)
    .map(({ key, statementEnd, total, count }) => ({
      key,
      statementEnd,
      total,
      count
    }));
}
