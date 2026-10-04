'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { TrendingUp } from 'lucide-react';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/types';
import ThemeToggle from '@/components/ThemeToggle';

export default function SignIn() {
  const { t, locale, setLocale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(new URLSearchParams(window.location.search).has('error')); }, []);
  return <main className="flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
      <div className="mb-6 flex justify-end"><label className="sr-only" htmlFor="signin-language">{t('nav.language')}</label><select id="signin-language" value={locale} onChange={event => setLocale(event.target.value as Locale)} className="min-h-11 rounded-lg border border-border-subtle bg-surface px-3">{LOCALES.map(code => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}</select></div>
      <TrendingUp className="mb-4 h-8 w-8 text-primary" aria-hidden="true" />
      <h1 className="mb-3 text-2xl font-bold">{t('nav.brand')}</h1>
      <p className="mb-6 text-sm text-muted">{t('auth.access')}</p>
      {failed && <p role="alert" className="mb-4 text-sm text-foreground">{t('auth.failed')}</p>}
      <button type="button" disabled={busy} className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold disabled:opacity-50" onClick={async () => {
        setBusy(true);
        try { await signIn('google', { callbackUrl: '/' }); } catch { setFailed(true); setBusy(false); }
      }}>{busy ? t('auth.loading') : t('auth.google')}</button>
      <div className="appearance-controls mt-6"><ThemeToggle /></div>
    </div>
  </main>;
}
