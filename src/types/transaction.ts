export interface Transaction {
  id: number;
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
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
  [key: string]: string | number;
}