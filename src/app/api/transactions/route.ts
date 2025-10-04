import { ApiService } from '@/services/api';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const transactions = await ApiService.fetchTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}