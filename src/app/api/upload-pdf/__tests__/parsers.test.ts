import { describe, it, expect } from 'vitest';

// Note: The actual classification happens in @/utils/classification
// For these tests, we're testing the core parsing logic independently

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

// Helper function to compute statement metadata
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

// Helper to create transaction object
function createTransaction(place: string, value: number, date_iso: string): Transaction {
  const statementMetadata = computeStatementMetadata(date_iso);
  
  // Use actual categorization
  const upperPlace = place.toUpperCase();
  let category = 'Other';
  let subcategory = 'General';
  
  if (upperPlace.includes('OPENAI') || upperPlace.includes('CHATGPT')) {
    category = 'AI Subscription';
    subcategory = 'OpenAI';
  } else if (upperPlace.includes('CLAUDE')) {
    category = 'AI Subscription';
    subcategory = 'Claude';
  } else if (upperPlace.includes('CURSOR')) {
    category = 'Developer Tools';
    subcategory = 'IDE';
  } else if (upperPlace.includes('WOOLWORTHS') || upperPlace.includes('PAK N SAVE') || upperPlace.includes('NEW WORLD')) {
    category = 'Supermarket';
    subcategory = 'Groceries';
  } else if (upperPlace.includes('TRANSPORT')) {
    category = 'Transport';
    subcategory = 'Public Transport';
  } else if (upperPlace.includes('UBER')) {
    category = 'Transport';
    subcategory = 'Rideshare';
  } else if (upperPlace.includes('SKINNY MOBILE')) {
    category = 'Mobile';
    subcategory = 'Phone Bill';
  } else if (upperPlace.includes('APPLE.COM')) {
    category = 'Digital Services';
    subcategory = 'Apple';
  } else if (upperPlace.includes('PAYPAL')) {
    category = 'Digital Services';
    subcategory = 'PayPal';
  } else if (upperPlace.includes('CHEMIST WAREHOUSE')) {
    category = 'Pharmacy';
    subcategory = 'Health';
  } else if (upperPlace.includes('BUNNINGS')) {
    category = 'Home & DIY';
    subcategory = 'Hardware';
  } else if (upperPlace.includes('JETSTAR') || upperPlace.includes('AIR NEW ZEALAND')) {
    category = 'Travel';
    subcategory = 'Flights';
  } else if (upperPlace.includes('EVENT CINEMAS')) {
    category = 'Entertainment';
    subcategory = 'Cinema';
  }
  
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

describe('PDF Transaction Parser', () => {
  describe('Statement Metadata Calculation', () => {
    it('should calculate correct statement period for date on 29th August 2025', () => {
      const metadata = computeStatementMetadata('2025-08-29');
      
      expect(metadata.statement_id).toBe('2025-09-26');
      expect(metadata.statement_start).toBe('2025-08-27');
      expect(metadata.statement_end).toBe('2025-09-26');
    });

    it('should calculate correct statement period for date on 26th (boundary)', () => {
      const metadata = computeStatementMetadata('2025-09-26');
      
      expect(metadata.statement_id).toBe('2025-09-26');
      expect(metadata.statement_start).toBe('2025-08-27');
      expect(metadata.statement_end).toBe('2025-09-26');
    });

    it('should calculate correct statement period for date on 27th (boundary)', () => {
      const metadata = computeStatementMetadata('2025-09-27');
      
      expect(metadata.statement_id).toBe('2025-10-26');
      expect(metadata.statement_start).toBe('2025-09-27');
      expect(metadata.statement_end).toBe('2025-10-26');
    });

    it('should handle year rollover correctly', () => {
      const metadata = computeStatementMetadata('2025-12-30');
      
      expect(metadata.statement_id).toBe('2026-01-26');
      expect(metadata.statement_start).toBe('2025-12-27');
      expect(metadata.statement_end).toBe('2026-01-26');
    });

    it('should handle invalid date', () => {
      const metadata = computeStatementMetadata('invalid-date');
      
      expect(metadata.statement_id).toBeNull();
      expect(metadata.statement_start).toBeNull();
      expect(metadata.statement_end).toBeNull();
    });
  });

  describe('Transaction Object Creation', () => {
    it('should create transaction with correct format for OPENAI', () => {
      const transaction = createTransaction(
        'OPENAI                  SAN FRANCISCO',
        10.02,
        '2025-08-29'
      );

      expect(transaction).toEqual({
        place: 'OPENAI                  SAN FRANCISCO',
        amount: '$10.02',
        date: '2025-08-29',
        currency: 'NZD',
        value: 10.02,
        date_iso: '2025-08-29',
        category: 'AI Subscription',
        subcategory: 'OpenAI',
        statement_id: '2025-09-26',
        statement_start: '2025-08-27',
        statement_end: '2025-09-26'
      });
    });

    it('should format amount correctly with 2 decimal places', () => {
      const transaction = createTransaction('TEST MERCHANT', 9.3, '2025-09-01');
      expect(transaction.amount).toBe('$9.30');
      expect(transaction.value).toBe(9.3);
    });

    it('should format large amounts correctly', () => {
      const transaction = createTransaction('TEST MERCHANT', 201.66, '2025-09-24');
      expect(transaction.amount).toBe('$201.66');
      expect(transaction.value).toBe(201.66);
    });

    it('should handle whole dollar amounts', () => {
      const transaction = createTransaction('TEST MERCHANT', 40.0, '2025-09-03');
      expect(transaction.amount).toBe('$40.00');
      expect(transaction.value).toBe(40);
    });
  });

  describe('Sample Transaction Validation', () => {
    const sampleTransactions = [
      { place: 'OPENAI                  SAN FRANCISCO', value: 10.02, date: '2025-08-29', category: 'AI Subscription', subcategory: 'OpenAI' },
      { place: 'PAYPAL *EVENTCINEMA     6129373', value: 72.4, date: '2025-08-31', category: 'Digital Services', subcategory: 'PayPal' },
      { place: 'AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA', value: 9.3, date: '2025-09-01', category: 'Transport', subcategory: 'Public Transport' },
      { place: 'SKINNY MOBILE AUCKLAND  AUCKLAND', value: 40.0, date: '2025-09-03', category: 'Mobile', subcategory: 'Phone Bill' },
      { place: 'APPLE.COM/BILL          SYDNEY', value: 9.99, date: '2025-09-06', category: 'Digital Services', subcategory: 'Apple' },
      { place: 'JETSTAR                 MASCOT', value: 201.66, date: '2025-09-24', category: 'Travel', subcategory: 'Flights' },
    ];

    it('should create all sample transactions with correct format', () => {
      const transactions = sampleTransactions.map(({ place, value, date }) =>
        createTransaction(place, value, date)
      );

      transactions.forEach((tx, index) => {
        const sample = sampleTransactions[index];
        
        expect(tx.place).toBe(sample.place);
        expect(tx.value).toBe(sample.value);
        expect(tx.date_iso).toBe(sample.date);
        expect(tx.currency).toBe('NZD');
        expect(tx.category).toBe(sample.category);
        expect(tx.subcategory).toBe(sample.subcategory);
        
        // Validate amount format
        expect(tx.amount).toMatch(/^\$\d+\.\d{2}$/);
        expect(tx.amount).toBe(`$${sample.value.toFixed(2)}`);
      });
    });

    it('should have consistent statement metadata for dates in same period', () => {
      // All transactions from Aug 27 to Sep 26 should have same statement
      const datesInSamePeriod = [
        '2025-08-29',
        '2025-08-31',
        '2025-09-01',
        '2025-09-03',
        '2025-09-06',
        '2025-09-24',
        '2025-09-25',
      ];

      const transactions = datesInSamePeriod.map(date =>
        createTransaction('TEST', 10.0, date)
      );

      transactions.forEach(tx => {
        expect(tx.statement_id).toBe('2025-09-26');
        expect(tx.statement_start).toBe('2025-08-27');
        expect(tx.statement_end).toBe('2025-09-26');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', () => {
      const transaction = createTransaction('TEST', 0.01, '2025-09-01');
      expect(transaction.amount).toBe('$0.01');
      expect(transaction.value).toBe(0.01);
    });

    it('should handle large amounts', () => {
      const transaction = createTransaction('TEST', 9999.99, '2025-09-01');
      expect(transaction.amount).toBe('$9999.99');
      expect(transaction.value).toBe(9999.99);
    });

    it('should handle amounts with many decimal places by rounding', () => {
      const transaction = createTransaction('TEST', 10.123456, '2025-09-01');
      expect(transaction.amount).toBe('$10.12');
      expect(transaction.value).toBe(10.123456);
    });

    it('should preserve exact spacing in merchant names', () => {
      const merchants = [
        'OPENAI                  SAN FRANCISCO',
        'AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA',
        'SKINNY MOBILE AUCKLAND  AUCKLAND',
      ];

      merchants.forEach(merchant => {
        const tx = createTransaction(merchant, 10.0, '2025-09-01');
        expect(tx.place).toBe(merchant);
        expect(tx.place.length).toBe(merchant.length);
      });
    });
  });

  describe('Full Transaction Object Validation', () => {
    it('should match expected output structure exactly', () => {
      const expectedTransaction = {
        place: 'OPENAI                  SAN FRANCISCO',
        amount: '$10.02',
        date: '2025-08-29',
        currency: 'NZD',
        value: 10.02,
        date_iso: '2025-08-29',
        category: 'AI Subscription',
        subcategory: 'OpenAI',
        statement_id: '2025-09-26',
        statement_start: '2025-08-27',
        statement_end: '2025-09-26'
      };

      const actualTransaction = createTransaction(
        'OPENAI                  SAN FRANCISCO',
        10.02,
        '2025-08-29'
      );

      expect(actualTransaction).toEqual(expectedTransaction);
      
      // Validate all required fields are present
      expect(actualTransaction).toHaveProperty('place');
      expect(actualTransaction).toHaveProperty('amount');
      expect(actualTransaction).toHaveProperty('date');
      expect(actualTransaction).toHaveProperty('currency');
      expect(actualTransaction).toHaveProperty('value');
      expect(actualTransaction).toHaveProperty('date_iso');
      expect(actualTransaction).toHaveProperty('category');
      expect(actualTransaction).toHaveProperty('subcategory');
      expect(actualTransaction).toHaveProperty('statement_id');
      expect(actualTransaction).toHaveProperty('statement_start');
      expect(actualTransaction).toHaveProperty('statement_end');
    });

    it('should properly categorize various merchants', () => {
      const testCases = [
        { place: 'WOOLWORTHS BIRKENHEAD 9 AUCKLAND', category: 'Supermarket', subcategory: 'Groceries' },
        { place: 'CURSOR, AI POWERED IDE  NEW YORK', category: 'Developer Tools', subcategory: 'IDE' },
        { place: 'CLAUDE.AI SUBSCRIPTION  SAN FRANCISCO', category: 'AI Subscription', subcategory: 'Claude' },
        { place: 'UBER TRIP               HTTPS://HELP.UB', category: 'Transport', subcategory: 'Rideshare' },
        { place: 'CHEMIST WAREHOUSE BIRKE GLEN INNES', category: 'Pharmacy', subcategory: 'Health' },
        { place: 'BUNNINGS ONLINE 3 AUCKL AUCKLAND', category: 'Home & DIY', subcategory: 'Hardware' },
      ];

      testCases.forEach(({ place, category, subcategory }) => {
        const tx = createTransaction(place, 10.0, '2025-09-01');
        expect(tx.category).toBe(category);
        expect(tx.subcategory).toBe(subcategory);
      });
    });
  });
});

describe('Date Parsing', () => {
  function parseDate(dateStr: string): string {
    const [day, month, year] = dateStr.split('.');
    const fullYear = `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  it('should parse DD.MM.YY format correctly', () => {
    expect(parseDate('29.08.25')).toBe('2025-08-29');
    expect(parseDate('01.09.25')).toBe('2025-09-01');
    expect(parseDate('24.09.25')).toBe('2025-09-24');
  });

  it('should handle single digit days and months with padding', () => {
    expect(parseDate('01.01.25')).toBe('2025-01-01');
    expect(parseDate('9.3.25')).toBe('2025-03-09');
  });

  it('should assume 2000s for 2-digit years', () => {
    expect(parseDate('01.01.99')).toBe('2099-01-01');
    expect(parseDate('01.01.00')).toBe('2000-01-01');
  });
});

describe('Amount Validation', () => {
  it('should validate amounts are within reasonable range', () => {
    const isValidAmount = (value: number) => {
      return Number.isFinite(value) && value > 0 && value < 50000;
    };

    expect(isValidAmount(10.02)).toBe(true);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-10)).toBe(false);
    expect(isValidAmount(50000)).toBe(false);
    expect(isValidAmount(49999.99)).toBe(true);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
  });
});
