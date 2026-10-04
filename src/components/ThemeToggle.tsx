'use client';

import { useEffect, useState } from 'react';
import { Moon, Palette, Sun } from 'lucide-react';
import { useLocale } from '@/i18n/LocaleProvider';

const PALETTES = ['green', 'blue', 'orange', 'pink', 'purple'] as const;
type PaletteName = typeof PALETTES[number];
type Theme = 'dark' | 'light';

function applyAppearance(theme: Theme, palette: PaletteName) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = palette;
  document.documentElement.style.colorScheme = theme;
  requestAnimationFrame(() => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--background').trim()));
  try {
    localStorage.setItem('gastos.theme', theme);
    localStorage.setItem('gastos.palette', palette);
  } catch { /* Appearance remains usable when storage is unavailable. */ }
}

export default function ThemeToggle() {
  const { t } = useLocale();
  const [theme, setTheme] = useState<Theme>('dark');
  const [palette, setPalette] = useState<PaletteName>('green');
  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const storedPalette = document.documentElement.dataset.palette;
    const activePalette = PALETTES.find(value => value === storedPalette) ?? 'green';
    setTheme(activeTheme);
    setPalette(activePalette);
    applyAppearance(activeTheme, activePalette);
  }, []);
  const nextPalette = PALETTES[(PALETTES.indexOf(palette) + 1) % PALETTES.length];
  const label = theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark');
  const paletteLabel = t('theme.cycle', { current: t(`theme.${palette}`), next: t(`theme.${nextPalette}`) });
  return <>
    <button type="button" aria-label={label} title={label} aria-pressed={theme === 'dark'} onClick={() => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
      applyAppearance(nextTheme, palette);
    }}>
      {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
    <button type="button" aria-label={paletteLabel} title={paletteLabel} onClick={() => {
      setPalette(nextPalette);
      applyAppearance(theme, nextPalette);
    }}>
      <Palette className="h-5 w-5" aria-hidden="true" /><span>{t(`theme.${palette}`)}</span>
    </button>
  </>;
}
