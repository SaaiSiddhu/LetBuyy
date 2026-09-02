import assert from 'node:assert/strict';
import test from 'node:test';

import { orderTrackerPatchForPath, riderLocationStateFromPayload } from '../src/index';

test('rider location payload accepts app heartbeat aliases', () => {
  assert.deepEqual(
    riderLocationStateFromPayload({
      riderId: '00000000-0000-4000-8000-000000000501',
      activeDeliveryId: '00000000-0000-4000-8000-000000000601',
      cityId: 'blr',
      status: 'on_trip',
      latitude: 12.9716,
      longitude: 77.5946,
      eta: '2026-06-01T12:30:00.000Z',
    }),
    {
      riderId: '00000000-0000-4000-8000-000000000501',
      orderId: '00000000-0000-4000-8000-000000000601',
      cityId: 'blr',
      status: 'on_trip',
      lat: 12.9716,
      lng: 77.5946,
      eta: '2026-06-01T12:30:00.000Z',
    },
  );
});

test('order room location patches update rider position and freshness', () => {
  assert.deepEqual(
    orderTrackerPatchForPath(
      '/orders/00000000-0000-4000-8000-000000000601/location',
      {
        riderId: '00000000-0000-4000-8000-000000000501',
        lat: 12.9716,
        lng: 77.5946,
        eta: '2026-06-01T12:30:00.000Z',
      },
      '2026-06-01T12:00:00.000Z',
    ),
    {
      riderId: '00000000-0000-4000-8000-000000000501',
      deliveryStatus: undefined,
      riderLocation: { lat: 12.9716, lng: 77.5946 },
      eta: '2026-06-01T12:30:00.000Z',
      lastUpdated: '2026-06-01T12:00:00.000Z',
    },
  );
});
