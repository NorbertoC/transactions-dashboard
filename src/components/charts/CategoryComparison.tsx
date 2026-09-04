'use client';

import { useId, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  getCategoryHexColor,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_TAGS, type Locale } from '@/i18n/types';
import type { Transaction } from '@/types/transaction';
import {
  buildCategoryComparison,
  type CategoryComparisonPeriod
} from '@/utils/category-comparison';
import { formatCurrency, formatCurrencyWhole } from '@/utils/format';

interface CategoryComparisonProps {
  transactions: Transaction[];
  category: string;
  subcategory: string | null;
  onSubcategoryChange: (subcategory: string | null) => void;
}

interface ComparisonRow extends CategoryComparisonPeriod {
  shortLabel: string;
  longLabel: string;
  inProgress: boolean;
}

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ComparisonRow }>;
  locale: Locale;
}

function getLocalTodayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
}

function formatPeriodLabel(dateIso: string, locale: Locale, long: boolean): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : '2-digit',
    timeZone: 'UTC'
  }).format(date);
}

function formatCompactCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'NZD',
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

function ComparisonTooltip({ active, payload, locale }: ComparisonTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{row.longLabel}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">
        {formatCurrency(row.total, locale)}
      </p>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  context?: string;
}

function SummaryCard({ label, value, context }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/70 p-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
        {value}
      </p>
      {context && <p className="mt-1 truncate text-xs text-muted">{context}</p>}
    </div>
  );
}

export default function CategoryComparison({
  transactions,
  category,
  subcategory,
  onSubcategoryChange
}: CategoryComparisonProps) {
  const { t, locale } = useLocale();
  const scopeId = useId();

  const localizedCategory = getLocalizedCategoryName(category, locale);
  const availableSubcategories = useMemo(() => {
    const names = new Set<string>();
    for (const transaction of transactions) {
      if (transaction.category === category && transaction.subcategory) {
        names.add(transaction.subcategory);
      }
    }
    return [...names].sort((a, b) =>
      getLocalizedSubcategoryName(a, locale).localeCompare(
        getLocalizedSubcategoryName(b, locale),
        LOCALE_TAGS[locale]
      )
    );
  }, [category, locale, transactions]);

  const rows = useMemo(() => {
    const todayIso = getLocalTodayIso();
    return buildCategoryComparison(transactions, category, subcategory).map((period) => ({
      ...period,
      shortLabel: formatPeriodLabel(period.statementEnd, locale, false),
      longLabel: formatPeriodLabel(period.statementEnd, locale, true),
      inProgress: period.statementEnd > todayIso
    }));
  }, [category, locale, subcategory, transactions]);

  const selectedLabel = subcategory
    ? getLocalizedSubcategoryName(subcategory, locale)
    : localizedCategory;
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const average = rows.length > 0 ? total / rows.length : 0;
  const highest = rows.reduce<ComparisonRow | null>((current, row) => {
    if (!current || row.total > current.total) return row;
    return current;
  }, null);
  const maxTotal = highest?.total ?? 0;
  const categoryColor = getCategoryHexColor(category);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t('comparison.noData')}</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('comparison.title', { category: selectedLabel })}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t('comparison.subtitle', { count: rows.length })}
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor={scopeId} className="mb-1.5 block text-xs font-medium text-muted">
            {t('comparison.scope')}
          </label>
          <div className="relative">
            <select
              id={scopeId}
              value={subcategory ?? ''}
              onChange={(event) => onSubcategoryChange(event.target.value || null)}
              className="min-h-12 w-full appearance-none rounded-xl border border-border-subtle bg-surface py-2 pl-3 pr-10 text-base font-medium text-foreground"
            >
              <option value="">
                {t('comparison.allCategory', { category: localizedCategory })}
              </option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory}>
                  {getLocalizedSubcategoryName(subcategory, locale)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <SummaryCard label={t('comparison.total')} value={formatCurrencyWhole(total, locale)} />
        <SummaryCard label={t('comparison.average')} value={formatCurrency(average, locale)} />
        <div className="col-span-2 sm:col-span-1">
          <SummaryCard
            label={t('comparison.highest')}
            value={formatCurrency(highest?.total ?? 0, locale)}
            context={highest?.longLabel}
          />
        </div>
      </div>

      <div
        role="img"
        aria-label={t('comparison.chartAria', { category: selectedLabel })}
        className="mt-5 h-[240px] sm:h-[280px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barCategoryGap="28%" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey="shortLabel"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickFormatter={(value: number) => formatCompactCurrency(value, locale)}
            />
            <Tooltip content={<ComparisonTooltip locale={locale} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="total" fill={categoryColor} radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-foreground">{t('comparison.monthlyDetail')}</h4>
        <ol className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[...rows].reverse().map((row) => {
            const barWidth = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
            const countLabel = t(
              row.count === 1 ? 'charts.transaction' : 'charts.transactions',
              { count: row.count }
            );

            return (
              <li key={row.key} className="rounded-xl border border-border-subtle bg-surface/70 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium capitalize text-foreground">{row.longLabel}</p>
                      {row.inProgress && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {t('comparison.inProgress')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{countLabel}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(row.total, locale)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, backgroundColor: categoryColor }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
