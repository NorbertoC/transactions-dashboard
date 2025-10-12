/**
 * Category color configuration for consistent styling across the application
 * These colors are used in pie charts, badges, and other category indicators
 */

export interface CategoryColorConfig {
  hex: string;
  bg: string;
  text: string;
}

export const CATEGORY_COLORS: Record<string, CategoryColorConfig> = {
  'Food': {
    hex: '#4ade80',
    bg: 'bg-green-500/20',
    text: 'text-green-500'
  },
  'Groceries': {
    hex: '#4ade80',
    bg: 'bg-green-500/20',
    text: 'text-green-500'
  },
  'Transport': {
    hex: '#fb923c',
    bg: 'bg-orange-500/20',
    text: 'text-orange-500'
  },
  'Transportation': {
    hex: '#fb923c',
    bg: 'bg-orange-500/20',
    text: 'text-orange-500'
  },
  'Entertainment': {
    hex: '#a78bfa',
    bg: 'bg-purple-500/20',
    text: 'text-purple-500'
  },
  'Utilities': {
    hex: '#38bdf8',
    bg: 'bg-sky-500/20',
    text: 'text-sky-500'
  },
  'Shopping': {
    hex: '#f472b6',
    bg: 'bg-pink-500/20',
    text: 'text-pink-500'
  },
  'Rent': {
    hex: '#137fec',
    bg: 'bg-primary/10',
    text: 'text-primary'
  },
  'Travel': {
    hex: '#137fec',
    bg: 'bg-primary/10',
    text: 'text-primary'
  },
  'Other': {
    hex: '#9ca3af',
    bg: 'bg-gray-500/20',
    text: 'text-gray-500'
  }
};

/**
 * Default color for categories not in the CATEGORY_COLORS map
 */
export const DEFAULT_CATEGORY_COLOR: CategoryColorConfig = {
  hex: '#6366f1',
  bg: 'bg-gray-500/20',
  text: 'text-gray-500'
};

/**
 * Get color configuration for a category
 * @param category - The category name
 * @returns CategoryColorConfig object with hex, bg, and text colors
 */
export function getCategoryColor(category: string): CategoryColorConfig {
  return CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
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
export function getCategoryBadgeStyles(category: string): { bg: string; text: string } {
  const color = getCategoryColor(category);
  return { bg: color.bg, text: color.text };
}
