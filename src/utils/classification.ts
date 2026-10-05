import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY, normalizeCategoryPair } from '@/constants/categories';

export interface Classification { category: string; subcategory: string; confidence?: 'review'; reviewReason?: 'purpose' | 'merchant'; }
export interface ClassificationSuggestion extends Classification { confidence?: 'review'; reviewReason?: 'purpose' | 'merchant'; }

// UI purpose rules preserve backend legacy records; uncertain use needs review.
const CATEGORY_RULES = [
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['public transport', 'at hop', 'athop', 'ax bus fare', 'suica', 'pasmo', 'bus ', 'train', 'ferry']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['carpark', 'car park', 'parking', 'parkmate', 'wilson parking', 'toll road']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['uber one membership', 'uber one']
  },
  {
    category: 'Entertainment',
    subcategory: 'Eating out',
    keywords: ['uber eats', 'burgerfuel', 'deli bros', 'mc donalds', 'sals pizza', 'kura sushi', 'itchiku an air', 'sawamura harunire', 'gong cha', 'the shucker brothers', 'stonyridge vin', 'needo mount ed']
  },
  {
    category: 'Home & daily living',
    subcategory: 'Internet & Phone',
    keywords: ['skinny mobile', 'vodafone', 'spark mobile', 'mobile top up', 'one nz', '2degrees']
  },
  {
    category: 'Home & daily living',
    subcategory: 'Utilities',
    keywords: ['mercury energy', 'genesis energy', 'contact energy', 'meridian', 'electric kiwi', 'powershop', 'watercare']
  },
  {
    category: 'Home & daily living',
    subcategory: 'Rent',
    keywords: ['rent payment', 'landlord', 'property management']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['uber', 'ola', 'didi', 'lyft', 'lime', 'beam', 'neuron']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['petrol', 'gasoline', 'gas station', 'u-go triangle', 'tasman epsom', 'bp', 'z energy', 'caltex', 'mobil', 'gull', 'fuel ']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['aa battery', 'aa service', 'aa centre', 'aa smartfuel', 'aa roadside', 'aa nz', 'aa mount wellington', 'vtnz', 'wof']
  },
  {
    category: 'Home & daily living',
    subcategory: 'Food',
    keywords: ['woolworths', 'pak n save', 'paksave', 'new world', 'countdown', 'farro', 'supermarket', 'liquorland', 'super liquor', 'liquor ', 'bottle o', 'birkenhead liquor', 'butcher', 'bakery', 'deli', 'organics', 'wholefoods', 'pachamama latino store', 't2 apac']
  },
  {
    category: 'Entertainment',
    subcategory: 'Eating out',
    keywords: ['coffee', 'cafe', 'espresso', 'starbucks', 'mcdonald', 'kfc', 'burger king', 'subway', 'domino', 'pizza hut', 'hungry jacks', 'restaurant', 'bistro', 'dining', 'cuisine', 'grill', 'izakaya', 'eatery', 'fat badgers pizza', 'pizza bar']
  },
  {
    category: 'Entertainment',
    subcategory: 'Streaming',
    keywords: ['netflix', 'spotify', 'disney', 'apple music', 'paramount', 'hbo']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['youtube', 'amazon prime', 'openai', 'claude', 'cursor', 'expressvpn', 'cloudflare', 'icloud', 'itunes', 'microsoft', 'google', 'adobe', 'github', 'x corp. paid features']
  },
  {
    category: 'Entertainment',
    subcategory: 'Games & hobbies',
    keywords: ['playstation', 'steam', 'nintendo', 'xbox', 'game pass', 'gaming', 'instantgami']
  },
  {
    category: 'Entertainment',
    subcategory: 'Travel & events',
    keywords: ['event cinema', 'cinemas', 'movies', 'theatre', 'tvnz event pass', 'kubotaitchiku museum']
  },
  {
    category: 'Personal needs',
    subcategory: 'Health',
    keywords: ['chemist', 'pharmacy', 'unimeds', 'medical', 'clinic', 'cocokarafine', 'nz muscle']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    reviewReason: 'merchant' as const,
    keywords: ['kmart', 'the warehouse', 'warehouse', 'briscoes', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman']
  },
  {
    category: 'Personal needs',
    subcategory: 'Clothing & footwear',
    keywords: ['fashion', 'adidas', 'puma', 'nike', 'seed heritage', 'tommy hilfiger', 'hallenstein', 'hallensteins', 'glassons', 'tnf onehunga', 'h&m', 'bonds onehunga']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    reviewReason: 'merchant' as const,
    keywords: ['farmers', 'farmer', 'trezor company', 'bic camera', 'temu.com', 'jb hi fi', 'mighty ape']
  },
  {
    category: 'Personal needs',
    subcategory: 'Personal care',
    keywords: ['barber', 'hairdresser', 'hair salon', 'nails', 'lash co']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    keywords: ['hotel', 'airbnb', 'accor', 'hilton', 'marriott', 'motel', 'resort', 'booking.com', 'booking', 'air new zealand', 'jetstar', 'qantas', 'airline', 'flight']
  },
  {
    category: 'Work & learning',
    subcategory: 'Education & training',
    keywords: ['language lesson', 'music lesson', 'art class']
  },
  {
    category: 'Others',
    subcategory: 'Purpose unconfirmed',
    reviewReason: 'merchant' as const,
    keywords: ['daiso japan', '3 japan']
  }
];

