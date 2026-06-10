'use client';

import { Fragment, type ReactNode, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Pencil, Search, Trash2 } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { formatCurrency, formatDateFull, formatDateShort } from '@/utils/format';
import { generateColorVariants, lightenColor } from '@/utils/color';
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  getCategoryBadgeStyles,
  getCategoryHexColor,
  getCategoryJapaneseName,
  getSubcategoriesForCategory,
  getSubcategoryJapaneseName
} from '@/constants/categories';

const PAGE_SIZE = 50;

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
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [subcategoryInput, setSubcategoryInput] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const editorId = useId();

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

  const handleSave = async (transaction: Transaction) => {
    if (!categoryInput.trim() && !subcategoryInput.trim()) {
      setActionError({ id: transaction.id, message: 'Please set category or subcategory.' });
      return;
    }
    try {
      setSavingId(transaction.id);
      setActionError(null);
      const category = categoryInput.trim() || transaction.category;
      const subcategory = subcategoryInput.trim() || transaction.subcategory;
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, category, subcategory })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to update transaction');
      }

      onTransactionUpdated?.({ ...transaction, category, subcategory });
      cancelEditing();
    } catch (err) {
      setActionError({
        id: transaction.id,
        message: err instanceof Error ? err.message : 'Failed to update'
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      setDeletingId(transaction.id);
      setActionError(null);
      const response = await fetch(`/api/transactions/${transaction.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete transaction');
      }
      if (editingId === transaction.id) cancelEditing();
      onTransactionDeleted?.(transaction.id);
    } catch (err) {
      setActionError({
        id: transaction.id,
        message: err instanceof Error ? err.message : 'Failed to delete'
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
        title={getCategoryJapaneseName(category)}
      >
        {category}
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
        style={{ backgroundColor: lightenColor(color, 0.85), color }}
        title={getSubcategoryJapaneseName(subcategory)}
      >
        {subcategory}
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
              Category
            </label>
            <select
              id={`${editorId}-category`}
              value={categoryInput}
              onChange={(e) => {
                setCategoryInput(e.target.value);
                setSubcategoryInput('');
              }}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">Select category</option>
              {categoryOptions.map((cat) => {
                const jaName = getCategoryJapaneseName(cat);
                return (
                  <option key={cat} value={cat} title={jaName}>
                    {cat}
                    {jaName ? ` (${jaName})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor={`${editorId}-subcategory`} className="mb-1 block text-xs font-medium text-muted">
              Subcategory
            </label>
            <select
              id={`${editorId}-subcategory`}
              value={subcategoryInput}
              onChange={(e) => setSubcategoryInput(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">Select subcategory</option>
              {subcategoryOptions.map((sub) => (
                <option key={sub.name} value={sub.name} title={sub.nameJa}>
                  {sub.name}
                  {sub.nameJa ? ` (${sub.nameJa})` : ''}
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
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={isBusy}
            className="min-h-11 rounded-xl border border-border-subtle bg-surface px-4 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleDelete(transaction)}
            disabled={isBusy}
            className="min-h-11 rounded-xl border border-border-subtle bg-surface px-4 text-sm font-medium text-red-600 transition-colors hover:bg-surface-2 disabled:opacity-60 dark:text-red-400"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
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

  const resultCountLabel =
    sortedTransactions.length === 1
      ? '1 transaction'
      : `${sortedTransactions.length} transactions`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="mb-3 text-base font-semibold">All Transactions</h2>

      <div className="mb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search transactions"
            placeholder="Search transactions"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface pl-10 pr-3 text-base text-foreground placeholder:text-muted focus:border-primary focus:outline-none sm:text-sm"
          />
        </div>
        <p className="mt-2 text-sm text-muted" role="status" aria-live="polite">
          {searchQuery ? `${resultCountLabel} matching "${searchQuery}"` : resultCountLabel}
        </p>
      </div>

      {sortedTransactions.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            {searchQuery ? 'No transactions match your search.' : 'No transactions yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border-subtle bg-surface md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-subtle">
                <thead className="bg-surface-2">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left">
                      <SortButton field="date">Date</SortButton>
                    </th>
                    <th scope="col" className="px-5 py-3 text-left">
                      <SortButton field="place">Description</SortButton>
                    </th>
                    <th scope="col" className="px-5 py-3 text-left">
                      <SortButton field="category">Category</SortButton>
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      <span className="flex justify-end">
                        <SortButton field="amount">Amount</SortButton>
                      </span>
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {visibleTransactions.map((transaction) => (
                    <Fragment key={transaction.id}>
                      <tr className="transition-colors hover:bg-surface-2">
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-muted">
                          {formatDateFull(transaction.date_iso)}
                        </td>
                        <td className="max-w-xs truncate px-5 py-3 text-sm font-medium">
                          {transaction.place}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {renderCategoryBadge(transaction.category || DEFAULT_CATEGORY)}
                            {renderSubcategoryBadge(transaction.category, transaction.subcategory)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-medium tabular-nums">
                          {formatCurrency(transaction.value)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleEditing(transaction)}
                              aria-label={`Edit ${transaction.place}`}
                              aria-expanded={editingId === transaction.id}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(transaction)}
                              disabled={deletingId === transaction.id}
                              aria-label={`Delete ${transaction.place}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </span>
                        </td>
                      </tr>
                      {editingId === transaction.id && (
                        <tr>
                          <td colSpan={5} className="bg-surface-2 px-5 py-4">
                            {renderEditor(transaction)}
                          </td>
                        </tr>
                      )}
                      {editingId !== transaction.id && actionError?.id === transaction.id && (
                        <tr>
                          <td colSpan={5} className="px-5 py-2">
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
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {visibleTransactions.map((transaction) => (
              <li key={transaction.id} className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <button
                  type="button"
                  onClick={() => toggleEditing(transaction)}
                  aria-expanded={editingId === transaction.id}
                  className="flex min-h-11 w-full flex-col gap-1 p-4 text-left"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate font-medium">{transaction.place}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(transaction.value)}
                    </span>
                  </span>
                  <span className="flex w-full flex-wrap items-center gap-1.5">
                    <span className="text-sm text-muted">{formatDateShort(transaction.date_iso)}</span>
                    {renderCategoryBadge(transaction.category || DEFAULT_CATEGORY)}
                    {renderSubcategoryBadge(transaction.category, transaction.subcategory)}
                  </span>
                </button>
                {editingId === transaction.id && (
                  <div className="border-t border-border-subtle p-4">{renderEditor(transaction)}</div>
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
                Show more ({remainingCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
