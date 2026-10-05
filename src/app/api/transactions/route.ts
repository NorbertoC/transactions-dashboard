import { requireSession, privateJson, requestError } from '@/lib/api-upstream';
import { ApiService } from '@/services/api';
import type { RecordScope } from '@/services/api';
import { InvalidRequest } from '@/lib/api-validation';
export async function GET(request: Request) {
  const { error } = await requireSession(); if (error) return error;
  try {
    const scope = new URL(request.url).searchParams.get('record_type') ?? 'expense';
    if (!['expense', 'income', 'transfer', 'all'].includes(scope)) throw new InvalidRequest();
    return privateJson(await ApiService.fetchTransactions(scope as RecordScope));
  } catch (error) { return requestError(error); }
}
