import { CATEGORIES, normalizeCategoryPair, PURPOSE_TAXONOMY_VERSION } from '@/constants/categories';
import { getUnknownPurposeSuggestion, suggestCategoryForMerchant } from '@/utils/classification';
import type { Transaction } from '@/types/transaction';

/** Read-only proposals; callers must obtain explicit approval before saving any pair. */
export function previewCategoryChanges(transactions: readonly Transaction[]) {
  return transactions.map(row => {
    const protectedRecord = row.category_source === 'manual' || row.record_type === 'income' || row.record_type === 'transfer' ||
      ['income', 'transfer', 'savings'].includes(row.category.toLowerCase());
    const current = { category: row.category, subcategory: row.subcategory ?? '' };
    const proposed = protectedRecord ? { ...current } : normalizeCategoryPair(row.category, row.subcategory);
    const needsReview = !protectedRecord && (proposed.category === 'Others' || !CATEGORIES.some(group => group.name === proposed.category));
    return {
      id: row.id,
      taxonomyVersion: PURPOSE_TAXONOMY_VERSION,
      current,
      proposed,
      protectedRecord,
      changed: current.category !== proposed.category || current.subcategory !== proposed.subcategory,
      needsReview,
      requiresConfirmation: !protectedRecord,
      suggestion: needsReview ? suggestCategoryForMerchant(row.place) ?? getUnknownPurposeSuggestion() : null,
    };
  });
}
