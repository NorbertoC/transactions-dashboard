'use client';

import { motion } from 'framer-motion';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_TAGS } from '@/i18n/types';
import { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/format';

interface TopMerchantsProps {
  transactions: Transaction[];
  limit?: number;
}

interface MerchantRow {
  key: string;
  place: string;
  total: number;
  count: number;
}

function aggregateMerchants(transactions: Transaction[], limit: number): MerchantRow[] {
  const groups = new Map<string, MerchantRow>();

  for (const tx of transactions) {
    const key = tx.place.trim().replace(/\s+/g, ' ');
    const existing = groups.get(key);
    if (existing) {
      existing.total += tx.value;
      existing.count += 1;
      continue;
    }
    groups.set(key, { key, place: tx.place.trim(), total: tx.value, count: 1 });
  }

  return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export default function TopMerchants({ transactions, limit = 5 }: TopMerchantsProps) {
  const { t, locale } = useLocale();
  const merchants = aggregateMerchants(transactions, limit);
  const maxTotal = merchants[0]?.total ?? 0;

  if (merchants.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-foreground">{t('charts.merchants')}</h3>
        <p className="py-12 text-center text-sm text-muted">
          {t('charts.noTransactions')}
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
      <div>
        <h3 className="text-base font-semibold text-foreground">{t('charts.merchants')}</h3>
        <p className="mt-1 text-xs leading-5 text-muted">{t('charts.merchantHelp')}</p>
      </div>
      <ol className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        {merchants.map((merchant, index) => {
          const barWidth =
            maxTotal > 0 ? Math.max(0, Math.min(100, (merchant.total / maxTotal) * 100)) : 0;
          const count = merchant.count.toLocaleString(LOCALE_TAGS[locale]);
          const purchaseLabel = t(
            merchant.count === 1 ? 'charts.purchase' : 'charts.purchases',
            { count }
          );

          return (
            <li
              key={merchant.key}
              className="flex min-w-0 items-start gap-3 rounded-xl border border-border-subtle bg-surface-2/45 p-3.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={merchant.place}>
                  {merchant.place}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <p className="text-xs text-muted">
                    {purchaseLabel}
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(merchant.total, locale)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
