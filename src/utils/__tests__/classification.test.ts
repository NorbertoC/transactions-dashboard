import { describe, expect, it } from 'vitest';
import { categorizeMerchant, getLocalizedSuggestionReason, resolveImportedClassification, suggestCategoryForMerchant } from '@/utils/classification';
import { extractTransactions, mapBankCategoryToTaxonomy } from '@/utils/file-parsing';

const review = { category: 'Others', subcategory: 'Miscellaneous' };
describe('purpose-v3 explicit proposals', () => {
  it.each([
    ['KOGAN MOBILE', 'Basic living', 'Phone'],
    ['MERCURY ENERGY', 'Basic living', 'Power & internet'],
    ['AXBUSFARE AUCKLAND', 'Basic living', 'Transport'],
    ['CAR INSURANCE', 'Basic living', 'Transport'],
    ['BP CONNECT', 'Basic living', 'Transport'],
    ['HEALTH INSURANCE', 'Personal needs & purchases', 'Health'],
    ['CHEMIST WAREHOUSE', 'Personal needs & purchases', 'Health'],
    ['TOMMY HILFIGER', 'Personal needs & purchases', 'Clothing & footwear'],
    ['BRISCOES', 'Personal needs & purchases', 'Purchases for home'],
    ['OPENAI', 'Work & learning', 'Software & tools'],
    ['CURSOR', 'Work & learning', 'Software & tools'],
    ['WORK LAPTOP', 'Work & learning', 'Equipment & training'],
    ['NETFLIX', 'Personal subscriptions', 'Streaming & content'],
    ['UBER ONE', 'Personal subscriptions', 'Memberships & other services'],
    ['UBER EATS', 'Outings & entertainment', 'Meals & treats'],
    ['ALFAJORES ONLINE', 'Outings & entertainment', 'Meals & treats'],
    ['EVENT CINEMA', 'Outings & entertainment', 'Activities & entertainment'],
    ['AIR NEW ZEALAND', 'Travel', 'Tickets & transfers'],
    ['AIRBNB', 'Travel', 'Accommodation'],
    ['TRAVEL MEAL', 'Travel', 'Meals & activities during travel'],
  ])('proposes %s with reason and explicit confirmation, never auto-applies', (merchant, category, subcategory) => {
    const suggestion = suggestCategoryForMerchant(merchant);
    expect(suggestion).toMatchObject({ category, subcategory, confidence: 'medium', requiresConfirmation: true });
    expect(suggestion?.reason).toBeTruthy();
    expect(categorizeMerchant(merchant)).toEqual(review);
  });
  it.each(['AMAZON', 'AMAZON NETFLIX', 'PAYPAL *CLOUDFLARE', 'PAYPAL *ALFAJORES', 'APPLE.COM/BILL', 'KOGAN', 'INSURANCE', 'EQUIPMENT', 'TRADEME'])('leaves ambiguous %s unknown instead of inferring purpose', merchant => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ ...review, confidence: 'unknown', requiresConfirmation: true });
  });
  it.each(['MOBILIZE FITNESS', 'NICHOLAS MARKET', 'UNKNOWN LOCAL MERCHANT'])('does not match unrelated tokens in %s', merchant => {
    expect(suggestCategoryForMerchant(merchant)).toBeNull();
    expect(categorizeMerchant(merchant)).toEqual(review);
  });
  it('retains explicit blank and custom import labels without merchant fallback', () => {
    expect(resolveImportedClassification('Shopping', '', 'NETFLIX', 'manual')).toEqual({ category: 'Shopping', subcategory: '' });
    expect(resolveImportedClassification('Custom', 'User choice', 'OPENAI')).toEqual({ category: 'Custom', subcategory: 'User choice' });
    expect(resolveImportedClassification('Basic living', '', 'ALFAJORES')).toEqual({ category: 'Basic living', subcategory: '' });
  });
});

describe('specific bank evidence without merchant assignment', () => {
  const columns = { headerRowIndex: -1, dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3 };
  const extract = (merchant: string, bank: string) => extractTransactions([['2026-09-12', merchant, '20', bank]], columns).rows[0];
  it.each([
    ['insurance-car insurance', 'Basic living', 'Transport'],
    ['Retail & Grocery-health insurance', 'Personal needs & purchases', 'Health'],
    ['Retail & Grocery-Computer Supplies', 'Others', 'Miscellaneous'],
    ['Retail & Grocery-Equipment', 'Others', 'Miscellaneous'],
    ['Communications-Telephone Telecom', 'Basic living', 'Phone'],
    ['Communications-Internet Communication', 'Basic living', 'Power & internet'],
    ['Travel & Transport-Airline', 'Travel', 'Tickets & transfers'],
    ['Travel & Transport-Accommodation', 'Travel', 'Accommodation'],
    ['Retail & Grocery-Furnishing', 'Personal needs & purchases', 'Purchases for home'],
  ])('maps evidence %s without using a misleading family prefix', (label, category, subcategory) => {
    expect(mapBankCategoryToTaxonomy(label)).toEqual({ category, subcategory });
  });
  it.each(['OPENAI', 'BRISCOES', 'CAR INSURANCE', 'WORK LAPTOP', 'ALFAJORES ONLINE'])('does not misclassify %s as food from a contradictory bank label', merchant => {
    expect(extract(merchant, 'Retail & Grocery-Groceries')).toMatchObject(review);
  });
  it('does not auto-apply merchant proposals on a generic import', () => {
    expect(extract('NETFLIX', 'other-other')).toMatchObject(review);
    expect(extract('BRISCOES', '')).toMatchObject(review);
  });
});

it('provides reasons in EN/ES/JA for both known proposals and unknown purpose', () => {
  for (const merchant of ['ALFAJORES', 'PAYPAL']) {
    const suggestion = suggestCategoryForMerchant(merchant)!;
    for (const locale of ['en', 'es', 'ja'] as const) expect(getLocalizedSuggestionReason(suggestion, locale)).toBeTruthy();
    expect(getLocalizedSuggestionReason(suggestion, 'es')).not.toBe(getLocalizedSuggestionReason(suggestion, 'en'));
  }
});
