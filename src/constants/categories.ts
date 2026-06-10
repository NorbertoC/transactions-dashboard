/**
 * Canonical category taxonomy — single source of truth for the dashboard.
 *
 * The Express API (transactions-api/classification.js) must stay in sync with
 * this taxonomy: same category/subcategory names, same legacy mapping.
 */

import { lightenColor } from '@/utils/color';

export interface CategoryColorConfig {
  hex: string;
  bg: string;
  text: string;
}

export interface CategoryInfo {
  name: string;
  nameJa: string;
  color: CategoryColorConfig;
  subcategories: SubcategoryInfo[];
}

export interface SubcategoryInfo {
  name: string;
  nameJa: string;
}

export const DEFAULT_CATEGORY = 'Others';
export const DEFAULT_SUBCATEGORY = 'Miscellaneous';

export const CATEGORIES: CategoryInfo[] = [
  {
    name: 'Housing',
    nameJa: '住まい',
    color: { hex: '#2563eb', bg: 'bg-blue-500/15', text: 'text-blue-600' },
    subcategories: [
      { name: 'Rent', nameJa: '家賃' },
      { name: 'Utilities', nameJa: '光熱費' },
      { name: 'Internet & Phone', nameJa: 'インターネット・携帯' }
    ]
  },
  {
    name: 'Groceries',
    nameJa: '食費・日用品・健康',
    color: { hex: '#22c55e', bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
    subcategories: [
      { name: 'Food', nameJa: '食料品' },
      { name: 'Household items', nameJa: '日用品（洗剤・紙類）' },
      { name: 'Medicine & Supplements', nameJa: '薬・サプリ' },
      { name: 'Personal care', nameJa: '美容・セルフケア' }
    ]
  },
  {
    name: 'Transport',
    nameJa: '交通',
    color: { hex: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-600' },
    subcategories: [
      { name: 'Fuel', nameJa: 'ガソリン' },
      { name: 'Public transport', nameJa: '公共交通' },
      { name: 'Taxi & Rideshare', nameJa: 'タクシー・配車' },
      { name: 'Car maintenance', nameJa: '車関連（WOF・整備）' }
    ]
  },
  {
    name: 'Fun & Social',
    nameJa: '娯楽・交際',
    color: { hex: '#d946ef', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600' },
    subcategories: [
      { name: 'Eating out', nameJa: '外食・カフェ' },
      { name: 'Travel & Entertainment', nameJa: '旅行・エンタメ' },
      { name: 'Subscriptions', nameJa: 'サブスク' },
      { name: 'Social & Gifts', nameJa: '交際費・プレゼント' }
    ]
  },
  {
    name: 'Personal spending',
    nameJa: '個人費（お小遣い）',
    color: { hex: '#8b5cf6', bg: 'bg-violet-500/15', text: 'text-violet-600' },
    subcategories: [
      { name: 'Personal Allowance', nameJa: 'おこづかい' },
      { name: 'Hobbies & Shopping', nameJa: '趣味・買い物' }
    ]
  },
  {
    name: 'Savings',
    nameJa: '貯蓄',
    color: { hex: '#14b8a6', bg: 'bg-teal-500/15', text: 'text-teal-600' },
    subcategories: [
      { name: 'Savings', nameJa: '貯金' },
      { name: 'Future funds', nameJa: '将来用' }
    ]
  },
  {
    name: 'Others',
    nameJa: 'その他',
    color: { hex: '#94a3b8', bg: 'bg-slate-500/15', text: 'text-slate-600' },
    subcategories: [
      { name: 'Miscellaneous', nameJa: '分類に迷うもの' }
    ]
  }
];

/**
 * Mapping from the pre-2026 taxonomy (Dining, Entertainment, Shopping, …) to
 * the canonical one. Keys are `category|subcategory` in lowercase; a `|*` key
 * is the fallback for any subcategory of that legacy category.
 */
const LEGACY_PAIR_MAP: Record<string, { category: string; subcategory: string }> = {
  'transport|public transport': { category: 'Transport', subcategory: 'Public transport' },
  'transport|rideshare': { category: 'Transport', subcategory: 'Taxi & Rideshare' },
  'transport|micromobility': { category: 'Transport', subcategory: 'Taxi & Rideshare' },
  'car|fuel & charging': { category: 'Transport', subcategory: 'Fuel' },
  'car|services & maintenance': { category: 'Transport', subcategory: 'Car maintenance' },
  'car|*': { category: 'Transport', subcategory: 'Car maintenance' },
  'groceries|supermarkets': { category: 'Groceries', subcategory: 'Food' },
  'groceries|alcohol & beverage': { category: 'Groceries', subcategory: 'Food' },
  'groceries|specialty food': { category: 'Groceries', subcategory: 'Food' },
  'dining|*': { category: 'Fun & Social', subcategory: 'Eating out' },
  'entertainment|streaming': { category: 'Fun & Social', subcategory: 'Subscriptions' },
  'entertainment|gaming': { category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
  'entertainment|*': { category: 'Fun & Social', subcategory: 'Travel & Entertainment' },
  'subscriptions & services|mobile phone': { category: 'Housing', subcategory: 'Internet & Phone' },
  'subscriptions & services|*': { category: 'Fun & Social', subcategory: 'Subscriptions' },
  'shopping|retail & home': { category: 'Groceries', subcategory: 'Household items' },
  'shopping|*': { category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
  'health|*': { category: 'Groceries', subcategory: 'Medicine & Supplements' },
  'travel|*': { category: 'Fun & Social', subcategory: 'Travel & Entertainment' },
  'hobbies|*': { category: 'Personal spending', subcategory: 'Hobbies & Shopping' },
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
  subcategory?: string | null
): { category: string; subcategory: string } {
  const cat = (category ?? '').trim();
  const sub = (subcategory ?? '').trim();

  if (!cat) {
    return { category: DEFAULT_CATEGORY, subcategory: sub || DEFAULT_SUBCATEGORY };
  }

  const catKey = cat.toLowerCase();
  const subKey = sub.toLowerCase();

  const canonicalPair = CANONICAL_PAIR_LOOKUP.get(`${catKey}|${subKey}`);
  if (canonicalPair) {
    return canonicalPair;
  }

  const mapped = LEGACY_PAIR_MAP[`${catKey}|${subKey}`] ?? LEGACY_PAIR_MAP[`${catKey}|*`];
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

export const CATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.nameJa])
);

export const SUBCATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameJa]))
);

export function getCategoryJapaneseName(category: string): string | undefined {
  return CATEGORY_JA_NAMES[category];
}

export function getSubcategoryJapaneseName(subcategory: string): string | undefined {
  return SUBCATEGORY_JA_NAMES[subcategory];
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
    // Inline styles ensure color fidelity even if utility classes are purged or unsupported
    style: {
      backgroundColor: lightenColor(color.hex, 0.88),
      color: color.hex
    }
  } as const;
}
