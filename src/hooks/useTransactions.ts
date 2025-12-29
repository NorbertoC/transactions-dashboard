'use client';

import { useState, useEffect } from 'react';
import { Transaction, ChartDataPoint } from '@/types/transaction';
import { ApiService } from '@/services/api';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (isInitialLoad = false) => {
    try {
      // Only show full-page spinner on initial load
      if (isInitialLoad) {
        setLoading(true);
      }
      const data = await ApiService.fetchTransactionsClient();
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const updateTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev =>
      prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t)
    );
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  return { transactions, loading, error, refetch: fetchData, updateTransaction };
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
