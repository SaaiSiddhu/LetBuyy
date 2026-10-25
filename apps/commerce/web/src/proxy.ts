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
  isHostedCheckoutHost,
  resolveStorefrontHost,
} from '@letbuyy/tenant-core';
import { getThemePreviewCookieName, normalizeThemePreviewToken } from './lib/theme-preview-cookie';
import { readStorefrontApiBaseUrl } from './lib/api/base-url';

// Mirrors the sites_access_mode_check CHECK constraint, which is the upstream source of truth.
const STOREFRONT_ACCESS_MODES = ['public', 'password', 'preview_only', 'offline'] as const;

type StorefrontAccessMode = typeof STOREFRONT_ACCESS_MODES[number];

interface StorefrontAccessContext {
  site_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_status: string;
  access_mode: StorefrontAccessMode;
  access_message: string | null;
  access_revision?: string | null;
  visitor_access?: {preview:boolean;password:boolean};
  published: boolean;
  status: string;
  // Multi-domain (migration 185): set when the request host is a connected
  // secondary/redirect domain that should 301 to the store's primary host.
  matched_domain_role?: 'primary' | 'redirect' | null;
  redirect_to?: string | null;
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

function isStorefrontAccessMode(value: unknown): value is StorefrontAccessMode {
  return typeof value === 'string' && (STOREFRONT_ACCESS_MODES as readonly string[]).includes(value);
}

export const config = {
  // These are public first-party files, including on merchant/custom hosts.
  // Keep nested storefront routes gated even when their last segment has a suffix.
  matcher: ['/((?!api/|_next/|_static/|_vercel/|theme-assets/|theme-previews/|[\\w-]+\\.\\w+).*)'],
};

function gatewayBaseUrl(): string | null {
  const value = readStorefrontApiBaseUrl();
  if (!value) {
    warnOnce('gateway-base-url', 'LETBUYY_API_BASE_URL/NEXT_PUBLIC_API_URL is not set; storefront access cannot be resolved and every storefront request will be denied');
    return null;
  }
  return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function internalHeaders(): Record<string, string> | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    warnOnce('internal-api-secret', 'INTERNAL_API_SECRET is not set; storefront access cannot be resolved and every storefront request will be denied');
    return null;
  }
  return { 'x-internal-api-secret': secret };
}

// Backend config needed to call the store-access API. Returns null (instead of
// throwing) when an env var is missing so each caller can take its own
// fail-closed path; every caller treats null as "cannot verify" and denies
// rather than admitting the request (SEC-R1).
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

// This middleware runs in front of every storefront request, and an unresolved access check denies
// rather than falls through, so a gateway that accepts the connection and then hangs would stall the
// whole storefront instead of degrading to the holding page. Both store-access calls are bounded; the
// abort surfaces as a rejected fetch, which takes the existing fail-closed path (SEC-R1).
const STORE_ACCESS_TIMEOUT_MS = 3000;

