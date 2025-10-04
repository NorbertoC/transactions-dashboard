'use client';

import { useState, useEffect } from 'react';
import { Transaction, ChartDataPoint } from '@/types/transaction';
import { ApiService } from '@/services/api';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await ApiService.fetchTransactionsClient();
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { transactions, loading, error, refetch: fetchData };
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

function getCategoryColor(count: number): string {
  if (count >= 500) return '#b91c1c'; // red-700
  if (count >= 350) return '#ef4444'; // red-500
  if (count >= 250) return '#f97316'; // orange-500
  if (count >= 150) return '#f59e0b'; // amber-500
  if (count >= 75) return '#84cc16'; // lime-500
  return '#22c55e'; // green-500
}

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
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      color: getCategoryColor(data.count)
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
        parentCategory: category,
        color: getCategoryColor(data.count)
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
