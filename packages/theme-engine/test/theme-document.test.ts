import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THEME_DOCUMENT_VERSION,
  KNOWN_THEME_DOCUMENT_VERSIONS,
  MAX_BLOCK_NESTING_DEPTH,
  UnsupportedThemeDocumentVersionError,
  UnsupportedThemeDocumentFeatureError,
  ThemeDocumentSchema,
  parseThemeDocument,
  toThemeDocumentV2,
  fromThemeDocumentV2,
  type ThemeDocumentBlock,
} from '../src/theme-document.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  parseLiquidThemePackageBundle,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const STORE_ID = '22222222-2222-4222-8222-222222222222';

/** Minimal valid ThemeDocument for schema tests (no templates → no section type validation). */
function makeMinimalDocInput(overrides: Record<string, unknown> = {}): unknown {
  const minimal = createMinimalLiquidThemeBundleFixture();
  return {
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: minimal.schema_version,
    package: minimal.package,
    layout: minimal.layout,
    config: {
      settings_schema: minimal.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    locales: minimal.locales,
    renderer: minimal.renderer,
    templates: [],
    ...overrides,
  };
}

/** Build a minimal ThemeDocumentBlock tree of a specific depth (1 = no children). */
function buildBlockTree(depth: number, idPrefix = 'blk'): ThemeDocumentBlock {
  return {
    id: `${idPrefix}-d${depth}`,
    type: 'badge',
    settings: {},
    disabled: false,
    children: depth > 1 ? [buildBlockTree(depth - 1, idPrefix)] : [],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: THEME_DOCUMENT_VERSION has the expected string value', () => {
  assert.equal(THEME_DOCUMENT_VERSION, '2026-07-document-v1');
});

test('theme-document: KNOWN_THEME_DOCUMENT_VERSIONS contains THEME_DOCUMENT_VERSION and is frozen', () => {
  assert.ok(KNOWN_THEME_DOCUMENT_VERSIONS.includes(THEME_DOCUMENT_VERSION));
  assert.ok(Object.isFrozen(KNOWN_THEME_DOCUMENT_VERSIONS));
});

// ──────────────────────────────────────────────────────────────────────────────
// Version gate
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: parseThemeDocument with missing document_version defaults and passes (known)', () => {
  const input = makeMinimalDocInput();
  // Remove document_version — schema default kicks in ('2026-07-document-v1' which IS known).
  const without = { ...(input as Record<string, unknown>) };
  delete without.document_version;
  const doc = parseThemeDocument(without);
  assert.equal(doc.document_version, THEME_DOCUMENT_VERSION);
});

test('theme-document: parseThemeDocument rejects an explicit unknown document_version (fail-closed)', () => {
  const input = makeMinimalDocInput({ document_version: '9999-future-v99' });
  assert.throws(
    () => parseThemeDocument(input),
    (err) => err instanceof UnsupportedThemeDocumentVersionError,
    'must throw UnsupportedThemeDocumentVersionError for future version',
  );
});

test('theme-document: UnsupportedThemeDocumentVersionError has name, documentVersion, known', () => {
  const err = new UnsupportedThemeDocumentVersionError('x-unknown');
  assert.equal(err.name, 'UnsupportedThemeDocumentVersionError');
  assert.equal(err.documentVersion, 'x-unknown');
  assert.ok(Array.isArray(err.known));
  assert.ok(err.known.includes(THEME_DOCUMENT_VERSION));
  assert.ok(err instanceof Error);
});

// ──────────────────────────────────────────────────────────────────────────────
// Prototype-pollution guards
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: parseThemeDocument rejects __proto__ as a section id', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: '__proto__',   // blocked key
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [],
          },
        ],
      },
    ],
  });
  assert.throws(
    () => parseThemeDocument(input),
    /blocked|proto/i,
    'must reject __proto__ as section id',
  );
});

