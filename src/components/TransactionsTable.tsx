'use client';

import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Pencil, Search, Sparkles, Trash2 } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { transactionLabel } from '@/utils/transaction-label';
import { formatCurrency, formatDateFull, formatDateShort } from '@/utils/format';
import {
  CATEGORIES,
  getCategoryHexColor,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName,
  getSubcategoryPurposeHint,
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import { getLocalizedSuggestionReason, suggestCategoryForMerchant, type ClassificationSuggestion } from '@/utils/classification';
import { categoryReviewAvailable, CategoryReviewError, isReviewExpense, saveVerifiedCategory } from '@/utils/category-review';
import { categoryReviewMessages } from '@/i18n/category-review-messages';
import { editorPair, resolveCategoryView, viewCategoryLabel, viewSubcategoryLabel } from '@/utils/category-view';
import { SESSION_INVALIDATED } from '@/utils/client-session';

const PAGE_SIZE = 20;

interface TransactionsTableProps {
  transactions: Transaction[];
  categoryColors?: Record<string, string>;
  onTransactionUpdated?: (transaction: Transaction) => void;
  onTransactionDeleted?: (id: number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  scopeLabel?: string;
  currency?: string;
  movementTypes?: boolean;
}

type SortField = 'date' | 'place' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

interface ActionError {
  id: number;
  message: string;
}

export default function TransactionsTable({
  transactions,
  onTransactionUpdated,
  onTransactionDeleted, searchQuery: controlledSearch, onSearchChange, scopeLabel, currency = 'NZD', movementTypes = false
}: TransactionsTableProps) {
  const { t, locale } = useLocale();
  const reviewCopy = categoryReviewMessages[locale];
  const isExpense = (row: Transaction) => !row.record_type || row.record_type === 'expense';
  const signedValue = (row: Transaction) => row.record_type === 'transfer' ? 0 : row.direction === 'inflow' ? row.value : -row.value;
  const displayAmount = (row: Transaction) => `${movementTypes ? row.direction === 'inflow' ? '+' : '−' : ''}${money(row.value)}`;
  const movementLabel = (row: Transaction) => t(`income.${row.record_type ?? 'expense'}`);
  const badges = (row: Transaction) => isExpense(row) ? renderExpenseBadges(row) : <span className="mesa-micro">{movementLabel(row)}{row.record_type !== 'income' && row.income_source ? ` · ${row.income_source}` : ''}</span>;
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [localSearch, setLocalSearch] = useState('');
  const searchQuery = controlledSearch ?? localSearch;
  const [queryDraft, setQueryDraft] = useState<string | null>(null);
  const money = (value: number) => formatCurrency(value, locale, currency);
  const [reviewSuggestionsOnly, setReviewSuggestionsOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [subcategoryInput, setSubcategoryInput] = useState('');
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const editorId = useId();
  const [capability, setCapability] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const pendingSave = useRef<AbortController | null>(null);
  const capabilityRequest = useRef<AbortController | null>(null);
  const currentRows = useRef(transactions);
  currentRows.current = transactions;
  useEffect(() => {
    const request = new AbortController();
    capabilityRequest.current = request;
    setCapability('checking');
    void categoryReviewAvailable(request.signal).then(ready => {
      if (!request.signal.aborted) setCapability(ready ? 'ready' : 'unavailable');
    }).catch(() => { if (!request.signal.aborted) setCapability('unavailable'); });
    return () => request.abort();
  }, [capabilityAttempt]);
  useEffect(() => {
    const invalidate = () => {
      pendingSave.current?.abort();
      capabilityRequest.current?.abort();
      setCapability('unavailable');
      setSavingId(null);
      setEditingId(null);
    };
    window.addEventListener(SESSION_INVALIDATED, invalidate);
    return () => {
      pendingSave.current?.abort();
      window.removeEventListener(SESSION_INVALIDATED, invalidate);
    };
  }, []);
  const reviewRows = useMemo(() => transactions.filter(isReviewExpense), [transactions]);

  const categorySuggestions = useMemo(() => {
    const suggestions = new Map<number, ClassificationSuggestion>();

    transactions.forEach((transaction) => {
      if (!isReviewExpense(transaction) || transaction.category_source === 'manual') return;
      const suggestion = suggestCategoryForMerchant(transaction.place);
      if (!suggestion || suggestion.category === 'Others' || suggestion.confidence === 'review') return;

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
    if (onSearchChange) onSearchChange(value); else setLocalSearch(value);
    setQueryDraft(null);
    setVisibleCount(PAGE_SIZE);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (reviewSuggestionsOnly && !isReviewExpense(transaction)) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const view = resolveCategoryView(transaction);
    return (
      viewCategoryLabel(view, locale).toLowerCase().includes(query) ||
      viewSubcategoryLabel(view, locale).toLowerCase().includes(query) ||
      transactionLabel(transaction).toLowerCase().includes(query) ||
      transaction.place.toLowerCase().includes(query) ||
      transaction.category.toLowerCase().includes(query) ||
      transaction.subcategory?.toLowerCase().includes(query) ||
      transaction.owner?.toLowerCase().includes(query) ||
      transaction.income_source?.toLowerCase().includes(query) ||
      (movementTypes && movementLabel(transaction).toLowerCase().includes(query)) ||
      transaction.value.toString().includes(query)
    );
  });

  const getSortValue = (transaction: Transaction): string | number => {
    if (sortField === 'date') return new Date(transaction.date_iso).getTime();
    if (sortField === 'place') return transactionLabel(transaction).toLowerCase();
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

  const editingRow = transactions.find(row => row.id === editingId);
  const originalView = editingRow ? resolveCategoryView(editingRow) : null;
  const categoryOptions = CATEGORIES;
  const selectedGroup = CATEGORIES.find(group => group.key === categoryInput);
  const subcategoryOptions = selectedGroup?.subcategories ?? [];
  const retainCategory = originalView !== null && !CATEGORIES.some(group => group.key === originalView.groupId);
  const retainSubcategory = originalView !== null && categoryInput === originalView.groupId && !subcategoryOptions.some(sub => sub.key === originalView.subcategoryId);

  const startEditing = (transaction: Transaction) => {
    setEditingId(transaction.id);
    const view = resolveCategoryView(transaction);
    setCategoryInput(view.groupId);
    setSubcategoryInput(view.subcategoryId);
    setSelectionTouched(false);
    setActionError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setCategoryInput('');
    setSubcategoryInput('');
    setActionError(null);
  };

  const toggleEditing = (transaction: Transaction) => {
    if (pendingSave.current) return;
    if (!isExpense(transaction)) return;
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
    if (pendingSave.current || capability !== 'ready') return;
    const request = new AbortController();
    pendingSave.current = request;
    try {
      setSavingId(transaction.id);
      setActionError(null);
      const stored = await saveVerifiedCategory(transaction, category, subcategory ?? '', request.signal);
      if (request.signal.aborted) return;
      onTransactionUpdated?.(stored);
      if (editingId === transaction.id) cancelEditing();
    } catch (err) {
      if (!request.signal.aborted) setActionError({
        id: transaction.id,
        message: err instanceof CategoryReviewError ? reviewCopy[err.reason] : reviewCopy.saveFailed,
      });
    } finally {
      if (pendingSave.current === request) {
        pendingSave.current = null;
        if (!request.signal.aborted) setSavingId(null);
      }
    }
  };

  const handleSave = async (transaction: Transaction) => {
    const original = resolveCategoryView(transaction);
    if ((!selectionTouched || transaction.subcategory == null) && categoryInput === original.groupId && subcategoryInput === original.subcategoryId) {
      cancelEditing();
      return;
    }
    const pair = editorPair(transaction, categoryInput, subcategoryInput, selectionTouched);
    if (!pair || !pair.category.trim()) {
      setActionError({ id: transaction.id, message: reviewCopy.chooseSubcategory });
      return;
    }
    await persistCategory(transaction, pair.category, pair.subcategory);
  };

  const applySuggestion = async (transaction: Transaction) => {
    const current = currentRows.current.find(row => row.id === transaction.id);
    const suggestion = categorySuggestions.get(transaction.id);
    if (!current || current.category_source === 'manual' || !isReviewExpense(current) || !suggestion) return;
    await persistCategory(current, suggestion.category, suggestion.subcategory);
  };

  const handleDelete = async (transaction: Transaction) => {
    if (pendingSave.current) return;
    if (!isExpense(transaction)) return;
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

  const renderExpenseBadges = (transaction: Transaction) => {
    const view = resolveCategoryView(transaction);
    const color = getCategoryHexColor(view.category);
    return <>
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--foreground)', borderLeft: `3px solid ${color}` }} title={transaction.category}>
        {viewCategoryLabel(view, locale)}
      </span>
      {view.subcategory && <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--foreground)', borderLeft: `3px solid ${color}` }} title={transaction.subcategory}>
        {viewSubcategoryLabel(view, locale)}
      </span>}
    </>;
  };

  const renderEditor = (transaction: Transaction, screen: 'desktop' | 'mobile') => {
    const isSaving = savingId === transaction.id;
    const isDeleting = deletingId === transaction.id;
    const isBusy = savingId !== null || isDeleting || capability !== 'ready';

    return (
      <div className="mesa-category-editor space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${editorId}-${screen}-category`} className="mb-1 block text-xs font-medium text-muted">
              {t('table.categoryLabel')}
            </label>
            <div className="mesa-select"><select
              id={`${editorId}-${screen}-category`}
              value={categoryInput}
              disabled={savingId !== null}
              onChange={(e) => {
                const category = e.target.value;
                setCategoryInput(category);
                setSubcategoryInput('');
                setSelectionTouched(true);
              }}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">{t('table.selectCategory')}</option>
              <optgroup label={reviewCopy.currentPurposes}>{categoryOptions.map(cat => <option key={cat.key} value={cat.key}>{getLocalizedCategoryName(cat.name, locale)}</option>)}</optgroup>
              {retainCategory && originalView && <optgroup label={reviewCopy.retainOriginal}><option value={originalView.groupId}>{editingRow?.category}</option></optgroup>}
            </select><ChevronDown aria-hidden="true" /></div>
          </div>
          <div>
            <label htmlFor={`${editorId}-${screen}-subcategory`} className="mb-1 block text-xs font-medium text-muted">
              {t('table.subcategoryLabel')}
            </label>
            <div className="mesa-select"><select
              id={`${editorId}-${screen}-subcategory`}
              value={subcategoryInput}
              disabled={savingId !== null}
              onChange={(e) => { setSubcategoryInput(e.target.value); setSelectionTouched(true); }}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-base sm:text-sm"
            >
              <option value="">{t('table.selectSubcategory')}</option>
              <optgroup label={reviewCopy.currentPurposes}>{subcategoryOptions.map(sub => <option key={sub.key} value={sub.key}>{locale === 'ja' ? sub.nameJa : locale === 'es' ? sub.nameEs : sub.name}</option>)}</optgroup>
              {retainSubcategory && originalView && <optgroup label={reviewCopy.retainOriginal}><option value={originalView.subcategoryId}>{editingRow?.subcategory || '—'} · {originalView.status === 'historical' ? reviewCopy.historical : reviewCopy.retainOriginal}</option></optgroup>}
            </select><ChevronDown aria-hidden="true" /></div>
          </div>
        </div>
        <p className="mesa-micro">{reviewCopy.storedPair}: {transaction.category || '—'} · {transaction.subcategory || '—'}</p>
        {getSubcategoryPurposeHint(selectedGroup?.subcategories.find(sub => sub.key === subcategoryInput)?.name ?? '', locale) && <p className="mesa-micro">{getSubcategoryPurposeHint(selectedGroup?.subcategories.find(sub => sub.key === subcategoryInput)?.name ?? '', locale)}</p>}
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
    sortedTransactions.length === 1 ? 'mesa.record' : 'mesa.records',
    { count: sortedTransactions.length }
  );
  let emptyMessage = t('mesa.empty');
  if (reviewSuggestionsOnly) {
    emptyMessage = reviewCopy.empty;
  } else if (searchQuery) {
    emptyMessage = t('mesa.empty');
  }

  const renderSuggestion = (transaction: Transaction, mobile = false) => {
    const suggestion = categorySuggestions.get(transaction.id);
    if (!suggestion) return isReviewExpense(transaction) ? (
      <p className={`mesa-micro mesa-review-guidance ${mobile ? 'mesa-review-guidance--mobile' : ''}`}>
        {transaction.category_source === 'manual' ? reviewCopy.manual : reviewCopy.unknown}
      </p>
    ) : null;

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
            <small className="mt-1 block break-words font-normal">{reviewCopy.mediumConfidence} · {getLocalizedSuggestionReason(suggestion, locale)}</small>
          </span>
        </span>
        <button
          type="button"
          onClick={() => applySuggestion(transaction)}
          disabled={savingId !== null || capability !== 'ready'}
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
      <div className="mesa-panel-title">
        <div><h2>{t('mesa.ledgerTitle')}</h2><p className="mesa-micro">{scopeLabel} · {resultCountLabel}</p></div>
        <div><strong>{money(sortedTransactions.reduce((sum, row) => sum + (movementTypes ? signedValue(row) : row.value), 0))}</strong><small>{t(movementTypes ? 'income.listNet' : 'mesa.listTotal')}</small></div>
      </div>
      {movementTypes && <div className="mesa-list-flows mesa-micro"><span>{t('income.incomeTotal')}: {money(sortedTransactions.filter(row => row.record_type === 'income').reduce((sum, row) => sum + row.value, 0))}</span><span>{t('income.outflowTotal')}: {money(sortedTransactions.filter(isExpense).reduce((sum, row) => sum + row.value, 0))}</span><span>{t('income.transferNote')}</span></div>}
      {capability !== 'ready' && <div className="mesa-micro mb-3" role="status">
        <span>{capability === 'checking' ? reviewCopy.checking : reviewCopy.unavailable}</span>
        {capability === 'unavailable' && <button type="button" className="ml-2 min-h-11 underline" onClick={() => setCapabilityAttempt(value => value + 1)}>{reviewCopy.retry}</button>}
      </div>}
      <form className="mesa-search" onSubmit={event => { event.preventDefault(); handleSearchChange(queryDraft ?? searchQuery); }}>
        <label className="mesa-search-input"><Search aria-hidden="true" /><input type="search" aria-label={t('mesa.searchHint')} placeholder={t('mesa.searchPlaceholder')} value={queryDraft ?? searchQuery} onChange={event => setQueryDraft(event.target.value)} /></label>
        <button type="submit">{t('mesa.search')}</button>
        {(searchQuery || queryDraft) && <button type="button" onClick={() => handleSearchChange('')}>{t('mesa.clear')}</button>}
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        <p className="mesa-micro" role="status" aria-live="polite">{resultCountLabel}</p>
        {(reviewRows.length > 0 || reviewSuggestionsOnly) && (
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
            {reviewCopy.queue.replace('{count}', String(reviewRows.length))}
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
          <div className="mesa-ledger-table hidden overflow-hidden rounded-2xl border border-border-subtle bg-surface lg:block">
              <table className="w-full table-fixed divide-y divide-border-subtle">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[30%]" />
                  <col className="w-[30%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
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
                          <span className="block break-words" title={transactionLabel(transaction)}>
                            {transactionLabel(transaction)}
                          </span>{movementTypes && <small className="mesa-micro">{movementLabel(transaction)}{transaction.record_type !== 'income' && transaction.owner ? ` · ${transaction.owner}` : ''}</small>}
                        </td>
                        <td className="min-w-0 px-4 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {badges(transaction)}
                          </span>
                          {renderSuggestion(transaction)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums">
                          {displayAmount(transaction)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {isExpense(transaction) ? <span className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleEditing(transaction)}
                              aria-label={t('mesa.edit', { place: transaction.place })}
                              aria-expanded={editingId === transaction.id}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(transaction)}
                              disabled={deletingId === transaction.id || savingId !== null}
                              aria-label={t('mesa.delete', { place: transaction.place })}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </span> : <small className="mesa-micro block whitespace-normal break-words">{t('income.readOnly')}</small>}
                        </td>
                      </tr>
                      {editingId === transaction.id && (
                        <tr>
                          <td colSpan={5} className="bg-surface-2 px-4 py-4">
                            {renderEditor(transaction, 'desktop')}
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
                  disabled={!isExpense(transaction)}
                  aria-expanded={editingId === transaction.id}
                  className="flex min-h-11 w-full flex-col gap-2 p-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-semibold">{transactionLabel(transaction)}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {displayAmount(transaction)}
                    </span>
                  </span>
                  <span className="flex w-full flex-wrap items-center gap-1.5">
                    <span className="mr-auto text-xs text-muted">{formatDateShort(transaction.date_iso, locale)}</span>
                    {badges(transaction)}{movementTypes && transaction.record_type !== 'income' && transaction.owner && <small>{transaction.owner}</small>}
                    {isExpense(transaction) && <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                        editingId === transaction.id ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />}
                  </span>
                </button>
                {!isExpense(transaction) && <p className="mesa-micro px-3.5 pb-3">{t('income.readOnly')}</p>}
                {editingId !== transaction.id && renderSuggestion(transaction, true)}
                {editingId === transaction.id && (
                  <div className="border-t border-border-subtle p-4">{renderEditor(transaction, 'mobile')}</div>
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
                {t('mesa.showMore', { count: remainingCount })}
              </button>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
