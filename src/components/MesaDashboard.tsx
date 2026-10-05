'use client';

import { isIsoDate } from '@/lib/api-validation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import CategoryComparison from '@/components/charts/CategoryComparison';
import TransactionsTable from '@/components/TransactionsTable';
import { useLocale } from '@/i18n/LocaleProvider';
import { useStatementFilters } from '@/hooks/useStatementFilters';
import { getLocalizedCategoryName } from '@/constants/categories';
import { buildDashboard, calendarMonths, currencyCode, monthEnd } from '@/utils/dashboard';
import { categoryReading } from '@/utils/category-reading';
import type { Transaction } from '@/types/transaction';
import type { MessageKey } from '@/i18n/messages';
import { useIncomeSummary } from '@/hooks/useIncomeSummary';
import { combineIncomeSummaries } from '@/utils/income';

const MODULES = ['reading', 'distribution', 'index', 'evidence'] as const;
type Module = typeof MODULES[number];
const ALL_MODULES: Record<Module, boolean> = { reading: true, distribution: true, index: true, evidence: true };
const LOCALE_TAGS = { en: 'en-NZ', es: 'es', ja: 'ja-JP' };

import { DashboardSkeleton, MetricsSkeleton, DataFeedback } from '@/components/LoadingState';

interface Props {
  transactions: Transaction[];
  loading?: boolean;
  incomeAvailable?: boolean;
  onTransactionUpdated: (transaction: Transaction) => void;
  onTransactionDeleted: (id: number) => void;
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return <svg viewBox="0 0 240 62" className="mesa-spark" role="img" aria-label={label}>
    <path d="M2 59H238" stroke="currentColor" opacity=".12" />
    <polyline points={values.map((v, i) => `${values.length === 1 ? 120 : 3 + i * 234 / (values.length - 1)},${54 - (v - min) / range * 46}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    {values.length === 1 && <circle cx="120" cy={54 - (values[0] - min) / range * 46} r="3" fill="currentColor" />}
  </svg>;
}

export default function MesaDashboard({ transactions, loading = false, incomeAvailable = false, onTransactionUpdated, onTransactionDeleted }: Props) {
  const { locale, t } = useLocale();
  const dates = useMemo(() => transactions.map(tx => tx.date_iso).filter(isIsoDate).sort(), [transactions]);
  const today = new Date().toLocaleDateString('en-CA');
  const availableMonths = useMemo(() => calendarMonths(dates[0] ?? '', dates.at(-1) ?? ''), [dates]);
  const availableYears = useMemo(() => [...new Set(availableMonths.map(key => key.slice(0, 4)))], [availableMonths]);
  const [yearSelection, setYearSelection] = useState<'all' | string[] | null>(null);
  const selectedYears = useMemo(() => yearSelection === 'all' ? availableYears : yearSelection ? yearSelection.filter(year => availableYears.includes(year)) : [availableYears.includes(today.slice(0, 4)) ? today.slice(0, 4) : availableYears.at(-1) ?? ''].filter(Boolean), [yearSelection, availableYears, today]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gastos.mesa.years.v1') ?? 'null');
      if (saved?.version === 1 && (saved.selection === 'all' || Array.isArray(saved.selection) && saved.selection.every((year: unknown) => typeof year === 'string' && /^\d{4}$/.test(year)))) setYearSelection(saved.selection);
    } catch { /* The current year remains the default when preferences are unavailable. */ }
  }, []);
  const currencies = [...new Set(transactions.map(tx => currencyCode(tx.currency)))].sort();
  const [mode, setMode] = useState<'calendar' | 'statement'>('calendar');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeRent, setIncludeRent] = useState(true);
  const [includePartial, setIncludePartial] = useState(false);
  const [selectedCurrency, setCurrency] = useState('');
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ledgerType, setLedgerType] = useState<'all' | 'expense' | 'income'>('all');
  const [modules, setModules] = useState(ALL_MODULES);
  const [resetVersion, setResetVersion] = useState(0);
  const [comparisonOpen, setComparisonOpen] = useState<string | null>(null);
  const [comparisonSubcategory, setComparisonSubcategory] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState<string | null>(null);
  const { options, defaultKey } = useStatementFilters(transactions);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies.includes('NZD') ? 'NZD' : currencies[0] ?? 'NZD';
  const currentMonth = today.slice(0, 7);
  const selectableMonths = availableMonths.filter(key => selectedYears.includes(key.slice(0, 4)) && (includePartial || key < currentMonth));
  const firstMonth = selectableMonths.includes(from) ? from : selectableMonths[0] ?? '';
  const lastMonth = selectableMonths.includes(to) && to >= firstMonth ? to : selectableMonths.at(-1) ?? '';
  const statementOptions = options.filter(option => option.type === 'statement' && calendarMonths(option.startDate ?? '', option.endDate ?? '').some(key => selectedYears.includes(key.slice(0, 4))));
  const currentStatement = statementOptions.find(option => option.key === statement) ?? statementOptions.find(option => option.key === defaultKey) ?? statementOptions[0];
  const start = mode === 'statement' ? currentStatement?.startDate ?? '' : firstMonth ? `${firstMonth}-01` : '';
  const end = mode === 'statement' ? currentStatement?.endDate ?? '' : lastMonth ? monthEnd(lastMonth) : '';
  const data = useMemo(() => buildDashboard(transactions, start, end, includeRent, currency, today, selectedYears), [transactions, start, end, includeRent, currency, today, selectedYears]);
  const incomeCents = data.income.reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const incomeResponse = useIncomeSummary(start, end, selectedYears, incomeAvailable && !loading, incomeCents);
  const incomeSummary = incomeResponse.summaries ? combineIncomeSummaries(incomeResponse.summaries, currency) : null;
  const incomeKnown = incomeSummary !== null && incomeSummary.denominator > 0 && incomeSummary.cents === incomeCents;
  const outflowCents = data.records.filter(row => !row.record_type || row.record_type === 'expense').reduce((sum, row) => sum + Math.round(row.value * 100), 0);
  const recordedNet = incomeKnown ? (incomeSummary.cents - outflowCents) / 100 : null;
  const activeCategory = data.categories.some(row => row.name === category) ? category : null;
  const activeMonth = data.monthly.some(row => row.key === month) ? month : null;
  const detail = activeCategory ? data.categories.find(row => row.name === activeCategory)! : null;
  const graphReading = categoryReading(detail?.records ?? data.expenses, data.monthly);
  const reading = detail ? categoryReading(detail.records, data.monthly) : null;
  const detailRows = (detail?.records ?? data.records).filter(row => ledgerType === 'all' || (row.record_type ?? 'expense') === ledgerType);
  const detailMonthly = data.monthly.map((row, i) => ({ ...row, total: detail?.monthly[i] ?? row.total }));
  const money = (value: number) => {
    if (/^[A-Z]{3}$/.test(currency)) return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return `${currency} ${new Intl.NumberFormat(LOCALE_TAGS[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  };
  const monthLabel = (key: string, short = false) => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: short ? 'short' : 'long', year: short ? start.slice(0, 4) !== end.slice(0, 4) ? '2-digit' : undefined : 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  const dateLabel = (date: string) => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const categoryLabel = activeCategory ? getLocalizedCategoryName(activeCategory, locale) : t('mesa.allExpenses');
  const periodLabel = mode === 'statement' ? `${start} – ${end}` : firstMonth && lastMonth ? `${monthLabel(firstMonth)} – ${monthLabel(lastMonth)}` : '—';
  const resetDetail = () => { setCategory(null); setMonth(null); setSearch(''); setLedgerType('all'); setResetVersion(version => version + 1); };
  const resetPeriodDetail = () => { resetDetail(); setIndexOpen(null); setComparisonOpen(null); setComparisonSubcategory(null); };
  const chooseYears = (selection: 'all' | string[]) => {
    setYearSelection(selection); setFrom(''); setTo(''); setStatement(''); resetPeriodDetail();
    try { localStorage.setItem('gastos.mesa.years.v1', JSON.stringify({ version: 1, selection })); } catch { /* Filtering remains usable without storage. */ }
  };
  const top = data.categories[0];
  const maxBar = Math.max(...detailMonthly.map(row => row.total), 1);
  const metricLabels: MessageKey[] = ['mesa.income', 'mesa.expenses', 'mesa.balance', 'mesa.average'];

  const percent = (value: number) => new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const changeAmount = (value: number) => `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
  const graphNarrative = <div className="mesa-graph-narrative">
    {graphReading.peaks.length ? <p className="mesa-narrative">{t('reading.pattern', { months: graphReading.peaks.slice(0, 3).map(row => `${monthLabel(row.key)}${row.partial ? ' *' : ''}`).join(', '), amount: money(graphReading.peaks[0].total) })}{graphReading.peaks.length > 3 && ` ${t('reading.morePeaks', { count: graphReading.peaks.length - 3 })}`}{graphReading.peaks.length === 1 && graphReading.peakShare !== null && ` ${t('reading.concentration', { share: percent(graphReading.peakShare) })}`}</p> : <p className="mesa-narrative">{t('reading.noRecords')}</p>}
    {graphReading.latestChange && <p className="mesa-narrative">{t(graphReading.latestChange.difference > 0 ? 'reading.increase' : graphReading.latestChange.difference < 0 ? 'reading.decrease' : 'reading.unchanged', { from: monthLabel(graphReading.latestChange.from), to: monthLabel(graphReading.latestChange.to), amount: money(Math.abs(graphReading.latestChange.difference)) })}</p>}
    {graphReading.topMerchant && <p className="mesa-micro">{t('reading.merchant', { month: monthLabel(graphReading.topMerchant.month), place: graphReading.topMerchant.place, amount: money(graphReading.topMerchant.total) })}</p>}
    <p className="mesa-micro">{t('categoryReading.coverage')}</p>
    {graphReading.partial && <p className="mesa-micro">{t('categoryReading.partial')}</p>}
  </div>;

  return <div className="mesa-dashboard">
    <section className="mesa-global-controls" aria-label={t('period.filterAria')}>
      <label className="mesa-field">{t('mesa.mode')}<span className="mesa-select"><select value={mode} onChange={event => { setMode(event.target.value as 'calendar' | 'statement'); resetPeriodDetail(); }}>
        <option value="calendar">{t('mesa.calendarMode')}</option><option value="statement">{t('mesa.statementMode')}</option>
      </select><ChevronDown aria-hidden="true" /></span></label>
      {mode === 'calendar' ? <>
        <label className="mesa-field">{t('mesa.from')}<span className="mesa-select"><select value={firstMonth} disabled={!selectableMonths.length} onChange={event => { setFrom(event.target.value); if (event.target.value > lastMonth) setTo(event.target.value); resetPeriodDetail(); }}>
          {selectableMonths.map(key => <option key={key} value={key}>{monthLabel(key)}</option>)}
        </select><ChevronDown aria-hidden="true" /></span></label>
        <label className="mesa-field">{t('mesa.to')}<span className="mesa-select"><select value={lastMonth} disabled={!selectableMonths.length} onChange={event => { setTo(event.target.value); resetPeriodDetail(); }}>
          {selectableMonths.filter(key => key >= firstMonth).map(key => <option key={key} value={key}>{monthLabel(key)}</option>)}
        </select><ChevronDown aria-hidden="true" /></span></label>
      </> : <label className="mesa-field">{t('month.pickPeriod')}<span className="mesa-select"><select value={currentStatement?.key ?? ''} onChange={event => { setStatement(event.target.value); resetPeriodDetail(); }}>
        {statementOptions.map(option => <option key={option.key} value={option.key}>{option.startDate} – {option.endDate}</option>)}
      </select><ChevronDown aria-hidden="true" /></span></label>}
      {currencies.length > 1 && <label className="mesa-field">{t('mesa.currency')}<span className="mesa-select"><select value={currency} onChange={event => { setCurrency(event.target.value); resetPeriodDetail(); }}>{currencies.map(value => <option key={value}>{value}</option>)}</select><ChevronDown aria-hidden="true" /></span></label>}
      <div className="mesa-period-options"><label className="mesa-checkbox"><input type="checkbox" checked={includeRent} onChange={event => { setIncludeRent(event.target.checked); resetPeriodDetail(); }} />{t('mesa.rent')}</label>
      {mode === 'calendar' && <label className="mesa-checkbox"><input type="checkbox" checked={includePartial} onChange={event => { setIncludePartial(event.target.checked); resetPeriodDetail(); }} />{t('mesa.partial')}</label>}</div>
      <p className="mesa-micro mesa-coverage">{loading ? t('overview.loading') : <>{t(mode === 'calendar' ? 'mesa.calendar' : 'mesa.statement')}. {t('mesa.coverage', { count: data.denominator })}</>}</p>
    </section>
    <div className="mesa-appbar"><h1>{t('mesa.title')}</h1><span>{t('mesa.yearScope', { years: selectedYears.join(', ') || '—' })} · {periodLabel} · {currency}</span></div>
    <div className="mesa-workspace">
      <DataFeedback loading={incomeResponse.loading} updating={incomeResponse.updating} error={incomeResponse.error} retry={incomeResponse.retry} />
      {loading ? <MetricsSkeleton /> : <div className="mesa-metrics" data-testid="summary">
        {metricLabels.map((label, i) => <div key={label}><span>{t(label)}</span><strong>{i === 1 ? money(data.total) : i === 3 ? data.denominator ? money(data.average) : '—' : i === 0 ? incomeKnown ? money(incomeSummary!.total) : '—' : recordedNet !== null ? money(recordedNet) : '—'}</strong><small>{i === 0 ? t(incomeKnown ? 'income.basis' : 'income.unavailable') : i === 2 ? t('mesa.balanceNote') : i === 3 ? t('mesa.denominator', { currency, count: data.denominator }) : t('mesa.fullPeriod')}</small></div>)}
      </div>}
      <fieldset className="mesa-visibility"><legend>{t('mesa.organize')}</legend>
        <div className="mesa-years" role="group" aria-label={t('mesa.years')}><strong>{t('mesa.years')}</strong>
          <label className="mesa-checkbox"><input type="checkbox" disabled={loading || !availableYears.length} checked={availableYears.length > 0 && selectedYears.length === availableYears.length} onChange={event => chooseYears(event.target.checked ? 'all' : [])} />{t('mesa.allYears')}</label>
          {availableYears.map(year => <label key={year} className="mesa-checkbox"><input type="checkbox" checked={selectedYears.includes(year)} onChange={event => chooseYears(event.target.checked ? [...selectedYears, year].sort() : selectedYears.filter(value => value !== year))} />{year}</label>)}
          <p className="mesa-micro">{t('mesa.yearsHint')}</p>{!loading && !selectedYears.length && <p className="mesa-micro" role="status">{t('mesa.noYears')}</p>}
        </div>
        {MODULES.map(key => <label key={key} className="mesa-checkbox"><input type="checkbox" checked={modules[key]} onChange={event => setModules(previous => ({ ...previous, [key]: event.target.checked }))} />{t(`mesa.${key}`)}</label>)}
        <button type="button" onClick={() => setModules(ALL_MODULES)}>{t('mesa.showAll')}</button><p className="mesa-micro">{t('mesa.visibilityNote')}</p>
      </fieldset>
      {loading ? <DashboardSkeleton modules={modules} /> : <>
      <section className="mesa-months"><div className="mesa-section-heading"><div><p className="mesa-eyebrow">{t('mesa.monthByMonth')}</p><h2>{categoryLabel}</h2></div><button type="button" aria-pressed={!activeMonth} onClick={() => setMonth(null)}>{t('mesa.fullPeriod')}</button></div>
        <div className="mesa-month-strip">{!data.denominator && <p className="mesa-micro">{t('mesa.noMonths')}</p>}{[...detailMonthly].reverse().map(row => <button type="button" className="mesa-month-card" key={row.key} aria-pressed={activeMonth === row.key} onClick={() => setMonth(activeMonth === row.key ? null : row.key)}><span>{monthLabel(row.key)}</span><strong>{money(row.total)}</strong><small>{t('mesa.monthExpense')}{row.partial && ` · ${t('mesa.partialLabel')}`}</small></button>)}</div>
        <p className="mesa-micro">{t('mesa.monthNote')}</p>
      </section>
      <div className="mesa-board-layout"><aside>
        <section className="mesa-panel mesa-category-rail"><h2>{t('mesa.categoryAverage')}</h2><p className="mesa-micro">{t('mesa.denominator', { currency, count: data.denominator })}</p>
          <button type="button" aria-pressed={!activeCategory} onClick={() => setCategory(null)}><span>{t('mesa.allExpenses')}</span><strong>{data.denominator ? money(data.average) : '—'}</strong></button>
          {data.categories.map(row => <button type="button" key={row.name} aria-pressed={activeCategory === row.name} onClick={() => setCategory(row.name)}><span>{getLocalizedCategoryName(row.name, locale)}</span><strong>{money(row.average)}</strong></button>)}
        </section>
        <div className="mesa-scope"><span>{t('mesa.detail')}: <strong>{categoryLabel}</strong> · <strong>{activeMonth ? monthLabel(activeMonth) : t('mesa.fullPeriod')}</strong></span><button type="button" onClick={resetDetail}>{t('mesa.reset')}</button><p>{t('mesa.scope')}</p></div>
      </aside><div className="mesa-board">
        {modules.reading && <section className="mesa-reading" aria-live="polite">{reading ? <>
          <p className="mesa-eyebrow">{t('mesa.periodReading')} · {categoryLabel}</p>
          <h2><span>{money(reading.total)}</span><em>{t('categoryReading.recordedSpending')}</em></h2>
          {graphNarrative}
          <div className="mesa-reading-foot"><div><strong>{reading.average === null ? '—' : money(reading.average)}</strong><small>{t('mesa.perMonth')}</small></div><div><strong>{data.total > 0 ? new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'percent', maximumFractionDigits: 1 }).format(reading.total / data.total) : '—'}</strong><small>{t('categoryReading.share')}</small></div></div>
        </> : <><p className="mesa-eyebrow">{t('mesa.periodReading')}</p><h2><span>{recordedNet !== null ? money(recordedNet) : '—'}</span><em>{t('income.afterOutflows')}</em></h2>{graphNarrative}<p className="mesa-micro">{t(incomeKnown ? 'income.basis' : incomeResponse.loading ? 'income.loading' : 'income.unavailable')}</p>{incomeSummary && <details className="mesa-income-context"><summary>{t('reading.incomeContext')}</summary>{incomeSummary.windows.map(window => <p className="mesa-micro" key={window.start}>{window.start} – {window.end}: {window.coverage.filter(range => range.start <= window.end && range.end >= window.start).map(range => t('income.coverage', { start: range.start, end: range.end })).join(' ') || t('income.unavailable')}</p>)}{incomeKnown && <><p className="mesa-micro">{t('income.average', { amount: money(incomeSummary.average!), count: incomeSummary.denominator })}</p><p className="mesa-micro">{t('income.denominators', { expenses: data.denominator, income: incomeSummary.denominator })}</p>{!incomeSummary.complete && <p className="mesa-micro">{t('income.partialCoverage')}</p>}</>}</details>}<p className="mesa-micro">{t(includeRent ? 'mesa.rentIncluded' : 'mesa.rentExcluded')}</p><div className="mesa-reading-foot"><div><strong>{top ? money(top.average) : '—'}</strong><small>{top ? getLocalizedCategoryName(top.name, locale) : t('mesa.category')} · {t('mesa.perMonth')}</small></div><div><strong>{incomeKnown && incomeSummary!.total > 0 ? new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'percent', maximumFractionDigits: 1 }).format(data.total / incomeSummary!.total) : '—'}</strong><small>{t('mesa.ratio')}</small></div></div></>}</section>}
        {modules.distribution && <section className="mesa-panel mesa-bars"><div className="mesa-panel-title"><div><h2>{categoryLabel}</h2><p className="mesa-micro">{currency} · {t('mesa.barsHint')}</p></div><div><strong>{data.denominator ? money(detail?.average ?? data.average) : '—'}</strong><small>{t('mesa.perMonth')}</small></div></div><div className={`mesa-chart ${detailMonthly.length > 12 ? 'mesa-chart-many' : ''}`}>{detailMonthly.map(row => <button type="button" key={row.key} aria-pressed={activeMonth === row.key} aria-label={`${monthLabel(row.key)} · ${money(row.total)}${row.partial ? ` · ${t('mesa.partialLabel')}` : ''}`} onClick={() => setMonth(activeMonth === row.key ? null : row.key)}><b title={money(row.total)}>{new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 0, notation: row.total >= 10000 ? 'compact' : 'standard' }).format(row.total)}</b><span style={{ height: `${row.total / maxBar * 135 + 4}px` }} /><small><span>{new Intl.DateTimeFormat(LOCALE_TAGS[locale], { month: 'short', timeZone: 'UTC' }).format(new Date(`${row.key}-01T00:00:00Z`))}{row.partial && '*'}</span>{start.slice(0, 4) !== end.slice(0, 4) && <span>{row.key.slice(2, 4)}</span>}</small></button>)}</div><p className="mesa-micro">{t('mesa.partialNote')}</p><details className="mesa-month-breakdown" key={`${activeCategory ?? 'all'}-${start}-${end}-${selectedYears.join(',')}-${includeRent}-${currency}`}><summary>{t('reading.monthlyDetail')}</summary><p className="mesa-micro">{t('reading.changeBasis')}</p><dl>{graphReading.monthly.map(row => { const change = graphReading.changes.find(change => change.to === row.key); return <div key={row.key}><dt>{monthLabel(row.key)}{row.partial ? ' *' : ''}</dt><dd><strong>{row.count ? money(row.total) : t('reading.noRecordsShort')}</strong>{change && <small>{t('reading.changeFrom', { month: monthLabel(change.from), amount: changeAmount(change.difference) })}</small>}</dd></div>; })}</dl></details></section>}
        {modules.index && <section className="mesa-panel mesa-wide mesa-index"><h2>{t('mesa.indexTitle')}</h2><p className="mesa-micro">{t('mesa.indexHint')} {t('mesa.denominator', { currency, count: data.denominator })}</p><div className="mesa-index-head"><span>{t('mesa.category')}</span><span>{t('mesa.average')}</span><span>{t('mesa.trend')}</span><span>{t('mesa.periodTotal')}</span></div>
          {data.categories.map(row => <Fragment key={row.name}><button type="button" className="mesa-index-row" aria-expanded={indexOpen === row.name} onClick={() => setIndexOpen(indexOpen === row.name ? null : row.name)}><span><ChevronDown aria-hidden="true" className={indexOpen === row.name ? 'mesa-open' : ''} />{getLocalizedCategoryName(row.name, locale)}</span><strong>{money(row.average)}</strong><Sparkline values={row.monthly} label={`${getLocalizedCategoryName(row.name, locale)} · ${t('mesa.trend')} · ${row.monthly.map(money).join(', ')}`} /><strong>{money(row.total)}</strong></button>
            {indexOpen === row.name && <div className="mesa-index-detail"><div className="mesa-detail-heading"><strong>{getLocalizedCategoryName(row.name, locale)} · {t('mesa.fullPeriod')}</strong><span>{t(row.records.length === 1 ? 'mesa.record' : 'mesa.records', { count: row.records.length })} · {money(row.total)}</span></div><button type="button" aria-expanded={comparisonOpen === row.name} onClick={() => { setComparisonOpen(comparisonOpen === row.name ? null : row.name); setComparisonSubcategory(null); }}>{t(comparisonOpen === row.name ? 'comparison.hide' : 'comparison.show')}</button>{comparisonOpen === row.name && <div className="mesa-comparison"><CategoryComparison transactions={data.expenses} category={row.name} currency={currency} subcategory={comparisonSubcategory} onSubcategoryChange={setComparisonSubcategory} /><p className="mesa-micro">{t('mesa.comparisonNote')}</p></div>}<div className="mesa-index-scroll"><table><thead><tr><th>{t('table.date')}</th><th>{t('mesa.concept')}</th><th>{currency}</th></tr></thead><tbody>{[...row.records].sort((a, b) => b.date_iso.localeCompare(a.date_iso)).map(tx => <tr key={tx.id}><td>{dateLabel(tx.date_iso)}</td><td>{tx.place}<small>{getLocalizedCategoryName(tx.category, locale)}</small></td><td>{money(tx.value)}</td></tr>)}</tbody></table></div><p className="mesa-micro">{t('mesa.indexNote')}</p></div>}
          </Fragment>)}
        </section>}
        {modules.evidence && <section className="mesa-panel mesa-wide mesa-ledger"><div className="mesa-movement-filter" role="group" aria-label={t('income.movements')}>{(['all', 'expense', 'income'] as const).map(type => <button type="button" key={type} aria-pressed={ledgerType === type} onClick={() => { setLedgerType(type); setCategory(null); setResetVersion(version => version + 1); }}>{t(`income.${type}`)}</button>)}</div>{!incomeAvailable && <p className="mesa-micro">{t('income.unavailable')}</p>}<TransactionsTable movementTypes={incomeAvailable} key={resetVersion} transactions={detailRows.filter(tx => !activeMonth || tx.date_iso.startsWith(activeMonth))} onTransactionUpdated={onTransactionUpdated} onTransactionDeleted={onTransactionDeleted} searchQuery={search} onSearchChange={setSearch} scopeLabel={`${activeCategory ? categoryLabel : t(`income.${ledgerType}`)} · ${activeMonth ? monthLabel(activeMonth) : t('mesa.fullPeriod')}`} currency={currency} />{activeMonth && <button type="button" onClick={() => setMonth(null)}>{t('mesa.fullPeriod')}</button>}<p className="mesa-micro">{t('mesa.ledgerNote')}</p></section>}
        {MODULES.every(key => !modules[key]) && <section className="mesa-panel mesa-wide"><h2>{t('mesa.emptyBoard')}</h2><p>{t('mesa.emptyBoardHint')}</p><button type="button" onClick={() => setModules(ALL_MODULES)}>{t('mesa.showAll')}</button></section>}
      </div></div>
      {!transactions.length && <p className="mesa-panel">{t('mesa.noData')}</p>}
      <section className="mesa-methodology"><h2>{t('mesa.methodology')}</h2><p>{t(incomeAvailable ? 'income.directions' : 'mesa.directionNote')}</p><p><strong>{t('mesa.outflow')}: {money(data.outflow)}</strong> · {t('mesa.expenses')}: {money(data.total)} · {t('mesa.savings')}: {money(data.savings)}</p>{data.unsupported > 0 && <p>{t('mesa.unsupported', { count: data.unsupported })}</p>}</section>
      </>}
    </div>
  </div>;
}
