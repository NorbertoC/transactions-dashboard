import { checkSessionResponse, getClientSessionGeneration, HttpError } from '@/utils/client-session';
import type { PeriodSummary } from '@/types/recurring';

async function readJson(response: Response) {
  return response.json().catch(() => ({ error: 'Invalid response' }));
}

export async function fetchPeriodSummaries(): Promise<PeriodSummary[]> {
  const generation = getClientSessionGeneration();
  const response = await fetch('/api/period-summaries');
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to fetch period summaries');
  }
  return data as PeriodSummary[];
}

export async function fetchPeriodSummary(
  statementId: string
): Promise<PeriodSummary | null> {
  const generation = getClientSessionGeneration();
  const response = await fetch(`/api/period-summaries/${encodeURIComponent(statementId)}`);
  if (response.status === 404) {
    return null;
  }
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to fetch period summary');
  }
  return data as PeriodSummary;
}

export async function computePeriodSummary(payload: {
  statement_id?: string;
  start?: string;
  end?: string;
}, signal?: AbortSignal): Promise<PeriodSummary> {
  const generation = getClientSessionGeneration();
  const response = await fetch('/api/period-summaries/compute', {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  signal?.throwIfAborted();
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to compute period summary');
  }
  return data as PeriodSummary;
}
