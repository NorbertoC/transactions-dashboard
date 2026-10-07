'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import FamilyBudget from '@/components/FamilyBudget';
import { DataFeedback, SectionSkeleton, SectionUnavailable } from '@/components/LoadingState';
import { useTransactions } from '@/hooks/useTransactions';
import { useIncomeSummary } from '@/hooks/useIncomeSummary';
import { useLocale } from '@/i18n/LocaleProvider';
import { combineIncomeSummaries } from '@/utils/income';
import { formatCurrency, formatDateFull, formatNumber } from '@/utils/format';
import { budgetEvidence } from '@/components/budget/model';
import { budgetMessages } from '@/components/budget/messages';
import { householdIncomeEvidence, incomeWindow } from '@/components/budget/income';

function ForecastView() {
  const { data: session, status } = useSession();
  const accountScope = status === 'authenticated' && session?.user.authorized === true ? JSON.stringify([session.user.id, session.user.email]) : null;
  const { locale, t } = useLocale(), m = budgetMessages[locale];
  const resource = useTransactions('all');
  const today = new Date().toISOString().slice(0, 10);
  const evidence = useMemo(() => budgetEvidence(resource.transactions, today), [resource.transactions, today]);
  const householdWindow = incomeWindow(today);
  const householdPending = householdIncomeEvidence(resource.transactions, today, null);
  const householdResponse = useIncomeSummary(householdWindow?.start ?? '', householdWindow?.end ?? '', householdWindow?.years ?? [], resource.incomeAvailable && !resource.loading && !resource.error, householdPending.allCents);
  const householdSummary = householdResponse.summaries ? combineIncomeSummaries(householdResponse.summaries, 'NZD') : null;
  const householdEvidence = householdIncomeEvidence(resource.transactions, today, householdSummary, !resource.loading && !resource.error && !householdResponse.loading && !householdResponse.error && resource.incomeAvailable);
  const incomeResponse = useIncomeSummary(evidence.start, evidence.end, evidence.years, resource.incomeAvailable && !resource.loading && !resource.error && evidence.known, evidence.incomeCents);
  const summary = incomeResponse.summaries ? combineIncomeSummaries(incomeResponse.summaries, 'NZD') : null;
  const matchingIncome = !resource.error && !incomeResponse.error && summary?.complete && summary.denominator === evidence.data.denominator && summary.cents === evidence.incomeCents ? summary.average : null;
  const known = !resource.loading && !resource.error && evidence.known;
  const coverage = <>
    <p>{known ? `${m.coverage}: ${formatDateFull(evidence.start, locale)} – ${formatDateFull(evidence.end, locale)} · ${formatNumber(evidence.data.denominator, locale)} ${m.calendarMonths}` : m.noCoverage}</p>
    <p>{m.expensePeriodNote}</p>
    {known && <p>{m.observed}: <b>{formatCurrency(evidence.total!, locale)}</b> {m.monthly}. {m.scopeNote}</p>}
    {known && evidence.partial && <p>{m.partial}</p>}
    {evidence.excluded && <p>{m.foreign}</p>}
    <p>{m.receipts}: <b>{matchingIncome === null ? '—' : formatCurrency(matchingIncome, locale)}</b></p>
    <p>{matchingIncome === null ? m.receiptsUnknown : m.receiptsNote}</p>
    <DataFeedback loading={incomeResponse.loading} updating={incomeResponse.updating} slow={incomeResponse.slow} error={incomeResponse.error} retry={incomeResponse.retry} />
  </>;
  return <div className="min-h-screen bg-background text-foreground"><Header /><main className="px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
    <DataFeedback loading={resource.loading} updating={resource.updating} slow={resource.slow} error={resource.error} retry={resource.refetch} />
    <DataFeedback loading={householdResponse.loading} updating={householdResponse.updating} slow={householdResponse.slow} error={householdResponse.error} retry={householdResponse.retry} />
    {resource.loading ? <SectionSkeleton label={t('forecast.loading')} /> : resource.error ? <SectionUnavailable label={m.observed} /> : null}
    <FamilyBudget key={accountScope ?? 'signed-out'} accountScope={accountScope} rows={evidence.rows} known={known} coverage={coverage} incomeEvidence={householdEvidence} />
  </main></div>;
}
export default function ForecastPage() { return <AuthGuard><ForecastView /></AuthGuard>; }
