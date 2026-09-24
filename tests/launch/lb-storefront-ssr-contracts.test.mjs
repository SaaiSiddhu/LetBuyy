// Storefront SSR integration + regression contracts — Phase I QA.
//
// Covers genuine gaps not addressed by the existing customer-web test files:
//   • E8 (login no-JS): the login route mirrors the D10 register pattern (dual content-type,
//     303 redirect, same-origin guard) + the Liquid login form carries a hidden storeId field.
//   • F5 fallback_reason: pinned to only fire on Liquid plan failures (not React plans);
//     lb:canary:render:fallback emitted exactly once (inside the catch block).
//   • F5 isLiquidFallback: chrome injection is guarded so React plans never trigger it.
//   • lb-customer-settings / lb-address-manager / lb-cart data-base-path integrity.
//   • lb-logout no-JS: the <form method="post"> submit button is inside lb-logout so
//     the no-JS logout path is always reachable.
//
// All tests are source-contract assertions against real files — no runtime, no mocks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

// ============================================================
// E8 login route — no-JS contract
// (D10 register is already tested in storefront-liquid-runtime.test.mjs)
// ============================================================

test('E8 login route accepts application/x-www-form-urlencoded (isFormPost + formData path)', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');

  // Dual content-type detection.
  assert.match(src, /isFormPost/);
  assert.match(src, /application\/x-www-form-urlencoded/);
  // The form path must call request.formData(), not request.json(), so HTML forms work.
  assert.match(src, /request\.formData\(\)/);
  // The JSON path must still exist for React / island callers.
  assert.match(src, /request\.json\(\)/);
});

test('E8 login form errors return a 303 redirect (not raw JSON) from the form path', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');

  // Error responses for form submissions must be redirects (303), not JSON.
  assert.match(src, /NextResponse\.redirect/);
  assert.match(src, /NextResponse\.redirect\(url,\s*303\)/);
});

test('E8 login form redirect is same-origin only', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');

  // The referer-based redirect target must be validated against the request origin.
  // An open-redirect vulnerability would let an attacker set the referer to an external site.
  assert.match(src, /refererUrl\.origin === new URL\(request\.url\)\.origin/);
});

test('E8 login route extracts storeId from the form body (not hardcoded)', () => {
  const src = read('apps/commerce/web/src/app/api/customer/login/route.ts');

  // storeId must be required — the gateway call needs the tenant ID.
  assert.match(src, /form\.get\('storeId'\)/);
  assert.match(src, /storeId/);
  // Missing storeId must trigger a form-redirect error (not silently pass with an empty tenant ID).
  assert.match(src, /!email \|\| !password \|\| !storeId/);
});

test('E8 Liquid login form carries hidden storeId field (shop.id) for no-JS tenant routing', () => {
  // Without the hidden storeId the route cannot identify which merchant the customer belongs to.
  // The regex anchors on `createLiquidSectionFile` so it targets the section *definition* rather
  // than the many other references to 'customer-login' scattered earlier in the bundle.
  const src = read('packages/theme-engine/src/theme-bundle.ts');

  // Extract the customer-login section definition block.
  const loginSectionDef = src.match(
    /'customer-login':\s*createLiquidSectionFile\([\s\S]*?'customer-register':\s*createLiquidSectionFile/,
  )?.[0] ?? '';
  assert.ok(loginSectionDef.length > 0, 'customer-login createLiquidSectionFile block must be extractable');

  // The hidden input must be inside the login form body.
  assert.ok(
    loginSectionDef.includes('name="storeId" value="{{ shop.id }}"'),
    'Liquid customer-login form must include a hidden storeId input with value="{{ shop.id }}"',
  );
  // Confirm the form action is /api/customer/login (not accidentally pointing to register).
  assert.ok(
    loginSectionDef.includes('action="/api/customer/login"'),
    'customer-login form action must be /api/customer/login',
  );
});

// ============================================================
// F5 fallback_reason — only on Liquid plan failures, never on React plans
// ============================================================

test('F5 fallback_reason is conditioned on both liquidHtml===null AND plan.rendererEngine===liquid', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');

  // "liquidHtml" is the Liquid render result: renderLiquidPlan's return value, null when nothing
  // was rendered. c5a9fe98 (2026-08-25) renamed the variable to liquidResult when the result became
  // { html, headStyleText }. Take the name from the call, so the condition is checked against the
  // result the telemetry actually reports (the one that also picks `engine`), whatever it is called.
  const calls = [...src.matchAll(/const (\w+) = await renderLiquidPlan\(/g)];
  assert.equal(calls.length, 1, 'StorefrontCompositionEngine must render the plan exactly once');
  const result = calls[0][1];
  assert.match(src, new RegExp(`const engine = ${result} \\? 'liquid' : 'react';`));
  // The ternary must gate on BOTH conditions so React plans (which also yield a null result)
  // do not emit a misleading 'renderer_returned_null' in monitoring.
  assert.match(
    src,
    new RegExp(`fallback_reason:\\s*\\(${result} === null && plan\\.rendererEngine === 'liquid'\\)`),
  );
  // When the condition is false, fallback_reason must be explicitly null so the monitoring
  // field is always present (not missing) — which lets consumers filter on field value.
  assert.match(src, /fallback_reason:.*\? 'renderer_returned_null' : null/);
});

test('F5 lb:canary:render:fallback is emitted exactly once (inside the catch block, never at top level)', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');

  // Count occurrences — must be exactly one.
  const hits = (src.match(/lb:canary:render:fallback/g) ?? []).length;
  assert.strictEqual(
    hits,
    1,
    'lb:canary:render:fallback must appear exactly once; emitting it outside the catch produces phantom monitoring alerts',
  );

  // The single occurrence must reside inside a catch block (not at top level telemetry).
  const catchWithFallback = src.match(/catch\s*\([^)]*\)\s*\{[^}]*lb:canary:render:fallback/s)?.[0];
  assert.ok(
    catchWithFallback,
    'lb:canary:render:fallback must be inside a catch block, not in the normal render telemetry',
  );
});

