import { verifyCloudflareTurnstile } from '@letbuyy/auth-core/turnstile';
import { createLetbuyyInternalSessionHeaders, hmacSha256Hex, sha256Hex, resolveLetbuyyPlatformCookieNames } from '@letbuyy/auth-core';
import { Hono } from 'hono';

export interface Env {
  API_GATEWAY_SERVICE: Fetcher;
  INTERNAL_API_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ENVIRONMENT?: string;
  APP_ENV?: string;
  NODE_ENV?: string;
  DEPLOYMENT_ENV?: string;
  TELEMETRY_ENV?: string;
  RUNTIME_NAME?: string;
  PRIMARY_REGION?: string;
  EDGE_SCOPE?: string;
  RUNTIME_TELEMETRY?: AnalyticsEngineDataset;
}

const app = new Hono<{ Bindings: Env }>();

const VERSIONED_PREFIX = '/v1';
const PLACEHOLDER_PREFIX = 'SKIP_NEEDS_HUMAN_';
const MOBILE_TURNSTILE_PROOF_PREFIX = 'lb-mobile-turnstile-v1';
const MOBILE_TURNSTILE_PROOF_TTL_SECONDS = 2 * 60;
const OPERATIONS_READ_PATHS = new Set([
  '/v1/commerce-analytics/supplier-metrics',
  '/v1/commerce-analytics/warehouse-metrics',
  '/v1/commerce-analytics/transfer-metrics',
  '/v1/commerce-analytics/operations-summary',
]);
const ALLOWED_PREFIXES = [
  '/v1/auth',
  '/v1/mobile',
  '/v1/stores',
  '/v1/products',
  '/v1/orders',
  '/v1/returns',
  '/v1/shipping/labels',
  '/v1/payouts',
  '/v1/wallet',
  '/v1/commission',
  '/v1/cod',
  '/v1/kyc',
  '/v1/2fa',
  '/v1/payments',
  '/v1/upload',
  '/v1/custom',
  '/v1/store-access',
  '/v1/domains',
  '/v1/portfolio',
  '/v1/resume',
  '/v1/employees',
  '/v1/blog',
  '/v1/customers',
  '/v1/notifications',
  '/v1/whatsapp',
  '/v1/marketing',
  '/v1/media',
  '/v1/metafields',
  '/v1/ai',
  '/v1/export',
  '/v1/shipping-tax',
  '/v1/onboarding',
  '/v1/inventory',
  '/v1/coupons',
  '/v1/categories',
  '/v1/analytics',
  '/v1/reviews',
  '/v1/form-submissions',
  '/v1/pages',
  '/v1/themes',
  '/v1/app-store',
  '/v1/app',
  '/v1/graphql/admin',
  '/v1/admin/graphql',
];

type ProviderMode = 'sandbox' | 'live';

type GatewayFanInResult =
  | { ok: true; key: string; data: unknown; providerMode: ProviderMode | null }
  | { ok: false; key: string; status: number; error: unknown };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function healthResponse(env: Env) {
  const secret = env.INTERNAL_API_SECRET;
  const secretConfigured = Boolean(secret && !secret.startsWith(PLACEHOLDER_PREFIX));
  const turnstileConfigured = isConfiguredSecret(env.TURNSTILE_SECRET_KEY);

  return {
    status: secretConfigured ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT,
    version: '1.0.0',
    gateway_binding_configured: Boolean(env.API_GATEWAY_SERVICE),
    internal_session_secret_configured: secretConfigured,
    mobile_turnstile_secret_configured: turnstileConfigured,
  };
}

function isConfiguredSecret(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.startsWith(PLACEHOLDER_PREFIX) && !trimmed.includes('replace-with'));
}

function clientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || null;
}

export interface MobileTurnstileVerificationResult {
  ok: boolean;
  status: 'verified' | 'invalid' | 'unavailable';
  code?: string;
  proofToken?: string;
  proofExpiresAt?: string;
}

