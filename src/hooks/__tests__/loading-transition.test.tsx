import { act, createElement, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { ApiService } from '@/services/api';
import { useScopedResource } from '@/hooks/useScopedResource';
import type { Transaction } from '@/types/transaction';

vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'synthetic', email: 'synthetic@example.test', authorized: true } } }), signOut: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => createElement('a', { href }, children) }));
let root: Root;
let container: HTMLDivElement;
const row: Transaction = { id: 1, place: 'Synthetic', value: 12, amount: '12.00', date: '2026-01-02', date_iso: '2026-01-02', category: 'Housing', currency: 'NZD' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() }); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('production loading transitions', () => {
  it('labels unavailable date menus while loading and replaces placeholders after success without extra requests', async () => {
    const first = deferred<Transaction[]>(); const fetch = vi.spyOn(ApiService, 'fetchTransactionsClient').mockReturnValue(first.promise);
    await act(async () => root.render(createElement(LocaleProvider, null, createElement(Home))));
    const menus = container.querySelectorAll<HTMLSelectElement>('.mesa-global-controls select');
    expect(menus[1].disabled).toBe(true); expect(menus[1].selectedOptions[0].textContent).toBe('Loading…'); expect(menus[2].options).toHaveLength(1);
    await act(async () => first.resolve([row])); expect(container.querySelector('.dashboard-skeleton')).toBeNull(); expect(container.querySelector('[aria-busy="true"]')).toBeNull(); expect(container.querySelector('[data-testid="summary"]')).not.toBeNull();
    await act(async () => root.render(createElement(LocaleProvider, null, createElement(Home)))); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('ends busy semantics on failure and restores loading then content on retry', async () => {
    const retry = deferred<Transaction[]>(); vi.spyOn(ApiService, 'fetchTransactionsClient').mockRejectedValueOnce(new Error('connection failed')).mockReturnValueOnce(retry.promise);
    await act(async () => root.render(createElement(LocaleProvider, null, createElement(Home))));
    expect(container.querySelector('[aria-busy="true"]')).toBeNull(); expect(container.querySelector('.dashboard-skeleton')).toBeNull(); expect(container.querySelector('.dashboard-unavailable')).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>('.mesa-global-controls select:nth-of-type(1)')).not.toBeNull();
    expect(container.querySelectorAll<HTMLSelectElement>('.mesa-global-controls select')[1].selectedOptions[0].textContent).toBe('Unavailable');
    await act(async () => (container.querySelector('.data-feedback button') as HTMLButtonElement).click()); expect(container.querySelector('.dashboard-skeleton')).not.toBeNull();
    await act(async () => retry.resolve([row])); expect(container.querySelector('.dashboard-unavailable')).toBeNull(); expect(container.querySelector('.dashboard-skeleton')).toBeNull(); expect(container.querySelector('header')).not.toBeNull();
  });
  it('long waits offer context without terminating or clearing same-scope data, and clear on completion', async () => {
    vi.useFakeTimers(); const next = deferred<string>(); let resource!: ReturnType<typeof useScopedResource<string>>;
    const fetch = vi.fn().mockResolvedValueOnce('completed').mockReturnValueOnce(next.promise);
    function Harness() { const fetcher = useCallback((signal: AbortSignal) => fetch(signal), []); resource = useScopedResource('same', fetcher); return null; }
    await act(async () => root.render(createElement(Harness))); expect(resource.data).toBe('completed');
    let promise!: Promise<void>; await act(async () => { promise = resource.refetch(); }); await act(async () => { vi.advanceTimersByTime(8000); });
    expect(resource.slow).toBe(true); expect(resource.data).toBe('completed'); expect(resource.updating).toBe(true); expect(fetch.mock.calls[1][0].aborted).toBe(false);
    await act(async () => next.resolve('updated')); await promise; expect(resource.slow).toBe(false); expect(resource.data).toBe('updated'); expect(resource.updating).toBe(false);
  });
});
