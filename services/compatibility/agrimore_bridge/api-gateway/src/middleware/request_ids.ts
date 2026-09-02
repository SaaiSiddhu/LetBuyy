import type { RequestIds } from '../runtime/types';

const safeHeaderValue = /^[A-Za-z0-9._:/=-]{8,160}$/;

export function getRequestIds(request: Request): RequestIds {
  const requestId = normalizedHeader(request, 'x-request-id') ?? crypto.randomUUID();
  const traceId = normalizedHeader(request, 'x-trace-id') ?? requestId;
  const correlationId = normalizedHeader(request, 'x-correlation-id') ?? traceId;

  return { requestId, traceId, correlationId };
}

export function withTraceHeaders(response: Response, ids: RequestIds): Response {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', ids.requestId);
  headers.set('x-trace-id', ids.traceId);
  headers.set('x-correlation-id', ids.correlationId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function normalizedHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.trim();
  if (!value || !safeHeaderValue.test(value)) {
    return null;
  }
  return value;
}
