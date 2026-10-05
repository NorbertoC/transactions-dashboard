'use client';

import { useLocale } from '@/i18n/LocaleProvider';

export function SectionSkeleton({ label, className = '' }: { label: string; className?: string }) {
  return <section className={`section-skeleton ${className}`} aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true"><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-value" /><div className="skeleton-chart" /><div className="skeleton-line" /></div>
  </section>;
}

export function DataFeedback({ loading, updating, error, retry }: { loading?: boolean; updating?: boolean; error: string | null; retry: () => void }) {
  const { t } = useLocale();
  if (error) return <div className="data-feedback"><p>{t('data.failed')}</p><button type="button" onClick={retry} disabled={loading || updating}>{t('overview.retry')}</button></div>;
  if (updating) return <p className="data-feedback">{t('data.updating')}</p>;
  return null;
}

export function MetricsSkeleton() {
  const { t } = useLocale();
  return <div className="mesa-metrics">{(['mesa.income', 'mesa.expenses', 'mesa.balance', 'mesa.average'] as const).map(key => <section key={key} aria-busy="true" aria-label={t(key)}><span>{t(key)}</span><strong className="skeleton-line skeleton-metric" aria-hidden="true">&nbsp;</strong><small className="skeleton-line skeleton-metric-note" aria-hidden="true">&nbsp;</small></section>)}</div>;
}

export function DashboardSkeleton({ modules }: { modules: Record<'reading' | 'distribution' | 'index' | 'evidence', boolean> }) {
  const { t } = useLocale();
  return <div className="dashboard-skeleton">
    <SectionSkeleton label={t('mesa.monthByMonth')} className="skeleton-months" />
    <div className="mesa-board-layout"><aside><SectionSkeleton label={t('mesa.categoryAverage')} className="mesa-category-rail" /></aside><div className="mesa-board">
      {modules.reading && <SectionSkeleton label={t('mesa.reading')} className="mesa-reading" />}
      {modules.distribution && <SectionSkeleton label={t('mesa.trend')} className="mesa-bars" />}
      {modules.index && <SectionSkeleton label={t('mesa.index')} className="mesa-index" />}
      {modules.evidence && <SectionSkeleton label={t('mesa.evidence')} className="mesa-ledger" />}
    </div></div>
  </div>;
}
