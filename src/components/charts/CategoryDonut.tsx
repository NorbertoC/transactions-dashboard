'use client';

import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import {
  getCategoryBadgeStyles,
  getCategoryHexColor,
  getCategoryJapaneseName,
  getSubcategoryJapaneseName
} from '@/constants/categories';
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
  japaneseName?: string;
}

function LegendRowContent({ entry, color, japaneseName }: LegendRowContentProps) {
  const percentage = Math.max(0, Math.min(100, entry.percentage));

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          title={japaneseName}
        >
          {entry.name}
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
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="text-base font-semibold text-foreground">Spending by category</h3>
      {selectedCategory && (
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
            style={getCategoryBadgeStyles(selectedCategory).style}
            title={getCategoryJapaneseName(selectedCategory)}
          >
            {selectedCategory}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-primary transition-colors hover:bg-surface-2"
          >
            All categories
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
            {selectedCategory ?? 'Total'}
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {formatCurrencyWhole(total)}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {data.map((entry) => {
          const color = resolveColor(entry);
          const japaneseName = selectedCategory
            ? getSubcategoryJapaneseName(entry.name)
            : getCategoryJapaneseName(entry.name);
          const content = (
            <LegendRowContent entry={entry} color={color} japaneseName={japaneseName} />
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
