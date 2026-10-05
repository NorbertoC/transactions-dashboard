"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";
import MesaDashboard from '@/components/MesaDashboard';
import FileUploader from '@/components/upload/FileUploader';
import { useTransactions } from '@/hooks/useTransactions';
import { useLocale } from "@/i18n/LocaleProvider";

function Dashboard() {
  const { t } = useLocale();
  const {
    transactions,
    loading,
    error,
    incomeAvailable,
    refetch,
    updateTransaction,
    removeTransaction,
  } = useTransactions('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

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
      <main className="mesa-main flex-1">
        <MesaDashboard transactions={transactions} incomeAvailable={incomeAvailable} onTransactionUpdated={updateTransaction} onTransactionDeleted={removeTransaction} />
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
