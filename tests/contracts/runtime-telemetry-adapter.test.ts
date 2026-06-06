import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RUNTIME_TELEMETRY_SCHEMA_VERSION,
  runtimeTelemetryDataPoint,
  writeRuntimeTelemetryDataPoint,
  type RuntimeTelemetryDataPoint,
} from '@letbuyy/infrastructure/runtime-telemetry-adapter';

test('runtime telemetry adapter builds bounded Analytics Engine points', () => {
  const point = runtimeTelemetryDataPoint({
    metricName: 'letbuyy.runtime.request',
    runtimeName: 'api-gateway',
    environment: 'staging',
    deploymentEnv: 'staging',
    telemetryEnv: 'staging',
    siteId: 'site-1',
    requestId: 'request-1',
    traceId: 'trace-1',
    blobs: Array.from({ length: 30 }, (_, index) => `blob-${index}`),
    doubles: Array.from({ length: 30 }, (_, index) => index),
  });

  assert.equal(point.blobs?.[0], RUNTIME_TELEMETRY_SCHEMA_VERSION);
  assert.equal(point.blobs?.[1], 'letbuyy.runtime.request');
  assert.equal(point.blobs?.length, 20);
  assert.equal(point.doubles?.length, 20);
  assert.deepEqual(point.indexes, ['site-1']);
});

test('runtime telemetry adapter is no-op when binding is absent', () => {
  assert.equal(writeRuntimeTelemetryDataPoint(undefined, {
    metricName: 'letbuyy.queue.dead_letter.total',
    runtimeName: 'Queue Workers',
  }), false);
});

test('runtime telemetry adapter writes to Analytics Engine binding when present', () => {
  const writes: RuntimeTelemetryDataPoint[] = [];
  const wrote = writeRuntimeTelemetryDataPoint({
    writeDataPoint(point) {
      if (point) writes.push(point);
    },
  }, {
    metricName: 'letbuyy.replay.lag.seconds',
    runtimeName: 'api-gateway',
    environment: 'production',
    index: 'api-gateway:production',
    doubles: [0, 0],
  });

  assert.equal(wrote, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.blobs?.[1], 'letbuyy.replay.lag.seconds');
  assert.equal(writes[0]?.indexes?.[0], 'api-gateway:production');
});
