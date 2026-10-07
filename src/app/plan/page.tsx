'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import PurchasePlan from '@/components/PurchasePlan';
import { DataFeedback } from '@/components/LoadingState';
import { useTransactions } from '@/hooks/useTransactions';
import { planExpenseEvidence } from '@/components/plan/evidence';
import { useIncomeSummary } from '@/hooks/useIncomeSummary';
import { combineIncomeSummaries } from '@/utils/income';
import { householdIncomeEvidence, incomeWindow } from '@/components/budget/income';

export default function PlanPage() {
  const resource = useTransactions('all');
  const { data: session } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const evidence = useMemo(() => planExpenseEvidence(resource.transactions, today), [resource.transactions, today]);
  const window = incomeWindow(today);
  const pending = householdIncomeEvidence(resource.transactions, today, null);
  const incomeResponse = useIncomeSummary(window?.start ?? '', window?.end ?? '', window?.years ?? [], resource.incomeAvailable && !resource.loading && !resource.error, pending.allCents);
  const summary = incomeResponse.summaries ? combineIncomeSummaries(incomeResponse.summaries, 'NZD') : null;
  const incomeEvidence = householdIncomeEvidence(resource.transactions, today, summary, !resource.loading && !resource.error && !incomeResponse.loading && !incomeResponse.error && resource.incomeAvailable);
  const accountScope = JSON.stringify([session?.user.id ?? null, session?.user.email ?? null]);
  return <AuthGuard><Header /><main className="plan-main">
    <DataFeedback loading={resource.loading} updating={resource.updating} slow={resource.slow} error={resource.error} retry={resource.refetch} />
    <DataFeedback loading={incomeResponse.loading} updating={incomeResponse.updating} slow={incomeResponse.slow} error={incomeResponse.error} retry={incomeResponse.retry} />
    <PurchasePlan key={accountScope} evidence={resource.error ? { ...evidence, average: null } : evidence} loading={resource.loading} incomeEvidence={incomeEvidence} incomeLoading={resource.loading || incomeResponse.loading} />
  </main></AuthGuard>;
}
