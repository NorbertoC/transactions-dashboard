"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";
import PeriodFilter, { FilterPeriod } from "@/components/PeriodFilter";
import TransactionsTable from "@/components/TransactionsTable";
import FileUploader from "@/components/upload/FileUploader";
import KpiCards from "@/components/charts/KpiCards";
import CategoryDonut from "@/components/charts/CategoryDonut";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import TopMerchants from "@/components/charts/TopMerchants";
import {
  useTransactions,
  useChartData,
  useFilteredTransactions,
} from "@/hooks/useTransactions";
import { useStatementFilters } from "@/hooks/useStatementFilters";
import { generateColorVariants } from "@/utils/color";
import { getCategoryHexColor } from "@/constants/categories";
import { useLocale } from "@/i18n/LocaleProvider";

const DAY_MS = 86_400_000;

function getLocalTodayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function addUtcDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function Dashboard() {
  const { t } = useLocale();
  const {
    transactions,
    loading,
    error,
    refetch,
    updateTransaction,
    removeTransaction,
  } = useTransactions();
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

  const currentPeriod = selectedPeriod ? optionsMap[selectedPeriod] : undefined;
  const startDate = currentPeriod?.startDate ?? null;
  const endDate = currentPeriod?.endDate ?? null;

  const filteredTransactions = useFilteredTransactions(
    transactions,
    startDate,
    endDate,
    null // charts aggregate the whole period; category drill-down happens below
  );

  const displayTransactions = useFilteredTransactions(
    transactions,
    startDate,
    endDate,
    selectedCategory
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

  const pieChartData = useMemo(() => {
    if (selectedCategory) {
      const subcategories = [...(subcategoryData[selectedCategory] ?? [])].sort(
        (a, b) => b.value - a.value
      );
      const variants = generateColorVariants(
        getCategoryHexColor(selectedCategory),
        subcategories.length,
        true
      );
      return subcategories.map((subcategory, index) => ({
        ...subcategory,
        color: variants[index],
      }));
    }

    return categoryData.map((category) => ({
      ...category,
      color: getCategoryHexColor(category.name),
    }));
  }, [selectedCategory, subcategoryData, categoryData]);

  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + t.value, 0),
    [filteredTransactions]
  );

  const donutTotal = useMemo(
    () => pieChartData.reduce((sum, item) => sum + item.value, 0),
    [pieChartData]
  );

  const previousComparison = useMemo(() => {
    if (currentPeriod?.type !== "statement") {
      return { total: null, usesElapsedDays: false };
    }
    const statements = periodOptions.filter(
      (option) => option.type === "statement"
    );
    const index = statements.findIndex(
      (option) => option.key === currentPeriod.key
    );
    const previous = index >= 0 ? statements[index + 1] : undefined;
    const previousStart = previous?.startDate;
    const previousEnd = previous?.endDate;
    if (!previousStart || !previousEnd) {
      return { total: null, usesElapsedDays: false };
    }

    const todayIso = getLocalTodayIso();
    const usesElapsedDays = Boolean(
      currentPeriod.startDate && currentPeriod.endDate && currentPeriod.endDate > todayIso
    );
    const currentEffectiveEnd = currentPeriod.endDate && currentPeriod.endDate < todayIso
      ? currentPeriod.endDate
      : todayIso;
    const elapsedDays = currentPeriod.startDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${currentEffectiveEnd}T00:00:00Z`).getTime() -
              new Date(`${currentPeriod.startDate}T00:00:00Z`).getTime()) /
              DAY_MS
          ) + 1
        )
      : 1;
    const comparisonEnd = usesElapsedDays
      ? [previousEnd, addUtcDays(previousStart, elapsedDays - 1)].sort()[0]
      : previousEnd;
    const total = transactions
      .filter(
        (t) =>
          t.date_iso && t.date_iso >= previousStart && t.date_iso <= comparisonEnd
      )
      .reduce((sum, t) => sum + t.value, 0);

    return { total, usesElapsedDays };
  }, [currentPeriod, periodOptions, transactions]);

  const dailyAverage = useMemo(() => {
    if (!startDate || !endDate || totalAmount === 0) {
      return 0;
    }
    // Ongoing statements are averaged over elapsed days, not the full cycle.
    // Local date, not UTC: NZ is ahead of UTC for most of the day.
    const todayIso = getLocalTodayIso();
    const effectiveEnd = endDate < todayIso ? endDate : todayIso;
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${effectiveEnd}T00:00:00Z`).getTime();
    const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
    return totalAmount / days;
  }, [startDate, endDate, totalAmount]);

  const currentPeriodKey =
    currentPeriod?.type === "statement" ? currentPeriod.endDate : null;

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const handleReset = () => {
    setSelectedCategory(null);
  };

  const handlePeriodChange = (period: FilterPeriod) => {
    setSelectedPeriod(period);
    setSelectedCategory(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-muted">{t('overview.loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-sm">
          <p className="mb-4 text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => refetch()}
            className="min-h-11 rounded-xl bg-primary px-4 font-medium text-white hover:bg-primary/90"
          >
            {t('overview.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header onUploadClick={() => setShowUploadModal(true)} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl space-y-5 pb-safe sm:space-y-6">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t("overview.title")}</h1>
            <p className="text-sm text-muted">
              {t("overview.subtitle")}
            </p>
          </div>

          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            options={periodOptions}
          />

          <KpiCards
            totalAmount={totalAmount}
            previousTotal={previousComparison.total}
            previousUsesElapsedDays={previousComparison.usesElapsedDays}
            transactionCount={filteredTransactions.length}
            dailyAverage={dailyAverage}
            periodLabel={currentPeriod?.label ?? ""}
          />

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
            >
              <CategoryDonut
                data={pieChartData}
                total={donutTotal}
                selectedCategory={selectedCategory}
                onSelect={selectedCategory ? undefined : handleCategorySelect}
                onReset={handleReset}
              />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
            >
              <MonthlyTrendChart
                transactions={transactions}
                selectedCategory={selectedCategory}
                categoryColors={categoryColors}
                currentPeriodKey={currentPeriodKey}
              />
            </motion.section>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm lg:col-span-1"
            >
              <TopMerchants transactions={displayTransactions} />
            </motion.section>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <TransactionsTable
                transactions={displayTransactions}
                categoryColors={categoryColors}
                onTransactionUpdated={updateTransaction}
                onTransactionDeleted={removeTransaction}
              />
            </motion.div>
          </div>
        </div>
      </main>

      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowUploadModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("overview.addTransactions")}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-surface sm:max-w-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
              <h2 className="text-lg font-semibold">{t("overview.addTransactions")}</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                aria-label={t("overview.close")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]">
              <FileUploader onUploadComplete={refetch} />
            </div>
          </motion.div>
        </div>
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
