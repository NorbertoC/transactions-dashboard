function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

function normalizeHex(hex: string): string {
  const value = hex.replace('#', '').trim();
  if (value.length === 3) {
    return value.split('').map((char) => char + char).join('');
  }
  return value.padEnd(6, '0');
}

export function adjustColor(hex: string, amount: number): string {
  const normalized = normalizeHex(hex);
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const adjustChannel = (channel: number) => {
    if (amount >= 0) {
      return Math.round(clamp(channel + (255 - channel) * amount));
    }
    return Math.round(clamp(channel + channel * amount));
  };

  const nr = adjustChannel(r);
  const ng = adjustChannel(g);
  const nb = adjustChannel(b);

  const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function lightenColor(hex: string, factor: number): string {
  return adjustColor(hex, Math.max(0, Math.min(1, factor)));
}

export function darkenColor(hex: string, factor: number): string {
  return adjustColor(hex, -Math.max(0, Math.min(1, factor)));
}

/**
 * Generates an array of color variants from a base color
 * @param baseColor - The base color in hex format
 * @param count - Number of variants to generate
 * @param sortedByValue - Whether the variants should be ordered by value (highest first)
 * @returns Array of color variants, with lightest colors for highest values
 */
export function generateColorVariants(baseColor: string, count: number, sortedByValue: boolean = true): string[] {
  if (count <= 1) return [baseColor];
  
  const variants: string[] = [];
  
  // For sorted by value, we want the first (highest value) to be lightest
  // For unsorted, we distribute evenly
  for (let i = 0; i < count; i++) {
    if (sortedByValue) {
      // First item (highest value) gets the lightest shade
      // Last item (lowest value) gets the darkest shade
      const factor = 0.6 - (i / (count - 1)) * 0.4; // Range from 0.6 to 0.2
      const lightened = lightenColor(baseColor, factor);
      variants.push(lightened);
    } else {
      // Even distribution for unsorted data
      const factor = 0.1 + (i / Math.max(1, count - 1)) * 0.5; // Range from 0.1 to 0.6
      const lightened = lightenColor(baseColor, factor);
      variants.push(lightened);
    }
  }
  
  return variants;
}