const REVIEW_ONLY_RULES = [
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

const PAYPAL_OVERRIDES = [
  {
    match: 'laucolla',
    category: 'Others',
    subcategory: 'Miscellaneous'
  },
  {
    match: 'mariano',
    category: 'Personal spending',
    subcategory: 'Hobbies & Shopping'
  },
  {
    match: 'mighty ape',
    category: 'Personal spending',
    subcategory: 'Hobbies & Shopping'
  },
  {
    match: 'booking',
    category: 'Fun & Social',
    subcategory: 'Travel & Entertainment'
  },
  {
    match: 'cloudflare',
    category: 'Fun & Social',
    subcategory: 'Subscriptions'
  }
];

function normalize(value = '') {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function collapse(value = '') {
  return value.replace(/[^a-z0-9]/g, '');
}

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

function matchRules(normalizedValue: string, collapsedValue: string, rules = PROCESSED_RULES): Classification | null {
  for (const rule of rules) {
    const keywordMatch = rule.normalizedKeywords.some((keyword) =>
      matchesKeyword(normalizedValue, keyword)
    );

    const collapsedMatch = !keywordMatch && rule.collapsedKeywords.some((keyword) =>
      keyword && collapsedValue.includes(keyword)
    );

    if (keywordMatch || collapsedMatch) {
      const pair = normalizeCategoryPair(rule.category, rule.subcategory);
      return pair.category === 'Others' ? { ...pair, confidence: 'review', reviewReason: rule.reviewReason ?? 'purpose' } : pair;
    }
  }

  return null;
}

export function suggestCategoryForMerchant(place = ''): ClassificationSuggestion | null {
  const normalizedPlace = normalize(place);
  const collapsedPlace = collapse(normalizedPlace);

  if (normalizedPlace.startsWith('paypal')) {
    const paypalName = normalize(place.replace(/^paypal\s*\*/i, ''));
    const collapsedPaypalName = collapse(paypalName);

    const override = PAYPAL_OVERRIDES.find((entry) => collapsedPaypalName.includes(collapse(entry.match)));
    if (override) {
      const pair = normalizeCategoryPair(override.category, override.subcategory);
      return override.category !== 'Others' && pair.category === 'Others' ? { ...pair, confidence: 'review', reviewReason: 'purpose' } : pair;
    }

    const paypalMatch = matchRules(paypalName, collapsedPaypalName);
    if (paypalMatch) {
      return paypalMatch;
    }

    const reviewMatch = matchRules(paypalName, collapsedPaypalName, PROCESSED_REVIEW_ONLY_RULES);
    if (reviewMatch) {
      return { ...reviewMatch, confidence: 'review', reviewReason: 'merchant' };
    }

    return null;
  }

  const merchantMatch = matchRules(normalizedPlace, collapsedPlace);
  if (merchantMatch) {
    return merchantMatch;
  }

  const reviewMatch = matchRules(normalizedPlace, collapsedPlace, PROCESSED_REVIEW_ONLY_RULES);
  return reviewMatch ? { ...reviewMatch, confidence: 'review', reviewReason: 'merchant' } : null;
}

export function categorizeMerchant(place = ''): Classification {
  const suggestion = suggestCategoryForMerchant(place);
  if (suggestion && suggestion.confidence !== 'review') {
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


export function resolveImportedClassification(category: unknown, subcategory: unknown, place = ''): Classification {
  const cat = typeof category === 'string' ? category.trim() : '';
  const sub = typeof subcategory === 'string' ? subcategory.trim() : '';
  const merchant = categorizeMerchant(place);
  if (!cat) return merchant;
  const pair = normalizeCategoryPair(cat, sub);
  if (sub || pair.subcategory !== DEFAULT_SUBCATEGORY) return pair;
  return {
    category: pair.category,
    subcategory: merchant.category === pair.category ? merchant.subcategory : ''
  };
}
