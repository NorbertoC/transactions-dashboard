'use client';

import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';

export interface PeriodFilterOption {
  key: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  type: 'statement' | 'accumulative';
  monthsIncluded: number;
}

interface StatementMetadata {
  statement_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
}

function computeStatementMetadata(dateIso?: string | null): StatementMetadata {
  if (!dateIso) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  const parsedDate = new Date(`${dateIso}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  let closingYear = parsedDate.getUTCFullYear();
  let closingMonth = parsedDate.getUTCMonth();

  if (parsedDate.getUTCDate() > 26) {
    closingMonth += 1;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear += 1;
    }
  }

  const statementEnd = new Date(Date.UTC(closingYear, closingMonth, 26));

  let openingMonth = closingMonth - 1;
  let openingYear = closingYear;

  if (openingMonth < 0) {
    openingMonth = 11;
    openingYear -= 1;
  }

  const statementStart = new Date(Date.UTC(openingYear, openingMonth, 27));

  const toIso = (value: Date) => value.toISOString().split('T')[0];

  return {
    statement_id: toIso(statementEnd),
    statement_start: toIso(statementStart),
    statement_end: toIso(statementEnd)
  };
}

export function useStatementFilters(transactions: Transaction[]) {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        options: [] as PeriodFilterOption[],
        optionsMap: {} as Record<string, PeriodFilterOption>,
        defaultKey: ''
      };
    }

    const statementMap = new Map<string, { startDate: string; endDate: string; monthsIncluded: number }>();

    for (const transaction of transactions) {
      const metadata = transaction.statement_id && transaction.statement_start && transaction.statement_end
        ? {
            statement_id: transaction.statement_id,
            statement_start: transaction.statement_start,
            statement_end: transaction.statement_end
          }
        : computeStatementMetadata(transaction.date_iso);

      if (!metadata.statement_id || !metadata.statement_start || !metadata.statement_end) {
        continue;
      }

      if (!statementMap.has(metadata.statement_id)) {
        statementMap.set(metadata.statement_id, {
          startDate: metadata.statement_start,
          endDate: metadata.statement_end,
          monthsIncluded: 1
        });
      }
    }

    const statements = Array.from(statementMap.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.endDate.localeCompare(a.endDate));

    if (statements.length === 0) {
      return {
        options: [] as PeriodFilterOption[],
        optionsMap: {} as Record<string, PeriodFilterOption>,
        defaultKey: ''
      };
    }

    const latestYear = new Date(`${statements[0].endDate}T00:00:00Z`).getUTCFullYear();
    const monthFormatter = new Intl.DateTimeFormat('en-NZ', { month: 'long' });
    const monthYearFormatter = new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric' });

    const options: PeriodFilterOption[] = statements.map((statement, index) => {
      const endDate = new Date(`${statement.endDate}T00:00:00Z`);
      const endYear = endDate.getUTCFullYear();
      const monthName = monthFormatter.format(endDate);
      const labelBase = endYear === latestYear ? monthName : monthYearFormatter.format(endDate);

      return {
        key: `statement:${statement.id}`,
        label: index === 0 ? `Last Statement (${monthName})` : labelBase,
        startDate: statement.startDate,
        endDate: statement.endDate,
        type: 'statement',
        monthsIncluded: 1
      };
    });

    const accumulativeRanges = [
      { months: 3, label: 'Last 3 Months' },
      { months: 6, label: 'Last 6 Months' },
      { months: 12, label: 'Last 12 Months' }
    ];

    for (const range of accumulativeRanges) {
      if (statements.length >= range.months) {
        const startStatement = statements[range.months - 1];
        const latestStatement = statements[0];

        options.push({
          key: `accumulative:${range.months}`,
          label: range.label,
          startDate: startStatement.startDate,
          endDate: latestStatement.endDate,
          type: 'accumulative',
          monthsIncluded: range.months
        });
      }
    }

    const optionsMap = options.reduce((acc, option) => {
      acc[option.key] = option;
      return acc;
    }, {} as Record<string, PeriodFilterOption>);

    return {
      options,
      optionsMap,
      defaultKey: options[0]?.key || ''
    };
  }, [transactions]);
}
