import { describe, expect, it } from 'vitest';
import { categorizeMerchant, resolveImportedClassification, suggestCategoryForMerchant } from '@/utils/classification';
import { extractTransactions, mapBankCategoryToTaxonomy } from '@/utils/file-parsing';

describe('purpose-based merchant classification', () => {
  it.each([
    ['APPLE.COM/BILL SYDNEY', 'Others', 'Miscellaneous'],
    ['OPENAI *CHATGPT SUBSCR SAN FRANCISCO', 'Others', 'Miscellaneous'],
    ['TOMMY HILFIGER ONEHUNGA', 'Personal needs', 'Clothing & footwear'],
    ['CHEMIST WAREHOUSE BIRKENHEAD', 'Personal needs', 'Health'],
    ['THEWAREHOUSEGLENFIELDMA', 'Others', 'Miscellaneous'],
    ['FARMERS 1580', 'Others', 'Miscellaneous'],
    ['PAYPAL *LAUCOLLA CAFE', 'Others', 'Miscellaneous'],
    ['UBER EATS NZ', 'Entertainment', 'Eating out'],
    ['BURGERFUEL PONSONBY', 'Entertainment', 'Eating out'],
    ['MC DONALDS QUEEN ST', 'Entertainment', 'Eating out'],
    ['APPLECOMBILL SYDNEY', 'Others', 'Miscellaneous'],
    ['AXBUSFARE AUCKLAND', 'Others', 'Miscellaneous'],
    ['PAYPAL *TWITCHINTER', 'Others', 'Miscellaneous'],
    ['WINDCAVE*SALS PIZZA BIR AUCKLAND', 'Entertainment', 'Eating out'],
    ['SUICA KEITAIKESSAI TOKYO', 'Others', 'Miscellaneous'],
    ['U-GO TRIANGLE ELLERSLIE', 'Others', 'Miscellaneous'],
    ['KURA SUSHI CHIBA', 'Entertainment', 'Eating out'],
    ['SAWAMURA HARUNIRE TERRA NAGANO', 'Entertainment', 'Eating out'],
    ['COCOKARAFINE KANAGAWA', 'Personal needs', 'Health'],
    ['TNF ONEHUNGA ONEHUNGA', 'Personal needs', 'Clothing & footwear'],
    ['TVNZ EVENT PASS AUCKLAND', 'Entertainment', 'Travel & events'],
    ['AKL AIRPORT CARPARK AUCKLAND', 'Others', 'Miscellaneous'],
    ['HALLENSTEINS 51 AUCKLAND', 'Personal needs', 'Clothing & footwear'],
    ['SP NZ MUSCLE AUCKLAND', 'Personal needs', 'Health'],
    ['PAYPAL *MIGHTY APE', 'Others', 'Miscellaneous'],
    ['NETFLIX', 'Entertainment', 'Streaming'],
    ['STEAM', 'Entertainment', 'Games & hobbies'],
    ['LANGUAGE LESSON', 'Work & learning', 'Education & training'],
  ])('classifies %s without inventing work use', (place, category, subcategory) => {
    expect(categorizeMerchant(place)).toEqual({ category, subcategory });
  });

  it.each(['MOBILIZE FITNESS AUCKLAND', 'NICHOLAS MARKET', 'UNKNOWN LOCAL MERCHANT'])('does not match unrelated short tokens in %s', place => {
    expect(suggestCategoryForMerchant(place)).toBeNull();
    expect(categorizeMerchant(place)).toEqual({ category: 'Others', subcategory: 'Miscellaneous' });
  });

  it.each(['OPENAI', 'CURSOR', 'PAYPAL *CLOUDFLARE', 'UBER ONE', 'BP CONNECT', 'AIR NEW ZEALAND'])('requires purpose review for %s', place => {
    expect(suggestCategoryForMerchant(place)).toMatchObject({ category: 'Others', subcategory: 'Purpose unconfirmed', confidence: 'review', reviewReason: 'purpose' });
  });
  it.each(['APPLE.COM/BILL', 'TRADEME TF1D PING', 'SAUNA COLLECTIVE', 'FARMERS'])('keeps ambiguous merchant identity in review for %s', place => {
    expect(suggestCategoryForMerchant(place)).toMatchObject({ confidence: 'review', reviewReason: 'merchant' });
  });
});

describe('import precedence and explicit purpose choices', () => {
  const columns = { headerRowIndex: -1, dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3 };
  const extract = (merchant: string, bankLabel: string) => extractTransactions([['2026-09-12', merchant, '20', bankLabel]], columns).rows[0];
  it('retains confirmed choices on repeated normalization', () => {
    const pair = resolveImportedClassification('Work & learning', 'Software & tools', 'OPENAI');
    expect(pair).toEqual({ category: 'Work & learning', subcategory: 'Software & tools' });
    expect(resolveImportedClassification(pair.category, pair.subcategory, 'OPENAI')).toEqual(pair);
    expect(resolveImportedClassification('Housing', undefined, 'UBER EATS NZ')).toEqual({ category: 'Home & daily living', subcategory: '' });
  });
  it('uses a precise health merchant over a broad department-store label', () => {
    expect(extract('CHEMIST WAREHOUSE', 'Retail & Grocery-Department Stores')).toMatchObject({ category: 'Personal needs', subcategory: 'Health' });
  });
  it('does not let a coarse bank label turn software or transport into household food/connectivity', () => {
    expect(extract('OPENAI', 'Merchandise & Supplies-Groceries')).toMatchObject({ category: 'Others', subcategory: 'Purpose unconfirmed' });
    expect(extract('SUICA KEITAIKESSAI', 'Communications-Internet Communication')).toMatchObject({ category: 'Others', subcategory: 'Purpose unconfirmed' });
  });
  it('can use specific clothing evidence when merchant identity is ambiguous', () => {
    expect(extract('APPLE.COM/BILL', 'Retail & Grocery-Clothing Stores')).toMatchObject({ category: 'Personal needs', subcategory: 'Clothing & footwear' });
  });
  it('keeps generic or unconfirmed evidence in review', () => {
    expect(extract('APPLE.COM/BILL', 'other-other')).toMatchObject({ category: 'Others', subcategory: 'Miscellaneous' });
    expect(extract('APPLE.COM/BILL', 'transportation-fuel')).toMatchObject({ category: 'Others', subcategory: 'Purpose unconfirmed' });
  });
  it('retains supported household and restaurant labels', () => {
    expect(mapBankCategoryToTaxonomy('Retail & Grocery-Home supplies')).toEqual({ category: 'Home & daily living', subcategory: 'Household items' });
    expect(mapBankCategoryToTaxonomy('housing-rent')).toEqual({ category: 'Home & daily living', subcategory: 'Rent' });
    expect(extract('UBER EATS', 'other-other')).toMatchObject({ category: 'Entertainment', subcategory: 'Eating out' });
  });
});
