import type { Transaction } from '@/types/transaction';
import type { PeriodSummary, PeriodTopExpense } from '@/types/recurring';

const FIXED_CATEGORIES = new Set(['Housing']);

/**
 * Client-side period summary when the API is offline or has no stored row.
 * Mirrors the API's fixed = Housing + (no recurring projection available).
 */
export function buildClientPeriodSummary(
  transactions: Transaction[],
  statementId: string,
  start: string,
  end: string
): PeriodSummary {
  const inPeriod = transactions.filter(
    (tx) => tx.date_iso && tx.date_iso >= start && tx.date_iso <= end
  );

  let fixed = 0;
  let variable = 0;
  for (const tx of inPeriod) {
    const value = Math.abs(Number(tx.value) || 0);
    if (FIXED_CATEGORIES.has(tx.category)) {
      fixed += value;
    } else {
      variable += value;
    }
  }

  const top_expenses: PeriodTopExpense[] = [...inPeriod]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5)
    .map((tx) => ({
      id: tx.id,
      place: tx.place,
      value: Math.abs(tx.value),
      date_iso: tx.date_iso,
      category: tx.category,
      subcategory: tx.subcategory ?? null
    }));

  const insights: string[] = [];
  if (inPeriod.length === 0) {
    insights.push('Nothing unusual this period');
  } else {
    const merchantTotals = new Map<string, number>();
    for (const tx of inPeriod) {
      merchantTotals.set(
        tx.place,
        (merchantTotals.get(tx.place) || 0) + Math.abs(tx.value)
      );
    }
    const top = [...merchantTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      insights.push(`Largest merchant this period: ${top[0]} (${top[1].toFixed(2)}).`);
    }
  }

  return {
    statement_id: statementId,
    statement_start: start,
    statement_end: end,
    fixed_total: Math.round(fixed * 100) / 100,
    variable_total: Math.round(variable * 100) / 100,
    income_total: 0,
    top_expenses,
    insights,
    computed_at: new Date().toISOString()
  };
}
