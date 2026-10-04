import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.value) }));
import { authOptions } from '@/lib/auth';
import { isAuthorizedIdentity } from '@/lib/auth-policy';
import { requireSession, upstreamJson } from '@/lib/api-upstream';
import { InvalidRequest, isIsoDate, readBoundedText, validId, validateRule, validateWindow } from '@/lib/api-validation';
import { GET as transactions } from '@/app/api/transactions/route';
import { POST as upload } from '@/app/api/upload-json/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.stubEnv('ALLOWED_EMAIL_1', 'synthetic-a@example.test');
  vi.stubEnv('ALLOWED_EMAIL_2', 'synthetic-b@example.test');
  vi.stubEnv('NEXTAUTH_URL', 'https://fixture.test');
  vi.stubEnv('API_KEY', 'synthetic-key');
  session.value = { user: { email: 'SYNTHETIC-A@example.test', provider: 'google', emailVerified: true } };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Google identity and current allowlist', () => {
  it('only exposes Google OAuth', () => expect(authOptions.providers.map(provider => provider.id)).toEqual(['google']));
  it('requires provider, verification and current allowed email', () => {
    expect(isAuthorizedIdentity((session.value as { user: object }).user)).toBe(true);
    for (const user of [null, {}, { email: 'synthetic-a@example.test' }, { email: 'other@example.test', provider: 'google', emailVerified: true }, { email: 'synthetic-a@example.test', provider: 'credentials', emailVerified: true }, { email: 'synthetic-a@example.test', provider: 'google', emailVerified: false }]) expect(isAuthorizedIdentity(user)).toBe(false);
    vi.stubEnv('ALLOWED_EMAIL_1', 'new@example.test');
    expect(isAuthorizedIdentity((session.value as { user: object }).user)).toBe(false);
  });
  it('denies reads before any upstream access and never caches errors', async () => {
    session.value = null; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const response = await transactions();
    expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store'); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires verified Google profile at sign-in and denies other providers', async () => {
    const callback = authOptions.callbacks!.signIn!;
    const fixture = { user: { id: 'fixture', name: 'Synthetic', username: '', email: 'synthetic-a@example.test' }, account: { provider: 'google', type: 'oauth' as const, providerAccountId: 'fixture' }, profile: { email: 'synthetic-a@example.test', email_verified: true } };
    expect(await callback(fixture)).toBe(true);
    const unverifiedProfile = { ...fixture.profile, email_verified: false };
    expect(await callback({ ...fixture, profile: unverifiedProfile })).toBe(false);
    expect(await callback({ ...fixture, account: { ...fixture.account, provider: 'credentials' } })).toBe(false);
    expect(await callback({ ...fixture, user: { ...fixture.user, email: 'other@example.test' } })).toBe(false);
  });
  it('every financial read and write route rejects an unauthenticated session before fetch', async () => {
    session.value = null; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const recurring = await import('@/app/api/recurring-rules/route');
    const recurringId = await import('@/app/api/recurring-rules/[id]/route');
    const transactionId = await import('@/app/api/transactions/[id]/route');
    const summaries = await import('@/app/api/period-summaries/route');
    const summaryId = await import('@/app/api/period-summaries/[statement_id]/route');
    const compute = await import('@/app/api/period-summaries/compute/route');
    const project = await import('@/app/api/recurring-rules/project/route');
    const request = new NextRequest('https://fixture.test/api/fixture', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: '{}' });
    const id = { params: Promise.resolve({ id: '1' }) };
    const responses = await Promise.all([transactions(), upload(request), recurring.GET(), recurring.POST(request), recurringId.PATCH(request, id), recurringId.DELETE(request, id), transactionId.PATCH(request, id), transactionId.PUT(request, id), transactionId.DELETE(request, id), summaries.GET(), summaryId.GET(request, { params: Promise.resolve({ statement_id: '2026-01-26' }) }), compute.POST(request), project.GET(request)]);
    expect(responses).toHaveLength(13);
    responses.forEach(response => { expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store'); });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects existing sessions without verified Google claims', async () => {
    session.value = { user: { email: 'synthetic-a@example.test' } };
    expect((await requireSession()).error?.status).toBe(401);
  });
});
describe('custom write boundaries', () => {
  const request = (origin?: string, type = 'application/json') => new Request('https://fixture.test/api/transactions/1', { method: 'PATCH', headers: { ...(origin ? { origin } : {}), 'content-type': type }, body: '{}' });
  it('rejects missing/cross-site origins and non-JSON', async () => {
    expect((await requireSession(request())).error?.status).toBe(403);
    expect((await requireSession(request('https://other.test'))).error?.status).toBe(403);
    expect((await requireSession(request('https://fixture.test', 'text/plain'))).error?.status).toBe(415);
    expect((await requireSession(request('https://fixture.test'))).error).toBeNull();
  });
  it('bounds streamed bodies without trusting Content-Length', async () => {
    await expect(readBoundedText(new Request('https://fixture.test', { method: 'POST', body: '12345' }), 4)).rejects.toBeInstanceOf(InvalidRequest);
  });
  it('rejects an import containing a real-calendar invalid date before writes', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const response = await upload(new NextRequest('https://fixture.test/api/upload-json', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify([{ place: 'Synthetic fixture', value: 10, date_iso: '2026-02-30' }]) }));
    expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects NaN, invalid IDs and unbounded projection windows', () => {
    expect(isIsoDate('2026-02-30')).toBe(false); expect(isIsoDate('2024-02-29')).toBe(true);
    for (const id of ['0','-1','1.5','1/foo','9007199254740993']) expect(validId(id)).toBe(false);
    expect(() => validateRule({ amount: Infinity }, true)).toThrow();
    expect(() => validateWindow('2020-01-01','2026-01-01')).toThrow();
    expect(() => validateRule({ kind: 'income', label: 'Fixture', amount: 10, cadence: 'monthly', start_date: '2026-01-01' })).not.toThrow();
  });
  it('accepts a valid category edit and stamps manual source without changing financial fields', async () => {
    const route = await import('@/app/api/transactions/[id]/route');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Synthetic updated' }), { status: 200 })); vi.stubGlobal('fetch', fetch);
    const response = await route.PUT(new NextRequest('https://fixture.test/api/transactions/1', { method: 'PUT', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify({ category: 'Transport', subcategory: 'Parking & Tolls' }) }), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(200);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ category: 'Transport', subcategory: 'Parking & Tolls', category_source: 'manual' });
    expect(fetch.mock.calls[0][1].headers.get('X-API-Key')).toBe('synthetic-key');
  });
  it('hides upstream errors and disables cache on upstream requests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'synthetic sensitive diagnostic' }), { status: 500 })); vi.stubGlobal('fetch', fetch);
    const response = await upstreamJson('/transactions');
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('sensitive'); expect(fetch.mock.calls[0][1].cache).toBe('no-store'); expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
