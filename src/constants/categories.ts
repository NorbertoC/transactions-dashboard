/** Approved v5 catalog. Existing mixed/custom pairs stay literal until reviewed. */
import { LEGACY_CATEGORIES } from './legacy-categories';
export interface CategoryColorConfig { hex: string; bg: string; text: string; }
export interface SubcategoryInfo { key: string; name: string; nameJa: string; nameEs: string; }
export interface CategoryInfo { key: string; name: string; nameJa: string; nameEs: string; color: CategoryColorConfig; subcategories: SubcategoryInfo[]; }
export const PURPOSE_TAXONOMY_VERSION = 'purpose-v5';
export const PURPOSE_TAXONOMY_HEADER = 'X-Finance-Taxonomy';
export const DEFAULT_CATEGORY = 'Others';
export const DEFAULT_SUBCATEGORY = 'Miscellaneous';
export const CATEGORIES: CategoryInfo[] = [
  { key: "basic_living", name: "Basic living", nameEs: "Vida básica", nameJa: "生活の基本", color: { hex: "#2563eb", bg: "bg-blue-500/15", text: "text-blue-600" }, subcategories: [
    { key: "rent", name: "Rent", nameEs: "Alquiler", nameJa: "家賃" },
    { key: "power_internet", name: "Power & internet", nameEs: "Luz e internet", nameJa: "電気・インターネット" },
    { key: "home_food", name: "Food for home", nameEs: "Comida para casa", nameJa: "家庭の食料品" },
    { key: "phone", name: "Phone", nameEs: "Teléfono", nameJa: "携帯電話" },
    { key: "fuel", name: "Fuel", nameEs: "Combustible", nameJa: "燃料" },
    { key: "public_transport", name: "Public transport", nameEs: "Transporte público", nameJa: "公共交通" },
  ] },
  { key: "personal_purchases", name: "Personal purchases", nameEs: "Compras personales", nameJa: "個人の買い物", color: { hex: "#8b5cf6", bg: "bg-violet-500/15", text: "text-violet-600" }, subcategories: [
    { key: "health", name: "Health", nameEs: "Salud", nameJa: "健康" },
    { key: "clothing_footwear", name: "Clothing & footwear", nameEs: "Ropa y calzado", nameJa: "衣服・靴" },
    { key: "personal_care", name: "Personal care", nameEs: "Cuidado personal", nameJa: "身だしなみ" },
    { key: "home_purchases", name: "Home", nameEs: "Hogar", nameJa: "住まい" },
    { key: "personal_electronics", name: "Personal electronics", nameEs: "Electrónica personal", nameJa: "個人用電子機器" },
    { key: "occasional_mobility", name: "Occasional mobility", nameEs: "Movilidad ocasional", nameJa: "臨時の移動" },
  ] },
  { key: "work_learning", name: "Work & Study", nameEs: "Trabajo y estudio", nameJa: "仕事・学習", color: { hex: "#06b6d4", bg: "bg-cyan-500/15", text: "text-cyan-600" }, subcategories: [
    { key: "one_off_tools", name: "One-off tools & licences", nameEs: "Herramientas y licencias puntuales", nameJa: "買い切りのツール・ライセンス" },
    { key: "api_usage", name: "API usage", nameEs: "Consumo de API", nameJa: "APIの使用量" },
    { key: "work_equipment", name: "Equipment", nameEs: "Equipamiento", nameJa: "機器" },
    { key: "courses_study", name: "Courses & study", nameEs: "Cursos y formación", nameJa: "講座・学習" },
  ] },
  { key: "subscriptions", name: "Subscriptions", nameEs: "Suscripciones", nameJa: "サブスクリプション", color: { hex: "#f59e0b", bg: "bg-amber-500/15", text: "text-amber-600" }, subcategories: [
    { key: "subscription_entertainment", name: "Entertainment", nameEs: "Entretenimiento", nameJa: "娯楽" },
    { key: "subscription_cloud", name: "Storage & cloud", nameEs: "Almacenamiento y nube", nameJa: "ストレージ・クラウド" },
    { key: "subscription_work", name: "Work tools", nameEs: "Herramientas de trabajo", nameJa: "仕事用ツール" },
    { key: "subscription_other", name: "Other subscriptions", nameEs: "Otras suscripciones", nameJa: "その他のサブスクリプション" },
  ] },
  { key: "meals_outings", name: "Meals & outings", nameEs: "Comidas y salidas", nameJa: "外食・食の楽しみ", color: { hex: "#f97316", bg: "bg-orange-500/15", text: "text-orange-600" }, subcategories: [
    { key: "eating_out", name: "Eating out", nameEs: "Salir a comer", nameJa: "外食" },
    { key: "delivery", name: "Delivery", nameEs: "Delivery", nameJa: "出前・デリバリー" },
    { key: "snacks", name: "Snacks", nameEs: "Snacks", nameJa: "スナック" },
  ] },
  { key: "entertainment", name: "Entertainment", nameEs: "Entretenimiento", nameJa: "娯楽", color: { hex: "#d946ef", bg: "bg-fuchsia-500/15", text: "text-fuchsia-600" }, subcategories: [
    { key: "video_games", name: "Video games", nameEs: "Videojuegos", nameJa: "ビデオゲーム" },
    { key: "cinema", name: "Cinema", nameEs: "Cine", nameJa: "映画" },
    { key: "events", name: "Events", nameEs: "Eventos", nameJa: "イベント" },
    { key: "activities", name: "Activities", nameEs: "Actividades", nameJa: "アクティビティ" },
  ] },
  { key: "travel", name: "Travel", nameEs: "Viajes", nameJa: "旅行", color: { hex: "#10b981", bg: "bg-emerald-500/15", text: "text-emerald-600" }, subcategories: [
    { key: "travel_tickets", name: "Tickets", nameEs: "Pasajes", nameJa: "交通チケット" },
    { key: "travel_transfers", name: "Transfers during travel", nameEs: "Traslados", nameJa: "旅行中の移動" },
    { key: "accommodation", name: "Accommodation", nameEs: "Alojamiento", nameJa: "宿泊" },
    { key: "travel_food_activities", name: "Meals & activities during travel", nameEs: "Comidas y actividades durante viaje", nameJa: "旅行中の食事・活動" },
    { key: "travel_documents", name: "Documents & paperwork", nameEs: "Trámites y documentos", nameJa: "渡航書類・手続き" },
  ] },
  { key: "others", name: "Others", nameEs: "Otros · Por revisar", nameJa: "その他・要確認", color: { hex: "#64748b", bg: "bg-slate-500/15", text: "text-slate-600" }, subcategories: [
    { key: "unclassified", name: "Miscellaneous", nameEs: "Sin clasificar", nameJa: "未分類" },
  ] },
];
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = { Others: "Needs review", Savings: "Savings" };
const LEGACY_PAIR_MAP: Record<string, { category: string; subcategory: string }> = {
  "personal needs & purchases|health": { category: "Personal purchases", subcategory: "Health" },
  "personal needs & purchases|clothing & footwear": { category: "Personal purchases", subcategory: "Clothing & footwear" },
  "personal needs & purchases|personal care": { category: "Personal purchases", subcategory: "Personal care" },
  "personal needs & purchases|purchases for home": { category: "Personal purchases", subcategory: "Home" },
  "personal purchases|purchases for home": { category: "Personal purchases", subcategory: "Home" },
  "housing|rent": {"category": "Basic living", "subcategory": "Rent"},
  "housing|utilities": {"category": "Basic living", "subcategory": "Power & internet"},
  "housing|household items": {"category": "Personal purchases", "subcategory": "Home"},
  "home & daily living|rent": {"category": "Basic living", "subcategory": "Rent"},
  "home & daily living|utilities": {"category": "Basic living", "subcategory": "Power & internet"},
  "home & daily living|household items": {"category": "Personal purchases", "subcategory": "Home"},
  "housing|internet & phone": {"category": "Others", "subcategory": "Miscellaneous"},
  "home & daily living|internet & phone": {"category": "Others", "subcategory": "Miscellaneous"},
  "groceries|food": {"category": "Basic living", "subcategory": "Food for home"},
  "groceries|supermarkets": {"category": "Basic living", "subcategory": "Food for home"},
  "groceries|household items": {"category": "Personal purchases", "subcategory": "Home"},
  "groceries|medicine & supplements": {"category": "Personal purchases", "subcategory": "Health"},
  "groceries|personal care": {"category": "Personal purchases", "subcategory": "Personal care"},
  "home & daily living|food": {"category": "Basic living", "subcategory": "Food for home"},
  "home & daily living|supermarkets": {"category": "Basic living", "subcategory": "Food for home"},
  "home & daily living|medicine & supplements": {"category": "Personal purchases", "subcategory": "Health"},
  "home & daily living|personal care": {"category": "Personal purchases", "subcategory": "Personal care"},
  "personal needs|health": {"category": "Personal purchases", "subcategory": "Health"},
  "personal needs|clothing & footwear": {"category": "Personal purchases", "subcategory": "Clothing & footwear"},
  "personal needs|personal care": {"category": "Personal purchases", "subcategory": "Personal care"},
  "personal needs|personal transport": {"category": "Basic living", "subcategory": "Transport"},
  "work & learning|education & training": {"category": "Work & learning", "subcategory": "Equipment & training"},
  "work & learning|work equipment": {"category": "Work & learning", "subcategory": "Equipment & training"},
  "subscriptions & services|mobile phone": {"category": "Basic living", "subcategory": "Phone"},
  "shopping|retail & home": {"category": "Personal purchases", "subcategory": "Home"},
  "shopping|clothing": {"category": "Personal purchases", "subcategory": "Clothing & footwear"},
  "fun & social|subscriptions": {"category": "Others", "subcategory": "Miscellaneous"},
  "fun & social|travel & entertainment": {"category": "Others", "subcategory": "Miscellaneous"},
  "fun & social|social & gifts": {"category": "Others", "subcategory": "Miscellaneous"},
  "personal spending|personal allowance": {"category": "Others", "subcategory": "Miscellaneous"},
  "personal spending|hobbies & shopping": {"category": "Others", "subcategory": "Miscellaneous"},
  "others|purpose unconfirmed": {"category": "Others", "subcategory": "Miscellaneous"},
  "others|personal allocation": {"category": "Others", "subcategory": "Miscellaneous"},
};

