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

export function useChartData(transactions: Transaction[]): ChartDataPoint[] {
  const categoryData = transactions.reduce((acc, transaction) => {
    const category = transaction.category;
    if (!acc[category]) {
      acc[category] = { value: 0, count: 0 };
    }
    acc[category].value += transaction.value;
    acc[category].count += 1;
    return acc;
  }, {} as Record<string, { value: number; count: number }>);

  const totalValue = Object.values(categoryData).reduce((sum, cat) => sum + cat.value, 0);

  return Object.entries(categoryData).map(([category, data]) => ({
    name: category,
    value: data.value,
    count: data.count,
    percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0
  })).sort((a, b) => b.value - a.value);
}