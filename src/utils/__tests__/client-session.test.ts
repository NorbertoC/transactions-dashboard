import { expect, it, vi } from 'vitest';
import { checkSessionResponse, getClientSessionGeneration, invalidateClientSession, SESSION_INVALIDATED, setClientSessionScope } from '@/utils/client-session';
it('late mutation auth failures do not invalidate a replacement session', () => {
 const listener=vi.fn();window.addEventListener(SESSION_INVALIDATED,listener);
 try {
  setClientSessionScope('synthetic-account-A');const old=getClientSessionGeneration();
  setClientSessionScope('synthetic-account-B');
  expect(()=>checkSessionResponse(new Response('{}',{status:401}),old)).toThrow();expect(listener).not.toHaveBeenCalled();
  expect(()=>checkSessionResponse(new Response('{}',{status:403}),getClientSessionGeneration())).toThrow();expect(listener).toHaveBeenCalledTimes(1);
  const beforeLogout=getClientSessionGeneration();invalidateClientSession();listener.mockClear();
  expect(()=>checkSessionResponse(new Response('{}',{status:401}),beforeLogout)).toThrow();expect(listener).not.toHaveBeenCalled();
 } finally {window.removeEventListener(SESSION_INVALIDATED,listener);setClientSessionScope(null);}
});
