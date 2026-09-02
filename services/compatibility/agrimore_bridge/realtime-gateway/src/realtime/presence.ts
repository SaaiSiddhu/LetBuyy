import { keyspace } from '../redis/keyspace';
import type { RedisClient, RealtimeEnv } from '../redis/client';
import { withRedisTimeout } from '../redis/client';
import { RedisTtl } from '../redis/ttl';

export type RiderHeartbeat = {
  readonly riderId: string;
  readonly cityId: string;
  readonly storeId?: string;
  readonly status: 'available' | 'assigned' | 'on_trip' | 'paused' | 'offline';
  readonly latitude: number;
  readonly longitude: number;
  readonly batteryPercent?: number;
  readonly appVersion?: string;
  readonly activeDeliveryId?: string;
};

export async function updateRiderPresence(
  env: RealtimeEnv,
  redis: RedisClient,
  heartbeat: RiderHeartbeat,
): Promise<void> {
  validateCoordinates(heartbeat.latitude, heartbeat.longitude);
  const keys = keyspace({ environment: env.APP_ENV });
  const now = new Date().toISOString();
  const presenceKey = keys.riderPresence(heartbeat.riderId);

  await withRedisTimeout(
    redis.hset(presenceKey, {
      status: heartbeat.status,
      city_id: heartbeat.cityId,
      store_id: heartbeat.storeId ?? '',
      lat: String(heartbeat.latitude),
      lng: String(heartbeat.longitude),
      battery: heartbeat.batteryPercent == null ? '' : String(heartbeat.batteryPercent),
      app_version: heartbeat.appVersion ?? '',
      last_seen_at: now,
    }),
  );
  await withRedisTimeout(redis.expire(presenceKey, RedisTtl.riderPresence));

  const geoKey = keys.riderGeo(heartbeat.cityId);
  if (heartbeat.status === 'available' || heartbeat.status === 'assigned' || heartbeat.status === 'on_trip') {
    await withRedisTimeout(
      redis.geoadd(geoKey, {
        longitude: heartbeat.longitude,
        latitude: heartbeat.latitude,
        member: heartbeat.riderId,
      }),
    );
    await withRedisTimeout(redis.expire(geoKey, RedisTtl.riderLocation));
  } else {
    await withRedisTimeout(redis.zrem(geoKey, heartbeat.riderId));
  }

  if (heartbeat.activeDeliveryId) {
    await withRedisTimeout(redis.set(keys.riderActiveDelivery(heartbeat.riderId), heartbeat.activeDeliveryId, { ex: RedisTtl.activeDelivery }));
  }
}

export async function markRiderOffline(env: RealtimeEnv, redis: RedisClient, riderId: string, cityId: string): Promise<void> {
  const keys = keyspace({ environment: env.APP_ENV });
  await withRedisTimeout(redis.hset(keys.riderPresence(riderId), { status: 'offline', last_seen_at: new Date().toISOString() }));
  await withRedisTimeout(redis.expire(keys.riderPresence(riderId), RedisTtl.riderPresence));
  await withRedisTimeout(redis.zrem(keys.riderGeo(cityId), riderId));
}

function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Response('Invalid latitude', { status: 400 });
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Response('Invalid longitude', { status: 400 });
  }
}
