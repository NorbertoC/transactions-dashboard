export interface Transaction {
  id: number;
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory?: string;
  statement_id?: string | null;
  statement_start?: string | null;
  statement_end?: string | null;
}

export interface CategoryData {
  category: string;
  value: number;
  count: number;
  percentage: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  count: number;
  percentage: number;
  color?: string;
  [key: string]: string | number;
}
