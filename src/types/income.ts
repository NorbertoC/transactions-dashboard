export interface IncomeSummary {
  start_date: string;
  end_date: string;
  totals_by_currency: Record<string, { cents: number; total: number; monthly_average: number }>;
  coverage: { start: string; end: string }[];
  covered_calendar_months: number;
  coverage_complete: boolean;
  basis: string;
}
