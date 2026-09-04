import { NextRequest, NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const response = await proxyUpstream('/recurring-rules');
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error fetching recurring rules:', err);
    return NextResponse.json({ error: 'Failed to fetch recurring rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await request.json();
    const response = await proxyUpstream('/recurring-rules', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error creating recurring rule:', err);
    return NextResponse.json({ error: 'Failed to create recurring rule' }, { status: 500 });
  }
}
