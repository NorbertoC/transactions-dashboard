import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { taxonomyHeaders } from '@/lib/taxonomy-guard';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  try { return await upstreamJson('/taxonomy', { headers: taxonomyHeaders }); }
  catch (error) { return requestError(error); }
}