async function resolveAccess(host: string, req: NextRequest): Promise<StorefrontAccessResolution> {
  const config = backendConfig();
  if (!config) return { status: 'unavailable' };

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/internal/store-access/resolve?host=${encodeURIComponent(host)}`, {
      headers: {...config.headers,
        ...(req.cookies.get(LETBUYY_STOREFRONT_GATE_COOKIE)?.value?{'X-LetBuyy-Storefront-Gate':req.cookies.get(LETBUYY_STOREFRONT_GATE_COOKIE)!.value}:{}),
        ...((req.nextUrl.searchParams.get(LETBUYY_STOREFRONT_PREVIEW_QUERY)||req.cookies.get(LETBUYY_STOREFRONT_PREVIEW_COOKIE)?.value)?{'X-LetBuyy-Storefront-Preview':(req.nextUrl.searchParams.get(LETBUYY_STOREFRONT_PREVIEW_QUERY)||req.cookies.get(LETBUYY_STOREFRONT_PREVIEW_COOKIE)!.value)}:{})},
      cache: 'no-store',
      signal: AbortSignal.timeout(STORE_ACCESS_TIMEOUT_MS),
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
  if (!body?.data) return { status: 'not_found' };
  // access_mode arrives as unvalidated JSON. A mode this build has no gate branch for must not fall
  // through to a public render, so an unsupported value counts as unresolved, not as allowed.
  if (!isStorefrontAccessMode(body.data.access_mode)) {
    warnOnce('store-access-mode', `storefront access resolution returned an unsupported access_mode: ${String(body.data.access_mode)}`);
    return { status: 'unavailable' };
  }
  return { status: 'ok', site: body.data };
}

async function verifyStorePassword(input: { siteId: string; host: string; password: string; ip: string | null }): Promise<{ok:boolean;revision?:string;status:number}> {
  const config = backendConfig();
  if (!config) return {ok:false,status:503};
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
      signal: AbortSignal.timeout(STORE_ACCESS_TIMEOUT_MS),
    });
    const body=await response.json().catch(()=>null);
    const revision=body?.data?.access_revision;
    return {ok:response.ok&&typeof revision==='string'&&/^[a-f0-9]{64}$/.test(revision),revision,status:response.status};
  } catch (error) {
    warnOnce('store-access-verify', `storefront password verification request failed: ${errorMessage(error)}`);
    return {ok:false,status:503};
  }
}

function noIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

function storeNotFound(): NextResponse {
  return noIndex(new NextResponse('Store not found', { status: 404 }));
}

// Vercel deployment hostnames (`<project>-<hash>.vercel.app`, plus branch/preview URLs). Matched by
// exact suffix rather than `includes('vercel.app')`, which would also match a merchant custom domain
// that merely contains the string (e.g. `my-vercel.applications.in`) and hand it the bypass below.
function isVercelDeploymentHost(host: string): boolean {
  return host === 'vercel.app' || host.endsWith('.vercel.app');
}

// `/store/<subdomain>` is the internal rewrite target of rewriteToStore. Reached as a URL instead of
// as a rewrite it skips the whole access gate, so it is only ever legitimate host-routed.
function isInternalStorePath(pathname: string): boolean {
  return pathname === '/store' || pathname.startsWith('/store/');
}

// T6/W2 — `/checkout-origin` is the internal rewrite target for the checkout.<root> host (see
// rewriteToCheckoutOrigin below). Reached as a URL directly it would skip host-based tenant
// resolution — the checkout tree resolves its tenant from the signed handoff query params, not
// from a path segment, so nothing here needs a subdomain name, but the path itself must still
// only ever be reachable via the checkout host, matching /store/<subdomain>'s own protection.
function isInternalCheckoutOriginPath(pathname: string): boolean {
  return pathname === '/checkout-origin' || pathname.startsWith('/checkout-origin/');
}

// True when `host` is the checkout-only origin (checkout.<root> or checkout-staging.<root> —
// both reserved in RESERVED_STOREFRONT_LABELS, packages/tenant-core/src/index.ts). Compares the
// label resolveStorefrontHost already extracted rather than re-deriving it, so this can never
// disagree with the reserved-label check immediately below.
function isCheckoutOriginHost(resolution: { kind: string; host: string; rootDomain: string | null }): boolean {
  return isHostedCheckoutHost(resolution.host, {
    checkoutOrigin: process.env.CHECKOUT_ORIGIN,
    storeRootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
  });
}

// checkout.<root> never rewrites into /store/<subdomain> — the checkout tree resolves its
// tenant from the verified handoff (site_id in the query string), never from the Host header,
// so it must not inherit any tenant-specific state (theme CSS, store layout, a subdomain path
// segment). This preserves every query param (site_id/cart_id/cart_token/expires_at/
// cart_digest/signature/channel) verbatim; the destination route re-verifies them itself.
function rewriteToCheckoutOrigin(req: NextRequest): NextResponse {
  const destination = req.nextUrl.clone();
  if (!isInternalCheckoutOriginPath(destination.pathname)) {
    destination.pathname = `/checkout-origin${destination.pathname}`;
  }
  return noIndex(NextResponse.rewrite(destination));
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

// Canary render-engine attribution deliberately does NOT live here. The engine is decided per
// theme/store downstream (resolveThemeLiquidRenderingEnabled, read by the template resolver), which
// is strictly after this rewrite, so any header set here can only be a guess. The removed
// X-Lb-Render-Engine header was derived from `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED` —
// a name declared in no env file, vercel.json, wrangler.toml or workflow, and never read by the
// renderer — so it reported 'react' on every response including genuine Liquid renders. A fabricated
// telemetry value is worse than none (ANTI-R9); the composition engine's `lb:canary:render` event
// already carries the real per-render engine.
function rewriteToStore(req: NextRequest, subdomain: string, previewMode: boolean, previewToken?:string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete('X-LetBuyy-Storefront-Preview');
  if (previewMode) {requestHeaders.set('x-letbuyy-preview-checkout-mode', 'test');if(previewToken)requestHeaders.set('X-LetBuyy-Storefront-Preview',previewToken);}
  const destination = req.nextUrl.clone();
  // Prefix unless the path already is this store's own tree. The match has to land on a path segment
  // boundary: a bare startsWith also accepts `/store/<subdomain>x`, a *different* tenant's tree, and
  // would pass it through unprefixed — rendering that tenant behind this store's access gate (ART-08).
  const storeRoot = `/store/${subdomain}`;
  if (destination.pathname !== storeRoot && !destination.pathname.startsWith(`${storeRoot}/`)) {
    destination.pathname = `/store/${subdomain}${destination.pathname}`;
  }
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
}

function holdingPage(req: NextRequest, status: number, reason: string, site?: StorefrontAccessContext): NextResponse {
  const destination = req.nextUrl.clone();
  destination.pathname = '/preview/coming-soon';
  destination.searchParams.set('reason', reason);
  if (site?.subdomain) destination.searchParams.set('store', site.subdomain);
  if (site?.access_message) destination.searchParams.set('message', site.access_message);
  return noIndex(NextResponse.rewrite(destination, { status }));
}

async function validPreview(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<{ valid: boolean; token?: string }> {
  const token = req.nextUrl.searchParams.get(LETBUYY_STOREFRONT_PREVIEW_QUERY)
    || req.cookies.get(LETBUYY_STOREFRONT_PREVIEW_COOKIE)?.value;
  const result = await verifyStorefrontPreviewToken(token, signingKey('PREVIEW_SIGNING_KEY'), { expectedHost: host });
  return {
    valid: Boolean(result.valid && result.payload?.sid === site.site_id && site.visitor_access?.preview === true),
    token: token || undefined,
  };
}

async function validGateCookie(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<boolean> {
  const token = req.cookies.get(LETBUYY_STOREFRONT_GATE_COOKIE)?.value;
  const result = await verifyStorefrontGateToken(token, signingKey('STORE_ACCESS_SIGNING_KEY'), { expectedHost: host });
  if (!result.valid || result.payload?.sid !== site.site_id) return false;
  // MEDIUM fix: a valid gate cookie may survive a merchant switching access_mode away from 'password'.
  // The token's exp guards the maximum staleness window (LETBUYY_STOREFRONT_GATE_TTL_SECONDS), but
  // a store that moves to 'preview_only' or 'offline' within that window must NOT be admitted by the
  // gate cookie. resolveAccess is already cache:no-store on every request, so this check adds no
  // extra latency; it simply validates that the current resolved access_mode is still 'password'
  // before honouring the stored gate.
  return site.access_mode === 'password' && site.visitor_access?.password === true && Boolean(site.access_revision) && result.payload.revision === site.access_revision;
}

// The Liquid contact-form.liquid section is a plain HTML form posting to this exact pathname (see
// contact/page.tsx for why the POST can't be a Next route.ts at the same segment). Proxies to the
// EXISTING public gateway endpoint (POST /v1/contacts, contacts.ts — already tenant-scoped by
// store_id, no DB write happens in this app) and redirects back to the page with a status flag.
// Placed AFTER the access-mode gates in proxy(), so it is only reachable on a store a visitor has
// already legitimately reached — an offline/preview-only/password-locked store never exposes it.
async function handleContactSubmit(req: NextRequest, site: StorefrontAccessContext): Promise<NextResponse> {
    let name = '';
    let email = '';
    let phone = '';
    try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.startsWith('application/x-www-form-urlencoded') || contentType.startsWith('multipart/form-data')) {
            const fd = await req.formData();
            name = typeof fd.get('name') === 'string' ? String(fd.get('name')) : '';
            email = typeof fd.get('email') === 'string' ? String(fd.get('email')) : '';
            phone = typeof fd.get('phone') === 'string' ? String(fd.get('phone')) : '';
        } else {
            const body = await req.json().catch(() => null) as { name?: unknown; email?: unknown; phone?: unknown } | null;
            name = typeof body?.name === 'string' ? body.name : '';
            email = typeof body?.email === 'string' ? body.email : '';
            phone = typeof body?.phone === 'string' ? body.phone : '';
        }
    } catch {
        // Both parse paths threw — fields stay '' → validation below redirects with an error flag.
    }

    const redirectWithStatus = (status: 'sent' | 'error') => {
        const destination = req.nextUrl.clone();
        destination.pathname = '/contact';
        destination.search = '';
        destination.searchParams.set('contact', status);
        return NextResponse.redirect(destination, 303);
    };

    if (!name || (!email && !phone)) return redirectWithStatus('error');

    const base = gatewayBaseUrl();
    if (!base) return redirectWithStatus('error');

    try {
        const response = await fetch(`${base}/v1/contacts`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ store_id: site.site_id, name, email: email || undefined, phone: phone || undefined }),
            signal: AbortSignal.timeout(STORE_ACCESS_TIMEOUT_MS),
        });
        return redirectWithStatus(response.ok ? 'sent' : 'error');
    } catch {
        return redirectWithStatus('error');
    }
}

async function handlePasswordSubmit(req: NextRequest, site: StorefrontAccessContext, host: string): Promise<NextResponse> {
  // F6 — Dual content-type parsing following the D10 pattern.
  // The E5 Liquid password-gate form posts application/x-www-form-urlencoded; the existing
  // JSON path handles fetch()-based submissions. Both are accepted. Fail-closed: if both
  // parse paths throw (malformed body), password remains '' and the 400 below fires.
  let password = '';
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      const fd = await req.formData();
      const raw = fd.get('password');
      password = typeof raw === 'string' ? raw : '';
    } else {
      const body = await req.json().catch(() => null) as { password?: unknown } | null;
      password = typeof body?.password === 'string' ? body.password : '';
    }
  } catch {
    // Both parse paths threw — password stays '' → 400 below (fail-closed).
  }
  if (!password) return NextResponse.json({ ok: false, error: 'PASSWORD_REQUIRED' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const verification = await verifyStorePassword({ siteId: site.site_id, host, password, ip });
  if (!verification.ok) return NextResponse.json({ ok: false, error: verification.status===429?'STORE_ACCESS_THROTTLED':verification.status>=500||verification.status===200?'STORE_ACCESS_UNAVAILABLE':'INVALID_PASSWORD' }, { status: verification.status===429?429:verification.status>=500||verification.status===200?503:401 });

  const accessKey = signingKey('STORE_ACCESS_SIGNING_KEY');
  if (!accessKey) {
    return NextResponse.json({ ok: false, error: 'STORE_ACCESS_UNAVAILABLE' }, { status: 503 });
  }
  const exp = Math.floor(Date.now() / 1000) + LETBUYY_STOREFRONT_GATE_TTL_SECONDS;
  const token = await createStorefrontGateToken({ sid: site.site_id, host, exp,revision:verification.revision }, accessKey);
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
  // No usable Host means no tenant to resolve, which is the same position as an invalid host below.
  if (!host) return storeNotFound();

  // A deployment hostname carries no tenant mapping — it can never resolve to a store — so the
  // platform's own pages stay reachable for deploy smoke checks. The internal `/store/<subdomain>`
  // tree is denied here: it is directly addressable and ungated, so serving it on a preview
  // deployment would expose every password / preview_only / offline storefront (SEC-R1).
  // `/preview` only looks like a tenant-free platform page: it names its store in `?subdomain=`, so
  // no host-derived gate can cover it on a hostname that maps to no tenant. It is gated at its own
  // call site (`src/app/preview/page.tsx`), which loads a store solely against a theme preview
  // session token minted for that store.
  if (isVercelDeploymentHost(host)) {
    return isInternalStorePath(req.nextUrl.pathname) || isInternalCheckoutOriginPath(req.nextUrl.pathname)
      ? storeNotFound()
      : NextResponse.next();
  }

  const parsed = resolveStorefrontHost(
    host,
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES,
  );

  // T6/W2 — checkout.<root> (and its staging variant) is a reserved label (never a merchant
  // subdomain — see RESERVED_STOREFRONT_LABELS), so it falls into `kind:'reserved'` below.
  // Intercept it here, before the generic reserved-host 404, and route it to the checkout tree
  // instead. The checkout tree resolves its own tenant from the verified handoff in the query
  // string — this branch never touches `resolveAccess`/the site-access gate below, on purpose:
  // that gate is keyed by Host, and the checkout host maps to no single site.
  if (isCheckoutOriginHost(parsed)) {
    return rewriteToCheckoutOrigin(req);
  }

  if (isInternalCheckoutOriginPath(req.nextUrl.pathname)) {
    // Reached directly (not via the checkout host) — deny, matching /store/<subdomain>'s own
    // protection against being addressed directly instead of through host-based rewriting.
    return storeNotFound();
  }

  if (parsed.kind === 'reserved' || parsed.kind === 'invalid') {
    return storeNotFound();
  }

  // Which host the tenant is resolved against, and which host the preview/gate tokens are bound to.
  // For a storefront host that is the request host; the platform root is the one case where the two
  // differ, because the root host maps to no tenant at all.
  let accessHost = host;
  if (parsed.kind === 'root') {
    // The platform's own root pages (landing, the holding page) carry no tenant, so they stay
    // ungated as before; `/preview` is host-agnostic but not tenant-free, and is gated at its own
    // call site (`src/app/preview/page.tsx`) against a theme preview session token for the store it
    // names in `?subdomain=`. `/store/<subdomain>` is the exception here: it is the internal rewrite
    // target, it names its tenant in the path, and the store layout below only gates on status —
    // never on access_mode — so letting it through serves a gated storefront in full. Resolve
    // the named store's own host instead and let the same gate decide (SEC-R1). Unlocking a password
    // store still has to happen on that store's host: the submit route carries no subdomain, so there
    // is nothing to gate a root-domain submission against.
    if (!isInternalStorePath(req.nextUrl.pathname)) return NextResponse.next();
    const requestedSubdomain = req.nextUrl.pathname.split('/')[2];
    if (!requestedSubdomain) return storeNotFound();
    // Build against the canonical root domain, not the request host: `host` here may be a
    // root-domain alias (e.g. a LAN IP) the backend's own tenant resolver has never heard of,
    // and `subdomain.<alias>` would resolve as an unknown custom domain instead of a subdomain.
    accessHost = `${requestedSubdomain}.${parsed.rootDomain || host}`;
  }

  const resolution = await resolveAccess(accessHost,req);
  if (resolution.status === 'unavailable') {
    // SEC-R1 / ART-08: resolution IS the access gate. "Unavailable" (missing INTERNAL_API_SECRET or
    // API base URL, gateway error, timeout) means we do not know whether this store is public,
    // password-gated, preview_only, or offline — it is not evidence that the store is public.
    // Continuing would disable the gate for every store for the whole outage, so deny instead; only
    // a resolved `ok` site below can open a storefront.
    return holdingPage(req, 503, 'access-unavailable');
  }
  const site = resolution.status === 'ok' ? resolution.site : null;
  if (!site?.subdomain) {
    return storeNotFound();
  }

  // Multi-domain (185): a connected *redirect* domain 301s to the store's primary host.
  // Only fires when the resolver matched a site_domains redirect row, so primary-domain
  // and subdomain traffic is unaffected.
  if (parsed.kind === 'custom_domain' && site.matched_domain_role === 'redirect') {
    const target = normalizeRequestHost(site.redirect_to || site.custom_domain || '');
    if (target && target !== host) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.protocol = 'https:';
      redirectUrl.host = target;
      return NextResponse.redirect(redirectUrl, 301);
    }
  }

  if (req.nextUrl.pathname === '/store-access/password' && req.method === 'POST') {
    return handlePasswordSubmit(req, site, accessHost);
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

  const preview = await validPreview(req, site, accessHost);
  if(req.nextUrl.searchParams.has(LETBUYY_STOREFRONT_PREVIEW_QUERY)&&!preview.valid)return holdingPage(req,401,'preview-required',site);
  if ((site.access_mode === 'preview_only' || !site.published || site.status !== 'published') && !preview.valid) {
    return holdingPage(req, 401, 'preview-required', site);
  }

  if (site.access_mode === 'offline') {
    return holdingPage(req, 503, 'offline', site);
  }

  if (site.access_mode === 'password' && !preview.valid && !(await validGateCookie(req, site, accessHost))) {
    return holdingPage(req, 401, 'password-required', site);
  }

  if (req.nextUrl.pathname === '/contact' && req.method === 'POST') {
    return handleContactSubmit(req, site);
  }

  const response = rewriteToStore(req, site.subdomain, preview.valid,preview.token);
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
  } else if (req.cookies.has(LETBUYY_STOREFRONT_PREVIEW_COOKIE)) {
    // A retired share-link cookie must not strand a now-public shopper in the
    // checkout BFF's deliberate preview refusal after normal browsing recovers.
    response.cookies.set(LETBUYY_STOREFRONT_PREVIEW_COOKIE, '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/',
    });
  }

  return applyThemePreviewCookie(response, site.subdomain, themePreviewToken);
}

export async function createGateCookie(siteId: string, host: string, revision?:string): Promise<{ name: string; value: string; maxAge: number }> {
  const accessKey = signingKey('STORE_ACCESS_SIGNING_KEY');
  if (!accessKey) {
    throw new Error('STORE_ACCESS_SIGNING_KEY is required to create a storefront gate cookie');
  }
  const exp = Math.floor(Date.now() / 1000) + LETBUYY_STOREFRONT_GATE_TTL_SECONDS;
  if(!revision||!/^[a-f0-9]{64}$/.test(revision))throw new Error('Current password revision is required for a storefront gate cookie');
  const value = await createStorefrontGateToken({ sid: siteId, host, exp,revision }, accessKey);
  return { name: LETBUYY_STOREFRONT_GATE_COOKIE, value, maxAge: LETBUYY_STOREFRONT_GATE_TTL_SECONDS };
}
