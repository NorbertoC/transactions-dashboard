import { Transaction } from '@/types/transaction';
import sampleData from '../../data.json';
import { categorizeMerchant } from '@/utils/classification';
import { normalizeCategoryPair } from '@/constants/categories';

export class ApiService {
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL;
  private static readonly API_KEY = process.env.API_KEY;
  private static readonly CAN_USE_SAMPLE_DATA = process.env.NODE_ENV !== 'production';

  private static normalizeTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.map((transaction) => {
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
        subcategory: pair.subcategory
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
      if (this.CAN_USE_SAMPLE_DATA) {
        console.warn('API credentials not found, using development sample data');
        return ApiService.normalizeTransactions(sampleData as Transaction[]);
      }
      throw new Error('Transactions API is not configured');
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
      if (this.CAN_USE_SAMPLE_DATA) {
        console.warn('Transactions API unavailable, using development sample data:', error);
        return ApiService.normalizeTransactions(sampleData as Transaction[]);
      }
      throw error;
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
      if (this.CAN_USE_SAMPLE_DATA) {
        console.warn('Transactions API unavailable, using development sample data:', error);
        return ApiService.normalizeTransactions(sampleData as Transaction[]);
      }
      throw error;
    }
  }
}
