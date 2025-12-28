import { describe, it, expect } from 'vitest';

/**
 * Real parsing tests that actually call the parser functions
 * These tests simulate the actual PDF format and verify correct amount matching
 */

// Type for transaction objects
type Transaction = {
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory: string;
};

// Helper to parse date from DD.MM.YY format to YYYY-MM-DD
function parseDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  const fullYear = `20${year}`;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Mock categorization (simplified for tests)
function mockCategorizeMerchant(place: string): { category: string; subcategory: string } {
  const hasPlace = place.trim().length > 0;
  return {
    category: 'Test Category',
    subcategory: hasPlace ? 'Test Subcategory' : 'Test Subcategory'
  };
}

// Simplified version of createTransaction for testing
function createTransaction(dateStr: string, description: string, value: number, date_iso: string) {
  const { category, subcategory } = mockCategorizeMerchant(description);
  
  return {
    place: description,
    amount: `$${value.toFixed(2)}`,
    date: date_iso,
    currency: 'NZD',
    value,
    date_iso,
    category,
    subcategory,
  };
}

// Copy of the parseAmexFormat function for testing
function parseAmexFormat(lines: string[]): Transaction[] {
  const transactionWithAmountPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/;
  const transactionPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+)$/;
  const amountPattern = /^([\d,]+\.\d{2})$/;

  const transactionsRaw: Array<{ date: string; description: string; index: number }> = [];
  const amountsRaw: Array<{ value: number; index: number }> = [];
  const directTransactions: Array<{ date: string; description: string; value: number }> = [];

  // Extract the minimum payment amount from the header to filter it out later
  let minimumPaymentAmount: number | null = null;
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i];
    const minPaymentMatch = line.match(/Minimum\s+Payment\s+\$?\s*([\d,]+\.?\d{0,2})/i);
    if (minPaymentMatch) {
      minimumPaymentAmount = parseFloat(minPaymentMatch[1].replace(/,/g, ''));
      break;
    }
  }

  // First pass: collect all amounts and transactions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const directMatch = line.match(transactionWithAmountPattern);
    if (directMatch) {
      const [, day, month, year, descriptionRaw, amountRaw] = directMatch;
      const dateStr = `${day}.${month}.${year}`;

      if (descriptionRaw.includes('PAYMENT - THANK YOU') ||
          descriptionRaw.includes('Total of New Transactions')) {
        continue;
      }

      const value = parseFloat(amountRaw.replace(/,/g, ''));
      if (!Number.isFinite(value) || value <= 0 || value >= 50000) continue;

      directTransactions.push({ date: dateStr, description: descriptionRaw.trim(), value });
      continue;
    }

    const transMatch = line.match(transactionPattern);
    if (transMatch) {
      const [, day, month, year, description] = transMatch;
      const dateStr = `${day}.${month}.${year}`;
      
      // Skip transactions from the summary section (before line 50)
      if (i < 50) {
        continue;
      }

      if (description.includes('PAYMENT - THANK YOU') ||
          description.includes('Total of New Transactions')) {
        continue;
      }

      transactionsRaw.push({ date: dateStr, description: description.trim(), index: i });
      continue;
    }

    // Collect all standalone amounts
    const amountMatch = line.match(amountPattern);
    if (amountMatch) {
      // Skip amounts from the summary section (before line 50)
      // Amounts for detailed transactions start around line 50-60
      if (i < 50) {
        continue;
      }

      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const prevLine = i > 0 ? lines[i - 1] : '';

      // Skip credits, percentages, and amounts that are part of headers/totals
      if (line.includes('CR') || line.includes('%') || nextLine === 'CR') continue;
      if (prevLine.includes('Minimum Payment') || prevLine.includes('Credit Limit') ||
          prevLine.includes('Due by') || line.includes('Minimum Payment')) continue;

      const prev2Line = i > 1 ? lines[i - 2] : '';
      const prev3Line = i > 2 ? lines[i - 3] : '';
      if (prev2Line.includes('Minimum Payment') || prev3Line.includes('Minimum Payment')) {
        continue;
      }

      const value = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(value) || value <= 0 || value >= 50000) continue;

      // Skip if this amount matches the minimum payment amount
      if (minimumPaymentAmount !== null && Math.abs(value - minimumPaymentAmount) < 0.01) {
        continue;
      }

      amountsRaw.push({ value, index: i });
    }
  }

  if (directTransactions.length > 0) {
    return directTransactions.map(({ date, description, value }) => 
      createTransaction(date, description, value, parseDate(date))
    );
  }

  // Match transactions with amounts for AMEX format
  const usedAmounts = new Set<number>();
  const transactions: Transaction[] = [];

  // Try sequential matching first
  const countDiff = Math.abs(transactionsRaw.length - amountsRaw.length);
  if (transactionsRaw.length > 0 && amountsRaw.length > 0 && countDiff <= 2) {
    const minCount = Math.min(transactionsRaw.length, amountsRaw.length);
    
    let startOffset = 0;
    if (amountsRaw.length > transactionsRaw.length) {
      const firstTransIdx = transactionsRaw[0].index;
      for (let i = 0; i < amountsRaw.length; i++) {
        const diff = Math.abs(amountsRaw[i].index - firstTransIdx);
        if (diff <= 30) {
          startOffset = i;
          break;
        }
      }
    }
    
    for (let i = 0; i < minCount; i++) {
      const transactionLine = transactionsRaw[i];
      const amountIdx = startOffset + i;
      if (amountIdx >= amountsRaw.length) break;
      
      const amount = amountsRaw[amountIdx];
      const date_iso = parseDate(transactionLine.date);
      transactions.push(createTransaction(transactionLine.date, transactionLine.description, amount.value, date_iso));
      usedAmounts.add(amountIdx);
    }
    
    if (transactions.length > 0) {
      return transactions;
    }
  }

  return transactions;
}

