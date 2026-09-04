'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FileUp, Info, Pencil, Plus, Repeat2, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import AuthGuard from '@/components/AuthGuard';
import Header from '@/components/Header';
import {
  CATEGORIES,
  getLocalizedCategoryName,
  getLocalizedSubcategoryName,
  getSubcategoriesForCategory
} from '@/constants/categories';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  createRecurringRule,
  deleteRecurringRule,
  fetchRecurringRules,
  updateRecurringRule
} from '@/services/recurring';
import type {
  RecurringCadence,
  RecurringKind,
  RecurringRule,
  RecurringRuleInput
} from '@/types/recurring';
import { formatCurrency } from '@/utils/format';

const EMPTY_FORM: RecurringRuleInput = {
  kind: 'expense',
  label: '',
  amount: 0,
  cadence: 'monthly',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  category: 'Housing',
  subcategory: 'Rent',
  merchant_pattern: null,
  enabled: true
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeImportedRule(
  row: Record<string, unknown>,
  index: number
): RecurringRuleInput {
  const readString = (key: string) =>
    typeof row[key] === 'string' ? row[key].trim() : '';
  const label = readString('label');
  const kind = readString('kind');
  const cadence = readString('cadence');
  const startDate = readString('start_date').slice(0, 10);
  const endDate = readString('end_date').slice(0, 10) || null;
  const amount = Number(row.amount);
  const category = readString('category') || null;
  const subcategory = readString('subcategory') || null;
  const merchantPattern = readString('merchant_pattern') || null;

  if (!label || !['income', 'expense'].includes(kind)) {
    throw new Error(`Rule ${index + 1}: label and kind (income/expense) are required.`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Rule ${index + 1}: amount must be greater than zero.`);
  }
  if (!['weekly', 'fortnightly', 'monthly'].includes(cadence)) {
    throw new Error(`Rule ${index + 1}: cadence must be weekly, fortnightly or monthly.`);
  }
  if (!isIsoDate(startDate)) {
    throw new Error(`Rule ${index + 1}: start_date must use YYYY-MM-DD.`);
  }
  if (endDate && !isIsoDate(endDate)) {
    throw new Error(`Rule ${index + 1}: end_date must use YYYY-MM-DD.`);
  }
  if (endDate && endDate < startDate) {
    throw new Error(`Rule ${index + 1}: end_date cannot be before start_date.`);
  }

  const categoryDefinition = category
    ? CATEGORIES.find((candidate) => candidate.name === category)
    : undefined;
  if (category && !categoryDefinition) {
    throw new Error(`Rule ${index + 1}: unknown category "${category}".`);
  }
  if (subcategory && !categoryDefinition) {
    throw new Error(`Rule ${index + 1}: subcategory requires a category.`);
  }
  if (
    subcategory &&
    categoryDefinition &&
    !categoryDefinition.subcategories.some((candidate) => candidate.name === subcategory)
  ) {
    throw new Error(`Rule ${index + 1}: subcategory does not belong to ${category}.`);
  }

  const disabledValues = new Set(['false', '0', 'no', 'disabled']);
  let enabled = true;
  if (typeof row.enabled === 'boolean') {
    enabled = row.enabled;
  } else if (typeof row.enabled === 'number') {
    if (row.enabled !== 0 && row.enabled !== 1) {
      throw new Error(`Rule ${index + 1}: enabled must be true/false or 1/0.`);
    }
    enabled = row.enabled === 1;
  } else {
    enabled = !disabledValues.has(readString('enabled').toLowerCase());
  }

  return {
    label,
    kind: kind as RecurringKind,
    amount,
    cadence: cadence as RecurringCadence,
    start_date: startDate,
    end_date: endDate,
    category,
    subcategory,
    merchant_pattern: merchantPattern,
    enabled
  };
}

function parseImportedRules(fileName: string, contents: string): RecurringRuleInput[] {
  let rows: unknown[];
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed: unknown = JSON.parse(contents);
    rows = [];
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (isRecord(parsed) && Array.isArray(parsed.rules)) {
      rows = parsed.rules;
    }
  } else {
    const parsed = Papa.parse<Record<string, string>>(contents, {
      header: true,
      skipEmptyLines: true
    });
    if (parsed.errors[0]) throw new Error(parsed.errors[0].message);
    rows = parsed.data;
  }

  if (rows.length === 0 || !rows.every(isRecord)) {
    throw new Error('No valid recurring rules were found in this file.');
  }
  return rows.map(normalizeImportedRule);
}

function monthlyEquivalent(rule: RecurringRule): number {
  if (rule.cadence === 'weekly') return Number(rule.amount) * 52 / 12;
  if (rule.cadence === 'fortnightly') return Number(rule.amount) * 26 / 12;
  return Number(rule.amount);
}

function isEnabled(rule: RecurringRule): boolean {
  return rule.enabled === true || rule.enabled === 1;
}

function RecurringView() {
  const { t, locale } = useLocale();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RecurringRuleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingImport, setPendingImport] = useState<RecurringRuleInput[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecurringRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(form.category || 'Housing'),
    [form.category]
  );

  const monthlyTotals = useMemo(() => {
    let expenses = 0;
    let income = 0;
    let active = 0;

    rules.forEach((rule) => {
      if (!isEnabled(rule)) return;
      active += 1;
      if (rule.kind === 'income') income += monthlyEquivalent(rule);
      if (rule.kind === 'expense') expenses += monthlyEquivalent(rule);
    });

    return { expenses, income, active };
  }, [rules]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditingId(rule.id);
    setForm({
      kind: rule.kind,
      label: rule.label,
      amount: Number(rule.amount),
      cadence: rule.cadence,
      start_date: rule.start_date.slice(0, 10),
      end_date: rule.end_date ? rule.end_date.slice(0, 10) : null,
      category: rule.category,
      subcategory: rule.subcategory,
      merchant_pattern: rule.merchant_pattern,
      enabled: isEnabled(rule)
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: RecurringRuleInput = {
        ...form,
        label: form.label.trim(),
        amount: Number(form.amount),
        end_date: form.end_date || null
      };
      if (editingId === null) {
        await createRecurringRule(payload);
      } else {
        await updateRecurringRule(editingId, payload);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: RecurringRule) => {
    try {
      await updateRecurringRule(rule.id, { enabled: !isEnabled(rule) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (rule: RecurringRule) => {
    if (!window.confirm(`${t('recurring.delete')}: ${rule.label}?`)) return;
    try {
      await deleteRecurringRule(rule.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const imported = parseImportedRules(file.name, await file.text());
      setPendingImport(imported);
      setImportFileName(file.name);
    } catch (err) {
      setPendingImport([]);
      setImportFileName('');
      setError(err instanceof Error ? err.message : 'Could not read recurring rules');
    }
  };

  const handleImportConfirm = async () => {
    const importBatch = pendingImport;
    let importedCount = 0;
    let failureMessage: string | null = null;
    setImporting(true);
    setError(null);
    try {
      for (const rule of importBatch) {
        await createRecurringRule(rule);
        importedCount += 1;
      }
      setPendingImport([]);
      setImportFileName('');
    } catch (err) {
      setPendingImport(importBatch.slice(importedCount));
      failureMessage = err instanceof Error ? err.message : 'Import failed';
    } finally {
      if (importedCount > 0) {
        await load();
      }
      if (failureMessage) {
        setError(
          importedCount > 0
            ? t('recurring.importPartial', {
                imported: importedCount,
                remaining: importBatch.length - importedCount,
                error: failureMessage
              })
            : failureMessage
        );
      }
      setImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-5 pb-safe">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{t('recurring.title')}</h1>
              <p className="text-sm text-muted">{t('recurring.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 text-sm font-medium hover:bg-surface-2 focus-within:ring-2 focus-within:ring-primary">
                <FileUp className="h-4 w-4" aria-hidden="true" />
                {t('recurring.import')}
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="sr-only"
                  onChange={(event) => {
                    void handleImportFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t('recurring.add')}
              </button>
            </div>
          </div>

          <section className="flex gap-3 rounded-2xl border border-border-subtle bg-surface p-4 text-sm text-muted">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="leading-6">{t('recurring.help')}</p>
              <p className="mt-1 text-xs">{t('recurring.importHint')}</p>
            </div>
          </section>

          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {pendingImport.length > 0 && (
            <section role="status" className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {t('recurring.importReady', {
                  count: pendingImport.length,
                  file: importFileName
                })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingImport([]);
                    setImportFileName('');
                  }}
                  disabled={importing}
                  className="min-h-11 rounded-xl border border-border-subtle px-3 text-sm"
                >
                  {t('recurring.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  disabled={importing}
                  className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {t('recurring.importConfirm', { count: pendingImport.length })}
                </button>
              </div>
            </section>
          )}

          {rules.length > 0 && (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
                <dt className="text-sm text-muted">{t('recurring.monthlyExpenses')}</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums">
                  {formatCurrency(monthlyTotals.expenses)}
                </dd>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
                <dt className="text-sm text-muted">{t('recurring.monthlyIncome')}</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(monthlyTotals.income)}
                </dd>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
                <dt className="text-sm text-muted">{t('recurring.activeRules')}</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums">{monthlyTotals.active}</dd>
              </div>
            </dl>
          )}

          {formOpen && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.label')}</span>
                  <input
                    required
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.amount')}</span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: Number(e.target.value) }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.kind')}</span>
                  <select
                    value={form.kind}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, kind: e.target.value as RecurringKind }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  >
                    <option value="expense">{t('recurring.kind.expense')}</option>
                    <option value="income">{t('recurring.kind.income')}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.cadence')}</span>
                  <select
                    value={form.cadence}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cadence: e.target.value as RecurringCadence
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  >
                    <option value="weekly">{t('recurring.cadence.weekly')}</option>
                    <option value="fortnightly">{t('recurring.cadence.fortnightly')}</option>
                    <option value="monthly">{t('recurring.cadence.monthly')}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.start')}</span>
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.end')}</span>
                  <input
                    type="date"
                    min={form.start_date}
                    value={form.end_date ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        end_date: e.target.value || null
                      }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.category')}</span>
                  <select
                    value={form.category ?? ''}
                    onChange={(e) => {
                      const category = e.target.value;
                      const firstSub =
                        getSubcategoriesForCategory(category)[0]?.name ?? '';
                      setForm((f) => ({
                        ...f,
                        category,
                        subcategory: firstSub
                      }));
                    }}
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {getLocalizedCategoryName(cat.name, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span>{t('recurring.subcategory')}</span>
                  <select
                    value={form.subcategory ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, subcategory: e.target.value }))
                    }
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  >
                    {subcategoryOptions.map((sub) => (
                      <option key={sub.name} value={sub.name}>
                        {getLocalizedSubcategoryName(sub.name, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span>{t('recurring.merchantPattern')}</span>
                  <input
                    value={form.merchant_pattern ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        merchant_pattern: e.target.value || null
                      }))
                    }
                    placeholder={t('recurring.merchantPatternPlaceholder')}
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-background px-3"
                  />
                  <span className="block text-xs leading-5 text-muted">
                    {t('recurring.merchantPatternHelp')}
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t('recurring.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-11 rounded-xl border border-border-subtle px-4 text-sm"
                >
                  {t('recurring.cancel')}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-muted">{t('auth.loading')}</p>
          ) : rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center">
              <Repeat2 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <p className="mt-3 font-medium">{t('recurring.empty')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t('recurring.subtitle')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className={`rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm ${
                    isEnabled(rule) ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-lg font-semibold">{rule.label}</p>
                      <p className="text-sm text-muted">
                        {t(`recurring.kind.${rule.kind}` as 'recurring.kind.income')} ·{' '}
                        {t(`recurring.cadence.${rule.cadence}` as 'recurring.cadence.monthly')} ·{' '}
                        {formatCurrency(Number(rule.amount))}
                      </p>
                      <p className="text-xs text-muted">
                        {rule.start_date.slice(0, 10)} →{' '}
                        {rule.end_date
                          ? rule.end_date.slice(0, 10)
                          : t('recurring.openEnded')}
                        {!isEnabled(rule) ? ` · ${t('recurring.disabled')}` : ''}
                      </p>
                      {rule.category && (
                        <p className="text-xs font-medium text-primary">
                          {getLocalizedCategoryName(rule.category, locale)}
                          {rule.subcategory
                            ? ` · ${getLocalizedSubcategoryName(rule.subcategory, locale)}`
                            : ''}
                        </p>
                      )}
                      {rule.merchant_pattern && (
                        <p className="text-xs text-muted">
                          {t('recurring.merchantPatternValue', {
                            pattern: rule.merchant_pattern
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border-subtle px-3 text-sm"
                      >
                        <Pencil className="h-4 w-4" />
                        {t('recurring.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        className="min-h-11 rounded-xl border border-border-subtle px-3 text-sm"
                      >
                        {isEnabled(rule)
                          ? t('recurring.disable')
                          : t('recurring.enable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-red-500/40 px-3 text-sm text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('recurring.delete')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RecurringPage() {
  return (
    <AuthGuard>
      <RecurringView />
    </AuthGuard>
  );
}
