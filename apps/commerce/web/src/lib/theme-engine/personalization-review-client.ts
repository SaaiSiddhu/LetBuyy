import { PersonalizationReviewContextSchema, PersonalizationReviewQuerySchema, readPersonalizationFacts, type PersonalizationReviewContext } from '@letbuyy/commerce-core';
import { UuidSchema } from '@letbuyy/shared-types';
import { readStorefrontApiJson, storefrontBrowserApiFetch } from '@/lib/api/browser-client';
import { parsePickerVariants } from './variant-options-carrier';
import { mapPublicProductVariants } from '@/lib/product-variants';

/** Uses the existing same-origin storefront proxy; no catalog version or price enters the client contract. */
export async function loadMadeYoursReviewContext(subdomain: string, productId: string, variantId: string | null, signal: AbortSignal): Promise<PersonalizationReviewContext | null> {
  const product = UuidSchema.safeParse(productId);
  const query = PersonalizationReviewQuerySchema.safeParse(variantId ? { variant_id: variantId } : {});
  if (!product.success || !query.success || signal.aborted) return null;
  const suffix = query.data.variant_id ? `?variant_id=${encodeURIComponent(query.data.variant_id)}` : '';
  const response = await storefrontBrowserApiFetch(subdomain, `/products/${encodeURIComponent(product.data)}/personalization-review${suffix}`, { cache: 'no-store', signal });
  const payload = await readStorefrontApiJson<unknown>(response);
  if (!response.ok || !payload.success || signal.aborted) return null;
  const context = PersonalizationReviewContextSchema.safeParse(payload.data);
  return context.success && context.data.product_id === product.data && context.data.variant_id === variantId ? context.data : null;
}

/** Existing public product projection, used only to display current variant and
 * method controls. The no-store signed review context still authorizes Save. */
export async function loadMadeYoursCartEditChoices(subdomain: string, productId: string, signal: AbortSignal) {
  if (!UuidSchema.safeParse(productId).success || signal.aborted) return null;
  const response = await storefrontBrowserApiFetch(subdomain, `/products/${encodeURIComponent(productId)}`, { cache: 'no-store', signal });
  const payload = await readStorefrontApiJson<unknown>(response);
  if (!response.ok || !payload.success || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data) || signal.aborted) return null;
  const product = payload.data as Record<string, unknown>;
  if (product.id !== productId || !Array.isArray(product.variants)) return null;
  const facts = readPersonalizationFacts(product.metadata);
  const variants = product.variants.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
  // The public API uses positional option fields. Reuse the same adapter as
  // product pages before feeding the existing bounded Liquid picker carrier.
  return { variants: parsePickerVariants(JSON.stringify(mapPublicProductVariants(product, variants).variants)), facts };
}
