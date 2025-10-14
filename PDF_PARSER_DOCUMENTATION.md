# PDF Transaction Parser Documentation

## Overview

This document describes the enhanced PDF transaction parser that can handle multiple bank statement formats and produce consistent, structured transaction data.

## Output Format

The parser produces transaction objects with the following structure:

```json
{
  "place": "OPENAI                  SAN FRANCISCO",
  "amount": "$10.02",
  "date": "2025-08-29",
  "currency": "NZD",
  "value": 10.02,
  "date_iso": "2025-08-29",
  "category": "AI Subscription",
  "subcategory": "OpenAI",
  "statement_id": "2025-09-26",
  "statement_start": "2025-08-27",
  "statement_end": "2025-09-26"
}
```

### Field Descriptions

| Field             | Type         | Description                                        |
| ----------------- | ------------ | -------------------------------------------------- |
| `place`           | string       | Merchant name (preserves exact spacing from PDF)   |
| `amount`          | string       | Formatted amount with dollar sign (e.g., "$10.02") |
| `date`            | string       | Transaction date in ISO format (YYYY-MM-DD)        |
| `currency`        | string       | Currency code (currently always "NZD")             |
| `value`           | number       | Numeric value of the transaction                   |
| `date_iso`        | string       | Transaction date in ISO format (YYYY-MM-DD)        |
| `category`        | string       | Transaction category from classification           |
| `subcategory`     | string       | Transaction subcategory from classification        |
| `statement_id`    | string\|null | Statement period identifier                        |
| `statement_start` | string\|null | Statement period start date                        |
| `statement_end`   | string\|null | Statement period end date                          |

## Supported Formats

The parser automatically detects and handles multiple PDF statement formats:

### 1. American Express Format

**Pattern 1: Single line with date, description, and amount**

```
DD . MM . YY MERCHANT NAME                      AMOUNT
29 . 08 . 25 OPENAI                  SAN FRANCISCO 10.02
```

**Pattern 2: Date and description on one line, amount on next**

```
DD . MM . YY MERCHANT NAME
AMOUNT
```

### 2. Standard Bank Format

**Pattern: DD/MM/YYYY or DD-MM-YYYY**

```
29/08/2025    MERCHANT NAME    $10.02
```

### 3. Tabular Format

**Pattern: Clear column structure with multiple spaces**

```
29/08/2025      MERCHANT NAME      $10.02
```

### 4. New Zealand Bank Format

**Pattern 1: DD MMM YYYY**

```
29 Aug 2025    MERCHANT NAME    $10.02
```

**Pattern 2: DD/MM/YY**

```
29/08/25    MERCHANT NAME    $10.02
```

**Pattern 3: YYYY-MM-DD**

```
2025-08-29    MERCHANT NAME    10.02
```

## Features

### 1. Multi-Format Detection

- Automatically tries each parser format
- Uses the first format that successfully finds transactions
- No manual format selection required

### 2. Automatic Categorization

- Categorizes merchants using the classification system
- Supports multiple categories and subcategories
- Preserves existing classification logic

### 3. Statement Period Calculation

- Automatically calculates statement period (27th to 26th)
- Handles month and year rollovers
- Generates statement ID, start date, and end date

### 4. Data Validation

- Validates amounts are positive and reasonable (< $50,000)
- Checks for valid dates
- Filters out payment/credit entries
- Prevents duplicate transactions

### 5. Enhanced Debugging

When no transactions are found, the parser provides:

- First 50 lines of extracted PDF text
- Pattern analysis for dates and amounts
- Currency symbol detection
- Total line count

## Amount Formatting

- All amounts are formatted with exactly 2 decimal places
- Format: `$XX.XX`
- Examples:
  - `9.3` → `$9.30`
  - `40.0` → `$40.00`
  - `10.02` → `$10.02`
  - `201.66` → `$201.66`

## Date Handling

### Input Formats Supported

- `DD.MM.YY` → Converted to `YYYY-MM-DD`
- `DD/MM/YYYY` → Converted to `YYYY-MM-DD`
- `DD-MM-YYYY` → Converted to `YYYY-MM-DD`
- `DD MMM YYYY` → Converted to `YYYY-MM-DD`
- `YYYY-MM-DD` → Used as-is

### Statement Period Logic

