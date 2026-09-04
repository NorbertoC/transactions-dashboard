'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, TrendingUp, Upload } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/types';

interface HeaderProps {
  onUploadClick?: () => void;
}

const NAV = [
  { href: '/', key: 'nav.overview' as const },
  { href: '/month', key: 'nav.month' as const },
  { href: '/forecast', key: 'nav.forecast' as const },
  { href: '/recurring', key: 'nav.recurring' as const }
];

export default function Header({ onUploadClick }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/80 backdrop-blur pt-safe">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="inline-flex rounded-xl bg-primary p-1.5">
              <TrendingUp className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-base font-bold">Gastos</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <label className="sr-only" htmlFor="locale-switcher">
            {t('nav.language')}
          </label>
          <select
            id="locale-switcher"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            className="min-h-11 max-w-[7.5rem] rounded-xl border border-border-subtle bg-surface px-2 text-sm text-foreground"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
          {onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              aria-label={t('nav.upload')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 sm:px-4"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('nav.upload')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('nav.logout')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:text-foreground"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
          {session?.user?.image && (
            <div
              role="img"
              aria-label="User avatar"
              className="size-9 rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url("${session.user.image}")` }}
            />
          )}
        </div>
      </div>
      <nav
        aria-label="Mobile"
        className="flex gap-1 overflow-x-auto border-t border-border-subtle px-4 py-1.5 scrollbar-none sm:hidden"
      >
        {NAV.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-10 snap-start whitespace-nowrap rounded-full px-3 text-sm font-medium ${
                active
                  ? 'bg-primary text-white'
                  : 'text-muted'
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
