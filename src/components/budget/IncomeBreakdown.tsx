import { useLocale } from '@/i18n/LocaleProvider';
import { formatCurrency, formatDateFull, formatNumber } from '@/utils/format';
import { budgetMessages } from './messages';
import { disposableIncome, type HouseholdIncomeEvidence } from './income';
import type { Scenario } from './model';
import { ChevronDown } from 'lucide-react';

export default function IncomeBreakdown({ evidence, scenario }: { evidence: HouseholdIncomeEvidence | null; scenario: Scenario }) {
  const { locale } = useLocale(), m = budgetMessages[locale];
  const value = disposableIncome(evidence, scenario);
  const money = (amount: number | null) => amount === null ? '—' : formatCurrency(amount, locale);
  return <section className="fb-income" aria-label={m.income}>
    <label className="fb-income-field"><span>{m.income}</span><div className="fb-money-input"><input type="text" readOnly aria-label={m.income} aria-describedby="income-basis income-reserves" value={value.income === null ? '—' : formatNumber(value.income, locale)} /><span>NZD</span></div><small>{m.calculated}</small></label>
    <div className="fb-income-breakdown" aria-label={m.incomeCalculation}>
      <p className="fb-income-equation"><span>{money(value.receipts)}<small>{m.receiptBasis}</small></span><b aria-hidden="true">−</b><span>{money(value.tax)}<small>{m.taxReserve}</small></span><b aria-hidden="true">−</b><span>{money(value.acc)}<small>{m.accReserve}</small></span><b aria-hidden="true">=</b><strong>{money(value.income)}<small>{m.income}</small></strong></p>
      <p id="income-basis">{scenario === 'current' ? m.bothIncomeBasis : m.retainedIncomeBasis} {evidence?.window ? `${formatDateFull(evidence.window.start, locale)} – ${formatDateFull(evidence.window.end, locale)} · ${m.sixMonths}` : m.incomeUnavailable}</p>
      {!evidence?.complete && <p className="fb-income-unavailable" role="status">{m.incomeUnavailable}</p>}
      <p id="income-reserves">{m.reserveNote} {m.annualReserves}: {money(value.annualTax)} {m.taxReserve} + {money(value.annualAcc)} ACC. {m.roundingNote}</p>
    </div>
    <details className="fb-income-detail"><summary>{m.incomeDetails}<ChevronDown aria-hidden="true" /></summary><p>{m.incomeNote}</p><p>{m.familyNote}</p></details>
  </section>;
}
