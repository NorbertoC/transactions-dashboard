import { NextRequest } from 'next/server';
import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { validateWindow } from '@/lib/api-validation';
export async function GET(request: NextRequest) {
  const { error } = await requireSession(); if (error) return error;
  try { const start = request.nextUrl.searchParams.get('start'); const end = request.nextUrl.searchParams.get('end'); validateWindow(start, end); return await upstreamJson(`/recurring-rules/project?start=${start}&end=${end}`); } catch (error) { return requestError(error); }
}
