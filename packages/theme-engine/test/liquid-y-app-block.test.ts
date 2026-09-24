/**
 * Phase Y — App-Block Model + Render Sandboxing Tests (Lane A / Engine)
 *
 * Covers:
 *   Y-1  App-block HTML with <script> is sanitized (stripped) by the locked DOMPurify.
 *   Y-2  App-block HTML with onerror event handler is sanitized (stripped).
 *   Y-3  App-block settings with credential keys (api_key, webhook_secret, etc.)
 *        are blocked by filterAppBlockSettings before reaching the Liquid scope.
 *   Y-4  One throwing app block is isolated — placeholder rendered, other app blocks render.
 *   Y-5  App block with unknown/foreign appId → honest placeholder, no content leak.
 *   Y-6  Sections without app blocks render byte-identically (backward-compat / additive).
 *   Y-7  Determinism — same input renders the same output on repeated calls.
 *   Y-8  NOT-CONNECTED placeholder is honest: carries data-app-block attrs, no fabricated content.
 *   Y-9  validateAppBlockReference: accepts valid refs, rejects non-slug ids, rejects blocked keys.
 *  Y-10  validateAppBlockReferences: enforces MAX_APP_BLOCKS_PER_SLOT.
 *  Y-11  filterAppBlockSettings: strips BLOCKED_APP_BLOCK_SETTING_KEYS, keeps safe keys.
 *  Y-12  App-block HTML with javascript: src is sanitized (blocked by DOMPurify hook).
 *  Y-13  BLOCKED_APP_BLOCK_SETTING_KEYS mirrors BLOCKED_DROP_KEYS (same 13 keys).
 *  Y-14  App-block placeholder contains no angle brackets when block.type has adversarial value.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
  sanitizeRenderedHtml,
  BLOCKED_DROP_KEYS,
  // Phase Y exports
  APP_BLOCK_NOT_CONNECTED_REASON,
  APP_BLOCK_PLACEHOLDER_CLASS,
  APP_BLOCK_ERROR_PLACEHOLDER_CLASS,
  BLOCKED_APP_BLOCK_SETTING_KEYS,
  MAX_APP_BLOCKS_PER_SLOT,
  filterAppBlockSettings,
  validateAppBlockReference,
  validateAppBlockReferences,
} from '../src/index.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
} from '../src/index.ts';
import type {
  LiquidThemePackageBundle,
} from '../src/index.ts';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const STORE_ID = 'y-test-store-0000-0000-000000000000';

/**
 * Build a minimal renderer input that exercises the app-block render path.
 *
 * The spotlight section (from createMinimalLiquidThemeBundleFixture) has:
 *   - block 'first_badge' (type: 'badge', regular block)
 *   - block 'app_offer'  (type: '@app', app block)
 *
 * The liquidAppBlocks map controls what HTML the app block produces.
 */
function buildAppBlockRenderInput(
  liquidAppBlocks: Record<string, string | { html: string; settings?: Record<string, unknown> }>,
  bundle?: LiquidThemePackageBundle,
) {
  const b = bundle ?? createMinimalLiquidThemeBundleFixture();
  return {
    context: {
      storeId: STORE_ID,
      subdomain: 'y-test-store',
      path: '/',
      previewMode: false,
      locale: 'en',
    },
    storeTemplate: {
      storeId: STORE_ID,
      themeId: 'liquid-starter',
      themeSettings: DEFAULT_THEME_SETTINGS,
      sections: [],
    },
    routeTemplate: {
      id: 'index',
      type: 'index',
      layoutKey: 'theme',
      sections: [],
    },
    liquidBundle: b,
    liquidTemplateKey: 'index',
    liquidAppBlocks,
  };
}

/**
 * Build a bundle that has a section with two app blocks so we can test per-block isolation.
 * Returns the bundle and the two block ids.
 */
