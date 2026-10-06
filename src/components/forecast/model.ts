export type BucketKind = 'cash' | 'portfolio' | 'bitcoin';
export interface Bucket { id: string; name: string; kind: BucketKind; initial: number; rate: number }
export interface Scenario { income: number | null; essential: number | null; discretionary: number; tripCost: number; contributions: Record<string, number> }
export interface ForecastState { months: number; start: string; tripDate: string; minimum: number; reserveMonths: number; extraIncome: number; extraExpense: number; cash: number; bankRate: number; protectReserve: boolean; buckets: Bucket[]; A: Scenario; B: Scenario }
export interface ForecastRow { month: number; cash: number; balances: Record<string, number>; contributions: Record<string, number>; liquid: number; total: number; income: number; expense: number; growth: number; trip: number; gap: number }
export function defaults(start = new Date().toISOString().slice(0, 7)): ForecastState {
  const scenario: Scenario = { income: null, essential: null, discretionary: 0, tripCost: 0, contributions: { emergency: 1500, shares: 2000, bitcoin: 1000 } };
  return { months: 12, start, tripDate: start, minimum: 0, reserveMonths: 0, extraIncome: 0, extraExpense: 0, cash: 0, bankRate: 0, protectReserve: true,
    buckets: [{ id: 'emergency', name: '', kind: 'cash', initial: 0, rate: 0 }, { id: 'shares', name: 'Sharesies', kind: 'portfolio', initial: 0, rate: 0 }, { id: 'bitcoin', name: 'Bitcoin', kind: 'bitcoin', initial: 0, rate: 0 }], A: structuredClone(scenario), B: structuredClone(scenario) };
}
const serial = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1 : NaN;
export function calculate(state: ForecastState, key: 'A' | 'B') {
  const plan = state[key], errors: ('unknown' | 'invalid' | 'rate' | 'horizon' | 'over')[] = [];
  const income = plan.income === null ? null : plan.income + state.extraIncome;
  const expense = plan.essential === null ? null : plan.essential + plan.discretionary + state.extraExpense;
  const margin = income === null || expense === null ? null : income - expense;
  const assigned = state.buckets.reduce((sum, bucket) => sum + plan.contributions[bucket.id], 0);
  const floor = state.minimum * state.reserveMonths;
  const target = serial(state.tripDate) - serial(state.start) + 1;
  if (income === null || expense === null) errors.push('unknown');
  if (state.buckets.some(bucket => bucket.id === 'bitcoin' && bucket.kind !== 'bitcoin' || bucket.id === 'shares' && bucket.kind !== 'portfolio' || bucket.id === 'emergency' && bucket.kind !== 'cash')) errors.push('invalid');
  if ([state.minimum, state.reserveMonths, state.extraIncome, state.extraExpense, state.cash, plan.discretionary, plan.tripCost, ...state.buckets.flatMap(bucket => [bucket.initial, plan.contributions[bucket.id]]), ...[plan.income, plan.essential].filter(value => value !== null)].some(value => !Number.isFinite(value) || value! < 0) || !state.buckets.length || new Set(state.buckets.map(bucket => bucket.id)).size !== state.buckets.length) errors.push('invalid');
  if ([state.bankRate, ...state.buckets.map(bucket => bucket.rate)].some(rate => !Number.isFinite(rate) || rate <= -100 || rate > 100)) errors.push('rate');
  if (!Number.isInteger(state.months) || state.months < 1 || state.months > 600 || !Number.isInteger(target) || target < 1 || target > 600) errors.push('horizon');
  const over = margin === null ? null : Math.max(0, assigned - Math.max(0, margin));
  if (margin !== null && margin >= 0 && over! > 1e-7) errors.push('over');
  const rows: ForecastRow[] = [];
  let stopped: number | null = null, holds = 0, trip: { capacity: number; funded: boolean } | null = null;
  const initial = state.cash + state.buckets.reduce((sum, bucket) => sum + bucket.initial, 0);
  if (!errors.length) {
    let cash = state.cash, cumulativeIncome = 0, cumulativeExpense = 0, growth = 0, paidTrip = 0;
    const balances = Object.fromEntries(state.buckets.map(bucket => [bucket.id, bucket.initial]));
    const contributions = Object.fromEntries(state.buckets.map(bucket => [bucket.id, 0]));
    const liquidity = () => cash + state.buckets.filter(bucket => bucket.kind === 'cash').reduce((sum, bucket) => sum + balances[bucket.id], 0);
    const snapshot = (month: number, gap = 0) => rows.push({ month, cash, balances: { ...balances }, contributions: { ...contributions }, liquid: liquidity(), total: cash + Object.values(balances).reduce((sum, value) => sum + value, 0), income: cumulativeIncome, expense: cumulativeExpense, growth, trip: paidTrip, gap });
    const pay = (amount: number) => { const fromCash = Math.min(cash, amount); cash -= fromCash; amount -= fromCash; for (const bucket of state.buckets.filter(bucket => bucket.kind === 'cash')) { const used = Math.min(balances[bucket.id], amount); balances[bucket.id] -= used; amount -= used; } return amount; };
    snapshot(0);
    for (let month = 1; month <= Math.max(state.months, target); month++) {
      const cashGrowth = cash * state.bankRate / 1200; cash += cashGrowth; growth += cashGrowth;
      for (const bucket of state.buckets) { const earned = balances[bucket.id] * (bucket.kind === 'cash' ? bucket.rate / 1200 : Math.pow(1 + bucket.rate / 100, 1 / 12) - 1); balances[bucket.id] += earned; growth += earned; }
      cash += income!; cumulativeIncome += income!;
      const gap = pay(expense!); cumulativeExpense += expense! - gap;
      if (gap > 1e-7) stopped = month;
      if (!gap && margin! > 0) {
        const investment = state.buckets.filter(bucket => bucket.kind !== 'cash').reduce((sum, bucket) => sum + plan.contributions[bucket.id], 0);
        const capacity = Math.max(0, liquidity() - floor);
        const ratio = state.protectReserve && investment > capacity ? capacity / investment : 1;
        if (ratio < 1) holds++;
        for (const bucket of state.buckets) { const amount = plan.contributions[bucket.id] * (bucket.kind === 'cash' ? 1 : ratio); cash -= amount; balances[bucket.id] += amount; contributions[bucket.id] += amount; }
      }
      if (month === target && !gap) { const capacity = Math.max(0, liquidity() - floor); trip = { capacity, funded: plan.tripCost <= capacity + 1e-7 }; if (trip.funded) { pay(plan.tripCost); paidTrip += plan.tripCost; } }
      snapshot(month, gap); if (gap) break;
    }
  }
  const visible = rows.filter(row => row.month <= state.months), ending = visible.at(-1);
  return { valid: !errors.length, errors: [...new Set(errors)], income, expense, margin, assigned, floor, target, over, initial, rows, visible, ending, complete: ending?.month === state.months, stopped, holds, trip };
}
