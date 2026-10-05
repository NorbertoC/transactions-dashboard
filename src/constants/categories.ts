/**
 * Canonical category taxonomy — single source of truth for the dashboard.
 *
 * Legacy API labels are projected here without rewriting stored records.
 * Explicit manual labels remain unchanged; ambiguous purposes need review.
 */

export interface CategoryColorConfig {
  hex: string;
  bg: string;
  text: string;
}

export interface CategoryInfo {
  name: string;
  nameJa: string;
  nameEs: string;
  color: CategoryColorConfig;
  subcategories: SubcategoryInfo[];
}

export interface SubcategoryInfo {
  name: string;
  nameJa: string;
  nameEs: string;
}

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'Home & daily living': 'Home & daily living', 'Work & learning': 'Work & learning',
  'Personal needs': 'Personal needs', Entertainment: 'Entertainment', Others: 'Needs review', Savings: 'Savings',
  Housing: 'Home', Groceries: 'Daily essentials', Transport: 'Transport',
  'Fun & Social': 'Leisure & social', 'Personal spending': 'Personal'
};

export const DEFAULT_CATEGORY = 'Others';
export const DEFAULT_SUBCATEGORY = 'Miscellaneous';

export const CATEGORIES: CategoryInfo[] = [
  {
    name: 'Home & daily living',
    nameJa: '住まい・日々の生活',
    nameEs: 'Hogar y vida diaria',
    color: { hex: '#2563eb', bg: 'bg-blue-500/15', text: 'text-blue-600' },
    subcategories: [
      { name: 'Rent', nameJa: '家賃', nameEs: 'Alquiler' },
      { name: 'Utilities', nameJa: '光熱費', nameEs: 'Servicios' },
      { name: 'Food', nameJa: '食料品', nameEs: 'Alimentos' },
      { name: 'Household items', nameJa: '日用品', nameEs: 'Artículos del hogar' },
      { name: 'Internet & Phone', nameJa: 'インターネット・携帯', nameEs: 'Internet y teléfono' }
    ]
  },
  {
    name: 'Work & learning',
    nameJa: '仕事・学習',
    nameEs: 'Trabajo y formación',
    color: { hex: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-600' },
    subcategories: [
      { name: 'Software & tools', nameJa: 'ソフトウェア・ツール', nameEs: 'Software y herramientas' },
      { name: 'Education & training', nameJa: '教育・学習', nameEs: 'Educación y formación' },
      { name: 'Work transport', nameJa: '仕事の移動', nameEs: 'Transporte laboral' },
      { name: 'Work equipment', nameJa: '仕事用機器', nameEs: 'Equipo de trabajo' }
    ]
  },
  {
    name: 'Personal needs',
    nameJa: '身の回りの必要品',
    nameEs: 'Necesidades personales',
    color: { hex: '#8b5cf6', bg: 'bg-violet-500/15', text: 'text-violet-600' },
    subcategories: [
      { name: 'Clothing & footwear', nameJa: '衣服・靴', nameEs: 'Ropa y calzado' },
      { name: 'Health', nameJa: '健康', nameEs: 'Salud' },
      { name: 'Personal care', nameJa: '身だしなみ・ケア', nameEs: 'Cuidado personal' },
      { name: 'Personal transport', nameJa: '個人の移動', nameEs: 'Movilidad personal' }
    ]
  },
  {
    name: 'Entertainment',
    nameJa: '娯楽',
    nameEs: 'Entretenimiento',
    color: { hex: '#d946ef', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600' },
    subcategories: [
      { name: 'Eating out', nameJa: '外食・カフェ', nameEs: 'Restaurantes y cafés' },
      { name: 'Streaming', nameJa: '動画・音楽配信', nameEs: 'Streaming' },
      { name: 'Games & hobbies', nameJa: 'ゲーム・趣味', nameEs: 'Juegos y hobbies' },
      { name: 'Travel & events', nameJa: '旅行・イベント', nameEs: 'Viajes y eventos' },
      { name: 'Social & Gifts', nameJa: '交際・贈り物', nameEs: 'Vida social y regalos' }
    ]
  },
  {
    name: 'Savings',
    nameJa: '貯蓄',
    nameEs: 'Ahorros',
    color: { hex: '#14b8a6', bg: 'bg-teal-500/15', text: 'text-teal-600' },
    subcategories: [
      { name: 'Savings', nameJa: '貯金', nameEs: 'Ahorro' },
      { name: 'Future funds', nameJa: '将来用', nameEs: 'Fondos futuros' }
    ]
  },
  {
    name: 'Others',
    nameJa: '要確認',
    nameEs: 'Por revisar',
    color: { hex: '#94a3b8', bg: 'bg-slate-500/15', text: 'text-slate-600' },
    subcategories: [
      { name: 'Miscellaneous', nameJa: '未分類', nameEs: 'Sin clasificar' },
      { name: 'Purpose unconfirmed', nameJa: '目的未確認', nameEs: 'Propósito sin confirmar' },
      { name: 'Personal allocation', nameJa: '個人予算への配分', nameEs: 'Asignación personal' }
    ]
  }
];

/**
 * Mapping from the pre-2026 taxonomy (Dining, Entertainment, Shopping, …) to
 * the canonical one. Keys are `category|subcategory` in lowercase; a `|*` key
 * is the fallback for any subcategory of that legacy category.
 */
const LEGACY_PAIR_MAP: Record<string, { category: string; subcategory: string }> = {
  'housing|rent': { category: 'Home & daily living', subcategory: 'Rent' },
  'housing|utilities': { category: 'Home & daily living', subcategory: 'Utilities' },
  'housing|internet & phone': { category: 'Home & daily living', subcategory: 'Internet & Phone' },
  'housing|*': { category: 'Home & daily living', subcategory: 'Miscellaneous' },
  'groceries|food': { category: 'Home & daily living', subcategory: 'Food' },
  'groceries|household items': { category: 'Home & daily living', subcategory: 'Household items' },
  'groceries|medicine & supplements': { category: 'Personal needs', subcategory: 'Health' },
  'groceries|personal care': { category: 'Personal needs', subcategory: 'Personal care' },
  'groceries|supermarkets': { category: 'Home & daily living', subcategory: 'Food' },
  'groceries|alcohol & beverage': { category: 'Home & daily living', subcategory: 'Food' },
  'groceries|specialty food': { category: 'Home & daily living', subcategory: 'Food' },
  'groceries|*': { category: 'Home & daily living', subcategory: 'Miscellaneous' },
  'transport|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'car|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'fun & social|eating out': { category: 'Entertainment', subcategory: 'Eating out' },
  'fun & social|travel & entertainment': { category: 'Entertainment', subcategory: 'Travel & events' },
  'fun & social|social & gifts': { category: 'Entertainment', subcategory: 'Social & Gifts' },
  'fun & social|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'personal spending|personal allowance': { category: 'Others', subcategory: 'Personal allocation' },
  'personal spending|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'dining|*': { category: 'Entertainment', subcategory: 'Eating out' },
  'entertainment|streaming': { category: 'Entertainment', subcategory: 'Streaming' },
  'entertainment|gaming': { category: 'Entertainment', subcategory: 'Games & hobbies' },
  'entertainment|*': { category: 'Entertainment', subcategory: 'Travel & events' },
  'subscriptions & services|mobile phone': { category: 'Home & daily living', subcategory: 'Internet & Phone' },
  'subscriptions & services|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'shopping|retail & home': { category: 'Home & daily living', subcategory: 'Household items' },
  'shopping|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'health|*': { category: 'Personal needs', subcategory: 'Health' },
  'travel|*': { category: 'Others', subcategory: 'Purpose unconfirmed' },
  'hobbies|*': { category: 'Entertainment', subcategory: 'Games & hobbies' },
  'other|*': { category: 'Others', subcategory: 'Miscellaneous' }
};

// lowercase pair key -> canonical-cased pair, so legacy casing differences
// ('Public Transport') normalize to the canonical names ('Public transport')
const CANONICAL_PAIR_LOOKUP = new Map(
  CATEGORIES.flatMap((cat) =>
    cat.subcategories.map(
      (sub) =>
        [
          `${cat.name.toLowerCase()}|${sub.name.toLowerCase()}`,
          { category: cat.name, subcategory: sub.name }
        ] as const
    )
  )
);

const CANONICAL_CATEGORY_NAMES = new Map(
  CATEGORIES.map((cat) => [cat.name.toLowerCase(), cat.name])
);

/**
 * Map a possibly-legacy category/subcategory pair to the canonical taxonomy.
 * Pairs already in the canonical taxonomy (or fully unknown ones) pass through
 * unchanged so manual custom labels are never destroyed.
 */
export function normalizeCategoryPair(
  category?: string | null,
  subcategory?: string | null,
  categorySource?: string | null
): { category: string; subcategory: string } {
  const cat = (category ?? '').trim();
  const sub = (subcategory ?? '').trim();

  if (!cat) {
    return { category: DEFAULT_CATEGORY, subcategory: sub || DEFAULT_SUBCATEGORY };
  }

  if (categorySource === 'manual') return { category: cat, subcategory: sub };

  const catKey = cat.toLowerCase();
  const subKey = sub.toLowerCase();

  const canonicalPair = CANONICAL_PAIR_LOOKUP.get(`${catKey}|${subKey}`);
  if (canonicalPair) {
    return canonicalPair;
  }

  const mapped = LEGACY_PAIR_MAP[`${catKey}|${subKey}`] ?? (!CANONICAL_CATEGORY_NAMES.has(catKey) ? LEGACY_PAIR_MAP[`${catKey}|*`] : undefined);
  if (mapped) {
    return mapped;
  }

  // Canonical category with a custom subcategory: keep it, normalizing casing.
  const canonicalName = CANONICAL_CATEGORY_NAMES.get(catKey);
  if (canonicalName) {
    return { category: canonicalName, subcategory: sub || DEFAULT_SUBCATEGORY };
  }

  return { category: cat, subcategory: sub || DEFAULT_SUBCATEGORY };
}

function hashHue(value: string): number {
  let hash = 0;
  const normalized = value || '';
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 360;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateColorFromName(name: string): CategoryColorConfig {
  const hue = hashHue(name.trim().toLowerCase());
  const hex = hslToHex(hue, 0.65, 0.55);
  return {
    hex,
    bg: 'bg-slate-500/15',
    text: 'text-slate-600'
  };
}

export const CATEGORY_COLORS: Record<string, CategoryColorConfig> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.color])
);

