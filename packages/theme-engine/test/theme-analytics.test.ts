// K6 tests — Theme Analytics Contract
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeThemeMetrics,
  describeThemeEventEmissionPoints,
} from '../src/theme-analytics.ts';
import type {
  ThemeInstallMetrics,
  ThemeAnalyticsEvent,
  ThemeInstalledEvent,
  ThemeUpdatedEvent,
  ThemePublishedEvent,
  ThemeUninstalledEvent,
  ThemePreviewOpenedEvent,
  ThemeMetricDescriptor,
  ThemeEventEmissionPoint,
} from '../src/theme-analytics.ts';

// ---- describeThemeMetrics ----

test('theme-analytics: describeThemeMetrics returns the correct topic', () => {
  const descriptor = describeThemeMetrics();
  assert.equal(descriptor.topic, 'theme.install.metrics');
});

test('theme-analytics: describeThemeMetrics.connected is always false (NOT-CONNECTED)', () => {
  const descriptor = describeThemeMetrics();
  assert.equal(descriptor.connected, false);
});

test('theme-analytics: describeThemeMetrics has exactly 4 field descriptors', () => {
  const descriptor = describeThemeMetrics();
  assert.equal(descriptor.fields.length, 4);
});

test('theme-analytics: describeThemeMetrics covers all ThemeInstallMetrics fields', () => {
  const descriptor = describeThemeMetrics();
  const coveredFields = new Set(descriptor.fields.map((f) => f.field));

  const requiredFields: Array<keyof ThemeInstallMetrics> = [
    'installCount',
    'activeStores',
    'versionDistribution',
    'renderEngineMix',
  ];

  for (const field of requiredFields) {
    assert.ok(coveredFields.has(field), `Field "${field}" is missing from the descriptor`);
  }
});

test('theme-analytics: every field descriptor has connected=false', () => {
  const descriptor = describeThemeMetrics();
  for (const fieldDesc of descriptor.fields) {
    assert.equal(fieldDesc.connected, false, `Field "${fieldDesc.field}" must have connected=false`);
  }
});

test('theme-analytics: every field descriptor has a non-empty source annotation', () => {
  const descriptor = describeThemeMetrics();
  for (const fieldDesc of descriptor.fields) {
    assert.ok(fieldDesc.source.length > 0, `Field "${fieldDesc.field}" has empty source annotation`);
  }
});

test('theme-analytics: every field descriptor has a non-empty description', () => {
  const descriptor = describeThemeMetrics();
  for (const fieldDesc of descriptor.fields) {
    assert.ok(fieldDesc.description.length > 0, `Field "${fieldDesc.field}" has empty description`);
  }
});

test('theme-analytics: describeThemeMetrics is deterministic (deep-equal on repeated calls)', () => {
  const d1 = describeThemeMetrics();
  const d2 = describeThemeMetrics();
  assert.deepEqual(d1, d2);
});

// ---- describeThemeEventEmissionPoints ----

test('theme-analytics: describeThemeEventEmissionPoints returns an array', () => {
  const points = describeThemeEventEmissionPoints();
  assert.ok(Array.isArray(points));
});

test('theme-analytics: describeThemeEventEmissionPoints covers all 5 event types', () => {
  const points = describeThemeEventEmissionPoints();
  const coveredEvents = new Set(points.map((p) => p.event));

  const expectedEvents: Array<ThemeAnalyticsEvent['event']> = [
    'theme.installed',
    'theme.updated',
    'theme.published',
    'theme.uninstalled',
    'theme.preview.opened',
  ];

  for (const evt of expectedEvents) {
    assert.ok(coveredEvents.has(evt), `Event "${evt}" is missing from emission points`);
  }
});

test('theme-analytics: every emission point has a non-empty emissionPoint string', () => {
  const points = describeThemeEventEmissionPoints();
  for (const ep of points) {
    assert.ok(ep.emissionPoint.length > 0, `Event "${ep.event}" has empty emissionPoint`);
  }
});

test('theme-analytics: all emission points have implemented=false (no live wiring yet)', () => {
  const points = describeThemeEventEmissionPoints();
  for (const ep of points) {
    assert.equal(ep.implemented, false, `Event "${ep.event}" incorrectly claims implemented=true`);
  }
});

test('theme-analytics: describeThemeEventEmissionPoints is deterministic', () => {
  const p1 = describeThemeEventEmissionPoints();
  const p2 = describeThemeEventEmissionPoints();
  assert.deepEqual(p1, p2);
});

// ---- Type contract validation (structural tests) ----

test('theme-analytics: ThemeInstalledEvent has the required structural fields', () => {
  // Construct a well-typed event and verify structural integrity at runtime.
  const event: ThemeInstalledEvent = {
    event: 'theme.installed',
    occurred_at: new Date().toISOString(),
    site_id: 'test-site-id',
    theme_slug: 'letbuyy-core',
    release_version: 1,
    schema_version: '2026-06-liquid-sections',
    engine: 'liquid',
  };
  assert.equal(event.event, 'theme.installed');
  assert.ok(typeof event.site_id === 'string');
  assert.ok(typeof event.release_version === 'number');
});

test('theme-analytics: ThemeUpdatedEvent has from/to version fields', () => {
  const event: ThemeUpdatedEvent = {
    event: 'theme.updated',
    occurred_at: new Date().toISOString(),
    site_id: 'test-site-id',
    theme_slug: 'letbuyy-core',
    from_release_version: 1,
    to_release_version: 2,
    from_schema_version: '2026-06-liquid-sections',
    to_schema_version: '2026-06-liquid-sections',
    engine: 'liquid',
  };
  assert.equal(event.event, 'theme.updated');
  assert.ok(event.to_release_version > event.from_release_version);
});

test('theme-analytics: ThemePublishedEvent carries lint_issue_count and schema_verified', () => {
  const event: ThemePublishedEvent = {
    event: 'theme.published',
    occurred_at: new Date().toISOString(),
    theme_slug: 'letbuyy-core',
    version: '1.0.0',
    schema_version: '2026-06-liquid-sections',
    lint_issue_count: 0,
    schema_verified: true,
  };
  assert.equal(event.lint_issue_count, 0);
  assert.equal(event.schema_verified, true);
});

test('theme-analytics: ThemeInstallMetrics type is constructable with correct shape', () => {
  const metrics: ThemeInstallMetrics = {
    installCount: 0,
    activeStores: 0,
    versionDistribution: { '2026-06-liquid-sections': 0 },
    renderEngineMix: { liquid: 0, react: 0 },
  };
  assert.ok(typeof metrics.installCount === 'number');
  assert.ok(typeof metrics.renderEngineMix === 'object');
});
