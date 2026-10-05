import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactions } from '@/hooks/useTransactions';
import { useScopedResource } from '@/hooks/useScopedResource';
import { ApiService, IncomeCapabilityUnavailable } from '@/services/api';
import { SESSION_INVALIDATED } from '@/utils/client-session';

const identity = vi.hoisted(() => ({ status: 'authenticated', data: { user: { id: 'a', email: 'a@example.test', authorized: true } } }));
vi.mock('next-auth/react', () => ({ useSession: () => identity }));
let root: Root;
let container: HTMLDivElement;
let result: ReturnType<typeof useTransactions>;
function Harness({ scope = 'expense' }: { scope?: 'expense' | 'all' }) { result = useTransactions(scope); return null; }
const row = (id: number) => ({ id, place: 'Synthetic', amount: '12.00', date: '2026-01-02', value: 12, date_iso: '2026-01-02', category: 'Housing', currency: 'NZD' });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function render(scope: 'expense' | 'all' = 'expense') { await act(async () => root.render(createElement(Harness, { scope }))); }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  identity.status = 'authenticated'; identity.data.user.id = 'a'; identity.data.user.email = 'a@example.test';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe('scoped loading', () => {
  it('initial slow request and same-scope refresh preserve only completed data with updating', async () => {
    const first = deferred<ReturnType<typeof row>[]>(); const next = deferred<ReturnType<typeof row>[]>();
    vi.spyOn(ApiService, 'fetchTransactionsClient').mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await render(); expect(result.loading).toBe(true); expect(result.transactions).toEqual([]);
    await act(async () => first.resolve([row(1)])); expect(result.loading).toBe(false);
    let refresh!: Promise<void>; await act(async () => { refresh = result.refetch(); });
    expect(result.updating).toBe(true); expect(result.transactions[0].id).toBe(1);
    await act(async () => next.reject(new Error('network'))); await refresh;
    expect(result.error).toBe('network'); expect(result.transactions[0].id).toBe(1); expect(result.updating).toBe(false);
  });
  it('aborts old scope and ignores responses resolved in reverse order', async () => {
    const first = deferred<ReturnType<typeof row>[]>(); const next = deferred<ReturnType<typeof row>[]>();
    const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient').mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await render(); const signal = fetch.mock.calls[0][1]!; await render('all'); expect(signal.aborted).toBe(true);
    await act(async () => next.resolve([row(2)])); await act(async () => first.resolve([row(1)]));
    expect(result.transactions[0].id).toBe(2);
  });
  it('clears immediately on logout and ignores the pending response', async () => {
    const first = deferred<ReturnType<typeof row>[]>(); const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient').mockReturnValue(first.promise);
    await render(); await act(async () => window.dispatchEvent(new Event(SESSION_INVALIDATED)));
    expect(fetch.mock.calls[0][1]!.aborted).toBe(true); await act(async () => first.resolve([row(1)])); expect(result.transactions).toEqual([]);
  });
  it('does not render previous account data when identity changes', async () => {
    const next = deferred<ReturnType<typeof row>[]>(); vi.spyOn(ApiService, 'fetchTransactionsClient').mockResolvedValueOnce([row(1)]).mockReturnValueOnce(next.promise);
    await render(); identity.data.user.id = 'b'; identity.data.user.email = 'b@example.test'; await render();
    expect(result.transactions).toEqual([]); expect(result.loading).toBe(true); await act(async () => next.resolve([row(2)])); expect(result.transactions[0].id).toBe(2);
  });
  it('aborts when navigation unmounts the view', async () => {
    const pending = deferred<ReturnType<typeof row>[]>(); const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient').mockReturnValue(pending.promise);
    await render(); const signal = fetch.mock.calls[0][1]!; await act(async () => root.render(null)); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve([row(1)]));
  });
  it('retries a failed initial request without inventing empty completed data', async () => {
    vi.spyOn(ApiService, 'fetchTransactionsClient').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([row(3)]);
    await render(); expect(result.error).toBe('offline'); expect(result.transactions).toEqual([]); await act(async () => { await result.refetch(); }); expect(result.transactions[0].id).toBe(3);
  });
  it('uses expense fallback only for an explicit unsupported income payload', async () => {
    const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient').mockRejectedValueOnce(new IncomeCapabilityUnavailable()).mockResolvedValueOnce([row(1)]);
    await render('all'); expect(fetch.mock.calls.map(args => args[0])).toEqual(['all', 'expense']); expect(result.incomeAvailable).toBe(false);
  });
  it('401 clears cached data and never requests an expense fallback', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{ ...row(1), record_type: 'expense', direction: 'outflow' }]), { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await render('all'); expect(result.transactions).toHaveLength(1); await act(async () => { await result.refetch(); }); expect(result.transactions).toEqual([]); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not invalidate the new scope from an aborted late 401', async () => {
    const first = deferred<Response>();
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(first.promise).mockResolvedValueOnce(new Response(JSON.stringify([{ ...row(2), record_type: 'expense', direction: 'outflow' }]), { status: 200 }));
    const invalidated = vi.fn(); window.addEventListener(SESSION_INVALIDATED, invalidated);
    await render(); await render('all'); await act(async () => first.resolve(new Response('{}', { status: 401 })));
    expect(invalidated).not.toHaveBeenCalled(); expect(result.transactions[0].id).toBe(2);
    window.removeEventListener(SESSION_INVALIDATED, invalidated);
  });
  it('does not fetch when the session is unavailable', async () => {
    identity.status = 'unauthenticated'; const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient');
    await render(); expect(fetch).not.toHaveBeenCalled(); expect(result.transactions).toEqual([]);
  });
  it('filter changes hide cached results before the new request completes', async () => {
    let resource!: ReturnType<typeof useScopedResource<string>>; const pending = deferred<string>();
    const fetcher = vi.fn().mockResolvedValueOnce('January').mockReturnValueOnce(pending.promise);
    function Filter({ scope }: { scope: string }) { resource = useScopedResource(scope, fetcher); return null; }
    await act(async () => root.render(createElement(Filter, { scope: 'January' }))); expect(resource.data).toBe('January');
    await act(async () => root.render(createElement(Filter, { scope: 'February' }))); expect(resource.data).toBeUndefined(); await act(async () => pending.resolve('February')); expect(resource.data).toBe('February');
  });
});
