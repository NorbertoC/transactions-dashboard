import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { isAuthorizedIdentity } from '@/lib/auth-policy';
import { InvalidRequest } from '@/lib/api-validation';

export function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Vary', 'Cookie');
  return NextResponse.json(body, { ...init, headers });
}
export function getUpstreamBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/transactions\/?$/, '') || 'http://localhost:3000';
}
export function getUpstreamApiKey(): string | undefined { return process.env.API_KEY; }
export async function requireSession(request?: Request) {
  const session = await getServerSession(authOptions);
  if (!isAuthorizedIdentity(session?.user)) return { session: null, error: privateJson({ error: 'Unauthorized' }, { status: 401 }) };
  if (request && !['GET','HEAD'].includes(request.method)) {
    const configured = process.env.NEXTAUTH_URL;
    let origin: string;
    try { origin = new URL(configured || request.url).origin; } catch { return { session: null, error: privateJson({ error: 'Forbidden' }, { status: 403 }) }; }
    if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') return { session: null, error: privateJson({ error: 'Forbidden' }, { status: 403 }) };
    if (request.method !== 'DELETE' && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return { session: null, error: privateJson({ error: 'Unsupported content type' }, { status: 415 }) };
  }
  return { session, error: null };
}
export function missingApiKeyResponse() { return privateJson({ error: 'Service unavailable' }, { status: 503 }); }
export function requestError(error: unknown) {
  return privateJson({ error: error instanceof InvalidRequest || error instanceof SyntaxError ? 'Invalid request' : 'Service unavailable' }, { status: error instanceof InvalidRequest ? error.status : error instanceof SyntaxError ? 400 : 502 });
}
export async function proxyUpstream(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = getUpstreamApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', apiKey);
  if (init.body) headers.set('Content-Type', 'application/json');
  return fetch(`${getUpstreamBaseUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}
export async function upstreamJson(path: string, init: RequestInit = {}) {
  const response = await proxyUpstream(path, init);
  if (!response.ok) return privateJson({ error: response.status === 404 ? 'Not found' : 'Request failed' }, { status: response.status >= 500 ? 502 : response.status });
  return privateJson(await response.json(), { status: response.status });
}
