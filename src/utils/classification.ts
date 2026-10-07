import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY, getTaxonomyPair, normalizeCategoryPair } from '@/constants/categories';

export interface Classification { category: string; subcategory: string; }
export interface ClassificationSuggestion extends Classification {
  confidence: 'medium' | 'unknown' | 'review';
  reviewReason: 'purpose' | 'merchant';
  reason: string;
  reasonCode: 'merchant_keyword' | 'unknown_purpose';
  matchedKeyword?: string;
  requiresConfirmation: true;
  groupKey?: string;
  subcategoryKey?: string;
}
// These are proposals for explicit approval, never automatic merchant-purpose assignments.
const RULES = [
  {"groupKey": "basic_living", "subcategoryKey": "transport", "keywords": ["suica", "pasmo", "public transport", "at hop", "athop", "ax bus fare", "bus fare", "petrol", "gasoline", "fuel", "bp", "z energy", "caltex", "mobil", "gull", "u-go triangle", "vtnz", "wof", "aa roadside", "car insurance", "vehicle insurance"]},
  {"groupKey": "basic_living", "subcategoryKey": "phone", "keywords": ["kogan mobile", "kogan prepaid", "skinny mobile", "spark mobile", "mobile top up", "one nz", "2degrees"]},
  {"groupKey": "basic_living", "subcategoryKey": "power_internet", "keywords": ["mercury energy", "genesis energy", "contact energy", "electric kiwi", "powershop", "broadband", "fibre internet"]},
  {"groupKey": "basic_living", "subcategoryKey": "rent", "keywords": ["rent payment", "landlord"]},
  {"groupKey": "basic_living", "subcategoryKey": "home_food", "keywords": ["woolworths", "pak n save", "paksave", "new world", "countdown", "supermarket"]},
  {"groupKey": "personal_purchases", "subcategoryKey": "health", "keywords": ["chemist", "pharmacy", "unimeds", "medical clinic", "health insurance", "medical insurance", "cocokarafine"]},
  {"groupKey": "personal_purchases", "subcategoryKey": "clothing_footwear", "keywords": ["adidas", "puma", "nike", "tommy hilfiger", "hallensteins", "glassons", "tnf onehunga", "h&m", "bonds onehunga"]},
  {"groupKey": "personal_purchases", "subcategoryKey": "personal_care", "keywords": ["barber", "hairdresser", "hair salon", "nails", "lash co"]},
  {"groupKey": "personal_purchases", "subcategoryKey": "home_purchases", "keywords": ["briscoes"]},
  {"groupKey": "work_learning", "subcategoryKey": "software_tools", "keywords": ["one-off work tool", "one-time work software", "work software purchase", "lifetime software license", "perpetual software license", "openai api credits", "openai api top up", "cloudflare domain purchase"]},
  {"groupKey": "work_learning", "subcategoryKey": "equipment_training", "keywords": ["language lesson", "music lesson", "art class", "work equipment", "work laptop", "professional training"]},
  {"groupKey": "subscriptions", "subcategoryKey": "subscription_work", "keywords": ["chatgpt plus", "chatgpt pro", "chatgpt subscription", "chatgpt subscr", "openai subscription", "claude pro", "claude max", "cursor pro", "github copilot", "cloudflare subscription"]},
  {"groupKey": "subscriptions", "subcategoryKey": "subscription_other", "keywords": ["apple one"]},
  {"groupKey": "subscriptions", "subcategoryKey": "subscription_entertainment", "keywords": ["netflix", "spotify", "disney plus", "apple music", "apple tv+", "appletv+", "apple tv plus", "apple arcade", "paramount", "hbo", "youtube premium", "twitch subscription", "playstation plus", "ps plus", "psplus", "psn plus", "xbox game pass", "game pass", "gamepass", "nintendo switch online", "steam subscription"]},
  {"groupKey": "subscriptions", "subcategoryKey": "subscription_other", "keywords": ["icloud", "uber one membership", "uber one", "gym membership"]},
  {"groupKey": "work_learning", "subcategoryKey": "software_tools", "keywords": ["openai", "claude", "cursor", "cloudflare"]},
  {"groupKey": "meals_outings", "subcategoryKey": "delivery", "keywords": ["uber eats", "ubereats", "doordash", "door dash", "deliveroo", "menulog"]},
  {"groupKey": "meals_outings", "subcategoryKey": "food_treats", "keywords": ["alfajores", "food treats"]},
  {"groupKey": "meals_outings", "subcategoryKey": "cafes", "keywords": ["coffee", "cafe", "café", "gong cha"]},
  {"groupKey": "meals_outings", "subcategoryKey": "restaurants", "keywords": ["burgerfuel", "mc donalds", "mcdonald", "sals pizza", "restaurant", "kfc", "burger king", "pizza hut", "kura sushi"]},
  {"groupKey": "entertainment", "subcategoryKey": "video_games", "keywords": ["playstation", "steam", "nintendo", "xbox", "video game", "videogame"]},
  {"groupKey": "entertainment", "subcategoryKey": "cinema", "keywords": ["event cinema", "cinema", "cinemas", "movie ticket"]},
  {"groupKey": "entertainment", "subcategoryKey": "events", "keywords": ["concert", "theatre", "theater", "ticketmaster"]},
  {"groupKey": "entertainment", "subcategoryKey": "activities", "keywords": ["museum", "bowling", "escape room"]},
  {"groupKey": "travel", "subcategoryKey": "tickets_transfers", "keywords": ["air new zealand", "jetstar", "qantas", "airline", "flight tickets", "airport shuttle"]},
  {"groupKey": "travel", "subcategoryKey": "accommodation", "keywords": ["hotel", "airbnb", "hilton", "marriott", "motel", "accommodation"]},
  {"groupKey": "travel", "subcategoryKey": "travel_food_activities", "keywords": ["travel meal", "meal during travel", "travel activity"]},
];
const AMBIGUOUS_MERCHANTS = ['amazon', 'paypal', 'apple.com', 'apple com bill', 'applecom', 'kogan', 'insurance', 'equipment', 'computer supplies', 'electronics', 'warehouse', 'kmart', 'bunnings', 'mitre 10', 'ikea', 'noel leeming', 'harvey norman', 'farmers', 'temu', 'trademe', 'trade me', 'booking.com', 'suica', 'pasmo'];
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


