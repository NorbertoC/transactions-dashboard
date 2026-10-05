import { describe, expect, it } from 'vitest';
import { monthEvidence } from '@/utils/month-evidence';
import type { Transaction } from '@/types/transaction';
const row = (id: number, value: number, category = 'Groceries', subcategory = 'Food'): Transaction => ({ id, value, place: 'Synthetic long merchant '+id, category, subcategory, currency: 'NZ$', date: '', amount: String(value), date_iso: '2026-09-02' });
const calculate = (rows: Transaction[]) => monthEvidence(rows, '2026-08-27', '2026-09-26', '2026-10-05');
describe('individual non-rent statement evidence', () => {
  it('selects top10 individual expenses, preserves tied records and excludes only Housing/Rent', () => {
    const rows = Array.from({ length: 12 }, (_, id) => row(id + 1, 100 + id));
    const result = calculate([...rows, row(99, 9000, 'Housing', 'Rent'), row(100, 700, 'Housing', 'Utilities'), { ...row(101, 8000), record_type: 'income', direction: 'inflow' }, { ...row(102, 9000), record_type: 'transfer', direction: 'outflow' }, row(103, 110)]);
    expect(result.top).toHaveLength(10); expect(result.top[0].id).toBe(100); expect(result.top.map(row => row.id)).not.toContain(99);
    expect(result.top.filter(row => row.value === 110)).toHaveLength(2); expect(result.rows).toHaveLength(14);
    expect(result.top.every((row, i, rows) => !i || rows[i-1].value >= row.value)).toBe(true);
    expect(result.topMerchant?.[1]).toBe(700);
  });
  it('does not imply verified completeness, income, mixed-currency totals or future extrapolation', () => {
    const data = calculate([row(1, 10), { ...row(2, 1000), currency: 'USD' }, { ...row(3, 1000), date_iso: '2026-07-01' }, row(4, -50)]);
    expect(data.total).toBe(10); expect(data.previousTotal).toBeNull(); expect(data.days).toBe(31); expect(data.activeDays).toBe(1);
    expect(monthEvidence([row(1, 10)], '2026-08-27', '2026-09-26', '2026-09-10').partial).toBe(true);
  });
  it('handles fewer than5 and no non-rent rows without invented data', () => {
    expect(calculate([row(1, 10), row(2, 20)]).top).toHaveLength(2);
    const empty = calculate([row(1, 1000, 'Housing', 'Rent')]); expect(empty.top).toEqual([]); expect(empty.topCategory).toBeUndefined(); expect(empty.average).toBe(0);
  });
});
