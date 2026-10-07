import { NextRequest } from 'next/server';
import { requireSession, privateJson, requestError } from '@/lib/api-upstream';
import { readBoundedText, isIsoDate, validId } from '@/lib/api-validation';
import { resolveImportedClassification } from '@/utils/classification';
import { requireTaxonomyCapability, taxonomyHeaders } from '@/lib/taxonomy-guard';

interface Transaction {
  id?: number;
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory: string | null;
  category_source?: 'manual' | 'imported';
  statement_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
}

type IncomingTransaction = Record<string, unknown>;

function sanitizeJson(raw: string): string {
  // Trim, remove BOM, and strip trailing commas (including a final dangling comma)
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const withoutTrailingCommas = trimmed
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/,\s*$/g, '');
  return withoutTrailingCommas;
}

async function parseRequestBody(request: NextRequest): Promise<unknown> {
  const rawText = await readBoundedText(request, 5 * 1024 * 1024);
  const cleaned = sanitizeJson(rawText);
  if (cleaned.startsWith('<')) {
    throw new SyntaxError('Body appears to be HTML instead of JSON.');
  }
  return JSON.parse(cleaned);
}

function isTransactionEnvelope(value: unknown): value is { transactions: unknown[] } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Array.isArray((value as { transactions?: unknown }).transactions);
}

