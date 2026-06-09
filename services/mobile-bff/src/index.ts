import { createLetbuyyInternalSessionHeaders } from '@letbuyy/auth-core';
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
  FAILOVER_REGION?: string;
  RUNTIME_TELEMETRY?: AnalyticsEngineDataset;
}

const app = new Hono<{ Bindings: Env }>();

const VERSIONED_PREFIX = '/v1';
const SESSION_COOKIE_NAME = 'lb_session';
const PLACEHOLDER_PREFIX = 'SKIP_NEEDS_HUMAN_';
const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_PREFIXES = [
  '/v1/auth',
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
}

export async function verifyMobileTurnstileToken(input: {
  token: string;
  env: Pick<Env, 'TURNSTILE_SECRET_KEY'>;
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

  const body = new URLSearchParams({
    secret: secret!.trim(),
    response: token,
  });
  if (input.remoteIp) body.set('remoteip', input.remoteIp);

  const response = await (input.fetcher || fetch)(TURNSTILE_SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    return { ok: false, status: 'unavailable', code: 'TURNSTILE_PROVIDER_UNAVAILABLE' };
  }

  const payload = await response.json().catch(() => null) as { success?: boolean; 'error-codes'?: string[] } | null;
  if (payload?.success === true) return { ok: true, status: 'verified' };
  return {
    ok: false,
    status: 'invalid',
    code: payload?.['error-codes']?.[0] || 'TURNSTILE_INVALID',
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

export function extractMobileSessionToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }

  const explicitHeader = request.headers.get('X-LetBuyy-Session-Token');
  if (explicitHeader?.trim()) return explicitHeader.trim();

  return parseCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
}

function isAllowedPath(pathname: string): boolean {
  return pathname === '/v1/health'
    || pathname === '/health'
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
  headers.delete('Authorization');
  headers.delete('Cookie');
  headers.delete('X-LetBuyy-Session-Token');
  headers.delete('Host');
  headers.set('X-Client', 'mobile-bff');
  if (!headers.get('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID());
  return headers;
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

async function proxyToGateway(request: Request, env: Env): Promise<Response> {
  const sourceUrl = new URL(request.url);
  const pathname = sourceUrl.pathname === '/health' ? '/v1/health' : sourceUrl.pathname;

  if (!isAllowedPath(pathname)) {
    return jsonResponse({
      error: {
        code: 'MOBILE_BFF_ROUTE_NOT_ALLOWED',
        message: 'This mobile route is not allow-listed for BFF proxying.',
      },
    }, 404);
  }

  const headers = buildProxyHeaders(request);
  if (shouldRequireSession(pathname)) {
    const token = extractMobileSessionToken(request);
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
    Object.entries(signedHeaders).forEach(([key, value]) => headers.set(key, value));
  }

  const gatewayRequest = new Request(`https://api-gateway.internal${gatewayPathFromRequest(request)}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  return env.API_GATEWAY_SERVICE.fetch(gatewayRequest);
}

app.get('/health', (c) => jsonResponse(healthResponse(c.env), healthResponse(c.env).status === 'healthy' ? 200 : 503));
app.get('/v1/health', (c) => jsonResponse(healthResponse(c.env), healthResponse(c.env).status === 'healthy' ? 200 : 503));
app.post('/v1/auth/mobile/turnstile/verify', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token : '';
  const result = await verifyMobileTurnstileToken({
    token,
    env: c.env,
    remoteIp: clientIp(c.req.raw),
  });

  if (result.ok) {
    return c.json({ success: true, verification: { provider: 'cloudflare_turnstile', status: result.status } });
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
