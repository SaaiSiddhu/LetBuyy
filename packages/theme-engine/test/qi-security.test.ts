// Phase I QA — Security gap coverage.
// Targets gaps in the existing security test corpus:
//   SEC-1: DOMPurify FORBID_TAGS (base/embed/object) — only <script> was tested before.
//   SEC-2: DOMPurify FORBID_ATTR style= — not individually asserted before.
//   SEC-3: SSTI — Liquid expressions embedded in setting VALUES are output as strings, never re-evaluated.
//   SEC-4: toLiquidDrop depth limit (MAX_LIQUID_DROP_DEPTH=4) — objects at depth >= 4 are dropped.
//   SEC-5: toLiquidDrop key count limit (MAX_LIQUID_DROP_KEYS=80) — keys beyond index 80 are dropped.
//   SEC-6: Prototype-pollution keys (__proto__, constructor, prototype) blocked in liquidContext drops.
//  SEC-6b: __proto__ via JSON.parse (own enumerable) — exercises the key-regex defense in toLiquidDrop.
//   SEC-7: BLOCKED_DROP_KEYS set completeness (exactly 13 credential-adjacent keys).
//   SEC-8: CSS token injection — sanitizeCssTokenValue strips {, }, ;, @, <, > so a crafted
//          primaryColor cannot break out of the :root{} block in buildLiquidThemeHeadAssets output.
//   SEC-9: DOMPurify uponSanitizeAttribute hook strips data-* attrs whose values contain < or >.
//  SEC-10: DOMPurify hook blocks javascript: href and data:text/html src.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
  BLOCKED_DROP_KEYS,
  sanitizeRenderedHtml,
  buildLiquidThemeHeadAssets,
} from '../src/index.ts';
import type { LiquidThemePackageBundle } from '../src/index.ts';

const STORE_ID = 'sec-test-store-0000-0000-000000000000';

// ============================================================================
// SEC-1: DOMPurify removes all FORBID_TAGS: base, embed, object
//        (script was already asserted in theme-engine.test.ts; these three were not)
// ============================================================================

test('SEC-1a DOMPurify sanitizer strips <base> tags (FORBID_TAGS)', async () => {
  const html = await sanitizeRenderedHtml(
    '<base href="https://evil.example.com/"><p class="safe">Content</p>',
  );
  assert.doesNotMatch(html, /<base\b/i, '<base> must be stripped per LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG FORBID_TAGS');
  assert.match(html, /Content/, 'surrounding safe content must be preserved after <base> removal');
});

test('SEC-1b DOMPurify sanitizer strips <embed> tags (FORBID_TAGS)', async () => {
  const html = await sanitizeRenderedHtml(
    '<embed src="https://evil.com/payload.swf" type="application/x-shockwave-flash"><p>Safe</p>',
  );
  assert.doesNotMatch(html, /<embed\b/i, '<embed> must be stripped per FORBID_TAGS');
  assert.match(html, /Safe/, 'adjacent safe content must survive');
});

test('SEC-1c DOMPurify sanitizer strips <object> tags (FORBID_TAGS)', async () => {
  const html = await sanitizeRenderedHtml(
    '<object data="https://evil.com/payload.swf"><param name="movie" value="evil.swf"></object><p>Safe</p>',
  );
  assert.doesNotMatch(html, /<object\b/i, '<object> must be stripped per FORBID_TAGS');
});

// ============================================================================
// SEC-2: DOMPurify strips style= attribute (FORBID_ATTR: ['style'])
// ============================================================================

test('SEC-2 DOMPurify sanitizer strips inline style= attributes (FORBID_ATTR)', async () => {
  const html = await sanitizeRenderedHtml(
    '<div style="color:red;background:url(javascript:alert(1))"><p style="display:none">Hidden text</p></div>',
  );
  assert.doesNotMatch(
    html,
    /\bstyle=/i,
    'style= attribute must be stripped; inline styles in Liquid theme output are forbidden',
  );
  // DOMPurify strips the attribute but keeps the element + text content.
  assert.match(html, /Hidden text/, 'text content inside styled elements must be preserved');
});

