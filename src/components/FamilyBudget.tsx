'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import NumericInput from '@/components/NumericInput';
import SelectControl from '@/components/SelectControl';
import { useLocale } from '@/i18n/LocaleProvider';
import { getLocalizedCategoryName, getLocalizedSubcategoryName } from '@/constants/categories';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';
import { calculate, defaults, SCENARIOS, validDraft, type BudgetRow, type Draft, type Kind, type Result, type Scenario } from './budget/model';
import { budgetMessages } from './budget/messages';
import { forecastMessages } from './forecast/messages';
import './budget/budget.css';

type Drafts = Record<Scenario, Draft>;
const initialDrafts = (): Drafts => Object.fromEntries(SCENARIOS.map(id => [id, defaults(id)])) as Drafts;
const storageKey = (account: string) => `gastos.family-budget.v1:${account}`;
export default function FamilyBudget({ rows, known, accountScope, coverage }: { rows: BudgetRow[]; known: boolean; accountScope: string | null; coverage: ReactNode }) {
  const { locale } = useLocale(), m = budgetMessages[locale], savedMessages = forecastMessages[locale];
  const [scenario, setScenario] = useState<Scenario>('current'), [drafts, setDrafts] = useState(initialDrafts);
  const [undos, setUndos] = useState<Partial<Drafts>>({}), [status, setStatus] = useState('');
  const draft = drafts[scenario];
  const result = useMemo(() => calculate(draft, rows, known), [draft, rows, known]);
  const baseline = useMemo(() => calculate(defaults(scenario), rows, known), [scenario, rows, known]);
  const money = (n: number | null) => n === null ? '—' : formatCurrency(n, locale);
  const available = result.valid && result.known;
  const rowName = (id: string) => id === 'baby' ? m.baby : getLocalizedSubcategoryName(result.rows.find(row => row.id === id)?.name ?? id, locale);
  function edit(change: Partial<Draft>) {
    setUndos(previous => ({ ...previous, [scenario]: structuredClone(draft) }));
    setDrafts(previous => ({ ...previous, [scenario]: { ...draft, ...change } })); setStatus('');
  }
  function amount(id: string, value: number | null) {
    if (id === 'baby') edit({ baby: value, lastEdited: id });
    else edit({ amounts: { ...draft.amounts, [id]: value }, lastEdited: id });
  }
  function persist(load: boolean) {
    if (!accountScope) return;
    try {
      if (load) {
        const raw = localStorage.getItem(storageKey(accountScope));
        if (!raw) { setStatus(savedMessages.none); return; }
        const saved = JSON.parse(raw) as { version?: number; drafts?: Drafts };
        if (saved.version !== 1 || !saved.drafts || !SCENARIOS.every(id => validDraft(saved.drafts?.[id]))) throw new Error('Invalid draft');
        setUndos({ ...drafts }); setDrafts(saved.drafts); setStatus(savedMessages.loaded);
      } else {
        localStorage.setItem(storageKey(accountScope), JSON.stringify({ version: 1, drafts })); setStatus(m.saved);
      }
    } catch { setStatus(m.storageFailed); }
  }
  function card(c: Result, after: boolean) {
    const ready = c.valid && c.known;
    const parts = [[m.needs, c.needs], [m.wants, c.otherWants], [m.unknown, c.unknown], [m.savings, c.savings], [m.travelPlanned, c.travel], [m.free, c.unallocated]] as const;
    return <article className={`fb-scenario${after ? ' fb-after' : ''}`}>
      <div className="fb-card-title"><h2>{after ? m.edited : m.base}</h2><span className="fb-badge">{after ? m.editable : m.fixed}</span></div>
      <div className="fb-card-income">{c.valid ? money(c.income) : '—'}<small>{m.income}</small></div>
      <div className="fb-stack" aria-label={m.committed}>{ready && parts.map(([name, value], i) => value > 0 && <span key={name} className={`fb-part-${i}`} style={{ flexGrow: value }} title={`${name}: ${money(value)}`} />)}</div>
      <div className="fb-travel-result"><p className="fb-eyebrow">{m.travelCapacity}</p><strong>{ready ? money(c.capacity) : '—'} <small>{m.monthly}</small></strong><b>{ready ? money(c.annualCapacity) : '—'} {m.yearly}</b><p>{m.capacityNote}</p></div>
      <dl className="fb-receipt">{[[m.needs, c.needs], [m.wants, c.otherWants], [m.unknown, c.unknown], [m.travelPlanned, c.travel], [m.savings, c.savings]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{ready ? money(Number(value)) : '—'}{label === m.travelPlanned && <small>{ready ? money(c.annualTravel) : '—'} {m.yearly}</small>}</dd></div>)}<div className={`fb-receipt-total ${ready && c.gap > 0 ? 'fb-deficit' : ''}`}><dt>{ready && c.gap > 0 ? m.gap : m.free}</dt><dd>{ready ? money(c.gap || c.unallocated) : '—'}</dd></div></dl>
    </article>;
  }
  const groups = [...new Set(result.rows.map(row => row.category))];
  return <div className="family-budget">
    <header className="fb-page-head"><div><p className="fb-eyebrow">{m.eyebrow}</p><h1>{m.title}</h1><p>{m.intro}</p></div><button type="button" onClick={() => edit(defaults(scenario))}>{m.reset}</button></header>
    <div className="fb-household"><div className="fb-scenarios" role="group" aria-label={m.scenarioLabel}>{SCENARIOS.map((id, i) => <button key={id} type="button" aria-pressed={scenario === id} onClick={() => { setScenario(id); setStatus(''); }}>{m.scenarios[i]}</button>)}</div><small>{m.hypotheses}</small></div>
    <section className="fb-income" aria-label={m.income}>
      <label className="fb-income-field"><span>{m.income}</span><div className="fb-money-input"><NumericInput min="0" max="1000000" step="0.01" aria-label={m.income} value={draft.income} onValueChange={income => edit({ income, lastEdited: null })} /><span>NZD</span></div></label>
      <div className="fb-income-range"><input type="range" min="0" max={Math.max(20000, draft.income ?? 0)} step="100" aria-label={m.incomeSlider} aria-valuetext={money(draft.income)} value={draft.income ?? 0} onChange={event => edit({ income: Number(event.target.value), lastEdited: null })} /><div><span>{money(0)}</span><span>{money(Math.max(20000, draft.income ?? 0))}</span></div></div>
      <div className="fb-presets">{[1, .8, .6].map(factor => <button type="button" key={factor} onClick={() => edit({ income: defaults(scenario).income! * factor, lastEdited: null })}>{factor === 1 ? m.reference : `−${formatPercent(1 - factor, locale)}`}</button>)}</div>
      <details className="fb-income-detail"><summary>{m.incomeDetails}<ChevronDown aria-hidden="true" /></summary><p>{m.incomeNote}</p><p>{m.familyNote}</p></details>
    </section>
    <div className="fb-tools"><label><input type="checkbox" checked={draft.auto} onChange={event => edit({ auto: event.target.checked, lastEdited: null })} />{m.auto}</label><p>{m.autoNote}</p><button type="button" disabled={!undos[scenario]} onClick={() => { const undo = undos[scenario]; if (undo) { setDrafts(previous => ({ ...previous, [scenario]: undo })); setUndos(previous => ({ ...previous, [scenario]: undefined })); } }}>{m.undo}</button></div>
    <div className="fb-live" aria-live="polite">{[[m.committed, result.committed], [m.travelPlanned, result.travel], [result.gap > 0 && available ? m.gap : m.free, result.gap || result.unallocated]].map(([label, value]) => <span key={String(label)}>{label}<b>{available ? money(Number(value)) : '—'}</b></span>)}</div>
    {!result.valid ? <p className="fb-alert" role="alert">{m.invalid}</p> : !known ? <p className="fb-alert" role="status">{m.noCoverage}</p> : <p className={result.gap > 0 ? 'fb-alert fb-deficit' : 'fb-status'} role="status"><b>{result.gap > 0 ? `${m.deficit} ${money(result.gap)} ${m.monthly}.` : m.closes}</b> {m.scopeNote}</p>}
    <div className="fb-compare">{card(baseline, false)}{card(result, true)}</div>
    <div className="fb-deltas">{[[m.monthlyDelta, result.capacity - baseline.capacity], [m.annualDelta, result.annualCapacity - baseline.annualCapacity]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{available ? `${Number(value) > 0 ? '+' : ''}${money(Number(value))}` : '—'}</strong></div>)}<div><span>{m.rent}</span><strong>{available ? money(result.rent) : '—'}</strong><small>{result.rent === null ? m.noRent : m.rentNote}</small></div></div>
    {result.changes.length > 0 && <details className="fb-changes" open><summary>{m.cutTitle}<ChevronDown aria-hidden="true" /></summary><div>{result.changes.map(change => <p key={change.id}><span>{rowName(change.id)}<small>{m.cutReason}</small></span><b>{money(change.from)} → {money(change.to)}</b></p>)}<p>{m.cutNote}</p></div></details>}
    <details className="fb-categories"><summary>{m.categories}<ChevronDown aria-hidden="true" /></summary><div className="fb-details-body"><p>{m.categoryNote}</p>{groups.map(category => <details key={category} className="fb-group" open={['Basic living', 'Travel', 'family'].includes(category)}><summary><span>{category === 'family' ? m.family : getLocalizedCategoryName(category, locale)}</span><small>{known ? money(result.rows.filter(row => row.category === category).reduce((sum, row) => sum + row.proposed, 0)) : '—'} {m.monthly}</small><ChevronDown aria-hidden="true" /></summary>{result.rows.filter(row => row.category === category).map(row => <div className="fb-row" key={row.id}>
      <div className="fb-row-name"><b>{rowName(row.id)}</b><small>{row.observed ? `${m.observed} · ${formatNumber(row.count, locale)} ${m.count}` : m.babyNote}{row.protected ? ` · ${m.protected}` : ''}</small></div>
      <label className="fb-row-money"><span>{m.requested}</span><NumericInput aria-label={`${rowName(row.id)} · ${m.requested}`} min="0" max="1000000" step="0.01" value={row.id === 'baby' ? draft.baby : Object.hasOwn(draft.amounts, row.id) ? draft.amounts[row.id] : row.amount} onValueChange={value => amount(row.id, value)} /></label>
      <label className="fb-row-type"><span>{m.type}</span><SelectControl aria-label={`${rowName(row.id)} · ${m.type}`} value={row.kind} disabled={row.protected || row.travel || !row.observed} onChange={event => edit({ kinds: { ...draft.kinds, [row.id]: event.target.value as Kind }, lastEdited: null })}><option value="need">{m.need}</option><option value="want">{m.want}</option><option value="unknown">{m.review}</option></SelectControl></label>
      <div className="fb-row-range"><input type="range" min="0" max={Math.max(row.id === 'rent' || row.travel ? 6000 : 2500, row.amount)} step="10" aria-label={`${rowName(row.id)} · ${m.editable}`} aria-valuetext={money(row.amount)} value={row.amount} onChange={event => amount(row.id, Number(event.target.value))} /><small>{m.proposed}: {result.valid ? money(row.proposed) : '—'}</small></div>
    </div>)}</details>)}<section className="fb-savings"><label><b>{m.savings}</b><NumericInput min="0" max="1000000" step="0.01" aria-label={m.savings} value={draft.savings} onValueChange={savings => edit({ savings, lastEdited: null })} /></label><input type="range" min="0" max={Math.max(5000, draft.savings ?? 0)} step="50" value={draft.savings ?? 0} aria-label={`${m.savings} · ${m.editable}`} aria-valuetext={money(draft.savings)} onChange={event => edit({ savings: Number(event.target.value), lastEdited: null })} /><p>{m.savingsNote}</p></section></div></details>
    <section className="fb-guide"><h2>{m.guide}</h2><p>{m.guideNote}</p><div>{[[m.needs, result.needsGuide], [m.wants, result.wantsGuide], [m.savings, result.savingsGuide]].map(([label, value]) => <p key={String(label)}><span>{label}</span><b>{result.valid ? money(Number(value)) : '—'}</b></p>)}</div><p>{m.rentGuide}: <b>{available ? money(result.rentMax) : '—'}</b></p></section>
    <div className="fb-review"><span>{m.expenses} {available ? money(result.spending) : '—'} + {m.savings} {available ? money(result.savings) : '—'}</span><b>{available ? result.gap > 0 ? `${m.gap}: ${money(result.gap)}` : `+ ${m.free} ${money(result.unallocated)} = ${money(result.income)}` : '—'}</b></div>
    <p className="fb-note">{m.unknownNote} {m.annualNote}</p>
    <details className="fb-source"><summary>{m.source}<ChevronDown aria-hidden="true" /></summary><div className="fb-details-body">{coverage}<p>{m.incomeNote}</p><p>{m.savingsNote}</p><p>{m.babyNote}</p><p>{m.capacityNote} {m.scopeNote}</p></div></details>
    <div className="fb-draft-tools"><button type="button" disabled={!accountScope} onClick={() => persist(false)}>{savedMessages.save}</button><button type="button" disabled={!accountScope} onClick={() => persist(true)}>{savedMessages.load}</button></div><p className="fb-note" role="status">{status}</p>
  </div>;
}
