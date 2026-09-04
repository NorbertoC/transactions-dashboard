import { LOCALE_TAGS, type Locale } from '@/i18n/types';

function createCurrencyFormatter(locale: Locale, whole = false): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency: 'NZD',
    ...(whole ? { maximumFractionDigits: 0 } : {})
  });
}

function createDateFormatter(locale: Locale, includeYear = false): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC'
  });
}

const currencyFormatters: Record<Locale, Intl.NumberFormat> = {
  en: createCurrencyFormatter('en'),
  ja: createCurrencyFormatter('ja'),
  es: createCurrencyFormatter('es')
};

const wholeCurrencyFormatters: Record<Locale, Intl.NumberFormat> = {
  en: createCurrencyFormatter('en', true),
  ja: createCurrencyFormatter('ja', true),
  es: createCurrencyFormatter('es', true)
};

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

export function formatCurrency(value: number, locale: Locale = 'en'): string {
  return currencyFormatters[locale].format(value);
}

export function formatCurrencyWhole(value: number, locale: Locale = 'en'): string {
  return wholeCurrencyFormatters[locale].format(value);
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
export function formatPercentChange(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) {
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (rounded === 0) {
    return '0%';
  }
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}
