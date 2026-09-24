// W3 (PHASE-T3, strengthened PHASE-T3-fix W2) — structural regression guard for the soft-404 fix.
//
// Root cause: Next.js wraps a route segment's descendants in an implicit <Suspense> boundary
// whenever a `loading.tsx` file exists anywhere in that segment's ancestor chain. The initial
// HTML shell (the loading skeleton) streams with a committed 200 status before deferred async
// content resolves, so a later notFound() can only swap the streamed CONTENT, never the
// already-sent status code (see CAP-C22 in CAPABILITY_BACKLOG.md for the full diagnosis,
// including why the T3 prompt's own cited "control" case was not actually comparable).
//
// T3's original version of this test hardcoded two route lists (content-dependent vs
// always-exists) and checked only "does a loading.tsx exist at exactly this literal path" —
// which is not the actual Next.js rule. It shipped 1848/1848 green while TWO real instances of
// this exact bug were live: `blog/loading.tsx` and `account/orders/loading.tsx` each had a
// dynamic-segment ([slug] / [id]) DESCENDANT with no loading.tsx of its own, so that descendant
// silently inherited the ancestor's Suspense boundary — the literal-path check never looked at
// descendants, so it could not see this. A guard that passes while the bug exists is not a
// guard (T3-fix's own words). This version checks the REAL invariant instead: walk the actual
// filesystem tree and assert that no loading.tsx has ANY dynamic-segment page.tsx anywhere in
// its subtree, with an explicit (currently empty) allowlist for a deliberate future exception —
// so a new route added under an existing loading.tsx is checked automatically, not by memory.
//
// Proven to fail pre-fix / pass post-fix: this exact test, run against the git blob for
// account/orders/page.tsx + loading.tsx + [id]/page.tsx as they existed at commit b96b26d5 (the
// state PHASE-T3-fix started from), reports the account/orders/loading.tsx -> [id]/page.tsx
// violation; run against the fixed tree (loading.tsx moved into account/orders/(list)/, [id]/
// left a bare sibling with no loading.tsx anywhere above it up to [subdomain]/) it is silent.
// See PHASE-T3-FIX's ledger entry for the recorded before/after run.
//
// This file lives in src/lib/, not under app/store/[subdomain]/ itself, because node's test
// runner glob-matches bracketed path segments as character classes and silently finds zero
// tests when a .test.ts file is placed inside a [subdomain]-style directory.
//
// Run: npx tsx --tsconfig apps/commerce/web/tsconfig.json --test src/lib/loading-suspense-boundary.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEGMENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'store', '[subdomain]');

const isDynamicSegmentDir = (name: string) => /^\[.+\]$/.test(name) && name !== '[subdomain]';

function findAll(root: string, matchDir: (name: string) => boolean): string[] {
  const matches: string[] = [];
  const walk = (dir: string) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      if (matchDir(name)) matches.push(full);
      walk(full);
    }
  };
  walk(root);
  return matches;
}

/** Every directory (at any depth) under `root` that contains a page.tsx inside a dynamic-segment folder. */
function findDynamicSegmentPages(root: string): string[] {
  return findAll(root, isDynamicSegmentDir)
    .map((dir) => join(dir, 'page.tsx'))
    .filter((page) => existsSync(page));
}

/** Every loading.tsx under `root`, as directories (not file paths). */
function findLoadingDirs(root: string): string[] {
  const matches: string[] = [];
  const walk = (dir: string) => {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'loading.tsx')) matches.push(dir);
    for (const e of entries) {
      if (e.isDirectory()) walk(join(dir, e.name));
    }
  };
  walk(root);
  return matches;
}

// Intentional exceptions to "no loading.tsx may have a dynamic-segment page descendant", as
// { loadingDir, dynamicPage } pairs relative to SEGMENT_ROOT. Empty by design — every current
// loading.tsx placement is provably safe (see PHASE-T3-fix's ledger entry). Add an entry here
// only with a recorded, reviewed reason; this list existing at all is itself worth flagging in
// review.
const ALLOWED_EXCEPTIONS: Array<{ loadingDir: string; dynamicPage: string }> = [];

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

test('W3: at least one loading.tsx exists (sanity — the skeleton UX must not have been removed wholesale)', () => {
  const loadingDirs = findLoadingDirs(SEGMENT_ROOT);
  assert.ok(loadingDirs.length > 0, 'expected at least one route to keep its loading skeleton');
});

test('W3: no loading.tsx has a dynamic-segment page descendant anywhere in its subtree', () => {
  const loadingDirs = findLoadingDirs(SEGMENT_ROOT);
  const violations: string[] = [];

  for (const loadingDir of loadingDirs) {
    for (const dynamicPage of findDynamicSegmentPages(loadingDir)) {
      const relLoading = loadingDir.slice(SEGMENT_ROOT.length + 1) || '.';
      const relPage = dynamicPage.slice(SEGMENT_ROOT.length + 1);
      const allowed = ALLOWED_EXCEPTIONS.some((e) => e.loadingDir === relLoading && e.dynamicPage === relPage);
      if (!allowed) violations.push(`${relLoading}/loading.tsx  ->  ${relPage}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `these loading.tsx files wrap a dynamic-segment page that has no loading.tsx of its own — ` +
      `that page silently inherits the ancestor Suspense boundary, which locks its streamed HTTP ` +
      `status at 200 even when it later calls notFound(). Either move the loading.tsx (paired with ` +
      `its page.tsx) into a route group that excludes the dynamic segment, or add a justified entry ` +
      `to ALLOWED_EXCEPTIONS:\n${violations.join('\n')}`,
  );
});

// Confirmed via source read (T3 / T3-fix): each has a genuine content/template-existence-dependent
// notFound(), not just the defensive `!store` check every route has. Kept as an explicit,
// human-readable cross-check alongside the structural walk above — this list is documentation of
// WHY each route is excluded, not the enforcement mechanism itself.
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

for (const route of CONTENT_DEPENDENT_ROUTES) {
  test(`W3: ${route} has no local loading.tsx (its notFound() depends on resolved content)`, () => {
    assert.equal(
      existsSync(join(SEGMENT_ROOT, route, 'loading.tsx')),
      false,
      `${route} calls notFound() for content/template absence, not just a missing store — a local loading.tsx here reintroduces the soft-404 bug for this route`,
    );
  });
}

// Confirmed via source read (T3 / T3-fix): notFound() here is only the defensive `!store` check
// (already intercepted upstream by proxy.ts in normal operation), so a local Suspense boundary is
// safe. blog and account/orders moved into a (list) route group in T3-fix W2 so their listing
// page keeps its own loading.tsx while their dynamic sibling ([slug] / [id]) does not inherit it;
// account's hub page similarly moved into (hub) so account/loading.tsx does not reach
// account/orders/[id] as a farther-up ancestor.
const ALWAYS_EXISTS_ROUTES = [
  'account/(hub)',
  'account/addresses',
  'account/orders/(list)',
  'account/settings',
  'account/wishlist',
  'blog/(list)',
  'cart',
  'checkout',
  'checkout/paypal-return',
  'checkout/success',
  'customers/login',
  'orders',
  'products',
  'shop',
];

for (const route of ALWAYS_EXISTS_ROUTES) {
  test(`W3: ${route} keeps its own loading.tsx (defensive-only notFound(), safe to have a boundary)`, () => {
    assert.equal(
      existsSync(join(SEGMENT_ROOT, route, 'loading.tsx')),
      true,
      `${route} was redistributed a local loading.tsx during the W3 fix to restore its loading skeleton — it going missing means either the route regressed to no boundary at all, or was wrongly reclassified`,
    );
  });
}
