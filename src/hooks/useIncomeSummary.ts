'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IncomeSummary } from '@/types/income';
import { incomeWindows, validateIncomeSummary } from '@/utils/income';

export function useIncomeSummary(start: string, end: string, years: readonly string[], available: boolean, receiptCents: number) {
  const key = JSON.stringify({ windows: incomeWindows(start, end, years), receiptCents });
  const windows = useMemo(() => (JSON.parse(key) as { windows: { start: string; end: string }[] }).windows, [key]);
  const [result, setResult] = useState<{ key: string; summaries: IncomeSummary[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!available || !windows.length) return;
    const controller = new AbortController();
    Promise.all(windows.map(async window => {
      const response = await fetch(`/api/income-summary?start_date=${window.start}&end_date=${window.end}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Income coverage unavailable');
      const summary = validateIncomeSummary(await response.json());
      if (summary.start_date !== window.start || summary.end_date !== window.end) throw new Error('Income coverage mismatch');
      return summary;
    })).then(summaries => { if (!controller.signal.aborted) { setResult({ key, summaries }); setFailedKey(null); } }).catch(() => { if (!controller.signal.aborted) setFailedKey(key); });
    return () => controller.abort();
  }, [available, key, windows]);
  return { summaries: available && result?.key === key ? result.summaries : null,
    loading: available && windows.length > 0 && result?.key !== key && failedKey !== key };
}
