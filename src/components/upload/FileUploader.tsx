'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import {
  CATEGORIES,
  DEFAULT_SUBCATEGORY,
  getCategoryJapaneseName,
  getSubcategoriesForCategory
} from '@/constants/categories';
import { formatCurrency, formatDateShort } from '@/utils/format';
import {
  detectColumns,
  extractTransactions,
  parseSpreadsheetFile,
  type DetectedColumns,
  type ParsedTransactionRow
} from '@/utils/file-parsing';
import { useLocale } from '@/i18n/LocaleProvider';

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

interface UploadResult {
  count: number;
  duplicateCount: number;
  updated: number;
}

type Phase = 'idle' | 'parsing' | 'manual-columns' | 'preview' | 'uploading' | 'success';

const PREVIEW_ROW_LIMIT = 50;
const RAW_PREVIEW_ROWS = 5;
const ACCEPTED_FILE_TYPES = '.csv,.xlsx,.xls,text/csv';

interface OutgoingTransaction {
  place: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory: string;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function postTransactions(transactions: OutgoingTransaction[]): Promise<UploadResult> {
  const response = await fetch('/api/upload-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions })
  });

  const data: unknown = await response.json().catch(() => null);
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (!response.ok) {
    const message = typeof record.error === 'string' ? record.error : 'Upload failed.';
    throw new Error(message);
  }

  return {
    count: toNumber(record.count),
    duplicateCount: toNumber(record.duplicateCount),
    updated: toNumber(record.updated)
  };
}

function parseJsonPayload(raw: string): OutgoingTransaction[] {
  // Tolerate trailing commas (common in hand-edited payloads), like the
  // previous uploader did.
  const sanitized = raw
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/,\s*$/, '');
  const parsed: unknown = JSON.parse(sanitized);

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { transactions?: unknown[] } | null)?.transactions;

  if (!Array.isArray(list)) {
    throw new Error("JSON must be an array or an object with a 'transactions' array.");
  }
  return list as OutgoingTransaction[];
}

