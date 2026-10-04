import { describe, expect, it } from 'vitest';
import {
  categorizeMerchant,
  resolveImportedClassification,
  suggestCategoryForMerchant
} from '@/utils/classification';

import { extractTransactions, mapBankCategoryToTaxonomy } from '../file-parsing';

describe('merchant classification', () => {
  it.each([
    ['APPLE.COM/BILL SYDNEY', 'Others', 'Miscellaneous'],
    ['OPENAI *CHATGPT SUBSCR SAN FRANCISCO', 'Fun & Social', 'Subscriptions'],
    ['TOMMY HILFIGER ONEHUNGA', 'Personal spending', 'Hobbies & Shopping'],
    ['CHEMIST WAREHOUSE BIRKENHEAD', 'Groceries', 'Medicine & Supplements']
  ])('classifies %s using the specific merchant rule', (place, category, subcategory) => {
    expect(categorizeMerchant(place)).toEqual({ category, subcategory });
  });

  it('does not match short merchant tokens inside unrelated words', () => {
    expect(suggestCategoryForMerchant('MOBILIZE FITNESS AUCKLAND')).toBeNull();
    expect(suggestCategoryForMerchant('NICHOLAS MARKET')).toBeNull();
  });

  it('recognizes common glued and plural retail statement labels', () => {
    expect(categorizeMerchant('THEWAREHOUSEGLENFIELDMA')).toEqual({
      category: 'Groceries',
      subcategory: 'Household items'
    });
    expect(categorizeMerchant('FARMERS 1580')).toEqual({
      category: 'Personal spending',
      subcategory: 'Hobbies & Shopping'
    });
  });

  it('applies PayPal merchant overrides before generic category rules', () => {
    expect(categorizeMerchant('PAYPAL *LAUCOLLA CAFE')).toEqual({
      category: 'Others',
      subcategory: 'Miscellaneous'
    });
  });

  it.each([
    ['UBER EATS NZ', 'Fun & Social', 'Eating out'],
    ['BURGERFUEL PONSONBY', 'Fun & Social', 'Eating out'],
    ['MC DONALDS QUEEN ST', 'Fun & Social', 'Eating out'],
    ['APPLECOMBILL SYDNEY', 'Others', 'Miscellaneous'],
    ['AXBUSFARE AUCKLAND', 'Transport', 'Public transport'],
    ['PAYPAL *TWITCHINTER 4155626043', 'Others', 'Miscellaneous'],
    ['WINDCAVE*SALS PIZZA BIR AUCKLAND', 'Fun & Social', 'Eating out'],
    ['SUICA KEITAIKESSAI TOKYO', 'Transport', 'Public transport'],
    ['U-GO TRIANGLE ELLERSLIE', 'Transport', 'Fuel'],
    ['KURA SUSHI CHIBA', 'Fun & Social', 'Eating out'],
    ['SAWAMURA HARUNIRE TERRA NAGANO', 'Fun & Social', 'Eating out'],
    ['COCOKARAFINE KANAGAWA', 'Groceries', 'Medicine & Supplements'],
    ['TNF ONEHUNGA ONEHUNGA', 'Personal spending', 'Hobbies & Shopping'],
    ['TVNZ EVENT PASS AUCKLAND', 'Fun & Social', 'Travel & Entertainment'],
    ['AKL AIRPORT CARPARK AUCKLAND', 'Transport', 'Parking & Tolls'],
    ['HALLENSTEINS 51 AUCKLAND', 'Personal spending', 'Hobbies & Shopping'],
    ['SP NZ MUSCLE AUCKLAND', 'Groceries', 'Medicine & Supplements']
  ])('handles statement-specific alias %s', (place, category, subcategory) => {
    expect(categorizeMerchant(place)).toEqual({ category, subcategory });
  });

  it('keeps the public fallback for unknown merchants', () => {
    expect(categorizeMerchant('UNKNOWN LOCAL MERCHANT')).toEqual({
      category: 'Others',
      subcategory: 'Miscellaneous'
    });
  });

  it('marks ambiguous merchant-only classifications for review', () => {
    expect(suggestCategoryForMerchant('APPLE.COM/BILL SYDNEY')).toEqual({
      category: 'Fun & Social',
      subcategory: 'Subscriptions',
      confidence: 'review'
    });
    expect(suggestCategoryForMerchant('TRADEME TF1D PING WELLINGTON')).toMatchObject({
      confidence: 'review'
    });
  });
});

