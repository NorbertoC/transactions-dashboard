import { afterEach, describe, expect, it, vi } from 'vitest';
import { categorizeMerchant, getLocalizedSuggestionReason, resolveImportedClassification, suggestCategoryForMerchant } from '@/utils/classification';
import { extractTransactions, mapBankCategoryToTaxonomy } from '@/utils/file-parsing';

const review = { category: 'Others', subcategory: 'Miscellaneous' };
afterEach(() => vi.unstubAllGlobals());

describe('purpose-v4 explicit proposals', () => {
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
    ['OPENAI SUBSCRIPTION', 'Subscriptions', 'Work'],
    ['OPENAI *CHATGPT SUBSCR SAN FRANCISCO', 'Subscriptions', 'Work'],
    ['CHATGPT SUBSCRIPTION', 'Subscriptions', 'Work'],
    ['CURSOR PRO', 'Subscriptions', 'Work'],
    ['OPENAI', 'Work & learning', 'Software & tools'],
    ['CURSOR', 'Work & learning', 'Software & tools'],
    ['WORK LAPTOP', 'Work & learning', 'Equipment & training'],
    ['NETFLIX', 'Subscriptions', 'Entertainment'],
    ['UBER ONE', 'Subscriptions', 'Other subscriptions'],
    ['UBER EATS', 'Meals & outings', 'Delivery'],
    ['ALFAJORES ONLINE', 'Meals & outings', 'Treats & alfajores'],
    ['EVENT CINEMA', 'Entertainment', 'Cinema'],
    ['AIR NEW ZEALAND', 'Travel', 'Tickets & transfers'],
    ['AIRBNB', 'Travel', 'Accommodation'],
    ['TRAVEL MEAL', 'Travel', 'Meals & activities during travel'],
  ])('proposes %s with reason and explicit confirmation, never auto-applies', (merchant, category, subcategory) => {
    const suggestion = suggestCategoryForMerchant(merchant);
    expect(suggestion).toMatchObject({ category, subcategory, confidence: 'medium', requiresConfirmation: true });
    expect(suggestion?.reason).toBeTruthy();
    expect(categorizeMerchant(merchant)).toEqual(review);
  });
  it.each(['AMAZON', 'AMAZON NETFLIX', 'PAYPAL *CLOUDFLARE', 'PAYPAL *ALFAJORES', 'APPLE.COM/BILL', 'APPLE COM BILL', 'APPLE.COM/BILL APPLE TV DEVICE', 'KOGAN', 'INSURANCE', 'EQUIPMENT', 'TRADEME'])('leaves ambiguous %s unknown instead of inferring purpose', merchant => {
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
    expect(resolveImportedClassification('Outings & entertainment', 'Meals & treats', 'PLAYSTATION PLUS', 'manual')).toEqual({ category: 'Outings & entertainment', subcategory: 'Meals & treats' });
    expect(resolveImportedClassification('', '', 'YOUTUBE PREMIUM', 'manual')).toEqual({ category: '', subcategory: '' });
    expect(resolveImportedClassification(' My category ', ' My purpose ', 'YOUTUBE PREMIUM', 'manual')).toEqual({ category: ' My category ', subcategory: ' My purpose ' });
    expect(resolveImportedClassification(' My category ', ' My purpose ', 'YOUTUBE PREMIUM')).toEqual({ category: ' My category ', subcategory: ' My purpose ' });
    expect(resolveImportedClassification('', '', 'YOUTUBE PREMIUM')).toEqual({ category: '', subcategory: '' });
    expect(resolveImportedClassification(undefined, undefined, 'YOUTUBE PREMIUM')).toEqual(review);
  });

  it.each([
    ['YOUTUBE PREMIUM FAMILY', 'subscription_entertainment', 'Entertainment'],
    ['APPLE.COM/BILL APPLE MUSIC', 'subscription_entertainment', 'Entertainment'],
    ['APPLE TV+', 'subscription_entertainment', 'Entertainment'],
    ['APPLETV+', 'subscription_entertainment', 'Entertainment'],
    ['APPLE TV PLUS', 'subscription_entertainment', 'Entertainment'],
    ['APPLE ARCADE', 'subscription_entertainment', 'Entertainment'],
    ['APPLE.COM/BILL ICLOUD+', 'subscription_other', 'Other subscriptions'],
    ['APPLE ONE FAMILY', 'subscription_other', 'Other subscriptions'],
    ['APPLE ONE APPLE MUSIC ICLOUD', 'subscription_other', 'Other subscriptions'],
  ])('uses the named service in %s without guessing a generic Apple bill', (merchant, subcategoryKey, subcategory) => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ category: 'Subscriptions', subcategory, groupKey: 'subscriptions', subcategoryKey, requiresConfirmation: true });
    expect(categorizeMerchant(merchant)).toEqual(review);
  });

  it.each([
    ['PLAYSTATION STORE GAME', 'Entertainment', 'Video games'],
    ['STEAM GAME PURCHASE', 'Entertainment', 'Video games'],
    ['NINTENDO GAME PURCHASE', 'Entertainment', 'Video games'],
    ['PLAYSTATION PLUS MONTHLY', 'Subscriptions', 'Entertainment'],
    ['PS PLUS', 'Subscriptions', 'Entertainment'],
    ['PSPLUS', 'Subscriptions', 'Entertainment'],
    ['XBOX GAMEPASS ULTIMATE', 'Subscriptions', 'Entertainment'],
    ['XBOX GAME PASS', 'Subscriptions', 'Entertainment'],
    ['NINTENDO SWITCH ONLINE', 'Subscriptions', 'Entertainment'],
    ['STEAM SUBSCRIPTION', 'Subscriptions', 'Entertainment'],
  ])('separates game purchases and named recurring services in %s', (merchant, category, subcategory) => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ category, subcategory, requiresConfirmation: true });
    expect(categorizeMerchant(merchant)).toEqual(review);
  });

  it.each([
    ['RESTAURANT DINNER', 'Meals & outings', 'Restaurants'],
    ['CAFE COFFEE', 'Meals & outings', 'Cafés'],
    ['DOORDASH RESTAURANT', 'Meals & outings', 'Delivery'],
    ['ALFAJORES', 'Meals & outings', 'Treats & alfajores'],
    ['CINEMA TICKET', 'Entertainment', 'Cinema'],
    ['TICKETMASTER CONCERT', 'Entertainment', 'Events'],
    ['MUSEUM ENTRY', 'Entertainment', 'Activities'],
  ])('keeps meals and outings separate from entertainment for %s', (merchant, category, subcategory) => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ category, subcategory, requiresConfirmation: true });
  });

  it.each([
    ['OPENAI API CREDITS', 'Work & learning', 'Software & tools'],
    ['OPENAI API CREDITS CHATGPT SUBSCR', 'Work & learning', 'Software & tools'],
    ['OPENAI API TOP-UP CHATGPT SUBSCRIPTION', 'Work & learning', 'Software & tools'],
    ['LIFETIME SOFTWARE LICENSE', 'Work & learning', 'Software & tools'],
    ['LIFETIME SOFTWARE LICENSE CHATGPT SUBSCR', 'Work & learning', 'Software & tools'],
    ['CLOUDFLARE DOMAIN PURCHASE', 'Work & learning', 'Software & tools'],
    ['CHATGPT PLUS', 'Subscriptions', 'Work'],
    ['GITHUB COPILOT', 'Subscriptions', 'Work'],
  ])('does not treat explicit one-off work tools as subscriptions in %s', (merchant, category, subcategory) => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ category, subcategory, requiresConfirmation: true });
    expect(categorizeMerchant(merchant)).toEqual(review);
  });

  it.each(['PAYPAL *APPLE MUSIC', 'AMAZON YOUTUBE PREMIUM', 'PAYPAL *OPENAI SUBSCRIPTION', 'AMAZON PLAYSTATION PLUS'])('keeps aggregator %s unknown even when a service name appears', merchant => {
    expect(suggestCategoryForMerchant(merchant)).toMatchObject({ ...review, confidence: 'unknown', requiresConfirmation: true });
  });

  it('does not make network or AI requests while proposing or importing classifications', () => {
    const fetch = vi.fn(() => { throw new Error('Classification must stay local'); });
    vi.stubGlobal('fetch', fetch);
    for (const merchant of ['OPENAI SUBSCRIPTION', 'YOUTUBE PREMIUM', 'APPLE.COM/BILL', 'PAYPAL *CLOUDFLARE', 'PLAYSTATION PLUS']) {
      suggestCategoryForMerchant(merchant);
      expect(categorizeMerchant(merchant)).toEqual(review);
      expect(resolveImportedClassification('My category', '', merchant, 'manual')).toEqual({ category: 'My category', subcategory: '' });
    }
    expect(fetch).not.toHaveBeenCalled();
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
