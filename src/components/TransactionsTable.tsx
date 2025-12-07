'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { lightenColor, generateColorVariants } from '@/utils/color';
import { CATEGORY_COLORS, getCategoryBadgeStyles, getCategoryHexColor } from '@/constants/categories';

interface TransactionsTableProps {
  transactions: Transaction[];
  selectedCategory?: string | null;
  categoryColors?: Record<string, string>;
  onUpdated?: () => void;
}

type SortField = 'date' | 'place' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function TransactionsTable({
  transactions,
  selectedCategory,
  categoryColors,
  onUpdated
}: TransactionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [subcategoryInput, setSubcategoryInput] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'amount' ? 'desc' : 'asc');
    }
  };

  // Filter transactions by search query
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

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'date':
        aValue = new Date(a.date_iso).getTime();
        bValue = new Date(b.date_iso).getTime();
        break;
      case 'place':
        aValue = a.place.toLowerCase();
        bValue = b.place.toLowerCase();
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      case 'amount':
        aValue = a.value;
        bValue = b.value;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Generate subcategory color mapping
  const subcategoryColorMap = useMemo(() => {
    const colorMap: Record<string, string> = {};

    // Group transactions by category and subcategory
    const categorySubcategories: Record<string, Array<{ name: string; value: number }>> = {};

    transactions.forEach((transaction) => {
      const category = transaction.category;
      const subcategory = transaction.subcategory;

      if (!category || !subcategory) return;

      if (!categorySubcategories[category]) {
        categorySubcategories[category] = [];
      }

      const existing = categorySubcategories[category].find(s => s.name === subcategory);
      if (existing) {
        existing.value += transaction.value;
      } else {
        categorySubcategories[category].push({ name: subcategory, value: transaction.value });
      }
    });

    // Generate color variants for each category's subcategories
    Object.entries(categorySubcategories).forEach(([category, subcategories]) => {
      const baseColor = categoryColors?.[category] || getCategoryHexColor(category);

      // Sort subcategories by value (highest first)
      const sortedSubcategories = [...subcategories].sort((a, b) => b.value - a.value);

      // Generate color variants
      const colorVariants = generateColorVariants(baseColor, sortedSubcategories.length, true);

      // Map subcategory names to colors
      sortedSubcategories.forEach((subcategory, index) => {
        colorMap[`${category}:${subcategory.name}`] = colorVariants[index];
      });
    });

    return colorMap;
  }, [transactions, categoryColors]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors duration-150 font-medium text-xs uppercase tracking-wider"
    >
      {children}
      <div className="flex flex-col">
        <ChevronUp
          className={`h-3 w-3 ${sortField === field && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
        />
        <ChevronDown
          className={`h-3 w-3 -mt-1 ${sortField === field && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
        />
      </div>
    </button>
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(Object.keys(CATEGORY_COLORS));
    transactions.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const subcategoryOptionsByCategory = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    transactions.forEach((t) => {
      if (t.category && t.subcategory) {
        if (!map[t.category]) map[t.category] = new Set<string>();
        map[t.category].add(t.subcategory);
      }
    });
    return map;
  }, [transactions]);

  const startEditing = (tx: Transaction) => {
    setEditingId(tx.id);
    setCategoryInput(tx.category || '');
    setSubcategoryInput(tx.subcategory || '');
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setCategoryInput('');
    setSubcategoryInput('');
    setError(null);
  };

  const handleSave = async (tx: Transaction) => {
    if (!categoryInput.trim() && !subcategoryInput.trim()) {
      setError('Please set category or subcategory.');
      return;
    }
    try {
      setSavingId(tx.id);
      setError(null);
      const response = await fetch(`/api/transactions/${tx.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...tx,
          category: categoryInput.trim() || tx.category,
          subcategory: subcategoryInput.trim() || tx.subcategory
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update transaction');
      }

      if (onUpdated) {
        onUpdated();
      }
      cancelEditing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSavingId(null);
    }
  };

  const renderCategoryBadge = (category: string) => {
    const colors = getCategoryBadgeStyles(category);
    return (
      <span
        className={`inline-flex items-center rounded-lg ${colors.bg} px-2 py-1 text-sm font-medium ${colors.text}`}
        style={colors.style}
      >
        {category}
      </span>
    );
  };

  const getSubcategoryColor = (category: string, subcategory: string): string => {
    const key = `${category}:${subcategory}`;
    return subcategoryColorMap[key] || categoryColors?.[category] || getCategoryHexColor(category);
  };

  const renderSubcategory = (category: string, subcategory: string | undefined) => {
    if (!subcategory) {
      return <span className="text-gray-500 dark:text-gray-400">-</span>;
    }

    const color = getSubcategoryColor(category, subcategory);
    const bgColor = lightenColor(color, 0.85);

    return (
      <span
        className="inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium"
        style={{
          backgroundColor: bgColor,
          color: color
        }}
      >
        {subcategory}
      </span>
    );
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">All Transactions</h2>
      <div className="mb-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            className="block w-full rounded border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-background-dark py-2 pl-10 pr-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            placeholder="Search transactions"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800"
      >

        <motion.table
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="min-w-full divide-y divide-gray-200 dark:divide-gray-800"
        >
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                <SortButton field="date">Date</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                <SortButton field="place">Description</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                <SortButton field="category">Category</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                Subcategory
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                <SortButton field="amount">Amount</SortButton>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-background-light dark:bg-background-dark">
            {sortedTransactions.map((transaction) => (
              <motion.tr
                key={transaction.id}
                variants={rowVariants}
              >
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(transaction.date_iso).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {transaction.place}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {editingId === transaction.id ? (
                    <select
                      className="w-40 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-white"
                      value={categoryInput}
                      onChange={(e) => {
                        setCategoryInput(e.target.value);
                        setSubcategoryInput('');
                      }}
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    renderCategoryBadge(transaction.category || 'Other')
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {editingId === transaction.id ? (
                    <input
                      className="w-48 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-900 dark:text-white"
                      value={subcategoryInput}
                      onChange={(e) => setSubcategoryInput(e.target.value)}
                      list={`subcategory-options-${transaction.id}`}
                      placeholder="Subcategory"
                    />
                  ) : (
                    renderSubcategory(transaction.category, transaction.subcategory)
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white text-right">
                  ${transaction.value.toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-right">
                  {editingId === transaction.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSave(transaction)}
                        disabled={savingId === transaction.id}
                        className="rounded-md bg-primary px-3 py-1 text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
                      >
                        {savingId === transaction.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(transaction)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </motion.table>

        {sortedTransactions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
          </motion.div>
        )}
      </motion.div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {sortedTransactions.map((transaction) => {
        const categoryKey = editingId === transaction.id && categoryInput ? categoryInput : transaction.category || '';
        const set = subcategoryOptionsByCategory[categoryKey];
        const options = set ? Array.from(set).sort((a, b) => a.localeCompare(b)) : [];
        const listId = `subcategory-options-${transaction.id}`;
        return (
          <datalist id={listId} key={listId}>
            {options.map((sub) => (
              <option key={sub} value={sub} />
            ))}
          </datalist>
        );
      })}
    </div>
  );
}
