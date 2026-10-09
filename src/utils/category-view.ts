import { CATEGORIES, getLocalizedCategoryName, getLocalizedSubcategoryName, getTaxonomyPair, type CategoryInfo } from '@/constants/categories';
import { LEGACY_CATEGORIES } from '@/constants/legacy-categories';
import type { Transaction } from '@/types/transaction';

type Pair = Pick<Transaction, 'category' | 'subcategory'>;
type Locale = 'en' | 'es' | 'ja';
export interface CategoryView {
  groupId: string;
  subcategoryId: string;
  category: string;
  subcategory: string | null | undefined;
  status: 'current' | 'equivalent' | 'historical' | 'custom';
}
const lookupKey = (value: string | null | undefined) => typeof value === 'string' ? value.normalize('NFKC').trim().toLocaleLowerCase('en-NZ').replace(/\s+/g, ' ') : '';
const pairKey = (category: string, subcategory: string | null | undefined) => JSON.stringify([lookupKey(category), lookupKey(subcategory)]);
const literalId = (kind: string, value: unknown) => `${kind}:${JSON.stringify(value)}`;
const groupAliases = new Map<string, CategoryInfo>();
const pairs = new Map<string, CategoryView>();
const labels = (name: string, type: 'category' | 'subcategory') => [...new Set([name, ...(['en', 'es', 'ja'] as const).map(locale => type === 'category' ? getLocalizedCategoryName(name, locale) : getLocalizedSubcategoryName(name, locale))])];

for (const group of CATEGORIES) {
  for (const name of [group.key, ...labels(group.name, 'category'), group.nameEs, group.nameJa]) groupAliases.set(lookupKey(name), group);
}
for (const old of LEGACY_CATEGORIES) {
  const group = CATEGORIES.find(item => item.key === old.key)!;
  for (const name of [old.name, old.nameEs, old.nameJa]) groupAliases.set(lookupKey(name), group);
}
function add(categoryNames: string[], subcategoryNames: string[], groupId: string, subcategoryId: string | null, status: CategoryView['status']) {
  const group = CATEGORIES.find(item => item.key === groupId);
  const sub = group?.subcategories.find(item => item.key === subcategoryId);
  for (const category of categoryNames) for (const subcategory of subcategoryNames) {
    const id = pairKey(category, subcategory);
    const value = { groupId, category: group?.name ?? categoryNames[0], subcategory: sub?.name ?? subcategoryNames[0], subcategoryId: sub?.key ?? literalId('historical', [groupId, subcategoryNames[0]]), status };
    const prior = pairs.get(id);
    if (prior && (prior.groupId !== groupId || prior.subcategory !== value.subcategory)) throw new Error(`Conflicting category alias: ${id}`);
    if (!prior) pairs.set(id, value);
  }
}
for (const group of CATEGORIES) for (const sub of group.subcategories) {
  add([...labels(group.name, 'category'), group.nameEs, group.nameJa], [sub.name, sub.nameEs, sub.nameJa], group.key, sub.key, 'current');
}
const merged: Record<string, string> = { restaurants: 'eating_out', cafes: 'eating_out', food_treats: 'snacks' };
for (const old of LEGACY_CATEGORIES) for (const sub of old.subcategories) {
  const group = CATEGORIES.find(item => item.key === old.key)!;
  const current = group.subcategories.find(item => item.key === (merged[sub.key] ?? sub.key));
  add([...labels(old.name, 'category'), group.name, group.nameEs, group.nameJa], [sub.name, sub.nameEs, sub.nameJa], group.key, current?.key ?? null, current ? 'equivalent' : 'historical');
}
const legacy = (category: string, subcategory: string, group: string, sub: string | null, historical = false) => add(labels(category, 'category'), labels(subcategory, 'subcategory'), group, sub, historical ? 'historical' : 'equivalent');
legacy('Transport', 'Fuel', 'basic_living', 'fuel');
legacy('Transport', 'Public transport', 'basic_living', 'public_transport');
legacy('Transport', 'Taxi & Rideshare', 'personal_purchases', 'occasional_mobility');
legacy('Transport', 'Parking & Tolls', 'personal_purchases', 'occasional_mobility');
for (const category of ['Housing', 'Home & daily living']) {
  legacy(category, 'Rent', 'basic_living', 'rent');
  legacy(category, 'Utilities', 'basic_living', 'power_internet');
  legacy(category, 'Household items', 'personal_purchases', 'home_purchases');
}
for (const category of ['Groceries', 'Home & daily living']) {
  for (const sub of ['Food', 'Supermarkets']) legacy(category, sub, 'basic_living', 'home_food');
  legacy(category, 'Medicine & Supplements', 'personal_purchases', 'health');
  legacy(category, 'Personal care', 'personal_purchases', 'personal_care');
}
legacy('Groceries', 'Household items', 'personal_purchases', 'home_purchases');
for (const category of ['Personal needs & purchases', 'Personal needs']) {
  legacy(category, 'Health', 'personal_purchases', 'health');
  legacy(category, 'Clothing & footwear', 'personal_purchases', 'clothing_footwear');
  legacy(category, 'Personal care', 'personal_purchases', 'personal_care');
}
legacy('Personal needs & purchases', 'Purchases for home', 'personal_purchases', 'home_purchases');
legacy('Personal purchases', 'Purchases for home', 'personal_purchases', 'home_purchases');
legacy('Work & learning', 'Work equipment', 'work_learning', 'work_equipment');
legacy('Work & learning', 'Education & training', 'work_learning', 'courses_study');
legacy('Subscriptions & services', 'Mobile phone', 'basic_living', 'phone');
legacy('Shopping', 'Retail & home', 'personal_purchases', 'home_purchases');
legacy('Shopping', 'Clothing', 'personal_purchases', 'clothing_footwear');
legacy('Personal subscriptions', 'Streaming & content', 'subscriptions', null, true);
legacy('Personal subscriptions', 'Memberships & other services', 'subscriptions', null, true);
legacy('Outings & entertainment', 'Meals & treats', 'meals_outings', null, true);
legacy('Outings & entertainment', 'Activities & entertainment', 'entertainment', null, true);
// Car placement is undecided. Keep these original groups, rather than assigning a purpose.
for (const category of ['Transport', 'Car']) for (const sub of ['Insurance', 'Car maintenance']) {
  legacy(category, sub, literalId('category', category), null, true);
}

