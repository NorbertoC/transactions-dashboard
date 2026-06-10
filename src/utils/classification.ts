/**
 * Merchant classification — emits the canonical taxonomy defined in
 * @/constants/categories. The Express API (transactions-api/classification.js)
 * holds an identical copy of these rules; keep both in sync.
 */

import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY } from '@/constants/categories';

export interface Classification {
  category: string;
  subcategory: string;
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
  { category: 'Transport', subcategory: 'Public transport', keywords: ['public transport', 'at hop', 'athop', 'bus ', 'train', 'ferry'] },
  { category: 'Fun & Social', subcategory: 'Subscriptions', keywords: ['uber one membership', 'uber one'] },
  { category: 'Housing', subcategory: 'Internet & Phone', keywords: ['skinny mobile', 'vodafone', 'spark mobile', 'mobile top up', 'one nz', '2degrees'] },
  { category: 'Housing', subcategory: 'Utilities', keywords: ['mercury energy', 'genesis energy', 'contact energy', 'meridian', 'electric kiwi', 'powershop', 'watercare'] },
  { category: 'Housing', subcategory: 'Rent', keywords: ['rent payment', 'landlord', 'property management'] },
  { category: 'Transport', subcategory: 'Taxi & Rideshare', keywords: ['uber', 'ola', 'didi', 'lyft', 'lime', 'beam', 'neuron'] },
  { category: 'Transport', subcategory: 'Fuel', keywords: ['petrol', 'gasoline', 'gas station', 'bp', 'z energy', 'caltex', 'mobil', 'gull', 'fuel '] },
  { category: 'Transport', subcategory: 'Car maintenance', keywords: ['aa battery', 'aa service', 'aa centre', 'aa smartfuel', 'aa roadside', 'aa nz', 'aa mount wellington', 'vtnz', 'wof'] },
  {
    category: 'Groceries',
    subcategory: 'Food',
    keywords: [
      'woolworths', 'pak n save', 'paksave', 'new world', 'countdown', 'farro', 'supermarket',
      'liquorland', 'super liquor', 'liquor ', 'bottle o', 'birkenhead liquor',
      'butcher', 'bakery', 'deli', 'organics', 'wholefoods', 'pachamama latino store', 'daiso japan', '3 japan'
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
      'openai', 'claude', 'cursor', 'expressvpn', 'cloudflare', 'apple.com', 'applecom', 'icloud', 'itunes', 'microsoft', 'google', 'adobe', 'github'
    ]
  },
  { category: 'Personal spending', subcategory: 'Hobbies & Shopping', keywords: ['playstation', 'steam', 'nintendo', 'xbox', 'game pass', 'gaming'] },
  { category: 'Fun & Social', subcategory: 'Travel & Entertainment', keywords: ['event cinema', 'cinemas', 'movies', 'theatre'] },
  { category: 'Groceries', subcategory: 'Household items', keywords: ['kmart', 'warehouse', 'briscoes', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman', 'jb hi fi', 'mighty ape'] },
  { category: 'Personal spending', subcategory: 'Hobbies & Shopping', keywords: ['farmer', 'fashion', 'adidas', 'puma', 'nike', 'seed heritage', 'hallenstein', 'glassons'] },
  { category: 'Groceries', subcategory: 'Personal care', keywords: ['barber', 'hairdresser', 'hair salon', 'nails'] },
  { category: 'Groceries', subcategory: 'Medicine & Supplements', keywords: ['chemist', 'pharmacy', 'unimeds', 'medical', 'clinic'] },
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

const PAYPAL_OVERRIDES: PaypalOverride[] = [
  { match: 'laucolla', category: 'Others', subcategory: 'Miscellaneous' },
  { match: 'mariano', category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
  { match: 'mighty ape', category: 'Groceries', subcategory: 'Household items' },
  { match: 'booking', category: 'Fun & Social', subcategory: 'Travel & Entertainment' },
  { match: 'cloudflare', category: 'Fun & Social', subcategory: 'Subscriptions' }
];

const normalize = (value = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();
const collapse = (value = '') => value.replace(/[^a-z0-9]/g, '');

const PROCESSED_RULES = CATEGORY_RULES.map((rule) => ({
  ...rule,
  normalizedKeywords: rule.keywords.map((keyword) => normalize(keyword)),
  collapsedKeywords: rule.keywords.map((keyword) => collapse(normalize(keyword)))
}));

function matchRules(normalizedValue: string, collapsedValue: string): Classification | null {
  for (const rule of PROCESSED_RULES) {
    const keywordMatch = rule.normalizedKeywords.some(
      (keyword) => keyword && normalizedValue.includes(keyword)
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

export function categorizeMerchant(place = ''): Classification {
  const normalizedPlace = normalize(place);
  const collapsedPlace = collapse(normalizedPlace);

  const directMatch = matchRules(normalizedPlace, collapsedPlace);
  if (directMatch) {
    return directMatch;
  }

  if (normalizedPlace.startsWith('paypal')) {
    const paypalName = normalize(place.replace(/^paypal\s*\*/, ''));
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

    return { category: DEFAULT_CATEGORY, subcategory: DEFAULT_SUBCATEGORY };
  }

  return { category: DEFAULT_CATEGORY, subcategory: DEFAULT_SUBCATEGORY };
}
