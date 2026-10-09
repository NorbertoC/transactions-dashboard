'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import type { ReactNode } from 'react';

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
  return <div className="mesa-metrics">{(['mesa.income', 'mesa.expenses', 'mesa.balance', 'mesa.average'] as const).map(key => <section key={key} aria-busy={!unavailable} aria-label={t(key)}><span>{t(key)}</span>{unavailable ? <strong>—</strong> : <><strong className="skeleton-line skeleton-metric" aria-hidden="true">&nbsp;</strong><small className="skeleton-metric-notes" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-line" key={index} />)}</small></>}</section>)}</div>;
}

export function DashboardSkeleton({ modules, unavailable = false }: { unavailable?: boolean; modules: Record<'reading' | 'distribution' | 'index' | 'evidence', boolean> }) {
  const { t } = useLocale();
  const line = (className = '') => <span className={`skeleton-line ${className}`} />;
  const rows = (count: number, render: (index: number) => ReactNode) => Array.from({ length: count }, (_, index) => <div key={index}>{render(index)}</div>);
  const placeholder = (label: string, className: string, children: ReactNode) => unavailable
    ? <SectionUnavailable label={label} className={className} />
    : <section className={`mesa-placeholder ${className}`} aria-label={label} aria-busy="true"><span className="sr-only">{label}</span><div aria-hidden="true">{children}</div></section>;
  return <div className={unavailable ? "dashboard-unavailable" : "dashboard-skeleton"}>
    <div className="mesa-board-layout"><aside>{placeholder(t('mesa.categoryAverage'), 'mesa-panel mesa-category-rail', <><h2>{t('mesa.categoryAverage')}</h2>{line('skeleton-note')}<div className="mesa-rail-placeholder">{rows(9, () => <>{line('skeleton-label')}{line('skeleton-amount')}</>)}</div></>)}</aside><div className="mesa-board">
      <div className="mesa-detail-panel"><div className="mesa-detail-content">
      {modules.reading && placeholder(t('mesa.reading'), 'mesa-reading', <div className="mesa-reading-header"><div className="mesa-reading-intro">{line('skeleton-eyebrow')}{line('skeleton-title')}{line('skeleton-meaning')}{line('skeleton-note')}{line('skeleton-note')}{line('skeleton-note')}</div><div className="mesa-reading-metrics">{rows(2, () => <>{line('skeleton-note')}{line('skeleton-value')}{line('skeleton-note')}</>)}</div></div>)}
      {modules.distribution && <div className="mesa-detail-charts">
        {placeholder(t('mesa.distribution'), 'mesa-average-bars', <>{line('skeleton-title')}{line('skeleton-note')}<div className="mesa-average-placeholder">{rows(8, () => <>{line('skeleton-label')}{line('skeleton-amount')}{line('skeleton-track')}</>)}</div>{line('skeleton-note')}</>)}
        {placeholder(t('mesa.trend'), 'mesa-bars', <>{line('skeleton-eyebrow')}{line('skeleton-title')}{line('skeleton-note')}<div className="mesa-chart mesa-chart-placeholder">{rows(9, index => <><span className="skeleton-line skeleton-bar" style={{ height: `${45 + index % 4 * 25}px` }} />{line('skeleton-note')}</>)}</div>{line('skeleton-note')}{line('skeleton-note')}{line('skeleton-note')}</>)}
      </div>}
      {!unavailable && modules.reading && <div className="mesa-reading-method" aria-hidden="true">{line('mesa-reading-basis skeleton-note')}{line('skeleton-note')}</div>}
      {!modules.reading && !modules.distribution && <p className="mesa-micro">{t('mesa.visibilityNote')}</p>}
      </div></div>
    </div></div>
    {!unavailable && <div className="mesa-scope mesa-scope-placeholder" aria-hidden="true">{line('skeleton-label')}{line('skeleton-note')}</div>}
    <MetricsSkeleton unavailable={unavailable} />
    {placeholder(t('mesa.monthByMonth'), 'mesa-months', <><div className="mesa-section-heading"><div>{line('skeleton-eyebrow')}{line('skeleton-title')}</div></div><div className="mesa-month-strip">{rows(4, () => <div className="mesa-month-card">{line('skeleton-label')}{line('skeleton-value')}{line('skeleton-note')}</div>)}</div>{line('skeleton-note')}</>)}
    {modules.distribution && placeholder(t('mesa.distribution'), 'mesa-global-distribution', line('skeleton-label'))}
    {modules.index && placeholder(t('mesa.index'), 'mesa-panel mesa-wide mesa-index', <>{line('skeleton-title')}{line('skeleton-note')}<div className="mesa-index-head" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <span key={index}>{line('skeleton-note')}</span>)}</div><div className="mesa-index-placeholder">{rows(8, () => <>{line('skeleton-label')}{line('skeleton-amount')}{line('skeleton-spark')}{line('skeleton-amount')}</>)}</div></>)}
    {modules.evidence && placeholder(t('mesa.evidence'), 'mesa-panel mesa-wide mesa-ledger', <><div className="mesa-movement-placeholder">{line()}{line()}{line()}</div>{line('skeleton-title')}<div className="mesa-search">{line('skeleton-input')}</div><div className="mesa-ledger-placeholder">{rows(5, () => <>{line('skeleton-note')}{line('skeleton-label')}{line('skeleton-amount')}</>)}</div>{line('skeleton-note')}</>)}
    {placeholder(t('mesa.methodology'), 'mesa-methodology', <>{line('skeleton-title')}{line('skeleton-note')}{line('skeleton-note')}</>)}
  </div>;
}
