import { NextRequest, NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await request.json();
    const response = await proxyUpstream('/period-summaries/compute', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error computing period summary:', err);
    return NextResponse.json({ error: 'Failed to compute period summary' }, { status: 500 });
  }
}