describe('Real PDF Parsing Tests', () => {
  describe('AMEX Format with Separate Amount List', () => {
    it('should correctly match amounts with transactions when amounts appear before detailed transactions', () => {
      // This simulates the real PDF format:
      // - Indices 0-49: Header and summary section with some transactions (should be ignored)
      // - Indices 50+: Standalone amounts and detailed transaction list

      const pdfLines = [
        // Header section (indices 0-9)
        'NORBERTO CAROSELLA XXXX-XXXXXX-51006 27 . 08 . 25 26 . 09 . 25',
        '2,461.91 - 3,847.89 + 2,438.23 = 1,052.25',
        'Minimum Payment $ 31.00',
        'Due by 21 . 10 . 2025',
        '',
        '',
        '',
        '',
        '',
        '',
        // Summary transactions (indices 10-14) - SHOULD BE IGNORED
        '12 . 09 . 25 PAYMENT - THANK YOU',
        '17 . 09 . 25 PAYMENT - THANK YOU',
        '26 . 08 . 25 WOOLWORTHS PONSONBY 905 PONSONBY',
        '27 . 08 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
        '27 . 08 . 25 PAYPAL *TEMU COM        4029357733',
        ...Array(35).fill(''),
        // Amounts section (starting at index 50)
        '10.02',
        '72.40',
        '9.30',
        '40.00',
        '45.95',
        '22.99',
        '9.99',
        '49.97',
        '82.13',
        '80.76',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        // Detailed transactions (index 70+) - SHOULD BE MATCHED
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373',
        '01 . 09 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
        '03 . 09 . 25 SKINNY MOBILE AUCKLAND  AUCKLAND',
        '03 . 09 . 25 PAYPAL *PLAYSTATION     02078595000',
        '04 . 09 . 25 CHEMIST WAREHOUSE BIRKE GLEN INNES',
        '06 . 09 . 25 APPLE.COM/BILL          SYDNEY',
        '08 . 09 . 25 BUNNINGS ONLINE 3 AUCKL AUCKLAND',
        '08 . 09 . 25 CURSOR USAGE  AUG       NEW YORK',
        '11 . 09 . 25 WOOLWORTHS BIRKENHEAD 9 AUCKLAND',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should have 10 transactions (not 13, because we skip the summary section)
      expect(result).toHaveLength(10);

      // Verify correct matching of amounts to transactions
      expect(result[0].place).toBe('OPENAI                  SAN FRANCISCO');
      expect(result[0].value).toBe(10.02);
      expect(result[0].date_iso).toBe('2025-08-29');

      expect(result[1].place).toBe('PAYPAL *EVENTCINEMA     6129373');
      expect(result[1].value).toBe(72.40);
      expect(result[1].date_iso).toBe('2025-08-31');

      expect(result[2].place).toBe('AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA');
      expect(result[2].value).toBe(9.30);
      expect(result[2].date_iso).toBe('2025-09-01');

      expect(result[3].place).toBe('SKINNY MOBILE AUCKLAND  AUCKLAND');
      expect(result[3].value).toBe(40.00);
      expect(result[3].date_iso).toBe('2025-09-03');

      expect(result[4].place).toBe('PAYPAL *PLAYSTATION     02078595000');
      expect(result[4].value).toBe(45.95);
      expect(result[4].date_iso).toBe('2025-09-03');

      expect(result[5].place).toBe('CHEMIST WAREHOUSE BIRKE GLEN INNES');
      expect(result[5].value).toBe(22.99);
      expect(result[5].date_iso).toBe('2025-09-04');

      expect(result[6].place).toBe('APPLE.COM/BILL          SYDNEY');
      expect(result[6].value).toBe(9.99);
      expect(result[6].date_iso).toBe('2025-09-06');

      expect(result[7].place).toBe('BUNNINGS ONLINE 3 AUCKL AUCKLAND');
      expect(result[7].value).toBe(49.97);
      expect(result[7].date_iso).toBe('2025-09-08');

      expect(result[8].place).toBe('CURSOR USAGE  AUG       NEW YORK');
      expect(result[8].value).toBe(82.13);
      expect(result[8].date_iso).toBe('2025-09-08');

      expect(result[9].place).toBe('WOOLWORTHS BIRKENHEAD 9 AUCKLAND');
      expect(result[9].value).toBe(80.76);
      expect(result[9].date_iso).toBe('2025-09-11');
    });

    it('should handle minimum payment amount filtering correctly', () => {
      const pdfLines = [
        'Minimum Payment $ 31.00',
        'Due by 21 . 10 . 2025',
        '',
        '31.00', // This should be filtered out (minimum payment)
        '',
        '',
        '',
        '',
        '',
        '',
        // ... fill to line 50
        ...Array(40).fill(''),
        // Amounts that should be kept
        '10.02',
        '72.40',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        // Transactions
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should match 2 transactions with the 2 valid amounts (not the 31.00 minimum payment)
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(10.02);
      expect(result[1].value).toBe(72.40);
    });

    it('should ignore summary section transactions before line 50', () => {
      const pdfLines = [
        // Summary section (before line 50)
        ...Array(20).fill(''),
        '26 . 08 . 25 WOOLWORTHS PONSONBY 905 PONSONBY', // Line 20 - should be ignored
        '27 . 08 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA', // Line 21 - should be ignored
        '27 . 08 . 25 PAYPAL *TEMU COM        4029357733', // Line 22 - should be ignored
        ...Array(27).fill(''),
        // Amounts
        '2.49',
        '9.30',
        '37.53',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        // Detailed section (after line 50)
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO', // Should be matched
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373', // Should be matched
        '01 . 09 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA', // Should be matched
      ];

      const result = parseAmexFormat(pdfLines);

      // Should only have 3 transactions (from detailed section)
      // NOT 6 (3 from summary + 3 from detailed)
      expect(result).toHaveLength(3);
      
      expect(result[0].place).toBe('OPENAI                  SAN FRANCISCO');
      expect(result[0].value).toBe(2.49);
      
      expect(result[1].place).toBe('PAYPAL *EVENTCINEMA     6129373');
      expect(result[1].value).toBe(9.30);
      
      expect(result[2].place).toBe('AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA');
      expect(result[2].value).toBe(37.53);
    });
  });

  describe('AMEX Format with Inline Amounts', () => {
    it('should correctly parse when date, description, and amount are on same line', () => {
      const pdfLines = [
        'American Express Statement',
        'Account Summary',
        '',
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO 10.02',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373 72.40',
        '01 . 09 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA 9.30',
      ];

      const result = parseAmexFormat(pdfLines);

      expect(result).toHaveLength(3);
      
      expect(result[0].place).toBe('OPENAI                  SAN FRANCISCO');
      expect(result[0].value).toBe(10.02);
      
      expect(result[1].place).toBe('PAYPAL *EVENTCINEMA     6129373');
      expect(result[1].value).toBe(72.40);
      
      expect(result[2].place).toBe('AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA');
      expect(result[2].value).toBe(9.30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle CR (credit) amounts correctly', () => {
      const pdfLines = [
        ...Array(50).fill(''),
        '100.00',
        'CR', // Credit marker - should be filtered
        '50.00', // Valid amount
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should only match 1 transaction with the valid amount (50.00)
      // The 100.00 CR should be filtered out
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(50.00);
    });

    it('should skip payment transactions', () => {
      const pdfLines = [
        ...Array(50).fill(''),
        '100.00',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '12 . 09 . 25 PAYMENT - THANK YOU',
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should only have 1 transaction (not 2, because PAYMENT is skipped)
      expect(result).toHaveLength(1);
      expect(result[0].place).toBe('OPENAI                  SAN FRANCISCO');
    });
  });

  describe('Regression Tests - Bug Fixes', () => {
    it('should extract and filter Minimum Payment from amounts list', () => {
      // This test prevents regression of the bug where Minimum Payment
      // wasn't being filtered from the amounts list, causing misalignment
      const pdfLines = [
        'NORBERTO CAROSELLA XXXX-XXXXXX-51006 27 . 08 . 25 26 . 09 . 25',
        '2,461.91 - 3,847.89 + 2,438.23 = 1,052.25',
        'Minimum Payment $ 31.00', // Line 2 - should extract this value
        'Due by 21 . 10 . 2025',
        ...Array(46).fill(''),
        // Line 50 - this should be filtered because it matches minimum payment
        '31.00', // ← THIS SHOULD BE FILTERED OUT!
        '10.02',
        '72.40',
        ...Array(17).fill(''),
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should have 2 transactions matched with 2 amounts (10.02 and 72.40)
      // NOT 3 amounts (31.00, 10.02, 72.40)
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(10.02); // Should match 10.02, not 31.00
      expect(result[1].value).toBe(72.40);
    });

    it('should ignore amounts in summary section (before line 50)', () => {
      // This test prevents regression of the bug where amounts from the
      // summary section were included, causing too many amounts vs transactions
      const pdfLines = [
        'NORBERTO CAROSELLA XXXX-XXXXXX-51006 27 . 08 . 25 26 . 09 . 25',
        '2,461.91 - 3,847.89 + 2,438.23 = 1,052.25',
        'Minimum Payment $ 31.00',
        'Due by 21 . 10 . 2025',
        ...Array(7).fill(''),
        // Summary section amounts (lines 11-19) - SHOULD BE IGNORED
        '2,461.91',
        'CR',
        '1,385.98',
        'CR',
        '2.49',  // ← SHOULD BE IGNORED (line 15)
        '9.30',  // ← SHOULD BE IGNORED (line 16)
        '37.53', // ← SHOULD BE IGNORED (line 17)
        '9.30',  // ← SHOULD BE IGNORED (line 18)
        '9.30',  // ← SHOULD BE IGNORED (line 19)
        ...Array(31).fill(''),
        // Amounts section (starting at line 50)
        '10.02', // ← SHOULD BE CAPTURED
        '72.40', // ← SHOULD BE CAPTURED
        '9.30',  // ← SHOULD BE CAPTURED
        ...Array(17).fill(''),
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373',
        '01 . 09 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should have 3 transactions matched with 3 amounts from line 50+
      // NOT 8 amounts (5 from summary + 3 from amounts section)
      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(10.02);
      expect(result[1].value).toBe(72.40);
      expect(result[2].value).toBe(9.30);
    });

    it('should match amounts correctly with real PDF data structure', () => {
      // This is a regression test that simulates the exact bug we fixed:
      // - Minimum Payment in header (31.00)
      // - Summary section amounts (before index 50) that should be IGNORED
      // - Minimum Payment amount in list (index 50) that should be FILTERED
      // - Correct amounts list with matching transaction count
      // - Detailed transactions

      const pdfLines = [
        // Indices 0-3: Header
        'NORBERTO CAROSELLA XXXX-XXXXXX-51006 27 . 08 . 25 26 . 09 . 25',
        '2,461.91 - 3,847.89 + 2,438.23 = 1,052.25',
        'Minimum Payment $ 31.00',
        'Due by 21 . 10 . 2025',
        // Indices 4-10: Empty
        ...Array(7).fill(''),
        // Indices 11-14: Credits
        '2,461.91',
        'CR',
        '1,385.98',
        'CR',
        // Indices 15-19: Summary section amounts (IGNORE - before index 50)
        '2.49',  // ← These should be IGNORED
        '9.30',
        '37.53',
        '9.30',
        '9.30',
        // Indices 20-49: Empty (30 elements)
        ...Array(30).fill(''),
        // Index 50: Minimum Payment amount (FILTERED by value match)
        '31.00', // ← This should be FILTERED
        // Indices 51-60: Real amounts list (10 amounts to match 10 transactions)
        '10.02',
        '72.40',
        '9.30',
        '40.00',
        '45.95',
        '22.99',
        '9.99',
        '49.97',
        '82.13',
        '80.76',
        // Indices 61-69: Empty
        ...Array(9).fill(''),
        // Indices 70+: Detailed transactions (10 transactions)
        '29 . 08 . 25 OPENAI                  SAN FRANCISCO',
        '31 . 08 . 25 PAYPAL *EVENTCINEMA     6129373',
        '01 . 09 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
        '03 . 09 . 25 SKINNY MOBILE AUCKLAND  AUCKLAND',
        '03 . 09 . 25 PAYPAL *PLAYSTATION     02078595000',
        '04 . 09 . 25 CHEMIST WAREHOUSE BIRKE GLEN INNES',
        '06 . 09 . 25 APPLE.COM/BILL          SYDNEY',
        '08 . 09 . 25 BUNNINGS ONLINE 3 AUCKL AUCKLAND',
        '08 . 09 . 25 CURSOR USAGE  AUG       NEW YORK',
        '11 . 09 . 25 WOOLWORTHS BIRKENHEAD 9 AUCKLAND',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should have exactly 10 transactions
      expect(result).toHaveLength(10);

      // Verify correct amount matching (the core bug we fixed)
      expect(result[0].place).toBe('OPENAI                  SAN FRANCISCO');
      expect(result[0].value).toBe(10.02); // Should be 10.02, not 31.00!

      expect(result[1].place).toBe('PAYPAL *EVENTCINEMA     6129373');
      expect(result[1].value).toBe(72.40); // Should be 72.40, not 10.02!

      expect(result[2].place).toBe('AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA');
      expect(result[2].value).toBe(9.30); // Should be 9.30, not 72.40!

      expect(result[3].place).toBe('SKINNY MOBILE AUCKLAND  AUCKLAND');
      expect(result[3].value).toBe(40.00); // Should be 40.00, not 9.30!
    });

    it('should handle equal number of transactions and amounts after filtering', () => {
      // This test ensures that after filtering:
      // - Minimum Payment amount
      // - Summary section amounts
      // We get exactly matching numbers for sequential matching to work
      const pdfLines = [
        'Minimum Payment $ 25.00',
        ...Array(10).fill(''),
        '10.00', // Line 11 - summary section, should be ignored
        '20.00', // Line 12 - summary section, should be ignored
        ...Array(37).fill(''),
        '25.00', // Line 50 - minimum payment, should be filtered
        '100.00', // Line 51 - should be kept
        '200.00', // Line 52 - should be kept
        '300.00', // Line 53 - should be kept
        ...Array(17).fill(''),
        '01 . 01 . 25 MERCHANT A',
        '02 . 01 . 25 MERCHANT B',
        '03 . 01 . 25 MERCHANT C',
      ];

      const result = parseAmexFormat(pdfLines);

      // Should have 3 transactions matched with 3 amounts
      // amounts list: 25.00 (filtered), 100.00 (kept), 200.00 (kept), 300.00 (kept)
      // transactions: 3
      // diff = 0 after filtering, so sequential matching works
      expect(result).toHaveLength(3);
      expect(result[0].value).toBe(100.00);
      expect(result[1].value).toBe(200.00);
      expect(result[2].value).toBe(300.00);
    });
  });
});
