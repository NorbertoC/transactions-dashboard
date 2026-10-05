export interface Transaction {
  record_type?: 'expense' | 'income' | 'transfer';
  direction?: 'inflow' | 'outflow';
  owner?: string | null;
  income_source?: string | null;
  id: number;
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory?: string;
  category_source?: 'manual' | 'imported' | 'merchant' | 'approved-income' | null;
  statement_id?: string | null;
  statement_start?: string | null;
  statement_end?: string | null;
  status?: 'Completed' | 'Pending' | 'Overdue';
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
  [key: string]: string | number | undefined;
}
