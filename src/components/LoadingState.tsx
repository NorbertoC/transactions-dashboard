'use client';

import { useLocale } from '@/i18n/LocaleProvider';

export function SectionSkeleton({ label, className = '' }: { label: string; className?: string }) {
  return <section className={`section-skeleton ${className}`} aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true"><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-value" /><div className="skeleton-chart" /><div className="skeleton-line" /></div>
  </section>;
}

export function DataFeedback({ loading, updating, slow, error, retry }: { loading?: boolean; updating?: boolean; slow?: boolean; error: string | null; retry: () => void }) {
  const { t } = useLocale();
  if (error) return <div className="data-feedback"><p>{t('data.failed')}</p><button type="button" onClick={retry} disabled={loading || updating}>{t('overview.retry')}</button></div>;
  if (slow) return <div className="data-feedback"><p>{t('data.slow')}</p><button type="button" onClick={retry}>{t('overview.retry')}</button></div>;
  if (updating) return <p className="data-feedback">{t('data.updating')}</p>;
  return null;
}

export function SectionUnavailable({ label, className = '' }: { label: string; className?: string }) {
  const { t } = useLocale();
  return <section className={`section-unavailable ${className}`} aria-label={label}><h2>{label}</h2><p>{t('data.failed')}</p></section>;
}

export function MetricsSkeleton({ unavailable = false }: { unavailable?: boolean }) {
  const { t } = useLocale();
  return <div className="mesa-metrics">{(['mesa.income', 'mesa.expenses', 'mesa.balance', 'mesa.average'] as const).map(key => <section key={key} aria-busy={!unavailable} aria-label={t(key)}><span>{t(key)}</span>{unavailable ? <strong>—</strong> : <><strong className="skeleton-line skeleton-metric" aria-hidden="true">&nbsp;</strong><small className="skeleton-line skeleton-metric-note" aria-hidden="true">&nbsp;</small></>}</section>)}</div>;
}

export function DashboardSkeleton({ modules, unavailable = false }: { unavailable?: boolean; modules: Record<'reading' | 'distribution' | 'index' | 'evidence', boolean> }) {
  const { t } = useLocale();
  const Placeholder = unavailable ? SectionUnavailable : SectionSkeleton;
  return <div className={unavailable ? "dashboard-unavailable" : "dashboard-skeleton"}>
    <Placeholder label={t('mesa.monthByMonth')} className="skeleton-months" />
    <div className="mesa-board-layout"><aside><Placeholder label={t('mesa.categoryAverage')} className="mesa-category-rail" /></aside><div className="mesa-board">
      <div className="mesa-detail-panel"><div className="mesa-detail-content">
      {modules.reading && <Placeholder label={t('mesa.reading')} className="mesa-reading" />}
      {modules.distribution && <Placeholder label={t('mesa.trend')} className="mesa-bars" />}
      </div></div>
      {modules.index && <Placeholder label={t('mesa.index')} className="mesa-index" />}
      {modules.evidence && <Placeholder label={t('mesa.evidence')} className="mesa-ledger" />}
    </div></div>
  </div>;
}