// ============================================================================
// SEC-3: SSTI — Liquid tag/filter expressions embedded as setting VALUES are never re-evaluated
//
// LiquidJS renders `{{ section.settings.heading }}` by reading the STRING VALUE from scope.
// The engine does NOT re-parse that string as a template. outputEscape:'escape' HTML-escapes
// the output value. A probe like '{{ 7 | times: 7 }}' must appear as text, never as '49'.
// ============================================================================

test('SEC-3a SSTI probe {{ 7 | times: 7 }} in section settings is not re-evaluated (must not output 49)', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const sstiBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'ssti-test': {
        path: 'sections/ssti-test.liquid',
        source: [
          '<section class="lb-ssti-test" data-section-id="{{ section.id }}">',
          '  <p>{{ section.settings.heading }}</p>',
          '</section>',
          '{% schema %}{"name":"SSTI Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'SSTI Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'ssti-sec': {
            type: 'ssti-test',
            // The VALUE is a Liquid expression string. If re-evaluated it would produce '49'.
            settings: { heading: '{{ 7 | times: 7 }}' },
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['ssti-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'ssti-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: sstiBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Narrow to the <p> element produced by the SSTI section so the assertion does not
  // depend on fixture isolation to avoid incidental '49' values in other sections' output.
  assert.doesNotMatch(
    html,
    /<p>[^<]*49[^<]*<\/p>/,
    'SSTI probe {{ 7 | times: 7 }} must NOT be evaluated; <p>…49…</p> must not appear in rendered output',
  );
});

test('SEC-3b SSTI probe {{ shop.id }} in liquidContext.settings is not re-evaluated', async () => {
  // If liquidContext.settings keys were re-parsed as Liquid, {{ shop.id }} would leak the
  // store ID into the template output independently of the template expression.
  // In correct behavior the string literal is output (escaped), not the shop.id value
  // via a second pass of Liquid evaluation.
  const SENTINEL = 'SSTI-SHOP-PROBE-SENTINEL';
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const sentinelBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'ctx-ssti-test': {
        path: 'sections/ctx-ssti-test.liquid',
        source: [
          '<section class="lb-ctx-ssti-test" data-section-id="{{ section.id }}">',
          '  <p>{{ settings.probeValue }}</p>',
          '</section>',
          '{% schema %}{"name":"Ctx SSTI Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Ctx SSTI Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'ctx-ssti-sec': {
            type: 'ctx-ssti-test',
            settings: {},
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['ctx-ssti-sec'],
      },
    },
  };

  // The probe value is a Liquid expression that WOULD output SENTINEL if re-evaluated.
  // Correct behavior: it is output as a literal string, not executed.
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'ssti-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: sentinelBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: {
      settings: {
        // If re-evaluated as Liquid, would assign+output SENTINEL (truthy condition always passes).
        // filterBlockedSettingsKeys requires keys to match /^[a-zA-Z][a-zA-Z0-9_]*$/.
        probeValue: '{% assign _x = true %}{% if _x %}' + SENTINEL + '{% endif %}',
      },
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Correct behavior: the probe VALUE is output verbatim as a raw string.
  // The {% assign %} / {% if %} tag delimiters are therefore present LITERALLY in the HTML.
  // If the value WERE re-evaluated as Liquid, those tags would be consumed by the parser,
  // producing only SENTINEL with no {% characters in the output.
  // So: the presence of {% in the output is the proof that no re-evaluation happened.
  assert.match(
    html,
    /\{%/,
    'Liquid tag syntax ({%) must appear literally in output — liquidContext.settings values are never re-evaluated as Liquid templates',
  );
});

// ============================================================================
// SEC-4: toLiquidDrop depth limit — objects at depth >= MAX_LIQUID_DROP_DEPTH (4) are dropped.
//        Primitive values (strings) at depth >= 4 are NOT dropped (early return before depth check).
// ============================================================================

test('SEC-4 toLiquidDrop drops nested objects at depth >= 4 but passes primitive values at that depth', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const depthBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'depth-test': {
        path: 'sections/depth-test.liquid',
        source: [
          '<section class="lb-depth-test" data-section-id="{{ section.id }}">',
          '  <span class="d3str">{{ product.level1.level2.level3.strValue }}</span>',
          '  <span class="d4obj">{{ product.level1.level2.level3.level4.value }}</span>',
          '</section>',
          '{% schema %}{"name":"Depth Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Depth Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'depth-sec': { type: 'depth-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['depth-sec'],
      },
    },
  };

  // Depth accounting when toLiquidDrop(product, 0) is called:
  //   depth 0: product (object) → process
  //   depth 1: level1 (object) → process; strValue is a string → early return, bypasses depth check
  //   depth 2: level2 (object) → process
  //   depth 3: level3 (object) → process; strValue (string) at depth 4 → early return, bypasses check
  //   depth 4: level4 (object) → depth >= 4, returns undefined → level4 key is NOT added to output
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'depth-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: depthBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: {
      product: {
        level1: {
          level2: {
            level3: {
              // strValue is a primitive at depth 4 — bypasses the depth check, renders.
              strValue: 'DEPTH-3-STRING-RENDERS',
              // level4 is an object at depth 4 — hits depth >= MAX_LIQUID_DROP_DEPTH, dropped.
              level4: {
                value: 'DEPTH-4-OBJECT-BLOCKED',
              },
            },
          },
        },
      },
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Primitive at depth 4 (string) passes through the early-return guard.
  assert.match(
    html,
    /DEPTH-3-STRING-RENDERS/,
    'string values at depth 4 must pass through (primitive early-return bypass)',
  );

  // Object at depth 4 is blocked by depth >= MAX_LIQUID_DROP_DEPTH=4.
  assert.doesNotMatch(
    html,
    /DEPTH-4-OBJECT-BLOCKED/,
    'nested object at depth 4 must be dropped (MAX_LIQUID_DROP_DEPTH=4 enforcement)',
  );
});

// ============================================================================
// SEC-5: toLiquidDrop key count limit — keys beyond index 80 in Object.entries() are dropped.
// ============================================================================

test('SEC-5 toLiquidDrop drops product keys beyond the 80-key slice (MAX_LIQUID_DROP_KEYS=80)', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // Build a flat object with 82 unique keys: k0..k79 (first 80, within limit)
  // and k80, k81 (keys 81 and 82, beyond the slice(0, 80) limit).
  // All key names start with 'k' + digit, so they pass /^[a-zA-Z][a-zA-Z0-9_]*$/.
  const manyKeysProduct: Record<string, string> = {};
  for (let i = 0; i < 82; i++) {
    manyKeysProduct[`k${i}`] = `VALUE-${i}`;
  }

  const keysBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'keys-test': {
        path: 'sections/keys-test.liquid',
        source: [
          '<section class="lb-keys-test" data-section-id="{{ section.id }}">',
          '  <span id="early">{{ product.k0 }}</span>',
          '  <span id="boundary">{{ product.k79 }}</span>',
          '  <span id="over80">{{ product.k80 }}</span>',
          '  <span id="over81">{{ product.k81 }}</span>',
          '</section>',
          '{% schema %}{"name":"Keys Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Keys Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'keys-sec': { type: 'keys-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['keys-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'keys-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: keysBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: { product: manyKeysProduct },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  // Keys at index 0 and 79 (within the 80-key slice) must render.
  assert.match(html, /VALUE-0/, 'k0 (within MAX_LIQUID_DROP_KEYS=80) must render');
  assert.match(html, /VALUE-79/, 'k79 (at the 80-key boundary) must render');

  // Keys at index 80 and 81 are excluded by .slice(0, MAX_LIQUID_DROP_KEYS).
  // LiquidJS with strictVariables:false outputs empty string for undefined scope access.
  assert.doesNotMatch(html, /VALUE-80/, 'k80 (beyond MAX_LIQUID_DROP_KEYS=80) must be dropped');
  assert.doesNotMatch(html, /VALUE-81/, 'k81 (beyond MAX_LIQUID_DROP_KEYS=80) must be dropped');
});

// ============================================================================
// SEC-6: Prototype-pollution keys — __proto__, constructor, prototype are blocked
//        by the /^[a-zA-Z][a-zA-Z0-9_]*$/ key filter in toLiquidDrop.
// ============================================================================

test('SEC-6 prototype-pollution keys (__proto__, constructor, prototype) are blocked in product drop', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const protoBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'proto-test': {
        path: 'sections/proto-test.liquid',
        source: [
          '<section class="lb-proto-test" data-section-id="{{ section.id }}">',
          '  <span class="safe">{{ product.safeField }}</span>',
          '  <span class="proto">{{ product.__proto__ }}</span>',
          '  <span class="ctor">{{ product.constructor }}</span>',
          '  <span class="prototype">{{ product.prototype }}</span>',
          '</section>',
          '{% schema %}{"name":"Proto Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Proto Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'proto-sec': { type: 'proto-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['proto-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'proto-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: protoBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: {
      product: {
        safeField: 'SAFE-VISIBLE',
        __proto__: { polluted: 'PROTO-LEAKED' },
        constructor: 'CTOR-LEAKED',
        prototype: 'PROTOTYPE-LEAKED',
      },
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  assert.match(html, /SAFE-VISIBLE/, 'safeField must render normally');
  assert.doesNotMatch(html, /PROTO-LEAKED/, '__proto__ value must never reach Liquid scope');
  assert.doesNotMatch(html, /CTOR-LEAKED/, 'constructor value must never reach Liquid scope');
  assert.doesNotMatch(html, /PROTOTYPE-LEAKED/, 'prototype value must never reach Liquid scope');
});

// ============================================================================
// SEC-6b: __proto__ own-enumerable property via JSON.parse (realistic API injection).
//
// A JS object literal `{ __proto__: ... }` sets the prototype chain; Object.entries()
// never surfaces it as a key, so the SEC-6 assertion above is tautological for __proto__.
// The REAL attack vector is a parsed JSON payload where __proto__ IS an own enumerable
// property. This test drives that code path through the renderer to confirm the
// key-regex defense (/^[a-zA-Z][a-zA-Z0-9_]*$/) blocks it even before BLOCKED_DROP_KEYS.
// ============================================================================

test('SEC-6b __proto__ from JSON.parse (own-enumerable) is blocked by the key-regex defense in toLiquidDrop', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // JSON.parse creates __proto__ as an own enumerable property (not a prototype mutation).
  // Object.entries() sees it; the regex /^[a-zA-Z].../ rejects it because it starts with '_'.
  const jsonPayload = JSON.parse('{"safeField":"SAFE-VISIBLE","__proto__":{"polluted":"PROTO-LEAKED"}}') as Record<string, unknown>;

  const protoJsonBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'proto-json-test': {
        path: 'sections/proto-json-test.liquid',
        source: [
          '<section class="lb-proto-json-test" data-section-id="{{ section.id }}">',
          '  <span class="safe">{{ product.safeField }}</span>',
          '  <span class="proto">{{ product.__proto__ }}</span>',
          '</section>',
          '{% schema %}{"name":"Proto JSON Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Proto JSON Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'proto-json-sec': { type: 'proto-json-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['proto-json-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'proto-json-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: protoJsonBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: { product: jsonPayload },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings?.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';

  assert.match(html, /SAFE-VISIBLE/, 'safeField must survive toLiquidDrop and appear in rendered output');
  assert.doesNotMatch(
    html,
    /PROTO-LEAKED/,
    '__proto__ own-property from JSON.parse must be filtered by the key-regex in toLiquidDrop before reaching Liquid scope',
  );
});

// ============================================================================
// SEC-7: BLOCKED_DROP_KEYS completeness — the set must contain exactly 13 entries.
// ============================================================================

test('SEC-7 BLOCKED_DROP_KEYS contains exactly the 13 required credential-adjacent keys', () => {
  const required = [
    '__proto__',
    'constructor',
    'prototype',
    'password',
    'password_hash',
    'access_token',
    'refresh_token',
    'signing_secret',
    'client_secret',
    'api_key',
    'secret_key',
    'private_key',
    'webhook_secret',
  ] as const;

  for (const key of required) {
    assert.ok(
      BLOCKED_DROP_KEYS.has(key),
      `BLOCKED_DROP_KEYS must contain "${key}"`,
    );
  }

  assert.equal(
    BLOCKED_DROP_KEYS.size,
    required.length,
    `BLOCKED_DROP_KEYS must have exactly ${required.length} entries; if a key was added or removed, update this regression pin`,
  );
});

// ============================================================================
// SEC-8: CSS token injection — sanitizeCssTokenValue strips {, }, ;, @, <, > from CSS values.
//        A crafted primaryColor cannot break out of the :root{} block.
// ============================================================================

test('SEC-8 buildLiquidThemeHeadAssets neutralises CSS injection in settings_data token values', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();

  // Poison the primaryColor with a CSS break-out attempt:
  // '} body { background: url(javascript:alert(1)) !important; --x'
  // sanitizeCssTokenValue strips { } ; @ ( ) so the declaration cannot break out.
  const poisonedBundle = {
    ...bundle,
    config: {
      ...bundle.config,
      settings_data: {
        ...bundle.config.settings_data,
        current: {
          ...bundle.config.settings_data.current,
          primaryColor: '#ff0000; } body { background: url(javascript:alert(1)) !important; --x',
        },
      },
    },
  };

  const headAssets = buildLiquidThemeHeadAssets(poisonedBundle as LiquidThemePackageBundle);

  // The :root block must still be present (valid CSS generation continues).
  assert.match(headAssets, /:root\{/, 'head assets must still contain a valid :root CSS block');
  assert.match(headAssets, /--primary:/, '--primary CSS variable must still be declared');

  // The injection attempt must be neutralised: no closing brace followed by a new rule.
  // sanitizeCssTokenValue replaces [<>{};@()] with '', so '}' and '{' are stripped.
  assert.doesNotMatch(
    headAssets,
    /\}\s*body\s*\{/,
    'CSS break-out attempt (} body {) must be neutralised by sanitizeCssTokenValue',
  );
  assert.doesNotMatch(
    headAssets,
    /url\(javascript:/i,
    'CSS javascript: URL injection must be stripped from token value',
  );
});

// ============================================================================
// SEC-9: DOMPurify uponSanitizeAttribute hook strips data-* attrs containing < or >
// ============================================================================

test('SEC-9 DOMPurify hook removes data-* attributes whose values contain < or > (XSS via data attribute)', async () => {
  const html = await sanitizeRenderedHtml(
    '<div data-product-name="Shoe<script>alert(1)</script>" data-product-id="safe-prod-123">content</div>',
  );
  // The hook: if (attrName.startsWith('data-') && (attrValue.includes('<') || attrValue.includes('>')))
  //   data.keepAttr = false;
  assert.doesNotMatch(
    html,
    /data-product-name=/,
    'data-product-name with < in value must be stripped by uponSanitizeAttribute hook',
  );
  // Clean data-product-id must survive (no < or > in value).
  assert.match(
    html,
    /data-product-id="safe-prod-123"/,
    'clean data-product-id (no < or >) must be preserved by sanitizer',
  );
  // The script content must not escape into the document.
  assert.doesNotMatch(html, /<script/i, 'script tag within attribute value must be neutralised');
});

// ============================================================================
// SEC-10: DOMPurify hook blocks javascript: in href and data:text/html in src
// ============================================================================

test('SEC-10 DOMPurify hook blocks javascript: href and data:text/html src', async () => {
  const html = await sanitizeRenderedHtml([
    '<a href="javascript:alert(1)">js link</a>',
    '<img src="data:text/html,<script>alert(1)</script>" alt="bad image">',
    '<a href="/products/safe-link">safe link</a>',
  ].join('\n'));

  assert.doesNotMatch(
    html,
    /href="javascript:/i,
    'javascript: href must be removed by uponSanitizeAttribute hook (isUrlAttribute + normalizedValue check)',
  );
  assert.doesNotMatch(
    html,
    /src="data:text\/html/i,
    'data:text/html src must be removed by uponSanitizeAttribute hook',
  );
  // The safe href must survive.
  assert.match(
    html,
    /href="\/products\/safe-link"/,
    'safe relative href must be preserved by sanitizer',
  );
});