// ============================================================
// F5 isLiquidFallback — chrome injection guard
// ============================================================

test('F5 isLiquidFallback is set only from plan.rendererEngine so React plans skip chrome injection', () => {
  const src = read('apps/commerce/web/src/lib/theme-engine/composition-engine.tsx');

  // Derivation must be from the plan's declared renderer engine.
  assert.match(src, /isLiquidFallback = plan\.rendererEngine === 'liquid'/);

  // The chrome-injection branch must be guarded by this flag.
  assert.match(src, /if \(isLiquidFallback\)/);

  // renderLiquidPlan must early-return null for non-Liquid plans so that the isLiquidFallback
  // variable is never incorrectly true after a React render.
  assert.match(src, /plan\.rendererEngine !== 'liquid'[\s\S]*?return null/);
});

// ============================================================
// lb-customer-settings / lb-address-manager / lb-cart data-base-path integrity
// ============================================================

test('lb-customer-settings SSR sets data-base-path to /store/{{shop.subdomain}}', () => {
  // LbCustomerSettingsElement reads this.dataset.basePath as the prefix for its
  // /api/customer/profile and /api/customer/set-password calls.
  const src = read('packages/theme-engine/src/theme-bundle.ts');

  assert.match(
    src,
    /lb-customer-settings[\s\S]*?data-base-path="\/store\/\{\{ shop\.subdomain \}\}"/,
  );
});

test('lb-address-manager SSR sets data-base-path to /store/{{shop.subdomain}}', () => {
  const src = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(
    src,
    /lb-address-manager[\s\S]*?data-base-path="\/store\/\{\{ shop\.subdomain \}\}"/,
  );
});

test('lb-cart SSR markup sets data-base-path for the checkout anchor href', () => {
  // LbCartElement builds the checkout link as:
  //   `<a href="${escapeHtml(this.baseHref)}/checkout">Proceed to checkout</a>`
  // where this.baseHref = this.dataset.basePath || inferBasePath().
  // The SSR attribute guarantees the correct path without a client-side inference race.
  const src = read('packages/theme-engine/src/theme-bundle.ts');
  assert.match(src, /<lb-cart\s+data-lb-island="cart"\s+data-base-path/);
});

// ============================================================
// lb-logout no-JS fallback integrity
// ============================================================

test('lb-logout no-JS fallback submit button is nested inside lb-logout (not an orphan)', () => {
  // The button must be inside lb-logout so:
  //   • Without JS: the browser posts the parent <form method="post">.
  //   • With JS: LbLogoutElement.handleClick sees a button[type=submit] and calls performLogout.
  // An orphaned submit button would silently break the no-JS path.
  const src = read('packages/theme-engine/src/theme-bundle.ts');

  // Anchor to the actual <lb-logout HTML opening tag (not the substring 'lb-logout' which
  // also appears in JS comments like '// lb-logout island wraps a no-JS <form method="post">').
  // Starting from a comment that contains '<form method="post">' would give a false-positive
  // for the form-nesting assertion even if the form were moved outside </lb-logout>.
  const logoutIsland = src.match(/<lb-logout\b[^>]*>[\s\S]*?<\/lb-logout>/)?.[0] ?? '';
  assert.ok(logoutIsland.length > 0, '<lb-logout>…</lb-logout> block must be present in theme-bundle SSR');
  assert.ok(
    logoutIsland.includes('<button type="submit"'),
    'submit button must be structurally nested inside <lb-logout> so native form submission works without JS',
  );
  assert.ok(
    logoutIsland.includes('<form method="post"'),
    'no-JS <form method="post"> must be structurally nested inside <lb-logout> (anchored to actual tag)',
  );
});

test('lb-logout performLogout reads data-logout-url (not a hardcoded path)', () => {
  // Using a hardcoded URL would break stores with custom domain routing.
  // The logout URL must come from the Liquid drop (routes.account_logout_url).
  const src = read('apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx');

  // Island must read the URL from the dataset attribute.
  assert.match(src, /this\.dataset\.logoutUrl/);
  // There must be a fallback for when the attribute is missing.
  assert.match(src, /this\.dataset\.logoutUrl \|\| '\/api\/customer\/logout'/);
});
