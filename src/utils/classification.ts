export interface Classification {
  category: string;
  subcategory: string;
}

interface CategoryRule {
  category: string;
  subcategory: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Transport',
    subcategory: 'Public Transport',
    keywords: ['public transport', 'at hop', 'athop', 'bus ', 'train', 'ferry']
  },
  {
    category: 'Transport',
    subcategory: 'Rideshare',
    keywords: ['uber', 'ola', 'didi', 'lyft']
  },
  {
    category: 'Transport',
    subcategory: 'Micromobility',
    keywords: ['lime', 'beam', 'neuron']
  },
  {
    category: 'Transport',
    subcategory: 'Fuel',
    keywords: ['petrol', 'gasoline', 'gas station', 'bp', 'z energy', 'caltex', 'mobil', 'gull']
  },
  {
    category: 'Groceries',
    subcategory: 'Supermarkets',
    keywords: ['woolworths', 'pak n save', 'paksave', 'new world', 'countdown', 'farro', 'supermarket']
  },
  {
    category: 'Groceries',
    subcategory: 'Specialty Food',
    keywords: ['butcher', 'bakery', 'deli', 'organics', 'wholefoods']
  },
  {
    category: 'Dining',
    subcategory: 'Cafes',
    keywords: ['coffee', 'cafe', 'espresso', 'starbucks']
  },
  {
    category: 'Dining',
    subcategory: 'Fast Food',
    keywords: ['mcdonald', 'kfc', 'burger king', 'subway', 'domino', 'pizza hut', 'hungry jacks']
  },
  {
    category: 'Dining',
    subcategory: 'Restaurants',
    keywords: ['restaurant', 'bistro', 'dining', 'cuisine', 'grill', 'izakaya', 'eatery']
  },
  {
    category: 'Entertainment',
    subcategory: 'Streaming',
    keywords: ['netflix', 'spotify', 'disney', 'apple music', 'youtube', 'paramount', 'hbo', 'amazon prime']
  },
  {
    category: 'Entertainment',
    subcategory: 'Gaming',
    keywords: ['playstation', 'steam', 'nintendo', 'xbox', 'game pass', 'gaming']
  },
  {
    category: 'Entertainment',
    subcategory: 'Movies & Events',
    keywords: ['event cinema', 'cinemas', 'movies', 'theatre']
  },
  {
    category: 'Subscriptions & Services',
    subcategory: 'Software & Cloud',
    keywords: ['openai', 'claude', 'cursor', 'expressvpn', 'cloudflare', 'apple.com', 'applecom', 'icloud', 'itunes', 'microsoft', 'google', 'adobe', 'github']
  },
  {
    category: 'Subscriptions & Services',
    subcategory: 'Financial Services',
    keywords: ['paypal', 'stripe', 'xero', 'freshbooks', 'accounting', 'invoice']
  },
  {
    category: 'Shopping',
    subcategory: 'Retail & Home',
    keywords: ['kmart', 'warehouse', 'briscoes', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman', 'jb hi fi']
  },
  {
    category: 'Shopping',
    subcategory: 'Apparel',
    keywords: ['farmer', 'fashion', 'adidas', 'puma', 'nike', 'seed heritage', 'hallenstein', 'glassons']
  },
  {
    category: 'Health',
    subcategory: 'Pharmacy & Health',
    keywords: ['chemist', 'pharmacy', 'unimeds', 'medical', 'clinic']
  },
  {
    category: 'Travel',
    subcategory: 'Accommodation',
    keywords: ['hotel', 'airbnb', 'accor', 'hilton', 'marriott', 'motel', 'resort']
  },
  {
    category: 'Travel',
    subcategory: 'Flights',
    keywords: ['air new zealand', 'jetstar', 'qantas', 'airline', 'flight']
  }
];

const normalize = (value = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();
const collapse = (value = '') => value.replace(/[^a-z0-9]/g, '');

const PROCESSED_RULES = CATEGORY_RULES.map((rule) => ({
  ...rule,
  normalizedKeywords: rule.keywords.map((keyword) => normalize(keyword)),
  collapsedKeywords: rule.keywords.map((keyword) => collapse(normalize(keyword)))
}));

export function categorizeMerchant(place = ''): Classification {
  const normalizedPlace = normalize(place);
  const collapsedPlace = collapse(normalizedPlace);

  for (const rule of PROCESSED_RULES) {
    const keywordMatch = rule.normalizedKeywords.some((keyword) =>
      keyword && normalizedPlace.includes(keyword)
    );

    const collapsedMatch = !keywordMatch && rule.collapsedKeywords.some((keyword) =>
      keyword && collapsedPlace.includes(keyword)
    );

    if (keywordMatch || collapsedMatch) {
      return {
        category: rule.category,
        subcategory: rule.subcategory
      };
    }
  }

  return {
    category: 'Other',
    subcategory: 'General'
  };
}
