// ============================================================================
// Phase V — Template Registry Tests
// ============================================================================

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TEMPLATE_TYPE_REGISTRY,
  REGISTRY_BASE_TYPE_COUNT,
  MAX_TEMPLATE_VARIANTS_PER_TYPE,
  MAX_TEMPLATE_KEY_LENGTH,
  parseTemplateKey,
  validateTemplateKey,
  resolveAlternateTemplate,
  getAllowedDropsForTemplate,
  findExcessiveVariantCounts,
  InvalidTemplateKeyError,
} from '../src/template-registry.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
} from '../src/index.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import {
  toThemeDocumentV2,
  fromThemeDocumentV2,
  parseThemeDocument,
} from '../src/theme-document.ts';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: MAX_TEMPLATE_VARIANTS_PER_TYPE is 20', () => {
  assert.equal(MAX_TEMPLATE_VARIANTS_PER_TYPE, 20);
});

test('template-registry: MAX_TEMPLATE_KEY_LENGTH is 120', () => {
  assert.equal(MAX_TEMPLATE_KEY_LENGTH, 120);
});

test('template-registry: TEMPLATE_TYPE_REGISTRY is frozen (immutable)', () => {
  assert.ok(Object.isFrozen(TEMPLATE_TYPE_REGISTRY), 'registry must be frozen');
});

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRY COVERAGE — all expected base keys are present
// ──────────────────────────────────────────────────────────────────────────────

const EXPECTED_BASE_KEYS = [
  // Core commerce
  'index', 'product', 'collection', 'list-collections',
  // Content
  'page', 'policy', 'blog', 'article',
  // Transactional
  'cart', 'search',
  // Special
  'not_found', 'password', 'gift_card',
  // Customer templates (bundle slash-key format)
  'customers/login', 'customers/register', 'customers/account',
  'customers/orders', 'customers/order', 'customers/addresses',
  'customers/settings', 'customers/wishlist',
  'customers/reset', 'customers/activate',
] as const;

for (const key of EXPECTED_BASE_KEYS) {
  test(`template-registry: registry contains base key "${key}"`, () => {
    assert.ok(key in TEMPLATE_TYPE_REGISTRY, `Expected registry to contain "${key}"`);
  });
}

test('template-registry: REGISTRY_BASE_TYPE_COUNT matches actual key count', () => {
  assert.equal(REGISTRY_BASE_TYPE_COUNT, Object.keys(TEMPLATE_TYPE_REGISTRY).length);
});

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRY ENTRY STRUCTURE — every entry has required fields
// ──────────────────────────────────────────────────────────────────────────────

for (const [key, entry] of Object.entries(TEMPLATE_TYPE_REGISTRY)) {
  test(`template-registry: entry "${key}" has allowedDrops array`, () => {
    assert.ok(Array.isArray(entry.allowedDrops), `${key}.allowedDrops must be an array`);
    assert.ok(entry.allowedDrops.length > 0, `${key}.allowedDrops must be non-empty`);
  });

  test(`template-registry: entry "${key}" has boolean alternatesAllowed`, () => {
    assert.equal(typeof entry.alternatesAllowed, 'boolean');
  });

  test(`template-registry: entry "${key}" has sectionGroupRoles array`, () => {
    assert.ok(Array.isArray(entry.sectionGroupRoles));
    for (const role of entry.sectionGroupRoles) {
      assert.ok(role === 'header' || role === 'footer', `${key}: invalid role "${role}"`);
    }
  });

  test(`template-registry: entry "${key}" has boolean requiresLayout`, () => {
    assert.equal(typeof entry.requiresLayout, 'boolean');
  });

  test(`template-registry: every entry "${key}" has universal drops (shop, request, settings, routes)`, () => {
    const drops = entry.allowedDrops;
    assert.ok(drops.includes('shop'),    `${key}: missing 'shop' drop`);
    assert.ok(drops.includes('request'), `${key}: missing 'request' drop`);
    assert.ok(drops.includes('settings'), `${key}: missing 'settings' drop`);
    assert.ok(drops.includes('routes'),  `${key}: missing 'routes' drop`);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRY SEMANTICS — spot-check key types
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: product alternatesAllowed is true', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.product.alternatesAllowed, true);
});

test('template-registry: collection alternatesAllowed is true', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.collection.alternatesAllowed, true);
});

test('template-registry: page alternatesAllowed is true', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.page.alternatesAllowed, true);
});

