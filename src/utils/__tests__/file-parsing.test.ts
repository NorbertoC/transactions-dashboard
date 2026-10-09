import { describe, it, expect } from 'vitest'
import {
  detectColumns,
  extractTransactions,
  mapBankCategoryToTaxonomy,
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

  it('keeps unapproved merchant proposals in review', () => {
    const columns = detectColumns(headerRows)
    const { rows } = extractTransactions(headerRows, columns)

    const groceries = rows.find((row) => row.place === 'COUNTDOWN AUCKLAND')
    expect(groceries?.category).toBe('Others')
    expect(groceries?.subcategory).toBe('Miscellaneous')

    const fuel = rows.find((row) => row.place === 'BP CONNECT GREENLANE')
    expect(fuel?.category).toBe('Others')
    expect(fuel?.subcategory).toBe('Miscellaneous')
  })

  it('skips everything when columns are null', () => {
    const { rows, skipped } = extractTransactions([['a', 'b']], null)
    expect(rows).toHaveLength(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toBe('Columns not detected')
  })
})


describe('Amex NZ CSV', () => {
  const amexRows = [
    [
      'Date',
      'Description',
      'Card Member',
      'Account #',
      'Amount',
      'Extended Details',
      'Appears On Your Statement As',
      'Address',
      'Town/City',
      'State/Province',
      'Postcode',
      'Country',
      'Reference',
      'Category'
    ],
    [
      '12/03/2026',
      'COUNTDOWN AUCKLAND',
      'NORBERTO C',
      'XXXX-1234',
      '45.60',
      '',
      'COUNTDOWN AUCKLAND',
      '"1 Queen St\nAuckland"',
      'Auckland',
      '',
      '1010',
      'New Zealand',
      'REF1',
      'Merchandise & Supplies-Groceries'
    ],
    [
      '13/03/2026',
      'PAYMENT - THANK YOU',
      'NORBERTO C',
      'XXXX-1234',
      '-500.00',
      '',
      'PAYMENT - THANK YOU',
      '',
      '',
      '',
      '',
      '',
      '',
      'Other-Other'
    ],
    [
      '14/03/2026',
      'BP CONNECT GREENLANE',
      'NORBERTO C',
      'XXXX-1234',
      '80.00',
      '',
      'BP CONNECT GREENLANE',
      '',
      'Auckland',
      '',
      '',
      'New Zealand',
      'REF2',
      'Transportation-Fuel'
    ]
  ]

  it('detects Amex headers including Category', () => {
    const columns = detectColumns(amexRows)
    expect(columns).toMatchObject({
      headerRowIndex: 0,
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 4,
      categoryColumn: 13
    })
  })

  it('excludes PAYMENT - THANK YOU and maps bank categories', () => {
    const { rows } = extractTransactions(amexRows, detectColumns(amexRows))
    expect(rows).toHaveLength(3)

    const payment = rows.find((row) => row.place === 'PAYMENT - THANK YOU')
    expect(payment?.include).toBe(false)
    expect(payment?.isCredit).toBe(true)

    const groceries = rows.find((row) => row.place === 'COUNTDOWN AUCKLAND')
    expect(groceries?.include).toBe(true)
    expect(groceries?.category).toBe('Basic living')
    expect(groceries?.subcategory).toBe('Food for home')

    const fuel = rows.find((row) => row.place === 'BP CONNECT GREENLANE')
    expect(fuel?.category).toBe('Basic living')
    expect(fuel?.subcategory).toBe('Fuel')
  })

  it('keeps software purpose unconfirmed despite a coarse bank food category', () => {
    const rows = [
      amexRows[0],
      [
        '15/03/2026',
        'OPENAI *CHATGPT SUBSCR SAN FRANCISCO',
        'NORBERTO C',
        'XXXX-1234',
        '35.00',
        '',
        'OPENAI *CHATGPT SUBSCR SAN FRANCISCO',
        '',
        'San Francisco',
        '',
        '',
        'United States',
        'REF3',
        'Merchandise & Supplies-Groceries'
      ]
    ]

    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    expect(parsed[0]).toMatchObject({
      category: 'Others',
      subcategory: 'Miscellaneous'
    })
  })
})

describe('mapBankCategoryToTaxonomy', () => {
  it('maps known Amex labels', () => {
    expect(mapBankCategoryToTaxonomy('Restaurant-Restaurant')).toEqual({
      category: 'Meals & outings',
      subcategory: 'Eating out'
    })
  })

  it('returns null for blank or unknown labels', () => {
    expect(mapBankCategoryToTaxonomy('')).toBeNull()
    expect(mapBankCategoryToTaxonomy('Completely Unknown Label XYZ')).toBeNull()
  })

  it.each([
    ['Retail & Grocery-Pharmacies', 'Personal purchases', 'Health'],
    ['Retail & Grocery-Groceries', 'Basic living', 'Food for home'],
    ['Retail & Grocery-Clothing Stores', 'Personal purchases', 'Clothing & footwear'],
    ['Retail & Grocery-Computer Supplies', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Electronics Stores', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Sporting Goods Stores', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-General Retail', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Online Purchases', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Department Stores', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Furnishing', 'Personal purchases', 'Home'],
    ['Entertainment-Restaurants', 'Meals & outings', 'Eating out'],
    ['Entertainment-Bars & Cafés', 'Others', 'Miscellaneous'],
    ['Entertainment-Other Entertainment', 'Others', 'Miscellaneous'],
    ['Travel & Transport-Fuel', 'Basic living', 'Fuel'],
    ['Travel & Transport-Taxis & Coach', 'Others', 'Miscellaneous'],
    ['Travel & Transport-Parking Charges', 'Personal purchases', 'Occasional mobility'],
    ['Travel & Transport-Airline', 'Travel', 'Tickets'],
    ['Travel & Transport-Travel Agencies', 'Others', 'Miscellaneous'],
    ['Travel & Transport-Accommodation', 'Travel', 'Accommodation'],
    ['Travel & Transport-Other Travel', 'Others', 'Miscellaneous'],
    ['Communications-Internet Communication', 'Basic living', 'Power & internet'],
    ['Finance-Government Services', 'Others', 'Miscellaneous'],
    ['Business Services-Other Services', 'Others', 'Miscellaneous'],
    ['Miscellaneous-Education', 'Work & Study', 'Courses & study'],
    ['Miscellaneous-Other', 'Others', 'Miscellaneous']
  ])(
    'maps the current Amex label %s without being confused by its family prefix',
    (label, category, subcategory) => {
      expect(mapBankCategoryToTaxonomy(label)).toEqual({ category, subcategory })
    }
  )

  it('keeps transport purpose unconfirmed instead of using incorrect internet metadata', () => {
    const rows = [
      ['Date', 'Description', 'Amount', 'Category'],
      [
        '22/06/2026',
        'SUICA KEITAIKESSAI TOKYO',
        '22.33',
        'Communications-Internet Communication'
      ]
    ]

    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    expect(parsed[0]).toMatchObject({
      category: 'Others',
      subcategory: 'Miscellaneous'
    })
  })

  it('keeps a review-only Apple suggestion behind the specific Amex subtype', () => {
    const rows = [
      ['Date', 'Description', 'Amount', 'Category'],
      ['22/06/2026', 'APPLE.COM/BILL SYDNEY', '129.99', 'Retail & Grocery-Online Purchases']
    ]

    const { rows: parsed } = extractTransactions(rows, detectColumns(rows))

    expect(parsed[0]).toMatchObject({
      category: 'Others',
      subcategory: 'Miscellaneous'
    })
  })
})
