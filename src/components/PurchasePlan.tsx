'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import { LOCALE_TAGS } from '@/i18n/types';
import { SectionSkeleton } from '@/components/LoadingState';
import NumericInput from '@/components/NumericInput';
import { formatCurrency, formatPercent } from '@/utils/format';
import { calculatePlan, planDefaults, type PlanPath, type PlanState } from './plan/model';
import type { PlanExpenseEvidence } from './plan/evidence';
import { planMessages } from './plan/messages';
import './plan/plan.css';

export default function PurchasePlan({ evidence, loading = false }: { evidence: PlanExpenseEvidence; loading?: boolean }) {
  const { locale } = useLocale(), m = planMessages[locale];
  const [state, setState] = useState<PlanState>(planDefaults);
  const [manualExpense, setManualExpense] = useState(false);
  const expenseEdited = useRef(false);
  const average = evidence.average;
  useEffect(() => {
    if (!expenseEdited.current) setState(previous => ({ ...previous, expense: average }));
  }, [average]);
  const c = calculatePlan(state);
  const money = (value: number | null) => value === null ? '—' : formatCurrency(value, locale);
  const annual = (value: number | null) => money(value === null ? null : value * 12);
  const duration = (months: number | null) => {
    if (months === 0) return m.today;
    if (months === null) return m.unreachable;
    const years = Math.floor(months / 12), remainder = months % 12;
    return [years ? `${years} ${years === 1 ? m.yearOne : m.years}` : '', remainder ? `${remainder} ${remainder === 1 ? m.monthOne : m.months}` : ''].filter(Boolean).join(' ');
  };
  const date = (value: string) => value ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '—';
  const setField = (key: keyof PlanState, value: string) => {
    if (key === 'expense') { expenseEdited.current = true; setManualExpense(true); }
    setState(previous => ({ ...previous, [key]: key === 'item' ? value : value.trim() === '' ? null : Number(value) }));
  };
  const field = (key: Exclude<keyof PlanState, 'mode'>, label: string, options: { text?: boolean; inline?: boolean; prefix?: string; suffix?: string; disabled?: boolean } = {}) => (
    <label className={`field ${options.inline ? 'inline-field' : ''}`} key={key}>
      <span>{label}</span><span className="input-shell">{options.prefix && <i>{options.prefix}</i>}
        {options.text ? <input data-field={key} aria-label={label} type="text" value={state[key] ?? ''} maxLength={45} onChange={event => setField(key, event.target.value)} /> : <NumericInput data-field={key} aria-label={label} value={state[key] as number | null}
          min={key === 'rate' ? -99.99 : 0} max={key === 'tax' ? 100 : key === 'rate' ? 1000 : undefined}
          step="0.01" disabled={options.disabled} onValueChange={value => setField(key, value === null ? '' : String(value))} />}
        {options.suffix && <i>{options.suffix}</i>}
      </span>
    </label>
  );
  const useAverage = () => { expenseEdited.current = false; setManualExpense(false); setState(previous => ({ ...previous, expense: average })); };
  const reset = () => { expenseEdited.current = false; setManualExpense(false); setState({ ...planDefaults(), expense: average }); };
  const title = (path: PlanPath) => !c.valid ? m.invalid : path.status === 'reached' ? duration(path.months) : m[path.status];
  const caption = (path: PlanPath) => !c.valid ? m[`${c.error}Error`] : path.status === 'reached' ? `${m.caption} · ${path.months}` : path.status === 'met' ? m.metCaption : path.status === 'beyond' ? m.beyondCaption : m.unreachableCaption;
  const result = (mixed: boolean) => {
    const path = mixed ? c.mixed : c.cash;
    return <article className={`result compact ${mixed ? 'result-invest' : 'result-cash'}`}>
      <div className="result-top"><span className="route-icon">{mixed ? 'B' : 'A'}</span><p>{mixed ? m.mixed : m.cash}</p><span className="route-tag">{mixed ? m.hypothesis : m.noInterest}</span></div>
      <h3>{mixed ? m.mixedTitle : m.cashTitle}</h3><strong className="result-time">{title(path)}</strong><p className="result-caption">{caption(path)}</p>
      <div className="route-detail">
        <div><span>{m.initialCapital}</span><b>{money(state.savings)}</b></div>
        <div><span>{mixed ? m.toInvest : m.toCash}</span><b>{money(state.invest)}</b></div>
        <div><span>{m.annualReturn}</span><b>{mixed ? state.rate === null ? '—' : formatPercent(state.rate / 100, locale) : formatPercent(0, locale)}</b></div>
      </div>
      <p className="result-foot">{mixed ? m.mixedFoot : m.cashFoot}{path.ending && <span className="ending-balance">{m.ending}: {money(mixed ? path.ending.investment : path.ending.cash)}</span>}</p>
    </article>;
  };
  const difference = c.valid && c.cash.status === 'reached' && c.mixed.status === 'reached' ? c.cash.months! - c.mixed.months! : null;
  const alert = !c.valid ? m[`${c.error}Error`] : c.cash.status === 'met' ? m.metAlert : c.budgetError ? c.budgetError === 'amounts' ? m.budgetIncomplete : m[`${c.budgetError}Error`] : c.surplus! < 0 ? m.deficitAlert : c.excess > 1e-7 ? m.overAlert : c.surplus === 0 ? m.zeroAlert : null;
  return <div className="purchase-plan planning design-1">
    <header className="planning-head"><div><p className="section-index">{m.kicker}</p><h1>{m.title}</h1></div><button type="button" onClick={reset}>{m.reset}</button></header>
    <section className="phrase-layout">
      <div className="phrase-editor"><p className="section-index">{m.purchase}</p>
        <div className="goal-sentence"><span>{m.want}</span>{field('item', m.item, { text: true, inline: true })}<span>{m.for}</span>{field('price', m.price, { prefix: 'NZ$', inline: true })}</div>
        <div className="phrase-budget">
          <div className="sentence-block"><p className="section-index">{m.inSection}</p><div className="sentence">{m.incomeSentence}{field('income', m.income, { prefix: 'NZ$', suffix: m.month, inline: true })}</div>
            <div className="income-meta"><span>{annual(state.income)} {m.year}</span><div className="segmented" role="group" aria-label={m.incomeMode}>{(['net', 'gross'] as const).map(mode => <button type="button" key={mode} className={state.mode === mode ? 'active' : ''} aria-pressed={state.mode === mode} onClick={() => setState(previous => ({ ...previous, mode }))}>{m[mode]}</button>)}</div></div>
            <div className="tax-line">{field('tax', m.tax, { suffix: '%', disabled: state.mode === 'net' })}<p>{state.mode === 'net' ? m.taxNet : <>{m.taxGross}: {money(c.tax)} / {money(c.net)}</>}</p></div>
          </div>
          <div className="sentence-block"><p className="section-index">{m.outSection}</p><div className="sentence">{m.expenseSentence}{field('expense', m.expense, { prefix: 'NZ$', inline: true })}</div>
            <p className="annual">{annual(state.expense)} {m.year}</p><p className="example-badge">{manualExpense ? m.manual : average === null ? loading ? m.loading : m.unavailable : m.observed}</p>
            {loading && <SectionSkeleton label={m.loading} className="plan-expense-skeleton" />}
            <p className="small-copy">{m.expenseScope}</p>
            {average !== null && <div className="plan-evidence"><p>{m.coverage}: {date(evidence.start)} — {date(evidence.end)} · {evidence.months} {m.denominator}</p>{evidence.partial && <p>{m.partial}</p>}{evidence.excluded && <p>{m.currencies}</p>}{manualExpense && <button type="button" onClick={useAverage}>{m.apply} ({money(average)})</button>}</div>}
          </div>
        </div>
        <div className="starting-savings">{field('savings', m.savings, { prefix: 'NZ$' })}<p>{m.savingsNote}</p></div>
      </div>
      <aside className="phrase-answer">
        <div className="margin"><span>{m.margin}</span><b>{money(c.surplus)}<small>{m.month}</small></b><span>{annual(c.surplus)} {m.after}</span></div>
        <p className="section-index compare-label">{m.compare}</p><div className="invest-inputs">{field('invest', m.invest, { prefix: 'NZ$' })}{field('rate', m.rate, { suffix: m.rateSuffix })}</div>
        {alert && <div className={c.valid && c.cash.status === 'met' ? 'success' : 'alert'} role={c.valid && c.cash.status === 'met' ? 'status' : 'alert'}>{alert}</div>}
        <div className="results-pair">{result(false)}{result(true)}</div>
        {difference !== null && <div className="difference"><span className="difference-symbol" aria-hidden="true">{difference > 0 ? '−' : difference < 0 ? '+' : '='}</span><div><b>{difference === 0 ? m.sameTime : `${duration(Math.abs(difference))} ${difference > 0 ? m.before : m.later}`}</b><span>{m.differenceNote}</span></div></div>}
      </aside>
    </section>
    <div className="fairness"><span className="equal-icon" aria-hidden="true">↔</span><p><b>{m.same}</b> {m.fairness}</p></div>
    <details className="assumptions"><summary><span>{m.assumptions}</span><span className="chevron" aria-hidden="true" /></summary><div className="assumption-body">{[m.assumption1, m.assumption2, m.assumption3, m.assumption4].map(text => <p key={text}>{text}</p>)}</div></details>
    <p className="plan-footer">{m.hypothetical}</p>
  </div>;
}
