import { HttpError } from '../runtime/errors';
import type { RedisClient } from '../runtime/redis';
import { withRedisTimeout } from '../runtime/redis';
import type { RequestContext, RoutePolicy } from '../runtime/types';

export type RateLimitResult = {
  readonly key: string;
  readonly remaining: number;
  readonly resetSeconds: number;
};

export async function enforceRateLimit(
  redis: RedisClient | null,
  context: RequestContext,
): Promise<RateLimitResult> {
  const policy = context.route.policy.rateLimit;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / policy.windowSeconds) * policy.windowSeconds;
  const identity = rateLimitIdentity(context.route.policy, context);
  const key = `rate:${identity}:${context.route.policy.path}:${windowStart}`;

  if (!redis) {
    return { key, remaining: policy.maxRequests, resetSeconds: policy.windowSeconds };
  }

  const count = await withRedisTimeout(redis.incr(key));
  if (count === 1) {
    await withRedisTimeout(redis.expire(key, policy.windowSeconds + 10));
  }

  const remaining = Math.max(0, policy.maxRequests - count);
  if (count > policy.maxRequests) {
    throw new HttpError(
      429,
      'rate.limit_exceeded',
      'Too many requests for this route.',
      true,
      { key, resetSeconds: windowStart + policy.windowSeconds - nowSeconds },
    );
  }

  return {
    key,
    remaining,
    resetSeconds: windowStart + policy.windowSeconds - nowSeconds,
  };
}

function rateLimitIdentity(policy: RoutePolicy, context: RequestContext): string {
  switch (policy.rateLimit.identity) {
    case 'user':
      return `user:${context.auth?.userId ?? context.clientIp}`;
    case 'device':
      return `device:${context.deviceId ?? context.clientIp}`;
    case 'composite':
      return `composite:${context.auth?.userId ?? 'anon'}:${context.deviceId ?? context.clientIp}`;
    case 'ip':
      return `ip:${context.clientIp}`;
  }
}