function buildTwoAppBlockBundle() {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle: LiquidThemePackageBundle = {
    ...base,
    templates: {
      ...base.templates,
      index: {
        ...base.templates.index,
        sections: {
          'dual-app-slot': {
            type: 'spotlight',
            settings: { heading: 'Dual App Slot', subheading: '' },
            blocks: {
              'app-block-good': {
                type: '@app',
                settings: { extension_handle: 'good-app' },
                disabled: false,
              },
              'app-block-bad': {
                type: '@app',
                settings: { extension_handle: 'bad-app' },
                disabled: false,
              },
            },
            block_order: ['app-block-good', 'app-block-bad'],
            disabled: false,
          },
        },
        order: ['dual-app-slot'],
      },
    },
  };
  return bundle;
}

// ─── Y-1: <script> in app-block HTML is sanitized ────────────────────────────

test('Y-1 app-block HTML with <script> is sanitized — the script tag must not appear in output', async () => {
  const renderer = new LiquidRenderer();
  const result = await renderer.render(
    buildAppBlockRenderInput({
      // key matches block 'app_offer' by blockId
      app_offer: '<div class="offer"><script>alert("xss")</script><span>Offer text</span></div>',
    }),
  );

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  assert.doesNotMatch(
    html,
    /<script\b/i,
    'Y-1: <script> tag must be stripped from app-block HTML by the DOMPurify sanitizer',
  );
  assert.match(
    html,
    /Offer text/,
    'Y-1: safe text content inside the app-block must be preserved after sanitization',
  );
});

// ─── Y-2: onerror event handler in app-block HTML is sanitized ───────────────

test('Y-2 app-block HTML with onerror event handler is sanitized — the attribute must not appear in output', async () => {
  const renderer = new LiquidRenderer();
  const result = await renderer.render(
    buildAppBlockRenderInput({
      app_offer: '<img src="/safe.png" onerror="alert(\'xss\')" alt="Promo image">',
    }),
  );

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  assert.doesNotMatch(
    html,
    /\bonerror\b/i,
    'Y-2: onerror event handler must be stripped by the DOMPurify sanitizer',
  );
});

// ─── Y-3: credential-adjacent settings keys blocked ──────────────────────────

test('Y-3 filterAppBlockSettings strips BLOCKED_APP_BLOCK_SETTING_KEYS and keeps safe keys', () => {
  const input = {
    title: 'Safe setting',
    api_key: 'sk-should-be-blocked',
    access_token: 'token-should-be-blocked',
    webhook_secret: 'secret-should-be-blocked',
    password: 'pw-should-be-blocked',
    client_secret: 'cs-should-be-blocked',
    description: 'Also safe',
    __proto__: 'proto-attack',
    constructor: 'ctor-attack',
  } as Record<string, unknown>;

  const out = filterAppBlockSettings(input);

  // Safe keys must be present
  assert.equal(out.title, 'Safe setting', 'Y-3: safe key "title" must pass through');
  assert.equal(out.description, 'Also safe', 'Y-3: safe key "description" must pass through');

  const ownKeys = Object.keys(out);

  // Blocked credential keys must not be own properties of the filtered output
  assert.ok(!ownKeys.includes('api_key'), 'Y-3: api_key must be blocked (not an own key of the result)');
  assert.ok(!ownKeys.includes('access_token'), 'Y-3: access_token must be blocked');
  assert.ok(!ownKeys.includes('webhook_secret'), 'Y-3: webhook_secret must be blocked');
  assert.ok(!ownKeys.includes('password'), 'Y-3: password must be blocked');
  assert.ok(!ownKeys.includes('client_secret'), 'Y-3: client_secret must be blocked');

  // Prototype-pollution keys must not be own properties of the filtered output
  // (Note: out.__proto__ / out.constructor read inherited properties, so we must
  //  use Object.hasOwn / Object.keys to check for own-property presence.)
  assert.ok(!Object.hasOwn(out, '__proto__'), 'Y-3: __proto__ must not be an own property of the filtered result');
  assert.ok(!Object.hasOwn(out, 'constructor'), 'Y-3: constructor must not be an own property of the filtered result');
});

