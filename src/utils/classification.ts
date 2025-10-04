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
  { category: 'Transport', subcategory: 'Public Transport', keywords: ['public transport', 'at hop', 'athop', 'bus ', 'train', 'ferry'] },
  { category: 'Transport', subcategory: 'Rideshare', keywords: ['uber', 'ola', 'didi', 'lyft'] },
  { category: 'Transport', subcategory: 'Micromobility', keywords: ['lime', 'beam', 'neuron'] },
  { category: 'Car', subcategory: 'Fuel & Charging', keywords: ['petrol', 'gasoline', 'gas station', 'bp', 'z energy', 'caltex', 'mobil', 'gull', 'fuel '] },
  { category: 'Car', subcategory: 'Services & Maintenance', keywords: ['aa battery', 'aa service', 'aa centre', 'aa smartfuel', 'aa roadside', 'aa nz', 'aa mount wellington'] },
  { category: 'Groceries', subcategory: 'Supermarkets', keywords: ['woolworths', 'pak n save', 'paksave', 'new world', 'countdown', 'farro', 'supermarket'] },
  { category: 'Groceries', subcategory: 'Alcohol & Beverage', keywords: ['liquorland', 'super liquor', 'liquor ', 'bottle o', 'birkenhead liquor'] },
  { category: 'Groceries', subcategory: 'Specialty Food', keywords: ['butcher', 'bakery', 'deli', 'organics', 'wholefoods', 'pachamama latino store', 'daiso japan', '3 japan'] },
  { category: 'Dining', subcategory: 'Cafes', keywords: ['coffee', 'cafe', 'espresso', 'starbucks'] },
  { category: 'Dining', subcategory: 'Fast Food', keywords: ['mcdonald', 'kfc', 'burger king', 'subway', 'domino', 'pizza hut', 'hungry jacks'] },
  { category: 'Dining', subcategory: 'Dining Out', keywords: ['restaurant', 'bistro', 'dining', 'cuisine', 'grill', 'izakaya', 'eatery', 'fat badgers pizza', 'pizza bar'] },
  { category: 'Entertainment', subcategory: 'Streaming', keywords: ['netflix', 'spotify', 'disney', 'apple music', 'youtube', 'paramount', 'hbo', 'amazon prime'] },
  { category: 'Entertainment', subcategory: 'Gaming', keywords: ['playstation', 'steam', 'nintendo', 'xbox', 'game pass', 'gaming'] },
  { category: 'Entertainment', subcategory: 'Movies & Events', keywords: ['event cinema', 'cinemas', 'movies', 'theatre'] },
  { category: 'Subscriptions & Services', subcategory: 'Software & Cloud', keywords: ['openai', 'claude', 'cursor', 'expressvpn', 'cloudflare', 'apple.com', 'applecom', 'icloud', 'itunes', 'microsoft', 'google', 'adobe', 'github'] },
  { category: 'Subscriptions & Services', subcategory: 'Mobile Phone', keywords: ['skinny mobile', 'vodafone', 'spark mobile'] },
  { category: 'Subscriptions & Services', subcategory: 'Memberships', keywords: ['uber one membership', 'uber one'] },
  { category: 'Shopping', subcategory: 'Retail & Home', keywords: ['kmart', 'warehouse', 'briscoes', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman', 'jb hi fi', 'mighty ape'] },
  { category: 'Shopping', subcategory: 'Apparel', keywords: ['farmer', 'fashion', 'adidas', 'puma', 'nike', 'seed heritage', 'hallenstein', 'glassons'] },
  { category: 'Health', subcategory: 'Pharmacy & Health', keywords: ['chemist', 'pharmacy', 'unimeds', 'medical', 'clinic'] },
  { category: 'Travel', subcategory: 'Accommodation', keywords: ['hotel', 'airbnb', 'accor', 'hilton', 'marriott', 'motel', 'resort', 'booking.com', 'booking'] },
  { category: 'Travel', subcategory: 'Flights', keywords: ['air new zealand', 'jetstar', 'qantas', 'airline', 'flight'] },
  { category: 'Hobbies', subcategory: 'Learning & Classes', keywords: ['language lesson', 'music lesson', 'art class'] }
];

const PAYPAL_OVERRIDES: PaypalOverride[] = [
  { match: 'laucolla', category: 'Other', subcategory: 'Counselling' },
  { match: 'mariano', category: 'Hobbies', subcategory: 'Learning & Classes' },
  { match: 'mighty ape', category: 'Shopping', subcategory: 'Retail & Home' },
  { match: 'booking', category: 'Travel', subcategory: 'Accommodation' },
  { match: 'cloudflare', category: 'Subscriptions & Services', subcategory: 'Software & Cloud' }
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
    const keywordMatch = rule.normalizedKeywords.some((keyword) => keyword && normalizedValue.includes(keyword));
    const collapsedMatch = !keywordMatch && rule.collapsedKeywords.some((keyword) => keyword && collapsedValue.includes(keyword));

    if (keywordMatch || collapsedMatch) {
      return { category: rule.category, subcategory: rule.subcategory };
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

    const override = PAYPAL_OVERRIDES.find((entry) => collapsedPaypalName.includes(collapse(entry.match)));
    if (override) {
      return { category: override.category, subcategory: override.subcategory };
    }

    const paypalMatch = matchRules(paypalName, collapsedPaypalName);
    if (paypalMatch) {
      return paypalMatch;
    }

    return { category: 'Other', subcategory: 'General' };
  }

  return { category: 'Other', subcategory: 'General' };
}
