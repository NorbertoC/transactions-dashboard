import { NextRequest, NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function GET(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const start = request.nextUrl.searchParams.get('start');
  const end = request.nextUrl.searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json(
      { error: 'Query params start and end (YYYY-MM-DD) are required' },
      { status: 400 }
    );
  }

  try {
    const response = await proxyUpstream(
      `/recurring-rules/project?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error projecting recurring rules:', err);
    return NextResponse.json({ error: 'Failed to project recurring rules' }, { status: 500 });
  }
}