test('theme-document: parseThemeDocument rejects constructor as a block id', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 'valid-section',
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [
              { id: 'constructor', type: 'badge', settings: {}, disabled: false, children: [] },
            ],
          },
        ],
      },
    ],
  });
  assert.throws(
    () => parseThemeDocument(input),
    /blocked|constructor/i,
    'must reject constructor as block id',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Depth + uniqueness guards
// ──────────────────────────────────────────────────────────────────────────────

test(`theme-document: parseThemeDocument rejects block nesting depth > ${MAX_BLOCK_NESTING_DEPTH}`, () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  // Build a tree at depth MAX + 1 (too deep)
  const tooDeep = buildBlockTree(MAX_BLOCK_NESTING_DEPTH + 1);

  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 's1',
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [tooDeep],
          },
        ],
      },
    ],
  });
  assert.throws(
    () => parseThemeDocument(input),
    /depth/i,
    `must reject nesting depth > ${MAX_BLOCK_NESTING_DEPTH}`,
  );
});

test('theme-document: parseThemeDocument accepts block nesting depth exactly at MAX', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const atMax = buildBlockTree(MAX_BLOCK_NESTING_DEPTH);

  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 's1',
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [atMax],
          },
        ],
      },
    ],
  });
  // Should not throw
  const doc = parseThemeDocument(input);
  assert.ok(doc.templates[0].sections[0].blocks[0] !== undefined);
});

test('theme-document: parseThemeDocument rejects duplicate section ids in same template', () => {
  const input = makeMinimalDocInput({
    templates: [
      {
        key: 'index',
        sections: [
          { id: 'same-id', type: 'x', settings: {}, disabled: false, blocks: [] },
          { id: 'same-id', type: 'y', settings: {}, disabled: false, blocks: [] },
        ],
      },
    ],
  });
  assert.throws(
    () => parseThemeDocument(input),
    /[Dd]uplicate.*section.*same-id/,
    'must reject duplicate section ids',
  );
});

test('theme-document: parseThemeDocument rejects duplicate template keys', () => {
  const input = makeMinimalDocInput({
    templates: [
      { key: 'index', sections: [] },
      { key: 'index', sections: [] },
    ],
  });
  assert.throws(
    () => parseThemeDocument(input),
    /[Dd]uplicate.*template.*index/,
    'must reject duplicate template keys',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// toThemeDocumentV2 — basic
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: toThemeDocumentV2(minimal) produces a valid doc with THEME_DOCUMENT_VERSION', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  assert.equal(doc.document_version, THEME_DOCUMENT_VERSION);
  assert.ok(Array.isArray(doc.templates));
});

test('theme-document: toThemeDocumentV2(urbanKicks) produces doc with correct template count', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const expectedCount = Object.keys(bundle.templates).length;
  assert.equal(doc.templates.length, expectedCount);
});

test('theme-document: toThemeDocumentV2(letbuyyCoreBundle) does not throw', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  assert.ok(doc.document_version === THEME_DOCUMENT_VERSION);
});

// ──────────────────────────────────────────────────────────────────────────────
// ROUND-TRIP: bundle → doc → bundle
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: ROUND-TRIP bundle→doc→bundle for minimal fixture (deep-equal after re-parse)', () => {
  const original = createMinimalLiquidThemeBundleFixture();
  // Canonical form via parseLiquidThemePackageBundle
  const originalParsed = parseLiquidThemePackageBundle(original);
  const originalJson = JSON.parse(JSON.stringify(originalParsed));

  const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)));
  const roundTrippedJson = JSON.parse(JSON.stringify(roundTripped));

  assert.deepEqual(roundTrippedJson, originalJson, 'bundle→doc→bundle must produce identical parsed bundle');
});

