import type { JsonRecord, RequestIds } from './types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details: JsonRecord = {},
  ) {
    super(message);
  }
}

export function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

export function errorResponse(error: unknown, ids: RequestIds): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        success: false,
        traceId: ids.traceId,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  return jsonResponse(
    {
      success: false,
      traceId: ids.traceId,
      error: {
        code: 'internal.unknown',
        message: 'Unexpected server error.',
        retryable: true,
      },
    },
    { status: 500 },
  );
}
