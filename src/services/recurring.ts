import { checkSessionResponse, getClientSessionGeneration, HttpError } from '@/utils/client-session';
import type {
  RecurringProjection,
  RecurringRule,
  RecurringRuleInput
} from '@/types/recurring';

async function readJson(response: Response) {
  return response.json().catch(() => ({ error: 'Invalid response' }));
}

export async function fetchRecurringRules(signal?: AbortSignal): Promise<RecurringRule[]> {
  const generation = getClientSessionGeneration();
  const response = await fetch('/api/recurring-rules', { signal, cache: 'no-store' });
  signal?.throwIfAborted();
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to fetch recurring rules');
  }
  return data as RecurringRule[];
}

export async function fetchRecurringProjection(
  start: string,
  end: string,
  signal?: AbortSignal
): Promise<RecurringProjection> {
  const params = new URLSearchParams({ start, end });
  const generation = getClientSessionGeneration();
  const response = await fetch(`/api/recurring-rules/project?${params}`, { signal, cache: 'no-store' });
  signal?.throwIfAborted();
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to project recurring rules');
  }
  return data as RecurringProjection;
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<void> {
  const generation = getClientSessionGeneration();
  const response = await fetch('/api/recurring-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to create recurring rule');
  }
}

export async function updateRecurringRule(
  id: number,
  input: Partial<RecurringRuleInput>
): Promise<void> {
  const generation = getClientSessionGeneration();
  const response = await fetch(`/api/recurring-rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to update recurring rule');
  }
}

export async function deleteRecurringRule(id: number): Promise<void> {
  const generation = getClientSessionGeneration();
  const response = await fetch(`/api/recurring-rules/${id}`, { method: 'DELETE' });
  checkSessionResponse(response, generation);
  const data = await readJson(response);
  if (!response.ok) {
    throw new HttpError(response.status, data.error || 'Failed to delete recurring rule');
  }
}
