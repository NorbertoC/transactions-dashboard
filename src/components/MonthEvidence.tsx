'use client';

import { Lightbulb } from 'lucide-react';
import { useLocale } from '@/i18n/LocaleProvider';
import { getLocalizedCategoryName } from '@/constants/categories';
import { monthEvidence } from '@/utils/month-evidence';
import { formatCurrency, formatDateShort } from '@/utils/format';
import type { Transaction } from '@/types/transaction';

export default function MonthEvidence({ transactions, start, end }: { transactions: Transaction[]; start: string; end: string }) {
  const { t, locale } = useLocale();
  const data = monthEvidence(transactions, start, end, new Date().toLocaleDateString('en-CA'));
  const money = (value: number) => formatCurrency(value, locale);
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const insights = data.rows.length ? [
    t('month.nonRentTotal', { amount: money(data.total), count: data.rows.length }),
    data.topCategory && t('month.nonRentCategory', { category: getLocalizedCategoryName(data.topCategory[0], locale), amount: money(data.topCategory[1]), share: percent(data.total ? data.topCategory[1] / data.total : 0) }),
    data.topMerchant && t('month.nonRentMerchant', { place: data.topMerchant[0], amount: money(data.topMerchant[1]) }),
    t('month.nonRentLargest', { place: data.top[0].place, amount: money(data.top[0].value), date: formatDateShort(data.top[0].date_iso, locale) }),
    t('month.transactionAverage', { amount: money(data.average) }),
    t('month.topTenShare', { count: data.top.length, amount: money(data.topTenTotal), share: percent(data.total ? data.topTenTotal / data.total : 0) }),
    t('month.recordedDays', { count: data.activeDays, days: data.days }),
    data.previousTotal !== null && t('month.previousRecorded', { start: data.previousStart, end: data.previousEnd, amount: money(data.previousTotal) }),
    t(data.partial ? 'month.partialEvidence' : 'month.evidenceCoverage')
  ].filter((value): value is string => Boolean(value)) : [t('month.noNonRent')];
  return <div className="month-evidence-grid">
    <section className="month-evidence-card">
      <h2>{t('month.topTen')}</h2><p className="mesa-micro">{t('month.nonRentRanking')}</p>
      <div className="month-evidence-scroll" tabIndex={0} role="region" aria-label={t('month.topTen')}>
        {!data.top.length ? <p className="text-sm text-muted">{t('month.noNonRent')}</p> : <ol className="month-top-list">{data.top.map((row, index) => <li key={row.id}>
          <span className="month-rank">{index + 1}</span><div className="min-w-0"><p className="month-place" title={row.place}>{row.place}</p><small>{getLocalizedCategoryName(row.category, locale)} · {formatDateShort(row.date_iso, locale)}</small></div><strong>{money(row.value)}</strong>
        </li>)}</ol>}
      </div><p className="mesa-micro">{t('month.scrollTen')}</p>
    </section>
    <section className="month-evidence-card">
      <h2><Lightbulb aria-hidden="true" />{t('month.insights')}</h2><p className="mesa-micro">{t('month.nonRentInsights')}</p>
      <div className="month-evidence-scroll" tabIndex={0} role="region" aria-label={t('month.insights')}><ul className="month-insight-list">{insights.map((insight, index) => <li key={index}>{insight}</li>)}</ul></div><p className="mesa-micro">{t('month.insightsBasis')}</p>
    </section>
  </div>;
}