function base64UrlEncodeJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createMobileTurnstileProof(input: {
  turnstileToken: string;
  internalSecret: string;
  remoteIp?: string | null;
  nowMs?: number;
}): Promise<{ token: string; expiresAt: string }> {
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const exp = nowSeconds + MOBILE_TURNSTILE_PROOF_TTL_SECONDS;
  const payload = {
    type: 'letbuyy.mobile_turnstile_proof',
    source: 'mobile-bff',
    provider: 'cloudflare_turnstile',
    status: 'verified',
    token_hash: await sha256Hex(input.turnstileToken),
    remote_ip_hash: input.remoteIp ? await sha256Hex(input.remoteIp) : null,
    iat: nowSeconds,
    exp,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = await hmacSha256Hex(input.internalSecret, `${MOBILE_TURNSTILE_PROOF_PREFIX}.${encodedPayload}`);
  return {
    token: `${MOBILE_TURNSTILE_PROOF_PREFIX}.${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function verifyMobileTurnstileToken(input: {
  token: string;
  env: Pick<Env, 'TURNSTILE_SECRET_KEY' | 'INTERNAL_API_SECRET'>;
  remoteIp?: string | null;
  fetcher?: typeof fetch;
}): Promise<MobileTurnstileVerificationResult> {
  const token = input.token.trim();
  if (!token || token.startsWith(PLACEHOLDER_PREFIX)) {
    return { ok: false, status: 'invalid', code: 'TURNSTILE_TOKEN_REQUIRED' };
  }

  const secret = input.env.TURNSTILE_SECRET_KEY;
  if (!isConfiguredSecret(secret)) {
    return { ok: false, status: 'unavailable', code: 'TURNSTILE_NOT_CONFIGURED' };
  }

  const verification = await verifyCloudflareTurnstile({
    secret, token, remoteIp: input.remoteIp || undefined, fetcher: input.fetcher,
  });
  if (!verification.success && verification.reason === 'unavailable') {
    return { ok: false, status: 'unavailable', code: 'TURNSTILE_PROVIDER_UNAVAILABLE' };
  }
  if (verification.success) {
    const internalSecret = input.env.INTERNAL_API_SECRET;
    if (!isConfiguredSecret(internalSecret)) {
      return { ok: false, status: 'unavailable', code: 'TURNSTILE_PROOF_SECRET_NOT_CONFIGURED' };
    }
    const proof = await createMobileTurnstileProof({
      turnstileToken: token,
      internalSecret: internalSecret!.trim(),
      remoteIp: input.remoteIp,
    });
    return {
      ok: true,
      status: 'verified',
      proofToken: proof.token,
      proofExpiresAt: proof.expiresAt,
    };
  }
  return {
    ok: false,
    status: 'invalid',
    code: 'TURNSTILE_INVALID',
  };
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) return rawValue.join('=');
  }

  return null;
}

export function extractMobileSessionToken(request: Request, env?: Pick<Env, 'ENVIRONMENT'>): string | null {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }

  const explicitHeader = request.headers.get('X-LetBuyy-Session-Token');
  if (explicitHeader?.trim()) return explicitHeader.trim();

  return parseCookie(request.headers.get('Cookie'), resolveLetbuyyPlatformCookieNames(env?.ENVIRONMENT).session);
}

function isAllowedPath(pathname: string, method: string): boolean {
  return pathname === '/v1/health'
    || pathname === '/health'
    || pathname === '/v1/loyalty/program'
    || pathname === '/v1/security/step-up/challenges'
    || (method === 'GET' && OPERATIONS_READ_PATHS.has(pathname))
    || ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldRequireSession(pathname: string): boolean {
  if (pathname === '/v1/health' || pathname === '/health') return false;

  // Public auth endpoints can pass through without a merchant session, but
  // session introspection still needs the mobile session token.
  if (pathname.startsWith('/v1/auth/') && pathname !== '/v1/auth/custom/session') {
    return false;
  }

  return true;
}

function gatewayPathFromRequest(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname === '/health') return '/v1/health';
  return url.pathname.startsWith(VERSIONED_PREFIX)
    ? `${url.pathname}${url.search}`
    : `${VERSIONED_PREFIX}${url.pathname}${url.search}`;
}

function buildProxyHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete('Cookie');
  headers.delete('X-LetBuyy-Session-Token');
  headers.delete('Host');
  headers.set('X-Client', 'mobile-bff');
  if (!headers.get('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
  return headers;
}

function buildGatewayUrl(pathname: string, query: Record<string, string | number | undefined>): string {
  const url = new URL(`https://api-gateway.internal${pathname}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function unwrapGatewayPayload(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value) && 'data' in value
    ? (value as { data?: unknown }).data
    : value;
}

function normalizeProviderMode(value: unknown): ProviderMode | null {
  if (value !== 'sandbox' && value !== 'live' && value !== 'test') return null;
  return value === 'test' ? 'sandbox' : value;
}

function providerModeFromPayload(value: unknown): ProviderMode | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const direct = normalizeProviderMode(record.provider_mode || record.providerMode);
  if (direct) return direct;
  for (const candidate of ['summary', 'next_payout', 'payment_settings', 'payout_summary']) {
    const nested = providerModeFromPayload(record[candidate]);
    if (nested) return nested;
  }
  return null;
}

async function signHeadersForSession(token: string, env: Env): Promise<Record<string, string> | Response> {
  const secret = env.INTERNAL_API_SECRET;
  if (!secret || secret.startsWith(PLACEHOLDER_PREFIX)) {
    return jsonResponse({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Mobile session service is temporarily unavailable.',
      },
    }, 500);
  }

  const headerPlan = await createLetbuyyInternalSessionHeaders(token, secret);
  if (!headerPlan.ok || !headerPlan.headers) {
    return jsonResponse({
      error: {
        code: 'UNAUTHORIZED',
        message: headerPlan.reason || 'Invalid mobile session token',
      },
    }, 401);
  }

  return headerPlan.headers;
}

