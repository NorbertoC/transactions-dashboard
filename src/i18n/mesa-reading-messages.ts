import type { Locale } from '@/i18n/types';

export const mesaReadingMessages = {
  en: {
    all: 'Monthly average of all recorded expenses in this selection. Savings allocations, income and transfers are separate.',
    basic: 'Recorded spending on the basics: rent, utilities, food for home, transport and phone.',
    personal: 'Recorded spending on health, clothing, personal care, home purchases, personal electronics and occasional mobility.',
    work: 'Recorded spending on tools, API usage, equipment and study.',
    subscriptions: 'Recorded personal subscriptions, content, memberships and other services.',
    subscriptionsGeneral: 'Recorded subscriptions for entertainment, storage and cloud, work tools and other services.',
    meals: 'Recorded spending on eating out, delivery and snacks.',
    entertainment: 'Recorded spending on games, cinema, events and recreational activities.',
    outings: 'Recorded spending on meals out, treats, activities and entertainment.',
    travel: 'Recorded travel spending: tickets, accommodation, meals and activities during trips.',
    others: 'Recorded expenses whose purpose needs review. The labels below show their current classification.',
    custom: 'Recorded expenses classified as {category}. The label does not establish a more specific purpose.',
    unclassified: 'Recorded expenses without a category label.',
    missingCategory: 'No category', missingSubcategory: 'No subcategory',
    scope: 'Selected period · {count} calendar months · {currency}',
    categoryRows: 'Monthly average by category', subcategoryRows: 'Monthly average by subcategory',
    total: 'Recorded period total', average: 'Monthly average',
    barScale: 'Bars compare monthly averages; the longest bar is the largest value.',
    denominator: 'Each average = its recorded total ÷ {count} selected months, including months without records.',
    coverage: 'Import coverage is unverified. A month without records does not establish zero spending.',
    partial: '* Includes a partial month, counted once without extrapolation.',
    rounding: 'Amounts are rounded to two decimals; displayed rows may differ from the total because of rounding.',
    empty: 'No recorded expenses in this selection.', noMonths: 'Select a period to calculate monthly averages.',
  },
  es: {
    all: 'Promedio mensual de todos los gastos registrados en esta selección. Las asignaciones a ahorro, los ingresos y las transferencias se muestran por separado.',
    basic: 'Gastos registrados de vida básica: alquiler, servicios, comida para casa, transporte y teléfono.',
    personal: 'Gastos registrados de salud, ropa, cuidado personal, hogar, electrónica personal y movilidad ocasional.',
    work: 'Gastos registrados de herramientas, consumo de API, equipamiento y estudio.',
    subscriptions: 'Suscripciones personales registradas: contenido, membresías y otros servicios.',
    subscriptionsGeneral: 'Suscripciones registradas de entretenimiento, almacenamiento y nube, herramientas de trabajo y otros servicios.',
    meals: 'Gastos registrados de salir a comer, delivery y snacks.',
    entertainment: 'Gastos registrados de juegos, cine, eventos y actividades recreativas.',
    outings: 'Gastos registrados de comidas afuera, gustos, actividades y entretenimiento.',
    travel: 'Gastos registrados de viajes: pasajes, alojamiento, comidas y actividades durante el viaje.',
    others: 'Gastos registrados cuyo propósito necesita revisión. El desglose muestra su clasificación actual.',
    custom: 'Gastos registrados clasificados como {category}. La etiqueta no confirma un propósito más específico.',
    unclassified: 'Gastos registrados sin una etiqueta de categoría.',
    missingCategory: 'Sin categoría', missingSubcategory: 'Sin subcategoría',
    scope: 'Período seleccionado · {count} meses calendario · {currency}',
    categoryRows: 'Promedio mensual por categoría', subcategoryRows: 'Promedio mensual por subcategoría',
    total: 'Total registrado del período', average: 'Promedio mensual',
    barScale: 'Las barras comparan promedios mensuales; la más larga representa el importe mayor.',
    denominator: 'Cada promedio = su total registrado ÷ {count} meses seleccionados, incluidos los meses sin registros.',
    coverage: 'La cobertura de importación no está verificada. Un mes sin registros no prueba gasto cero.',
    partial: '* Incluye un mes parcial, contado una vez sin extrapolar.',
    rounding: 'Los importes se redondean a dos decimales; las filas visibles pueden diferir del total por el redondeo.',
    empty: 'No hay gastos registrados en esta selección.', noMonths: 'Elegí un período para calcular los promedios mensuales.',
  },
  ja: {
    all: '選択範囲に記録された全支出の月平均です。貯蓄への配分、収入、振替は別に扱います。',
    basic: '家賃、光熱費、家庭の食料品、交通、電話など、生活の基本に分類された支出です。',
    personal: '健康、衣服、身だしなみ、住まい、個人用電子機器、臨時の移動に分類された支出です。',
    work: 'ツール、APIの使用量、機器、学習に分類された支出です。',
    subscriptions: '配信コンテンツ、会員費、その他サービスなど、個人の定期サービスの支出です。',
    subscriptionsGeneral: '娯楽、ストレージ・クラウド、仕事用ツール、その他サービスの定期利用に分類された支出です。',
    meals: '外食、デリバリー、スナックに分類された支出です。',
    entertainment: 'ゲーム、映画、イベント、レクリエーションに分類された支出です。',
    outings: '外食、楽しみの食品、活動、娯楽に分類された支出です。',
    travel: '旅行中の切符、宿泊、食事、活動に分類された支出です。',
    others: '用途の確認が必要な支出です。内訳には現在の分類を表示します。',
    custom: '「{category}」に分類された支出です。この名称だけでは、さらに具体的な用途は確認できません。',
    unclassified: 'カテゴリー名のない支出です。',
    missingCategory: 'カテゴリーなし', missingSubcategory: 'サブカテゴリーなし',
    scope: '選択期間 · 暦月 {count} か月 · {currency}',
    categoryRows: 'カテゴリー別の月平均', subcategoryRows: 'サブカテゴリー別の月平均',
    total: '期間の記録支出合計', average: '月平均',
    barScale: '棒の長さで月平均を比較します。最も長い棒が最大の金額です。',
    denominator: '各平均 = 記録合計 ÷ 選択した {count} か月。記録のない月も含みます。',
    coverage: '取り込み範囲は未確認です。記録のない月でも支出ゼロとは限りません。',
    partial: '* 月の一部を含みます。外挿せず、平均では1か月として数えます。',
    rounding: '金額は小数点以下2桁に丸めるため、内訳と合計に差が出る場合があります。',
    empty: '選択範囲に支出の記録はありません。', noMonths: '期間を選択すると月平均を計算できます。',
  },
} as const;

export type MesaReadingMessage = keyof typeof mesaReadingMessages.en;
export function mesaReadingText(locale: Locale, key: MesaReadingMessage, vars: Record<string, string | number> = {}) {
  return mesaReadingMessages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function mesaCategoryMeaning(category: string | null): MesaReadingMessage {
  if (category === null) return 'all';
  if (!category.trim()) return 'unclassified';
  const meanings: Record<string, MesaReadingMessage> = {
    'Basic living': 'basic', 'Personal needs & purchases': 'personal', 'Work & learning': 'work', 'Work & Study': 'work',
    'Personal subscriptions': 'subscriptions', 'Outings & entertainment': 'outings', Travel: 'travel', Others: 'others',
    'Personal purchases': 'personal', Subscriptions: 'subscriptionsGeneral', 'Meals & outings': 'meals', Entertainment: 'entertainment',
  };
  return meanings[category] ?? 'custom';
}
