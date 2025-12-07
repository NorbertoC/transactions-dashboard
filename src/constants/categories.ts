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

export const CATEGORY_COLORS: Record<string, CategoryColorConfig> = {
  'Groceries': {
    hex: '#22c55e',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600'
  },
  'Food': {
    hex: '#22c55e',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600'
  },
  'Dining': {
    hex: '#f59e0b',
    bg: 'bg-amber-500/15',
    text: 'text-amber-600'
  },
  'Transport': {
    hex: '#06b6d4',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-600'
  },
  'Transportation': {
    hex: '#06b6d4',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-600'
  },
  'Car': {
    hex: '#2563eb',
    bg: 'bg-blue-500/15',
    text: 'text-blue-600'
  },
  'Entertainment': {
    hex: '#d946ef',
    bg: 'bg-fuchsia-500/15',
    text: 'text-fuchsia-600'
  },
  'Utilities': {
    hex: '#0ea5e9',
    bg: 'bg-sky-500/15',
    text: 'text-sky-600'
  },
  'Shopping': {
    hex: '#e11d48',
    bg: 'bg-rose-500/15',
    text: 'text-rose-600'
  },
  'Subscriptions & Services': {
    hex: '#6366f1',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-600'
  },
  'Health': {
    hex: '#14b8a6',
    bg: 'bg-teal-500/15',
    text: 'text-teal-600'
  },
  'Rent': {
    hex: '#a3e635',
    bg: 'bg-lime-500/15',
    text: 'text-lime-600'
  },
  'Travel': {
    hex: '#fb923c',
    bg: 'bg-orange-500/15',
    text: 'text-orange-600'
  },
  'Hobbies': {
    hex: '#8b5cf6',
    bg: 'bg-violet-500/15',
    text: 'text-violet-600'
  },
  'Other': {
    hex: '#94a3b8',
    bg: 'bg-slate-500/15',
    text: 'text-slate-600'
  }
};

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
