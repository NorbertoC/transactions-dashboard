'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import Header from '@/components/Header';
import { SectionSkeleton } from '@/components/LoadingState';
import { SESSION_INVALIDATED, setClientSessionScope } from '@/utils/client-session';
import { useLocale } from '@/i18n/LocaleProvider';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const [invalidated, setInvalidated] = useState(false);
  const sessionScope = status === 'authenticated' ? JSON.stringify([data?.user.id, data?.user.email]) : null;
  useLayoutEffect(() => { setClientSessionScope(sessionScope); }, [sessionScope]);
  useEffect(() => {
    const clear = () => setInvalidated(true);
    window.addEventListener(SESSION_INVALIDATED, clear);
    return () => window.removeEventListener(SESSION_INVALIDATED, clear);
  }, []);
  const unauthorized = invalidated || status === 'unauthenticated' || status === 'authenticated' && data?.user.authorized !== true;
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    if (unauthorized) {
      router.push('/auth/signin');
    }
  }, [unauthorized, router]);

  if (status === 'loading') {
    return <div className="flex min-h-screen flex-col"><Header /><main className="mesa-main flex-1"><SectionSkeleton label={t('auth.loading')} /></main></div>;
  }

  if (unauthorized) {
    return null;
  }

  return <>{children}</>;
}
