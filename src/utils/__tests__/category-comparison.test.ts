import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types/transaction';
import { buildCategoryComparison } from '@/utils/category-comparison';

function transaction(
  id: number,
  statementEnd: string,
  category: string,
  subcategory: string,
  value: number
): Transaction {
  return {
    id,
    place: `Merchant ${id}`,
    amount: String(value),
    date: statementEnd,
    currency: 'NZD',
    value,
    date_iso: statementEnd,
    category,
    subcategory,
    statement_id: statementEnd,
    statement_start: statementEnd,
    statement_end: statementEnd
  };
}

describe('buildCategoryComparison', () => {
  it('includes statement periods with no spend in the selected category', () => {
    const transactions = [
      transaction(1, '2026-06-26', 'Groceries', 'Food', 200),
      transaction(2, '2026-07-26', 'Transport', 'Fuel', 80),
      transaction(3, '2026-08-26', 'Groceries', 'Food', 400)
    ];

    expect(buildCategoryComparison(transactions, 'Groceries', null)).toEqual([
      { key: '2026-06-26', statementEnd: '2026-06-26', total: 200, count: 1 },
      { key: '2026-07-26', statementEnd: '2026-07-26', total: 0, count: 0 },
      { key: '2026-08-26', statementEnd: '2026-08-26', total: 400, count: 1 }
    ]);
  });

  it('can compare one subcategory without changing the available periods', () => {
    const transactions = [
      transaction(1, '2026-07-26', 'Groceries', 'Food', 200),
      transaction(2, '2026-07-26', 'Groceries', 'Personal care', 50),
      transaction(3, '2026-08-26', 'Groceries', 'Food', 400)
    ];

    expect(buildCategoryComparison(transactions, 'Groceries', 'Food')).toEqual([
      { key: '2026-07-26', statementEnd: '2026-07-26', total: 200, count: 1 },
      { key: '2026-08-26', statementEnd: '2026-08-26', total: 400, count: 1 }
    ]);
  });

  it('returns only the latest 12 periods in chronological order', () => {
    const transactions = Array.from({ length: 13 }, (_, index) => {
      const statementEnd = new Date(Date.UTC(2025, index, 26)).toISOString().slice(0, 10);
      return transaction(index + 1, statementEnd, 'Transport', 'Fuel', index + 1);
    });

    const periods = buildCategoryComparison(transactions, 'Transport', 'Fuel');

    expect(periods).toHaveLength(12);
    expect(periods[0]?.total).toBe(2);
    expect(periods.at(-1)?.total).toBe(13);
  });
});
