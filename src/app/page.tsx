'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, TrendingDown, Calendar, DollarSign, LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import PieChartComponent from '@/components/PieChart';
import MonthlyEvolutionChart from '@/components/MonthlyEvolutionChart';
import TransactionsTable from '@/components/TransactionsTable';
import PeriodFilter, { FilterPeriod } from '@/components/PeriodFilter';
import AuthGuard from '@/components/AuthGuard';
import { useTransactions, useChartData, useFilteredTransactions } from '@/hooks/useTransactions';
import { getPeriodDates } from '@/utils/dateHelpers';

const COLORS = [
  '#8B5CF6', // Purple for largest segment
  '#EC4899', // Pink for second segment
  '#6B7280', // Gray for smallest segment
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple variant
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
];

function Dashboard() {
  const { data: session } = useSession();
  const { transactions, loading, error } = useTransactions();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('lastMonth');

  // Calculate dates based on selected period
  const { startDate, endDate } = getPeriodDates(selectedPeriod);

  const filteredTransactions = useFilteredTransactions(
    transactions,
    startDate,
    endDate,
    null // Don't filter by category for chart data
  );

  const displayTransactions = useFilteredTransactions(
    transactions,
    startDate,
    endDate,
    selectedCategory // Filter by category for table display
  );

  const chartData = useChartData(filteredTransactions);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  const handleReset = () => {
    setSelectedCategory(null);
  };

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    setSelectedCategory(null);
  };

  const totalTransactions = filteredTransactions.length;
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.value, 0);
  const selectedCategoryData = selectedCategory
    ? chartData.find(d => d.name === selectedCategory)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading transactions...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white p-8 rounded-lg shadow-lg"
        >
          <p className="text-red-600 text-lg mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-between items-center mb-8"
        >
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Transactions Dashboard
            </h1>
            <p className="text-gray-600">
              Interactive visualization of your spending patterns
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {session?.user?.name}
            </span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </motion.header>

        <PeriodFilter
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalAmount.toLocaleString('en-NZ', {
                    style: 'currency',
                    currency: 'NZD'
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{chartData.length}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-lg shadow-lg p-6 h-[500px] flex flex-col"
          >
            {selectedCategory ? (
              // Selected category view
              <>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  {selectedCategory}
                  <button
                    onClick={handleReset}
                    className="ml-auto flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </h3>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedCategoryData?.value.toLocaleString('en-NZ', {
                      style: 'currency',
                      currency: 'NZD'
                    })}
                  </p>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</h4>
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {displayTransactions
                      .slice(0, 5)
                      .map((transaction, index) => (
                        <div key={transaction.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{transaction.place}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(transaction.date_iso).toLocaleDateString('en-NZ', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <span className={`text-sm font-semibold ${
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
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              // Global categories overview
              <>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  All Categories
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click on any category to see details
                </p>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {chartData
                    .sort((a, b) => b.value - a.value) // Sort by value descending
                    .map((category, index) => (
                      <div
                        key={category.name}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleCategorySelect(category.name)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{category.name}</p>
                            <p className="text-xs text-gray-600">{category.count} transactions</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {category.value.toLocaleString('en-NZ', {
                              style: 'currency',
                              currency: 'NZD'
                            })}
                          </p>
                          <p className="text-xs text-gray-600">{category.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-lg shadow-lg p-4 h-[500px] relative lg:col-span-3"
          >
            <div className="h-full">
              <PieChartComponent
                data={chartData}
                onSegmentClick={handleCategorySelect}
                selectedCategory={selectedCategory}
              />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-8"
        >
          <MonthlyEvolutionChart
            transactions={transactions}
            selectedCategory={selectedCategory}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <TransactionsTable
            transactions={displayTransactions}
            selectedCategory={selectedCategory}
          />
        </motion.div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
