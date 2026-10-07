export interface PlanState {
  item: string; price: number | null; income: number | null; mode: 'net' | 'gross';
  tax: number | null; expense: number | null; savings: number | null; invest: number | null; rate: number | null;
}
export type PlanStatus = 'met' | 'reached' | 'unreachable' | 'beyond';
export interface PlanRow { month: number; cash: number; investment: number; paid: number; gain: number }
export interface PlanPath { months: number | null; status: PlanStatus; ending?: PlanRow }
export function planDefaults(): PlanState {
  return { item: 'house', price: 300000, income: null, mode: 'net', tax: 0, expense: null, savings: 0, invest: 2000, rate: 10 };
}
export function calculatePlan(s: PlanState) {
  const base = { valid: false, error: 'amounts' as 'amounts' | 'rate', budgetError: null as 'amounts' | 'tax' | 'mode' | null, net: null as number | null,
    tax: null as number | null, surplus: null as number | null, monthlyRate: 0, excess: 0, rows: [] as PlanRow[],
    cash: { months: null, status: 'unreachable' } as PlanPath, mixed: { months: null, status: 'unreachable' } as PlanPath };
  const amountKeys = ['price', 'savings', 'invest'] as const;
  if (amountKeys.some(key => s[key] === null || !Number.isFinite(s[key]) || s[key]! < 0 || s[key]! > Number.MAX_SAFE_INTEGER)) return base;
  if (s.rate === null || !Number.isFinite(s.rate) || s.rate <= -100 || s.rate > 1000) return { ...base, error: 'rate' as const };
  const price = s.price!, savings = s.savings!, invest = s.invest!;
  const budgetError: typeof base.budgetError = !['net', 'gross'].includes(s.mode) ? 'mode' :
    s.mode === 'gross' && (s.tax === null || !Number.isFinite(s.tax) || s.tax < 0 || s.tax > 100) ? 'tax' :
    [s.income, s.expense].some(value => value === null || !Number.isFinite(value) || value! < 0 || value! > Number.MAX_SAFE_INTEGER) ? 'amounts' : null;
  const tax = budgetError ? null : s.mode === 'gross' ? s.income! * s.tax! / 100 : 0;
  const net = tax === null ? null : s.income! - tax, surplus = net === null ? null : net - s.expense!;
  const monthlyRate = Math.pow(1 + s.rate / 100, 1 / 12) - 1, remaining = Math.max(0, price - savings);
  const cashMonths = remaining === 0 ? 0 : invest > 0 ? Math.ceil((remaining - 1e-9) / invest) : null;
  const excess = surplus === null ? 0 : Math.max(0, invest - Math.max(0, surplus));
  const c = { ...base, valid: true, budgetError, tax, net, surplus, monthlyRate, excess,
    cash: { months: cashMonths, status: remaining === 0 ? 'met' : cashMonths === null ? 'unreachable' : cashMonths > 1200 ? 'beyond' : 'reached' } as PlanPath,
    mixed: { months: null, status: 'unreachable' } as PlanPath };
  let investment = savings;
  c.rows.push({ month: 0, cash: savings, investment, paid: savings, gain: 0 });
  if (remaining === 0) {
    c.cash.ending = c.rows[0];
    c.mixed = { months: 0, status: 'met', ending: c.rows[0] };
  }
  const impossible = monthlyRate < 0 ? price >= invest / -monthlyRate : monthlyRate === 0 ? invest === 0 : savings === 0 && invest === 0;
  for (let month = 1; month <= 1200; month++) {
    investment = investment * (1 + monthlyRate) + invest;
    const paid = savings + invest * month;
    const row = { month, cash: paid, investment, paid, gain: investment - paid };
    c.rows.push(row);
    if (c.cash.months === month && c.cash.status === 'reached') c.cash.ending = row;
    if (c.mixed.months === null && !impossible && investment >= price - 1e-7) {
      c.mixed = { months: month, status: 'reached', ending: row };
    }
  }
  if (c.mixed.months === null) c.mixed.status = impossible ? 'unreachable' : 'beyond';
  return c;
}
