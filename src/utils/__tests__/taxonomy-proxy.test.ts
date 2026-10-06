// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CATEGORIES } from '@/constants/categories';
const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.value) }));
import { GET } from '@/app/api/taxonomy/route';
import { PUT } from '@/app/api/transactions/[id]/route';
import { POST } from '@/app/api/upload-json/route';
const capability = () => ({ version: 'purpose-v3', manual_category_persistence: true, categories: CATEGORIES.filter(group => group.name !== 'Savings').map(group => ({ key: group.key, name: group.name, subcategories: group.subcategories.map(sub => ({ key: sub.key, name: sub.name })) })) });
beforeEach(() => {
  vi.stubEnv('ALLOWED_EMAIL_1', 'synthetic-a@example.test'); vi.stubEnv('ALLOWED_EMAIL_2', 'synthetic-b@example.test'); vi.stubEnv('NEXTAUTH_URL', 'https://fixture.test'); vi.stubEnv('API_KEY', 'synthetic-key'); vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://synthetic.test/transactions');
  session.value = { user: { email: 'synthetic-a@example.test', provider: 'google', emailVerified: true } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const edit = () => PUT(new NextRequest('https://fixture.test/api/transactions/42', { method: 'PUT', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify({ category: 'Basic living', subcategory: 'Rent' }) }), { params: Promise.resolve({ id: '42' }) });
it('protects metadata with the existing session policy before upstream access', async () => {
  session.value = null; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect((await GET()).status).toBe(401); expect(fetch).not.toHaveBeenCalled();
});
it('proxies safe metadata with no caching', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(capability()))));
  const response = await GET(); expect(response.status).toBe(200); expect(await response.json()).toEqual(capability()); expect(response.headers.get('cache-control')).toContain('no-store');
});
it.each([404, 500])('blocks category writes before PUT when capability returns %s', async status => {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response('{}', { status })); vi.stubGlobal('fetch', fetch);
  expect((await edit()).status).toBe(503); expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe('http://synthetic.test/taxonomy');
});
it('blocks imports before any financial read or write against old API', async () => {
  const fetch = vi.fn(async () => new Response('{}', { status: 404 })); vi.stubGlobal('fetch', fetch);
  const request = new NextRequest('https://fixture.test/api/upload-json', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify([{ place: 'Synthetic rent', value: 10, date_iso: '2026-01-01', category: 'Basic living', subcategory: 'Rent' }]) });
  expect((await POST(request)).status).toBe(503); expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(['income', 'transfer'])('rejects JSON %s records before normalization can turn them into expenses', async record_type => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const request = new NextRequest('https://fixture.test/api/upload-json', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify([{ place: 'Synthetic movement', value: 10, date_iso: '2026-01-01', record_type }]) });
  expect((await POST(request)).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('forwards just the category pair after exact capability confirmation', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(capability()))).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'updated' }))); vi.stubGlobal('fetch', fetch);
  expect((await edit()).status).toBe(200); expect(fetch).toHaveBeenCalledTimes(2); expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ category: 'Basic living', subcategory: 'Rent' });
});
