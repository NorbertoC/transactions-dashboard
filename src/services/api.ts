import { Transaction } from '@/types/transaction';
import sampleData from '../../data.json';

export class ApiService {
  private static readonly API_URL = process.env.NEXT_PUBLIC_API_URL;
  private static readonly API_KEY = process.env.API_KEY;

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
      return data as Transaction[];
    } catch (error) {
      console.error('Failed to fetch transactions from API, using sample data:', error);
      return sampleData as Transaction[];
    }
  }

  static async fetchTransactionsClient(): Promise<Transaction[]> {
    try {
      const response = await fetch('/api/transactions');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Transaction[];
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return sampleData as Transaction[];
    }
  }
}