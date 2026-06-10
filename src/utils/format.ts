const NZD = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD'
});

const NZD_WHOLE = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0
});

const SHORT_DATE = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short'
});

const FULL_DATE = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function formatCurrency(value: number): string {
  return NZD.format(value);
}

export function formatCurrencyWhole(value: number): string {
  return NZD_WHOLE.format(value);
}

/** "12 Mar" — for compact rows and chart axes. */
export function formatDateShort(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateIso : SHORT_DATE.format(date);
}

/** "12 Mar 2026" — for table rows. */
export function formatDateFull(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateIso : FULL_DATE.format(date);
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
