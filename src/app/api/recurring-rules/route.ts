import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { readJson, validateRule } from '@/lib/api-validation';
export async function GET() {
  const { error } = await requireSession(); if (error) return error;
  try { return await upstreamJson('/recurring-rules'); } catch (error) { return requestError(error); }
}
export async function POST(request: NextRequest) {
  const { error } = await requireSession(request); if (error) return error;
  try { const body = await readJson(request); validateRule(body); return await upstreamJson('/recurring-rules', { method: 'POST', body: JSON.stringify(body) }); } catch (error) { return requestError(error); }
}
