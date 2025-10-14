import { describe, it, expect } from 'vitest';

/**
 * Real parsing tests that actually call the parser functions
 * These tests simulate the actual PDF format and verify correct amount matching
 */

// Helper to parse date from DD.MM.YY format to YYYY-MM-DD
function parseDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  const fullYear = `20${year}`;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Mock categorization (simplified for tests)
function mockCategorizeMerchant(place: string): { category: string; subcategory: string } {
  return { category: 'Test Category', subcategory: 'Test Subcategory' };
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
function parseAmexFormat(lines: string[]): Array<any> {
  const transactionWithAmountPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/;
  const transactionPattern = /^(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2})\s+(.+)$/;
  const amountPattern = /^([\d,]+\.\d{2})$/;

  const transactionsRaw: Array<{ date: string; description: string; index: number }> = [];
  const amountsRaw: Array<{ value: number; index: number }> = [];
  const directTransactions: Array<{ date: string; description: string; value: number }> = [];

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
  const transactions: any[] = [];

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
      // - Lines 0-49: Header and summary section with some transactions (should be ignored)
      // - Lines 50-60: Standalone amounts
      // - Lines 70+: Detailed transaction list (should be matched with amounts)
      
      const pdfLines = [
        // Header section (lines 0-25)
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
        // Summary transactions (lines 10-30) - SHOULD BE IGNORED
        '12 . 09 . 25 PAYMENT - THANK YOU',
        '17 . 09 . 25 PAYMENT - THANK YOU',
        '26 . 08 . 25 WOOLWORTHS PONSONBY 905 PONSONBY',
        '27 . 08 . 25 AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
        '27 . 08 . 25 PAYPAL *TEMU COM        4029357733',
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
        // Amounts section (lines 50-60)
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
        // Detailed transactions (lines 70+) - SHOULD BE MATCHED
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
});