test('theme-document: ROUND-TRIP bundle→doc→bundle for Urban Kicks (structural + render-parity proof A)', async () => {
  const original = createUrbanKicksLiquidThemeBundleFixture();
  const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)));

  // Verify the round-tripped bundle is valid (parseLiquidThemePackageBundle throws if not)
  assert.ok(roundTripped.schema_version === original.schema_version);

  // Structural deepEqual proof: the full parsed bundle must be byte-identical after round-trip.
  // This catches lossiness in settings_data passthrough keys, non-index templates, block
  // metadata, section ordering, and any other field not exercised by single-template render.
  const originalParsed = parseLiquidThemePackageBundle(original);
  assert.deepEqual(
    JSON.parse(JSON.stringify(roundTripped)),
    JSON.parse(JSON.stringify(originalParsed)),
    'Urban Kicks: bundle→doc→bundle must produce a structurally identical parsed bundle',
  );

  // Render parity: render the 'index' template with both bundles and compare HTML
  const renderer = new LiquidRenderer();
  const renderInput = (bundle: typeof original) => renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: 'index',
  });

  const [originalResult, roundTrippedResult] = await Promise.all([
    renderInput(original),
    renderInput(roundTripped),
  ]);

  assert.equal(originalResult.status, 'rendered', `Original render failed: ${originalResult.warnings.join(', ')}`);
  assert.equal(roundTrippedResult.status, 'rendered', `Round-tripped render failed: ${roundTrippedResult.warnings.join(', ')}`);
  assert.equal(
    roundTrippedResult.liquid?.contentForLayout,
    originalResult.liquid?.contentForLayout,
    'Urban Kicks: round-trip must produce identical rendered HTML (render-parity proof A)',
  );
});

test('theme-document: ROUND-TRIP bundle→doc→bundle for LetBuyy Core fixture (structural + render-parity proof B)', async () => {
  const original = createLetbuyyCoreLiquidThemeBundleFixture();
  const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(original)));

  assert.ok(roundTripped.schema_version === original.schema_version);

  // Structural deepEqual proof: the full parsed bundle must be byte-identical after round-trip.
  const originalParsed = parseLiquidThemePackageBundle(original);
  assert.deepEqual(
    JSON.parse(JSON.stringify(roundTripped)),
    JSON.parse(JSON.stringify(originalParsed)),
    'LetBuyy Core: bundle→doc→bundle must produce a structurally identical parsed bundle',
  );

  const renderer = new LiquidRenderer();
  const renderInput = (bundle: typeof original) => renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: 'index',
  });

  const [originalResult, roundTrippedResult] = await Promise.all([
    renderInput(original),
    renderInput(roundTripped),
  ]);

  assert.equal(originalResult.status, 'rendered', `Original render failed: ${originalResult.warnings.join(', ')}`);
  assert.equal(roundTrippedResult.status, 'rendered', `Round-tripped render failed: ${roundTrippedResult.warnings.join(', ')}`);
  assert.equal(
    roundTrippedResult.liquid?.contentForLayout,
    originalResult.liquid?.contentForLayout,
    'LetBuyy Core: round-trip must produce identical rendered HTML (render-parity proof B)',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// ROUND-TRIP: doc → bundle → doc
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: ROUND-TRIP doc→bundle→doc produces equal doc for minimal fixture', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const docAfterRoundTrip = toThemeDocumentV2(fromThemeDocumentV2(doc));

  const docJson = JSON.parse(JSON.stringify(doc));
  const rtJson = JSON.parse(JSON.stringify(docAfterRoundTrip));
  assert.deepEqual(rtJson, docJson, 'doc→bundle→doc must be lossless in both directions');
});

// ──────────────────────────────────────────────────────────────────────────────
// Ordering preservation
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: section order is preserved through toThemeDocumentV2 (matches bundle order[])', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);

  // Verify every template's section order matches the bundle's order[]
  for (const template of doc.templates) {
    const bundleTemplate = bundle.templates[template.key];
    if (!bundleTemplate) continue; // alphabetical sort: key must exist

    const docSectionIds = template.sections.map((s) => s.id);
    const bundleOrderedIds = bundleTemplate.order.filter((id) => id in bundleTemplate.sections);
    assert.deepEqual(
      docSectionIds.slice(0, bundleOrderedIds.length),
      bundleOrderedIds,
      `Template "${template.key}": section order must match bundle.order[]`,
    );
  }
});

