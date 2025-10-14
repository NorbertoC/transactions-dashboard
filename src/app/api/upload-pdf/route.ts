import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
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

// Enhanced PDF parser that can handle multiple statement formats
function extractTransactions(text: string): Transaction[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Try different parsing strategies
  const parsers = [
    parseAmexFormat,
    parseStandardBankFormat,
    parseTabularFormat,
    parseNZBankFormat
  ];

  for (const parser of parsers) {
    const transactions = parser(lines);
    if (transactions.length > 0) {
      console.log(`Successfully parsed using ${parser.name}, found ${transactions.length} transactions`);
      return transactions;
    }
  }

  console.warn('No suitable parser found for this PDF format');
  return [];
}

// American Express format parser (existing logic)
function parseAmexFormat(lines: string[]): Transaction[] {
  const transactionWithAmountPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/;
  const transactionPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+)$/;
  const amountPattern = /^([\d,]+\.\d{2})$/;

  const transactionsRaw: Array<{ date: string; description: string; index: number }> = [];
  const amountsRaw: Array<{ value: number; index: number }> = [];
  const directTransactions: Array<{ date: string; description: string; value: number }> = [];

  console.log('=== parseAmexFormat: Starting ===');
  console.log(`Total lines to process: ${lines.length}`);
  console.log('Sample lines (first 80):');
  lines.slice(0, 80).forEach((line, idx) => {
    console.log(`  [${idx}] "${line}"`);
  });

  // Extract the minimum payment amount from the header to filter it out later
  let minimumPaymentAmount: number | null = null;
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i];
    const minPaymentMatch = line.match(/Minimum\s+Payment\s+\$?\s*([\d,]+\.?\d{0,2})/i);
    if (minPaymentMatch) {
      minimumPaymentAmount = parseFloat(minPaymentMatch[1].replace(/,/g, ''));
      console.log(`Found Minimum Payment amount: ${minimumPaymentAmount} at line ${i}`);
      break;
    }
  }

  // Find where the detailed transaction list starts (after the summary section)
  // Look for lines that contain typical AMEX statement markers
  let detailedSectionStart = 0;
  for (let i = 0; i < Math.min(100, lines.length); i++) {
    const line = lines[i];
    // Look for markers that indicate the detailed transaction section
    if (line.includes('Details') && line.includes('Foreign') ||
        line.includes('Transaction Details') ||
        (i > 30 && line.match(/^\d{2}\s*\.\s*\d{2}\s*\.\s*\d{2}\s+[A-Z]/))) {
      // Once we find a transaction-like line after line 30, we're probably in the detailed section
      if (i > 30) {
        detailedSectionStart = i - 20; // Back up a bit to catch any early transactions
        console.log(`Detected detailed section starting around line ${detailedSectionStart}`);
        break;
      }
    }
  }

  // First pass: collect all amounts and transactions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const directMatch = line.match(transactionWithAmountPattern);
    if (directMatch) {
      const [, day, month, year, descriptionRaw, amountRaw] = directMatch;
      const dateStr = `${day}.${month}.${year}`;
      console.log(`Line ${i}: DIRECT MATCH - ${dateStr} ${descriptionRaw} ${amountRaw}`);

      if (descriptionRaw.includes('PAYMENT - THANK YOU') ||
          descriptionRaw.includes('Total of New Transactions')) {
        console.log(`  -> Skipped (payment/total)`);
        continue;
      }

      const value = parseFloat(amountRaw.replace(/,/g, ''));
      if (!Number.isFinite(value) || value <= 0 || value >= 50000) {
        console.log(`  -> Skipped (invalid amount: ${value})`);
        continue;
      }

      console.log(`  -> Added to directTransactions`);
      directTransactions.push({ date: dateStr, description: descriptionRaw.trim(), value });
      continue;
    }

    const transMatch = line.match(transactionPattern);
    if (transMatch) {
      const [, day, month, year, description] = transMatch;
      const dateStr = `${day}.${month}.${year}`;
      
      // Skip transactions from the summary section (before line 50)
      if (i < 50) {
        console.log(`Line ${i}: TRANSACTION MATCH (SUMMARY SECTION) - ${dateStr} ${description} -> SKIPPED`);
        continue;
      }
      
      console.log(`Line ${i}: TRANSACTION MATCH - ${dateStr} ${description}`);

      if (description.includes('PAYMENT - THANK YOU') ||
          description.includes('Total of New Transactions')) {
        console.log(`  -> Skipped (payment/total)`);
        continue;
      }

      console.log(`  -> Added to transactionsRaw`);
      transactionsRaw.push({ date: dateStr, description: description.trim(), index: i });
      continue;
    }

    // Collect all standalone amounts (remove seenFirstTransaction requirement)
    const amountMatch = line.match(amountPattern);
    if (amountMatch) {
      // Skip amounts from the summary section (before line 50)
      // Amounts for detailed transactions start around line 50-60
      if (i < 50) {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (summary section, before line 50)`);
        continue;
      }

      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const prevLine = i > 0 ? lines[i - 1] : '';

      // Skip credits, percentages, and amounts that are part of headers/totals
      if (line.includes('CR') || line.includes('%') || nextLine === 'CR') {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (CR/percentage)`);
        continue;
      }
      if (prevLine.includes('Minimum Payment') || prevLine.includes('Credit Limit') ||
          prevLine.includes('Due by') || line.includes('Minimum Payment')) {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (header/total)`);
        continue;
      }

      // Skip if this is near header text mentioning minimum payment
      const prev2Line = i > 1 ? lines[i - 2] : '';
      const prev3Line = i > 2 ? lines[i - 3] : '';
      if (prev2Line.includes('Minimum Payment') || prev3Line.includes('Minimum Payment')) {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (near minimum payment)`);
        continue;
      }

      const value = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(value) || value <= 0 || value >= 50000) {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (invalid: ${value})`);
        continue;
      }

      // Skip if this amount matches the minimum payment amount
      if (minimumPaymentAmount !== null && Math.abs(value - minimumPaymentAmount) < 0.01) {
        console.log(`Line ${i}: AMOUNT ${line} -> Skipped (matches minimum payment: ${minimumPaymentAmount})`);
        continue;
      }

      console.log(`Line ${i}: AMOUNT ${line} -> Added to amountsRaw (value: ${value})`);
      amountsRaw.push({ value, index: i });
    }
  }

  console.log(`=== parseAmexFormat: Collection complete ===`);
  console.log(`Direct transactions: ${directTransactions.length}`);
  console.log(`Transactions (no amount): ${transactionsRaw.length}`);
  console.log(`Standalone amounts: ${amountsRaw.length}`);

  if (directTransactions.length > 0) {
    return directTransactions.map(({ date, description, value }) => 
      createTransaction(date, description, value, parseDate(date))
    );
  }

  // Match transactions with amounts for AMEX format
  const usedAmounts = new Set<number>();
  const transactions: Transaction[] = [];

  // Try sequential matching first (for PDFs where amounts are listed separately in order)
  // Allow for off-by-one or off-by-two mismatches (might have extra header amounts)
  const countDiff = Math.abs(transactionsRaw.length - amountsRaw.length);
  if (transactionsRaw.length > 0 && amountsRaw.length > 0 && countDiff <= 2) {
    const minCount = Math.min(transactionsRaw.length, amountsRaw.length);
    console.log(`Attempting sequential matching: ${transactionsRaw.length} transactions, ${amountsRaw.length} amounts (diff: ${countDiff})`);
    
    // If we have more amounts than transactions, try to find the right starting offset
    let startOffset = 0;
    if (amountsRaw.length > transactionsRaw.length) {
      // Find the offset where amounts start to align with transactions
      // Look for the first transaction date and find amounts near it
      const firstTransIdx = transactionsRaw[0].index;
      for (let i = 0; i < amountsRaw.length; i++) {
        const diff = Math.abs(amountsRaw[i].index - firstTransIdx);
        if (diff <= 30) {
          startOffset = i;
          break;
        }
      }
      console.log(`Using offset ${startOffset} for amounts (first trans at line ${firstTransIdx}, first aligned amount at line ${amountsRaw[startOffset]?.index})`);
    }
    
    for (let i = 0; i < minCount; i++) {
      const transactionLine = transactionsRaw[i];
      const amountIdx = startOffset + i;
      if (amountIdx >= amountsRaw.length) break;
      
      const amount = amountsRaw[amountIdx];
      const date_iso = parseDate(transactionLine.date);
      console.log(`Sequential match ${i}: ${transactionLine.date} ${transactionLine.description} -> ${amount.value}`);
      transactions.push(createTransaction(transactionLine.date, transactionLine.description, amount.value, date_iso));
      usedAmounts.add(amountIdx);
    }
    
    if (transactions.length > 0) {
      console.log(`Sequential matching succeeded: ${transactions.length} transactions created`);
      return transactions;
    }
  }

  // Fall back to proximity-based matching
  console.log(`Falling back to proximity-based matching...`);
  for (const transactionLine of transactionsRaw) {
    const matchedAmount = findClosestAmount(transactionLine.index, amountsRaw, usedAmounts);
    if (!matchedAmount) {
      console.log(`No amount found for transaction at line ${transactionLine.index}: ${transactionLine.description}`);
      continue;
    }

    const date_iso = parseDate(transactionLine.date);
    console.log(`Proximity match: ${transactionLine.date} ${transactionLine.description} (line ${transactionLine.index}) -> ${matchedAmount.value} (line ${matchedAmount.index})`);
    transactions.push(createTransaction(transactionLine.date, transactionLine.description, matchedAmount.value, date_iso));
  }

  console.log(`Proximity matching complete: ${transactions.length} transactions created`);
  return transactions;
}

// Standard bank format parser (DD/MM/YYYY or DD-MM-YYYY with description and amount)
function parseStandardBankFormat(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  
  // Pattern for dates like DD/MM/YYYY or DD-MM-YYYY followed by description and amount
  const transactionPattern = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(.+?)\s+([\$\£\€]?[\d,]+\.?\d{0,2})$/;
  
  for (const line of lines) {
    const match = line.match(transactionPattern);
    if (!match) continue;
    
    const [, day, month, year, description, amountStr] = match;
    
    // Skip payment/credit entries
    if (description.toLowerCase().includes('payment') || 
        description.toLowerCase().includes('credit') ||
        description.toLowerCase().includes('thank you')) {
      continue;
    }
    
    const value = parseFloat(amountStr.replace(/[\$\£\€,]/g, ''));
    if (!Number.isFinite(value) || value <= 0 || value >= 50000) continue;
    
    const dateStr = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
    const date_iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    transactions.push(createTransaction(dateStr, description.trim(), value, date_iso));
  }
  
  return transactions;
}

// Tabular format parser (for PDFs with clear column structure)
function parseTabularFormat(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  
  // Look for lines that might be tabular data with multiple whitespace separators
  const tabularPattern = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s{2,}(.+?)\s{2,}([\$\£\€]?[\d,]+\.?\d{0,2})$/;
  
  for (const line of lines) {
    const match = line.match(tabularPattern);
    if (!match) continue;
    
    const [, dateStr, description, amountStr] = match;
    
    if (description.toLowerCase().includes('payment') || 
        description.toLowerCase().includes('credit')) {
      continue;
    }
    
    const value = parseFloat(amountStr.replace(/[\$\£\€,]/g, ''));
    if (!Number.isFinite(value) || value <= 0 || value >= 50000) continue;
    
    const [day, month, year] = dateStr.split(/[\/\-]/);
    const date_iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const normalizedDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
    
    transactions.push(createTransaction(normalizedDate, description.trim(), value, date_iso));
  }
  
  return transactions;
}

// New Zealand bank format parser (common NZ bank statement formats)
function parseNZBankFormat(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];
  
  // NZ format: often uses DD MMM YYYY or DD/MM/YY
  const nzPatterns = [
    // Pattern like "01 Aug 2024    MERCHANT NAME    $123.45"
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(.+?)\s+(NZ\$|[\$])?([\d,]+\.?\d{0,2})$/,
    // Pattern like "01/08/24    MERCHANT NAME    $123.45"
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(.+?)\s+(NZ\$|[\$])?([\d,]+\.?\d{0,2})$/,
    // Pattern like "2024-08-01    MERCHANT NAME    123.45"
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+?)\s+([\d,]+\.?\d{0,2})$/
  ];
  
  const monthMap: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  for (const line of lines) {
    for (const pattern of nzPatterns) {
      const match = line.match(pattern);
      if (!match) continue;
      
      let day: string, month: string, year: string, description: string, amountStr: string;
      
      if (pattern === nzPatterns[0]) { // DD MMM YYYY format
        [, day, month, year, description, , amountStr] = match;
        month = monthMap[month.toLowerCase()] || month;
      } else if (pattern === nzPatterns[1]) { // DD/MM/YY format
        [, day, month, year, description, , amountStr] = match;
        year = `20${year}`; // Assume 2000s
      } else { // YYYY-MM-DD format
        [, year, month, day, description, amountStr] = match;
      }
      
      if (description.toLowerCase().includes('payment') || 
          description.toLowerCase().includes('credit') ||
          description.toLowerCase().includes('transfer in')) {
        continue;
      }
      
      const value = parseFloat(amountStr.replace(/[,]/g, ''));
      if (!Number.isFinite(value) || value <= 0 || value >= 50000) continue;
      
      const date_iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const normalizedDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year.slice(-2)}`;
      
      transactions.push(createTransaction(normalizedDate, description.trim(), value, date_iso));
      break; // Found match, move to next line
    }
  }
  
  return transactions;
}

