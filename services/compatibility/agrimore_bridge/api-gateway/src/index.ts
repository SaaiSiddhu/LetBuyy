import { authenticate } from './middleware/auth';
import { enforceBodyLimit } from './middleware/body_limit';
import { applyCacheHeaders, matchEdgeCache, scheduleCacheWrite } from './middleware/cache';
import { applyCors, enforceCors, preflightResponse } from './middleware/cors';
import {
  completeIdempotency,
  enforceIdempotency,
  failIdempotency,
  type IdempotencyState,
} from './middleware/idempotency';
import { enforceRateLimit } from './middleware/rate_limit';
import { handleApiRequest } from './handlers/api';
import { getRequestIds, withTraceHeaders } from './middleware/request_ids';
import { createLogger, requestLogFields } from './observability/logger';
import { enqueuePendingOutbox, handleOutboxQueue, type OutboxQueueMessage } from './outbox/relay';
import { errorResponse, HttpError, jsonResponse } from './runtime/errors';
import { createRedis } from './runtime/redis';
import type { Env, RequestContext } from './runtime/types';
import { findRoutePolicy, isKnownPath } from './routes';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ids = getRequestIds(request);
    const logger = createLogger({
      service: 'api-gateway',
      environment: env.APP_ENV,
      requestId: ids.requestId,
      traceId: ids.traceId,
    });
    const startedAt = Date.now();
    let context: RequestContext | null = null;
    let idempotencyState: IdempotencyState = { kind: 'not_configured' };
    let corsOrigin: string | null = null;

    try {
      if (request.method === 'OPTIONS') {
        return withTraceHeaders(preflightResponse(request, env), ids);
      }

      const url = new URL(request.url);
      const route = findRoutePolicy(request.method, url.pathname);
      if (!route) {
        throw new HttpError(
          isKnownPath(url.pathname) ? 405 : 404,
          isKnownPath(url.pathname) ? 'route.method_not_allowed' : 'route.not_found',
          isKnownPath(url.pathname) ? 'HTTP method is not allowed for this route.' : 'Route was not found.',
        );
      }

      corsOrigin = enforceCors(request, env, route.policy);
      enforceBodyLimit(request, route.policy);
      const auth = await authenticate(request, env, route.policy);

      context = {
        startedAt,
        ids,
        route,
        auth,
        deviceId: request.headers.get('x-device-id'),
        clientIp: request.headers.get('cf-connecting-ip') ?? '0.0.0.0',
        appVersion: request.headers.get('x-app-version'),
        platform: request.headers.get('x-platform'),
      };

      const redis = createRedis(env);
      const rateLimit = await enforceRateLimit(redis, context);
      const cached = await matchEdgeCache(request, context);
      if (cached) {
        return finalize(applyCors(withTraceHeaders(cached, ids), corsOrigin), context, logger, ctx);
      }

      idempotencyState = await enforceIdempotency(request, redis, context);
      if (idempotencyState.kind === 'replayed') {
        return finalize(applyCors(withTraceHeaders(idempotencyState.response, ids), corsOrigin), context, logger, ctx);
      }

      const upstreamResponse =
        route.policy.path === '/health'
          ? jsonResponse({
              ok: true,
              service: 'api-gateway',
              environment: env.APP_ENV,
              requestId: ids.requestId,
              traceId: ids.traceId,
            })
          : await handleApiRequest(request, env, context);

      const responseWithPolicy = applyCacheHeaders(
        upstreamResponse,
        route.policy,
        route.policy.cache.mode === 'public' ? 'MISS' : 'BYPASS',
      );
      await completeIdempotency(redis, idempotencyState, responseWithPolicy);
      scheduleCacheWrite(request, context, responseWithPolicy, ctx);

      const response = withTraceHeaders(applyCors(responseWithPolicy, corsOrigin), ids);
      response.headers.set('x-rate-limit-remaining', String(rateLimit.remaining));
      response.headers.set('x-rate-limit-reset-seconds', String(rateLimit.resetSeconds));
      return finalize(response, context, logger, ctx);
    } catch (error) {
      if (context) {
        const redis = createRedis(env);
        await failIdempotency(redis, idempotencyState);
      }
      logger.error('request_failed', {
        errorCode: error instanceof HttpError ? error.code : 'internal.unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      const response = withTraceHeaders(applyCors(applyCacheHeaders(errorResponse(error, ids), {
        method: 'GET',
        path: '/error',
        upstreamPath: '/error',
        owner: 'platform',
        auth: 'none',
        cache: { mode: 'none' },
        rateLimit: { identity: 'ip', windowSeconds: 60, maxRequests: 1 },
        bodyLimitBytes: 0,
        requiresIdempotency: false,
        allowCors: true,
      }, 'BYPASS'), corsOrigin), ids);
      return response;
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(enqueuePendingOutbox(env));
  },

  async queue(batch: MessageBatch<OutboxQueueMessage>, env: Env): Promise<void> {
    await handleOutboxQueue(batch, env);
  },
} satisfies ExportedHandler<Env, OutboxQueueMessage>;

function finalize(response: Response, context: RequestContext, logger: ReturnType<typeof createLogger>, ctx: ExecutionContext): Response {
  const durationMs = Date.now() - context.startedAt;
  ctx.waitUntil(
    Promise.resolve().then(() => {
      logger.info('request_completed', requestLogFields(context, response.status, durationMs));
    }),
  );
  return response;
}
