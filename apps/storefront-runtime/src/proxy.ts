import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createStorefrontGateToken,
  LETBUYY_STOREFRONT_GATE_COOKIE,
  LETBUYY_STOREFRONT_GATE_TTL_SECONDS,
  LETBUYY_STOREFRONT_PREVIEW_COOKIE,
  LETBUYY_STOREFRONT_PREVIEW_QUERY,
  verifyStorefrontGateToken,
  verifyStorefrontPreviewToken,
} from '@letbuyy/auth-core';
import {
  normalizeRequestHost,
  resolveStorefrontHost,
} from '@letbuyy/tenant-core';
import { getThemePreviewCookieName, normalizeThemePreviewToken } from './lib/theme-preview-cookie';
import { readStorefrontApiBaseUrl } from './lib/api/base-url';

type StorefrontAccessMode = 'public' | 'password' | 'preview_only' | 'offline';

interface StorefrontAccessContext {
  site_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_status: string;
  access_mode: StorefrontAccessMode;
  access_message: string | null;
  published: boolean;
  status: string;
}

type StorefrontAccessResolution =
  | { status: 'ok'; site: StorefrontAccessContext }
  | { status: 'not_found' }
  | { status: 'unavailable' };

// Log a given misconfiguration / outage reason at most once per process so a
// missing env var or backend blip does not spam logs on every request.
const warnedOnce = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(`[storefront-proxy] ${message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

export const config = {
  matcher: ['/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)'],
};

function gatewayBaseUrl(): string | null {
  const value = readStorefrontApiBaseUrl();
  if (!value) {
    warnOnce('gateway-base-url', 'LETBUYY_API_BASE_URL/NEXT_PUBLIC_API_URL is not set; storefront access resolution is disabled');
    return null;
  }
  return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function internalHeaders(): Record<string, string> | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    warnOnce('internal-api-secret', 'INTERNAL_API_SECRET is not set; storefront access resolution is disabled');
    return null;
  }
  return { 'x-internal-api-secret': secret };
}

// Backend config needed to call the store-access API. Returns null (instead of
// throwing) when an env var is missing so the request path can degrade
// gracefully rather than 500ing every storefront request.
function backendConfig(): { baseUrl: string; headers: Record<string, string> } | null {
  const baseUrl = gatewayBaseUrl();
  const headers = internalHeaders();
  if (!baseUrl || !headers) return null;
  return { baseUrl, headers };
}

// Returns the signing secret, or null when it is missing/too short. Callers in
// the verify path pass the result straight through (verification fails closed
// on a null secret); callers that mint tokens guard against null explicitly.
function signingKey(name: 'PREVIEW_SIGNING_KEY' | 'STORE_ACCESS_SIGNING_KEY'): string | null {
  const value = process.env[name];
  if (!value || value.length < 16) {
    warnOnce(`signing-key:${name}`, `${name} is not configured; related storefront access checks will fail closed`);
    return null;
  }
  return value;
}

async function resolveAccess(host: string): Promise<StorefrontAccessResolution> {
  const config = backendConfig();
  if (!config) return { status: 'unavailable' };

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/internal/store-access/resolve?host=${encodeURIComponent(host)}`, {
      headers: config.headers,
      cache: 'no-store',
    });
  } catch (error) {
    warnOnce('store-access-fetch', `storefront access resolution request failed: ${errorMessage(error)}`);
    return { status: 'unavailable' };
  }

  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok) {
    warnOnce('store-access-status', `storefront access resolution returned HTTP ${response.status}`);
    return { status: 'unavailable' };
  }
  const body = await response.json().catch(() => null) as { data?: StorefrontAccessContext } | null;
  return body?.data ? { status: 'ok', site: body.data } : { status: 'not_found' };
}