// Helper function to find closest amount for AMEX format
function findClosestAmount(transactionIndex: number, amountsRaw: Array<{ value: number; index: number }>, usedAmounts: Set<number>) {
  let bestIdx: number | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  // First try: look for amounts within 5 lines after the transaction
  for (let i = 0; i < amountsRaw.length; i++) {
    if (usedAmounts.has(i)) continue;
    
    const diff = amountsRaw[i].index - transactionIndex;
    if (diff > 0 && diff <= 5 && diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  // Second try: look for amounts within 30 lines before the transaction
  if (bestIdx === null) {
    for (let i = 0; i < amountsRaw.length; i++) {
      if (usedAmounts.has(i)) continue;
      
      const diff = transactionIndex - amountsRaw[i].index;
      if (diff > 0 && diff <= 30 && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
  }

  // Third try: same line
  if (bestIdx === null) {
    for (let i = 0; i < amountsRaw.length; i++) {
      if (usedAmounts.has(i)) continue;
      const diff = Math.abs(amountsRaw[i].index - transactionIndex);
      if (diff === 0) {
        bestIdx = i;
        break;
      }
    }
  }

  if (bestIdx === null) return null;
  
  usedAmounts.add(bestIdx);
  return amountsRaw[bestIdx];
}

// Helper function to create a transaction object
function createTransaction(dateStr: string, description: string, value: number, date_iso: string): Transaction {
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
}

export async function POST(request: NextRequest) {
  console.log('=== PDF Upload Route Called ===');
  
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    console.log('Unauthorized: No session found');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    console.log('Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
    });

    if (!file) {
      console.error('No file provided in form data');
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
      console.log('No transactions found. Analyzing PDF format...');
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log(`Total non-empty lines: ${lines.length}`);
      
      // Show first 50 lines to help identify format
      console.log('=== First 50 lines ===');
      lines.slice(0, 50).forEach((line, i) => {
        console.log(`Line ${i + 1}: ${line}`);
      });

      // Look for common patterns
      const datePatterns = [
        /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
        /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/g,
        /\d{4}-\d{1,2}-\d{1,2}/g
      ];
      
      console.log('=== Pattern Analysis ===');
      datePatterns.forEach((pattern, i) => {
        const matches = text.match(pattern);
        console.log(`Date pattern ${i + 1} matches:`, matches?.slice(0, 5) || 'None');
      });

      // Look for currency symbols
      const currencyMatches = text.match(/[\$\£\€][\d,]+\.?\d{0,2}|NZ\$[\d,]+\.?\d{0,2}/g);
      console.log('Currency pattern matches:', currencyMatches?.slice(0, 10) || 'None');
      
      // Look for amount patterns
      const amountMatches = text.match(/\b\d{1,4}[,\.]?\d{0,3}\.\d{2}\b/g);
      console.log('Amount pattern matches:', amountMatches?.slice(0, 10) || 'None');
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
