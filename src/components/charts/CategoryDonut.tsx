'use client';

import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import {
  getCategoryBadgeStyles,
  getCategoryHexColor,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import { ChartDataPoint } from '@/types/transaction';
import { formatCurrency, formatCurrencyWhole } from '@/utils/format';

interface CategoryDonutProps {
  data: ChartDataPoint[];
  total: number;
  selectedCategory: string | null;
  onSelect?: (name: string) => void;
  onReset?: () => void;
}

function resolveColor(entry: ChartDataPoint): string {
  return typeof entry.color === 'string' ? entry.color : getCategoryHexColor(entry.name);
}

interface LegendRowContentProps {
  entry: ChartDataPoint;
  color: string;
  displayName: string;
}

function LegendRowContent({ entry, color, displayName }: LegendRowContentProps) {
  const percentage = Math.max(0, Math.min(100, entry.percentage));

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm font-medium text-foreground"
            title={entry.name}
          >
            {displayName}
          </span>
          <span className="block text-xs text-muted">
            {entry.count} {entry.count === 1 ? 'transaction' : 'transactions'}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(entry.value)}
        </span>
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </>
  );
}

export default function CategoryDonut({
  data,
  total,
  selectedCategory,
  onSelect,
  onReset
}: CategoryDonutProps) {
  const { t, locale } = useLocale();

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="text-base font-semibold text-foreground">{t('charts.categories')}</h3>
      {selectedCategory && (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
            style={getCategoryBadgeStyles(selectedCategory).style}
            title={selectedCategory}
          >
            {getLocalizedCategoryName(selectedCategory, locale)}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-primary transition-colors hover:bg-surface-2"
          >
            {t('charts.allCategories')}
          </button>
        </div>
      )}
    </div>
  );

  if (data.length === 0) {
    return (
      <div>
        {header}
        <p className="py-12 text-center text-sm text-muted">
          No spending data for this period.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {header}
      <p className="mt-1 text-xs leading-5 text-muted">
        {selectedCategory
          ? t('charts.subcategoriesHelp', {
              category: getLocalizedCategoryName(selectedCategory, locale)
            })
          : t('charts.categoriesHelp')}
      </p>

      <div className="relative mt-3 h-[220px] sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart style={{ outline: 'none' }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={3}
              cornerRadius={6}
              startAngle={90}
              endAngle={450}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={resolveColor(entry)}
                  stroke="var(--surface)"
                  strokeWidth={4}
                  className={onSelect ? 'cursor-pointer' : undefined}
                  onClick={onSelect ? () => onSelect(entry.name) : undefined}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="max-w-[60%] truncate text-xs text-muted">
            {selectedCategory
              ? getLocalizedCategoryName(selectedCategory, locale)
              : 'Total'}
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {formatCurrencyWhole(total)}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {data.map((entry) => {
          const color = resolveColor(entry);
          const displayName = selectedCategory
            ? getLocalizedSubcategoryName(entry.name, locale)
            : getLocalizedCategoryName(entry.name, locale);
          const content = (
            <LegendRowContent entry={entry} color={color} displayName={displayName} />
          );

          return (
            <li key={entry.name}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(entry.name)}
                  className="block min-h-11 w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  {content}
                </button>
              ) : (
                <div className="px-2 py-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
