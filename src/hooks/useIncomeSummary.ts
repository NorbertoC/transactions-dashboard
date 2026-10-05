'use client';

import { useCallback, useMemo } from 'react';
import { incomeWindows, validateIncomeSummary } from '@/utils/income';
import { checkSessionResponse, getClientSessionGeneration, HttpError } from '@/utils/client-session';
import { useScopedResource } from '@/hooks/useScopedResource';

export function useIncomeSummary(start: string, end: string, years: readonly string[], available: boolean, receiptCents: number) {
  const key = JSON.stringify({ windows: incomeWindows(start, end, years), receiptCents, available });
  const windows = useMemo(() => (JSON.parse(key) as { windows: { start: string; end: string }[] }).windows, [key]);
  const fetcher = useCallback(async (signal: AbortSignal) => {
    if (!available || !windows.length) return null;
    return Promise.all(windows.map(async window => {
      const generation = getClientSessionGeneration();
      const response = await fetch(`/api/income-summary?start_date=${window.start}&end_date=${window.end}`, { cache: 'no-store', signal });
      signal.throwIfAborted();
      checkSessionResponse(response, generation);
      if (!response.ok) throw new HttpError(response.status, 'Income coverage unavailable');
      const summary = validateIncomeSummary(await response.json());
      if (summary.start_date !== window.start || summary.end_date !== window.end) throw new Error('Income coverage mismatch');
      return summary;
    }));
  }, [available, windows]);
  const resource = useScopedResource(`income:${key}`, fetcher);
  return { summaries: available ? resource.data ?? null : null, loading: available && windows.length > 0 && resource.loading,
    updating: resource.updating, slow: resource.slow, error: resource.error, retry: resource.refetch };
}