function computeStatementMetadata(dateIso: string | null): {
  statement_id: string | null;
  statement_start: string | null;
  statement_end: string | null;
} {
  if (!dateIso) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  const parsedDate = new Date(`${dateIso}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      statement_id: null,
      statement_start: null,
      statement_end: null
    };
  }

  let closingYear = parsedDate.getUTCFullYear();
  let closingMonth = parsedDate.getUTCMonth();

  if (parsedDate.getUTCDate() > 26) {
    closingMonth += 1;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear += 1;
    }
  }

  const statementEnd = new Date(Date.UTC(closingYear, closingMonth, 26));

  let openingMonth = closingMonth - 1;
  let openingYear = closingYear;

  if (openingMonth < 0) {
    openingMonth = 11;
    openingYear -= 1;
  }

  const statementStart = new Date(Date.UTC(openingYear, openingMonth, 27));
  const toIso = (value: Date) => value.toISOString().split('T')[0];

  return {
    statement_id: toIso(statementEnd),
    statement_start: toIso(statementStart),
    statement_end: toIso(statementEnd)
  };
}

function parseDateIso(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isIsoDate(trimmed) ? trimmed : null;
  }

  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const iso = `${year}-${month}-${day}`;
    return isIsoDate(iso) ? iso : null;
  }

  const dotMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const iso = `${fullYear}-${month}-${day}`;
    return isIsoDate(iso) ? iso : null;
  }

  return null;
}

function parseValue(value: unknown, amount: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const attempt = (raw: unknown) => {
    if (typeof raw !== 'string') return null;
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const amountValue = attempt(amount);
  if (amountValue !== null) {
    return amountValue;
  }

  const stringValue = attempt(value);
  if (stringValue !== null) {
    return stringValue;
  }

  return null;
}

function normalizeTransaction(entry: IncomingTransaction): Transaction | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (entry.record_type != null && entry.record_type !== 'expense') return null;
  // The expense API requires a nonempty category. Reject supplied null/blank
  // evidence before writes instead of silently replacing it with Others.
  if (Object.hasOwn(entry, 'category') && (typeof entry.category !== 'string' || !entry.category.trim() || entry.category.length > 200)) return null;
  if (Object.hasOwn(entry, 'subcategory') && entry.subcategory !== null && (typeof entry.subcategory !== 'string' || entry.subcategory.length > 200)) return null;
  if (entry.id !== undefined && !validId(String(entry.id))) return null;
  const place = typeof entry.place === 'string' ? entry.place.trim() : '';
  const dateIso =
    parseDateIso(typeof entry.date_iso === 'string' ? entry.date_iso : null) ||
    parseDateIso(typeof entry.date === 'string' ? entry.date : null);
  const value =
    parseValue(entry.value, entry.amount) ??
    (typeof entry.value === 'string' ? parseValue(entry.value, null) : null);

  if (!place || place.length > 500 || !dateIso || value === null || value < 0 || value > 1e9) {
    return null;
  }

  const categorySource = entry.category_source === 'manual' ? 'manual' : 'imported';
  const classification = resolveImportedClassification(entry.category, entry.subcategory, place, categorySource);
  const statementMetadata = computeStatementMetadata(dateIso);

  const currency =
    typeof entry.currency === 'string' && entry.currency.trim()
      ? entry.currency.trim()
      : 'NZ$';

  if (currency.length > 10 || (typeof entry.amount === 'string' && entry.amount.length > 100) || (typeof entry.date === 'string' && entry.date.length > 100)) return null;
  for (const key of ['statement_id','statement_start','statement_end']) if (entry[key] != null && entry[key] !== '' && !isIsoDate(entry[key])) return null;
  const amountDisplay =
    typeof entry.amount === 'string' && entry.amount.trim()
      ? entry.amount.trim()
      : `${currency}${value.toFixed(2)}`;

  const category = classification.category;
  const subcategory = entry.subcategory === null ? null : classification.subcategory;

  return {
    id: typeof entry.id === 'number' ? entry.id : undefined,
    place,
    amount: amountDisplay,
    date:
      typeof entry.date === 'string' && entry.date.trim()
        ? entry.date.trim()
        : dateIso,
    currency,
    value: Number(value.toFixed(2)),
    date_iso: dateIso,
    category,
    subcategory,
    category_source: categorySource,
    statement_id:
      typeof entry.statement_id === 'string' && entry.statement_id.trim()
        ? entry.statement_id
        : statementMetadata.statement_id,
    statement_start:
      typeof entry.statement_start === 'string' && entry.statement_start.trim()
        ? entry.statement_start
        : statementMetadata.statement_start,
    statement_end:
      typeof entry.statement_end === 'string' && entry.statement_end.trim()
        ? entry.statement_end
        : statementMetadata.statement_end
  };
}

async function persistTransactions(transactions: Transaction[]) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/transactions', '') || 'http://localhost:3000';
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const existingResponse = await fetch(process.env.NEXT_PUBLIC_API_URL || `${apiUrl}/transactions`, {
    cache: 'no-store',
    headers: {
      'X-API-Key': apiKey
    }
  });

  if (!existingResponse.ok) {
    throw new Error('Failed to fetch existing transactions');
  }

  const existingTransactions = await existingResponse.json();

  const existingMap = new Map<string, Transaction>(
    existingTransactions.map((tx: Transaction) => [
      `${tx.date_iso}|${tx.place.trim().toLowerCase()}`,
      tx
    ])
  );

  const updates: Array<{ id: number; data: Transaction }> = [];

  const newTransactions = transactions.filter((newTx) => {
    const key = `${newTx.date_iso}|${newTx.place.trim().toLowerCase()}`;
    const existing = existingMap.get(key);

    if (!existing) {
      return true;
    }

    const valueDiffers = Math.abs(existing.value - newTx.value) > 0.01;

    // A category difference alone is NOT an update trigger: the stored
    // category may be a manual edit, and re-uploading a statement must
    // never destroy it. Only a changed amount updates the row, and even
    // then the stored category/subcategory win over the re-parsed ones.
    if (valueDiffers && existing.id !== undefined) {
      updates.push({
        id: existing.id,
        data: {
          ...existing,
          ...newTx,
          category: existing.category,
          subcategory: existing.subcategory,
          category_source: existing.category_source,
        }
      });
    }

    return false;
  });

  const duplicateCount = transactions.length - newTransactions.length - updates.length;

  for (const update of updates) {
    const response = await fetch(`${apiUrl}/transactions/${update.id}`, {
      method: 'PATCH',
      cache: 'no-store',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...taxonomyHeaders
      },
      body: JSON.stringify(update.data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update existing transaction');
    }
  }

  if (newTransactions.length === 0) {
    return {
      success: true,
      transactions: [],
      count: 0,
      duplicateCount,
      updated: updates.length,
      saved: updates.length > 0,
      message:
        updates.length > 0
          ? 'Existing transactions updated.'
          : 'All transactions are duplicates. No new transactions to save.'
    };
  }

  const response = await fetch(`${apiUrl}/transactions/bulk`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...taxonomyHeaders
    },
    body: JSON.stringify(newTransactions)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to save transactions to database');
  }

  const saveResult = await response.json();

  return {
    success: true,
    transactions: newTransactions,
    count: newTransactions.length,
    duplicateCount,
    updated: updates.length,
    saved: true,
    saveResult
  };
}

export async function POST(request: NextRequest) {
  const { error } = await requireSession(request);
  if (error) return error;

  try {
    const body = await parseRequestBody(request);
    const payload = Array.isArray(body)
      ? body
      : isTransactionEnvelope(body)
        ? body.transactions
        : null;

    if (!payload || payload.length === 0 || payload.length > 5000) {
      return privateJson(
        { error: 'No transactions provided in request body' },
        { status: 400 }
      );
    }

    const normalized = payload
      .map((entry) => normalizeTransaction(entry as IncomingTransaction))
      .filter((entry): entry is Transaction => Boolean(entry));

    if (normalized.length !== payload.length) {
      return privateJson(
        { error: 'No valid transactions found in payload' },
        { status: 400 }
      );
    }

    const unavailable = await requireTaxonomyCapability(); if (unavailable) return unavailable;
    const result = await persistTransactions(normalized);
    return privateJson(result);
  } catch (error) {
    return requestError(error);
  }
}
