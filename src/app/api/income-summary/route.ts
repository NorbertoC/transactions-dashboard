import { requireSession, upstreamJson, requestError } from '@/lib/api-upstream';
import { validateWindow } from '@/lib/api-validation';

export async function GET(request: Request) {
  const { error } = await requireSession(); if (error) return error;
  try {
    const params = new URL(request.url).searchParams;
    const start = params.get('start_date');
    const end = params.get('end_date');
    validateWindow(start, end);
    return await upstreamJson(`/income-summary?start_date=${start}&end_date=${end}`);
  } catch (error) { return requestError(error); }
}