test('template-registry: index alternatesAllowed is false', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.index.alternatesAllowed, false);
});

test('template-registry: password has no sectionGroupRoles (standalone)', () => {
  assert.deepEqual([...TEMPLATE_TYPE_REGISTRY.password.sectionGroupRoles], []);
});

test('template-registry: password requiresLayout is false', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.password.requiresLayout, false);
});

test('template-registry: gift_card requiresLayout is false', () => {
  assert.equal(TEMPLATE_TYPE_REGISTRY.gift_card.requiresLayout, false);
});

test('template-registry: gift_card sectionGroupRoles is [header] only', () => {
  assert.deepEqual([...TEMPLATE_TYPE_REGISTRY.gift_card.sectionGroupRoles], ['header']);
});

test('template-registry: index has both header and footer roles', () => {
  const roles = TEMPLATE_TYPE_REGISTRY.index.sectionGroupRoles;
  assert.ok(roles.includes('header'));
  assert.ok(roles.includes('footer'));
});

// ──────────────────────────────────────────────────────────────────────────────
// parseTemplateKey
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: parseTemplateKey("product") → {baseType:"product", suffix:null}', () => {
  const result = parseTemplateKey('product');
  assert.equal(result.baseType, 'product');
  assert.equal(result.suffix, null);
});

test('template-registry: parseTemplateKey("index") → {baseType:"index", suffix:null}', () => {
  const result = parseTemplateKey('index');
  assert.equal(result.baseType, 'index');
  assert.equal(result.suffix, null);
});

test('template-registry: parseTemplateKey("product.custom") → {baseType:"product", suffix:"custom"}', () => {
  const result = parseTemplateKey('product.custom');
  assert.equal(result.baseType, 'product');
  assert.equal(result.suffix, 'custom');
});

test('template-registry: parseTemplateKey("page.contact") → {baseType:"page", suffix:"contact"}', () => {
  const result = parseTemplateKey('page.contact');
  assert.equal(result.baseType, 'page');
  assert.equal(result.suffix, 'contact');
});

test('template-registry: parseTemplateKey("customers/login") → {baseType:"customers/login", suffix:null}', () => {
  const result = parseTemplateKey('customers/login');
  assert.equal(result.baseType, 'customers/login');
  assert.equal(result.suffix, null);
});

test('template-registry: parseTemplateKey("not_found") → {baseType:"not_found", suffix:null}', () => {
  const result = parseTemplateKey('not_found');
  assert.equal(result.baseType, 'not_found');
  assert.equal(result.suffix, null);
});

test('template-registry: parseTemplateKey("list-collections") → {baseType:"list-collections", suffix:null}', () => {
  const result = parseTemplateKey('list-collections');
  assert.equal(result.baseType, 'list-collections');
  assert.equal(result.suffix, null);
});

test('template-registry: parseTemplateKey splits on first dot only', () => {
  // If someone passes 'product.custom.v2', baseType='product', suffix='custom.v2'
  // (suffix validation will reject the dot in suffix, but parse is purely structural)
  const result = parseTemplateKey('product.custom.v2');
  assert.equal(result.baseType, 'product');
  assert.equal(result.suffix, 'custom.v2');
});

test('template-registry: parseTemplateKey("product.") → suffix null (empty suffix)', () => {
  const result = parseTemplateKey('product.');
  assert.equal(result.baseType, 'product');
  assert.equal(result.suffix, null);
});

// ──────────────────────────────────────────────────────────────────────────────
// validateTemplateKey — VALID keys
// ──────────────────────────────────────────────────────────────────────────────

const VALID_KEYS = [
  'index',
  'product',
  'collection',
  'list-collections',
  'page',
  'policy',
  'blog',
  'article',
  'cart',
  'search',
  'not_found',
  'password',
  'gift_card',
  'customers/login',
  'customers/register',
  'customers/account',
  'customers/orders',
  'customers/order',
  'customers/addresses',
  'customers/settings',
  'customers/wishlist',
  'customers/reset',
  'customers/activate',
  'product.alternate',
  'product.custom',
  'page.contact',
  'collection.sale',
];

