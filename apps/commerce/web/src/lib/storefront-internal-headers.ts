import { createBoundStorefrontRequestHeaders } from '@letbuyy/auth-core';

/** Shared by the routing proxy and server actions; server-only environment values. */
export async function storefrontInternalHeaders(method: 'GET' | 'POST', url: string, body?: string): Promise<Record<string, string>> {
  const policy = process.env.STOREFRONT_INTERNAL_PERIMETER?.trim();
  if (policy) {
    if (policy !== 'bound-request-v1') throw new Error('Unknown storefront internal perimeter');
    const signed = await createBoundStorefrontRequestHeaders({ secret: process.env.STOREFRONT_INTERNAL_REQUEST_SECRET || '', method, url, body });
    return { 'content-type': 'application/json', ...signed };
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error('INTERNAL_API_SECRET is required for storefront access');
  return { 'content-type': 'application/json', 'x-internal-api-secret': secret };
}