describe('unified import classification', () => {
  it.each([
    ['UBER EATS NZ', 'Fun & Social', 'Eating out'],
    ['CHEMIST WAREHOUSE BIRKENHEAD', 'Groceries', 'Medicine & Supplements'],
    ['AKL AIRPORT CARPARK AUCKLAND', 'Transport', 'Parking & Tolls'],
    ['PAYPAL *MIGHTY APE', 'Personal spending', 'Hobbies & Shopping'],
    ['PAYPAL *LAUCOLLA CAFE', 'Others', 'Miscellaneous'],
    ['MOBILIZE FITNESS AUCKLAND', 'Others', 'Miscellaneous'],
    ['NICHOLAS MARKET', 'Others', 'Miscellaneous']
  ])('classifies %s with specific rules', (place, category, subcategory) => {
    expect(categorizeMerchant(place)).toEqual({ category, subcategory });
  });
  it('keeps ambiguous suggestions for review', () => {
    expect(suggestCategoryForMerchant('APPLE.COM/BILL')).toHaveProperty('confidence', 'review');
    expect(categorizeMerchant('APPLE.COM/BILL')).toEqual({ category: 'Others', subcategory: 'Miscellaneous' });
  });
  it('preserves explicit choices on repeated normalization', () => {
    const pair = resolveImportedClassification('Housing', 'Rent', 'UBER EATS NZ');
    expect(pair).toEqual({ category: 'Housing', subcategory: 'Rent' });
    expect(resolveImportedClassification(pair.category, pair.subcategory, 'UBER EATS NZ')).toEqual(pair);
    expect(resolveImportedClassification('Housing', undefined, 'UBER EATS NZ')).toEqual({ category: 'Housing', subcategory: '' });
  });
  it('uses merchant rules when the bank label is generic Other', () => {
    const result = extractTransactions([['2026-09-12', 'UBER EATS NZ', '48.20', 'other-other']], {
      headerRowIndex: -1, dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3
    });
    expect(result.rows[0]).toMatchObject({ category: 'Fun & Social', subcategory: 'Eating out' });
    expect(mapBankCategoryToTaxonomy('housing-rent')).toEqual({ category: 'Housing', subcategory: 'Rent' });
  });
});


describe('production import precedence', () => {
  const columns = { headerRowIndex: -1, dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3 };
  it('retains specific merchant precedence over a broad bank mapping', () => {
    const result = extractTransactions([['2026-09-12', 'CHEMIST WAREHOUSE', '20', 'Retail & Grocery-Department Stores']], columns);
    expect(result.rows[0]).toMatchObject({ category: 'Groceries', subcategory: 'Medicine & Supplements' });
  });
  it('uses specific bank evidence when the merchant needs review', () => {
    const result = extractTransactions([['2026-09-12', 'APPLE.COM/BILL', '20', 'transportation-fuel']], columns);
    expect(result.rows[0]).toMatchObject({ category: 'Transport', subcategory: 'Fuel' });
  });
  it('does not promote a review-only suggestion when bank evidence is generic', () => {
    const result = extractTransactions([['2026-09-12', 'APPLE.COM/BILL', '20', 'other-other']], columns);
    expect(result.rows[0]).toMatchObject({ category: 'Others', subcategory: 'Miscellaneous' });
  });
  it('preserves production household subtype mapping', () => {
    expect(mapBankCategoryToTaxonomy('Retail & Grocery-Home supplies')).toEqual({ category: 'Groceries', subcategory: 'Household items' });
  });
});
