import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { readJson, validateWindow, isIsoDate, InvalidRequest } from '@/lib/api-validation';
export async function POST(request: NextRequest) {
  const { error } = await requireSession(request); if (error) return error;
  try { const body = await readJson(request); if (Object.keys(body).some(key => !['statement_id','start','end'].includes(key))) throw new InvalidRequest(); if (body.statement_id !== undefined && !isIsoDate(body.statement_id)) throw new InvalidRequest(); if (body.start !== undefined || body.end !== undefined) validateWindow(body.start, body.end); else if (!isIsoDate(body.statement_id)) throw new InvalidRequest(); return await upstreamJson('/period-summaries/compute', { method: 'POST', body: JSON.stringify(body) }); } catch (error) { return requestError(error); }
}
