'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Transaction } from '@/types/transaction';

interface TransactionsTableProps {
  transactions: Transaction[];
  selectedCategory?: string | null;
}

type SortField = 'date' | 'place' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function TransactionsTable({
  transactions,
  selectedCategory
}: TransactionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'amount' ? 'desc' : 'asc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-lg shadow-lg overflow-hidden"
    >
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">
          {selectedCategory ? `${selectedCategory} Transactions` : 'All Transactions'}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? 's' : ''}
          <span className="ml-2 text-blue-600 font-medium">
            Total: {sortedTransactions.reduce((sum, t) => sum + t.value, 0).toLocaleString('en-NZ', {
              style: 'currency',
              currency: 'NZD'
            })}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <motion.table
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full"
        >
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-gray-500">
                <SortButton field="date">Date</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-gray-500">
                <SortButton field="place">Place</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-gray-500">
                <SortButton field="category">Category</SortButton>
              </th>
              <th className="px-6 py-3 text-right text-gray-500">
                <div className="flex justify-end">
                  <SortButton field="amount">Amount</SortButton>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((transaction) => (
              <motion.tr
                key={transaction.id}
                variants={rowVariants}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(transaction.date_iso).toLocaleDateString('en-NZ', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {transaction.place}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedCategory === transaction.category
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {transaction.category || 'Other'}
                    </span>
                    {transaction.subcategory && (
                      <span className="mt-1 text-xs text-gray-500">
                        {transaction.subcategory}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <span className={`font-semibold ${
                    transaction.value <= 50
                      ? 'text-green-600'
                      : transaction.value <= 100
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}>
                    {transaction.value.toLocaleString('en-NZ', {
                      style: 'currency',
                      currency: 'NZD'
                    })}
                  </span>
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
            <p className="text-gray-500">No transactions found</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
