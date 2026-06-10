import { describe, it, expect } from 'vitest'
import {
  detectColumns,
  extractTransactions,
  parseAmount,
  parseDateToIso
} from '@/utils/file-parsing'

describe('parseAmount', () => {
  it('parses plain decimals', () => {
    expect(parseAmount('12.34')).toBe(12.34)
  })

  it('strips currency symbols and thousands separators', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56)
    expect(parseAmount('NZ$ 45.00')).toBe(45)
  })

  it('treats parenthesised amounts as negative', () => {
    expect(parseAmount('(45.00)')).toBe(-45)
  })

  it('keeps explicit negative signs', () => {
    expect(parseAmount('-12.00')).toBe(-12)
  })

  it('passes finite numbers through', () => {
    expect(parseAmount(99.5)).toBe(99.5)
  })

  it('returns null for non-numeric input', () => {
    expect(parseAmount('COUNTDOWN AUCKLAND')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('12/03/2026')).toBeNull()
  })
})

describe('parseDateToIso', () => {
  it('accepts ISO dates', () => {
    expect(parseDateToIso('2026-03-12')).toBe('2026-03-12')
  })

  it('parses DD/MM/YYYY day-first', () => {
    expect(parseDateToIso('12/03/2026')).toBe('2026-03-12')
    expect(parseDateToIso('1/2/2026')).toBe('2026-02-01')
  })

  it('parses DD/MM/YY with a 2000s pivot', () => {
    expect(parseDateToIso('12/03/26')).toBe('2026-03-12')
  })

  it('parses DD-MM-YYYY and DD.MM.YY(YY)', () => {
    expect(parseDateToIso('12-03-2026')).toBe('2026-03-12')
    expect(parseDateToIso('12.03.26')).toBe('2026-03-12')
    expect(parseDateToIso('12.03.2026')).toBe('2026-03-12')
  })

  it("parses 'DD Mon YYYY'", () => {
    expect(parseDateToIso('12 Mar 2026')).toBe('2026-03-12')
    expect(parseDateToIso('5 December 2025')).toBe('2025-12-05')
  })

  it('rejects impossible and unparseable dates', () => {
    expect(parseDateToIso('31/02/2026')).toBeNull()
    expect(parseDateToIso('not a date')).toBeNull()
    expect(parseDateToIso('')).toBeNull()
  })
})

describe('detectColumns', () => {
  it('detects an ANZ-style header row', () => {
    const rows = [
      ['Date', 'Details', 'Amount'],
      ['12/03/2026', 'COUNTDOWN AUCKLAND', '-45.60'],
      ['13/03/2026', 'BP CONNECT GREENLANE', '-80.00']
    ]
    expect(detectColumns(rows)).toEqual({
      headerRowIndex: 0,
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2
    })
  })

  it('infers columns by content when there is no header', () => {
    const rows = [
      ['12/03/2026', 'COUNTDOWN AUCKLAND NZ', '45.60'],
      ['13/03/2026', 'BP CONNECT GREENLANE', '80.00'],
      ['14/03/2026', 'NETFLIX.COM', '18.99']
    ]
    expect(detectColumns(rows)).toEqual({
      headerRowIndex: -1,
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2
    })
  })

  it('infers columns regardless of order', () => {
    const rows = [
      ['18.99', 'NETFLIX.COM SUBSCRIPTION', '14 Mar 2026'],
      ['45.60', 'COUNTDOWN AUCKLAND NZ', '12 Mar 2026'],
      ['80.00', 'BP CONNECT GREENLANE', '13 Mar 2026']
    ]
    expect(detectColumns(rows)).toEqual({
      headerRowIndex: -1,
      dateColumn: 2,
      descriptionColumn: 1,
      amountColumn: 0
    })
  })

  it('returns null when nothing looks like transactions', () => {
    expect(detectColumns([['hello', 'world'], ['foo', 'bar']])).toBeNull()
    expect(detectColumns([])).toBeNull()
  })
})

