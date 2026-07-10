import assert from 'node:assert/strict';
import test from 'node:test';
import {
  migrateToThemeDocumentV2,
} from '../src/theme-document-migrations.ts';
import {
  THEME_DOCUMENT_VERSION,
  parseThemeDocument,
  toThemeDocumentV2,
  UnsupportedThemeDocumentVersionError,
} from '../src/theme-document.ts';
import {
  createUrbanKicksLiquidThemeBundleFixture,
  createMinimalLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
} from '../src/index.ts';

// ──────────────────────────────────────────────────────────────────────────────
// SHAPE-2: LiquidThemePackageBundle
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: SHAPE-2 Urban Kicks bundle → returns valid ThemeDocument', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = migrateToThemeDocumentV2(bundle);
  assert.equal(doc.document_version, THEME_DOCUMENT_VERSION);
  assert.ok(Array.isArray(doc.templates));
  assert.ok(doc.templates.length > 0, 'must have at least one template');
});

// ──────────────────────────────────────────────────────────────────────────────
// SHAPE-1: Already-valid ThemeDocument (passthrough)
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: SHAPE-1 already-valid ThemeDocument passes through unchanged', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = toThemeDocumentV2(bundle);
  const migrated = migrateToThemeDocumentV2(doc);
  // Should be the same document (equal by deep comparison)
  assert.deepEqual(
    JSON.parse(JSON.stringify(migrated)),
    JSON.parse(JSON.stringify(doc)),
    'passthrough: migrated doc must equal the input doc',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// SHAPE-3: Editor draftConfig
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: SHAPE-3 minimal editor draftConfig → produces valid ThemeDocument with correct sections', () => {
  // Build a minimal draftConfig that has:
  //  - templates as a Record (bundle-compatible form) — no document_version, no schema_version
  //  - config.settings_schema
  //  - sections as Liquid section files (so section type validation passes)
  const minimal = createMinimalLiquidThemeBundleFixture();

  const draftConfig = {
    // NO document_version (not SHAPE-1)
    // NO schema_version at root (not SHAPE-2)
    templates: {
      index: {
        name: 'Draft home',
        layout: 'theme',
        sections: {
          'spotlight-draft': {
            type: 'spotlight',
            settings: { heading: 'Draft heading' },
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['spotlight-draft'],
      },
    },
    config: {
      settings_schema: minimal.config.settings_schema,
      settings_data: { current: { primaryColor: '#123456' }, presets: {} },
    },
    // Provide Liquid section files so the ThemeDocument superRefine doesn't reject unknown section types
    sections: minimal.sections,
    blocks: minimal.blocks,
    layout: minimal.layout,
    locales: minimal.locales,
    renderer: minimal.renderer,
    package: minimal.package,
  };

  const doc = migrateToThemeDocumentV2(draftConfig);

  assert.equal(doc.document_version, THEME_DOCUMENT_VERSION, 'migrated doc must have current document_version');
  assert.ok(Array.isArray(doc.templates), 'templates must be an array');
  assert.equal(doc.templates.length, 1, 'must have exactly one template');

  const indexTemplate = doc.templates[0];
  assert.equal(indexTemplate.key, 'index');
  assert.equal(indexTemplate.sections.length, 1, 'must have one section');
  assert.equal(indexTemplate.sections[0].id, 'spotlight-draft');
  assert.equal(indexTemplate.sections[0].type, 'spotlight');

  // Verify the result is a fully-valid ThemeDocument
  const reparsed = parseThemeDocument(doc);
  assert.equal(reparsed.document_version, THEME_DOCUMENT_VERSION);
});

// ──────────────────────────────────────────────────────────────────────────────
// UNKNOWN shape
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: UNKNOWN shape throws Error (not UnsupportedThemeDocumentVersionError)', () => {
  const unknownShape = { foo: 'bar', baz: 42 };
  let threw = false;
  let thrownErr: unknown;
  try {
    migrateToThemeDocumentV2(unknownShape);
  } catch (err) {
    threw = true;
    thrownErr = err;
  }
  assert.ok(threw, 'must throw for unknown shape');
  assert.ok(thrownErr instanceof Error, 'must throw an Error');
  assert.ok(
    !(thrownErr instanceof UnsupportedThemeDocumentVersionError),
    'must NOT throw UnsupportedThemeDocumentVersionError for unknown shape',
  );
});

test('theme-document-migrations: migrateToThemeDocumentV2 on null input throws Error', () => {
  assert.throws(() => migrateToThemeDocumentV2(null), Error);
});

test('theme-document-migrations: migrateToThemeDocumentV2 on array input throws Error', () => {
  assert.throws(() => migrateToThemeDocumentV2([]), Error);
});

// ──────────────────────────────────────────────────────────────────────────────
// Meta-property: result is always parseThemeDocument-valid
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: result of migrateToThemeDocumentV2 is always parseThemeDocument-valid (Urban Kicks)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const doc = migrateToThemeDocumentV2(bundle);
  // If parseThemeDocument throws, the test fails
  const validated = parseThemeDocument(doc);
  assert.equal(validated.document_version, THEME_DOCUMENT_VERSION);
});

test('theme-document-migrations: result of migrateToThemeDocumentV2 is always parseThemeDocument-valid (minimal bundle)', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = migrateToThemeDocumentV2(bundle);
  const validated = parseThemeDocument(doc);
  assert.equal(validated.document_version, THEME_DOCUMENT_VERSION);
});

// ──────────────────────────────────────────────────────────────────────────────
// V2 serialize/parse equality
// ──────────────────────────────────────────────────────────────────────────────

test('theme-document-migrations: migrated document re-serializes and re-parses to equal value', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const doc = migrateToThemeDocumentV2(bundle);
  const serialized = JSON.stringify(doc);
  const deserialized = parseThemeDocument(JSON.parse(serialized));
  assert.deepEqual(
    JSON.parse(JSON.stringify(deserialized)),
    JSON.parse(JSON.stringify(doc)),
    'V2 document must survive a serialize/parse cycle unchanged',
  );
});