const CANONICAL_PAIRS = new Map(CATEGORIES.flatMap(group => group.subcategories.map(sub => [`${group.name.toLowerCase()}|${sub.name.toLowerCase()}`, { category: group.name, subcategory: sub.name }] as const)));
export function normalizeCategoryPair(category?: string | null, subcategory?: string | null, categorySource?: string | null): { category: string; subcategory: string } {
  const supplied = { category: category ?? '', subcategory: subcategory ?? '' };
  if (categorySource === 'manual' || category === '' || subcategory === '') return supplied;
  const cat = (category ?? '').trim();
  const sub = (subcategory ?? '').trim();
  if (!cat) return { category: DEFAULT_CATEGORY, subcategory: subcategory === '' ? '' : sub || DEFAULT_SUBCATEGORY };
  const key = `${cat.toLowerCase()}|${sub.toLowerCase()}` as const;
  const canonical = CANONICAL_PAIRS.get(key);
  if (canonical) return canonical;
  // A supplied blank or custom purpose is evidence too: no wildcard remapping.
  const mapped = LEGACY_PAIR_MAP[key];
  if (mapped) return mapped;
  return supplied;
}
export function getCategoryByKey(key: string): CategoryInfo | undefined { return CATEGORIES.find(group => group.key === key); }
export function getTaxonomyPair(groupKey: string, subcategoryKey: string): { category: string; subcategory: string } | null {
  const group = getCategoryByKey(groupKey);
  const sub = group?.subcategories.find(item => item.key === subcategoryKey);
  return group && sub ? { category: group.name, subcategory: sub.name } : null;
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
  [...LEGACY_CATEGORIES, ...CATEGORIES].map(cat => [cat.name, cat.color])
);

