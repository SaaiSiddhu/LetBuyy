import 'server-only';
import { readStorefrontApiBaseUrl } from './api/base-url';

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

export function getInternalHeaders(): HeadersInit {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is required for storefront access');
  }
  return {
    'content-type': 'application/json',
    'x-internal-api-secret': secret,
  };
}

export async function resolveStorefrontAccessContext(host: string): Promise<StorefrontAccessContext | null> {
  const response = await fetch(`${getGatewayBaseUrl()}/v1/internal/store-access/resolve?host=${encodeURIComponent(host)}`, {
    headers: getInternalHeaders(),
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
  const response = await fetch(`${getGatewayBaseUrl()}/v1/internal/store-access/verify`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify({
      site_id: input.siteId,
      host: input.host,
      password: input.password,
      ip: input.ip || null,
    }),
    cache: 'no-store',
  });
  return response.ok;
}
