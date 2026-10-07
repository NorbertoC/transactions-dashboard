import { act, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Header from '../Header';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { messages } from '@/i18n/messages';

const route = vi.hoisted(() => ({ pathname: '/plan' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }));
vi.mock('../ThemeToggle', () => ({ default: () => null }));

let root: Root, container: HTMLDivElement;
const stored = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  stored.clear(); route.pathname = '/plan';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it.each(['en', 'es', 'ja'] as const)('removes Fixed plan from desktop and mobile menus in %s while preserving other destinations', locale => {
  localStorage.setItem('gastos.locale', locale);
  act(() => root.render(<LocaleProvider><Header /></LocaleProvider>));
  const menus = [...container.querySelectorAll('nav')];
  expect(menus).toHaveLength(2);
  for (const menu of menus) {
    const links = [...menu.querySelectorAll('a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/', '/month', '/forecast', '/plan']);
    expect(links.map(link => link.textContent)).toEqual(['nav.overview', 'nav.month', 'nav.forecast', 'nav.plan'].map(key => messages[locale][key as keyof typeof messages.en]));
    expect(menu.textContent).not.toContain(messages[locale]['nav.recurring']);
    expect(menu.querySelector('[aria-current=page]')?.getAttribute('href')).toBe('/plan');
  }
  expect(container.querySelector('a[href="/recurring"]')).toBeNull();
});

it('does not select another tab when visiting the retained recurring route directly', () => {
  route.pathname = '/recurring';
  act(() => root.render(<LocaleProvider><Header /></LocaleProvider>));
  expect(container.querySelector('[aria-current=page]')).toBeNull();
  expect(container.querySelectorAll('nav a')).toHaveLength(8);
});