const LEGACY_CATEGORY_JA = { 'Personal subscriptions': '個人の定期サービス', 'Outings & entertainment': '外出・娯楽', 'Home & daily living': '住まい・日々の生活', 'Personal needs': '身の回りの必要品', Entertainment: '娯楽', Savings: '貯蓄', Housing: '住まい', Groceries: '食費・日用品・健康', Transport: '交通', 'Fun & Social': '娯楽・交際', 'Personal spending': '個人費（お小遣い）' };
const LEGACY_CATEGORY_ES = { 'Personal subscriptions': 'Suscripciones personales', 'Outings & entertainment': 'Salidas y entretenimiento', 'Home & daily living': 'Hogar y vida diaria', 'Personal needs': 'Necesidades personales', Entertainment: 'Entretenimiento', Savings: 'Ahorro', Housing: 'Hogar', Groceries: 'Necesidades diarias', Transport: 'Transporte', 'Fun & Social': 'Ocio y vida social', 'Personal spending': 'Gastos personales' };

export const CATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  [...LEGACY_CATEGORIES, ...CATEGORIES].map(cat => [cat.name, cat.nameJa])
);

export const SUBCATEGORY_JA_NAMES: Record<string, string> = Object.fromEntries(
  [...LEGACY_CATEGORIES, ...CATEGORIES].flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameJa]))
);