test('theme-document: block order is preserved through toThemeDocumentV2 (matches bundle block_order[])', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);

  // Find the index template and verify block order on category-grid-default
  const indexTemplate = doc.templates.find((t) => t.key === 'index');
  assert.ok(indexTemplate, 'Urban Kicks should have an index template');

  const categorySection = indexTemplate!.sections.find((s) => s.id === 'category-grid-default');
  assert.ok(categorySection, 'index template should have category-grid-default section');

  const docBlockIds = categorySection!.blocks.map((b) => b.id);
  const bundleSection = bundle.templates.index.sections['category-grid-default'];
  assert.deepEqual(docBlockIds, bundleSection.block_order);
});

// ──────────────────────────────────────────────────────────────────────────────
// fromThemeDocumentV2 output validity
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: fromThemeDocumentV2 output passes parseLiquidThemePackageBundle without throwing', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  // Should not throw
  const reconstructed = parseLiquidThemePackageBundle(fromThemeDocumentV2(doc));
  assert.ok(reconstructed.renderer.engine === 'liquid');
});

// ──────────────────────────────────────────────────────────────────────────────
// MANDATORY GATES (from Phase N spec)
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: unknown FUTURE document version is rejected fail-closed', () => {
  const input = makeMinimalDocInput({ document_version: 'future-v999' });
  let threw = false;
  try {
    parseThemeDocument(input);
  } catch (err) {
    threw = true;
    assert.ok(err instanceof UnsupportedThemeDocumentVersionError, 'must throw UnsupportedThemeDocumentVersionError');
  }
  assert.ok(threw, 'must throw for future document version');
});

test('theme-document: excess block nesting depth is rejected', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  // depth 5 > MAX_BLOCK_NESTING_DEPTH (3)
  const excessDepth = buildBlockTree(MAX_BLOCK_NESTING_DEPTH + 2);
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [{ key: 'test', sections: [{ id: 'sec1', type: 'spotlight', settings: {}, disabled: false, blocks: [excessDepth] }] }],
  });
  assert.throws(() => parseThemeDocument(input), /depth/i, 'must reject excess nesting depth');
});

test('theme-document: duplicate section id is rejected', () => {
  const input = makeMinimalDocInput({
    templates: [
      { key: 'index', sections: [
        { id: 'dup', type: 'x', settings: {}, disabled: false, blocks: [] },
        { id: 'dup', type: 'y', settings: {}, disabled: false, blocks: [] },
      ]},
    ],
  });
  assert.throws(() => parseThemeDocument(input), /[Dd]uplicate/);
});

test('theme-document: prototype-pollution (__proto__) section id is rejected', () => {
  const input = makeMinimalDocInput({
    templates: [{ key: 'index', sections: [{ id: '__proto__', type: 'x', settings: {}, disabled: false, blocks: [] }] }],
  });
  assert.throws(() => parseThemeDocument(input), /blocked|proto/i);
});

test('theme-document: prototype-pollution (constructor) block id is rejected', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [{ key: 'index', sections: [
      { id: 's1', type: 'spotlight', settings: {}, disabled: false, blocks: [
        { id: 'constructor', type: 'badge', settings: {}, disabled: false, children: [] },
      ]},
    ]}],
  });
  assert.throws(() => parseThemeDocument(input), /blocked|constructor/i);
});

test('theme-document: prototype-pollution (prototype) block id is rejected', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [{ key: 'index', sections: [
      { id: 's1', type: 'spotlight', settings: {}, disabled: false, blocks: [
        { id: 'prototype', type: 'badge', settings: {}, disabled: false, children: [] },
      ]},
    ]}],
  });
  assert.throws(() => parseThemeDocument(input), /blocked|prototype/i);
});

