// W3 (PHASE-T3) — structural regression guard for the soft-404 fix.
//
// Root cause: Next.js wraps a route segment's descendants in an implicit <Suspense> boundary
// whenever a `loading.tsx` file exists anywhere in that segment's ancestor chain. The initial
// HTML shell (the loading skeleton) streams with a committed 200 status before deferred async
// content resolves, so a later notFound() can only swap the streamed CONTENT, never the
// already-sent status code (see CAP-C22 in CAPABILITY_BACKLOG.md for the full diagnosis,
// including why the T3 prompt's own cited "control" case was not actually comparable).
//
// The fix has two structural invariants this test enforces directly against the filesystem
// (no server needed — this is what a live curl sweep can't guard against regressing):
//   1. There must be NO shared loading.tsx at app/store/[subdomain]/ — its presence wraps every
//      descendant route (including the content-dependent ones below) in the same boundary, and
//      Next has no file-convention way to opt a child route out of an ancestor's boundary.
//   2. Every route whose notFound() depends on resolved content/template existence (not just a
//      defensive `!store` check) must have NO local loading.tsx of its own either — otherwise
//      that route reintroduces its own instance of the exact same bug.
//
// This file lives in src/lib/, not under app/store/[subdomain]/ itself, because node's test
// runner glob-matches bracketed path segments as character classes and silently finds zero
// tests when a .test.ts file is placed inside a [subdomain]-style directory.
//
// Run: npx tsx --tsconfig apps/storefront-runtime/tsconfig.json --test src/lib/loading-suspense-boundary.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEGMENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'store', '[subdomain]');

// Confirmed via source read (T3): each has a genuine content/template-existence-dependent
// notFound(), not just the defensive `!store` check every route has.
const CONTENT_DEPENDENT_ROUTES = [
  '[...path]',
  'blog/[slug]',
  'collections/[slug]',
  'product/[productId]',
  'account/orders/[id]',
  'privacy',
  'terms',
  'returns',
  'shipping',
  'password',
  'contact',
  'search',
  'collections',
  'customers/register',
];

// Confirmed via source read (T3): notFound() here is only the defensive `!store` check (already
// intercepted upstream by proxy.ts in normal operation), so a local Suspense boundary is safe.
const ALWAYS_EXISTS_ROUTES = [
  'account',
  'account/addresses',
  'account/orders',
  'account/settings',
  'account/wishlist',
  'blog',
  'cart',
  'checkout',
  'checkout/paypal-return',
  'checkout/success',
  'customers/login',
  'orders',
  'products',
  'shop',
];

test('W3: the [subdomain] segment directory exists (path sanity check)', () => {
  assert.equal(existsSync(SEGMENT_ROOT), true, `expected to find app/store/[subdomain] at ${SEGMENT_ROOT}`);
});

test('W3: no shared loading.tsx at the [subdomain] segment root', () => {
  assert.equal(
    existsSync(join(SEGMENT_ROOT, 'loading.tsx')),
    false,
    'a shared loading.tsx here wraps every descendant route in one Suspense boundary, which locks the streamed status at 200 for any deferred notFound() below it',
  );
});

for (const route of CONTENT_DEPENDENT_ROUTES) {
  test(`W3: ${route} has no local loading.tsx (its notFound() depends on resolved content)`, () => {
    assert.equal(
      existsSync(join(SEGMENT_ROOT, route, 'loading.tsx')),
      false,
      `${route} calls notFound() for content/template absence, not just a missing store — a local loading.tsx here reintroduces the soft-404 bug for this route`,
    );
  });
}

for (const route of ALWAYS_EXISTS_ROUTES) {
  test(`W3: ${route} keeps its own loading.tsx (defensive-only notFound(), safe to have a boundary)`, () => {
    assert.equal(
      existsSync(join(SEGMENT_ROOT, route, 'loading.tsx')),
      true,
      `${route} was redistributed a local loading.tsx during the W3 fix to restore its loading skeleton — it going missing means either the route regressed to no boundary at all, or was wrongly reclassified`,
    );
  });
}
