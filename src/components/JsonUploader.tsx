"use client";

import { useState } from "react";

interface Transaction {
  place: string;
  amount: string;
  date: string;
  currency: string;
  value: number;
  date_iso: string;
  category: string;
  subcategory?: string;
  statement_id?: string | null;
  statement_start?: string | null;
  statement_end?: string | null;
}

interface JsonUploaderProps {
  onTransactionsExtracted?: (transactions: Transaction[]) => void;
}

interface UploadJsonResponse {
  count?: number;
  duplicateCount?: number;
  transactions?: Transaction[];
  error?: string;
}

function sanitizeJson(raw: string): string {
  // Trim, remove BOM, and strip trailing commas (including a final dangling comma)
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const withoutTrailingCommas = trimmed
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/,\s*$/g, '');
  return withoutTrailingCommas;
}

function parseJsonPayload(raw: string): unknown[] {
  if (!raw.trim()) {
    throw new Error("Please paste a JSON payload first.");
  }

  const tryParse = (value: string) => {
    try {
      const cleaned = sanitizeJson(value);
      if (cleaned.startsWith('<')) {
        throw new Error(
          "The pasted content looks like HTML. Please paste raw JSON (remove any headers, footers, or HTML wrappers)."
        );
      }
      return JSON.parse(cleaned);
    } catch (err) {
      // Attempt to fix common trailing-comma mistakes before giving up
      const cleaned = value
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/,\s*(\n|\r|\s)*([}\]])/g, '$2')
        .replace(/,\s*$/g, '');

      if (cleaned !== value) {
        return JSON.parse(cleaned);
      }

      throw err;
    }
  };

  const parsed = tryParse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).transactions)) {
    return (parsed as { transactions: unknown[] }).transactions;
  }

  throw new Error("JSON must be an array of transactions or an object with a 'transactions' array.");
}

export default function JsonUploader({ onTransactionsExtracted }: JsonUploaderProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const handleUpload = async () => {
    try {
      const payload = parseJsonPayload(jsonInput);
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/upload-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactions: payload }),
      });

      let data: UploadJsonResponse;
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (isJson) {
        try {
          data = await response.json();
        } catch {
          // If JSON parsing fails, fall back to text to show a meaningful error
          const text = await response.text();
          throw new Error(text || "Server returned an unreadable response.");
        }
      } else {
        const text = await response.text();
        throw new Error(text || "Server did not return JSON. Check network/API logs.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload JSON");
      }

      setSuccess(true);
      setTransactionCount(data.count ?? payload.length);
      setDuplicateCount(data.duplicateCount || 0);

      if (onTransactionsExtracted) {
        onTransactionsExtracted(data.transactions ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON payload");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <p className="text-gray-600 mb-4">
        Paste raw transaction JSON below. The payload can be an array or an object with a <span className="font-semibold">&apos;transactions&apos;</span> array.
      </p>

      <label htmlFor="json-upload" className="block text-sm font-medium text-gray-700 mb-2">
        JSON Payload
      </label>
      <textarea
        id="json-upload"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-3 font-mono text-sm bg-gray-50"
        placeholder={`[
  {
    "place": "Example Store",
    "amount": "NZ$25.00",
    "date_iso": "2025-03-12",
    "value": 25,
    "category": "Shopping",
    "subcategory": "Retail & Home"
  }
]`}
      />

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">
            ✓ Successfully processed {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
            {duplicateCount > 0 && (
              <span className="text-yellow-600 ml-2">
                ({duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""} skipped)
              </span>
            )}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`flex-1 py-3 px-4 rounded-md font-semibold text-white
            ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"}
            transition-colors duration-200`}
        >
          {loading ? "Processing..." : "Send JSON"}
        </button>
        <button
          onClick={() => setJsonInput("")}
          disabled={loading || !jsonInput}
          className="px-4 py-3 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Clear
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-700 font-medium mb-1">Tips:</p>
        <ul className="text-xs text-blue-600 list-disc list-inside space-y-1">
          <li>Include <span className="font-semibold">place</span>, <span className="font-semibold">value</span>, and <span className="font-semibold">date_iso</span> when possible.</li>
          <li>Categories are auto-filled using merchant names if omitted.</li>
          <li>Statement metadata is computed automatically when missing.</li>
        </ul>
      </div>
    </div>
  );
}
