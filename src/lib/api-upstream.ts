import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export function getUpstreamBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/transactions\/?$/, '') ||
    'http://localhost:3000'
  );
}

export function getUpstreamApiKey(): string | undefined {
  return process.env.API_KEY;
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null as null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  return { session, error: null as null };
}

export function missingApiKeyResponse() {
  return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
}

export async function proxyUpstream(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const apiKey = getUpstreamApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const headers = new Headers(init.headers);
  headers.set('X-API-Key', apiKey);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${getUpstreamBaseUrl()}${path}`, {
    ...init,
    headers
  });
}