async function verifyStorePassword(input: { siteId: string; host: string; password: string; ip: string | null }): Promise<boolean> {
  const config = backendConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${config.baseUrl}/v1/internal/store-access/verify`, {
      method: 'POST',
      headers: {
        ...config.headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        site_id: input.siteId,
        host: input.host,
        password: input.password,
        ip: input.ip,
      }),
      cache: 'no-store',
    });
    return response.ok;
  } catch (error) {
    warnOnce('store-access-verify', `storefront password verification request failed: ${errorMessage(error)}`);
    return false;
  }
}

function noIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

// Theme-editor preview cookie (host-only, no domain attribute) for a subdomain.
function applyThemePreviewCookie(response: NextResponse, subdomain: string, token: string): NextResponse {
  if (!token || !subdomain) return response;
  response.cookies.set(getThemePreviewCookieName(subdomain), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/',
  });
  return response;
}

function rewriteToStore(req: NextRequest, subdomain: string, previewMode: boolean): NextResponse {
  const requestHeaders = new Headers(req.headers);
  if (previewMode) requestHeaders.set('x-letbuyy-preview-checkout-mode', 'test');
  const destination = req.nextUrl.clone();
  if (!destination.pathname.startsWith(`/store/${subdomain}`)) {
    destination.pathname = `/store/${subdomain}${destination.pathname}`;
  }
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
}

function holdingPage(req: NextRequest, status: number, reason: string, site?: StorefrontAccessContext): NextResponse {
  const destination = req.nextUrl.clone();
  destination.pathname = '/preview/coming-soon';
  destination.searchParams.set('reason', reason);
  if (site?.access_message) destination.searchParams.set('message', site.access_message);
  return noIndex(NextResponse.rewrite(destination, { status }));
}

async function validPreview(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<{ valid: boolean; token?: string }> {
  const token = req.nextUrl.searchParams.get(LETBUYY_STOREFRONT_PREVIEW_QUERY)
    || req.cookies.get(LETBUYY_STOREFRONT_PREVIEW_COOKIE)?.value;
  const result = await verifyStorefrontPreviewToken(token, signingKey('PREVIEW_SIGNING_KEY'), { expectedHost: host });
  return {
    valid: Boolean(result.valid && result.payload?.sid === site.site_id),
    token: token || undefined,
  };
}

async function validGateCookie(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<boolean> {
  const token = req.cookies.get(LETBUYY_STOREFRONT_GATE_COOKIE)?.value;
  const result = await verifyStorefrontGateToken(token, signingKey('STORE_ACCESS_SIGNING_KEY'), { expectedHost: host });
  return Boolean(result.valid && result.payload?.sid === site.site_id);
}

async function handlePasswordSubmit(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<NextResponse> {
  const body = await req.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) return NextResponse.json({ ok: false, error: 'PASSWORD_REQUIRED' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ok = await verifyStorePassword({ siteId: site.site_id, host, password, ip });
  if (!ok) return NextResponse.json({ ok: false, error: 'INVALID_PASSWORD' }, { status: 401 });

  const accessKey = signingKey('STORE_ACCESS_SIGNING_KEY');
  if (!accessKey) {
    return NextResponse.json({ ok: false, error: 'STORE_ACCESS_UNAVAILABLE' }, { status: 503 });
  }
  const exp = Math.floor(Date.now() / 1000) + LETBUYY_STOREFRONT_GATE_TTL_SECONDS;
  const token = await createStorefrontGateToken({ sid: site.site_id, host, exp }, accessKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LETBUYY_STOREFRONT_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: LETBUYY_STOREFRONT_GATE_TTL_SECONDS,
    path: '/',
  });
  return response;
}

export async function proxy(req: NextRequest) {
  const themePreviewToken = normalizeThemePreviewToken(req.nextUrl.searchParams.get('theme_preview_token'));

  if (req.nextUrl.pathname.startsWith('/preview/coming-soon')) return NextResponse.next();

  const host = normalizeRequestHost(req.headers.get('x-forwarded-host') || req.headers.get('host'));
  if (!host || host.includes('vercel.app')) return NextResponse.next();

  const parsed = resolveStorefrontHost(host, process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
  if (parsed.kind === 'root') return NextResponse.next();
  if (parsed.kind === 'reserved' || parsed.kind === 'invalid') {
    return noIndex(new NextResponse('Store not found', { status: 404 }));
  }

  const resolution = await resolveAccess(host);
  if (resolution.status === 'unavailable') {
    // Store-access backend/config is unavailable. Continue the request instead
    // of 500ing every storefront page; downstream pages surface their own data
    // failures through their error boundaries.
    return NextResponse.next();
  }
  const site = resolution.status === 'ok' ? resolution.site : null;
  if (!site?.subdomain) {
    return noIndex(new NextResponse('Store not found', { status: 404 }));
  }

  if (req.nextUrl.pathname === '/store-access/password' && req.method === 'POST') {
    return handlePasswordSubmit(req, site, host);
  }

  if (
    parsed.kind === 'subdomain'
    && site.access_mode === 'public'
    && site.published
    && site.status === 'published'
    && site.custom_domain_status === 'active'
    && site.custom_domain
  ) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.protocol = 'https:';
    redirectUrl.host = site.custom_domain;
    return NextResponse.redirect(redirectUrl, 301);
  }

  const preview = await validPreview(req, site, host);
  if ((site.access_mode === 'preview_only' || !site.published || site.status !== 'published') && !preview.valid) {
    return holdingPage(req, 401, 'preview-required', site);
  }

  if (site.access_mode === 'offline') {
    return holdingPage(req, 503, 'offline', site);
  }

  if (site.access_mode === 'password' && !preview.valid && !(await validGateCookie(req, site, host))) {
    return holdingPage(req, 401, 'password-required', site);
  }

  const response = rewriteToStore(req, site.subdomain, preview.valid);
  if (preview.valid && preview.token) {
    response.cookies.set(LETBUYY_STOREFRONT_PREVIEW_COOKIE, preview.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60,
      path: '/',
    });
    response.headers.set('x-letbuyy-preview-checkout-mode', 'test');
    noIndex(response);
  }

  return applyThemePreviewCookie(response, site.subdomain, themePreviewToken);
}

export async function createGateCookie(siteId: string, host: string): Promise<{ name: string; value: string; maxAge: number }> {
  const accessKey = signingKey('STORE_ACCESS_SIGNING_KEY');
  if (!accessKey) {
    throw new Error('STORE_ACCESS_SIGNING_KEY is required to create a storefront gate cookie');
  }
  const exp = Math.floor(Date.now() / 1000) + LETBUYY_STOREFRONT_GATE_TTL_SECONDS;
  const value = await createStorefrontGateToken({ sid: siteId, host, exp }, accessKey);
  return { name: LETBUYY_STOREFRONT_GATE_COOKIE, value, maxAge: LETBUYY_STOREFRONT_GATE_TTL_SECONDS };
}
