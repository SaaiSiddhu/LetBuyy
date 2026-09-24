// S1/W6 — the demo route must fail closed: production and unknown/missing environments 404;
// only an explicit development or Vercel-preview signal lets it through.
//
// next/navigation's notFound()/redirect() are designed to always throw (they interrupt the render
// tree by design, even outside a real request) — the thrown error's `.digest` is Next's own stable
// public contract for which one fired, so no mocking is needed to observe which path this component took.
import assert from 'node:assert/strict';
import test from 'node:test';
import UrbanKicksDemoShortcut from './page';
import { isDemoRouteEnvironment } from '@/lib/demo/demo-route-gate';

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function digestOf(fn: () => void): string {
  try {
    fn();
    assert.fail('expected UrbanKicksDemoShortcut to throw (notFound() and redirect() always throw)');
  } catch (err) {
    return (err as { digest?: string }).digest ?? '';
  }
}

test('W6: production (NODE_ENV=production, no VERCEL_ENV) -> 404, route not reachable', () => {
  withEnv({ NODE_ENV: 'production', VERCEL_ENV: undefined }, () => {
    assert.equal(isDemoRouteEnvironment(), false);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.equal(digest, 'NEXT_HTTP_ERROR_FALLBACK;404', 'production must 404, never redirect into the demo');
  });
});

test('W6: production Vercel deploy (VERCEL_ENV=production) -> 404, route not reachable', () => {
  withEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' }, () => {
    assert.equal(isDemoRouteEnvironment(), false);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.equal(digest, 'NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

test('W6: FAIL CLOSED — unset/unknown environment -> 404, not exposed by default', () => {
  withEnv({ NODE_ENV: undefined, VERCEL_ENV: undefined }, () => {
    assert.equal(isDemoRouteEnvironment(), false);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.equal(digest, 'NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

test('W6: FAIL CLOSED — an unrecognized VERCEL_ENV value ("staging") -> 404, not exposed', () => {
  withEnv({ NODE_ENV: 'production', VERCEL_ENV: 'staging' }, () => {
    assert.equal(isDemoRouteEnvironment(), false);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.equal(digest, 'NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

test('W6: local development (NODE_ENV=development) -> reachable, redirects into /preview', () => {
  withEnv({ NODE_ENV: 'development', VERCEL_ENV: undefined }, () => {
    assert.equal(isDemoRouteEnvironment(), true);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.match(digest, /^NEXT_REDIRECT/, 'development must redirect into /preview for parity testing');
  });
});

test('W6: Vercel preview deployment (VERCEL_ENV=preview) -> reachable, redirects into /preview', () => {
  withEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }, () => {
    // Vercel preview deployments build with NODE_ENV=production but set VERCEL_ENV=preview —
    // VERCEL_ENV is the signal that must govern here, not NODE_ENV alone.
    assert.equal(isDemoRouteEnvironment(), true);
    const digest = digestOf(() => UrbanKicksDemoShortcut());
    assert.match(digest, /^NEXT_REDIRECT/);
  });
});
