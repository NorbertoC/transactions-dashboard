# PDF Parser Test Suite

## Overview

This test suite validates the PDF transaction parser for various bank statement formats, with a focus on American Express statements.

## Test Files

### 1. `parsers.test.ts` - Unit Tests

- Tests individual parsing functions and utilities
- Validates date parsing, amount formatting, and transaction object creation
- **Issue**: These tests only validate static data structures, not actual parsing logic

### 2. `integration.test.ts` - Integration Tests

- Tests expected output formats and data structures
- Validates field types, formats, and schema compliance
- **Issue**: These tests don't actually execute the parser - they only validate static examples

### 3. `real-parsing.test.ts` - Real Parsing Tests ✅

- **NEW**: Tests that actually execute the parser functions
- Simulates real PDF formats with separate amount lists
- Validates correct amount-to-transaction matching
- Tests edge cases like minimum payment filtering and summary section detection

### 4. `amount-matching.test.ts` - Amount Matching Tests ✅

- **NEW**: Documents and tests the specific bug that was found
- Tests summary section detection and filtering
- Validates minimum payment amount filtering
- Documents the exact amount misalignment issue

## The Bug That Was Found

### Problem

The parser was incorrectly:

1. **Including summary section transactions** (lines 26-30 in PDF) that should be ignored
2. **Not filtering minimum payment amounts** (31.00) from the amount list
3. **Misaligning amounts with transactions** due to count mismatches

### Root Cause

- The PDF has TWO sets of transactions:
  - Summary section (early in PDF) - should be ignored
  - Detailed section (later in PDF) - should be matched with amounts
- The parser was processing both sections
- Minimum payment amounts weren't being filtered out
- This caused sequential matching to fail and amounts to be misaligned

### Solution

- Added logic to skip transactions before line 50 (summary section)
- Enhanced minimum payment filtering with context detection
- Improved sequential matching with offset detection
- Added comprehensive logging for debugging

## Test Coverage

### Before (Original Tests)

- ❌ Only tested static data structures
- ❌ Never executed actual parsing logic
- ❌ Would not have caught the amount misalignment bug
- ❌ No tests for real-world PDF formats

### After (New Tests)

- ✅ Tests actually execute parser functions
- ✅ Simulates real PDF formats with separate amounts
- ✅ Validates amount-to-transaction matching
- ✅ Tests edge cases and filtering logic
- ✅ Documents specific bugs and expected behavior

## Running Tests

```bash
# Run all parser tests
npm run test -- --run src/app/api/upload-pdf/__tests__/

# Run specific test files
npm run test -- --run src/app/api/upload-pdf/__tests__/real-parsing.test.ts
npm run test -- --run src/app/api/upload-pdf/__tests__/amount-matching.test.ts
```

## Key Learnings

1. **Static tests are insufficient** - Need to test actual parsing logic
2. **Real-world formats are complex** - PDFs have multiple sections and edge cases
3. **Amount matching is critical** - Small misalignments cause major data issues
4. **Context matters** - Need to understand PDF structure to parse correctly
5. **Comprehensive logging** - Essential for debugging complex parsing issues

## Future Improvements

1. Add more real-world PDF samples to test suite
2. Test different bank statement formats
3. Add performance tests for large PDFs
4. Test error handling and edge cases
5. Add visual regression tests for parsed data
