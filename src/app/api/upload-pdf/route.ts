import { NextRequest, NextResponse } from 'next/server';

interface Transaction {
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
}

// Category detection based on merchant name
function detectCategory(place: string): string {
  const placeLower = place.toLowerCase();

  // Transport
  if (placeLower.includes('public transport') ||
      placeLower.includes('uber') ||
      placeLower.includes('lime')) {
    return 'transport';
  }

  // Groceries
  if (placeLower.includes('woolworths') ||
      placeLower.includes('pak n save') ||
      placeLower.includes('new world') ||
      placeLower.includes('countdown')) {
    return 'groceries';
  }

  // Alcohol
  if (placeLower.includes('liquorland') ||
      placeLower.includes('super liquor')) {
    return 'alcohol';
  }

  // Clothing
  if (placeLower.includes('adidas') ||
      placeLower.includes('hallenstein') ||
      placeLower.includes('puma') ||
      placeLower.includes('seed heritage')) {
    return 'clothing';
  }

  // Electronics/Home
  if (placeLower.includes('jb hi fi') ||
      placeLower.includes('briscoe')) {
    return 'electronics';
  }

  // Pharmacy
  if (placeLower.includes('chemist') ||
      placeLower.includes('pharmacy')) {
    return 'pharmacy';
  }

  // Subscriptions
  if (placeLower.includes('paypal') ||
      placeLower.includes('openai') ||
      placeLower.includes('claude') ||
      placeLower.includes('cursor') ||
      placeLower.includes('expressvpn') ||
      placeLower.includes('apple.com') ||
      placeLower.includes('cloudflare') ||
      placeLower.includes('twitch')) {
    return 'subscriptions';
  }

  // Home improvement
  if (placeLower.includes('bunnings')) {
    return 'home_improvement';
  }

  // Hotel
  if (placeLower.includes('hotel')) {
    return 'hotel';
  }

  // Tea
  if (placeLower.includes('t2 ')) {
    return 'tea';
  }

  return 'other';
}

// Parse date from DD.MM.YY format to YYYY-MM-DD
function parseDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  const fullYear = `20${year}`; // Assumes 2000s
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Extract transactions from PDF text
function extractTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  // Pattern: DD.MM.YY DESCRIPTION AMOUNT (with optional commas in amount)
  // Handles amounts like "80.95" or "2,426.09"
  const transactionPattern = /^(\d{2}\.\d{2}\.\d{2})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+CR)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(transactionPattern);

    if (match) {
      const [, dateStr, description, amountStr] = match;

      // Skip payment credits (we only want debits for this case)
      if (description.includes('PAYMENT - THANK YOU')) {
        continue;
      }

      // Remove commas from amount string
      const cleanAmount = amountStr.replace(/,/g, '');
      const value = parseFloat(cleanAmount);
      const date_iso = parseDate(dateStr);
      const place = description.trim();
      const category = detectCategory(place);

      transactions.push({
        place,
        amount: `$${value.toFixed(2)}`,
        date: date_iso,
        currency: 'NZD',
        value,
        date_iso,
        category
      });
    }
  }

  return transactions;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const saveToDb = formData.get('saveToDb') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse PDF using require (CommonJS) for compatibility
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    const text = data.text;

    // Extract transactions
    const transactions = extractTransactions(text);

    // Optionally save to database/API
    if (saveToDb) {
      // TODO: Implement database save logic here
      // This would depend on your database setup
      // Example: await saveTransactionsToDb(transactions);
      console.log('Saving transactions to database...');
    }

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
      rawText: text // Include raw text for debugging if needed
    });

  } catch (error) {
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