- Statement period: 27th of one month to 26th of next month
- Dates on or before the 26th belong to that month's statement
- Dates after the 26th belong to the next month's statement
- Example: All dates from Aug 27 to Sep 26 have statement_id = "2025-09-26"

## Testing

### Unit Tests (21 tests)

Located in: `src/app/api/upload-pdf/__tests__/parsers.test.ts`

Tests cover:

- Statement metadata calculation
- Transaction object creation
- Amount formatting
- Date parsing
- Edge cases (small/large amounts, boundary dates)
- Merchant categorization

### Integration Tests (12 tests)

Located in: `src/app/api/upload-pdf/__tests__/integration.test.ts`

Tests cover:

- Multiple PDF format parsing
- Output format validation
- Real-world transaction examples
- Date conversion
- Amount validation
- Statement period calculation

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- run __tests__/parsers.test.ts
npm test -- run __tests__/integration.test.ts

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Usage

### Upload PDF via API

```typescript
const formData = new FormData();
formData.append("file", pdfFile);

const response = await fetch("/api/upload-pdf", {
  method: "POST",
  body: formData,
});

const result = await response.json();
// result.transactions contains the parsed transactions
// result.count shows number of new transactions
// result.duplicateCount shows number of duplicates skipped
```

### Expected Response

```json
{
  "success": true,
  "transactions": [...],
  "count": 42,
  "duplicateCount": 3,
  "updated": 1,
  "saved": true
}
```

## Error Handling

### No Transactions Found

If no transactions can be parsed, the API will:

1. Return 200 OK with empty transactions array
2. Log detailed debugging information:
   - First 50 lines of PDF text
   - Pattern matches for dates/amounts
   - Currency symbol occurrences

### Duplicate Detection

The parser checks for duplicates using:

- Transaction date (date_iso)
- Merchant name (place, normalized)

If a duplicate is found with different values:

- The existing transaction is updated
- The update count is returned

### PDF Parsing Errors

If PDF cannot be read:

- Returns 500 error
- Logs error details
- Returns error message in response

## Merchant Name Preservation

The parser preserves exact spacing in merchant names as they appear in the PDF:

- `"OPENAI                  SAN FRANCISCO"` (multiple spaces preserved)
- `"AT PUBLIC TRANSPORT AT  AUCKLAND CENTRA"` (double space preserved)
- `"SKINNY MOBILE AUCKLAND  AUCKLAND"` (spacing maintained)

This ensures consistency with the original statement and helps with duplicate detection.

## Database Schema Compatibility

The parser output matches the database schema:

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place TEXT NOT NULL,
  amount TEXT NOT NULL,
  date TEXT NOT NULL,
  currency TEXT NOT NULL,
  value REAL NOT NULL,
  date_iso TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  statement_id TEXT,
  statement_start TEXT,
  statement_end TEXT
)
```

## Extending the Parser

### Adding a New Format

To add support for a new PDF format:

1. Create a new parser function in `route.ts`:

```typescript
function parseNewBankFormat(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];

  // Your parsing logic here
  const pattern = /your-regex-pattern/;

  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) continue;

    // Extract data and create transaction
    transactions.push(createTransaction(place, value, date_iso));
  }

  return transactions;
}
```

2. Add the parser to the list in `extractTransactions()`:

```typescript
const parsers = [
  parseAmexFormat,
  parseStandardBankFormat,
  parseTabularFormat,
  parseNZBankFormat,
  parseNewBankFormat, // Add your parser here
];
```

### Customizing Categorization

The categorization logic is in `src/utils/classification.ts`. Modify the `categorizeMerchant()` function to add new categories or improve existing ones.

## Performance

- Parsing a typical statement (30-50 transactions): < 100ms
- Database insertion (bulk): < 500ms
- Total upload time: < 1 second for typical statements

## Limitations

- Maximum transaction amount: $50,000 (transactions above this are filtered)
- Date format assumption: 2-digit years are assumed to be 20XX
- Currency: Currently only handles NZD
- PDF libraries: Uses `pdfreader` which works best with text-based PDFs (not scanned images)

## Future Improvements

Potential enhancements:

1. Support for scanned PDF statements (OCR)
2. Multi-currency support
3. Configurable statement period logic
4. Machine learning-based format detection
5. Support for credit transactions (currently filtered out)
6. PDF template recognition
