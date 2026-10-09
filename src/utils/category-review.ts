import { CATEGORIES, PURPOSE_TAXONOMY_VERSION } from '@/constants/categories';
import type { Transaction } from '@/types/transaction';
import { checkSessionResponse, getClientSessionGeneration } from '@/utils/client-session';
import { resolveCategoryView } from '@/utils/category-view';

export const TAXONOMY_VERSION = PURPOSE_TAXONOMY_VERSION;
export type CategoryReviewFailure = 'unavailable' | 'saveFailed' | 'unconfirmed';
export class CategoryReviewError extends Error {
  constructor(readonly reason: CategoryReviewFailure) { super(reason); }
}

/** Capability metadata must describe the exact locally supported pairs. */
export function supportsCategoryReview(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as { version?: unknown; manual_category_persistence?: unknown; categories?: unknown };
  if (data.version !== TAXONOMY_VERSION || data.manual_category_persistence !== true || !Array.isArray(data.categories)) return false;
  const groups = data.categories;
  const pairs = new Set<string>();
  const groupKeys = new Set<string>();
  const subKeys = new Set<string>();
  for (const group of groups) {
    if (!group || typeof group.key !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.subcategories)) return false;
    if (!/^[a-z][a-z0-9_-]*$/.test(group.key) || groupKeys.has(group.key)) return false;
    groupKeys.add(group.key);
    for (const sub of group.subcategories) {
      if (!sub || typeof sub.key !== 'string' || typeof sub.name !== 'string') return false;
      if (!/^[a-z][a-z0-9_-]*$/.test(sub.key) || subKeys.has(sub.key) || pairs.has(`${group.name}|${sub.name}`)) return false;
      subKeys.add(sub.key);
      pairs.add(`${group.name}|${sub.name}`);
    }
  }
  return groups.length === CATEGORIES.length && pairs.size === CATEGORIES.flatMap(group => group.subcategories).length &&
    CATEGORIES.every(group => {
      const remote = groups.find(item => item.key === group.key && item.name === group.name);
      return remote && remote.subcategories.length === group.subcategories.length && group.subcategories.every(sub =>
        remote.subcategories.some((item: { key: string; name: string }) => item.key === sub.key && item.name === sub.name));
    });
}

export function isReviewExpense(row: Transaction): boolean {
  if (row.record_type && row.record_type !== 'expense' || ['income', 'transfer', 'savings'].includes(row.category.toLowerCase())) return false;
  const view = resolveCategoryView(row);
  if (view.groupId === 'others' || view.status === 'historical') return true;
  return row.category_source !== 'manual' && view.status === 'custom';
}

export async function categoryReviewAvailable(signal?: AbortSignal): Promise<boolean> {
  const generation = getClientSessionGeneration();
  const response = await fetch('/api/taxonomy', { cache: 'no-store', signal });
  signal?.throwIfAborted();
  checkSessionResponse(response, generation);
  return response.ok && supportsCategoryReview(await response.json());
}

/** Never invent a successful local row: confirm the actual stored manual pair. */
export async function saveVerifiedCategory(row: Transaction, category: string, subcategory: string, signal?: AbortSignal): Promise<Transaction> {
  if (row.record_type && row.record_type !== 'expense') throw new CategoryReviewError('saveFailed');
  const unchanged = category === row.category && subcategory === row.subcategory;
  if (!unchanged && !CATEGORIES.some(group => group.name === category && group.subcategories.some(sub => sub.name === subcategory))) throw new CategoryReviewError('saveFailed');
  const generation = getClientSessionGeneration();
  if (!await categoryReviewAvailable(signal)) throw new CategoryReviewError('unavailable');
  signal?.throwIfAborted();
  if (generation !== getClientSessionGeneration()) throw new CategoryReviewError('unconfirmed');
  let response: Response;
  try {
    response = await fetch(`/api/transactions/${row.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subcategory }), signal,
    });
  } catch {
    signal?.throwIfAborted();
    throw new CategoryReviewError('unconfirmed');
  }
  signal?.throwIfAborted();
  checkSessionResponse(response, generation);
  if (!response.ok) throw new CategoryReviewError(response.status >= 500 ? 'unconfirmed' : 'saveFailed');
  // No automatic write retries, including when the response is ambiguous.
  try {
    const reload = await fetch('/api/transactions?record_type=expense', { cache: 'no-store', signal });
    signal?.throwIfAborted();
    checkSessionResponse(reload, generation);
    if (!reload.ok) throw new CategoryReviewError('unconfirmed');
    const rows: unknown = await reload.json();
    const matches = Array.isArray(rows) ? rows.filter(item => item?.id === row.id) : [];
    const stored = matches.length === 1 ? matches[0] as Transaction : undefined;
    if (!stored || stored.category !== category || stored.subcategory !== subcategory || stored.category_source !== 'manual') throw new CategoryReviewError('unconfirmed');
    const fields = ['value', 'amount', 'currency', 'date', 'date_iso', 'place', 'record_type', 'direction', 'statement_id', 'statement_start', 'statement_end', 'owner', 'income_source'] as const;
    if (fields.some(field => (stored[field] ?? null) !== (row[field] ?? null))) throw new CategoryReviewError('unconfirmed');
    if (signal?.aborted || generation !== getClientSessionGeneration()) throw new CategoryReviewError('unconfirmed');
    return stored;
  } catch {
    signal?.throwIfAborted();
    throw new CategoryReviewError('unconfirmed');
  }
}
