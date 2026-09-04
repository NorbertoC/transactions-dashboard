'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  enabled: true
};

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
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t('recurring.add')}
            </button>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
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
                    min="0"
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
            <p className="text-muted">{t('recurring.empty')}</p>
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
