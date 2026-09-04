import { NextRequest, NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ statement_id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { statement_id } = await params;

  try {
    const response = await proxyUpstream(`/period-summaries/${encodeURIComponent(statement_id)}`);
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error fetching period summary:', err);
    return NextResponse.json({ error: 'Failed to fetch period summary' }, { status: 500 });
  }
}