test('theme-document: invalid parent-child relation is rejected (block type not allowed by section)', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  // spotlight section only allows 'badge' and '@app' blocks. Using a non-existent type.
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    templates: [{ key: 'index', sections: [
      { id: 's1', type: 'spotlight', settings: {}, disabled: false, blocks: [
        { id: 'b1', type: 'not-a-valid-block-type-xyz', settings: {}, disabled: false, children: [] },
      ]},
    ]}],
  });
  assert.throws(() => parseThemeDocument(input), /not allowed|not.*defined/i);
});

test('theme-document: malformed binding (section type not in section_definitions) is rejected', () => {
  const minimal = createMinimalLiquidThemeBundleFixture();
  const input = makeMinimalDocInput({
    section_definitions: minimal.sections, // only has 'spotlight'
    block_definitions: minimal.blocks,
    templates: [{ key: 'index', sections: [
      { id: 's1', type: 'non-existent-section-type', settings: {}, disabled: false, blocks: [] },
    ]}],
  });
  assert.throws(() => parseThemeDocument(input), /not defined|section_definitions/i);
});

test('theme-document: deterministic hash stable across serializations (same doc produces same JSON)', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc1 = toThemeDocumentV2(bundle);
  const doc2 = toThemeDocumentV2(bundle);
  assert.equal(JSON.stringify(doc1), JSON.stringify(doc2), 'two independent conversions of the same bundle must produce identical JSON');
});

test('theme-document: Urban Kicks render parity via LiquidRenderer after doc round-trip', async () => {
  const original = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(original);
  const reconstructed = fromThemeDocumentV2(doc);

  const renderer = new LiquidRenderer();
  const renderBundle = (bundle: typeof original, tplKey: string) => renderer.render({
    context: { storeId: STORE_ID, subdomain: 'urban', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: tplKey, type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: tplKey,
  });

  const [orig, recon] = await Promise.all([
    renderBundle(original, 'index'),
    renderBundle(reconstructed, 'index'),
  ]);

  assert.equal(orig.status, 'rendered');
  assert.equal(recon.status, 'rendered');
  assert.equal(recon.liquid?.contentForLayout, orig.liquid?.contentForLayout, 'HTML must be unchanged after doc round-trip');
});

test('theme-document: LetBuyy Core render parity via LiquidRenderer after doc round-trip', async () => {
  const original = createLetbuyyCoreLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(original);
  const reconstructed = fromThemeDocumentV2(doc);

  const renderer = new LiquidRenderer();
  const renderBundle = (bundle: typeof original, tplKey: string) => renderer.render({
    context: { storeId: STORE_ID, subdomain: 'letbuyy', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: tplKey, type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: tplKey,
  });

  const [orig, recon] = await Promise.all([
    renderBundle(original, 'index'),
    renderBundle(reconstructed, 'index'),
  ]);

  assert.equal(orig.status, 'rendered');
  assert.equal(recon.status, 'rendered');
  assert.equal(recon.liquid?.contentForLayout, orig.liquid?.contentForLayout, 'HTML must be unchanged after doc round-trip (LetBuyy Core)');
});

test('theme-document: React fallback path is untouched (LiquidRenderer returns unsupported when no bundle)', async () => {
  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'any-theme', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    // No liquidBundle → should return unsupported, not crash
  });
  assert.equal(result.status, 'unsupported', 'React fallback path: no liquidBundle must return unsupported status');
});

// ──────────────────────────────────────────────────────────────────────────────
// ThemeDocumentSchema direct Zod parse / serialize equality
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: ThemeDocumentSchema.parse → re-serialize → re-parse produces equal document', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const serialized = JSON.stringify(doc);
  const reparsed = ThemeDocumentSchema.parse(JSON.parse(serialized));
  assert.deepEqual(JSON.parse(JSON.stringify(reparsed)), JSON.parse(JSON.stringify(doc)));
});

