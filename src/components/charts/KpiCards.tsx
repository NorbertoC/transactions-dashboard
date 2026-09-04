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
      className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate text-sm">{label}</span>
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${figureClassName}`}>{figure}</p>
      {context && <p className="mt-1 text-sm text-muted">{context}</p>}
      <p className="mt-2 text-xs leading-5 text-muted">{help}</p>
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
  const { t } = useLocale();
  const change = formatPercentChange(totalAmount, previousTotal);
  const { icon: changeIcon, className: changeClassName } = changeAppearance(change);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        index={0}
        label={t('kpi.totalSpent')}
        icon={Wallet}
        figure={formatCurrencyWhole(totalAmount)}
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
            : t('kpi.previousAmount', { amount: formatCurrencyWhole(previousTotal) })
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
        figure={transactionCount.toLocaleString('en-NZ')}
        help={t('kpi.transactionsHelp')}
      />
      <StatCard
        index={3}
        label={t('kpi.dailyAverage')}
        icon={CalendarDays}
        figure={formatCurrency(dailyAverage)}
        help={t('kpi.dailyAverageHelp')}
      />
    </div>
  );
}
