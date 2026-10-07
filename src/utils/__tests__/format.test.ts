import { expect, it } from 'vitest';
import { formatCurrency, formatCompactCurrency, formatInputNumber, formatNumber, formatPercent, formatPercentChange } from '../format';
it.each(['en', 'es', 'ja'] as const)('caps displayed money, numbers and percentages at two decimals in %s', locale => {
  const value = 1234.56789;
  expect(formatCurrency(value, locale)).toBe(new Intl.NumberFormat({ en: 'en-NZ', es: 'es-AR', ja: 'ja-JP' }[locale], { style: 'currency', currency: 'NZD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value));
  expect(formatNumber(value, locale)).toMatch(locale === 'es' ? /1.234,57/ : /1,234.57/);
  expect(formatPercent(.1234567, locale)).toContain(locale === 'es' ? '12,35' : '12.35');
  expect(formatPercentChange(123.4567, 100, locale)).toContain(locale === 'es' ? '23,46' : '23.46');
});
it('respects currency identity, zero-decimal currencies, and caps three-decimal currencies', () => {
  expect(formatCurrency(1234.567, 'ja', 'JPY')).toBe('￥1,235');
  expect(formatCurrency(1.2345, 'en', 'KWD')).toContain('1.23');
  expect(formatCurrency(1.2345, 'en', 'custom')).toBe('custom 1.23');
  expect(formatCompactCurrency(1234567, 'en', 'USD')).toContain('1.23');
});
it('formats input presentation and unavailable amounts without changing values', () => {
  const value = 5840.800041; expect(formatInputNumber(value)).toBe('5840.8'); expect(value).toBe(5840.800041);
  expect(formatInputNumber(null)).toBe(''); expect(formatCurrency(Infinity)).toBe('—'); expect(formatNumber(NaN)).toBe('—');
});
