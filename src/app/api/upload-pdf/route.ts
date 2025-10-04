import { NextRequest, NextResponse } from 'next/server';

interface Transaction {
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory: string;
  statement_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
}

interface PdfItem {
  text?: string;
  y?: number;
}

interface CategoryRule {
  pattern: RegExp;
  category: string;
  subcategory: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /(public transport|at hop|bus|train|ferry)/i, category: 'Transport', subcategory: 'Public Transport' },
  { pattern: /(uber|ola|didi|lyft)/i, category: 'Transport', subcategory: 'Rideshare' },
  { pattern: /(lime|beam|neuron)/i, category: 'Transport', subcategory: 'Micromobility' },
  { pattern: /(bp|z energy|caltex|mobil|gull|petrol|gasoline)/i, category: 'Transport', subcategory: 'Fuel' },

  { pattern: /(woolworths|pak n save|new world|countdown|farro|supermarket)/i, category: 'Groceries', subcategory: 'Supermarkets' },
  { pattern: /(butcher|bakery|deli|organics|wholefoods)/i, category: 'Groceries', subcategory: 'Specialty Food' },

  { pattern: /(starbucks|coffee|cafe)/i, category: 'Dining', subcategory: 'Cafes' },
  { pattern: /(mcdonald|kfc|burger king|subway|domino|pizza hut|hungry jacks)/i, category: 'Dining', subcategory: 'Fast Food' },
  { pattern: /(restaurant|bistro|dining|cuisine|grill|izakaya|eatery)/i, category: 'Dining', subcategory: 'Restaurants' },

  { pattern: /(netflix|spotify|disney\+?|apple music|youtube|paramount|hbo|amazon prime)/i, category: 'Entertainment', subcategory: 'Streaming' },
  { pattern: /(playstation|steam|nintendo|xbox|game pass|gaming)/i, category: 'Entertainment', subcategory: 'Gaming' },
  { pattern: /(event cinema|cinemas|movies|theatre)/i, category: 'Entertainment', subcategory: 'Movies & Events' },

  { pattern: /(openai|claude|cursor|expressvpn|cloudflare|apple\.com|applecom|icloud|itunes|microsoft|google)/i, category: 'Subscriptions & Services', subcategory: 'Software & Cloud' },
  { pattern: /(paypal|stripe|xero|freshbooks|accounting)/i, category: 'Subscriptions & Services', subcategory: 'Financial Services' },

  { pattern: /(kmart|warehouse|briscoes|bunnings|mitre 10|ikea|noel leeming|harvey norman|jb hi fi)/i, category: 'Shopping', subcategory: 'Retail & Home' },
  { pattern: /(farmer|fashion|adidas|puma|nike|seed heritage|hallenstein)/i, category: 'Shopping', subcategory: 'Apparel' },

  { pattern: /(chemist|pharmacy|unimeds|medical|clinic)/i, category: 'Health', subcategory: 'Pharmacy & Health' },

  { pattern: /(hotel|airbnb|accor|hilton|marriott|motel)/i, category: 'Travel', subcategory: 'Accommodation' },
  { pattern: /(air new zealand|jetstar|qantas|airline|flight)/i, category: 'Travel', subcategory: 'Flights' }
];

function detectCategory(place: string): { category: string; subcategory: string } {
  const rule = CATEGORY_RULES.find(({ pattern }) => pattern.test(place));

  if (rule) {
    return { category: rule.category, subcategory: rule.subcategory };
  }

  return { category: 'Other', subcategory: 'General' };
}

function computeStatementMetadata(dateIso: string): {
  statement_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
} {
  if (!dateIso) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  const date = new Date(`${dateIso}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  let closingYear = date.getUTCFullYear();
  let closingMonth = date.getUTCMonth();

  if (date.getUTCDate() > 26) {
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
      const { category, subcategory } = detectCategory(place);
      const statementMetadata = computeStatementMetadata(date_iso);

      transactions.push({
        place,
        amount: `$${matchedAmount.value.toFixed(2)}`,
        date: date_iso,
        currency: 'NZD',
        value: matchedAmount.value,
        date_iso,
        category,
        subcategory,
        ...statementMetadata
      });
    }
  }

  return transactions;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

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
