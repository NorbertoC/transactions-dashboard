export type Locale = 'en' | 'ja' | 'es';

export const LOCALES: Locale[] = ['en', 'ja', 'es'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  es: 'Español'
};

export const LOCALE_STORAGE_KEY = 'gastos.locale';
