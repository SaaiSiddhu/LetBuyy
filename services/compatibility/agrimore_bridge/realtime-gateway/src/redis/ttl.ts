export const RedisTtl = {
  riderPresence: 45,
  riderLocation: 60,
  activeDelivery: 2 * 60 * 60,
  deliveryLive: 5 * 60,
  deliverySubscribers: 5 * 60,
  dispatchCandidates: 90,
  dispatchOffer: 30,
  inventoryHot: 120,
  eta: 120,
  websocketSession: 5 * 60,
  rateLimitBuffer: 10,
} as const;

export type RedisTtlName = keyof typeof RedisTtl;
