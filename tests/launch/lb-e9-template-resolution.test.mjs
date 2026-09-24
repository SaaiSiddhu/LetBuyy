// E9 — Template-key resolution end-to-end (LANE-B static contract tests).
// Verifies that the blog/page.tsx file exists, composition-engine has the E9 scope drop
// branches, and the login route was updated with D10 parity.
// T3-fix W2: blog/page.tsx + loading.tsx moved into blog/(list)/ (a route group — no URL
// change) so blog/[slug]'s dynamic page no longer inherits the listing's loading.tsx-driven
// Suspense boundary. See CAPABILITY_BACKLOG.md CAP-C22.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const exists = (p) => existsSync(resolve(ROOT, p));

// ── (a) blog/page.tsx exists and exports a default ───────────────────────────
test('E9(a): blog/page.tsx exists', () => {
  assert.ok(
    exists('apps/commerce/web/src/app/store/[subdomain]/blog/(list)/page.tsx'),
    'blog/page.tsx must exist — it was MISSING per data source verdicts',
  );
});

test('E9(a): blog/page.tsx exports a default function', () => {
  const src = read('apps/commerce/web/src/app/store/[subdomain]/blog/(list)/page.tsx');
  assert.match(src, /export\s+default\s+(async\s+)?function/, 'blog/page.tsx must export a default function');
});

test('E9(a): blog/page.tsx is a server component (no "use client")', () => {
  const src = read('apps/commerce/web/src/app/store/[subdomain]/blog/(list)/page.tsx');
  assert.doesNotMatch(src, /['"]use client['"]/, 'blog/page.tsx must not be a client component');
});

// ── (b) composition-engine has the blog scope drop branch ────────────────────
test('E9(b): composition-engine contains blog route branch', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');
  // The branch checks plan.route.type === 'blog'
  assert.match(
    src,
    /route\.type\s*===\s*['"]blog['"]/,
    'composition-engine must have a blog route type branch for E9 scope drop',
  );
});

test('E9(b): composition-engine populates blogDrop from _blog sentinel', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');
  assert.match(src, /_blog/, 'composition-engine must reference _blog sentinel key');
});

// ── (c) composition-engine maps liquidPage to article drop for article route ─
test('E9(c): composition-engine maps liquidPage to article drop when route.type === "article"', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');
  assert.match(
    src,
    /route\.type\s*===\s*['"]article['"]/,
    'composition-engine must have an article route type branch for E9 scope drop',
  );
  assert.match(src, /articleDrop/, 'composition-engine must populate articleDrop');
});

// ── (d) composition-engine maps liquidPage to page drop for page route ───────
test('E9(d): composition-engine maps liquidPage to page drop when route.type === "page"', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');
  assert.match(
    src,
    /route\.type\s*===\s*['"]page['"]/,
    'composition-engine must have a page route type branch for E9 scope drop',
  );
  assert.match(src, /pageDrop/, 'composition-engine must populate pageDrop');
});

// ── (e) login route has D10 parity ───────────────────────────────────────────
test('E8/E9: login route has isFormPost helper (D10 parity)', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');
  assert.match(src, /isFormPost/, 'login route must define isFormPost helper (D10 pattern)');
});

test('E8/E9: login route has formRedirect helper (D10 parity)', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');
  assert.match(src, /formRedirect/, 'login route must define formRedirect helper (D10 pattern)');
});

test('E8/E9: login route uses 303 redirect on success (D10 parity)', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');
  assert.match(src, /303/, 'login route must use 303 redirect for no-JS form success path');
});

// ── (f) customers/login page.tsx exists ──────────────────────────────────────
test('E8: customers/login/page.tsx exists (two-segment path not caught by catch-all)', () => {
  assert.ok(
    exists('apps/commerce/web/src/app/store/[subdomain]/customers/login/page.tsx'),
    'customers/login/page.tsx must exist — the [...path] catch-all does not handle two-segment paths',
  );
});

// ── (g) store not-found.tsx exists ───────────────────────────────────────────
test('E4: store-level not-found.tsx exists', () => {
  assert.ok(
    exists('apps/commerce/web/src/app/store/[subdomain]/not-found.tsx'),
    'store-level not-found.tsx must exist (E4)',
  );
});

test('E4: store-level not-found.tsx delegates to root not-found (no subdomain param access)', () => {
  const src = read('apps/commerce/web/src/app/store/[subdomain]/not-found.tsx');
  // Must re-export from the root not-found component (no store fetch)
  assert.match(
    src,
    /from\s+['"]@\/app\/not-found['"]/,
    'store not-found.tsx must delegate to root not-found (no subdomain available in not-found boundary)',
  );
});
