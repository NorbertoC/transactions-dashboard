/**
 * Merchant classification — emits the canonical taxonomy defined in
 * @/constants/categories. The Express API (transactions-api/classification.js)
 * holds an identical copy of these rules; keep both in sync.
 */

import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY } from '@/constants/categories';

export interface Classification {
  category: string;
  subcategory: string;
  confidence?: 'review';
}

interface CategoryRule {
  category: string;
  subcategory: string;
  keywords: string[];
}

interface PaypalOverride {
  match: string;
  category: string;
  subcategory: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Transport', subcategory: 'Public transport', keywords: ['public transport', 'at hop', 'athop', 'ax bus fare', 'suica', 'pasmo', 'bus ', 'train', 'ferry'] },
  { category: 'Transport', subcategory: 'Parking & Tolls', keywords: ['carpark', 'car park', 'parking', 'parkmate', 'wilson parking', 'toll road'] },
  { category: 'Fun & Social', subcategory: 'Subscriptions', keywords: ['uber one membership', 'uber one'] },
  { category: 'Fun & Social', subcategory: 'Eating out', keywords: ['uber eats', 'burgerfuel', 'deli bros', 'mc donalds', 'sals pizza', 'kura sushi', 'itchiku an air', 'sawamura harunire', 'gong cha', 'the shucker brothers', 'stonyridge vin', 'needo mount ed'] },
  { category: 'Housing', subcategory: 'Internet & Phone', keywords: ['skinny mobile', 'vodafone', 'spark mobile', 'mobile top up', 'one nz', '2degrees'] },
  { category: 'Housing', subcategory: 'Utilities', keywords: ['mercury energy', 'genesis energy', 'contact energy', 'meridian', 'electric kiwi', 'powershop', 'watercare'] },
  { category: 'Housing', subcategory: 'Rent', keywords: ['rent payment', 'landlord', 'property management'] },
  { category: 'Transport', subcategory: 'Taxi & Rideshare', keywords: ['uber', 'ola', 'didi', 'lyft', 'lime', 'beam', 'neuron'] },
  { category: 'Transport', subcategory: 'Fuel', keywords: ['petrol', 'gasoline', 'gas station', 'u-go triangle', 'tasman epsom', 'bp', 'z energy', 'caltex', 'mobil', 'gull', 'fuel '] },
  { category: 'Transport', subcategory: 'Car maintenance', keywords: ['aa battery', 'aa service', 'aa centre', 'aa smartfuel', 'aa roadside', 'aa nz', 'aa mount wellington', 'vtnz', 'wof'] },
  {
    category: 'Groceries',
    subcategory: 'Food',
    keywords: [
      'woolworths', 'pak n save', 'paksave', 'new world', 'countdown', 'farro', 'supermarket',
      'liquorland', 'super liquor', 'liquor ', 'bottle o', 'birkenhead liquor',
      'butcher', 'bakery', 'deli', 'organics', 'wholefoods', 'pachamama latino store', 'daiso japan', '3 japan', 't2 apac'
    ]
  },
  {
    category: 'Fun & Social',
    subcategory: 'Eating out',
    keywords: [
      'coffee', 'cafe', 'espresso', 'starbucks',
      'mcdonald', 'kfc', 'burger king', 'subway', 'domino', 'pizza hut', 'hungry jacks',
      'restaurant', 'bistro', 'dining', 'cuisine', 'grill', 'izakaya', 'eatery', 'fat badgers pizza', 'pizza bar'
    ]
  },
  {
    category: 'Fun & Social',
    subcategory: 'Subscriptions',
    keywords: [
      'netflix', 'spotify', 'disney', 'apple music', 'youtube', 'paramount', 'hbo', 'amazon prime',
      'openai', 'claude', 'cursor', 'expressvpn', 'cloudflare', 'icloud', 'itunes', 'microsoft', 'google', 'adobe', 'github', 'x corp. paid features'
    ]
  },
  { category: 'Personal spending', subcategory: 'Hobbies & Shopping', keywords: ['playstation', 'steam', 'nintendo', 'xbox', 'game pass', 'gaming', 'instantgami'] },
  { category: 'Fun & Social', subcategory: 'Travel & Entertainment', keywords: ['event cinema', 'cinemas', 'movies', 'theatre', 'tvnz event pass', 'kubotaitchiku museum'] },
  { category: 'Groceries', subcategory: 'Medicine & Supplements', keywords: ['chemist', 'pharmacy', 'unimeds', 'medical', 'clinic', 'cocokarafine', 'nz muscle'] },
  { category: 'Groceries', subcategory: 'Household items', keywords: ['kmart', 'the warehouse', 'warehouse', 'briscoes', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman'] },
  { category: 'Personal spending', subcategory: 'Hobbies & Shopping', keywords: ['farmers', 'farmer', 'fashion', 'adidas', 'puma', 'nike', 'seed heritage', 'tommy hilfiger', 'hallenstein', 'hallensteins', 'glassons', 'trezor company', 'tnf onehunga', 'bic camera', 'h&m', 'bonds onehunga', 'temu.com', 'jb hi fi', 'mighty ape'] },
  { category: 'Groceries', subcategory: 'Personal care', keywords: ['barber', 'hairdresser', 'hair salon', 'nails', 'lash co'] },
  {
    category: 'Fun & Social',
    subcategory: 'Travel & Entertainment',
    keywords: [
      'hotel', 'airbnb', 'accor', 'hilton', 'marriott', 'motel', 'resort', 'booking.com', 'booking',
      'air new zealand', 'jetstar', 'qantas', 'airline', 'flight'
    ]
  },
  { category: 'Personal spending', subcategory: 'Hobbies & Shopping', keywords: ['language lesson', 'music lesson', 'art class'] }
];

const REVIEW_ONLY_RULES: CategoryRule[] = [
  {
    category: 'Fun & Social',
    subcategory: 'Subscriptions',
    keywords: ['apple.com', 'apple com bill', 'applecom', 'twitch inter', 'twitch']
  },
  {
    category: 'Personal spending',
    subcategory: 'Hobbies & Shopping',
    keywords: ['trademe', 'trade me']
  },
  {
    category: 'Groceries',
    subcategory: 'Personal care',
    keywords: ['sauna collective']
  }
];

const PAYPAL_OVERRIDES: PaypalOverride[] = [
  { match: 'laucolla', category: 'Others', subcategory: 'Miscellaneous' },
  { match: 'mariano', category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
  { match: 'mighty ape', category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
  { match: 'booking', category: 'Fun & Social', subcategory: 'Travel & Entertainment' },
  { match: 'cloudflare', category: 'Fun & Social', subcategory: 'Subscriptions' }
];

const normalize = (value = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();
const collapse = (value = '') => value.replace(/[^a-z0-9]/g, '');

function matchesKeyword(value: string, keyword: string): boolean {
  if (!keyword) return false;
  if (!/^[a-z0-9]+$/.test(keyword)) return value.includes(keyword);

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(value);
}

const PROCESSED_RULES = CATEGORY_RULES.map((rule) => ({
  ...rule,
  normalizedKeywords: rule.keywords.map((keyword) => normalize(keyword)),
  collapsedKeywords: rule.keywords
    .map((keyword) => normalize(keyword))
    .filter((keyword) => /[^a-z0-9]/.test(keyword) && collapse(keyword).length >= 6)
    .map((keyword) => collapse(keyword))
}));

const PROCESSED_REVIEW_ONLY_RULES = REVIEW_ONLY_RULES.map((rule) => ({
  ...rule,
  normalizedKeywords: rule.keywords.map((keyword) => normalize(keyword)),
  collapsedKeywords: rule.keywords
    .map((keyword) => normalize(keyword))
    .filter((keyword) => /[^a-z0-9]/.test(keyword) && collapse(keyword).length >= 6)
    .map((keyword) => collapse(keyword))
}));

function matchRules(
  normalizedValue: string,
  collapsedValue: string,
  rules = PROCESSED_RULES
): Classification | null {
  for (const rule of rules) {
    const keywordMatch = rule.normalizedKeywords.some((keyword) =>
      matchesKeyword(normalizedValue, keyword)
    );

    const collapsedMatch =
      !keywordMatch &&
      rule.collapsedKeywords.some((keyword) => keyword && collapsedValue.includes(keyword));

    if (keywordMatch || collapsedMatch) {
      return {
        category: rule.category,
        subcategory: rule.subcategory
      };
    }
  }

  return null;
}

export function suggestCategoryForMerchant(place = ''): Classification | null {
  const normalizedPlace = normalize(place);
  const collapsedPlace = collapse(normalizedPlace);

  if (normalizedPlace.startsWith('paypal')) {
    const paypalName = normalize(place.replace(/^paypal\s*\*/i, ''));
    const collapsedPaypalName = collapse(paypalName);

    const override = PAYPAL_OVERRIDES.find((entry) =>
      collapsedPaypalName.includes(collapse(entry.match))
    );
    if (override) {
      return {
        category: override.category,
        subcategory: override.subcategory
      };
    }

    const paypalMatch = matchRules(paypalName, collapsedPaypalName);
    if (paypalMatch) {
      return paypalMatch;
    }

    const reviewMatch = matchRules(
      paypalName,
      collapsedPaypalName,
      PROCESSED_REVIEW_ONLY_RULES
    );
    if (reviewMatch) {
      return { ...reviewMatch, confidence: 'review' };
    }

    return null;
  }

  const merchantMatch = matchRules(normalizedPlace, collapsedPlace);
  if (merchantMatch) {
    return merchantMatch;
  }

  const reviewMatch = matchRules(
    normalizedPlace,
    collapsedPlace,
    PROCESSED_REVIEW_ONLY_RULES
  );
  return reviewMatch ? { ...reviewMatch, confidence: 'review' } : null;
}

export function categorizeMerchant(place = ''): Classification {
  const suggestion = suggestCategoryForMerchant(place);
  if (suggestion) {
    return {
      category: suggestion.category,
      subcategory: suggestion.subcategory
    };
  }

  return {
    category: DEFAULT_CATEGORY,
    subcategory: DEFAULT_SUBCATEGORY
  };
}
