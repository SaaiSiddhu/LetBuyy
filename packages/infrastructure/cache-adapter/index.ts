import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface UpstashCacheConfig {
  url?: string;
  token?: string;
}

export interface RateLimitConfig extends UpstashCacheConfig {
  limit: number;
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
  prefix: string;
}

export type RateLimiterPort = {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
};

export function createUpstashRedisClient(config: UpstashCacheConfig): Redis | null {
  if (!config.url || !config.token) return null;
  return new Redis({ url: config.url, token: config.token });
}

export function createUpstashSlidingWindowLimiter(config: RateLimitConfig): RateLimiterPort | null {
  const redis = createUpstashRedisClient(config);
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: config.prefix,
  });
}
