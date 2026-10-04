import { requireSession, privateJson, requestError } from '@/lib/api-upstream';
import { ApiService } from '@/services/api';
export async function GET() {
  const { error } = await requireSession(); if (error) return error;
  try { return privateJson(await ApiService.fetchTransactions()); } catch (error) { return requestError(error); }
}