/** View identity only. Never modify stored labels, manual provenance or draft keys. */
export function resolveCategoryView(row: Pair): CategoryView {
  const exact = pairs.get(pairKey(row.category, row.subcategory));
  const group = exact ? CATEGORIES.find(item => item.key === exact.groupId) : groupAliases.get(lookupKey(row.category));
  const category = exact?.category ?? group?.name ?? row.category;
  const subcategory = exact?.subcategory ?? row.subcategory;
  return {
    groupId: exact?.groupId ?? group?.key ?? literalId('category', row.category),
    subcategoryId: exact?.subcategoryId ?? literalId('subcategory', row.subcategory ?? null),
    category, subcategory,
    status: exact?.status ?? 'custom',
  };
}
export function matchesCategoryView(row: Pair, selected: string): boolean {
  const view = resolveCategoryView(row);
  const group = groupAliases.get(lookupKey(selected));
  return view.groupId === selected || (group ? view.groupId === group.key : row.category === selected);
}
export function matchesSubcategoryView(row: Pair, selected: string): boolean {
  const view = resolveCategoryView(row);
  return view.subcategoryId === selected || view.subcategory === selected || row.subcategory === selected;
}
const history = { en: 'previous · review', es: 'anterior · por revisar', ja: '旧分類・要確認' };
export function viewCategoryLabel(view: CategoryView, locale: Locale): string {
  return CATEGORIES.some(item => item.key === view.groupId) ? getLocalizedCategoryName(view.category, locale) : view.category;
}
export function viewSubcategoryLabel(view: CategoryView, locale: Locale): string {
  const value = view.subcategory ?? '';
  return view.status === 'historical' ? `${getLocalizedSubcategoryName(value, locale)} · ${history[locale]}` : view.status === 'custom' ? value : getLocalizedSubcategoryName(value, locale);
}
export function categoryViewOptions(rows: readonly Pair[], selected: string) {
  const options = new Map<string, CategoryView>();
  for (const row of rows) if (matchesCategoryView(row, selected)) {
    const view = resolveCategoryView(row);
    if (view.subcategory != null && view.subcategory.trim()) options.set(view.subcategoryId, view);
  }
  return [...options.values()];
}
/** Only this row's original pair can be retained outside the current catalog. */
export function editorPair(row: Pair, groupId: string, subcategoryId: string, currentSelection = false): { category: string; subcategory: string } | null {
  const original = resolveCategoryView(row);
  const current = getTaxonomyPair(groupId, subcategoryId);
  if (groupId === original.groupId && subcategoryId === original.subcategoryId && (!currentSelection || !current)) return { category: row.category, subcategory: row.subcategory ?? '' };
  return current;
}
