/**
 * Pure parsing logic for bank-statement spreadsheet uploads (CSV/XLSX).
 *
 * Tailored to NZ credit-card exports (ANZ/Amex style): day-first dates,
 * NZD amounts, optional header row. All functions are side-effect free so
 * they can be unit-tested without a DOM or network.
 */

import Papa from 'papaparse';
import { categorizeMerchant } from '@/utils/classification';

export interface DetectedColumns {
  /** Index of the header row, or -1 when columns were inferred from content. */
  headerRowIndex: number;
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
}

export interface ParsedTransactionRow {
  /** Stable local key for React lists; not persisted. */
  id: string;
  place: string;
  dateIso: string;
  /** Absolute amount in NZD. */
  value: number;
  /** Original amount was negative (refund / card payment) or matched a payment line. */
  isCredit: boolean;
  category: string;
  subcategory: string;
  include: boolean;
}

export interface SkippedRow {
  row: string[];
  reason: string;
}

const EXCEL_EXTENSIONS = /\.xlsx?$|\.xls$/i;

function isExcelFile(file: File): boolean {
  return EXCEL_EXTENSIONS.test(file.name);
}

function normalizeCell(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  return String(cell).trim();
}

function dropEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell !== ''));
}

async function parseExcelFile(file: File): Promise<string[][]> {
  // Dynamic import keeps SheetJS out of the main bundle until an Excel file is chosen.
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  // dateNF must be passed at read time; sheet_to_json ignores it and would
  // format dates month-first, silently swapping day and month.
  const workbook = XLSX.read(arrayBuffer, { dateNF: 'dd/mm/yyyy' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false
  });

  return dropEmptyRows(rows.map((row) => row.map(normalizeCell)));
}

function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        resolve(dropEmptyRows(results.data.map((row) => row.map(normalizeCell))));
      },
      error: (error) => reject(error)
    });
  });
}

/** Parse a CSV or Excel file into a raw string matrix. */
export function parseSpreadsheetFile(file: File): Promise<string[][]> {
  if (isExcelFile(file)) {
    return parseExcelFile(file);
  }
  return parseCsvFile(file);
}

/**
 * '$1,234.56' => 1234.56, '(45.00)' => -45, '-12.00' => -12.
 * Returns null when the cell is not a money-like value.
 */
