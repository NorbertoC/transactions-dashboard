'use client';

import { useCallback } from 'react';
import { Transaction, ChartDataPoint } from '@/types/transaction';
import { ApiService, IncomeCapabilityUnavailable, type RecordScope } from '@/services/api';

import { useScopedResource } from '@/hooks/useScopedResource';

export function useTransactions(scope: RecordScope = 'expense') {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    try {
      const transactions = await ApiService.fetchTransactionsClient(scope, signal);
      return { transactions, incomeAvailable: scope === 'all' };
    } catch (error) {
      if (scope !== 'all' || !(error instanceof IncomeCapabilityUnavailable)) throw error;
      const transactions = await ApiService.fetchTransactionsClient('expense', signal);
      return { transactions, incomeAvailable: false };
    }
  }, [scope]);
  const resource = useScopedResource(scope, fetcher);
  const updateTransaction = (transaction: Transaction) => resource.setData(previous => ({ ...previous, transactions: previous.transactions.map(row => row.id === transaction.id ? transaction : row) }));
  const removeTransaction = (id: number) => resource.setData(previous => ({ ...previous, transactions: previous.transactions.filter(row => row.id !== id) }));
  return { transactions: resource.data?.transactions ?? [], incomeAvailable: resource.data?.incomeAvailable ?? false,
    loading: resource.loading, slow: resource.slow, updating: resource.updating, error: resource.error, refetch: resource.refetch, updateTransaction, removeTransaction };
}

export function useFilteredTransactions(
  transactions: Transaction[],
  startDate: string | null,
  endDate: string | null,
  selectedCategory: string | null
): Transaction[] {
  return transactions.filter(transaction => {
    if (!transaction.date_iso) {
      return false;
    }

    // Filter by date range
    if (startDate && transaction.date_iso < startDate) {
      return false;
    }
    if (endDate && transaction.date_iso > endDate) {
      return false;
    }

    // Filter by category
    if (selectedCategory && transaction.category !== selectedCategory) {
      return false;
    }

    return true;
  });
}

export interface ChartHierarchy {
  categories: ChartDataPoint[];
  subcategories: Record<string, ChartDataPoint[]>;
  totalValue: number;
}

const DEFAULT_CATEGORY = 'Other';
const DEFAULT_SUBCATEGORY = 'General';

export function useChartData(transactions: Transaction[]): ChartHierarchy {
  const categoryTotals: Record<string, { value: number; count: number }> = {};
  const subcategoryTotals: Record<string, Record<string, { value: number; count: number }>> = {};

  for (const transaction of transactions) {
    if (!transaction) {
      continue;
    }

    const category = transaction.category || DEFAULT_CATEGORY;
    const subcategory = transaction.subcategory || DEFAULT_SUBCATEGORY;

    if (!categoryTotals[category]) {
      categoryTotals[category] = { value: 0, count: 0 };
    }
    categoryTotals[category].value += transaction.value;
    categoryTotals[category].count += 1;

    if (!subcategoryTotals[category]) {
      subcategoryTotals[category] = {};
    }
    if (!subcategoryTotals[category][subcategory]) {
      subcategoryTotals[category][subcategory] = { value: 0, count: 0 };
    }
    subcategoryTotals[category][subcategory].value += transaction.value;
    subcategoryTotals[category][subcategory].count += 1;
  }

  const totalValue = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.value, 0);

  const categories = Object.entries(categoryTotals)
    .map(([category, data]) => ({
      name: category,
      value: data.value,
      count: data.count,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);

  const subcategories: Record<string, ChartDataPoint[]> = {};

  for (const [category, subMap] of Object.entries(subcategoryTotals)) {
    const parentTotal = categoryTotals[category]?.value || 0;
    const entries = Object.entries(subMap)
      .map(([subcategory, data]) => ({
        name: subcategory,
        value: data.value,
        count: data.count,
        percentage: parentTotal > 0 ? (data.value / parentTotal) * 100 : 0,
        parentCategory: category
      }))
      .sort((a, b) => b.value - a.value);

    subcategories[category] = entries;
  }

  return {
    categories,
    subcategories,
    totalValue
  };
}
