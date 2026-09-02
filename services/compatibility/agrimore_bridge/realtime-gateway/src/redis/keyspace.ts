export type KeyspaceConfig = {
  readonly environment: string;
};

export function keyspace(config: KeyspaceConfig) {
  const prefix = `agrimore:${sanitize(config.environment)}`;
  return {
    riderPresence: (riderId: string) => `${prefix}:rider:presence:${riderId}`,
    riderGeo: (cityId: string) => `${prefix}:rider:geo:${cityId}`,
    riderActiveDelivery: (riderId: string) => `${prefix}:rider:active_delivery:${riderId}`,
    deliveryLive: (deliveryId: string) => `${prefix}:delivery:live:${deliveryId}`,
    deliverySubscribers: (deliveryId: string) => `${prefix}:delivery:subscribers:${deliveryId}`,
    dispatchCandidates: (deliveryId: string) => `${prefix}:dispatch:candidates:${deliveryId}`,
    dispatchOffer: (deliveryId: string, riderId: string) => `${prefix}:dispatch:offer:${deliveryId}:${riderId}`,
    websocketSession: (connectionId: string) => `${prefix}:ws:session:${connectionId}`,
    eta: (storeId: string, geohash: string, timeBucket: string) => `${prefix}:eta:${storeId}:${geohash}:${timeBucket}`,
    inventoryHot: (storeId: string, variantId: string) => `${prefix}:store:inventory:${storeId}:${variantId}`,
  };
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}
