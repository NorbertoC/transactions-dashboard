/**
 * Category color configuration for consistent styling across the application
 * These colors are used in pie charts, badges, and other category indicators
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

function hashHue(value: string): number {
  let hash = 0;
  const normalized = value || '';
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Spread hues across the wheel; ensure positive and wrap at 360
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
  const hex = hslToHex(hue, 0.65, 0.55); // moderate saturation/lightness
  return {
    hex,
    bg: 'bg-slate-500/15',
    text: 'text-slate-600'
  };
}

/**
 * Primary categories defined by the user - these get priority colors
 */
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

// Build CATEGORY_COLORS from CATEGORIES (primary categories have priority)
export const CATEGORY_COLORS: Record<string, CategoryColorConfig> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.color])
);

// Build Japanese name lookup maps
export const CATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(cat => [cat.name, cat.nameJa])
);

export const SUBCATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameJa]))
);

/**
 * Get Japanese name for a category
 */
export function getCategoryJapaneseName(category: string): string | undefined {
  return CATEGORY_JA_NAMES[category];
}

/**
 * Get Japanese name for a subcategory
 */
export function getSubcategoryJapaneseName(subcategory: string): string | undefined {
  return SUBCATEGORY_JA_NAMES[subcategory];
}

/**
 * Get subcategories for a given category
 */
export function getSubcategoriesForCategory(category: string): SubcategoryInfo[] {
  const cat = CATEGORIES.find(c => c.name === category);
  return cat?.subcategories || [];
}

// Build a lowercase lookup to avoid issues with casing/spacing differences from external sources
const NORMALIZED_CATEGORY_COLORS: Record<string, CategoryColorConfig> = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([key, value]) => [key.toLowerCase(), value])
);

/**
 * Default color for categories not in the CATEGORY_COLORS map
 */
export const DEFAULT_CATEGORY_COLOR: CategoryColorConfig = {
  hex: '#64748b',
  bg: 'bg-slate-500/15',
  text: 'text-slate-600'
};

/**
 * Get color configuration for a category
 * @param category - The category name
 * @returns CategoryColorConfig object with hex, bg, and text colors
 */
export function getCategoryColor(category: string): CategoryColorConfig {
  const key = (category || '').toLowerCase().trim();
  return NORMALIZED_CATEGORY_COLORS[key] || generateColorFromName(category);
}

/**
 * Get hex color for a category (used in pie charts)
 * @param category - The category name
 * @returns Hex color string
 */
export function getCategoryHexColor(category: string): string {
  return getCategoryColor(category).hex;
}

/**
 * Get badge styles for a category (used in tables and badges)
 * @param category - The category name
 * @returns Object with bg and text Tailwind classes
 */
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
