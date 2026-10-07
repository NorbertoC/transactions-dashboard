import { LOCALE_TAGS, type Locale } from '@/i18n/types';

const numberFormatters = new Map<string, Intl.NumberFormat>();
function formatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify([locale, options]);
  let value = numberFormatters.get(key);
  if (!value) { value = new Intl.NumberFormat(LOCALE_TAGS[locale], options); numberFormatters.set(key, value); }
  return value;
}
function currencyFormat(value: number, locale: Locale, currency: string, whole: boolean): string {
  if (!Number.isFinite(value)) return '—';
  const code = currency === 'NZ$' ? 'NZD' : currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return `${currency} ${whole ? formatter(locale, { maximumFractionDigits: 0 }).format(value) : formatNumber(value, locale)}`;
  const digits = whole ? 0 : Math.min(2, formatter(locale, { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2);
  return formatter(locale, { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function createDateFormatter(locale: Locale, includeYear = false): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC'
  });
}

const shortDateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: createDateFormatter('en'),
  ja: createDateFormatter('ja'),
  es: createDateFormatter('es')
};

const fullDateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: createDateFormatter('en', true),
  ja: createDateFormatter('ja', true),
  es: createDateFormatter('es', true)
};

function parseIsoDate(dateIso: string): Date | null {
  const date = new Date(`${dateIso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(value: number, locale: Locale = 'en'): string {
  return Number.isFinite(value) ? formatter(locale, { maximumFractionDigits: 2 }).format(value) : '—';
}
export function formatPercent(value: number, locale: Locale = 'en'): string {
  return Number.isFinite(value) ? formatter(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value) : '—';
}
export function formatCurrency(value: number, locale: Locale = 'en', currency = 'NZD'): string {
  return currencyFormat(value, locale, currency, false);
}
export function formatCurrencyWhole(value: number, locale: Locale = 'en', currency = 'NZD'): string {
  return currencyFormat(value, locale, currency, true);
}
export function formatCompactCurrency(value: number, locale: Locale = 'en', currency = 'NZD'): string {
  if (!Number.isFinite(value)) return '—';
  const code = currency === 'NZ$' ? 'NZD' : currency.toUpperCase();
  const options: Intl.NumberFormatOptions = { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 2 };
  return /^[A-Z]{3}$/.test(code) ? formatter(locale, { ...options, style: 'currency', currency: code }).format(value) : `${currency} ${formatter(locale, options).format(value)}`;
}
export function formatInputNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '' : formatter('en', { useGrouping: false, maximumFractionDigits: 2 }).format(value);
}

/** "12 Mar" — for compact rows and chart axes. */
export function formatDateShort(dateIso: string, locale: Locale = 'en'): string {
  const date = parseIsoDate(dateIso);
  return date ? shortDateFormatters[locale].format(date) : dateIso;
}

/** "12 Mar 2026" — for table rows. */
export function formatDateFull(dateIso: string, locale: Locale = 'en'): string {
  const date = parseIsoDate(dateIso);
  return date ? fullDateFormatters[locale].format(date) : dateIso;
}

/** Signed percentage like "+12%" / "−8%"; null when there is no baseline. */
export function formatPercentChange(current: number, previous: number | null, locale: Locale = 'en'): string | null {
  if (previous === null || previous === 0) {
    return null;
  }
  const change = (current - previous) / previous;
  return formatter(locale, { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(change);
}
