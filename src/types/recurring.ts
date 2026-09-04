export type RecurringKind = 'income' | 'expense';
export type RecurringCadence = 'weekly' | 'fortnightly' | 'monthly';

export interface RecurringRule {
  id: number;
  kind: RecurringKind;
  label: string;
  amount: number;
  cadence: RecurringCadence;
  start_date: string;
  end_date: string | null;
  category: string | null;
  subcategory: string | null;
  enabled: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface RecurringRuleInput {
  kind: RecurringKind;
  label: string;
  amount: number;
  cadence: RecurringCadence;
  start_date: string;
  end_date?: string | null;
  category?: string | null;
  subcategory?: string | null;
  enabled?: boolean;
}

export interface PeriodTopExpense {
  id?: number;
  place: string;
  value: number;
  date_iso?: string;
  category?: string;
  subcategory?: string | null;
}

export interface PeriodSummary {
  statement_id: string;
  statement_start: string;
  statement_end: string;
  fixed_total: number;
  variable_total: number;
  income_total: number;
  top_expenses: PeriodTopExpense[];
  insights: string[];
  computed_at?: string;
  projection?: {
    income_total: number;
    expense_total: number;
  };
}