export function parseAmount(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  let text = raw.trim();
  if (text === '') {
    return null;
  }

  const parenthesised = /^\((.*)\)$/.exec(text);
  if (parenthesised) {
    text = `-${parenthesised[1]}`;
  }

  // Strip currency symbols/codes, thousands separators and internal spaces.
  const cleaned = text
    .replace(/NZD|NZ\$|AUD|USD/gi, '')
    .replace(/[$£€¥,\s]/g, '');

  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  // Round-trip through Date to reject impossible dates like 31/02.
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!valid) {
    return null;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function expandTwoDigitYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/**
 * Day-first date parsing for NZ bank exports.
 * Accepts YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD.MM.YY(YY)
 * and 'DD Mon YYYY'. Returns 'YYYY-MM-DD' or null.
 */
export function parseDateToIso(raw: string): string | null {
  const text = raw.trim();
  if (text === '') {
    return null;
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    return toIsoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dayFirst = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(text);
  if (dayFirst) {
    return toIsoIfValid(
      expandTwoDigitYear(Number(dayFirst[3])),
      Number(dayFirst[2]),
      Number(dayFirst[1])
    );
  }

  const monthName = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{2}|\d{4})$/.exec(text);
  if (monthName) {
    const month = MONTH_NAMES[monthName[2].slice(0, 3).toLowerCase()];
    if (!month) {
      return null;
    }
    return toIsoIfValid(expandTwoDigitYear(Number(monthName[3])), month, Number(monthName[1]));
  }

  return null;
}

const DATE_HEADER_NAMES = [
  'date', 'transaction date', 'processed date', 'date processed', 'transaction_date'
];
const DESCRIPTION_HEADER_NAMES = [
  'details', 'particulars', 'description', 'narrative', 'merchant', 'payee',
  'transaction details', 'merchant name', 'name', 'place'
];
const AMOUNT_HEADER_NAMES = [
  'amount', 'debit', 'value', 'amount (nzd)', 'debit amount', 'amount nzd', 'total'
];

const HEADER_SEARCH_DEPTH = 5;
const CONTENT_SAMPLE_SIZE = 50;
const CONTENT_MATCH_THRESHOLD = 0.5;

function findHeaderColumn(cells: string[], names: string[]): number {
  return cells.findIndex((cell) => names.includes(cell));
}

function detectByHeader(rows: string[][]): DetectedColumns | null {
  const depth = Math.min(rows.length, HEADER_SEARCH_DEPTH);

  for (let rowIndex = 0; rowIndex < depth; rowIndex++) {
    const cells = rows[rowIndex].map((cell) => cell.toLowerCase().trim());

    const dateColumn = findHeaderColumn(cells, DATE_HEADER_NAMES);
    const amountColumn = findHeaderColumn(cells, AMOUNT_HEADER_NAMES);
    if (dateColumn === -1 || amountColumn === -1) {
      continue;
    }

    let descriptionColumn = findHeaderColumn(cells, DESCRIPTION_HEADER_NAMES);
    if (descriptionColumn === -1) {
      descriptionColumn = pickDescriptionColumn(
        rows.slice(rowIndex + 1),
        cells.length,
        new Set([dateColumn, amountColumn])
      );
    }
    if (descriptionColumn === -1) {
      continue;
    }

    return { headerRowIndex: rowIndex, dateColumn, descriptionColumn, amountColumn };
  }

  return null;
}

function columnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/** Remaining column whose cells have the longest average text. */
function pickDescriptionColumn(
  dataRows: string[][],
  totalColumns: number,
  taken: Set<number>
): number {
  let best = -1;
  let bestLength = -1;

  for (let col = 0; col < totalColumns; col++) {
    if (taken.has(col)) {
      continue;
    }
    const sample = dataRows.slice(0, CONTENT_SAMPLE_SIZE);
    const totalLength = sample.reduce((sum, row) => sum + (row[col]?.length ?? 0), 0);
    const average = sample.length > 0 ? totalLength / sample.length : 0;
    if (average > bestLength) {
      bestLength = average;
      best = col;
    }
  }

  return bestLength > 0 ? best : -1;
}

function matchFraction(
  rows: string[][],
  col: number,
  matches: (cell: string) => boolean
): number {
  const sample = rows.slice(0, CONTENT_SAMPLE_SIZE);
  const nonEmpty = sample.filter((row) => (row[col] ?? '') !== '');
  if (nonEmpty.length === 0) {
    return 0;
  }
  const hits = nonEmpty.filter((row) => matches(row[col])).length;
  return hits / nonEmpty.length;
}

function detectByContent(rows: string[][]): DetectedColumns | null {
  const totalColumns = columnCount(rows);
  if (totalColumns < 2) {
    return null;
  }

  let dateColumn = -1;
  let bestDateScore = 0;
  for (let col = 0; col < totalColumns; col++) {
    const score = matchFraction(rows, col, (cell) => parseDateToIso(cell) !== null);
    if (score > bestDateScore) {
      bestDateScore = score;
      dateColumn = col;
    }
  }
  if (dateColumn === -1 || bestDateScore < CONTENT_MATCH_THRESHOLD) {
    return null;
  }

  let amountColumn = -1;
  let bestAmountScore = 0;
  for (let col = 0; col < totalColumns; col++) {
    if (col === dateColumn) {
      continue;
    }
    const score = matchFraction(rows, col, (cell) => parseAmount(cell) !== null);
    // Prefer columns with decimal values when scores tie (skips integer ID columns).
    const decimalShare = matchFraction(rows, col, (cell) => cell.includes('.'));
    const weighted = score + decimalShare * 0.01;
    if (weighted > bestAmountScore && score >= CONTENT_MATCH_THRESHOLD) {
      bestAmountScore = weighted;
      amountColumn = col;
    }
  }
  if (amountColumn === -1) {
    return null;
  }

  const descriptionColumn = pickDescriptionColumn(
    rows,
    totalColumns,
    new Set([dateColumn, amountColumn])
  );
  if (descriptionColumn === -1) {
    return null;
  }

  return { headerRowIndex: -1, dateColumn, descriptionColumn, amountColumn };
}

/**
 * Locate the date/description/amount columns, first by header names,
 * then by inferring from cell content. Null when neither works.
 */
export function detectColumns(rows: string[][]): DetectedColumns | null {
  if (rows.length === 0) {
    return null;
  }
  return detectByHeader(rows) ?? detectByContent(rows);
}

// Only actual card-payment phrasings; a bare /payment/ would wrongly
// exclude legitimate spending like 'RENT PAYMENT'.
const CARD_PAYMENT_PATTERN = /payment\s+received|thank\s+you|direct\s+debit\s+received/i;

export function extractTransactions(
  rows: string[][],
  columns: ReturnType<typeof detectColumns>
): { rows: ParsedTransactionRow[]; skipped: SkippedRow[] } {
  if (!columns) {
    return {
      rows: [],
      skipped: rows.map((row) => ({ row, reason: 'Columns not detected' }))
    };
  }

  const dataRows = rows.slice(columns.headerRowIndex + 1);
  const candidates: Array<{
    index: number;
    dateIso: string;
    amount: number;
    place: string;
  }> = [];
  const skipped: SkippedRow[] = [];

  dataRows.forEach((row, index) => {
    const dateIso = parseDateToIso(row[columns.dateColumn] ?? '');
    if (!dateIso) {
      skipped.push({ row, reason: 'Unrecognised date' });
      return;
    }

    const amount = parseAmount(row[columns.amountColumn] ?? '');
    if (amount === null) {
      skipped.push({ row, reason: 'Unrecognised amount' });
      return;
    }

    const place = (row[columns.descriptionColumn] ?? '').trim();
    if (place === '') {
      skipped.push({ row, reason: 'Missing description' });
      return;
    }

    candidates.push({ index, dateIso, amount, place });
  });

  // Sign convention varies by bank: card statements list purchases as
  // positive, account exports as negative (debits-negative). The dominant
  // sign decides which side is spending; payment lines are credits either way.
  const negativeCount = candidates.filter((candidate) => candidate.amount < 0).length;
  const debitsNegative = negativeCount > candidates.length / 2;

  const parsed = candidates.map(({ index, dateIso, amount, place }) => {
    const signSaysCredit = debitsNegative ? amount > 0 : amount < 0;
    const isCredit = signSaysCredit || CARD_PAYMENT_PATTERN.test(place);
    const { category, subcategory } = categorizeMerchant(place);

    return {
      id: `row-${index}-${dateIso}-${Math.abs(amount)}`,
      place,
      dateIso,
      value: Math.abs(amount),
      isCredit,
      category,
      subcategory,
      include: !isCredit
    };
  });

  return { rows: parsed, skipped };
}
