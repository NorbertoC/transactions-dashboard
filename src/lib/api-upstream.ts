import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { isAuthorizedIdentity } from '@/lib/auth-policy';
import { InvalidRequest } from '@/lib/api-validation';
import { randomUUID } from 'node:crypto';
class UpstreamTransportError extends Error {
  constructor(readonly requestId: string) { super('UPSTREAM_TRANSPORT_FAILURE'); }
}

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
  return privateJson({ error: error instanceof InvalidRequest || error instanceof SyntaxError ? 'Invalid request' : 'Service unavailable' }, { status: error instanceof InvalidRequest ? error.status : error instanceof SyntaxError ? 400 : 502, headers: error instanceof UpstreamTransportError ? { 'X-Request-ID': error.requestId } : undefined });
}
export async function proxyUpstream(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = getUpstreamApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', apiKey);
  const requestId = randomUUID();
  headers.set('X-Request-ID', requestId);
  if (init.body) headers.set('Content-Type', 'application/json');
  const started = Date.now();
  try {
    const response = await fetch(`${getUpstreamBaseUrl()}${path}`, { ...init, headers, cache: 'no-store' });
    if (response.status >= 500) console.error(JSON.stringify({ event: 'upstream_http_failure', request_id: requestId, status: response.status, elapsed_ms: Date.now() - started }));
    return response;
  } catch {
    console.error(JSON.stringify({ event: 'upstream_transport_failure', request_id: requestId, elapsed_ms: Date.now() - started }));
    throw new UpstreamTransportError(requestId);
  }
}
export async function upstreamJson(path: string, init: RequestInit = {}) {
  const response = await proxyUpstream(path, init);
  if (!response.ok) {
    const correlation = response.headers.get('X-Request-ID');
    const headers = correlation && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlation) ? { 'X-Request-ID': correlation } : undefined;
    return privateJson({ error: response.status === 404 ? 'Not found' : 'Request failed' }, { status: response.status >= 500 ? 502 : response.status, headers });
  }
  return privateJson(await response.json(), { status: response.status });
}
