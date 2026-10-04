import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { readJson, validId, InvalidRequest } from '@/lib/api-validation';
async function update(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession(request); if (error) return error;
  try {
    const { id } = await params; if (!validId(id)) throw new InvalidRequest();
    const body = await readJson(request);
    if (Object.keys(body).some(key => !['category','subcategory'].includes(key))) throw new InvalidRequest();
    if (![body.category, body.subcategory].some(value => typeof value === 'string' && value.trim())) throw new InvalidRequest();
    for (const value of Object.values(body)) if (typeof value !== 'string' || value.length > 200) throw new InvalidRequest();
    return await upstreamJson(`/transactions/${id}`, { method: request.method, body: JSON.stringify({ ...body, category_source: 'manual' }) });
  } catch (error) { return requestError(error); }
}
export const PATCH = update;
export const PUT = update;
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession(request); if (error) return error;
  try { const { id } = await params; if (!validId(id)) throw new InvalidRequest(); return await upstreamJson(`/transactions/${id}`, { method: 'DELETE' }); } catch (error) { return requestError(error); }
}
