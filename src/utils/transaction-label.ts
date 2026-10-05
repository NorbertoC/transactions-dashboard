import type { Transaction } from '@/types/transaction';

export function transactionLabel(transaction: Transaction): string {
  return transaction.record_type === 'income'
    ? transaction.income_source?.trim() || transaction.place
    : transaction.place;
}
