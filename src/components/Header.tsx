'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Repeat2,
  TrendingUp,
  Upload
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/types';

interface HeaderProps {
  onUploadClick?: () => void;
}

const NAV = [
  { href: '/', key: 'nav.overview' as const, icon: LayoutDashboard },
  { href: '/month', key: 'nav.month' as const, icon: CalendarDays },
  { href: '/forecast', key: 'nav.forecast' as const, icon: TrendingUp },
  { href: '/recurring', key: 'nav.recurring' as const, icon: Repeat2 }
];

export default function Header({ onUploadClick }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/90 pt-safe shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label={t('nav.overview')}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl"
            >
              <span className="inline-flex rounded-xl bg-primary p-1.5 shadow-sm shadow-primary/20">
                <TrendingUp className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="hidden text-base font-bold min-[370px]:inline">
                {t('nav.brand')}
              </span>
            </Link>
            <nav aria-label={t('nav.brand')} className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground'
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-2">
            <div className="relative">
              <label className="sr-only" htmlFor="locale-switcher">
                {t('nav.language')}
              </label>
              <select
                id="locale-switcher"
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="min-h-11 w-[6.5rem] appearance-none rounded-xl border border-border-subtle bg-surface py-2 pl-3 pr-8 text-base font-medium text-foreground transition-colors hover:bg-surface-2 sm:w-auto sm:min-w-[7rem] lg:text-sm"
              >
                {LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_LABELS[code]}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
            </div>
            <ThemeToggle />
            {onUploadClick && (
              <button
                type="button"
                onClick={onUploadClick}
                aria-label={t('nav.upload')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-primary px-0 text-sm font-medium text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 sm:px-4"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('nav.upload')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t('nav.logout')}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
            {session?.user?.image && (
              <div
                role="img"
                aria-label="User avatar"
                className="hidden size-9 rounded-full bg-cover bg-center lg:block"
                style={{ backgroundImage: `url("${session.user.image}")` }}
              />
            )}
          </div>
        </div>
      </header>
      <nav
        aria-label={t('nav.brand')}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg gap-1">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold leading-tight transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate">{t(item.key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
