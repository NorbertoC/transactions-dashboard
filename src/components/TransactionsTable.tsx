'use client';

import { Fragment, type ReactNode, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Pencil, Search, Sparkles, Trash2 } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { formatCurrency, formatDateFull, formatDateShort } from '@/utils/format';
import { generateColorVariants } from '@/utils/color';
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  getCategoryBadgeStyles,
  getCategoryHexColor,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName,
  getSubcategoriesForCategory,
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import { suggestCategoryForMerchant, type Classification } from '@/utils/classification';

const PAGE_SIZE = 20;

interface TransactionsTableProps {
  transactions: Transaction[];
  categoryColors?: Record<string, string>;
  onTransactionUpdated?: (transaction: Transaction) => void;
  onTransactionDeleted?: (id: number) => void;
}

type SortField = 'date' | 'place' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

interface ActionError {
  id: number;
  message: string;
}

export default function TransactionsTable({
  transactions,
  categoryColors,
  onTransactionUpdated,
  onTransactionDeleted
}: TransactionsTableProps) {
  const { t, locale } = useLocale();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewSuggestionsOnly, setReviewSuggestionsOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [subcategoryInput, setSubcategoryInput] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const editorId = useId();

  const categorySuggestions = useMemo(() => {
    const suggestions = new Map<number, Classification>();

    transactions.forEach((transaction) => {
      if (transaction.category_source === 'manual') return;
      const suggestion = suggestCategoryForMerchant(transaction.place);
      if (!suggestion) return;

      const categoryMatches = suggestion.category === transaction.category;
      const subcategoryMatches = suggestion.subcategory === transaction.subcategory;
      if (!categoryMatches || !subcategoryMatches) {
        suggestions.set(transaction.id, suggestion);
      }
    });

    return suggestions;
  }, [transactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(field);
    setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (reviewSuggestionsOnly && !categorySuggestions.has(transaction.id)) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      transaction.place.toLowerCase().includes(query) ||
      transaction.category.toLowerCase().includes(query) ||
      transaction.subcategory?.toLowerCase().includes(query) ||
      transaction.value.toString().includes(query)
    );
  });

  const getSortValue = (transaction: Transaction): string | number => {
    if (sortField === 'date') return new Date(transaction.date_iso).getTime();
    if (sortField === 'place') return transaction.place.toLowerCase();
    if (sortField === 'category') return transaction.category.toLowerCase();
    return transaction.value;
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const visibleTransactions = sortedTransactions.slice(0, visibleCount);
  const remainingCount = sortedTransactions.length - visibleTransactions.length;

  // Generate subcategory color mapping: variants of the category base color,
  // assigned by descending spend per subcategory.
  const subcategoryColorMap = useMemo(() => {
    const colorMap: Record<string, string> = {};
    const categorySubcategories: Record<string, Array<{ name: string; value: number }>> = {};

    transactions.forEach((transaction) => {
      const { category, subcategory } = transaction;
      if (!category || !subcategory) return;

      categorySubcategories[category] ??= [];
      const existing = categorySubcategories[category].find((s) => s.name === subcategory);
      if (existing) {
        existing.value += transaction.value;
        return;
      }
      categorySubcategories[category].push({ name: subcategory, value: transaction.value });
    });

    Object.entries(categorySubcategories).forEach(([category, subcategories]) => {
      const baseColor = categoryColors?.[category] ?? getCategoryHexColor(category);
      const sortedSubcategories = [...subcategories].sort((a, b) => b.value - a.value);
      const colorVariants = generateColorVariants(baseColor, sortedSubcategories.length, true);
      sortedSubcategories.forEach((subcategory, index) => {
        colorMap[`${category}:${subcategory.name}`] = colorVariants[index];
      });
    });

    return colorMap;
  }, [transactions, categoryColors]);

  const categoryOptions = useMemo(() => {
    const primaryNames = CATEGORIES.map((c) => c.name);
    const otherCategories = new Set<string>();
    transactions.forEach((t) => {
      if (t.category && !primaryNames.includes(t.category)) {
        otherCategories.add(t.category);
      }
    });
    return [...primaryNames, ...Array.from(otherCategories).sort((a, b) => a.localeCompare(b))];
  }, [transactions]);

  const subcategoryOptions = useMemo(() => {
    if (!categoryInput) return [];
    const predefined = getSubcategoriesForCategory(categoryInput);
    const existingSubcategories = new Set<string>();
    transactions.forEach((t) => {
      if (t.category === categoryInput && t.subcategory) {
        existingSubcategories.add(t.subcategory);
      }
    });
    const predefinedNames = predefined.map((s) => s.name);
    const otherSubcategories = Array.from(existingSubcategories).filter((s) => !predefinedNames.includes(s));
    return [
      ...predefined.map((s) => ({ name: s.name, nameJa: s.nameJa })),
      ...otherSubcategories.map((s) => ({ name: s, nameJa: undefined as string | undefined }))
    ];
  }, [categoryInput, transactions]);

  const startEditing = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setCategoryInput(transaction.category || '');
    setSubcategoryInput(transaction.subcategory ?? '');
    setActionError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setCategoryInput('');
    setSubcategoryInput('');
    setActionError(null);
  };

  const toggleEditing = (transaction: Transaction) => {
    if (editingId === transaction.id) {
      cancelEditing();
      return;
    }
    startEditing(transaction);
  };

  const persistCategory = async (
    transaction: Transaction,
    category: string,
    subcategory: string | undefined
  ) => {
    try {
      setSavingId(transaction.id);
      setActionError(null);
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, category, subcategory })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? t('table.updateFailed'));
      }

      onTransactionUpdated?.({
        ...transaction,
        category,
        subcategory,
        category_source: 'manual'
      });
      if (editingId === transaction.id) cancelEditing();
    } catch (err) {
      setActionError({
        id: transaction.id,
        message: err instanceof Error ? err.message : t('table.updateFailed')
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSave = async (transaction: Transaction) => {
    if (!categoryInput.trim() && !subcategoryInput.trim()) {
      setActionError({ id: transaction.id, message: t('table.setCategoryError') });
      return;
    }

    const category = categoryInput.trim() || transaction.category;
    const predefinedSubcategories = getSubcategoriesForCategory(category);
    const requestedSubcategory = subcategoryInput.trim() || transaction.subcategory;
    const requestedIsValid = predefinedSubcategories.some(
      (subcategory) => subcategory.name === requestedSubcategory
    );
    const subcategory =
      predefinedSubcategories.length > 0 && !requestedIsValid
        ? predefinedSubcategories[0].name
        : requestedSubcategory;

    await persistCategory(transaction, category, subcategory);
  };

  const applySuggestion = async (transaction: Transaction) => {
    const suggestion = categorySuggestions.get(transaction.id);
    if (!suggestion) return;
    await persistCategory(transaction, suggestion.category, suggestion.subcategory);
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm(t('table.deleteConfirm'))) return;
    try {
      setDeletingId(transaction.id);
      setActionError(null);
      const response = await fetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? t('table.deleteFailed'));
      }
      if (editingId === transaction.id) cancelEditing();
      onTransactionDeleted?.(transaction.id);
    } catch (err) {
      setActionError({
        id: transaction.id,
        message: err instanceof Error ? err.message : t('table.deleteFailed')
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderCategoryBadge = (category: string) => {
    const colors = getCategoryBadgeStyles(category);
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
        style={colors.style}
        title={category}
      >
        {getLocalizedCategoryName(category, locale)}
      </span>
    );
  };

  const renderSubcategoryBadge = (category: string, subcategory: string | undefined) => {
    if (!subcategory) return null;
    const color =
      subcategoryColorMap[`${category}:${subcategory}`] ??
      categoryColors?.[category] ??
      getCategoryHexColor(category);
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        title={subcategory}
      >
        {getLocalizedSubcategoryName(subcategory, locale)}
      </span>
    );
  };

  const renderEditor = (transaction: Transaction) => {
    const isSaving = savingId === transaction.id;
    const isDeleting = deletingId === transaction.id;
    const isBusy = isSaving || isDeleting;

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${editorId}-category`} className="mb-1 block text-xs font-medium text-muted">
              {t('table.categoryLabel')}
            </label>
            <select
              id={`${editorId}-category`}
              value={categoryInput}
              onChange={(e) => {
                const category = e.target.value;
                setCategoryInput(category);
                setSubcategoryInput(getSubcategoriesForCategory(category)[0]?.name ?? '');
              }}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">{t('table.selectCategory')}</option>
              {categoryOptions.map((cat) => {
                return (
                  <option key={cat} value={cat}>
                    {getLocalizedCategoryName(cat, locale)}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor={`${editorId}-subcategory`} className="mb-1 block text-xs font-medium text-muted">
              {t('table.subcategoryLabel')}
            </label>
            <select
              id={`${editorId}-subcategory`}
              value={subcategoryInput}
              onChange={(e) => setSubcategoryInput(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">{t('table.selectSubcategory')}</option>
              {subcategoryOptions.map((sub) => (
                <option key={sub.name} value={sub.name}>
                  {getLocalizedSubcategoryName(sub.name, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {actionError?.id === transaction.id && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {actionError.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(transaction)}
            disabled={isBusy}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSaving ? t('table.saving') : t('table.save')}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isBusy}
            className="min-h-11 rounded-xl border border-border-subtle bg-surface px-4 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
          >
            {t('table.cancel')}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(transaction)}
            disabled={isBusy}
            className="min-h-11 rounded-xl border border-border-subtle bg-surface px-4 text-sm font-medium text-red-600 transition-colors hover:bg-surface-2 disabled:opacity-60 dark:text-red-400"
          >
            {isDeleting ? t('table.deleting') : t('table.delete')}
          </button>
        </div>
      </div>
    );
  };

  const SortButton = ({ field, children }: { field: SortField; children: ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted transition-colors hover:text-foreground"
    >
      {children}
      <span className="flex flex-col" aria-hidden="true">
        <ChevronUp
          className={`h-3 w-3 ${sortField === field && sortDirection === 'asc' ? 'text-primary' : 'text-muted/50'}`}
        />
        <ChevronDown
          className={`-mt-1 h-3 w-3 ${sortField === field && sortDirection === 'desc' ? 'text-primary' : 'text-muted/50'}`}
        />
      </span>
    </button>
  );

  const resultCountLabel = t(
    sortedTransactions.length === 1 ? 'table.resultSingular' : 'table.resultPlural',
    { count: sortedTransactions.length }
  );
  let emptyMessage = t('table.empty');
  if (reviewSuggestionsOnly) {
    emptyMessage = t('table.noSuggestions');
  } else if (searchQuery) {
    emptyMessage = t('table.searchEmpty');
  }

  const renderSuggestion = (transaction: Transaction, mobile = false) => {
    const suggestion = categorySuggestions.get(transaction.id);
    if (!suggestion) return null;

    const category = getLocalizedCategoryName(suggestion.category, locale);
    const subcategory = getLocalizedSubcategoryName(suggestion.subcategory, locale);
    const isSaving = savingId === transaction.id;

    return (
      <div
        className={
          mobile
            ? 'mx-3 mb-3 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-200'
            : 'mt-2 flex max-w-full items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-200'
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 leading-4">
            {t('table.suggested', { category, subcategory })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => applySuggestion(transaction)}
          disabled={isSaving}
          aria-label={t('table.useSuggested', { category, subcategory })}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-amber-500/40 bg-surface px-3 font-semibold text-foreground transition-colors hover:bg-amber-500/20 focus-visible:bg-amber-500/20 disabled:opacity-60"
        >
          {isSaving ? t('table.applyingSuggestion') : t('table.applySuggestion')}
        </button>
      </div>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t('table.title')}</h2>
          <p className="mt-0.5 text-xs text-muted">{t('table.description')}</p>
        </div>
        <p className="text-sm tabular-nums text-muted" role="status" aria-live="polite">
          {searchQuery
            ? t('table.matching', { count: resultCountLabel, query: searchQuery })
            : resultCountLabel}
        </p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label={t('table.search')}
            placeholder={t('table.search')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface pl-10 pr-3 text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none sm:text-sm"
          />
        </div>
        {(categorySuggestions.size > 0 || reviewSuggestionsOnly) && (
          <button
            type="button"
            onClick={() => {
              setReviewSuggestionsOnly((current) => !current);
              setVisibleCount(PAGE_SIZE);
            }}
            aria-pressed={reviewSuggestionsOnly}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
              reviewSuggestionsOnly
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-200'
                : 'border-border-subtle bg-surface text-muted hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('table.reviewSuggestions', { count: categorySuggestions.size })}
          </button>
        )}
      </div>

      {sortedTransactions.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-surface lg:block">
              <table className="w-full table-fixed divide-y divide-border-subtle">
                <colgroup>
                  <col className="w-[9.25rem]" />
                  <col />
                  <col className="w-[24rem] xl:w-[30rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[7rem]" />
                </colgroup>
                <thead className="bg-surface-2">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">
                      <SortButton field="date">{t('table.date')}</SortButton>
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      <SortButton field="place">{t('table.place')}</SortButton>
                    </th>
                    <th scope="col" className="px-4 py-3 text-left">
                      <SortButton field="category">{t('table.category')}</SortButton>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="flex justify-end">
                        <SortButton field="amount">{t('table.amount')}</SortButton>
                      </span>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                      {t('table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {visibleTransactions.map((transaction) => (
                    <Fragment key={transaction.id}>
                      <tr className="transition-colors hover:bg-surface-2">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                          {formatDateFull(transaction.date_iso, locale)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <span className="block truncate" title={transaction.place}>
                            {transaction.place}
                          </span>
                        </td>
                        <td className="min-w-0 px-4 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {renderCategoryBadge(transaction.category || DEFAULT_CATEGORY)}
                            {renderSubcategoryBadge(transaction.category, transaction.subcategory)}
                          </span>
                          {renderSuggestion(transaction)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums">
                          {formatCurrency(transaction.value, locale)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleEditing(transaction)}
                              aria-label={t('table.editAria', { place: transaction.place })}
                              aria-expanded={editingId === transaction.id}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(transaction)}
                              disabled={deletingId === transaction.id}
                              aria-label={t('table.deleteAria', { place: transaction.place })}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </span>
                        </td>
                      </tr>
                      {editingId === transaction.id && (
                        <tr>
                          <td colSpan={5} className="bg-surface-2 px-4 py-4">
                            {renderEditor(transaction)}
                          </td>
                        </tr>
                      )}
                      {editingId !== transaction.id && actionError?.id === transaction.id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-2">
                            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                              {actionError.message}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 lg:hidden">
            {visibleTransactions.map((transaction) => (
              <li key={transaction.id} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <button
                  type="button"
                  onClick={() => toggleEditing(transaction)}
                  aria-expanded={editingId === transaction.id}
                  className="flex min-h-11 w-full flex-col gap-2 p-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{transaction.place}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(transaction.value, locale)}
                    </span>
                  </span>
                  <span className="flex w-full flex-wrap items-center gap-1.5">
                    <span className="mr-auto text-xs text-muted">{formatDateShort(transaction.date_iso, locale)}</span>
                    {renderCategoryBadge(transaction.category || DEFAULT_CATEGORY)}
                    {renderSubcategoryBadge(transaction.category, transaction.subcategory)}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                        editingId === transaction.id ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {editingId !== transaction.id && renderSuggestion(transaction, true)}
                {editingId === transaction.id && (
                  <div className="border-t border-border-subtle p-4">{renderEditor(transaction)}</div>
                )}
                {editingId !== transaction.id && actionError?.id === transaction.id && (
                  <p role="alert" className="mx-4 mb-3 text-sm text-red-600 dark:text-red-400">
                    {actionError.message}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {remainingCount > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="min-h-11 rounded-xl border border-border-subtle bg-surface px-5 text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {t('table.showMore', { count: remainingCount })}
              </button>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
