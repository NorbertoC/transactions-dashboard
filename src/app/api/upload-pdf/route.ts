import { NextRequest, NextResponse } from 'next/server';
import { categorizeMerchant } from '@/utils/classification';

interface Transaction {
  id?: number;
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
  x?: number;
}

type PdfReaderInstance = {
  parseBuffer: (buffer: Buffer, callback: (err: Error | null, item?: PdfItem) => void) => void;
};

type PdfReaderConstructor = new (options?: unknown) => PdfReaderInstance;

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
  const lines = text.split('\n');

  const transactionWithAmountPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/;
  const transactionPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+)$/;
  const amountPattern = /^([\d,]+\.\d{2})$/;

  const transactionsRaw: Array<{ date: string; description: string; index: number }> = [];
  const amountsRaw: Array<{ value: number; index: number }> = [];
  const directTransactions: Array<{ date: string; description: string; value: number }> = [];

  let seenFirstTransaction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line) {
      continue;
    }

    const directMatch = line.match(transactionWithAmountPattern);
    if (directMatch) {
      const [, day, month, year, descriptionRaw, amountRaw] = directMatch;
      const dateStr = `${day}.${month}.${year}`;

      if (descriptionRaw.includes('PAYMENT - THANK YOU') ||
          descriptionRaw.includes('Total of New Transactions')) {
        continue;
      }

      const value = parseFloat(amountRaw.replace(/,/g, ''));

      if (!Number.isFinite(value) || value <= 0 || value >= 10000) {
        continue;
      }

      directTransactions.push({
        date: dateStr,
        description: descriptionRaw.trim(),
        value
      });

      seenFirstTransaction = true;
      continue;
    }

    const transMatch = line.match(transactionPattern);
    if (transMatch) {
      const [, day, month, year, description] = transMatch;
      const dateStr = `${day}.${month}.${year}`;

      if (description.includes('PAYMENT - THANK YOU') ||
          description.includes('Total of New Transactions')) {
        continue;
      }

      transactionsRaw.push({
        date: dateStr,
        description: description.trim(),
        index: i
      });
      seenFirstTransaction = true;
      continue;
    }

    const amountMatch = line.match(amountPattern);
    if (amountMatch && seenFirstTransaction) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (line.includes('CR') || line.includes('%') || nextLine === 'CR') {
        continue;
      }

      const cleanAmount = amountMatch[1].replace(/,/g, '');
      const value = parseFloat(cleanAmount);

      if (!Number.isFinite(value) || value <= 0 || value >= 10000) {
        continue;
      }

      amountsRaw.push({ value, index: i });
    }
  }

  if (directTransactions.length > 0 && transactionsRaw.length === 0) {
    return directTransactions.map(({ date, description, value }) => {
      const date_iso = parseDate(date);
      const place = description;
      const { category, subcategory } = categorizeMerchant(place);
      const statementMetadata = computeStatementMetadata(date_iso);

      return {
        place,
        amount: `$${value.toFixed(2)}`,
        date: date_iso,
        currency: 'NZD',
        value,
        date_iso,
        category,
        subcategory,
        ...statementMetadata
      };
    });
  }

  const usedAmounts = new Set<number>();
  const transactions: Transaction[] = [];

  const findAmountForTransaction = (transactionIndex: number) => {
    let bestIdx: number | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;

    // First pass: Find the closest amount AFTER the transaction (within reasonable distance)
    for (let i = 0; i < amountsRaw.length; i++) {
      if (usedAmounts.has(i)) {
        continue;
      }
      const diff = amountsRaw[i].index - transactionIndex;
      // Only match amounts that come after the transaction and within 5 lines
      if (diff > 0 && diff <= 5 && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    // Second pass: If no close match found, look for amounts on the same line
    if (bestIdx === null) {
      for (let i = 0; i < amountsRaw.length; i++) {
        if (usedAmounts.has(i)) {
          continue;
        }
        const diff = Math.abs(amountsRaw[i].index - transactionIndex);
        if (diff === 0) {
          bestIdx = i;
          break;
        }
      }
    }

    if (bestIdx === null) {
      return null;
    }

    usedAmounts.add(bestIdx);
    return amountsRaw[bestIdx];
  };

  for (const transactionLine of transactionsRaw) {
    const matchedAmount = findAmountForTransaction(transactionLine.index);
    if (!matchedAmount) {
      console.warn(`No amount found for transaction at line ${transactionLine.index}: ${transactionLine.description}`);
      continue;
    }

    const date_iso = parseDate(transactionLine.date);
    const place = transactionLine.description;
    const { category, subcategory } = categorizeMerchant(place);
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
      let lastY: number | null = null;

      const PdfReaderCtor = PdfReader as unknown as PdfReaderConstructor;
      const reader = new PdfReaderCtor({});

      reader.parseBuffer(buffer, (err: Error | null, item?: PdfItem) => {
        if (err) {
          reject(err);
        } else if (!item) {
          if (currentLine) fullText += currentLine + '\n';
          resolve(fullText);
        } else if (item.text) {
          const currentY = typeof item.y === 'number' ? item.y : lastY ?? 0;

          if (lastY !== null && Math.abs(lastY - currentY) > 0.2 && currentLine) {
            fullText += currentLine + '\n';
            currentLine = '';
          }

          currentLine += `${item.text} `;
          lastY = currentY;
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

      const existingMap = new Map<string, Transaction>(
        existingTransactions.map((tx: Transaction) => [
          `${tx.date_iso}|${tx.place.trim().toLowerCase()}`,
          tx
        ])
      );

      const updates: Array<{ id: number; data: Transaction }> = [];

      const newTransactions = transactions.filter(newTx => {
        const key = `${newTx.date_iso}|${newTx.place.trim().toLowerCase()}`;
        const existing = existingMap.get(key);

        if (!existing) {
          return true;
        }

        const valueDiffers = Math.abs(existing.value - newTx.value) > 0.01;
        const categoryDiffers = existing.category !== newTx.category || existing.subcategory !== newTx.subcategory;

        if (valueDiffers || categoryDiffers) {
          if (existing.id !== undefined) {
            updates.push({
              id: existing.id,
              data: {
                ...existing,
                ...newTx
              }
            });
          }
        }

        return false;
      });

      const duplicateCount = transactions.length - newTransactions.length - updates.length;

      console.log(`Total transactions: ${transactions.length}`);
      console.log(`Duplicates found: ${duplicateCount}`);
      console.log(`Transactions queued for update: ${updates.length}`);
      console.log(`New transactions: ${newTransactions.length}`);

      for (const update of updates) {
        const response = await fetch(`${apiUrl}/transactions/${update.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify(update.data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update existing transaction');
        }
      }

      if (newTransactions.length === 0) {
        return NextResponse.json({
          success: true,
          transactions: [],
          count: 0,
          duplicateCount,
          updated: updates.length,
          saved: updates.length > 0,
          message: updates.length > 0
            ? 'Existing transactions updated.'
            : 'All transactions are duplicates. No new transactions to save.'
        });
      }

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
        updated: updates.length,
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
