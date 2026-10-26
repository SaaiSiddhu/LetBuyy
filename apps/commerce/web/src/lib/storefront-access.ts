import 'server-only';
import { readStorefrontApiBaseUrl } from './api/base-url';
import { storefrontInternalHeaders } from './storefront-internal-headers';

export interface StorefrontAccessContext {
  site_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_status: string;
  access_mode: 'public' | 'password' | 'preview_only' | 'offline';
  access_message: string | null;
  published: boolean;
  status: string;
}

export function getGatewayBaseUrl(): string {
  const value = readStorefrontApiBaseUrl();
  if (!value) {
    throw new Error('LETBUYY_API_BASE_URL or NEXT_PUBLIC_API_URL is required for storefront access');
  }
  return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export async function resolveStorefrontAccessContext(host: string): Promise<StorefrontAccessContext | null> {
  const url = `${getGatewayBaseUrl()}/v1/internal/store-access/resolve?host=${encodeURIComponent(host)}`;
  const response = await fetch(url, {
    headers: await storefrontInternalHeaders('GET', url),
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Failed to resolve storefront access context');
  }
  const body = await response.json() as { data?: StorefrontAccessContext };
  return body.data || null;
}

export async function verifyStorePassword(input: {
  siteId: string;
  host: string;
  password: string;
  ip?: string | null;
}): Promise<boolean> {
  const url = `${getGatewayBaseUrl()}/v1/internal/store-access/verify`;
  const body = JSON.stringify({ site_id: input.siteId, host: input.host, password: input.password, ip: input.ip || null });
  const response = await fetch(url, {
    method: 'POST',
    headers: await storefrontInternalHeaders('POST', url, body),
    body,
    cache: 'no-store',
  });
  return response.ok;
}
