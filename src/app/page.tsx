"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { DataFeedback } from '@/components/LoadingState';
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
    updating,
    slow,
    error,
    incomeAvailable,
    refetch,
    updateTransaction,
    removeTransaction,
  } = useTransactions('all');
  const [showUploadModal, setShowUploadModal] = useState(false);


  return (
    <div className="flex min-h-screen flex-col">
      <Header onUploadClick={() => setShowUploadModal(true)} />
      <main className="mesa-main flex-1">
        <DataFeedback slow={slow} loading={loading} updating={updating} error={error} retry={refetch} />
        <MesaDashboard loading={loading} unavailable={error !== null && !transactions.length} transactions={transactions} incomeAvailable={incomeAvailable} onTransactionUpdated={updateTransaction} onTransactionDeleted={removeTransaction} />
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
