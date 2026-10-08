'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { formatCurrency, formatPercent } from '@/utils/format';

interface Props {
  rows: { name: string; label: string; total: number }[];
  total: number;
  currency: string;
  selected: string | null;
  onSelect: (category: string) => void;
}

export default function MesaCategoryDistribution({ rows, total, currency, selected, onSelect }: Props) {
  const { locale, t } = useLocale();
  return <section className="mesa-category-distribution" aria-label={t('charts.categories')}>
    <div className="mesa-panel-title"><div><h2>{t('charts.categories')}</h2><p className="mesa-micro">{t('mesa.fullPeriod')} · {formatCurrency(total, locale, currency)}</p></div></div>
    {total > 0 ? <>
      <div className="mesa-distribution-stack" role="img" aria-label={rows.map(row => `${row.label}: ${formatPercent(row.total / total, locale)}`).join(' · ')}>
        {rows.map((row, index) => row.total > 0 ? <span key={row.name} data-tone={index % 7} style={{ width: `${row.total / total * 100}%` }} aria-hidden="true" /> : null)}
      </div>
      <div className="mesa-distribution-legend">{rows.map((row, index) => <button key={row.name} type="button" data-tone={index % 7} aria-pressed={selected === row.name} onClick={() => onSelect(row.name)}>
        <span className="mesa-distribution-label"><i aria-hidden="true" />{row.label}</span><strong>{formatPercent(row.total / total, locale)}</strong>
      </button>)}</div>
      <p className="mesa-micro">{t('charts.categoriesHelp')}</p>
    </> : <p className="mesa-micro">{t('charts.noSpending')}</p>}
  </section>;
}
