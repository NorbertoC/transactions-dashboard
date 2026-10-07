import { privateJson, proxyUpstream } from '@/lib/api-upstream';
import { supportsCategoryReview } from '@/utils/category-review';
import { PURPOSE_TAXONOMY_HEADER, PURPOSE_TAXONOMY_VERSION } from '@/constants/categories';

/** Server-selected contract; never forward a browser-supplied version. */
export const taxonomyHeaders = { [PURPOSE_TAXONOMY_HEADER]: PURPOSE_TAXONOMY_VERSION };

/** Check the upstream contract before any category write; no DB writes here. */
export async function requireTaxonomyCapability(): Promise<Response | null> {
  const response = await proxyUpstream('/taxonomy', { headers: taxonomyHeaders });
  if (response.status === 401 || response.status === 403) return privateJson({ error: 'Request failed' }, { status: response.status });
  if (!response.ok || !supportsCategoryReview(await response.json())) {
    return privateJson({ error: 'Category service unavailable' }, { status: 503 });
  }
  return null;
}
