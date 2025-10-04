import { Transaction } from '@/types/transaction';
import sampleData from '../../data.json';

export class ApiService {
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL;
  private static readonly API_KEY = process.env.API_KEY;

  private static normalizeTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.map((transaction) => {
      const normalized: Transaction = {
        ...transaction,
        category: transaction.category || 'Other',
        subcategory: transaction.subcategory || 'General'
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

  static async fetchTransactions(): Promise<Transaction[]> {
    if (!this.API_URL || !this.API_KEY) {
      console.warn('API credentials not found, using sample data');
      return sampleData as Transaction[];
    }

    try {
      const response = await fetch(this.API_URL, {
        headers: {
          'X-API-Key': this.API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return ApiService.normalizeTransactions(data as Transaction[]);
    } catch (error) {
      console.error('Failed to fetch transactions from API, using sample data:', error);
      return ApiService.normalizeTransactions(sampleData as Transaction[]);
    }
  }

  static async fetchTransactionsClient(): Promise<Transaction[]> {
    try {
      const response = await fetch('/api/transactions');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return ApiService.normalizeTransactions(data as Transaction[]);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return ApiService.normalizeTransactions(sampleData as Transaction[]);
    }
  }
}
