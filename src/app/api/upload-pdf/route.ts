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

interface PdfItem {
  text?: string;
  y?: number;
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
      placeLower.includes('countdown') ||
      placeLower.includes('farro fresh')) {
    return 'groceries';
  }

  // Alcohol
  if (placeLower.includes('liquorland') ||
      placeLower.includes('super liquor') ||
      placeLower.includes('liquor')) {
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

  // Travel
  if (placeLower.includes('air new zealand') ||
      placeLower.includes('jetstar')) {
    return 'travel';
  }

  // Entertainment
  if (placeLower.includes('event cinema')) {
    return 'entertainment';
  }

  // Retail/Department stores
  if (placeLower.includes('kmart') ||
      placeLower.includes('warehouse') ||
      placeLower.includes('briscoe')) {
    return 'retail';
  }

  return 'other';
}

// Parse date from DD.MM.YY format to YYYY-MM-DD
function parseDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  const fullYear = `20${year}`; // Assumes 2000s
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Extract transactions from PDF text (American Express format)
function extractTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  // Pattern for transaction lines: DD . MM . YY DESCRIPTION
  const transactionPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+)$/;

  // Pattern for standalone amount lines
  const amountPattern = /^([\d,]+\.\d{2})$/;

  // Collect amounts and transactions with their line numbers
  const amounts: Array<{value: number, index: number}> = [];
  const transactionLines: Array<{date: string, description: string, index: number}> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for amounts
    const amountMatch = line.match(amountPattern);
    if (amountMatch && !line.includes('CR') && !line.includes('DOLLAR') && !line.includes('%')) {
      const cleanAmount = amountMatch[1].replace(/,/g, '');
      const value = parseFloat(cleanAmount);

      // Check if next line is "CR" (credit) - skip those
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const isCreditAmount = nextLine === 'CR';

      // Filter out unrealistic amounts and credit amounts
      if (value > 0 && value < 10000 && !isCreditAmount) {
        amounts.push({ value, index: i });
      }
    }

    // Check for transactions
    const transMatch = line.match(transactionPattern);
    if (transMatch) {
      const [, day, month, year, description] = transMatch;
      const dateStr = `${day}.${month}.${year}`;

      // Skip payments and summary lines
      if (description.includes('PAYMENT - THANK YOU') ||
          description.includes('Total of New Transactions')) {
        continue;
      }

      transactionLines.push({
        date: dateStr,
        description: description.trim(),
        index: i
      });
    }
  }

  // Match amounts to transactions sequentially
  // When amounts appear before transactions, match them in order
  let amountIndex = 0;

  for (const trans of transactionLines) {
    // Find the next unused amount that appears before this transaction
    let matchedAmount = null;

    for (let i = amountIndex; i < amounts.length; i++) {
      const amt = amounts[i];
      const distance = trans.index - amt.index;

      // Amount should be before transaction (positive distance) and within reasonable range
      if (distance > 0 && distance < 100) {
        matchedAmount = amt;
        amountIndex = i + 1; // Move to next amount for next transaction
        break;
      }
    }

    if (matchedAmount) {
      const date_iso = parseDate(trans.date);
      const place = trans.description;
      const category = detectCategory(place);

      transactions.push({
        place,
        amount: `$${matchedAmount.value.toFixed(2)}`,
        date: date_iso,
        currency: 'NZD',
        value: matchedAmount.value,
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
    const _saveToDb = formData.get('saveToDb') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse PDF using pdfreader (simple Node.js library)
    const { PdfReader } = await import('pdfreader');

    const text = await new Promise<string>((resolve, reject) => {
      let fullText = '';
      let currentLine = '';
      let lastY = 0;

      new PdfReader({}).parseBuffer(buffer, (err: Error | null, item?: PdfItem) => {
        if (err) {
          reject(err);
        } else if (!item) {
          // End of file
          if (currentLine) fullText += currentLine + '\n';
          resolve(fullText);
        } else if (item.text) {
          // New line detection based on Y position
          if (lastY !== item.y && currentLine) {
            fullText += currentLine + '\n';
            currentLine = '';
          }
          currentLine += item.text + ' ';
          lastY = item.y;
        }
      });
    });

    // Log the extracted text for debugging
    console.log('=== PDF Text Extracted ===');
    console.log('First 500 characters:', text.substring(0, 500));
    console.log('Total length:', text.length);

    // Extract transactions
    const transactions = extractTransactions(text);
    console.log('Transactions extracted:', transactions.length);

    if (transactions.length === 0) {
      console.log('No transactions found. Showing more lines:');
      text.split('\n').slice(0, 100).forEach((line, i) => {
        if (line.trim()) console.log(`Line ${i}:`, line);
      });
    } else {
      console.log('=== Transactions JSON ===');
      console.log(JSON.stringify(transactions, null, 2));
    }

    // Save transactions to backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/transactions', '') || 'http://localhost:3000';
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    try {
      // First, fetch existing transactions to check for duplicates
      const existingResponse = await fetch(process.env.NEXT_PUBLIC_API_URL || `${apiUrl}/transactions`, {
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!existingResponse.ok) {
        throw new Error('Failed to fetch existing transactions');
      }

      const existingTransactions = await existingResponse.json();

      // Filter out duplicates based on date, place, and amount
      const newTransactions = transactions.filter(newTx => {
        const isDuplicate = existingTransactions.some((existingTx: Transaction) =>
          existingTx.date_iso === newTx.date_iso &&
          existingTx.place.trim() === newTx.place.trim() &&
          Math.abs(existingTx.value - newTx.value) < 0.01 // Handle floating point comparison
        );
        return !isDuplicate;
      });

      const duplicateCount = transactions.length - newTransactions.length;

      console.log(`Total transactions: ${transactions.length}`);
      console.log(`Duplicates found: ${duplicateCount}`);
      console.log(`New transactions: ${newTransactions.length}`);

      if (newTransactions.length === 0) {
        return NextResponse.json({
          success: true,
          transactions: [],
          count: 0,
          duplicateCount,
          saved: false,
          message: 'All transactions are duplicates. No new transactions to save.'
        });
      }

      // Send only new transactions to backend API
      const response = await fetch(`${apiUrl}/transactions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(newTransactions)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save transactions to database');
      }

      const saveResult = await response.json();
      console.log('Transactions saved:', saveResult);

      return NextResponse.json({
        success: true,
        transactions: newTransactions,
        count: newTransactions.length,
        duplicateCount,
        saved: true,
        saveResult
      });
    } catch (saveError) {
      console.error('Error saving to database:', saveError);
      return NextResponse.json(
        {
          error: 'Transactions extracted but failed to save to database',
          transactions,
          count: transactions.length
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