async function gatewayJson(
  env: Env,
  key: string,
  pathname: string,
  query: Record<string, string | number | undefined>,
  headers: Headers,
): Promise<GatewayFanInResult> {
  const response = await env.API_GATEWAY_SERVICE.fetch(new Request(buildGatewayUrl(pathname, query), {
    method: 'GET',
    headers,
  }));
  const payload = await response.json().catch(() => null);
  const data = unwrapGatewayPayload(payload);

  if (!response.ok || (payload && typeof payload === 'object' && (payload as { success?: unknown }).success === false)) {
    return { ok: false, key, status: response.status, error: data };
  }

  return { ok: true, key, data, providerMode: providerModeFromPayload(data) };
}

async function mobileDashboard(request: Request, env: Env): Promise<Response> {
  const token = extractMobileSessionToken(request, env);
  if (!token) {
    return jsonResponse({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing mobile session token',
      },
    }, 401);
  }

  const signedHeaders = await signHeadersForSession(token, env);
  if (signedHeaders instanceof Response) return signedHeaders;

  const url = new URL(request.url);
  const storeId = url.searchParams.get('store_id')?.trim();
  const period = url.searchParams.get('period')?.trim() || '30d';
  if (!storeId) {
    return jsonResponse({
      success: false,
      error: {
        code: 'STORE_ID_REQUIRED',
        message: 'store_id is required for the mobile dashboard composite.',
      },
    }, 400);
  }

  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();
  const targets: { key: string; pathname: string; query: Record<string, string | number> }[] = [
    { key: 'analytics_dashboard', pathname: '/v1/analytics/dashboard', query: { store_id: storeId, period } },
    { key: 'analytics_orders', pathname: '/v1/analytics/orders', query: { store_id: storeId } },
    { key: 'analytics_revenue', pathname: '/v1/analytics/revenue', query: { store_id: storeId, period } },
    { key: 'analytics_top_products', pathname: '/v1/analytics/top-products', query: { store_id: storeId, limit: 5 } },
    { key: 'analytics_traffic_sources', pathname: '/v1/analytics/traffic-sources', query: { store_id: storeId, period, limit: 5 } },
    { key: 'payout_summary', pathname: '/v1/payouts/summary', query: { store_id: storeId } },
  ];
  const results = await Promise.all(targets.map(async (target, index): Promise<GatewayFanInResult> => {
    // Gateway consumes each signed envelope once. Correlation can be shared;
    // credentials cannot, including between concurrent requests for one session.
    const envelope = index === 0 ? signedHeaders : await signHeadersForSession(token, env);
    if (envelope instanceof Response) {
      return { ok: false, key: target.key, status: envelope.status, error: await envelope.json().catch(() => null) };
    }
    const headers = new Headers(envelope);
    headers.set('Accept', 'application/json');
    headers.set('X-Client', 'mobile-bff-composite');
    headers.set('X-Request-ID', requestId);
    return gatewayJson(env, target.key, target.pathname, target.query, headers);
  }));

  const failures = results.filter((result): result is Extract<GatewayFanInResult, { ok: false }> => !result.ok);
  const dataByKey = Object.fromEntries(
    results
      .filter((result): result is Extract<GatewayFanInResult, { ok: true }> => result.ok)
      .map((result) => [result.key, result.data]),
  );

  if (failures.length === results.length) {
    return jsonResponse({
      success: false,
      error: {
        code: 'MOBILE_DASHBOARD_UNAVAILABLE',
        message: 'Mobile dashboard data is temporarily unavailable.',
        details: failures,
      },
    }, 502);
  }

  const providerMode = results
    .filter((result): result is Extract<GatewayFanInResult, { ok: true }> => result.ok)
    .map((result) => result.providerMode)
    .find(Boolean) || null;

  return jsonResponse({
    success: true,
    data: {
      store_id: storeId,
      period,
      provider_mode: providerMode,
      analytics: {
        dashboard: dataByKey.analytics_dashboard || null,
        order_breakdown: dataByKey.analytics_orders || null,
        revenue: dataByKey.analytics_revenue || null,
        top_products: dataByKey.analytics_top_products || [],
        traffic_sources: dataByKey.analytics_traffic_sources || null,
      },
      payout_summary: dataByKey.payout_summary || null,
      partial_errors: failures,
    },
  }, failures.length > 0 ? 207 : 200);
}

