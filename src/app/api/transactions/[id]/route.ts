import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function handleUpdate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const id = Number(resolvedParams.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/transactions', '') || 'http://localhost:3000';
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const category = typeof body.category === 'string' ? body.category.trim() : undefined;
    const subcategory = typeof body.subcategory === 'string' ? body.subcategory.trim() : undefined;

    if (!category && !subcategory) {
      return NextResponse.json(
        { error: 'Please provide category or subcategory to update.' },
        { status: 400 }
      );
    }

    const payload: Record<string, string> = {};
    if (category) payload.category = category;
    if (subcategory) payload.subcategory = subcategory;

    const upstreamMethod = request.method?.toUpperCase() === 'PUT' ? 'PUT' : 'PATCH';

    const upstreamUrl = `${apiUrl}/transactions/${id}`;
    console.log(`Calling upstream: ${upstreamMethod} ${upstreamUrl}`);

    const response = await fetch(upstreamUrl, {
      method: upstreamMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Non-JSON response from upstream (${response.status}):`, text.slice(0, 500));
      return NextResponse.json(
        { error: `Upstream API error (${response.status}): The backend may not support this operation` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || 'Failed to update transaction' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export const PATCH = handleUpdate;
export const PUT = handleUpdate;
