import { describe, expect, it } from 'vitest';
import {
  categorizeMerchant,
  suggestCategoryForMerchant
} from '@/utils/classification';

describe('merchant classification', () => {
  it.each([
    ['APPLE.COM/BILL SYDNEY', 'Fun & Social', 'Subscriptions'],
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
    ['APPLECOMBILL SYDNEY', 'Fun & Social', 'Subscriptions'],
    ['AXBUSFARE AUCKLAND', 'Transport', 'Public transport'],
    ['PAYPAL *TWITCHINTER 4155626043', 'Fun & Social', 'Subscriptions'],
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
