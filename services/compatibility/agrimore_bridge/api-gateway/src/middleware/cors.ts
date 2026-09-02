import { HttpError } from '../runtime/errors';
import type { Env, RoutePolicy } from '../runtime/types';

const productionAllowedOrigins = ['https://agrimore.in', 'https://admin.agrimore.in'];
const developmentAllowedOrigins = ['http://localhost:3000'];

export function getAllowedOrigins(env: Env): readonly string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configured?.length ? configured : productionAllowedOrigins;
  if (env.APP_ENV === 'development' || env.APP_ENV === 'local') {
    return [...new Set([...origins, ...developmentAllowedOrigins])];
  }
  return origins;
}

export function enforceCors(request: Request, env: Env, policy: RoutePolicy): string | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }

  if (!policy.allowCors) {
    throw new HttpError(403, 'cors.forbidden', 'CORS is not allowed for this route.');
  }

  if (!getAllowedOrigins(env).includes(origin)) {
    throw new HttpError(403, 'cors.origin_denied', 'Request origin is not allowed.');
  }

  return origin;
}

export function preflightResponse(request: Request, env: Env): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers();
  if (origin && getAllowedOrigins(env).includes(origin)) {
    headers.set('access-control-allow-origin', origin);
  }
  headers.set('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    [
      'authorization',
      'content-type',
      'x-app-version',
      'x-correlation-id',
      'x-device-id',
      'x-idempotency-key',
      'x-platform',
      'x-request-id',
      'x-trace-id',
    ].join(', '),
  );
  headers.set('access-control-max-age', '600');
  return new Response(null, { status: 204, headers });
}

export function applyCors(response: Response, origin: string | null): Response {
  if (!origin) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', appendVary(headers.get('vary'), 'Origin'));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendVary(current: string | null, value: string): string {
  if (!current) {
    return value;
  }
  const parts = current.split(',').map((part) => part.trim().toLowerCase());
  return parts.includes(value.toLowerCase()) ? current : `${current}, ${value}`;
}