describe('extractTransactions', () => {
  const headerRows = [
    ['Date', 'Details', 'Amount'],
    ['12/03/2026', 'COUNTDOWN AUCKLAND', '45.60'],
    ['13/03/2026', 'PAYMENT - THANK YOU', '-500.00'],
    ['14/03/2026', 'BP CONNECT GREENLANE', '80.00'],
    ['??', 'BROKEN ROW', 'abc']
  ]

  it('extracts rows, skipping the header and unparseable lines', () => {
    const columns = detectColumns(headerRows)
    const { rows, skipped } = extractTransactions(headerRows, columns)

    expect(rows).toHaveLength(3)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toBe('Unrecognised date')

    const [groceries] = rows
    expect(groceries.place).toBe('COUNTDOWN AUCKLAND')
    expect(groceries.dateIso).toBe('2026-03-12')
    expect(groceries.value).toBe(45.6)
    expect(groceries.isCredit).toBe(false)
    expect(groceries.include).toBe(true)
  })

  it('auto-excludes credits and card payments', () => {
    const columns = detectColumns(headerRows)
    const { rows } = extractTransactions(headerRows, columns)

    const payment = rows.find((row) => row.place === 'PAYMENT - THANK YOU')
    expect(payment?.isCredit).toBe(true)
    expect(payment?.include).toBe(false)
    expect(payment?.value).toBe(500)
  })

  it('marks negative amounts as credits in purchases-positive files', () => {
    const rows = [
      ['Date', 'Details', 'Amount'],
      ['12/03/2026', 'COUNTDOWN AUCKLAND', '45.60'],
      ['13/03/2026', 'BP CONNECT GREENLANE', '80.00'],
      ['14/03/2026', 'REFUND KMART', '(15.00)']
    ]
    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    const refund = parsed.find((row) => row.place === 'REFUND KMART')
    expect(refund?.isCredit).toBe(true)
    expect(refund?.include).toBe(false)
    expect(refund?.value).toBe(15)
  })

  it('keeps legitimate payment-named spending like RENT PAYMENT included', () => {
    const rows = [
      ['Date', 'Details', 'Amount'],
      ['12/03/2026', 'RENT PAYMENT', '650.00'],
      ['13/03/2026', 'COUNTDOWN AUCKLAND', '45.60']
    ]
    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    const rent = parsed.find((row) => row.place === 'RENT PAYMENT')
    expect(rent?.isCredit).toBe(false)
    expect(rent?.include).toBe(true)
  })

  it('inverts credit detection for debits-negative exports', () => {
    const rows = [
      ['Date', 'Details', 'Amount'],
      ['12/03/2026', 'COUNTDOWN AUCKLAND', '-45.60'],
      ['13/03/2026', 'BP CONNECT GREENLANE', '-80.00'],
      ['14/03/2026', 'NETFLIX.COM', '-18.99'],
      ['15/03/2026', 'REFUND KMART', '25.00'],
      ['16/03/2026', 'PAYMENT RECEIVED - THANK YOU', '500.00']
    ]
    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    const groceries = parsed.find((row) => row.place === 'COUNTDOWN AUCKLAND')
    expect(groceries?.isCredit).toBe(false)
    expect(groceries?.include).toBe(true)
    expect(groceries?.value).toBe(45.6)

    const refund = parsed.find((row) => row.place === 'REFUND KMART')
    expect(refund?.isCredit).toBe(true)
    expect(refund?.include).toBe(false)

    const payment = parsed.find((row) => row.place === 'PAYMENT RECEIVED - THANK YOU')
    expect(payment?.isCredit).toBe(true)
    expect(payment?.include).toBe(false)
  })

  it('auto-assigns categories from the merchant name', () => {
    const columns = detectColumns(headerRows)
    const { rows } = extractTransactions(headerRows, columns)

    const groceries = rows.find((row) => row.place === 'COUNTDOWN AUCKLAND')
    expect(groceries?.category).toBe('Groceries')
    expect(groceries?.subcategory).toBe('Food')

    const fuel = rows.find((row) => row.place === 'BP CONNECT GREENLANE')
    expect(fuel?.category).toBe('Transport')
    expect(fuel?.subcategory).toBe('Fuel')
  })

  it('skips everything when columns are null', () => {
    const { rows, skipped } = extractTransactions([['a', 'b']], null)
    expect(rows).toHaveLength(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toBe('Columns not detected')
  })
})
