'use client';

import { motion } from 'framer-motion';
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
  const merchants = aggregateMerchants(transactions, limit);
  const maxTotal = merchants[0]?.total ?? 0;

  if (merchants.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-foreground">Top merchants</h3>
        <p className="py-12 text-center text-sm text-muted">
          No transactions for this period.
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
      <h3 className="text-base font-semibold text-foreground">Top merchants</h3>
      <ol className="mt-3 space-y-3">
        {merchants.map((merchant, index) => {
          const barWidth =
            maxTotal > 0 ? Math.max(0, Math.min(100, (merchant.total / maxTotal) * 100)) : 0;

          return (
            <li key={merchant.key} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{merchant.place}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(merchant.total)}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {merchant.count} {merchant.count === 1 ? 'purchase' : 'purchases'}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-surface-2">
                  <div
                    className="h-full rounded bg-primary"
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
