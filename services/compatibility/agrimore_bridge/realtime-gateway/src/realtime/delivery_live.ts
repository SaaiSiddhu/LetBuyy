import { keyspace } from '../redis/keyspace';
import type { RedisClient, RealtimeEnv } from '../redis/client';
import { withRedisTimeout } from '../redis/client';
import { RedisTtl } from '../redis/ttl';

export type DeliveryLivePatch = {
  readonly deliveryId: string;
  readonly riderId: string;
  readonly status: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly heading?: number;
  readonly speed?: number;
  readonly etaSeconds?: number;
};

export type DeliveryLiveState = Record<string, string>;

export async function updateDeliveryLiveState(
  env: RealtimeEnv,
  redis: RedisClient,
  patch: DeliveryLivePatch,
): Promise<void> {
  const keys = keyspace({ environment: env.APP_ENV });
  await withRedisTimeout(
    redis.hset(keys.deliveryLive(patch.deliveryId), {
      rider_id: patch.riderId,
      status: patch.status,
      lat: String(patch.latitude),
      lng: String(patch.longitude),
      heading: patch.heading == null ? '' : String(patch.heading),
      speed: patch.speed == null ? '' : String(patch.speed),
      eta_seconds: patch.etaSeconds == null ? '' : String(patch.etaSeconds),
      updated_at: new Date().toISOString(),
    }),
  );
  await withRedisTimeout(redis.expire(keys.deliveryLive(patch.deliveryId), RedisTtl.deliveryLive));
}

export async function getDeliveryLiveState(
  env: RealtimeEnv,
  redis: RedisClient,
  deliveryId: string,
): Promise<DeliveryLiveState | null> {
  const state = (await withRedisTimeout(redis.hgetall(keyspace({ environment: env.APP_ENV }).deliveryLive(deliveryId)))) as
    | DeliveryLiveState
    | null;
  return state;
}

export function deliveryIdFromChannel(channel: string): string | null {
  const parts = channel.split('.');
  if (parts.length !== 3 || parts[0] !== 'delivery' || parts[1] !== 'live') {
    return null;
  }
  return parts[2] || null;
}
