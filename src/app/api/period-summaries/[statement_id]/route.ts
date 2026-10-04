import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { isIsoDate, InvalidRequest } from '@/lib/api-validation';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ statement_id: string }> }) {
  const { error } = await requireSession(); if (error) return error;
  try { const { statement_id } = await params; if (!isIsoDate(statement_id)) throw new InvalidRequest(); return await upstreamJson(`/period-summaries/${statement_id}`); } catch (error) { return requestError(error); }
}
