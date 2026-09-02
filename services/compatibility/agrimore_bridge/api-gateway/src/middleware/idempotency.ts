import { HttpError } from '../runtime/errors';
import type { RedisClient } from '../runtime/redis';
import { withRedisTimeout } from '../runtime/redis';
import type { RequestContext } from '../runtime/types';

export type IdempotencyState =
  | { readonly kind: 'not_configured' }
  | { readonly kind: 'started'; readonly key: string; readonly requestHash: string }
  | { readonly kind: 'replayed'; readonly response: Response };

type StoredIdempotency = {
  readonly status?: string;
  readonly requestHash?: string;
  readonly responseStatus?: string;
  readonly responseBody?: string;
  readonly responseHeaders?: string;
};

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{12,160}$/;
const idempotencyTtlSeconds = 24 * 60 * 60;

export async function enforceIdempotency(
  request: Request,
  redis: RedisClient | null,
  context: RequestContext,
): Promise<IdempotencyState> {
  if (!context.route.policy.requiresIdempotency) {
    return { kind: 'not_configured' };
  }

  const idempotencyKey = request.headers.get('x-idempotency-key')?.trim();
  if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
    throw new HttpError(
      400,
      'request.idempotency_key_required',
      'Mutating routes require a valid x-idempotency-key header.',
    );
  }

  if (!redis) {
    return { kind: 'started', key: idempotencyKey, requestHash: 'redis-disabled' };
  }

  const requestHash = await requestFingerprint(request, context);
  const redisKey = `idem:${context.auth?.userId ?? 'anon'}:${context.route.policy.path}:${idempotencyKey}`;
  const existing = (await withRedisTimeout(redis.hgetall(redisKey))) as StoredIdempotency | null;

  if (existing?.status === 'completed') {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, 'request.idempotency_key_conflict', 'Idempotency key was reused with a different request.');
    }

    return {
      kind: 'replayed',
      response: replayResponse(existing),
    };
  }

  if (existing?.status === 'processing') {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, 'request.idempotency_key_conflict', 'Idempotency key is already processing another request.');
    }

    throw new HttpError(409, 'request.idempotency_in_progress', 'A matching command is still processing.', true);
  }

  await withRedisTimeout(
    redis.hset(redisKey, {
      status: 'processing',
      requestHash,
      traceId: context.ids.traceId,
      createdAt: new Date().toISOString(),
    }),
  );
  await withRedisTimeout(redis.expire(redisKey, idempotencyTtlSeconds));

  return { kind: 'started', key: redisKey, requestHash };
}

export async function completeIdempotency(
  redis: RedisClient | null,
  state: IdempotencyState,
  response: Response,
): Promise<void> {
  if (!redis || state.kind !== 'started' || !state.key.startsWith('idem:')) {
    return;
  }

  const replayable = await serializeResponse(response);
  await withRedisTimeout(
    redis.hset(state.key, {
      status: 'completed',
      requestHash: state.requestHash,
      responseStatus: String(replayable.status),
      responseBody: replayable.body,
      responseHeaders: JSON.stringify(replayable.headers),
      completedAt: new Date().toISOString(),
    }),
  );
  await withRedisTimeout(redis.expire(state.key, idempotencyTtlSeconds));
}

export async function failIdempotency(redis: RedisClient | null, state: IdempotencyState): Promise<void> {
  if (!redis || state.kind !== 'started' || !state.key.startsWith('idem:')) {
    return;
  }

  await withRedisTimeout(
    redis.hset(state.key, {
      status: 'failed',
      requestHash: state.requestHash,
      failedAt: new Date().toISOString(),
    }),
  );
  await withRedisTimeout(redis.expire(state.key, 15 * 60));
}

async function requestFingerprint(request: Request, context: RequestContext): Promise<string> {
  const clone = request.clone();
  const body = await clone.arrayBuffer();
  const encoder = new TextEncoder();
  const routeData = encoder.encode(`${context.route.policy.method}:${context.route.policy.path}:`);
  const input = new Uint8Array(routeData.byteLength + body.byteLength);
  input.set(routeData, 0);
  input.set(new Uint8Array(body), routeData.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function serializeResponse(response: Response): Promise<{
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      headers[key] = value;
    }
  });

  const body = await response.clone().text();
  return { status: response.status, headers, body };
}

function replayResponse(stored: StoredIdempotency): Response {
  const headers = new Headers(JSON.parse(stored.responseHeaders ?? '{}') as Record<string, string>);
  headers.set('x-idempotency-replayed', 'true');
  return new Response(stored.responseBody ?? '{}', {
    status: Number.parseInt(stored.responseStatus ?? '200', 10),
    headers,
  });
}
