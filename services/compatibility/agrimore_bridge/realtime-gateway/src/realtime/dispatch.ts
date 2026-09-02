import { keyspace } from '../redis/keyspace';
import type { RedisClient, RealtimeEnv } from '../redis/client';
import { withRedisTimeout } from '../redis/client';
import { RedisTtl } from '../redis/ttl';

export type DispatchCandidate = {
  readonly riderId: string;
  readonly score: number;
};

export type DispatchOffer = {
  readonly deliveryId: string;
  readonly riderId: string;
  readonly attempt: number;
  readonly expiresAt: string;
};

export async function cacheDispatchCandidates(
  env: RealtimeEnv,
  redis: RedisClient,
  deliveryId: string,
  candidates: readonly DispatchCandidate[],
): Promise<void> {
  const key = keyspace({ environment: env.APP_ENV }).dispatchCandidates(deliveryId);
  if (candidates.length === 0) {
    await withRedisTimeout(redis.expire(key, 1));
    return;
  }

  for (const candidate of candidates) {
    await withRedisTimeout(
      redis.zadd(key, {
        score: candidate.score,
        member: candidate.riderId,
      }),
    );
  }
  await withRedisTimeout(redis.expire(key, RedisTtl.dispatchCandidates));
}

export async function cacheDispatchOffer(env: RealtimeEnv, redis: RedisClient, offer: DispatchOffer): Promise<void> {
  const key = keyspace({ environment: env.APP_ENV }).dispatchOffer(offer.deliveryId, offer.riderId);
  await withRedisTimeout(
    redis.hset(key, {
      delivery_id: offer.deliveryId,
      rider_id: offer.riderId,
      offered_at: new Date().toISOString(),
      expires_at: offer.expiresAt,
      attempt: String(offer.attempt),
    }),
  );
  await withRedisTimeout(redis.expire(key, RedisTtl.dispatchOffer));
}
