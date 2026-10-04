import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { readJson, validateRule, validId, InvalidRequest } from '@/lib/api-validation';
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession(request); if (error) return error;
  try { const { id } = await params; if (!validId(id)) throw new InvalidRequest(); const body = await readJson(request); validateRule(body, true); return await upstreamJson(`/recurring-rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); } catch (error) { return requestError(error); }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession(request); if (error) return error;
  try { const { id } = await params; if (!validId(id)) throw new InvalidRequest(); return await upstreamJson(`/recurring-rules/${id}`, { method: 'DELETE' }); } catch (error) { return requestError(error); }
}