export const CATEGORY_ES_NAMES: Record<string, string> = Object.fromEntries(
  [...LEGACY_CATEGORIES, ...CATEGORIES].map(cat => [cat.name, cat.nameEs])
);

export const SUBCATEGORY_ES_NAMES: Record<string, string> = Object.fromEntries(
  [...LEGACY_CATEGORIES, ...CATEGORIES].flatMap(cat => cat.subcategories.map(sub => [sub.name, sub.nameEs]))
);

export function getCategoryJapaneseName(category: string): string | undefined {
  return CATEGORY_JA_NAMES[category] || LEGACY_CATEGORY_JA[category as keyof typeof LEGACY_CATEGORY_JA];
}

const LEGACY_SUBCATEGORY_JA: Record<string, string> = { 'Streaming & content': '配信・コンテンツ', 'Memberships & other services': '会員費・その他サービス', 'Meals & treats': '食事・楽しみの食品', 'Activities & entertainment': '活動・娯楽', 'Medicine & Supplements': '薬・サプリ', 'Travel & Entertainment': '旅行・エンタメ', Subscriptions: 'サブスク', 'Personal Allowance': 'おこづかい', 'Hobbies & Shopping': '趣味・買い物', Fuel: 'ガソリン', 'Public transport': '公共交通', 'Taxi & Rideshare': 'タクシー・配車', 'Parking & Tolls': '駐車場・有料道路', 'Car maintenance': '車の整備', Insurance: '保険' };
const LEGACY_SUBCATEGORY_ES: Record<string, string> = { 'Streaming & content': 'Streaming y contenido', 'Memberships & other services': 'Membresías y otros servicios', 'Meals & treats': 'Comidas y gustos', 'Activities & entertainment': 'Actividades y entretenimiento', 'Medicine & Supplements': 'Medicinas y suplementos', 'Travel & Entertainment': 'Viajes y entretenimiento', Subscriptions: 'Suscripciones', 'Personal Allowance': 'Mesada personal', 'Hobbies & Shopping': 'Hobbies y compras', Fuel: 'Combustible', 'Public transport': 'Transporte público', 'Taxi & Rideshare': 'Taxi y rideshare', 'Parking & Tolls': 'Estacionamiento y peajes', 'Car maintenance': 'Mantenimiento del auto', Insurance: 'Seguro' };

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

export function getSubcategoryPurposeHint(subcategory: string, locale: 'en' | 'es' | 'ja'): string | null {
  const hints: Record<string, Record<'en' | 'es' | 'ja', string>> = {
    'Occasional mobility': { en: 'Taxis, Uber, Lime, parking and tolls.', es: 'Taxis, Uber, Lime, parking y peajes.', ja: 'タクシー、Uber、Lime、駐車場、有料道路。' },
    'Transfers during travel': { en: 'Only transfers linked to an identified trip.', es: 'Sólo traslados vinculados a un viaje identificado.', ja: '確認できる旅行に関連した移動のみ。' },
  };
  return hints[subcategory]?.[locale] ?? null;
}