function columnLabel(rows: string[][], col: number): string {
  const sample = rows.map((row) => row[col] ?? '').find((cell) => cell !== '') ?? '';
  const truncated = sample.length > 24 ? `${sample.slice(0, 24)}…` : sample;
  return truncated === '' ? `Column ${col + 1}` : `Column ${col + 1} — "${truncated}"`;
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const { t } = useLocale();
  const inputId = useId();
  const [tab, setTab] = useState<'file' | 'json'>('file');

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [rows, setRows] = useState<ParsedTransactionRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [manualDate, setManualDate] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  const [jsonInput, setJsonInput] = useState('');

  const includedRows = rows.filter((row) => row.include);
  const creditCount = rows.filter((row) => row.isCredit).length;
  const visibleRows = showAll ? rows : rows.slice(0, PREVIEW_ROW_LIMIT);
  const totalColumns = rawRows.reduce((max, row) => Math.max(max, row.length), 0);

  const resetFileState = () => {
    setPhase('idle');
    setError(null);
    setFileName('');
    setRawRows([]);
    setRows([]);
    setSkippedCount(0);
    setShowAll(false);
    setResult(null);
    setManualDate('');
    setManualDescription('');
    setManualAmount('');
  };

  const applyExtraction = (allRows: string[][], columns: DetectedColumns) => {
    const extraction = extractTransactions(allRows, columns);
    if (extraction.rows.length === 0) {
      setError('No valid transactions found in those columns.');
      setPhase('manual-columns');
      return;
    }
    setRows(extraction.rows);
    setSkippedCount(extraction.skipped.length);
    setError(null);
    setPhase('preview');
  };

  const handleFile = async (file: File) => {
    resetFileState();
    setFileName(file.name);
    setPhase('parsing');

    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.length === 0) {
        setError('The file appears to be empty.');
        setPhase('idle');
        return;
      }
      setRawRows(parsed);

      const columns = detectColumns(parsed);
      if (!columns) {
        setError('Could not detect the date, description and amount columns automatically. Pick them below.');
        setPhase('manual-columns');
        return;
      }
      applyExtraction(parsed, columns);
    } catch {
      setError('Could not read this file. Make sure it is a valid CSV or Excel export.');
      setPhase('idle');
    }
  };

  const handleManualConfirm = () => {
    if (manualDate === '' || manualDescription === '' || manualAmount === '') {
      setError('Pick a column for date, description and amount.');
      return;
    }
    applyExtraction(rawRows, {
      headerRowIndex: -1,
      dateColumn: Number(manualDate),
      descriptionColumn: Number(manualDescription),
      amountColumn: Number(manualAmount)
    });
  };

  const updateRow = (id: string, patch: Partial<ParsedTransactionRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleCategoryChange = (id: string, category: string) => {
    const firstSubcategory = getSubcategoriesForCategory(category)[0]?.name ?? DEFAULT_SUBCATEGORY;
    updateRow(id, { category, subcategory: firstSubcategory });
  };

  const handleUpload = async () => {
    setPhase('uploading');
    setError(null);
    try {
      const uploadResult = await postTransactions(
        includedRows.map((row) => ({
          place: row.place,
          value: row.value,
          date_iso: row.dateIso,
          category: row.category,
          subcategory: row.subcategory
        }))
      );
      setResult(uploadResult);
      setPhase('success');
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setPhase('preview');
    }
  };

  const handleJsonUpload = async () => {
    setError(null);
    try {
      const transactions = parseJsonPayload(jsonInput);
      setPhase('uploading');
      const uploadResult = await postTransactions(transactions);
      setResult(uploadResult);
      setPhase('success');
      setJsonInput('');
      onUploadComplete?.();
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Invalid JSON payload.');
    }
  };

  const liveMessage = (() => {
    if (phase === 'parsing') return `Reading ${fileName}…`;
    if (phase === 'preview') return `${rows.length} transactions ready for review`;
    if (phase === 'uploading') return 'Uploading…';
    if (phase === 'success' && result) {
      return `Uploaded ${result.count} transactions, ${result.duplicateCount} duplicates skipped`;
    }
    return '';
  })();

  // Both render branches share the same root + first child, so this live
  // region stays mounted across phase changes and announcements fire.
  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {liveMessage}
    </p>
  );

  if (phase === 'success' && result) {
    return (
      <div className="flex flex-col gap-4">
        {liveRegion}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3 py-8 text-center"
        >
        <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
        <p className="text-base font-semibold text-foreground">
          Uploaded {result.count} transaction{result.count === 1 ? '' : 's'}
        </p>
        <p className="text-sm text-muted">
          {result.duplicateCount} duplicate{result.duplicateCount === 1 ? '' : 's'} skipped
          {result.updated > 0 ? ` · ${result.updated} updated` : ''}
        </p>
          <button
            type="button"
            onClick={resetFileState}
            className="mt-2 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Upload another file
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {liveRegion}
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Upload mode">
        <button
          type="button"
          onClick={() => setTab('file')}
          aria-pressed={tab === 'file'}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
            tab === 'file' ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          File
        </button>
        <button
          type="button"
          onClick={() => setTab('json')}
          aria-pressed={tab === 'json'}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
            tab === 'json' ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          }`}
        >
          Paste JSON
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {tab === 'json' && (
        <div className="flex flex-col gap-3">
          <label htmlFor={`${inputId}-json`} className="text-sm font-medium text-foreground">
            JSON payload
          </label>
          <textarea
            id={`${inputId}-json`}
            value={jsonInput}
            onChange={(event) => setJsonInput(event.target.value)}
            rows={8}
            placeholder={'[\n  { "place": "Example Store", "value": 25, "date_iso": "2026-03-12" }\n]'}
            className="w-full rounded-xl border border-border-subtle bg-surface-2 p-3 font-mono text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm"
          />
          <button
            type="button"
            onClick={handleJsonUpload}
            disabled={phase === 'uploading' || jsonInput.trim() === ''}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'uploading' ? 'Uploading…' : 'Upload JSON'}
          </button>
        </div>
      )}

      {tab === 'file' && phase === 'idle' && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const dropped = event.dataTransfer.files[0];
            if (dropped) {
              void handleFile(dropped);
            }
          }}
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border-subtle bg-surface-2'
          }`}
        >
          <UploadCloud className="h-8 w-8 text-muted" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('upload.hint')} — Drag and drop a bank statement</p>
            <p className="mt-1 text-sm text-muted">CSV or Excel (.csv, .xlsx, .xls)</p>
          </div>
          <label
            htmlFor={`${inputId}-file`}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
          >
            Choose file
            <input
              id={`${inputId}-file`}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) {
                  void handleFile(selected);
                }
                event.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {tab === 'file' && phase === 'parsing' && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Reading {fileName}…
        </div>
      )}

      {tab === 'file' && phase === 'manual-columns' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">First rows of {fileName}</caption>
              <tbody>
                {rawRows.slice(0, RAW_PREVIEW_ROWS).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-border-subtle last:border-b-0">
                    {Array.from({ length: totalColumns }, (_, col) => (
                      <td key={col} className="max-w-40 truncate px-3 py-2 text-muted">
                        {row[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { label: 'Date column', value: manualDate, onChange: setManualDate },
                { label: 'Description column', value: manualDescription, onChange: setManualDescription },
                { label: 'Amount column', value: manualAmount, onChange: setManualAmount }
              ] as const
            ).map((picker) => (
              <label key={picker.label} className="flex flex-col gap-1 text-sm font-medium text-foreground">
                {picker.label}
                <select
                  value={picker.value}
                  onChange={(event) => picker.onChange(event.target.value)}
                  className="min-h-11 rounded-xl border border-border-subtle bg-surface-2 px-3 text-base text-foreground sm:text-sm"
                >
                  <option value="">Select…</option>
                  {Array.from({ length: totalColumns }, (_, col) => (
                    <option key={col} value={col}>
                      {columnLabel(rawRows, col)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={handleManualConfirm}
              className="min-h-11 flex-1 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Use these columns
            </button>
            <button
              type="button"
              onClick={resetFileState}
              className="min-h-11 rounded-xl border border-border-subtle px-5 text-sm font-medium text-foreground hover:bg-surface-2"
            >
              Choose another file
            </button>
          </div>
        </div>
      )}

      {tab === 'file' && (phase === 'preview' || phase === 'uploading') && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
              <p className="text-sm text-muted">
                {rows.length} transaction{rows.length === 1 ? '' : 's'} detected
                {creditCount > 0 ? ` · ${creditCount} excluded as credits/payments` : ''}
                {skippedCount > 0 ? ` · ${skippedCount} row${skippedCount === 1 ? '' : 's'} skipped` : ''}
              </p>
            </div>
          </div>

          <div className="hidden grid-cols-[2.5rem_5rem_minmax(0,1fr)_6rem_minmax(0,10rem)_minmax(0,10rem)] gap-3 px-3 text-xs font-semibold text-muted md:grid">
            <span className="sr-only">Include</span>
            <span>Date</span>
            <span>Place</span>
            <span className="text-right">Amount</span>
            <span>Category</span>
            <span>Subcategory</span>
          </div>

          <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-border-subtle md:rounded-xl md:border md:border-border-subtle">
            {visibleRows.map((row) => (
              <li
                key={row.id}
                className={`rounded-xl border border-border-subtle bg-surface p-3 md:grid md:grid-cols-[2.5rem_5rem_minmax(0,1fr)_6rem_minmax(0,10rem)_minmax(0,10rem)] md:items-center md:gap-3 md:rounded-none md:border-0 ${
                  row.include ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 md:contents">
                  <label className="flex min-h-11 items-center gap-3 md:min-h-0">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(event) => updateRow(row.id, { include: event.target.checked })}
                      aria-label={`Include ${row.place}`}
                      className="h-5 w-5 shrink-0 rounded accent-primary"
                    />
                    <span className="text-sm text-muted md:hidden">{formatDateShort(row.dateIso)}</span>
                  </label>
                  <span className="hidden text-sm text-muted tabular-nums md:block">
                    {formatDateShort(row.dateIso)}
                  </span>
                  <span className="hidden truncate text-sm font-medium text-foreground md:block" title={row.place}>
                    {row.place}
                  </span>
                  <span
                    className={`flex items-center gap-2 text-sm font-semibold tabular-nums md:justify-end ${
                      row.isCredit ? 'text-muted' : 'text-foreground'
                    }`}
                  >
                    {formatCurrency(row.value)}
                    {row.isCredit && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                        Credit
                      </span>
                    )}
                  </span>
                </div>

                <p className="mt-1 truncate text-sm font-medium text-foreground md:hidden" title={row.place}>
                  {row.place}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 md:contents">
                  <select
                    value={row.category}
                    onChange={(event) => handleCategoryChange(row.id, event.target.value)}
                    aria-label={`Category for ${row.place}`}
                    title={getCategoryJapaneseName(row.category)}
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-2 text-base text-foreground sm:text-sm md:mt-0"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.name} value={category.name} title={category.nameJa}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.subcategory}
                    onChange={(event) => updateRow(row.id, { subcategory: event.target.value })}
                    aria-label={`Subcategory for ${row.place}`}
                    className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-2 text-base text-foreground sm:text-sm md:mt-0"
                  >
                    {getSubcategoriesForCategory(row.category).map((subcategory) => (
                      <option key={subcategory.name} value={subcategory.name} title={subcategory.nameJa}>
                        {subcategory.name} ({subcategory.nameJa})
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>

          {!showAll && rows.length > PREVIEW_ROW_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-11 rounded-xl border border-border-subtle text-sm font-medium text-foreground hover:bg-surface-2"
            >
              Show all ({rows.length})
            </button>
          )}

          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={handleUpload}
              disabled={phase === 'uploading' || includedRows.length === 0}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === 'uploading'
                ? 'Uploading…'
                : `Upload ${includedRows.length} transaction${includedRows.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              onClick={resetFileState}
              disabled={phase === 'uploading'}
              className="min-h-11 rounded-xl border border-border-subtle px-5 text-sm font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
            >
              Choose another file
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
