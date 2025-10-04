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

  // Collect amounts with their line numbers (amounts appear before transactions in PDF extraction)
  const amounts: Array<{value: number, index: number, used: boolean}> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const amountMatch = line.match(amountPattern);

    if (amountMatch && !line.includes('CR') && !line.includes('DOLLAR') && !line.includes('%')) {
      const cleanAmount = amountMatch[1].replace(/,/g, '');
      const value = parseFloat(cleanAmount);

      // Filter out unrealistic amounts
      if (value > 0 && value < 10000) {
        amounts.push({ value, index: i, used: false });
      }
    }
  }

  // Now find transactions and match with the closest preceding unused amount
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const transMatch = line.match(transactionPattern);
    if (transMatch) {
      const [, day, month, year, description] = transMatch;
      const dateStr = `${day}.${month}.${year}`;

      // Skip payments and summary lines
      if (description.includes('PAYMENT - THANK YOU') ||
          description.includes('Total of New Transactions')) {
        continue;
      }

      // Find the closest unused amount that appears before this transaction (within 50 lines)
      let closestAmount = null;
      let minDistance = Infinity;

      for (const amt of amounts) {
        const distance = i - amt.index;
        // Amount should be before transaction (positive distance), unused, and within 50 lines
        if (!amt.used && distance > 0 && distance < 50 && distance < minDistance) {
          minDistance = distance;
          closestAmount = amt;
        }
      }

      if (closestAmount) {
        const date_iso = parseDate(dateStr);
        const place = description.trim();
        const category = detectCategory(place);

        transactions.push({
          place,
          amount: `$${closestAmount.value.toFixed(2)}`,
          date: date_iso,
          currency: 'NZD',
          value: closestAmount.value,
          date_iso,
          category
        });

        // Mark amount as used
        closestAmount.used = true;
      }
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
      // Send to backend API
      const response = await fetch(`${apiUrl}/transactions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(transactions)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save transactions to database');
      }

      const saveResult = await response.json();
      console.log('Transactions saved:', saveResult);

      return NextResponse.json({
        success: true,
        transactions,
        count: transactions.length,
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
