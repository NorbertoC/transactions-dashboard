'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { SESSION_INVALIDATED } from '@/utils/client-session';

export function useScopedResource<T>(scope: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const { data: session, status } = useSession();
  const authorized = status === 'authenticated' && session?.user.authorized === true;
  const key = authorized ? JSON.stringify([session.user.id, session.user.email, scope]) : null;
  const [state, setState] = useState<{ key: string | null; data?: T; pending: boolean; error: string | null }>({ key: null, pending: false, error: null });
  const controller = useRef<AbortController | null>(null);
  const currentKey = useRef(key);
  currentKey.current = key;
  const blocked = useRef(false);

  const refetch = useCallback(async () => {
    controller.current?.abort();
    if (!key || blocked.current) return;
    const request = new AbortController();
    controller.current = request;
    setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, pending: true, error: null }));
    try {
      const data = await fetcher(request.signal);
      if (!request.signal.aborted && currentKey.current === key && !blocked.current) setState({ key, data, pending: false, error: null });
    } catch (error) {
      if (!request.signal.aborted && currentKey.current === key && !blocked.current) {
        setState(previous => ({ ...previous, pending: false, error: error instanceof Error ? error.message : 'Request failed' }));
      }
    }
  }, [key, fetcher]);

  useEffect(() => {
    const clear = () => {
      blocked.current = true;
      controller.current?.abort();
      setState({ key: null, pending: false, error: null });
    };
    window.addEventListener(SESSION_INVALIDATED, clear);
    return () => window.removeEventListener(SESSION_INVALIDATED, clear);
  }, []);

  useEffect(() => {
    blocked.current = false;
    void refetch();
    return () => controller.current?.abort();
  }, [refetch]);

  const data = key && state.key === key && !blocked.current ? state.data : undefined;
  const setData = (update: (previous: T) => T) => setState(previous => {
    if (!key || previous.key !== key || previous.data === undefined || blocked.current) return previous;
    return { ...previous, data: update(previous.data) };
  });
  return { data, loading: authorized && data === undefined && (state.key !== key || state.pending), updating: data !== undefined && state.pending,
    error: key && state.key === key ? state.error : null, refetch, setData };
}
