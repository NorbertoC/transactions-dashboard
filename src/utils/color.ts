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
      return clamp(channel + (255 - channel) * amount);
    }
    return clamp(channel + channel * amount);
  };

  const nr = adjustChannel(r);
  const ng = adjustChannel(g);
  const nb = adjustChannel(b);

  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function lightenColor(hex: string, factor: number): string {
  return adjustColor(hex, Math.max(0, Math.min(1, factor)));
}

export function darkenColor(hex: string, factor: number): string {
  return adjustColor(hex, -Math.max(0, Math.min(1, factor)));
}
