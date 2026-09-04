'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  DEFAULT_SUBCATEGORY,
  getCategoryHexColor,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_TAGS, type Locale } from '@/i18n/types';
import { Transaction } from '@/types/transaction';
import { generateColorVariants } from '@/utils/color';
import { formatCurrency } from '@/utils/format';

interface MonthlyTrendChartProps {
  transactions: Transaction[];
  selectedCategory: string | null;
  categoryColors: Record<string, string>;
  currentPeriodKey?: string | null;
}

interface PeriodRow extends Record<string, string | number> {
  key: string;
  label: string;
  total: number;
}

interface Segment {
  name: string;
  field: string;
  color: string;
}

const MAX_PERIODS = 6;
const MAX_CATEGORY_SEGMENTS = 5;
const OTHER_SEGMENT = 'Other';
const OTHER_COLOR = '#94a3b8';

/** Recharts resolves string dataKeys as object paths, so strip path characters. */
function fieldFor(name: string): string {
  return `seg_${name.replace(/[.[\]]/g, '_')}`;
}

function periodMonthLabel(statementEnd: string | null, key: string, locale: Locale): string {
  const iso = statementEnd?.slice(0, 10) ?? (/^\d{4}-\d{2}$/.test(key) ? `${key}-01` : null);
  if (!iso) {
    return key;
  }
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return key;
  }
  return date.toLocaleDateString(LOCALE_TAGS[locale], { month: 'short', timeZone: 'UTC' });
}

function formatCompactCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'NZD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

interface TrendTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string; payload?: PeriodRow }[];
  locale: Locale;
}

function TrendTooltip({ active, label, payload, locale }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0]?.payload;
  const entries = payload
    .filter((entry) => (entry.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-3 py-2.5 shadow-md">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {row && (
          <p className="text-xs tabular-nums text-muted">{formatCurrency(row.total, locale)}</p>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted">{entry.name}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
              {formatCurrency(entry.value ?? 0, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildChartData(
  transactions: Transaction[],
  selectedCategory: string | null,
  categoryColors: Record<string, string>,
  locale: Locale
): { rows: PeriodRow[]; segments: Segment[] } {
  const source = selectedCategory
    ? transactions.filter((tx) => tx.category === selectedCategory)
    : transactions;

  const segmentOf = (tx: Transaction) =>
    selectedCategory ? tx.subcategory ?? DEFAULT_SUBCATEGORY : tx.category;

  const groups = new Map<
    string,
    { key: string; statementEnd: string | null; maxDate: string; txs: Transaction[] }
  >();
  for (const tx of source) {
    const key = tx.statement_id ?? tx.date_iso.slice(0, 7);
    const group = groups.get(key) ?? { key, statementEnd: null, maxDate: '', txs: [] };
    group.statementEnd = group.statementEnd ?? tx.statement_end ?? null;
    if (tx.date_iso > group.maxDate) {
      group.maxDate = tx.date_iso;
    }
    group.txs.push(tx);
    groups.set(key, group);
  }

  const orderedGroups = [...groups.values()]
    .sort((a, b) => (a.statementEnd ?? a.maxDate).localeCompare(b.statementEnd ?? b.maxDate))
    .slice(-MAX_PERIODS);

  const totals = new Map<string, number>();
  for (const group of orderedGroups) {
    for (const tx of group.txs) {
      const name = segmentOf(tx);
      totals.set(name, (totals.get(name) ?? 0) + tx.value);
    }
  }
  const sortedNames = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  let segments: Segment[];
  let mergedNames: Set<string> | null = null;
  if (selectedCategory) {
    const baseColor = getCategoryHexColor(selectedCategory);
    const variants = generateColorVariants(baseColor, sortedNames.length, true);
    segments = sortedNames.map((name, index) => ({
      name,
      field: fieldFor(name),
      color: variants[index] ?? baseColor
    }));
  } else {
    const top = sortedNames.slice(0, MAX_CATEGORY_SEGMENTS);
    const rest = sortedNames.slice(MAX_CATEGORY_SEGMENTS);
    segments = top.map((name) => ({
      name,
      field: fieldFor(name),
      color: categoryColors[name] ?? getCategoryHexColor(name)
    }));
    if (rest.length > 0) {
      segments.push({ name: OTHER_SEGMENT, field: fieldFor(OTHER_SEGMENT), color: OTHER_COLOR });
      mergedNames = new Set(rest);
    }
  }

  const rows = orderedGroups.map((group) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const tx of group.txs) {
      const name = segmentOf(tx);
      const field = mergedNames?.has(name) ? fieldFor(OTHER_SEGMENT) : fieldFor(name);
      values[field] = (values[field] ?? 0) + tx.value;
      total += tx.value;
    }
    return {
      key: group.key,
      label: periodMonthLabel(group.statementEnd, group.key, locale),
      total,
      ...values
    } satisfies PeriodRow;
  });

  return { rows, segments };
}

export default function MonthlyTrendChart({
  transactions,
  selectedCategory,
  categoryColors,
  currentPeriodKey
}: MonthlyTrendChartProps) {
  const { t, locale } = useLocale();
  const { rows, segments } = useMemo(
    () => buildChartData(transactions, selectedCategory, categoryColors, locale),
    [transactions, selectedCategory, categoryColors, locale]
  );

  const displayNameFor = (name: string) => {
    if (name === OTHER_SEGMENT) {
      return t('charts.remaining');
    }
    return selectedCategory
      ? getLocalizedSubcategoryName(name, locale)
      : getLocalizedCategoryName(name, locale);
  };

  const opacityFor = (rowKey: string) => {
    if (!currentPeriodKey) {
      return 1;
    }
    return rowKey === currentPeriodKey ? 1 : 0.6;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-base font-semibold text-foreground">{t('charts.trend')}</h3>
        <p className="text-sm text-muted">
          {t('charts.lastStatements', { count: MAX_PERIODS })}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          {t('charts.noSpending')}
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5" aria-label={t('charts.categories')}>
            {segments.map((segment) => (
              <li key={segment.field} className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{displayNameFor(segment.name)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 h-[275px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                barCategoryGap="32%"
                margin={{ top: 8, right: 20, left: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 14, right: 14 }}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  tickFormatter={(value: number) => formatCompactCurrency(value, locale)}
                />
                <Tooltip
                  content={<TrendTooltip locale={locale} />}
                  cursor={{ fill: 'var(--surface-2)', fillOpacity: 0.6 }}
                />
                {segments.map((segment) => (
                  <Bar
                    key={segment.field}
                    name={displayNameFor(segment.name)}
                    dataKey={segment.field}
                    stackId="spend"
                    fill={segment.color}
                    maxBarSize={52}
                  >
                    {rows.map((row) => (
                      <Cell key={row.key} fillOpacity={opacityFor(row.key)} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </motion.div>
  );
}
