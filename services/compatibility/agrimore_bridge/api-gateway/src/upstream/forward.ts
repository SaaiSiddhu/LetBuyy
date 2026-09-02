import type { Env, RequestContext } from '../runtime/types';

export async function forwardToUpstream(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${env.UPSTREAM_BASE_URL.replace(/\/+$/, '')}${context.route.policy.upstreamPath}`);
  incomingUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));
  for (const [key, value] of Object.entries(context.route.params)) {
    upstreamUrl.searchParams.set(key, value);
  }

  const headers = upstreamHeaders(request, context);
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  return fetch(upstreamUrl.toString(), init);
}

function upstreamHeaders(request: Request, context: RequestContext): Headers {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.set('authorization', authorization);
  }

  headers.set('x-request-id', context.ids.requestId);
  headers.set('x-trace-id', context.ids.traceId);
  headers.set('x-correlation-id', context.ids.correlationId);
  headers.set('x-route-owner', context.route.policy.owner);
  headers.set('x-route-pattern', context.route.policy.path);
  headers.set('x-client-ip', context.clientIp);

  const idempotencyKey = request.headers.get('x-idempotency-key');
  if (idempotencyKey) {
    headers.set('x-idempotency-key', idempotencyKey);
  }

  if (context.auth) {
    headers.set('x-auth-user-id', context.auth.userId);
    headers.set('x-auth-roles', context.auth.roles.join(','));
  }

  if (context.deviceId) {
    headers.set('x-device-id', context.deviceId);
  }
  if (context.appVersion) {
    headers.set('x-app-version', context.appVersion);
  }
  if (context.platform) {
    headers.set('x-platform', context.platform);
  }

  return headers;
}
