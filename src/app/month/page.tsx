'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, RefreshCw, Wallet } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useTransactions } from '@/hooks/useTransactions';
import { useStatementFilters } from '@/hooks/useStatementFilters';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  computePeriodSummary,
  fetchPeriodSummary
} from '@/services/period-summaries';
import type { PeriodSummary } from '@/types/recurring';
import { buildClientPeriodSummary } from '@/utils/period-summary-fallback';
import { formatCurrency } from '@/utils/format';
import {
  getLocalizedCategoryName
} from '@/constants/categories';

function MonthView() {
  const { t, locale } = useLocale();
  const { transactions, loading, error, refetch } = useTransactions();
  const { options, optionsMap, defaultKey } = useStatementFilters(transactions);
  const statementOptions = useMemo(
    () => options.filter((option) => option.type === 'statement'),
    [options]
  );

  const [selectedKey, setSelectedKey] = useState('');
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [source, setSource] = useState<'api' | 'fallback' | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultKey && (!selectedKey || !optionsMap[selectedKey])) {
      const firstStatement = statementOptions[0]?.key || defaultKey;
      setSelectedKey(firstStatement);
    }
  }, [defaultKey, optionsMap, selectedKey, statementOptions]);

  const current = selectedKey ? optionsMap[selectedKey] : undefined;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!current?.endDate || !current.startDate) {
        setSummary(null);
        setSource(null);
        return;
      }

      setBusy(true);
      setStatusError(null);
      try {
        const fromApi = await fetchPeriodSummary(current.endDate);
        if (cancelled) return;
        if (fromApi) {
          setSummary(fromApi);
          setSource('api');
        } else {
          setSummary(
            buildClientPeriodSummary(
              transactions,
              current.endDate,
              current.startDate,
              current.endDate
            )
          );
          setSource('fallback');
        }
      } catch (err) {
        if (cancelled) return;
        setSummary(
          buildClientPeriodSummary(
            transactions,
            current.endDate,
            current.startDate,
            current.endDate
          )
        );
        setSource('fallback');
        setStatusError(err instanceof Error ? err.message : 'API unavailable');
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [current, transactions]);

  const handleRecompute = async () => {
    if (!current?.endDate || !current.startDate) return;
    setBusy(true);
    setStatusError(null);
    try {
      const computed = await computePeriodSummary({
        statement_id: current.endDate,
        start: current.startDate,
        end: current.endDate
      });
      setSummary(computed);
      setSource('api');
      await refetch();
    } catch (err) {
      setSummary(
        buildClientPeriodSummary(
          transactions,
          current.endDate,
          current.startDate,
          current.endDate
        )
      );
      setSource('fallback');
      setStatusError(err instanceof Error ? err.message : 'Recompute failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted">{t('overview.loading')}</p>
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
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
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

          <label className="block space-y-2">
            <span className="text-sm font-medium text-muted">{t('month.pickPeriod')}</span>
            <select
              value={selectedKey}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm sm:max-w-md"
            >
              {statementOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {statusError && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {statusError}
            </p>
          )}

          {source === 'fallback' && (
            <p className="text-sm text-muted">{t('month.fallbackNote')}</p>
          )}
          {source === 'api' && (
            <p className="text-sm text-muted">{t('month.apiNote')}</p>
          )}

          {!summary ? (
            <p className="text-muted">{t('month.empty')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: t('month.fixed'), value: summary.fixed_total },
                  { label: t('month.variable'), value: summary.variable_total },
                  { label: t('month.income'), value: summary.income_total }
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
                      {formatCurrency(card.value)}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold">{t('month.topSpends')}</h2>
                  {summary.top_expenses.length === 0 ? (
                    <p className="text-sm text-muted">{t('month.noTransactions')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.top_expenses.map((item, index) => (
                        <li
                          key={`${item.place}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.place}</p>
                            <p className="text-xs text-muted">
                              {item.category
                                ? getLocalizedCategoryName(item.category, locale)
                                : '—'}
                            </p>
                          </div>
                          <span className="shrink-0 tabular-nums font-semibold">
                            {formatCurrency(item.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    {t('month.insights')}
                  </h2>
                  <ul className="space-y-2">
                    {summary.insights.map((insight, index) => (
                      <li
                        key={`${index}-${insight.slice(0, 24)}`}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-sm"
                      >
                        {insight}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
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