async function proxyToGateway(request: Request, env: Env): Promise<Response> {
  const sourceUrl = new URL(request.url);
  const pathname = sourceUrl.pathname === '/health' ? '/v1/health' : sourceUrl.pathname;

  if (!isAllowedPath(pathname, request.method)) {
    return jsonResponse({
      error: {
        code: 'MOBILE_BFF_ROUTE_NOT_ALLOWED',
        message: 'This mobile route is not allow-listed for BFF proxying.',
      },
    }, 404);
  }

  const headers = buildProxyHeaders(request);
  if (shouldRequireSession(pathname)) {
    const token = extractMobileSessionToken(request, env);
    if (!token) {
      return jsonResponse({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing mobile session token',
        },
      }, 401);
    }

    const signedHeaders = await signHeadersForSession(token, env);
    if (signedHeaders instanceof Response) return signedHeaders;
    headers.delete('Authorization');
    Object.entries(signedHeaders).forEach(([key, value]) => headers.set(key, value));
  }

  const gatewayOrigin = env.API_GATEWAY_SERVICE ? 'https://api-gateway.internal' : 'http://localhost:9010';
  // Clone the incoming Request to preserve its stream/platform body metadata
  // when rewriting the destination. Then replace headers with the sanitized,
  // translated credentials; never reattach the mobile Bearer/cookie headers.
  const gatewayRequest = new Request(
    new Request(`${gatewayOrigin}${gatewayPathFromRequest(request)}`, request),
    { headers },
  );

  if (env.API_GATEWAY_SERVICE) {
    return env.API_GATEWAY_SERVICE.fetch(gatewayRequest);
  }

  return fetch(gatewayRequest);
}

app.get('/health', (c) => jsonResponse(healthResponse(c.env), healthResponse(c.env).status === 'healthy' ? 200 : 503));
app.get('/v1/health', (c) => jsonResponse(healthResponse(c.env), healthResponse(c.env).status === 'healthy' ? 200 : 503));
app.get('/v1/mobile/dashboard', (c) => mobileDashboard(c.req.raw, c.env));
app.post('/v1/auth/mobile/turnstile/verify', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  const result = await verifyMobileTurnstileToken({
    token,
    env: c.env,
    remoteIp: clientIp(c.req.raw),
  });

  if (result.ok) {
    return c.json({
      success: true,
      verification: {
        provider: 'cloudflare_turnstile',
        status: result.status,
        proof_token: result.proofToken,
        proof_expires_at: result.proofExpiresAt,
      },
    });
  }

  const status = result.status === 'unavailable' ? 503 : 403;
  return c.json({
    success: false,
    error: {
      code: result.code || 'TURNSTILE_VERIFICATION_FAILED',
      message: result.status === 'unavailable'
        ? 'Mobile verification is temporarily unavailable.'
        : 'Mobile verification failed.',
    },
  }, status);
});
app.all('/v1/*', (c) => proxyToGateway(c.req.raw, c.env));
app.all('*', (c) => proxyToGateway(c.req.raw, c.env));

export default app;