// ──────────────────────────────────────────────────────────────────────────────
// HIGH finding: settings_data passthrough key losslessness
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: settings_data passthrough keys survive bundle→doc→bundle round-trip', () => {
  // Bundles may carry extra keys in settings_data beyond 'current' and 'presets' because
  // ThemeBundleSettingsDataSchema uses .passthrough().  The doc adapter must not drop them.
  const base = createMinimalLiquidThemeBundleFixture();
  const withExtra = {
    ...base,
    config: {
      ...base.config,
      // Inject a passthrough key that is not 'current' or 'presets'.
      settings_data: { ...base.config.settings_data, release_hint: 2, _meta: { source: 'test' } },
    },
  };

  const originalParsed = parseLiquidThemePackageBundle(withExtra);
  const roundTripped = parseLiquidThemePackageBundle(fromThemeDocumentV2(toThemeDocumentV2(withExtra)));

  assert.deepEqual(
    JSON.parse(JSON.stringify(roundTripped)),
    JSON.parse(JSON.stringify(originalParsed)),
    'Extra passthrough keys in settings_data must survive the round-trip without loss',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MEDIUM finding: fromThemeDocumentV2 must be fail-closed on non-empty block children
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: fromThemeDocumentV2 throws UnsupportedThemeDocumentFeatureError for doc with non-empty block children', () => {
  // parseThemeDocument accepts docs with non-empty children (Phase N models them).
  // fromThemeDocumentV2 must refuse — silently discarding them would break the lossless claim.
  const minimal = createMinimalLiquidThemeBundleFixture();
  const docWithChildren = parseThemeDocument({
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: minimal.schema_version,
    package: minimal.package,
    layout: minimal.layout,
    config: {
      settings_schema: minimal.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    locales: minimal.locales,
    renderer: minimal.renderer,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 's1',
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [
              {
                id: 'parent-block',
                type: 'badge',
                settings: {},
                disabled: false,
                // Non-empty children — this is what Phase T will populate; Phase N just models it.
                children: [
                  { id: 'child-block', type: 'badge', settings: {}, disabled: false, children: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.throws(
    () => fromThemeDocumentV2(docWithChildren),
    (err) => err instanceof UnsupportedThemeDocumentFeatureError && /Phase T/i.test(err.message),
    'fromThemeDocumentV2 must throw UnsupportedThemeDocumentFeatureError when block.children is non-empty',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// LOW finding: prototype-pollution via JSON.parse-sourced __proto__ settings key
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document: JSON.parse-sourced __proto__ settings key is caught by the prototype-pollution guard', () => {
  // JSON.parse('{"__proto__": ...}') creates an object with __proto__ as an own enumerable
  // property.  Zod's z.record() may re-assign it via bracket notation which in some engines
  // invokes the prototype setter.  Object.getOwnPropertyNames catches both own-enumerable
  // and own-non-enumerable properties — providing broader coverage than Object.keys.
  const minimal = createMinimalLiquidThemeBundleFixture();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const maliciousSettings: Record<string, unknown> = JSON.parse('{"__proto__": {"injected": true}}');

  const input = {
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: minimal.schema_version,
    package: minimal.package,
    layout: minimal.layout,
    config: {
      settings_schema: minimal.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: minimal.sections,
    block_definitions: minimal.blocks,
    locales: minimal.locales,
    renderer: minimal.renderer,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 's1',
            type: 'spotlight',
            settings: maliciousSettings,
            disabled: false,
            blocks: [],
          },
        ],
      },
    ],
  };

  // The superRefine proto-pollution guard must catch the __proto__ key and reject.
  // Note: if JSON.parse retains __proto__ as an own enumerable key (modern V8 behaviour),
  // Object.keys already catches it; Object.getOwnPropertyNames covers the non-enumerable case
  // that arises when Zod's record processing invokes the __proto__ setter instead.
  assert.throws(
    () => parseThemeDocument(input),
    /blocked|proto/i,
    'JSON.parse-sourced __proto__ settings key must be rejected by the pollution guard',
  );
});
