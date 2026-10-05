'use client';

import { useScopedResource } from '@/hooks/useScopedResource';
import { DataFeedback, SectionSkeleton } from '@/components/LoadingState';

import SelectControl from '@/components/SelectControl';
import MonthEvidence from '@/components/MonthEvidence';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Wallet } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useTransactions } from '@/hooks/useTransactions';
import { useStatementFilters } from '@/hooks/useStatementFilters';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  computePeriodSummary
} from '@/services/period-summaries';
import { fetchRecurringProjection } from '@/services/recurring';
import { formatCurrency } from '@/utils/format';

function MonthView() {
  const { t, locale } = useLocale();
  const { transactions, loading, updating, error, refetch } = useTransactions();
  const { options, optionsMap, defaultKey } = useStatementFilters(transactions);
  const statementOptions = useMemo(
    () => options.filter((option) => option.type === 'statement'),
    [options]
  );

  const [selectedKey, setSelectedKey] = useState('');
  useEffect(() => {
    if (defaultKey && (!selectedKey || !optionsMap[selectedKey])) {
      const firstStatement = statementOptions[0]?.key || defaultKey;
      setSelectedKey(firstStatement);
    }
  }, [defaultKey, optionsMap, selectedKey, statementOptions]);

  const current = selectedKey ? optionsMap[selectedKey] : undefined;

  const start = current?.startDate ?? '';
  const end = current?.endDate ?? '';
  const fetchSummary = useCallback(async (signal: AbortSignal) => {
    if (!start || !end) return null;
    return computePeriodSummary({ statement_id: end, start, end }, signal);
  }, [start, end]);
  const fetchProjection = useCallback(async (signal: AbortSignal) => {
    if (!start || !end) return null;
    return fetchRecurringProjection(start, end, signal);
  }, [start, end]);
  const summaryResource = useScopedResource(`summary:${start}:${end}`, fetchSummary);
  const projectionResource = useScopedResource(`projection:${start}:${end}`, fetchProjection);
  const summary = summaryResource.data;
  const projection = projectionResource.data;
  const busy = summaryResource.loading || summaryResource.updating;
  const projectionError = projectionResource.error;
  const handleRecompute = async () => { await summaryResource.refetch(); await refetch(); };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-6">
        <div className="mx-auto max-w-7xl space-y-5 pb-safe sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{t('month.title')}</h1>
              <p className="text-sm text-muted">{t('month.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={handleRecompute}
              disabled={busy || !current}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? t('month.recomputing') : t('month.recompute')}
            </button>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted">{t('month.pickPeriod')}</span>
            <SelectControl
              wrapperClassName="statement-period-control"
              disabled={loading || !statementOptions.length}
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm sm:max-w-md"
            >
              {statementOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </SelectControl>
          </label>

          <DataFeedback loading={loading} updating={updating} error={error} retry={refetch} />
          <DataFeedback loading={summaryResource.loading} updating={summaryResource.updating} error={summaryResource.error} retry={summaryResource.refetch} />

          {loading || summaryResource.loading ? <SectionSkeleton label={t('month.title')} /> : !summary ? (
            <p className="text-muted">{t('month.empty')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    label: t('month.actual'),
                    value: summary.fixed_total + summary.variable_total,
                    help: t('month.actualHelp')
                  },
                  {
                    label: t('month.fixed'),
                    value: summary.fixed_total,
                    help: t('month.fixedHelp')
                  },
                  {
                    label: t('month.variable'),
                    value: summary.variable_total,
                    help: t('month.variableHelp')
                  }
                ].map((card, index) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-muted">
                      <Wallet className="h-4 w-4" />
                      <span className="text-sm">{card.label}</span>
                    </div>
                    <p className="mt-2 text-3xl font-bold tabular-nums">
                      {formatCurrency(card.value, locale)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted">{card.help}</p>
                  </motion.div>
                ))}
              </div>

              <section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
                <h2 className="text-lg font-semibold">{t('month.projectionTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('month.projectionHelp')}</p>
                {projectionError && (
                  <DataFeedback error={projectionError} retry={projectionResource.refetch} />
                )}
                {projectionResource.loading ? <SectionSkeleton label={t('month.projectionTitle')} /> : <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface p-4">
                    <dt className="text-sm text-muted">{t('month.projectedExpenses')}</dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums">
                      {projection ? formatCurrency(projection.expense_total, locale) : '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-surface p-4">
                    <dt className="text-sm text-muted">{t('month.projectedIncome')}</dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {projection ? formatCurrency(projection.income_total, locale) : '—'}
                    </dd>
                  </div>
                </dl>}
              </section>

              <MonthEvidence transactions={transactions} start={current?.startDate ?? ''} end={current?.endDate ?? ''} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MonthPage() {
  return (
    <AuthGuard>
      <MonthView />
    </AuthGuard>
  );
}