for (const key of VALID_KEYS) {
  test(`template-registry: validateTemplateKey accepts "${key}"`, () => {
    assert.doesNotThrow(() => validateTemplateKey(key));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// validateTemplateKey — INVALID keys
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: validateTemplateKey rejects empty string', () => {
  assert.throws(() => validateTemplateKey(''), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects key > 120 chars', () => {
  const long = 'a'.repeat(121);
  assert.throws(() => validateTemplateKey(long), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey accepts key of exactly 120 chars', () => {
  // Use only valid chars; must start with a lowercase letter
  const key = 'a' + 'b'.repeat(119);
  assert.doesNotThrow(() => validateTemplateKey(key));
});

test('template-registry: validateTemplateKey rejects "../etc" (path traversal)', () => {
  assert.throws(() => validateTemplateKey('../etc'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects "templates/../index" (path traversal)', () => {
  assert.throws(() => validateTemplateKey('templates/../index'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects "/absolute/path" (leading slash)', () => {
  assert.throws(() => validateTemplateKey('/absolute/path'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects "__proto__" (pollution key)', () => {
  assert.throws(() => validateTemplateKey('__proto__'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects "constructor" (pollution key)', () => {
  assert.throws(() => validateTemplateKey('constructor'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects "prototype" (pollution key)', () => {
  assert.throws(() => validateTemplateKey('prototype'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects uppercase "Product"', () => {
  assert.throws(() => validateTemplateKey('Product'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects key with spaces', () => {
  assert.throws(() => validateTemplateKey('my template'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects key with special chars (!)', () => {
  assert.throws(() => validateTemplateKey('product!'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects suffix with slash (product.custom/v2)', () => {
  assert.throws(() => validateTemplateKey('product.custom/v2'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects suffix with dot (product.custom.v2)', () => {
  assert.throws(() => validateTemplateKey('product.custom.v2'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey rejects suffix starting with a digit... but actually allows it', () => {
  // suffix charset allows [a-z0-9] start — so 'product.2custom' → suffix='2custom' → starts with digit ✓
  assert.doesNotThrow(() => validateTemplateKey('product.2custom'));
});

test('template-registry: InvalidTemplateKeyError has key and reason fields', () => {
  let caught: unknown;
  try {
    validateTemplateKey('../bad');
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof InvalidTemplateKeyError);
  assert.equal((caught as InvalidTemplateKeyError).key, '../bad');
  assert.equal(typeof (caught as InvalidTemplateKeyError).reason, 'string');
});

// ──────────────────────────────────────────────────────────────────────────────
// resolveAlternateTemplate
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_BUNDLE_TEMPLATES = {
  index: { sections: {} },
  product: { sections: {} },
  'product.custom': { sections: {} },
  'page.contact': { sections: {} },
};

test('template-registry: resolveAlternateTemplate returns suffix key when present', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'product', 'custom');
  assert.equal(result, 'product.custom');
});

test('template-registry: resolveAlternateTemplate falls back to base when suffix not present', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'product', 'nonexistent');
  assert.equal(result, 'product');
});

test('template-registry: resolveAlternateTemplate returns base when suffix is null', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'product', null);
  assert.equal(result, 'product');
});

test('template-registry: resolveAlternateTemplate returns base when suffix is undefined', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'index', undefined);
  assert.equal(result, 'index');
});

test('template-registry: resolveAlternateTemplate returns undefined when neither base nor suffix exists', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'nonexistent', 'whatever');
  assert.equal(result, undefined);
});

test('template-registry: resolveAlternateTemplate returns undefined when base not present (no suffix)', () => {
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'cart', null);
  assert.equal(result, undefined);
});

test('template-registry: resolveAlternateTemplate prefers suffix key over base', () => {
  // Both 'product' and 'product.custom' exist — suffix takes priority
  const result = resolveAlternateTemplate(MOCK_BUNDLE_TEMPLATES, 'product', 'custom');
  assert.equal(result, 'product.custom', 'Must return the alternate key, not the base');
});

test('template-registry: resolveAlternateTemplate handles slash-containing base type', () => {
  const templates = { 'customers/login': { sections: {} } };
  const result = resolveAlternateTemplate(templates, 'customers/login', null);
  assert.equal(result, 'customers/login');
});

// ──────────────────────────────────────────────────────────────────────────────
// getAllowedDropsForTemplate
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: getAllowedDropsForTemplate("product") includes "product"', () => {
  const drops = getAllowedDropsForTemplate('product');
  assert.ok(drops.includes('product'), 'product template must have product drop');
});

test('template-registry: getAllowedDropsForTemplate("product") excludes "article"', () => {
  const drops = getAllowedDropsForTemplate('product');
  assert.ok(!drops.includes('article'), 'product template must not have article drop');
});

test('template-registry: getAllowedDropsForTemplate("article") includes "article"', () => {
  const drops = getAllowedDropsForTemplate('article');
  assert.ok(drops.includes('article'), 'article template must have article drop');
});

test('template-registry: getAllowedDropsForTemplate("article") excludes "product"', () => {
  const drops = getAllowedDropsForTemplate('article');
  assert.ok(!drops.includes('product'), 'article template must not have product drop');
});

test('template-registry: getAllowedDropsForTemplate("collection") includes "collection"', () => {
  const drops = getAllowedDropsForTemplate('collection');
  assert.ok(drops.includes('collection'));
});

test('template-registry: getAllowedDropsForTemplate("blog") includes "blog"', () => {
  const drops = getAllowedDropsForTemplate('blog');
  assert.ok(drops.includes('blog'));
});

test('template-registry: getAllowedDropsForTemplate("cart") includes "cart"', () => {
  const drops = getAllowedDropsForTemplate('cart');
  assert.ok(drops.includes('cart'));
});

test('template-registry: getAllowedDropsForTemplate("search") includes "search"', () => {
  const drops = getAllowedDropsForTemplate('search');
  assert.ok(drops.includes('search'));
});

test('template-registry: getAllowedDropsForTemplate("customers/login") includes "customer"', () => {
  const drops = getAllowedDropsForTemplate('customers/login');
  assert.ok(drops.includes('customer'));
});

test('template-registry: getAllowedDropsForTemplate("customers/order") includes "order"', () => {
  const drops = getAllowedDropsForTemplate('customers/order');
  assert.ok(drops.includes('order'));
});

test('template-registry: getAllowedDropsForTemplate("password") excludes "customer"', () => {
  const drops = getAllowedDropsForTemplate('password');
  assert.ok(!drops.includes('customer'), 'password template must not expose customer drop (pre-auth)');
});

test('template-registry: getAllowedDropsForTemplate("index") excludes "product"', () => {
  const drops = getAllowedDropsForTemplate('index');
  assert.ok(!drops.includes('product'), 'index template must not receive product drop');
});

test('template-registry: getAllowedDropsForTemplate with suffix uses base type', () => {
  // 'product.custom' → base type 'product' → same drops as 'product'
  const drops = getAllowedDropsForTemplate('product.custom');
  assert.ok(drops.includes('product'));
  assert.ok(!drops.includes('article'));
});

test('template-registry: getAllowedDropsForTemplate for unknown key returns minimal safe drops', () => {
  const drops = getAllowedDropsForTemplate('unknown-template-type');
  assert.ok(drops.includes('shop'));
  assert.ok(drops.includes('request'));
  assert.ok(drops.includes('settings'));
  assert.ok(drops.includes('routes'));
  // Must NOT include commerce drops for unknown types
  assert.ok(!drops.includes('product'));
  assert.ok(!drops.includes('customer'));
  assert.ok(!drops.includes('cart'));
});

// ──────────────────────────────────────────────────────────────────────────────
// findExcessiveVariantCounts
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: findExcessiveVariantCounts returns empty when no excess', () => {
  const templates: Record<string, unknown> = {
    index: {},
    product: {},
    'product.custom': {},
    'product.sale': {},
  };
  const excess = findExcessiveVariantCounts(templates);
  assert.deepEqual(excess, {}, 'should be empty when count ≤ MAX_TEMPLATE_VARIANTS_PER_TYPE');
});

test('template-registry: findExcessiveVariantCounts detects excess variants', () => {
  const templates: Record<string, unknown> = {};
  // Add 21 variants for 'product' (exceeds MAX_TEMPLATE_VARIANTS_PER_TYPE = 20)
  for (let i = 1; i <= 21; i++) {
    templates[`product.v${i}`] = {};
  }
  templates.index = {};
  const excess = findExcessiveVariantCounts(templates);
  assert.ok('product' in excess, 'product should be flagged as excessive');
  assert.equal(excess.product, 21);
});

test('template-registry: findExcessiveVariantCounts counts only variants (not base keys)', () => {
  const templates: Record<string, unknown> = {};
  // Exactly MAX_TEMPLATE_VARIANTS_PER_TYPE variants — should NOT be flagged
  for (let i = 1; i <= MAX_TEMPLATE_VARIANTS_PER_TYPE; i++) {
    templates[`page.v${i}`] = {};
  }
  templates.page = {};
  const excess = findExcessiveVariantCounts(templates);
  assert.deepEqual(excess, {});
});

// ──────────────────────────────────────────────────────────────────────────────
// ROUND-TRIP BYTE-IDENTITY — existing fixtures must parse + round-trip identically
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: existing minimal bundle fixture round-trips through doc adapters (byte-identity)', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const backToBundle = fromThemeDocumentV2(doc);

  // JSON-serialize both and compare
  const originalJson = JSON.stringify(bundle);
  const roundTripJson = JSON.stringify(backToBundle);
  assert.equal(roundTripJson, originalJson, 'Minimal bundle must round-trip identically after Phase V changes');
});

test('template-registry: existing Urban Kicks bundle fixture round-trips through doc adapters (structural identity)', () => {
  // NOTE: toThemeDocumentV2 sorts templates alphabetically; fromThemeDocumentV2 reconstructs them
  // in that order. Key insertion order in the templates record differs from the original, so strict
  // string comparison of JSON.stringify is intentionally NOT used here (that is an existing behavior
  // proven by the pre-existing round-trip tests in theme-document.test.ts). We use deepEqual on
  // JSON.parse(JSON.stringify(...)) which is order-independent for object keys.
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const backToBundle = fromThemeDocumentV2(doc);

  assert.deepEqual(
    JSON.parse(JSON.stringify(backToBundle)),
    JSON.parse(JSON.stringify(bundle)),
    'Urban Kicks bundle must round-trip with structural identity after Phase V changes',
  );
});

test('template-registry: existing LetBuyy Core bundle fixture round-trips through doc adapters (structural identity)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const backToBundle = fromThemeDocumentV2(doc);

  assert.deepEqual(
    JSON.parse(JSON.stringify(backToBundle)),
    JSON.parse(JSON.stringify(bundle)),
    'LetBuyy Core bundle must round-trip with structural identity after Phase V changes',
  );
});

test('template-registry: all template keys in Urban Kicks bundle pass validateTemplateKey', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  for (const key of Object.keys(bundle.templates)) {
    assert.doesNotThrow(
      () => validateTemplateKey(key),
      `Urban Kicks bundle key "${key}" must pass validateTemplateKey`,
    );
  }
});

test('template-registry: all template keys in minimal bundle pass validateTemplateKey', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  for (const key of Object.keys(bundle.templates)) {
    assert.doesNotThrow(
      () => validateTemplateKey(key),
      `Minimal bundle key "${key}" must pass validateTemplateKey`,
    );
  }
});

test('template-registry: parseThemeDocument still accepts all Urban Kicks keys after Phase V superRefine', () => {
  // This verifies the ThemeDocumentTemplateSchema superRefine doesn't reject existing keys
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  // Re-parsing the doc must succeed (the superRefine must not reject any existing key)
  assert.doesNotThrow(() => parseThemeDocument(doc), 'parseThemeDocument must accept Urban Kicks doc after Phase V');
});

test('template-registry: ThemeDocumentTemplateSchema rejects a key with uppercase via parseThemeDocument', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  // Inject an invalid key — only use fields known to ThemeDocumentTemplateSchema
  // (key, name, layout, sections) to avoid .strict() rejecting extra keys before superRefine runs.
  const tampered = {
    ...doc,
    templates: [{ key: 'BadKey', sections: [] }],
  };
  assert.throws(
    () => parseThemeDocument(tampered),
    /BadKey|invalid|charset|template key/i,
    'parseThemeDocument must reject a template with uppercase key after Phase V',
  );
});

test('template-registry: ThemeDocumentTemplateSchema rejects a path-traversal key via parseThemeDocument', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const tampered = {
    ...doc,
    templates: [{ key: '../traversal', sections: [], disabled: false }],
  };
  assert.throws(
    () => parseThemeDocument(tampered),
    /traversal|invalid|path/i,
    'parseThemeDocument must reject a template with path-traversal key',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// CONTEXT ISOLATION — per-template drop allowlists are disjoint where expected
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: product and article drop sets are disjoint for their unique drops', () => {
  const productDrops = getAllowedDropsForTemplate('product');
  const articleDrops = getAllowedDropsForTemplate('article');
  // Each should have its own unique drop
  assert.ok(productDrops.includes('product'));
  assert.ok(articleDrops.includes('article'));
  // And not each other's unique drops
  assert.ok(!productDrops.includes('article'));
  assert.ok(!articleDrops.includes('product'));
});

test('template-registry: customer templates do not include product or collection drops', () => {
  const customerTemplates = [
    'customers/login', 'customers/register', 'customers/account',
    'customers/orders', 'customers/addresses', 'customers/settings', 'customers/wishlist',
  ];
  for (const key of customerTemplates) {
    const drops = getAllowedDropsForTemplate(key);
    assert.ok(!drops.includes('product'), `${key}: must not have product drop`);
    assert.ok(!drops.includes('collection'), `${key}: must not have collection drop`);
    assert.ok(!drops.includes('cart'), `${key}: must not have cart drop`);
  }
});

test('template-registry: order drop only available on customers/order template', () => {
  const orderDrops = getAllowedDropsForTemplate('customers/order');
  assert.ok(orderDrops.includes('order'));

  // No other customer template should have the order drop
  const otherCustomerTemplates = [
    'customers/login', 'customers/register', 'customers/account',
    'customers/orders', 'customers/addresses', 'customers/settings', 'customers/wishlist',
  ];
  for (const key of otherCustomerTemplates) {
    const drops = getAllowedDropsForTemplate(key);
    assert.ok(!drops.includes('order'), `${key}: must not have order drop (only customers/order has it)`);
  }
});

test('template-registry: canonical buyer drop is limited to buyer order surfaces', () => {
  assert.ok(getAllowedDropsForTemplate('customers/orders').includes('buyer'));
  assert.ok(getAllowedDropsForTemplate('customers/order').includes('buyer'));
  for (const key of ['customers/login', 'customers/register', 'customers/account', 'customers/addresses', 'customers/settings', 'customers/wishlist']) {
    assert.ok(!getAllowedDropsForTemplate(key).includes('buyer'), `${key}: buyer order identity is not a store-customer drop`);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Phase V hardening — consecutive-slash guard in validateTemplateKey
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: validateTemplateKey rejects "customers//login" (consecutive slashes)', () => {
  assert.throws(
    () => validateTemplateKey('customers//login'),
    InvalidTemplateKeyError,
    'consecutive slashes must be rejected',
  );
  let caught: unknown;
  try {
    validateTemplateKey('customers//login');
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof InvalidTemplateKeyError);
  assert.match((caught as InvalidTemplateKeyError).reason, /consecutive slashes/i);
});

test('template-registry: validateTemplateKey rejects "a//b" (consecutive slashes, short form)', () => {
  assert.throws(() => validateTemplateKey('a//b'), InvalidTemplateKeyError);
});

test('template-registry: validateTemplateKey still accepts "customers/login" (single slash — valid)', () => {
  assert.doesNotThrow(() => validateTemplateKey('customers/login'));
});

// ──────────────────────────────────────────────────────────────────────────────
// Phase V hardening — per-type variant cap enforced by ThemeDocumentSchema.superRefine
// ──────────────────────────────────────────────────────────────────────────────

test('template-registry: parseThemeDocument rejects a doc with 21 product variants (exceeds cap)', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);

  // Build 21 alternate product templates — one more than MAX_TEMPLATE_VARIANTS_PER_TYPE.
  const extraTemplates = Array.from({ length: 21 }, (_, i) => ({
    key: `product.v${i + 1}`,
    sections: [],
  }));

  const tampered = {
    ...doc,
    templates: [...doc.templates, ...extraTemplates],
  };

  assert.throws(
    () => parseThemeDocument(tampered),
    /product.*variant|exceeding.*maximum|MAX_TEMPLATE_VARIANTS/i,
    'parseThemeDocument must reject a doc with > 20 product alternate variants',
  );
});

test('template-registry: parseThemeDocument accepts exactly 20 product variants (at cap)', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);

  // Exactly 20 alternate product templates — right at the cap.
  const atCapTemplates = Array.from({ length: 20 }, (_, i) => ({
    key: `product.v${i + 1}`,
    sections: [],
  }));

  const patched = {
    ...doc,
    templates: [...doc.templates, ...atCapTemplates],
  };

  // Should NOT throw — 20 is the allowed maximum.
  assert.doesNotThrow(
    () => parseThemeDocument(patched),
    'parseThemeDocument must accept exactly 20 alternate variants (at cap)',
  );
});
