import { normalizeCategoryPair } from '@/constants/categories';
import type { Transaction } from '@/types/transaction';

export function previewCategoryChanges(transactions: readonly Transaction[]) {
  return transactions.map(row => {
    const protectedRecord = row.category_source === 'manual' || row.record_type === 'income' || row.record_type === 'transfer';
    const proposed = protectedRecord
      ? { category: row.category, subcategory: row.subcategory ?? '' }
      : normalizeCategoryPair(row.category, row.subcategory);
    return {
      id: row.id,
      current: { category: row.category, subcategory: row.subcategory ?? '' },
      proposed,
      protectedRecord,
      changed: row.category !== proposed.category || (row.subcategory ?? '') !== proposed.subcategory,
      needsReview: !protectedRecord && proposed.category === 'Others',
    };
  });
}
