export class InvalidRequest extends Error {
  constructor(public status = 400) { super('Invalid request'); }
}
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validId(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}
export function validateWindow(start: unknown, end: unknown) {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 730) throw new InvalidRequest();
}
export async function readBoundedText(request: Request, maxBytes = 65536): Promise<string> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new InvalidRequest(413);
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidRequest();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new InvalidRequest(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = JSON.parse(await readBoundedText(request)); } catch (error) { if (error instanceof InvalidRequest) throw error; throw new InvalidRequest(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InvalidRequest();
  return body as Record<string, unknown>;
}
export function validateRule(body: Record<string, unknown>, partial = false) {
  const allowed = ['kind','label','amount','cadence','start_date','end_date','category','subcategory','merchant_pattern','enabled'];
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) throw new InvalidRequest();
  if (!partial && ['kind','label','amount','cadence','start_date'].some(key => body[key] === undefined)) throw new InvalidRequest();
  if (body.kind !== undefined && !['income','expense'].includes(String(body.kind))) throw new InvalidRequest();
  if (body.cadence !== undefined && !['weekly','fortnightly','monthly'].includes(String(body.cadence))) throw new InvalidRequest();
  if (body.amount !== undefined && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 1e9)) throw new InvalidRequest();
  for (const key of ['label','category','subcategory','merchant_pattern']) {
    const value = body[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > (key === 'merchant_pattern' ? 500 : 200))) throw new InvalidRequest();
  }
  if (body.label !== undefined && (typeof body.label !== 'string' || !body.label.trim())) throw new InvalidRequest();
  if (body.start_date !== undefined && !isIsoDate(body.start_date)) throw new InvalidRequest();
  if (body.end_date !== undefined && body.end_date !== null && !isIsoDate(body.end_date)) throw new InvalidRequest();
  if (typeof body.start_date === 'string' && typeof body.end_date === 'string' && body.end_date < body.start_date) throw new InvalidRequest();
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new InvalidRequest();
}