const LEGACY_CATEGORY_JA = { Housing: '住まい', Groceries: '食費・日用品・健康', Transport: '交通', 'Fun & Social': '娯楽・交際', 'Personal spending': '個人費（お小遣い）' };
const LEGACY_CATEGORY_ES = { Housing: 'Hogar', Groceries: 'Necesidades diarias', Transport: 'Transporte', 'Fun & Social': 'Ocio y vida social', 'Personal spending': 'Gastos personales' };

export const CATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.nameJa])
);

export const SUBCATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameJa]))
);

export const CATEGORY_ES_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.nameEs])
);

export const SUBCATEGORY_ES_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameEs]))
);

export function getCategoryJapaneseName(category: string): string | undefined {
  return CATEGORY_JA_NAMES[category] || LEGACY_CATEGORY_JA[category as keyof typeof LEGACY_CATEGORY_JA];
}

const LEGACY_SUBCATEGORY_JA: Record<string, string> = { 'Medicine & Supplements': '薬・サプリ', 'Travel & Entertainment': '旅行・エンタメ', Subscriptions: 'サブスク', 'Personal Allowance': 'おこづかい', 'Hobbies & Shopping': '趣味・買い物', Fuel: 'ガソリン', 'Public transport': '公共交通', 'Taxi & Rideshare': 'タクシー・配車', 'Parking & Tolls': '駐車場・有料道路', 'Car maintenance': '車の整備' };
const LEGACY_SUBCATEGORY_ES: Record<string, string> = { 'Medicine & Supplements': 'Medicinas y suplementos', 'Travel & Entertainment': 'Viajes y entretenimiento', Subscriptions: 'Suscripciones', 'Personal Allowance': 'Mesada personal', 'Hobbies & Shopping': 'Hobbies y compras', Fuel: 'Combustible', 'Public transport': 'Transporte público', 'Taxi & Rideshare': 'Taxi y rideshare', 'Parking & Tolls': 'Estacionamiento y peajes', 'Car maintenance': 'Mantenimiento del auto' };

