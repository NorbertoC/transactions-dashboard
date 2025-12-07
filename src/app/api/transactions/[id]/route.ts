import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: {
    id: string;
  };
}

async function handleUpdate(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = Number(params.id);
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

    const response = await fetch(`${apiUrl}/transactions/${id}`, {
      method: upstreamMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

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
