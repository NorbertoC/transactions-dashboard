import { Transaction } from '@/types/transaction';
import { categorizeMerchant } from '@/utils/classification';
import { normalizeCategoryPair } from '@/constants/categories';

import { checkSessionResponse, getClientSessionGeneration, HttpError } from '@/utils/client-session';

export type RecordScope = 'expense' | 'income' | 'transfer' | 'all';
export class IncomeCapabilityUnavailable extends Error {}

export class ApiService {
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL;
  private static readonly API_KEY = process.env.API_KEY;

  private static normalizeTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.map((transaction) => {
      if (transaction.record_type === 'income' || transaction.record_type === 'transfer') return transaction;
      // Legacy pairs (Dining, Shopping, …) are remapped on the fly so the UI
      // always shows the canonical taxonomy even before the DB migration runs.
      // Stored categories — including an explicit 'Others / Miscellaneous' —
      // are preserved; the classifier only fills genuinely missing ones.
      const storedCategory = (transaction.category ?? '').trim();
      const pair = storedCategory
        ? normalizeCategoryPair(storedCategory, transaction.subcategory)
        : categorizeMerchant(transaction.place || '');

      const normalized: Transaction = {
        ...transaction,
        category: pair.category,
        subcategory: storedCategory && !transaction.subcategory?.trim() ? '' : pair.subcategory
      };

      if (!normalized.statement_id || !normalized.statement_start || !normalized.statement_end) {
        const metadata = ApiService.computeStatementMetadata(normalized.date_iso);
        normalized.statement_id = metadata.statement_id;
        normalized.statement_start = metadata.statement_start;
        normalized.statement_end = metadata.statement_end;
      }

      return normalized;
    });
  }

  private static computeStatementMetadata(dateIso?: string | null) {
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

  static async fetchTransactions(scope: RecordScope = 'expense'): Promise<Transaction[]> {
    if (!this.API_URL || !this.API_KEY) {
      throw new Error('Transaction API is not configured');
    }
    const url = new URL(this.API_URL);
    url.searchParams.set('record_type', scope);
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-API-Key': this.API_KEY, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return ApiService.normalizeTransactions(await response.json() as Transaction[]);
  }

  static async fetchTransactionsClient(scope: RecordScope = 'expense', signal?: AbortSignal): Promise<Transaction[]> {
    const generation = getClientSessionGeneration();
    const response = await fetch(`/api/transactions?record_type=${scope}`, { cache: 'no-store', signal });
    signal?.throwIfAborted();
    checkSessionResponse(response, generation);
    if (!response.ok) throw new HttpError(response.status, `HTTP error! status: ${response.status}`);
    const rows: Transaction[] = await response.json();
    if (scope === 'all' && (!Array.isArray(rows) || rows.some(row =>
      !['income', 'expense', 'transfer'].includes(row.record_type ?? '') || !['inflow', 'outflow'].includes(row.direction ?? '') ||
      row.record_type === 'income' && row.direction !== 'inflow' || row.record_type === 'expense' && row.direction !== 'outflow'
    ))) throw new IncomeCapabilityUnavailable();
    return ApiService.normalizeTransactions(rows);
  }
}