const PROCESSED_RULES = RULES.map(rule => ({ ...rule,
  normalizedKeywords: rule.keywords.map(normalize),
  collapsedKeywords: rule.keywords.map(normalize).filter(keyword => /[^a-z0-9]/.test(keyword) && !keyword.includes('+') && collapse(keyword).length >= 6).map(collapse)
}));
export function suggestCategoryForMerchant(place = ''): ClassificationSuggestion | null {
  const normalizedPlace = normalize(place);
  const collapsedPlace = collapse(normalizedPlace);
  // Aggregators conceal purpose even when the trailing name happens to match a rule.
  if (matchesKeyword(normalizedPlace, 'paypal') || matchesKeyword(normalizedPlace, 'amazon')) {
    return getUnknownPurposeSuggestion();
  }
  for (const rule of PROCESSED_RULES) {
    const keyword = rule.normalizedKeywords.find(keyword => matchesKeyword(normalizedPlace, keyword));
    const collapsedMatch = !keyword && rule.collapsedKeywords.some(keyword => collapsedPlace.includes(keyword));
    if (keyword || collapsedMatch) {
      const pair = getTaxonomyPair(rule.groupKey, rule.subcategoryKey)!;
      return { ...pair, groupKey: rule.groupKey, subcategoryKey: rule.subcategoryKey, confidence: 'medium', reviewReason: 'purpose',
        reasonCode: 'merchant_keyword', matchedKeyword: keyword ?? rule.keywords[0], reason: `Merchant text matches ${keyword ?? rule.keywords[0]}; confirm the actual purchase purpose.`, requiresConfirmation: true };
    }
  }
  if (AMBIGUOUS_MERCHANTS.some(keyword => matchesKeyword(normalizedPlace, keyword) || (collapse(keyword).length >= 6 && collapsedPlace.includes(collapse(keyword))))) return getUnknownPurposeSuggestion();
  return null;
}
export function getUnknownPurposeSuggestion(): ClassificationSuggestion {
  return { category: DEFAULT_CATEGORY, subcategory: DEFAULT_SUBCATEGORY, groupKey: 'others', subcategoryKey: 'unclassified', confidence: 'unknown', reviewReason: 'merchant',
    reasonCode: 'unknown_purpose', reason: 'Merchant or payment provider does not establish the purchase purpose; choose a category explicitly.', requiresConfirmation: true };
}
export function categorizeMerchant(place?: string): Classification;
export function categorizeMerchant(): Classification {
  return { category: DEFAULT_CATEGORY, subcategory: DEFAULT_SUBCATEGORY };
}
export function resolveImportedClassification(category: unknown, subcategory: unknown, _place = '', categorySource?: string | null): Classification {
  void _place;
  const cat = typeof category === 'string' ? category : undefined;
  const sub = typeof subcategory === 'string' ? subcategory : undefined;
  return normalizeCategoryPair(cat, sub, categorySource);
}

export function getLocalizedSuggestionReason(suggestion: ClassificationSuggestion, locale: 'en' | 'es' | 'ja' = 'en'): string {
  if (suggestion.reasonCode === 'unknown_purpose') {
    return { en: 'The merchant or payment provider does not establish the purpose. Choose a category explicitly.',
      es: 'El comercio o proveedor de pago no determina el propósito. Elegí una categoría explícitamente.',
      ja: '店舗や決済サービスだけでは用途を判断できません。カテゴリーを選択してください。' }[locale];
  }
  const keyword = suggestion.matchedKeyword ?? '';
  return { en: `Merchant text matches ${keyword}. Confirm the actual purchase purpose.`,
    es: `El texto del comercio coincide con ${keyword}. Confirmá el propósito real de la compra.`,
    ja: `店舗の記載が「${keyword}」に一致します。実際の購入用途を確認してください。` }[locale];
}
