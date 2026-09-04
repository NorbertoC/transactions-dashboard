'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, ChartNoAxesCombined, Info, Repeat2 } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import { getCategoryHexColor, getLocalizedCategoryName } from '@/constants/categories';
import { useTransactions } from '@/hooks/useTransactions';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  fetchRecurringProjection,
  fetchRecurringRules
} from '@/services/recurring';
import type { RecurringProjection, RecurringRule } from '@/types/recurring';
import { formatCurrency, formatCurrencyWhole } from '@/utils/format';

const HISTORY_PERIODS = 3;
const EMPTY_PROJECTION: RecurringProjection = {
  start: '',
  end: '',
  income_total: 0,
  expense_total: 0,
  items: []
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function addUtcMonths(dateIso: string, months: number): string {
  const source = new Date(`${dateIso}T00:00:00Z`);
  const day = source.getUTCDate();
  const target = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1
  ));
  const lastDay = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0
  )).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

function upcomingStatementWindow() {
  const today = new Date();
  const localYear = today.getFullYear();
  const localMonth = today.getMonth();
  const localDay = today.getDate();
  const start = localDay <= 26
    ? new Date(Date.UTC(localYear, localMonth - 1, 27))
    : new Date(Date.UTC(localYear, localMonth, 27));
  const end = localDay <= 26
    ? new Date(Date.UTC(localYear, localMonth, 26))
    : new Date(Date.UTC(localYear, localMonth + 1, 26));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function ForecastView() {
  const { t, locale } = useLocale();
  const { transactions, loading, error, refetch } = useTransactions();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [nextProjection, setNextProjection] = useState(EMPTY_PROJECTION);
  const [yearProjection, setYearProjection] = useState(EMPTY_PROJECTION);
  const [projectionLoading, setProjectionLoading] = useState(true);
  const [projectionError, setProjectionError] = useState(false);
  const [rulesLoadFailed, setRulesLoadFailed] = useState(false);
  const [nextProjectionAvailable, setNextProjectionAvailable] = useState(false);
  const [yearProjectionAvailable, setYearProjectionAvailable] = useState(false);

  const forecastWindow = useMemo(upcomingStatementWindow, []);

  const yearEnd = useMemo(
    () => addUtcDays(addUtcMonths(forecastWindow.start, 12), -1),
    [forecastWindow.start]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      setProjectionLoading(true);
      setProjectionError(false);
      setRulesLoadFailed(false);
      try {
        const [rulesResult, nextResult, yearResult] = await Promise.allSettled([
          fetchRecurringRules(),
          fetchRecurringProjection(forecastWindow.start, forecastWindow.end),
          fetchRecurringProjection(forecastWindow.start, yearEnd)
        ]);
        if (cancelled) return;

        if (rulesResult.status === 'fulfilled') {
          setRules(rulesResult.value);
        } else {
          setRules([]);
          setRulesLoadFailed(true);
        }

        if (nextResult.status === 'fulfilled') {
          setNextProjection(nextResult.value);
          setNextProjectionAvailable(true);
        } else {
          setNextProjection({
            ...EMPTY_PROJECTION,
            start: forecastWindow.start,
            end: forecastWindow.end
          });
          setNextProjectionAvailable(false);
        }

        if (yearResult.status === 'fulfilled') {
          setYearProjection(yearResult.value);
          setYearProjectionAvailable(true);
        } else {
          setYearProjection({ ...EMPTY_PROJECTION, start: forecastWindow.start, end: yearEnd });
          setYearProjectionAvailable(false);
        }

        setProjectionError(
          nextResult.status === 'rejected' || yearResult.status === 'rejected'
        );
      } catch {
        if (cancelled) return;
        setProjectionError(true);
        setRulesLoadFailed(true);
        setNextProjectionAvailable(false);
        setYearProjectionAvailable(false);
        setRules([]);
        setNextProjection({ ...EMPTY_PROJECTION, start: forecastWindow.start, end: forecastWindow.end });
        setYearProjection({ ...EMPTY_PROJECTION, start: forecastWindow.start, end: yearEnd });
      } finally {
        if (!cancelled) setProjectionLoading(false);
      }
    }

    void loadProjection();
    return () => {
      cancelled = true;
    };
  }, [forecastWindow.end, forecastWindow.start, yearEnd]);

  const historical = useMemo(() => {
    const statementIds = Array.from(
      new Map(
        transactions
          .flatMap((transaction) => {
            const { statement_id: statementId, statement_end: statementEnd } = transaction;
            if (!statementId || !statementEnd || statementEnd >= forecastWindow.start) {
              return [];
            }
            return [[statementId, statementEnd] as const];
          })
      ).entries()
    )
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([statementId]) => statementId)
      .slice(0, HISTORY_PERIODS);

    const projectedExpenseRuleIds = new Set(
      [...nextProjection.items, ...yearProjection.items]
        .filter((item) => item.kind === 'expense')
        .map((item) => item.id)
    );
    const linkedMerchantPatterns = rules
      .filter((rule) => (
        rule.kind === 'expense' &&
        projectedExpenseRuleIds.has(rule.id) &&
        rule.merchant_pattern
      ))
      .map((rule) => rule.merchant_pattern?.trim().toLowerCase())
      .filter((pattern): pattern is string => Boolean(pattern));
    const totals = new Map(statementIds.map((id) => [id, 0]));
    const categoryTotals = new Map<string, number>();

    transactions.forEach((transaction) => {
      const statementId = transaction.statement_id;
      if (!statementId || !totals.has(statementId)) return;
      if (transaction.category === 'Savings') return;
      if (linkedMerchantPatterns.some((pattern) => transaction.place.toLowerCase().includes(pattern))) {
        return;
      }

      totals.set(statementId, (totals.get(statementId) ?? 0) + transaction.value);
      categoryTotals.set(
        transaction.category,
        (categoryTotals.get(transaction.category) ?? 0) + transaction.value
      );
    });

    const periodTotals = Array.from(totals.values());
    const periods = statementIds.length;
    const flexibleAverage = periods === 0
      ? 0
      : periodTotals.reduce((sum, total) => sum + total, 0) / periods;
    const categories = Array.from(categoryTotals.entries())
      .map(([category, total]) => ({
        category,
        monthlyAverage: periods === 0 ? 0 : total / periods
      }))
      .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

    return {
      periods,
      flexibleAverage,
      low: periodTotals.length === 0 ? 0 : Math.min(...periodTotals),
      high: periodTotals.length === 0 ? 0 : Math.max(...periodTotals),
      categories
    };
  }, [forecastWindow.start, nextProjection.items, rules, transactions, yearProjection.items]);

  const activeRuleCount = rules.filter(
    (rule) => rule.enabled === true || rule.enabled === 1
  ).length;
  const projectedExpenseRuleIds = new Set(
    [...nextProjection.items, ...yearProjection.items]
      .filter((item) => item.kind === 'expense')
      .map((item) => item.id)
  );
  const unlinkedExpenseRuleCount = rules.filter((rule) => (
    projectedExpenseRuleIds.has(rule.id) && !rule.merchant_pattern
  )).length;
  const nextEstimate = historical.flexibleAverage + nextProjection.expense_total;
  const yearEstimate = historical.flexibleAverage * 12 + yearProjection.expense_total;
  const rangeLow = historical.low + nextProjection.expense_total;
  const rangeHigh = historical.high + nextProjection.expense_total;
  const nextBalance = nextProjection.income_total - nextEstimate;
  const yearBalance = yearProjection.income_total - yearEstimate;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted">{t('forecast.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 text-center">
          <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 rounded-xl bg-primary px-4 font-medium text-white"
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
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('forecast.title')}</h1>
            <p className="text-sm text-muted">{t('forecast.subtitle')}</p>
          </div>

          {projectionError && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              {t('forecast.error')}
            </p>
          )}

          {unlinkedExpenseRuleCount > 0 && (
            <Link
              href="/recurring"
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
            >
              <span>{t('forecast.unlinkedWarning', { count: unlinkedExpenseRuleCount })}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-surface p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-primary">
                <CalendarRange className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-semibold">{t('forecast.nextMonth')}</h2>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">
                {t('forecast.estimatedSpend')}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums">
                {nextProjectionAvailable ? formatCurrencyWhole(nextEstimate) : '—'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {forecastWindow.start} → {forecastWindow.end}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface/70 p-3">
                  <dt className="text-xs text-muted">{t('forecast.flexible')}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {formatCurrency(historical.flexibleAverage)}
                  </dd>
                </div>
                <div className="rounded-xl border border-dashed border-primary/40 bg-surface/70 p-3">
                  <dt className="text-xs text-muted">{t('forecast.fixed')}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {projectionLoading || !nextProjectionAvailable
                      ? '—'
                      : formatCurrency(nextProjection.expense_total)}
                  </dd>
                </div>
              </dl>
              {nextProjectionAvailable && (
                <p className="mt-4 text-xs text-muted">
                  {t('forecast.range')}: {formatCurrencyWhole(rangeLow)}–{formatCurrencyWhole(rangeHigh)}
                </p>
              )}
              {nextProjectionAvailable && nextProjection.income_total > 0 && (
                <p className={`mt-2 text-sm font-medium tabular-nums ${
                  nextBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {t('forecast.afterIncome', { amount: formatCurrencyWhole(nextBalance) })}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-primary">
                <ChartNoAxesCombined className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-semibold">{t('forecast.nextYear')}</h2>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">
                {t('forecast.estimatedSpend')}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums">
                {yearProjectionAvailable ? formatCurrencyWhole(yearEstimate) : '—'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {forecastWindow.start} → {yearEnd}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-2/70 p-3">
                  <dt className="text-xs text-muted">{t('forecast.fixed')}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {projectionLoading || !yearProjectionAvailable
                      ? '—'
                      : formatCurrency(yearProjection.expense_total)}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-2/70 p-3">
                  <dt className="text-xs text-muted">{t('forecast.income')}</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {projectionLoading || !yearProjectionAvailable
                      ? '—'
                      : formatCurrency(yearProjection.income_total)}
                  </dd>
                </div>
              </dl>
              {yearProjectionAvailable && yearProjection.income_total > 0 && (
                <p className={`mt-4 text-sm font-medium tabular-nums ${
                  yearBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {t('forecast.afterIncome', { amount: formatCurrencyWhole(yearBalance) })}
                </p>
              )}
            </section>
          </div>

          <p className="text-sm text-muted">
            {t('forecast.basedOn', {
              periods: historical.periods,
              rules: activeRuleCount
            })}
          </p>

          {!projectionLoading && !rulesLoadFailed && activeRuleCount === 0 && (
            <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Repeat2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  {t('forecast.configure')}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{t('forecast.noRules')}</p>
              </div>
              <Link
                href="/recurring"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white"
              >
                {t('forecast.configure')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{t('forecast.breakdown')}</h2>
              <p className="mt-1 text-sm text-muted">{t('forecast.flexible')}</p>
              <ul className="mt-4 space-y-3">
                {historical.categories.map((item) => {
                  const percentage = historical.flexibleAverage === 0
                    ? 0
                    : (item.monthlyAverage / historical.flexibleAverage) * 100;
                  const color = getCategoryHexColor(item.category);
                  return (
                    <li key={item.category}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium">
                          {getLocalizedCategoryName(item.category, locale)}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(item.monthlyAverage)} · {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Info className="h-5 w-5 text-primary" aria-hidden="true" />
                {t('forecast.howTitle')}
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                <li>{t('forecast.howHistory')}</li>
                <li>{t('forecast.howRules')}</li>
                <li>{t('forecast.howRange')}</li>
              </ul>
              <p className="mt-5 rounded-xl bg-surface-2/70 p-3 text-xs leading-5 text-muted">
                {t('forecast.disclaimer')}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ForecastPage() {
  return (
    <AuthGuard>
      <ForecastView />
    </AuthGuard>
  );
}
