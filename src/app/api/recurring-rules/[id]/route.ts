import { NextRequest, NextResponse } from 'next/server';
import {
  missingApiKeyResponse,
  proxyUpstream,
  requireSession
} from '@/lib/api-upstream';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const response = await proxyUpstream(`/recurring-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error updating recurring rule:', err);
    return NextResponse.json({ error: 'Failed to update recurring rule' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  try {
    const response = await proxyUpstream(`/recurring-rules/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    if (err instanceof Error && err.message === 'API_KEY_MISSING') {
      return missingApiKeyResponse();
    }
    console.error('Error deleting recurring rule:', err);
    return NextResponse.json({ error: 'Failed to delete recurring rule' }, { status: 500 });
  }
}
