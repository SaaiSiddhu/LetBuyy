import { normalizeCheckoutOrigin } from '@letbuyy/checkout-core';
import { readStorefrontApiBaseUrl } from './api/base-url';
import { storefrontInternalHeaders, STOREFRONT_INTERNAL_TIMEOUT_MS } from './storefront-internal-headers';

type RequestHeaders = Pick<Headers, 'get'>;
/** Host comes from the actual request. Conflicting forwarding headers cannot
 * choose another store's checkout. This check confers no domain ownership. */
export function checkoutRequestOrigin(headers: RequestHeaders, requestUrl?: string): string | null {
  let url: URL | undefined;
  try { if (requestUrl) url = new URL(requestUrl); } catch { return null; }
  const host = headers.get('host') || url?.host;
  if (!host || host !== host.toLowerCase() || /[\s,/@\\]/.test(host)) return null;
  const forwardedHost = headers.get('x-forwarded-host');
  if (forwardedHost && forwardedHost !== host) return null;
  if (url && url.host !== host) {
    // Next's local dev ingress uses localhost in request.url while preserving
    // the requested *.localhost Host. This exact, same-port local normalization
    // does not apply to a production build or to any public DNS hostname.
    let localHost: URL;
    try { localHost = new URL(`http://${host}`); } catch { return null; }
    if (process.env.NODE_ENV === 'production' || url.hostname !== 'localhost'
        || !localHost.hostname.endsWith('.localhost') || localHost.port !== url.port) return null;
  }
  const protocol = url?.protocol || `${headers.get('x-forwarded-proto') || 'https'}:`;
  const forwardedProtocol = headers.get('x-forwarded-proto');
  if (forwardedProtocol && `${forwardedProtocol}:` !== protocol) return null;
  return normalizeCheckoutOrigin(`${protocol}//${host}`);
}

export function checkoutRequestBinding(headers: RequestHeaders, declared: string | null | undefined, requestUrl?: string): string | null {
  const actual = checkoutRequestOrigin(headers, requestUrl);
  if (!actual) return null;
  const central = normalizeCheckoutOrigin(process.env.CHECKOUT_ORIGIN || 'https://checkout.letbuyy.com');
  if (declared === undefined || declared === null) return actual === central ? actual : null;
  return normalizeCheckoutOrigin(declared) === actual ? actual : null;
}

interface CheckoutHostSite { site_id: string; subdomain: string; host: string; purpose: 'checkout' }
/** Exact, signed bootstrap through the existing Commerce-only perimeter. A
 * checkout-looking suffix or a DNS response alone is never an admission. */
export async function resolveCheckoutHost(host: string): Promise<CheckoutHostSite | null> {
  const base = readStorefrontApiBaseUrl();
  if (!base) throw new Error('Checkout host resolution is unavailable');
  const root = base.replace(/\/$/, '').replace(/\/v1$/, '');
  const url = `${root}/v1/internal/store-access/resolve?host=${encodeURIComponent(host)}&purpose=checkout`;
  const reply = await fetch(url, { headers: await storefrontInternalHeaders('GET', url), cache: 'no-store', signal: AbortSignal.timeout(STOREFRONT_INTERNAL_TIMEOUT_MS) });
  if (reply.status === 404) return null;
  if (!reply.ok) throw new Error('Checkout host resolution is unavailable');
  const body = await reply.json().catch(() => null) as { data?: Partial<CheckoutHostSite> } | null;
  const site = body?.data;
  if (!site || site.purpose !== 'checkout' || site.host !== host || typeof site.site_id !== 'string' || typeof site.subdomain !== 'string') return null;
  return site as CheckoutHostSite;
}