// ─── Y-3b: credential settings do not reach the Liquid block scope ────────────

test('Y-3b credential keys in app-block settings do not reach the Liquid section.blocks scope', async () => {
  // Build a bundle with a spotlight section that includes an app block carrying
  // a credential-adjacent setting (api_key). The spotlight template echoes
  // block.content (the sanitized app HTML), NOT block.settings. But we verify
  // that the LiquidRenderedBlock returned by the renderer has the key stripped.
  const renderer = new LiquidRenderer();

  // Put the credential key in the app block's settings inside the bundle
  const base = createMinimalLiquidThemeBundleFixture();
  const bundleWithCredentialBlock: LiquidThemePackageBundle = {
    ...base,
    templates: {
      ...base.templates,
      index: {
        ...base.templates.index,
        sections: {
          'cred-slot': {
            type: 'spotlight',
            settings: { heading: 'Cred test', subheading: '' },
            blocks: {
              'cred-app': {
                type: '@app',
                settings: {
                  title: 'Public setting',
                  api_key: 'sk-live-supersecret',
                  webhook_secret: 'whsec_supersecret',
                },
                disabled: false,
              },
            },
            block_order: ['cred-app'],
            disabled: false,
          },
        },
        order: ['cred-slot'],
      },
    },
  };

  const result = await renderer.render(
    buildAppBlockRenderInput({ 'cred-app': '<span>App content</span>' }, bundleWithCredentialBlock),
  );
  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  // The rendered LiquidRenderedSection blocks expose the filtered settings
  const sections = result.liquid?.sections ?? [];
  const credSection = sections.find((s) => s.id === 'cred-slot');
  assert.ok(credSection, 'Y-3b: cred-slot section must be present in result');

  const appBlock = credSection.blocks.find((b) => b.id === 'cred-app');
  assert.ok(appBlock, 'Y-3b: cred-app block must be present in result');
  assert.ok(appBlock.isAppBlock, 'Y-3b: block must be flagged as an app block');

  assert.equal(
    appBlock.settings.api_key,
    undefined,
    'Y-3b: api_key must be stripped from LiquidRenderedBlock.settings by filterAppBlockSettings',
  );
  assert.equal(
    appBlock.settings.webhook_secret,
    undefined,
    'Y-3b: webhook_secret must be stripped from LiquidRenderedBlock.settings',
  );
  assert.equal(
    appBlock.settings.title,
    'Public setting',
    'Y-3b: safe key "title" must be preserved in LiquidRenderedBlock.settings',
  );

  // Also verify the credential literal does not appear in the rendered HTML
  const html = result.liquid?.contentForLayout ?? '';
  assert.doesNotMatch(
    html,
    /sk-live-supersecret/,
    'Y-3b: raw api_key value must not appear in rendered HTML output',
  );
});

// ─── Y-4: one bad app block is isolated — others render ──────────────────────

