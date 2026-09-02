import { Redis } from '@upstash/redis/cloudflare';
import type { Env } from './types';

export type RedisClient = Pick<Redis, 'get' | 'set' | 'incr' | 'expire' | 'hgetall' | 'hset'>;

export function createRedis(env: Env): RedisClient | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function withRedisTimeout<T>(operation: Promise<T>, timeoutMs = 750): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('redis.timeout')), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
