'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import PurchasePlan from '@/components/PurchasePlan';
import { DataFeedback } from '@/components/LoadingState';
import { useTransactions } from '@/hooks/useTransactions';
import { planExpenseEvidence } from '@/components/plan/evidence';

export default function PlanPage() {
  const resource = useTransactions('all');
  const { data: session } = useSession();
  const evidence = useMemo(() => planExpenseEvidence(resource.transactions, new Date().toISOString().slice(0, 10)), [resource.transactions]);
  const accountScope = JSON.stringify([session?.user.id ?? null, session?.user.email ?? null]);
  return <AuthGuard><Header /><main className="plan-main">
    <DataFeedback loading={resource.loading} updating={resource.updating} slow={resource.slow} error={resource.error} retry={resource.refetch} />
    <PurchasePlan key={accountScope} evidence={evidence} loading={resource.loading} />
  </main></AuthGuard>;
}
