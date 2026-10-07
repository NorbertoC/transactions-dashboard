// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CATEGORIES, PURPOSE_TAXONOMY_HEADER, PURPOSE_TAXONOMY_VERSION } from '@/constants/categories';
const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.value) }));
import { GET } from '@/app/api/taxonomy/route';
import { PUT } from '@/app/api/transactions/[id]/route';
import { POST } from '@/app/api/upload-json/route';
const capability = () => ({ version: 'purpose-v4', manual_category_persistence: true, categories: CATEGORIES.filter(group => group.name !== 'Savings').map(group => ({ key: group.key, name: group.name, subcategories: group.subcategories.map(sub => ({ key: sub.key, name: sub.name })) })) });
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
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(capability()))); vi.stubGlobal('fetch', fetch);
  const response = await GET(); expect(response.status).toBe(200); expect(await response.json()).toEqual(capability()); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get(PURPOSE_TAXONOMY_HEADER)).toBe(PURPOSE_TAXONOMY_VERSION);
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
  expect(fetch.mock.calls.every(([, init]) => new Headers(init.headers).get(PURPOSE_TAXONOMY_HEADER) === PURPOSE_TAXONOMY_VERSION)).toBe(true);
});
it('blocks writes against a v3 contract even when its metadata claims manual persistence', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ...capability(), version: 'purpose-v3' }))); vi.stubGlobal('fetch', fetch);
  expect((await edit()).status).toBe(503); expect(fetch).toHaveBeenCalledTimes(1);
});
it('imports explicit v4 and legacy pairs using the same opt-in contract without changing classification', async () => {
  const payload = [
    { place: 'Synthetic one', value: 10, date_iso: '2026-01-01', category: 'Subscriptions', subcategory: 'Work' },
    { place: 'Synthetic two', value: 20, date_iso: '2026-01-02', category: 'Outings & entertainment', subcategory: 'Meals & treats' },
    { place: 'Synthetic three', value: 30, date_iso: '2026-01-03', category: 'My custom', subcategory: '', category_source: 'manual' },
    { place: 'Synthetic four', value: 40, date_iso: '2026-01-04', category: 'My custom', subcategory: null, category_source: 'manual' },
  ];
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(capability()))).mockResolvedValueOnce(new Response('[]')).mockResolvedValueOnce(new Response('{"success":true}')); vi.stubGlobal('fetch', fetch);
  const request = new NextRequest('https://fixture.test/api/upload-json', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  expect((await POST(request)).status).toBe(200);
  const [url, init] = fetch.mock.calls[2]; expect(url).toBe('http://synthetic.test/transactions/bulk');
  expect(new Headers(init.headers).get(PURPOSE_TAXONOMY_HEADER)).toBe(PURPOSE_TAXONOMY_VERSION);
  expect(JSON.parse(init.body).map(({ category, subcategory }: { category: string; subcategory: string }) => ({ category, subcategory }))).toEqual(payload.map(({ category, subcategory }) => ({ category, subcategory })));
});
it.each(['', null])('rejects an explicitly %s category before reads/writes instead of rewriting it', async category => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const request = new NextRequest('https://fixture.test/api/upload-json', { method: 'POST', headers: { origin: 'https://fixture.test', 'content-type': 'application/json' }, body: JSON.stringify([{ place: 'Synthetic unknown', value: 10, date_iso: '2026-01-01', category, subcategory: '' }]) });
  expect((await POST(request)).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