export function getSubcategoryJapaneseName(subcategory: string): string | undefined {
  return SUBCATEGORY_JA_NAMES[subcategory] || LEGACY_SUBCATEGORY_JA[subcategory];
}

export function getCategorySpanishName(category: string): string | undefined {
  return CATEGORY_ES_NAMES[category] || LEGACY_CATEGORY_ES[category as keyof typeof LEGACY_CATEGORY_ES];
}

export function getSubcategorySpanishName(subcategory: string): string | undefined {
  return SUBCATEGORY_ES_NAMES[subcategory] || LEGACY_SUBCATEGORY_ES[subcategory];
}

export function getLocalizedCategoryName(
  category: string,
  locale: 'en' | 'ja' | 'es' = 'en'
): string {
  if (locale === 'ja') return getCategoryJapaneseName(category) || category;
  if (locale === 'es') return getCategorySpanishName(category) || category;
  return CATEGORY_DISPLAY_NAMES[category] || category;
}

export function getLocalizedSubcategoryName(
  subcategory: string,
  locale: 'en' | 'ja' | 'es' = 'en'
): string {
  if (locale === 'ja') return getSubcategoryJapaneseName(subcategory) || subcategory;
  if (locale === 'es') return getSubcategorySpanishName(subcategory) || subcategory;
  return subcategory;
}

export function getSubcategoriesForCategory(category: string): SubcategoryInfo[] {
  const cat = CATEGORIES.find(c => c.name === category);
  return cat?.subcategories || [];
}

const NORMALIZED_CATEGORY_COLORS: Record<string, CategoryColorConfig> = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([key, value]) => [key.toLowerCase(), value])
);

export const DEFAULT_CATEGORY_COLOR: CategoryColorConfig = {
  hex: '#64748b',
  bg: 'bg-slate-500/15',
  text: 'text-slate-600'
};

export function getCategoryColor(category: string): CategoryColorConfig {
  const key = (category || '').toLowerCase().trim();
  return NORMALIZED_CATEGORY_COLORS[key] || generateColorFromName(category);
}

export function getCategoryHexColor(category: string): string {
  return getCategoryColor(category).hex;
}

export function getCategoryBadgeStyles(category: string): { bg: string; text: string; style: { backgroundColor: string; color: string } } {
  const color = getCategoryColor(category);
  return {
    bg: color.bg,
    text: color.text,
    // Preserve category identity without forcing a light-only badge background.
    style: {
      backgroundColor: `color-mix(in srgb, ${color.hex} 16%, transparent)`,
      color: color.hex
    }
  } as const;
}
