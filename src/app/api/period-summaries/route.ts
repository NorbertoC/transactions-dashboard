import { NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const response = await proxyUpstream('/period-summaries');
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error fetching period summaries:', err);
    return NextResponse.json({ error: 'Failed to fetch period summaries' }, { status: 500 });
  }
}