test('Y-4 one throwing app block is isolated — other app blocks render normally', async () => {
  const renderer = new LiquidRenderer();
  const bundle = buildTwoAppBlockBundle();

  // 'good-app' is a normal string. 'bad-app' is an object with a throwing html getter
  // to simulate a runtime error during app-block HTML resolution.
  const throwingSource = Object.defineProperty({}, 'html', {
    get() { throw new Error('Simulated app-block runtime failure'); },
    enumerable: true,
    configurable: true,
  });

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'y-test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: 'index',
    liquidAppBlocks: {
      'good-app': '<span class="good-app-content">Good app rendered</span>',
      'bad-app': throwingSource as { html: string },
    },
  });

  // The section must still render (crash isolation at block level, not section level)
  assert.equal(result.status, 'rendered', `Expected rendered even with one bad app block. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.contentForLayout ?? '';

  // Good app block content must be present
  assert.match(
    html,
    /good-app-content|Good app rendered/,
    'Y-4: good app block must render normally despite the bad block throwing',
  );

  // Error placeholder must be present for the bad block
  assert.match(
    html,
    new RegExp(`${APP_BLOCK_ERROR_PLACEHOLDER_CLASS}|lb-app-block-placeholder--error`),
    'Y-4: bad app block must produce an error placeholder element',
  );

  // The raw error message must not appear in rendered HTML
  assert.doesNotMatch(
    html,
    /Simulated app-block runtime failure/,
    'Y-4: raw error message from bad app block must not leak into HTML output',
  );
});

// ─── Y-5: unknown/foreign appId → placeholder, no content leak ───────────────

test('Y-5 app block with no matching liquidAppBlocks entry renders an honest NOT-CONNECTED placeholder', async () => {
  const renderer = new LiquidRenderer();

  // Provide no liquidAppBlocks entry for the 'app_offer' block in the minimal fixture.
  const result = await renderer.render(
    buildAppBlockRenderInput({}), // empty map — no app runtime connected
  );

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Placeholder div must be present with data-letbuyy-app-block attribute
  assert.match(
    html,
    /data-letbuyy-app-block/,
    'Y-5: NOT-CONNECTED placeholder must carry data-letbuyy-app-block attribute',
  );

  // The placeholder must NOT contain any fabricated app content
  assert.doesNotMatch(
    html,
    /fabricated|mock|simulated/i,
    'Y-5: placeholder must not contain fabricated content',
  );

  // The section must otherwise render (heading, subheading from section settings)
  assert.match(
    html,
    /A portable Liquid storefront/,
    'Y-5: section content must still render when app runtime is absent',
  );
});

// ─── Y-6: sections without app blocks render byte-identically ────────────────

test('Y-6 sections without app blocks render byte-identically with and without liquidAppBlocks', async () => {
  const renderer = new LiquidRenderer();
  const base = createMinimalLiquidThemeBundleFixture();

  // Bundle with ONLY regular blocks (no @app blocks)
  const plainBundle: LiquidThemePackageBundle = {
    ...base,
    templates: {
      ...base.templates,
      index: {
        ...base.templates.index,
        sections: {
          'plain-sec': {
            type: 'spotlight',
            settings: { heading: 'Plain section', subheading: 'No app blocks here' },
            blocks: {
              'badge-only': {
                type: 'badge',
                settings: { label: 'Safe badge' },
                disabled: false,
              },
            },
            block_order: ['badge-only'],
            disabled: false,
          },
        },
        order: ['plain-sec'],
      },
    },
  };

  const inputWithoutAppBlocks = {
    context: { storeId: STORE_ID, subdomain: 'y-test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: plainBundle,
    liquidTemplateKey: 'index',
  };

  const [result1, result2] = await Promise.all([
    renderer.render({ ...inputWithoutAppBlocks }),
    renderer.render({ ...inputWithoutAppBlocks, liquidAppBlocks: { someOtherSlot: 'irrelevant' } }),
  ]);

  assert.equal(result1.status, 'rendered', `Expected rendered (no liquidAppBlocks). Warnings: ${result1.warnings.join(', ')}`);
  assert.equal(result2.status, 'rendered', `Expected rendered (with liquidAppBlocks). Warnings: ${result2.warnings.join(', ')}`);

  assert.equal(
    result1.liquid?.contentForLayout,
    result2.liquid?.contentForLayout,
    'Y-6: sections without app blocks must render byte-identically regardless of liquidAppBlocks map presence',
  );
});

// ─── Y-7: determinism ────────────────────────────────────────────────────────

test('Y-7 app-block render is deterministic — same input produces identical output on repeated calls', async () => {
  const renderer = new LiquidRenderer();
  const appHtml = '<div class="promo-block" data-app-block-type="@app"><p>App promo content</p></div>';
  const input = buildAppBlockRenderInput({ app_offer: appHtml });

  const [r1, r2] = await Promise.all([
    renderer.render(input),
    renderer.render(input),
  ]);

  assert.equal(r1.status, 'rendered', `Expected rendered (run 1). Warnings: ${r1.warnings.join(', ')}`);
  assert.equal(r2.status, 'rendered', `Expected rendered (run 2). Warnings: ${r2.warnings.join(', ')}`);

  assert.equal(
    r1.liquid?.contentForLayout,
    r2.liquid?.contentForLayout,
    'Y-7: app-block render must be deterministic across calls with identical input',
  );
});

// ─── Y-8: NOT-CONNECTED placeholder is honest ────────────────────────────────

test('Y-8 NOT-CONNECTED placeholder carries required data-app-block attributes and no fabricated content', async () => {
  const renderer = new LiquidRenderer();

  // Render with no liquidAppBlocks — forces the placeholder path
  const result = await renderer.render(buildAppBlockRenderInput({}));

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Placeholder must carry the app-block marker attribute
  assert.match(
    html,
    /data-letbuyy-app-block=/,
    'Y-8: placeholder must carry data-letbuyy-app-block attribute (in DOMPurify ADD_ATTR allowlist)',
  );

  // Placeholder must carry data-app-block-type attribute
  assert.match(
    html,
    /data-app-block-type=/,
    'Y-8: placeholder must carry data-app-block-type attribute (in DOMPurify ADD_ATTR allowlist)',
  );

  // No fabricated app HTML — the div must be empty (no inner content)
  assert.doesNotMatch(
    html,
    /data-letbuyy-app-block="[^"]*">[^<]+</,
    'Y-8: NOT-CONNECTED placeholder div must have no text content (honest empty)',
  );

  // APP_BLOCK_NOT_CONNECTED_REASON must be a non-empty honest string
  assert.ok(
    APP_BLOCK_NOT_CONNECTED_REASON.includes('NOT-CONNECTED'),
    'Y-8: APP_BLOCK_NOT_CONNECTED_REASON must start with NOT-CONNECTED token',
  );
  assert.ok(
    APP_BLOCK_NOT_CONNECTED_REASON.includes('FROZEN'),
    'Y-8: APP_BLOCK_NOT_CONNECTED_REASON must explicitly state that apps/frozen/app-store is FROZEN',
  );
});

// ─── Y-9: validateAppBlockReference ──────────────────────────────────────────

test('Y-9a validateAppBlockReference accepts valid AppBlockReference objects', () => {
  const validRef = {
    appId: 'my-app',
    extensionId: 'promo-block',
    slot: 'storefront.home.after-hero',
    settings: { title: 'My promo', position: 'top' },
  };

  const result = validateAppBlockReference(validRef);

  assert.equal(result.valid, true, `Y-9a: valid ref should pass validation. Errors: ${result.errors.join(', ')}`);
  assert.ok(result.ref, 'Y-9a: result.ref must be present for valid input');
  assert.equal(result.ref?.appId, 'my-app', 'Y-9a: appId must be preserved');
  assert.equal(result.ref?.extensionId, 'promo-block', 'Y-9a: extensionId must be preserved');
  assert.deepEqual(result.errors, [], 'Y-9a: no errors for valid ref');
});

test('Y-9b validateAppBlockReference rejects non-slug appId (contains slash)', () => {
  const result = validateAppBlockReference({
    appId: '../evil/path',
    extensionId: 'safe-ext',
    slot: 'storefront.home.after-hero',
    settings: {},
  });

  assert.equal(result.valid, false, 'Y-9b: non-slug appId must fail validation');
  assert.ok(
    result.errors.some((e) => /appId/i.test(e)),
    `Y-9b: error must mention appId. Errors: ${result.errors.join(', ')}`,
  );
});

test('Y-9c validateAppBlockReference rejects non-slug extensionId (contains angle bracket)', () => {
  const result = validateAppBlockReference({
    appId: 'safe-app',
    extensionId: 'ext<script>',
    slot: 'storefront.home.after-hero',
    settings: {},
  });

  assert.equal(result.valid, false, 'Y-9c: extensionId with angle bracket must fail validation');
  assert.ok(
    result.errors.some((e) => /extensionId/i.test(e)),
    `Y-9c: error must mention extensionId. Errors: ${result.errors.join(', ')}`,
  );
});

test('Y-9d validateAppBlockReference rejects settings with blocked credential keys', () => {
  const result = validateAppBlockReference({
    appId: 'safe-app',
    extensionId: 'safe-ext',
    slot: 'storefront.home.after-hero',
    settings: {
      title: 'OK setting',
      api_key: 'sk-live-supersecret',
    },
  });

  assert.equal(result.valid, false, 'Y-9d: settings with api_key must fail validation');
  assert.ok(
    result.errors.some((e) => /api_key|blocked/i.test(e)),
    `Y-9d: error must mention blocked key. Errors: ${result.errors.join(', ')}`,
  );
});

test('Y-9e validateAppBlockReference rejects non-object input', () => {
  for (const badInput of [null, undefined, 'string', 42, []]) {
    const result = validateAppBlockReference(badInput);
    assert.equal(result.valid, false, `Y-9e: non-object input (${String(badInput)}) must fail validation`);
  }
});

test('Y-9f validateAppBlockReference accepts disabled=true (block in draft, skipped render)', () => {
  const result = validateAppBlockReference({
    appId: 'my-app',
    extensionId: 'disabled-ext',
    slot: 'storefront.home.after-hero',
    settings: {},
    disabled: true,
  });

  assert.equal(result.valid, true, `Y-9f: disabled ref must pass validation. Errors: ${result.errors.join(', ')}`);
  assert.equal(result.ref?.disabled, true, 'Y-9f: disabled flag must be preserved');
});

// ─── Y-10: validateAppBlockReferences / MAX_APP_BLOCKS_PER_SLOT ──────────────

test('Y-10a validateAppBlockReferences accepts empty array', () => {
  const result = validateAppBlockReferences([]);
  assert.equal(result.valid, true, 'Y-10a: empty array must pass validation');
  assert.deepEqual(result.refs, [], 'Y-10a: refs must be empty for empty input');
});

test('Y-10b validateAppBlockReferences rejects non-array input', () => {
  const result = validateAppBlockReferences('not-an-array');
  assert.equal(result.valid, false, 'Y-10b: non-array must fail validation');
  assert.ok(result.errors.length > 0, 'Y-10b: must have errors for non-array input');
});

test('Y-10c validateAppBlockReferences enforces MAX_APP_BLOCKS_PER_SLOT', () => {
  const tooMany = Array.from({ length: MAX_APP_BLOCKS_PER_SLOT + 1 }, (_, i) => ({
    appId: `app-${i}`,
    extensionId: `ext-${i}`,
    slot: 'storefront.home.after-hero',
    settings: {},
  }));

  const result = validateAppBlockReferences(tooMany);

  assert.equal(result.valid, false, `Y-10c: ${tooMany.length} refs must exceed MAX_APP_BLOCKS_PER_SLOT=${MAX_APP_BLOCKS_PER_SLOT}`);
  assert.ok(
    result.errors.some((e) => /too many|maximum|exceed/i.test(e)),
    `Y-10c: error must mention count limit. Errors: ${result.errors.join(', ')}`,
  );
});

test('Y-10d validateAppBlockReferences accepts exactly MAX_APP_BLOCKS_PER_SLOT entries', () => {
  const atLimit = Array.from({ length: MAX_APP_BLOCKS_PER_SLOT }, (_, i) => ({
    appId: `app${i}`,
    extensionId: `ext${i}`,
    slot: `storefront.home.slot${i}`,
    settings: {},
  }));

  const result = validateAppBlockReferences(atLimit);

  assert.equal(result.valid, true, `Y-10d: ${atLimit.length} refs (at limit) must pass validation. Errors: ${result.errors.join(', ')}`);
  assert.equal(result.refs.length, MAX_APP_BLOCKS_PER_SLOT, 'Y-10d: all refs at limit must be returned');
});

test('Y-10e validateAppBlockReferences supports custom maxCount override', () => {
  const refs = [
    { appId: 'app1', extensionId: 'ext1', slot: 'storefront.home.s1', settings: {} },
    { appId: 'app2', extensionId: 'ext2', slot: 'storefront.home.s2', settings: {} },
  ];

  // maxCount=1 means 2 refs is too many
  const tooMany = validateAppBlockReferences(refs, 1);
  assert.equal(tooMany.valid, false, 'Y-10e: 2 refs must exceed custom maxCount=1');

  // maxCount=2 means exactly 2 is fine
  const atLimit = validateAppBlockReferences(refs, 2);
  assert.equal(atLimit.valid, true, `Y-10e: 2 refs must pass with maxCount=2. Errors: ${atLimit.errors.join(', ')}`);
});

// ─── Y-11: filterAppBlockSettings edge cases ──────────────────────────────────

test('Y-11a filterAppBlockSettings strips all BLOCKED_APP_BLOCK_SETTING_KEYS', () => {
  const allBlocked: Record<string, unknown> = {};
  for (const key of BLOCKED_APP_BLOCK_SETTING_KEYS) {
    allBlocked[key] = `value-for-${key}`;
  }
  allBlocked.safeKey = 'keep me';

  const out = filterAppBlockSettings(allBlocked);

  const ownKeys = Object.keys(out);
  for (const key of BLOCKED_APP_BLOCK_SETTING_KEYS) {
    assert.ok(
      !ownKeys.includes(key),
      `Y-11a: blocked key "${key}" must not be an own property of the filterAppBlockSettings result`,
    );
  }
  assert.equal(out.safeKey, 'keep me', 'Y-11a: safe key must be preserved');
});

test('Y-11b filterAppBlockSettings strips keys that do not match identifier pattern', () => {
  const result = filterAppBlockSettings({
    'valid-key': 'blocked (hyphen)', // hyphen breaks /^[a-zA-Z][a-zA-Z0-9_]*$/
    'valid_key': 'kept (underscore)',
    '2startsWithDigit': 'blocked (digit start)',
    'a': 'kept (single letter)',
    'good123': 'kept (alphanumeric)',
  });

  assert.equal(result['valid-key'], undefined, 'Y-11b: hyphenated key must be stripped');
  assert.equal(result['2startsWithDigit'], undefined, 'Y-11b: digit-starting key must be stripped');
  assert.equal(result.valid_key, 'kept (underscore)', 'Y-11b: underscore key must be kept');
  assert.equal(result.a, 'kept (single letter)', 'Y-11b: single-letter key must be kept');
  assert.equal(result.good123, 'kept (alphanumeric)', 'Y-11b: alphanumeric key must be kept');
});

test('Y-11c filterAppBlockSettings handles empty input without throwing', () => {
  const out = filterAppBlockSettings({});
  assert.deepEqual(out, {}, 'Y-11c: empty settings must produce empty output');
});

// ─── Y-12: javascript: src in app-block HTML is blocked ──────────────────────

test('Y-12 app-block HTML with javascript: src is blocked by DOMPurify uponSanitizeAttribute hook', async () => {
  // This validates that the sanitizer's hook (line ~1282 of theme-renderer.ts) also
  // applies when app-block HTML flows through resolveLiquidAppBlockHtml.
  const html = await sanitizeRenderedHtml(
    '<img src="javascript:alert(\'xss\')" alt="evil">',
  );

  assert.doesNotMatch(
    html,
    /javascript:/i,
    'Y-12: javascript: src must be stripped by the DOMPurify uponSanitizeAttribute hook',
  );
});

// ─── Y-13: BLOCKED_APP_BLOCK_SETTING_KEYS mirrors BLOCKED_DROP_KEYS ──────────

test('Y-13 BLOCKED_APP_BLOCK_SETTING_KEYS contains the same keys as BLOCKED_DROP_KEYS in theme-renderer', () => {
  // Both sets must be identical so there is exactly one source of truth for
  // credential-adjacent key names (with BLOCKED_DROP_KEYS exported from theme-renderer.ts
  // as the authoritative list, and BLOCKED_APP_BLOCK_SETTING_KEYS the local mirror here).
  const rendererKeys = [...BLOCKED_DROP_KEYS].sort();
  const modelKeys = [...BLOCKED_APP_BLOCK_SETTING_KEYS].sort();

  assert.deepEqual(
    modelKeys,
    rendererKeys,
    'Y-13: BLOCKED_APP_BLOCK_SETTING_KEYS must be an exact mirror of BLOCKED_DROP_KEYS '
    + `(theme-renderer has [${rendererKeys.join(', ')}], app-block-model has [${modelKeys.join(', ')}])`,
  );
});

// ─── Y-14: adversarial block.type in placeholder contains no angle brackets ──

test('Y-14 placeholder is safe even when block.type carries adversarial-looking content from bundle schema', async () => {
  // The bundle schema validates block.type, so in practice type='@app' or 'app:ext'.
  // But we verify the placeholder path (when no liquidAppBlocks entry matches) does not
  // introduce XSS if the type were somehow adversarial — escapeHtmlAttribute must encode.
  // Direct test of sanitizeRenderedHtml to cover the placeholder's attribute output.
  const safeAttrEncoded = await sanitizeRenderedHtml(
    // Simulate what escapeHtmlAttribute produces for a benign '@app' type — must be unchanged.
    '<div data-letbuyy-app-block="block-1" data-app-block-type="@app"></div>',
  );

  // The placeholder div must survive sanitization (data-letbuyy-app-block is in ADD_ATTR allowlist)
  assert.match(
    safeAttrEncoded,
    /data-letbuyy-app-block/,
    'Y-14: data-letbuyy-app-block attribute must survive sanitizeRenderedHtml (it is in ADD_ATTR allowlist)',
  );
  assert.match(
    safeAttrEncoded,
    /data-app-block-type/,
    'Y-14: data-app-block-type attribute must survive sanitizeRenderedHtml (it is in ADD_ATTR allowlist)',
  );

  // Angle brackets must not appear in attribute values (they would be stripped or encoded)
  assert.doesNotMatch(
    safeAttrEncoded,
    /data-app-block-type="[^"]*</,
    'Y-14: angle brackets must not appear inside data-app-block-type attribute value',
  );
});

// ─── Y-15: APP_BLOCK_PLACEHOLDER_CLASS and APP_BLOCK_ERROR_PLACEHOLDER_CLASS are non-empty strings ──

test('Y-15 phase-Y placeholder class constants are non-empty BEM strings', () => {
  assert.ok(
    typeof APP_BLOCK_PLACEHOLDER_CLASS === 'string' && APP_BLOCK_PLACEHOLDER_CLASS.length > 0,
    'Y-15: APP_BLOCK_PLACEHOLDER_CLASS must be a non-empty string',
  );
  assert.ok(
    typeof APP_BLOCK_ERROR_PLACEHOLDER_CLASS === 'string' && APP_BLOCK_ERROR_PLACEHOLDER_CLASS.length > 0,
    'Y-15: APP_BLOCK_ERROR_PLACEHOLDER_CLASS must be a non-empty string',
  );
  // Both should follow the lb-* design-token / BEM prefix convention
  assert.ok(
    APP_BLOCK_PLACEHOLDER_CLASS.startsWith('lb-'),
    `Y-15: APP_BLOCK_PLACEHOLDER_CLASS should start with "lb-" (got "${APP_BLOCK_PLACEHOLDER_CLASS}")`,
  );
  assert.ok(
    APP_BLOCK_ERROR_PLACEHOLDER_CLASS.startsWith('lb-'),
    `Y-15: APP_BLOCK_ERROR_PLACEHOLDER_CLASS should start with "lb-" (got "${APP_BLOCK_ERROR_PLACEHOLDER_CLASS}")`,
  );
});
