export interface PlanState {
  item: string; price: number | null; income: number | null; mode: 'net' | 'gross';
  tax: number | null; expense: number | null; savings: number | null; invest: number | null; rate: number | null;
}
export type PlanStatus = 'met' | 'reached' | 'unreachable' | 'overallocated' | 'beyond';
export interface PlanRow { month: number; cash: number; reserve: number; investment: number; mixed: number; paid: number; gain: number }
export interface PlanPath { months: number | null; status: PlanStatus; ending?: PlanRow }
export function planDefaults(): PlanState {
  return { item: 'house', price: 300000, income: 10000, mode: 'net', tax: 0, expense: null, savings: 0, invest: 2000, rate: 10 };
}
export function calculatePlan(s: PlanState) {
  const base = { valid: false, error: 'amounts' as 'amounts' | 'tax' | 'rate' | 'mode', net: null as number | null,
    tax: null as number | null, surplus: null as number | null, monthlyRate: 0, excess: 0, cashRemainder: null as number | null,
    cash: { months: null, status: 'unreachable' } as PlanPath, mixed: { months: null, status: 'unreachable' } as PlanPath };
  const amountKeys = ['price', 'income', 'expense', 'savings', 'invest'] as const;
  if (amountKeys.some(key => s[key] === null || !Number.isFinite(s[key]) || s[key]! < 0 || s[key]! > Number.MAX_SAFE_INTEGER)) return base;
  if (!['net', 'gross'].includes(s.mode)) return { ...base, error: 'mode' as const };
  // Net income must never have a second tax deduction. A hidden gross-tax input is irrelevant.
  if (s.mode === 'gross' && (s.tax === null || !Number.isFinite(s.tax) || s.tax < 0 || s.tax > 100)) return { ...base, error: 'tax' as const };
  if (s.rate === null || !Number.isFinite(s.rate) || s.rate <= -100 || s.rate > 1000) return { ...base, error: 'rate' as const };
  const income = s.income!, expense = s.expense!, price = s.price!, savings = s.savings!, invest = s.invest!;
  const tax = s.mode === 'gross' ? income * s.tax! / 100 : 0, net = income - tax, surplus = net - expense;
  const monthlyRate = Math.pow(1 + s.rate / 100, 1 / 12) - 1, remaining = Math.max(0, price - savings);
  const cashMonths = remaining === 0 ? 0 : surplus > 0 ? Math.ceil((remaining - 1e-9) / surplus) : null;
  const excess = Math.max(0, invest - Math.max(0, surplus)), cashRemainder = surplus - invest;
  const c = { ...base, valid: true, tax, net, surplus, monthlyRate, excess, cashRemainder,
    cash: { months: cashMonths, status: remaining === 0 ? 'met' : cashMonths === null ? 'unreachable' : cashMonths > 1200 ? 'beyond' : 'reached' } as PlanPath,
    mixed: { months: null, status: 'unreachable' } as PlanPath };
  if (remaining === 0) { c.mixed = { months: 0, status: 'met' }; return c; }
  if (excess > 1e-7) { c.mixed.status = 'overallocated'; return c; }
  if (surplus <= 0 || invest === 0) return c;
  // Only the chosen contribution funds this path. Initial savings remain
  // fixed cash; the unused surplus never accumulates toward the goal.
  const reserve = savings;
  let investment = 0;
  const impossible = monthlyRate < 0 && remaining >= invest / -monthlyRate;
  for (let month = 1; month <= 1200; month++) {
    investment = investment * (1 + monthlyRate) + invest;
    if (!impossible && reserve + investment >= price - 1e-7) {
      c.mixed = { months: month, status: 'reached', ending: { month, cash: reserve, reserve, investment, mixed: reserve + investment, paid: invest * month, gain: investment - invest * month } };
      return c;
    }
  }
  c.mixed.status = impossible ? 'unreachable' : 'beyond';
  return c;
}
