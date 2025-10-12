"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  TrendingDown,
  Calendar,
  DollarSign,
  LogOut,
  Upload,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Header from "@/components/Header";
import PieChartComponent from "@/components/PieChart";
import MonthlyEvolutionChart from "@/components/MonthlyEvolutionChart";
import TransactionsTable from "@/components/TransactionsTable";
import PeriodFilter, { FilterPeriod } from "@/components/PeriodFilter";
import AuthGuard from "@/components/AuthGuard";
import PdfUploader from "@/components/PdfUploader";
import {
  useTransactions,
  useChartData,
  useFilteredTransactions,
} from "@/hooks/useTransactions";
import { useStatementFilters } from "@/hooks/useStatementFilters";
import { lightenColor, generateColorVariants } from "@/utils/color";
import { getCategoryHexColor, getCategoryBadgeStyles } from "@/constants/categories";

function Dashboard() {
  const { data: session } = useSession();
  const { transactions, loading, error, refetch } = useTransactions();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const {
    options: periodOptions,
    optionsMap,
    defaultKey,
  } = useStatementFilters(transactions);

  useEffect(() => {
    if (defaultKey && (!selectedPeriod || !optionsMap[selectedPeriod])) {
      setSelectedPeriod(defaultKey);
    }
  }, [defaultKey, optionsMap, selectedPeriod]);

  const currentPeriod = useMemo(() => {
    return selectedPeriod ? optionsMap[selectedPeriod] : undefined;
  }, [optionsMap, selectedPeriod]);

  const startDate = currentPeriod?.startDate ?? null;
  const endDate = currentPeriod?.endDate ?? null;

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

  const { categories: categoryData, subcategories: subcategoryData } =
    useChartData(filteredTransactions);

  const categoryColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    categoryData.forEach((category) => {
      colorMap[category.name] = getCategoryHexColor(category.name);
    });
    return colorMap;
  }, [categoryData]);

  // Generate subcategory info for each category
  const categorySubcategoriesInfo = useMemo(() => {
    const info: Record<string, Array<{ name: string; color: string; initials: string }>> = {};

    Object.entries(subcategoryData).forEach(([category, subcategories]) => {
      const baseColor = categoryColors[category] || getCategoryHexColor(category);

      // Sort subcategories by value (highest first)
      const sortedSubcategories = [...subcategories].sort((a, b) => b.value - a.value);

      // Generate color variants
      const colorVariants = generateColorVariants(baseColor, sortedSubcategories.length, true);

      info[category] = sortedSubcategories.map((sub, index) => ({
        name: sub.name,
        color: colorVariants[index],
        initials: sub.name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 3) // Max 3 characters
      }));
    });

    return info;
  }, [subcategoryData, categoryColors]);

  const pieChartData = useMemo(() => {
    if (selectedCategory) {
      const subcategoryInfo = categorySubcategoriesInfo[selectedCategory] || [];
      const subcategories = subcategoryData[selectedCategory] || [];

      // Sort subcategories by value (highest first) to match the color assignment
      const sortedSubcategories = [...subcategories].sort(
        (a, b) => b.value - a.value
      );

      return sortedSubcategories.map((subcategory, index) => ({
        ...subcategory,
        color: subcategoryInfo[index]?.color || getCategoryHexColor(selectedCategory),
      }));
    }

    return categoryData.map((category) => ({
      ...category,
      color: categoryColors[category.name] || getCategoryHexColor(category.name),
    }));
  }, [selectedCategory, subcategoryData, categoryData, categoryColors, categorySubcategoriesInfo]);

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


  const handleTransactionsExtracted = async (
    extractedTransactions: unknown[]
  ) => {
    console.log("Extracted transactions:", extractedTransactions);
    setShowUploadModal(false);
    // Refresh transactions data without page reload
    await refetch();
  };

  const totalTransactions = filteredTransactions.length;
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.value, 0);
  const selectedCategoryData = selectedCategory
    ? categoryData.find((d) => d.name === selectedCategory)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading transactions...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"
        >
          <p className="text-red-600 dark:text-red-400 text-lg mb-4">Error: {error}</p>
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Overview</h1>
            <p className="text-gray-500 dark:text-gray-400">Track your spending and manage your finances effectively.</p>
          </div>

          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            options={periodOptions}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-background-light dark:bg-background-dark p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Spending by Category</h3>
                  {selectedCategory && (
                    <span
                      className={`inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium ${
                        getCategoryBadgeStyles(selectedCategory).bg
                      } ${getCategoryBadgeStyles(selectedCategory).text}`}
                    >
                      {selectedCategory}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  disabled={!selectedCategory}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                    selectedCategory
                      ? 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer'
                      : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalAmount.toFixed(0)}</p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Last Month</span>
                <span className="font-medium text-green-500">+12%</span>
              </div>
              <div className="mt-6 h-60 w-full">
                <PieChartComponent
                  data={pieChartData}
                  onSegmentClick={
                    selectedCategory ? undefined : handleCategorySelect
                  }
                  selectedCategory={selectedCategory}
                  colorMap={categoryColors}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                {pieChartData.map((item, index) => {
                  const subcategories = categorySubcategoriesInfo[item.name] || [];
                  const showSubcategories = !selectedCategory && subcategories.length > 0;

                  return (
                    <div
                      key={item.name}
                      className={`flex items-center gap-2 ${
                        !selectedCategory ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      onClick={() => !selectedCategory && handleCategorySelect(item.name)}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {item.name}
                        </p>
                        {showSubcategories && (
                          <div className="flex items-center gap-1">
                            {subcategories.map((sub) => (
                              <span
                                key={sub.name}
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: lightenColor(sub.color, 0.85),
                                  color: sub.color
                                }}
                                title={sub.name}
                              >
                                {sub.initials}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-background-light dark:bg-background-dark p-6 shadow-sm"
            >
              <MonthlyEvolutionChart
                transactions={filteredTransactions}
                selectedCategory={selectedCategory}
                categoryColors={categoryColors}
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <TransactionsTable
              transactions={displayTransactions}
              selectedCategory={selectedCategory}
              categoryColors={categoryColors}
            />
          </motion.div>
        </div>
      </main>

      {/* Upload PDF Modal */}
      {showUploadModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowUploadModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                Upload Statement
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <PdfUploader
                onTransactionsExtracted={handleTransactionsExtracted}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
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
