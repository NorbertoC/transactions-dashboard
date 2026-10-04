import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
export async function GET() {
  const { error } = await requireSession(); if (error) return error;
  try { return await upstreamJson('/period-summaries'); } catch (error) { return requestError(error); }
}
