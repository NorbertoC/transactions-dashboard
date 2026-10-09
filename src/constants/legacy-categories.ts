import type { CategoryInfo } from './categories';

/** Read-only v4 labels for existing rows and device drafts, never new classification choices. */
export const LEGACY_CATEGORIES: CategoryInfo[] = [
  { key: "basic_living", name: "Basic living", nameEs: "Vida básica", nameJa: "生活の基本", color: { hex: "#2563eb", bg: "bg-blue-500/15", text: "text-blue-600" }, subcategories: [
    { key: "rent", name: "Rent", nameEs: "Alquiler", nameJa: "家賃" },
    { key: "power_internet", name: "Power & internet", nameEs: "Luz e internet", nameJa: "電気・インターネット" },
    { key: "home_food", name: "Food for home", nameEs: "Comida para casa", nameJa: "家庭の食料品" },
    { key: "transport", name: "Transport", nameEs: "Transporte", nameJa: "交通" },
    { key: "phone", name: "Phone", nameEs: "Teléfono", nameJa: "携帯電話" },
  ] },
  { key: "personal_purchases", name: "Personal purchases", nameEs: "Compras personales", nameJa: "個人の買い物", color: { hex: "#8b5cf6", bg: "bg-violet-500/15", text: "text-violet-600" }, subcategories: [
    { key: "health", name: "Health", nameEs: "Salud", nameJa: "健康" },
    { key: "clothing_footwear", name: "Clothing & footwear", nameEs: "Ropa y calzado", nameJa: "衣服・靴" },
    { key: "personal_care", name: "Personal care", nameEs: "Cuidado personal", nameJa: "身だしなみ" },
    { key: "home_purchases", name: "Home", nameEs: "Hogar", nameJa: "住まい" },
  ] },
  { key: "work_learning", name: "Work & learning", nameEs: "Trabajo y formación", nameJa: "仕事・学習", color: { hex: "#06b6d4", bg: "bg-cyan-500/15", text: "text-cyan-600" }, subcategories: [
    { key: "software_tools", name: "Software & tools", nameEs: "Software y herramientas", nameJa: "ソフトウェア・ツール" },
    { key: "equipment_training", name: "Equipment & training", nameEs: "Equipamiento y formación", nameJa: "機器・学習" },
  ] },
  { key: "subscriptions", name: "Subscriptions", nameEs: "Suscripciones", nameJa: "サブスクリプション", color: { hex: "#f59e0b", bg: "bg-amber-500/15", text: "text-amber-600" }, subcategories: [
    { key: "subscription_work", name: "Work", nameEs: "Trabajo", nameJa: "仕事" },
    { key: "subscription_entertainment", name: "Entertainment", nameEs: "Entretenimiento", nameJa: "娯楽" },
    { key: "subscription_other", name: "Other subscriptions", nameEs: "Otras suscripciones", nameJa: "その他のサブスクリプション" },
  ] },
  { key: "meals_outings", name: "Meals & outings", nameEs: "Comidas y salidas", nameJa: "外食・食の楽しみ", color: { hex: "#f97316", bg: "bg-orange-500/15", text: "text-orange-600" }, subcategories: [
    { key: "restaurants", name: "Restaurants", nameEs: "Restaurantes", nameJa: "レストラン" },
    { key: "cafes", name: "Cafés", nameEs: "Cafés", nameJa: "カフェ" },
    { key: "delivery", name: "Delivery", nameEs: "Delivery", nameJa: "出前・デリバリー" },
    { key: "food_treats", name: "Treats & alfajores", nameEs: "Gustos y alfajores", nameJa: "お菓子・アルファホーレス" },
  ] },
  { key: "entertainment", name: "Entertainment", nameEs: "Entretenimiento", nameJa: "娯楽", color: { hex: "#d946ef", bg: "bg-fuchsia-500/15", text: "text-fuchsia-600" }, subcategories: [
    { key: "video_games", name: "Video games", nameEs: "Videojuegos", nameJa: "ビデオゲーム" },
    { key: "cinema", name: "Cinema", nameEs: "Cine", nameJa: "映画" },
    { key: "events", name: "Events", nameEs: "Eventos", nameJa: "イベント" },
    { key: "activities", name: "Activities", nameEs: "Actividades", nameJa: "アクティビティ" },
  ] },
  { key: "travel", name: "Travel", nameEs: "Viajes", nameJa: "旅行", color: { hex: "#10b981", bg: "bg-emerald-500/15", text: "text-emerald-600" }, subcategories: [
    { key: "tickets_transfers", name: "Tickets & transfers", nameEs: "Pasajes y traslados", nameJa: "切符・移動" },
    { key: "accommodation", name: "Accommodation", nameEs: "Alojamiento", nameJa: "宿泊" },
    { key: "travel_food_activities", name: "Meals & activities during travel", nameEs: "Comidas y actividades durante viaje", nameJa: "旅行中の食事・活動" },
  ] },
  { key: "others", name: "Others", nameEs: "Otros · Por revisar", nameJa: "その他・要確認", color: { hex: "#64748b", bg: "bg-slate-500/15", text: "text-slate-600" }, subcategories: [
    { key: "unclassified", name: "Miscellaneous", nameEs: "Sin clasificar", nameJa: "未分類" },
  ] },
];
