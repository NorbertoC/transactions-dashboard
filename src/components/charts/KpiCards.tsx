'use client';

import { motion } from 'framer-motion';
import {
  CalendarDays,
  Minus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import { formatCurrency, formatCurrencyWhole, formatPercentChange } from '@/utils/format';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_TAGS } from '@/i18n/types';

interface KpiCardsProps {
  totalAmount: number;
  previousTotal: number | null;
  previousUsesElapsedDays: boolean;
  transactionCount: number;
  dailyAverage: number;
  periodLabel: string;
}

interface StatCardProps {
  label: string;
  icon: LucideIcon;
  figure: string;
  figureClassName?: string;
  context?: string;
  help: string;
  index: number;
}

function StatCard({
  label,
  icon: Icon,
  figure,
  figureClassName = 'text-foreground',
  context,
  help,
  index
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex min-h-[158px] min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-sm sm:min-h-[172px] sm:p-5"
    >
      <div className="flex items-center gap-2 text-muted">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 text-xs font-medium leading-tight sm:text-sm">{label}</span>
      </div>
      <p
        className={`mt-3 truncate text-[clamp(1.35rem,5.4vw,1.875rem)] font-bold leading-none tabular-nums ${figureClassName}`}
        title={figure}
      >
        {figure}
      </p>
      {context && <p className="mt-1.5 truncate text-xs text-muted sm:text-sm">{context}</p>}
      <p className="mt-auto pt-3 text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">
        {help}
      </p>
    </motion.div>
  );
}

function changeAppearance(change: string | null): { icon: LucideIcon; className: string } {
  if (change?.startsWith('-')) {
    // Spending less than the previous period is an improvement.
    return { icon: TrendingDown, className: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (change?.startsWith('+')) {
    return { icon: TrendingUp, className: 'text-red-500 dark:text-red-400' };
  }
  return { icon: Minus, className: 'text-foreground' };
}

export default function KpiCards({
  totalAmount,
  previousTotal,
  previousUsesElapsedDays,
  transactionCount,
  dailyAverage,
  periodLabel
}: KpiCardsProps) {
  const { t, locale } = useLocale();
  const change = formatPercentChange(totalAmount, previousTotal);
  const { icon: changeIcon, className: changeClassName } = changeAppearance(change);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        index={0}
        label={t('kpi.totalSpent')}
        icon={Wallet}
        figure={formatCurrencyWhole(totalAmount, locale)}
        context={periodLabel}
        help={t('kpi.totalSpentHelp')}
      />
      <StatCard
        index={1}
        label={t('kpi.vsPrevious')}
        icon={changeIcon}
        figure={change ?? '—'}
        figureClassName={change ? changeClassName : 'text-muted'}
        context={
          previousTotal === null
            ? undefined
            : t('kpi.previousAmount', { amount: formatCurrencyWhole(previousTotal, locale) })
        }
        help={t(
          previousUsesElapsedDays
            ? 'kpi.vsPreviousElapsedHelp'
            : 'kpi.vsPreviousHelp'
        )}
      />
      <StatCard
        index={2}
        label={t('kpi.transactions')}
        icon={Receipt}
        figure={transactionCount.toLocaleString(LOCALE_TAGS[locale])}
        help={t('kpi.transactionsHelp')}
      />
      <StatCard
        index={3}
        label={t('kpi.dailyAverage')}
        icon={CalendarDays}
        figure={formatCurrency(dailyAverage, locale)}
        help={t('kpi.dailyAverageHelp')}
      />
    </div>
  );
}
