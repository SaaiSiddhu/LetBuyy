// ============================================================================
// Phase AB — Theme Safe Update Engine tests (Lane A)
// ----------------------------------------------------------------------------
// Every test is independently failable. Gate:
//   pnpm typecheck test --filter=@letbuyy/theme-engine (baseline 1592)
// ============================================================================

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  planThemeSafeUpdate,
  computeThemeUpdateDiff,
  classifyUpdateSetting,
  UpdateVersionRejectedError,
  UpdateDowngradeError,
  type ThemeUpdateDiff,
} from '../src/theme-safe-update.ts';

import {
  parseThemeDocument,
  toThemeDocumentV2,
  THEME_DOCUMENT_VERSION,
  type ThemeDocument,
  type ThemeDocumentBlock,
} from '../src/theme-document.ts';

import {
  parseLiquidThemePackageBundle,
  createMinimalLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,
  LIQUID_THEME_BUNDLE_PATHS,
  type LiquidThemePackageBundle,
} from '../src/theme-bundle.ts';

import { isDynamicSourceDescriptor } from '../src/dynamic-source-binding.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * A minimal valid V1 ThemeDocument produced from the fixture bundle.
 * Section type 'spotlight' lives in the 'index' template with merchant-authored
 * heading + subheading settings and a 'badge' block.
 */
function makeV1Doc(settingsOverride?: Record<string, unknown>): ThemeDocument {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const base = toThemeDocumentV2(bundle);
  if (!settingsOverride) return base;

  // Replace the spotlight section's settings with the override.
  return parseThemeDocument({
    ...base,
    templates: base.templates.map((t) =>
      t.key === 'index'
        ? {
            ...t,
            sections: t.sections.map((s) =>
              s.type === 'spotlight' ? { ...s, settings: settingsOverride } : s,
            ),
          }
        : t,
    ),
  });
}

/**
 * A V2 bundle with the SAME sections and blocks as V1 (spotlight + badge).
 * schema_version = THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2 → direction=1 against V1 docs.
 */
function createV2BundleSameSections(): LiquidThemePackageBundle {
  const v1 = createMinimalLiquidThemeBundleFixture();
  return parseLiquidThemePackageBundle({
    ...v1,
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,
    package: {
      ...v1.package,
      slug: 'liquid-starter-v2',
      version: '2.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    // Keep identical sections/blocks/locales/renderer/layout so the merge is clean.
  });
}

/**
 * A V2 bundle with a DIFFERENT section type ('promo-bar') and NO 'spotlight'.
 * Updating a V1 doc (which has 'spotlight' in its index template) to this bundle
 * causes the 'spotlight' section to be 'removed' in the diff and 'promo-bar'
 * to be 'added'.
 */
function createV2BundleDifferentSections(): LiquidThemePackageBundle {
  const v1 = createMinimalLiquidThemeBundleFixture();
  const promoBarSource = [
    '<section class="lb-promo-bar" data-section-id="{{ section.id }}">',
    '  <p>{{ section.settings.text }}</p>',
    '</section>',
    '{% schema %}',
    '{ "name": "Promo Bar", "settings": [',
    '  { "id": "text", "type": "text", "label": "Text", "default": "Promo" }',
    '], "blocks": [], "presets": [{ "name": "Promo Bar" }] }',
    '{% endschema %}',
  ].join('\n');

  return parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,
    package: {
      slug: 'liquid-starter-v2-alt',
      name: 'Liquid Starter V2 Alt',
      description: 'V2 bundle with only promo-bar (no spotlight).',
      version: '2.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: v1.layout,
    config: {
      settings_schema: v1.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    templates: {
      index: {
        name: 'Home',
        layout: 'theme',
        sections: {
          'promo-default': {
            type: 'promo-bar',
            settings: { text: 'Shop now' },
          },
        },
        order: ['promo-default'],
      },
    },
    sections: {
      'promo-bar': {
        path: 'sections/promo-bar.liquid',
        source: promoBarSource,
        schema: {
          name: 'Promo Bar',
          settings: [{ id: 'text', type: 'text', label: 'Text', default: 'Promo' }],
          blocks: [],
          presets: [{ name: 'Promo Bar' }],
        },
      },
    },
    blocks: {},
    locales: v1.locales,
    renderer: v1.renderer,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Same-version no-op
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: same-version update is a no-op — updatedDoc is the identical reference', () => {
  const currentDoc = makeV1Doc();
  // Both currentDoc and nextBundle are V1 → direction = 0.
  const nextBundle = createMinimalLiquidThemeBundleFixture();

  const result = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.equal(
    result.updatedDoc,
    currentDoc,
    'same-version must return the exact same document reference (no-op)',
  );
});

test('phase-ab: same-version update diff is empty — no sections, no conflicts', () => {
  const currentDoc = makeV1Doc();
  const nextBundle = createMinimalLiquidThemeBundleFixture();

  const result = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });
  const { diff } = result;

  assert.equal(diff.sections.length, 0, 'no-op diff must have no section entries');
  assert.equal(diff.conflicts.length, 0, 'no-op diff must have no conflicts');
  assert.equal(diff.requiresDuplicateBeforeApply, false);
  assert.equal(result.requiresConfirmation, false);
});

test('phase-ab: same-version update diff carries fromVersion and toVersion', () => {
  const currentDoc = makeV1Doc();
  const nextBundle = createMinimalLiquidThemeBundleFixture();
  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.equal(diff.fromVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
  assert.equal(diff.toVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
});

// ──────────────────────────────────────────────────────────────────────────────
// G4 gate: unknown target version rejected
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: unknown target schema_version throws UpdateVersionRejectedError', () => {
  const currentDoc = makeV1Doc();
  // Build a bundle with an unknown future version (bypasses parseLiquidThemePackageBundle G4 gate
  // by constructing the bundle object directly, not via parseLiquidThemePackageBundle which would also
  // reject it — we test our own gate here).
  const unknownBundle = {
    ...createMinimalLiquidThemeBundleFixture(),
    schema_version: 'future-unknown-version-9999',
    package: {
      ...createMinimalLiquidThemeBundleFixture().package,
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
  } as LiquidThemePackageBundle;

  assert.throws(
    () => planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle: unknownBundle }),
    (err) => err instanceof UpdateVersionRejectedError,
    'must throw UpdateVersionRejectedError for an unknown target version',
  );
});

test('phase-ab: computeThemeUpdateDiff also throws UpdateVersionRejectedError for unknown version', () => {
  const currentDoc = makeV1Doc();
  const unknownBundle = {
    ...createMinimalLiquidThemeBundleFixture(),
    schema_version: 'future-unknown-v99',
    package: {
      ...createMinimalLiquidThemeBundleFixture().package,
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
  } as LiquidThemePackageBundle;

  assert.throws(
    () => computeThemeUpdateDiff(currentDoc, unknownBundle),
    (err) => err instanceof UpdateVersionRejectedError,
    'computeThemeUpdateDiff must also gate on unknown target version',
  );
});

test('phase-ab: UpdateVersionRejectedError has correct name, targetVersion, reason', () => {
  const currentDoc = makeV1Doc();
  const unknownBundle = {
    ...createMinimalLiquidThemeBundleFixture(),
    schema_version: 'x-future-unknown',
    package: {
      ...createMinimalLiquidThemeBundleFixture().package,
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
  } as LiquidThemePackageBundle;

  let caught: unknown;
  try {
    planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle: unknownBundle });
  } catch (e) {
    caught = e;
  }

  assert.ok(caught instanceof UpdateVersionRejectedError);
  assert.equal((caught as UpdateVersionRejectedError).name, 'UpdateVersionRejectedError');
  assert.equal((caught as UpdateVersionRejectedError).targetVersion, 'x-future-unknown');
});

// ──────────────────────────────────────────────────────────────────────────────
// Downgrade rejected
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: downgrade from V2 document to V1 bundle throws UpdateDowngradeError', () => {
  // Create a document that claims to be from V2 (the higher version).
  const v2Bundle = createV2BundleSameSections();
  const v2Doc = toThemeDocumentV2(v2Bundle);
  // bundle_schema_version of v2Doc = THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2 (index 1)

  // Target is V1 (index 0 < index 1) → downgrade.
  const v1Bundle = createMinimalLiquidThemeBundleFixture();

  assert.throws(
    () => planThemeSafeUpdate({ currentDocument: v2Doc, nextBundle: v1Bundle }),
    (err) => err instanceof UpdateDowngradeError,
    'must throw UpdateDowngradeError for a V2→V1 downgrade',
  );
});

test('phase-ab: UpdateDowngradeError has correct name, fromVersion, toVersion', () => {
  const v2Bundle = createV2BundleSameSections();
  const v2Doc = toThemeDocumentV2(v2Bundle);
  const v1Bundle = createMinimalLiquidThemeBundleFixture();

  let caught: unknown;
  try {
    planThemeSafeUpdate({ currentDocument: v2Doc, nextBundle: v1Bundle });
  } catch (e) {
    caught = e;
  }

  assert.ok(caught instanceof UpdateDowngradeError);
  assert.equal((caught as UpdateDowngradeError).name, 'UpdateDowngradeError');
  assert.equal((caught as UpdateDowngradeError).fromVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2);
  assert.equal((caught as UpdateDowngradeError).toVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: merchant-content settings preserved
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: cross-version preserves merchant-content settings (text fields)', () => {
  const currentDoc = makeV1Doc({
    heading: 'Merchant Custom Heading',
    subheading: 'Merchant Custom Subheading',
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc, diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // 'spotlight' is in both V1 and V2 → retained.
  const retainedEntry = diff.sections.find(
    (s) => s.type === 'spotlight' && s.action === 'retained',
  );
  assert.ok(retainedEntry, 'spotlight section must be retained in diff');

  // Merged section must carry the merchant-authored text settings.
  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection, 'spotlight section must exist in updated document');
  assert.equal(
    spotlightSection.settings['heading'],
    'Merchant Custom Heading',
    'merchant heading must be carried forward',
  );
  assert.equal(
    spotlightSection.settings['subheading'],
    'Merchant Custom Subheading',
    'merchant subheading must be carried forward',
  );
});

test('phase-ab: cross-version does NOT carry token settings (primaryColor)', () => {
  const currentDoc = makeV1Doc({
    heading: 'Merchant Heading',
    primaryColor: '#FF0000', // token key — must NOT be carried forward
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.ok(
    !('primaryColor' in spotlightSection.settings),
    'token settings must NOT be carried forward from section settings',
  );
  assert.equal(
    spotlightSection.settings['heading'],
    'Merchant Heading',
    'non-token merchant content must still be carried',
  );
});

test('phase-ab: cross-version does NOT carry empty-string settings (generated-placeholder)', () => {
  const currentDoc = makeV1Doc({
    heading: 'Merchant Heading',
    subheading: '', // empty → generated-placeholder → must NOT be carried
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.ok(
    !('subheading' in spotlightSection.settings),
    'empty-string settings must NOT be carried forward (generated-placeholder)',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: resource-binding settings preserved (plain key pattern)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: cross-version preserves resource-binding settings via plain key (collectionHandle)', () => {
  const currentDoc = makeV1Doc({
    heading: 'Shop',
    collectionHandle: 'featured-drops', // resource-binding key → must be carried
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.equal(
    spotlightSection.settings['collectionHandle'],
    'featured-drops',
    'collectionHandle (resource-binding key) must be preserved',
  );
});

test('phase-ab: cross-version preserves resource-binding settings via Id suffix pattern', () => {
  const currentDoc = makeV1Doc({
    heading: 'Shop',
    productId: 'prod-uuid-123', // ends with 'Id' → resource-binding
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.equal(
    spotlightSection.settings['productId'],
    'prod-uuid-123',
    'productId (resource-binding key) must be preserved',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: W binding descriptor values preserved (isDynamicSourceDescriptor)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: cross-version preserves W binding descriptor in section settings', () => {
  const bindingDescriptor = {
    __lb_binding: true,
    source: 'resource' as const,
    resourceType: 'collection' as const,
    id: 'collection-uuid-abc',
  };

  const currentDoc = makeV1Doc({
    heading: 'Shop by collection',
    featuredContent: bindingDescriptor, // key is not in EXPLICIT_RESOURCE_BINDING_KEYS
    // isDynamicSourceDescriptor(bindingDescriptor) → true → classified as resource-binding
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);

  const preservedBinding = spotlightSection.settings['featuredContent'];
  assert.ok(
    isDynamicSourceDescriptor(preservedBinding),
    'W binding descriptor must be preserved as a resource-binding value',
  );
  assert.deepEqual(
    preservedBinding,
    bindingDescriptor,
    'binding descriptor must be preserved byte-for-byte',
  );
});

test('phase-ab: classifyUpdateSetting classifies isDynamicSourceDescriptor as resource-binding', () => {
  const descriptor = { __lb_binding: true, source: 'resource', resourceType: 'product', id: 'x' };
  assert.equal(
    classifyUpdateSetting('anyKey', descriptor),
    'resource-binding',
    'descriptor value must be resource-binding regardless of key name',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: nested block children preserved (Phase T)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: cross-version preserves nested block children (T)', () => {
  // Build a document where the spotlight section has a 'badge' block with a child 'badge'.
  const nestedBlock: ThemeDocumentBlock = {
    id: 'child-badge',
    type: 'badge',
    settings: { label: 'Child Label' },
    disabled: false,
    children: [],
  };
  const parentBlock: ThemeDocumentBlock = {
    id: 'parent-badge',
    type: 'badge',
    settings: { label: 'Parent Label' },
    disabled: false,
    children: [nestedBlock],
  };

  const v1Bundle = createMinimalLiquidThemeBundleFixture();
  const currentDoc = parseThemeDocument({
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: v1Bundle.schema_version,
    package: v1Bundle.package,
    layout: v1Bundle.layout,
    config: {
      settings_schema: v1Bundle.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: v1Bundle.sections,
    block_definitions: v1Bundle.blocks,
    locales: v1Bundle.locales,
    renderer: v1Bundle.renderer,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 'spotlight-main',
            type: 'spotlight',
            settings: { heading: 'Nested block test' },
            disabled: false,
            blocks: [parentBlock],
          },
        ],
      },
    ],
  });

  const nextBundle = createV2BundleSameSections();
  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection, 'spotlight section must be retained');
  assert.equal(spotlightSection.blocks.length, 1, 'parent block must be carried forward');

  const carried = spotlightSection.blocks[0];
  assert.equal(carried.id, 'parent-badge', 'parent block id preserved');
  assert.equal(carried.settings['label'], 'Parent Label', 'parent block settings preserved');
  assert.equal(carried.children.length, 1, 'nested child block must be preserved');
  assert.equal(carried.children[0].id, 'child-badge', 'child block id preserved');
  assert.equal(
    carried.children[0].settings['label'],
    'Child Label',
    'child block settings preserved',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: locale-adjacent text content preserved (Z path via U classification)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: cross-version carries merchant locale-adjacent text (Z classification as merchant-content)', () => {
  // Merchant might store translated text in section settings (U/merchant-content path).
  // The locales field (Z) is replaced by nextBundle.locales; the TEXT CONTENT stays here.
  const currentDoc = makeV1Doc({
    heading: 'Bienvenue', // French merchant-translated text → merchant-content
    subheading: 'Trouvez vos chaussures idéales',
    announcementText: 'Livraison gratuite', // not an explicit resource-binding key → merchant-content
  });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.equal(spotlightSection.settings['heading'], 'Bienvenue', 'translated heading preserved');
  assert.equal(spotlightSection.settings['subheading'], 'Trouvez vos chaussures idéales');
  assert.equal(spotlightSection.settings['announcementText'], 'Livraison gratuite');
});

test('phase-ab: cross-version locales are replaced by nextBundle locales (Z replacement)', () => {
  const currentDoc = makeV1Doc();
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // The locales of the updated doc should come from the nextBundle, not the current doc.
  assert.deepEqual(
    updatedDoc.locales,
    nextBundle.locales,
    'locales must be replaced by nextBundle.locales (merchant text in section settings is preserved separately)',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-version: no customizations → clean update
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: no customizations → clean update produces valid document', () => {
  // Document with no merchant-authored settings (empty settings object).
  const v1Bundle = createMinimalLiquidThemeBundleFixture();
  const currentDocNoCustom = parseThemeDocument({
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: v1Bundle.schema_version,
    package: v1Bundle.package,
    layout: v1Bundle.layout,
    config: {
      settings_schema: v1Bundle.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: v1Bundle.sections,
    block_definitions: v1Bundle.blocks,
    locales: v1Bundle.locales,
    renderer: v1Bundle.renderer,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 'spotlight-clean',
            type: 'spotlight',
            settings: {},   // no merchant content
            disabled: false,
            blocks: [],
          },
        ],
      },
    ],
  });

  const nextBundle = createV2BundleSameSections();
  const { updatedDoc, diff } = planThemeSafeUpdate({
    currentDocument: currentDocNoCustom,
    nextBundle,
  });

  // No content → no conflicts.
  assert.equal(diff.conflicts.length, 0, 'clean update must have no conflicts');
  assert.equal(diff.requiresDuplicateBeforeApply, false);

  // Spotlight section is retained (present in both V1 and V2).
  const retainedEntry = diff.sections.find(
    (s) => s.type === 'spotlight' && s.action === 'retained',
  );
  assert.ok(retainedEntry, 'spotlight must be retained');

  // Updated document must be valid.
  assert.ok(updatedDoc.templates.length > 0, 'updated document must have templates');

  // Section must have empty settings (no carried content).
  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  assert.deepEqual(spotlightSection.settings, {}, 'no-customization section must have empty settings after update');
});

// ──────────────────────────────────────────────────────────────────────────────
// Removed section with merchant content → requiresDuplicateBeforeApply
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: removed customized section raises requiresDuplicateBeforeApply=true', () => {
  // currentDoc has 'spotlight' with merchant heading; nextBundle (V2) has no 'spotlight'.
  const currentDoc = makeV1Doc({ heading: 'Merchant Heading' });
  const nextBundle = createV2BundleDifferentSections();

  const { diff, requiresConfirmation } = planThemeSafeUpdate({
    currentDocument: currentDoc,
    nextBundle,
  });

  assert.equal(diff.requiresDuplicateBeforeApply, true, 'conflicts must require confirmation');
  assert.equal(requiresConfirmation, true, 'requiresConfirmation must mirror requiresDuplicateBeforeApply');
});

test('phase-ab: removed customized section appears in diff.conflicts with lostContent.settings', () => {
  const currentDoc = makeV1Doc({ heading: 'My Custom Heading', subheading: 'My Sub' });
  const nextBundle = createV2BundleDifferentSections();

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const conflict = diff.conflicts.find((c) => c.type === 'spotlight');
  assert.ok(conflict, 'spotlight must appear in diff.conflicts');
  assert.equal(conflict.action, 'removed', 'conflict action must be removed');
  assert.ok(conflict.lostContent, 'conflict must have lostContent');
  assert.ok(conflict.lostContent.settings, 'lostContent.settings must be populated');
  assert.equal(
    conflict.lostContent.settings['heading'],
    'My Custom Heading',
    'lost merchant heading must be in lostContent.settings',
  );
});

test('phase-ab: removed section with NO merchant content does not appear in diff.conflicts', () => {
  // Spotlight with only empty settings → classified as generated-placeholder → no lostContent.
  const v1Bundle = createMinimalLiquidThemeBundleFixture();
  const currentDocNoContent = parseThemeDocument({
    document_version: THEME_DOCUMENT_VERSION,
    bundle_schema_version: v1Bundle.schema_version,
    package: v1Bundle.package,
    layout: v1Bundle.layout,
    config: {
      settings_schema: v1Bundle.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    section_definitions: v1Bundle.sections,
    block_definitions: v1Bundle.blocks,
    locales: v1Bundle.locales,
    renderer: v1Bundle.renderer,
    templates: [
      {
        key: 'index',
        sections: [
          {
            id: 'spotlight-empty',
            type: 'spotlight',
            settings: {},
            disabled: false,
            blocks: [],
          },
        ],
      },
    ],
  });

  const nextBundle = createV2BundleDifferentSections();
  const { diff } = planThemeSafeUpdate({ currentDocument: currentDocNoContent, nextBundle });

  const conflict = diff.conflicts.find((c) => c.type === 'spotlight');
  assert.equal(conflict, undefined, 'empty spotlight must NOT appear in diff.conflicts');
  assert.equal(diff.requiresDuplicateBeforeApply, false, 'no conflicts → no confirmation required');
});

// ──────────────────────────────────────────────────────────────────────────────
// New section type in nextBundle → diff action='added'
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: new section type in nextBundle appears as action=added in diff', () => {
  // currentDoc has 'spotlight'; nextBundle (V2 alt) has 'promo-bar'.
  // 'promo-bar' is in nextBundle.sections but not in currentDoc → added.
  const currentDoc = makeV1Doc();
  const nextBundle = createV2BundleDifferentSections();

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const addedEntry = diff.sections.find((s) => s.type === 'promo-bar' && s.action === 'added');
  assert.ok(addedEntry, 'promo-bar must appear as added in the diff');
  assert.equal(diff.summary.sectionsAdded, 1, 'summary must count one added section');
});

test('phase-ab: added section is NOT automatically inserted into merchant templates', () => {
  // The update preserves merchant layout — new section types are NOT auto-inserted.
  const currentDoc = makeV1Doc();
  const nextBundle = createV2BundleDifferentSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const allSectionTypes = updatedDoc.templates.flatMap((t) => t.sections.map((s) => s.type));
  assert.ok(
    !allSectionTypes.includes('promo-bar'),
    'new section type must NOT be auto-inserted into merchant templates',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// W binding descriptor in removed section → lostContent populated
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: isDynamicSourceDescriptor value in removed section appears in lostContent', () => {
  const bindingDescriptor = {
    __lb_binding: true,
    source: 'resource' as const,
    resourceType: 'product' as const,
    id: 'product-uuid-xyz',
  };

  const currentDoc = makeV1Doc({
    heading: 'Featured',
    featuredItem: bindingDescriptor, // W binding value
  });
  const nextBundle = createV2BundleDifferentSections(); // V2 has no 'spotlight'

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  const conflict = diff.conflicts.find((c) => c.type === 'spotlight');
  assert.ok(conflict, 'spotlight with W binding must appear in conflicts');
  assert.ok(conflict.lostContent, 'lostContent must be populated');
  assert.ok(conflict.lostContent.settings, 'lostContent.settings must include the binding');
  // The binding descriptor itself classifies as resource-binding → appears in lostContent.settings.
  assert.ok(
    isDynamicSourceDescriptor(conflict.lostContent.settings['featuredItem']),
    'W binding descriptor must be preserved in lostContent.settings',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// G migration wired (structural no-op with empty REGISTERED_SECTION_SCHEMA_MIGRATIONS)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: G migration runs before merge — schemaMigrations is empty array (empty registry)', () => {
  // With REGISTERED_SECTION_SCHEMA_MIGRATIONS = [], migrations are applied (no-op).
  // The diff.schemaMigrations must be an empty array (not undefined/null).
  const currentDoc = makeV1Doc({ heading: 'Heading' });
  const nextBundle = createV2BundleSameSections();

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.ok(
    Array.isArray(diff.schemaMigrations),
    'schemaMigrations must be an array (migration engine wired)',
  );
  assert.deepEqual(
    diff.schemaMigrations,
    [],
    'schemaMigrations must be empty array (empty registry = structural no-op)',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Output document passes parseThemeDocument validation (fail-closed gate)
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: updated document passes parseThemeDocument validation', () => {
  const currentDoc = makeV1Doc({ heading: 'Merchant Heading' });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // parseThemeDocument must not throw.
  assert.doesNotThrow(
    () => parseThemeDocument(updatedDoc),
    'updated document must be valid per parseThemeDocument',
  );
});

test('phase-ab: updated document bundle_schema_version matches nextBundle schema_version', () => {
  const currentDoc = makeV1Doc();
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.equal(
    updatedDoc.bundle_schema_version,
    THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,
    'updated document must carry nextBundle schema_version',
  );
});

test('phase-ab: updated document section_definitions come from nextBundle', () => {
  const currentDoc = makeV1Doc();
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // Section definitions should be from the nextBundle (V2), not the current doc (V1).
  // Both V1 and V2 have 'spotlight' in this scenario, so check the key exists.
  assert.ok('spotlight' in updatedDoc.section_definitions);
  assert.deepEqual(
    updatedDoc.section_definitions,
    nextBundle.sections,
    'section_definitions must be replaced with nextBundle.sections',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Determinism: same inputs → identical output
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: planThemeSafeUpdate is deterministic — same inputs produce identical output', () => {
  const currentDoc = makeV1Doc({ heading: 'Determinism Test' });
  const nextBundle = createV2BundleSameSections();

  const result1 = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });
  const result2 = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result1.updatedDoc)),
    JSON.parse(JSON.stringify(result2.updatedDoc)),
    'planThemeSafeUpdate must be deterministic (same inputs → identical output)',
  );
  assert.deepEqual(
    result1.diff.sections,
    result2.diff.sections,
    'diff.sections must be identical on repeated calls',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// classifyUpdateSetting drift test vs Phase O classifySetting
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: classifyUpdateSetting returns token for TOKEN_KEYS (drift parity with Phase O)', () => {
  // Phase O TOKEN_KEYS: primaryColor, secondaryColor, accentColor, backgroundColor,
  //   textColor, surfaceColor, fontFamily, bodyFontFamily, headingFontFamily, borderRadius.
  const tokenKeys = [
    'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor',
    'textColor', 'surfaceColor', 'fontFamily', 'bodyFontFamily',
    'headingFontFamily', 'borderRadius',
  ];
  for (const key of tokenKeys) {
    assert.equal(
      classifyUpdateSetting(key, 'some-value'),
      'token',
      `${key} must classify as token (parity with Phase O)`,
    );
  }
});

test('phase-ab: classifyUpdateSetting returns resource-binding for EXPLICIT_RESOURCE_BINDING_KEYS (Phase O parity)', () => {
  const resourceKeys = [
    'collectionHandle', 'productHandle', 'productId', 'collectionId',
    'featured_collection', 'product_handle', 'collection_handle', 'linked_content',
  ];
  for (const key of resourceKeys) {
    assert.equal(
      classifyUpdateSetting(key, 'some-non-empty-value'),
      'resource-binding',
      `${key} must classify as resource-binding (parity with Phase O)`,
    );
  }
});

test('phase-ab: classifyUpdateSetting returns resource-binding for camelCase Handle/Id suffix (Phase O parity)', () => {
  assert.equal(classifyUpdateSetting('vendorHandle', 'x'), 'resource-binding');
  assert.equal(classifyUpdateSetting('blogId', 'y'), 'resource-binding');
  assert.equal(classifyUpdateSetting('menuHandle', 'z'), 'resource-binding');
});

test('phase-ab: classifyUpdateSetting returns resource-binding for snake_case _handle/_id suffix (Phase O parity)', () => {
  assert.equal(classifyUpdateSetting('product_handle', 'x'), 'resource-binding');
  assert.equal(classifyUpdateSetting('collection_id', 'y'), 'resource-binding');
});

test('phase-ab: classifyUpdateSetting returns generated-placeholder for empty/null/undefined (Phase O parity)', () => {
  assert.equal(classifyUpdateSetting('anyKey', ''), 'generated-placeholder');
  assert.equal(classifyUpdateSetting('anyKey', null), 'generated-placeholder');
  assert.equal(classifyUpdateSetting('anyKey', undefined), 'generated-placeholder');
});

test('phase-ab: classifyUpdateSetting returns merchant-content for non-empty non-token non-binding values (Phase O parity)', () => {
  assert.equal(classifyUpdateSetting('heading', 'My Heading'), 'merchant-content');
  assert.equal(classifyUpdateSetting('bodyText', 'A description.'), 'merchant-content');
  assert.equal(classifyUpdateSetting('count', 42), 'merchant-content');
  assert.equal(classifyUpdateSetting('visible', true), 'merchant-content');
});

test('phase-ab: classifyUpdateSetting W-binding check fires BEFORE token check (Phase AB addition)', () => {
  // A binding descriptor with a key that is a TOKEN_KEY must still be classified as resource-binding.
  const descriptor = { __lb_binding: true, source: 'static' as const, value: '#FF0000' };
  // Use 'primaryColor' as the key — this is a TOKEN_KEY; but the value is a descriptor.
  assert.equal(
    classifyUpdateSetting('primaryColor', descriptor),
    'resource-binding',
    'W binding check (isDynamicSourceDescriptor) must fire before token key check',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// diff summary counters
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: diff.summary counts are accurate for a mixed update', () => {
  // currentDoc has 'spotlight' (retained + removed depending on nextBundle).
  // Using V2 different sections: spotlight is removed, promo-bar is added.
  const currentDoc = makeV1Doc({ heading: 'My heading' });
  const nextBundle = createV2BundleDifferentSections();

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  assert.equal(diff.summary.sectionsRemoved, 1, 'one section removed (spotlight)');
  assert.equal(diff.summary.sectionsAdded, 1, 'one section added (promo-bar)');
  assert.equal(diff.summary.sectionsRetained, 0, 'no sections retained');
  assert.equal(diff.summary.sectionsWithLostContent, 1, 'one section with lost content');
});

test('phase-ab: diff.summary counts are accurate for a clean same-section update', () => {
  const currentDoc = makeV1Doc({ heading: 'Merchant Heading' });
  const nextBundle = createV2BundleSameSections();

  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // spotlight is retained (in both V1 and V2), badge block type is also in V2.
  assert.equal(diff.summary.sectionsRetained, 1, 'spotlight section retained');
  assert.equal(diff.summary.sectionsRemoved, 0, 'no sections removed');
  assert.equal(diff.summary.sectionsWithLostContent, 0, 'no lost content');
});

// ──────────────────────────────────────────────────────────────────────────────
// preserveContent=false option
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: preserveContent=false skips merchant setting carry-forward', () => {
  const currentDoc = makeV1Doc({ heading: 'Merchant Heading', subheading: 'Merchant Sub' });
  const nextBundle = createV2BundleSameSections();

  const { updatedDoc } = planThemeSafeUpdate({
    currentDocument: currentDoc,
    nextBundle,
    options: { preserveContent: false },
  });

  const indexTemplate = updatedDoc.templates.find((t) => t.key === 'index');
  const spotlightSection = indexTemplate?.sections.find((s) => s.type === 'spotlight');
  assert.ok(spotlightSection);
  // With preserveContent=false, NO merchant settings are carried.
  assert.ok(
    !('heading' in spotlightSection.settings),
    'preserveContent=false must not carry merchant heading',
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// computeThemeUpdateDiff (pure preview) agrees with planThemeSafeUpdate diff
// ──────────────────────────────────────────────────────────────────────────────

test('phase-ab: computeThemeUpdateDiff produces same diff shape as planThemeSafeUpdate', () => {
  const currentDoc = makeV1Doc({ heading: 'Heading' });
  const nextBundle = createV2BundleSameSections();

  const previewDiff = computeThemeUpdateDiff(currentDoc, nextBundle);
  const { diff } = planThemeSafeUpdate({ currentDocument: currentDoc, nextBundle });

  // Core invariants must match between preview and apply diff.
  assert.equal(previewDiff.fromVersion, diff.fromVersion);
  assert.equal(previewDiff.toVersion, diff.toVersion);
  assert.equal(previewDiff.requiresDuplicateBeforeApply, diff.requiresDuplicateBeforeApply);
  assert.equal(previewDiff.sections.length, diff.sections.length);
  assert.equal(previewDiff.conflicts.length, diff.conflicts.length);
});

// ──────────────────────────────────────────────────────────────────────────────
// NO-DATA-LOSS: retained section with dropped block types surfaces lostContent
// ──────────────────────────────────────────────────────────────────────────────

/**
 * V2 bundle that keeps the 'spotlight' section type but removes the 'badge'
 * block type from both the section schema and the global blocks registry.
 * This means any 'badge' blocks in the merchant's document are silently
 * unreachable — the NO-DATA-LOSS law requires they surface in diff.conflicts.
 */
function createV2BundleSpotlightWithoutBadgeBlock(): LiquidThemePackageBundle {
  const v1 = createMinimalLiquidThemeBundleFixture();
  const spotlightNoBadgeSource = [
    '<section class="lb-spotlight-v2" data-section-id="{{ section.id }}">',
    '  <h1>{{ section.settings.heading }}</h1>',
    '</section>',
    '{% schema %}',
    '{ "name": "Spotlight V2", "settings": [',
    '  { "id": "heading", "type": "text", "label": "Heading", "default": "Default" }',
    '], "blocks": [], "presets": [{ "name": "Spotlight" }] }',
    '{% endschema %}',
  ].join('\n');

  return parseLiquidThemePackageBundle({
    schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION_V2,
    package: {
      slug: 'liquid-starter-v2-no-badge',
      name: 'Liquid Starter V2 No Badge',
      description: 'V2 bundle with spotlight section but badge block removed.',
      version: '2.0.0',
      compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
    },
    layout: v1.layout,
    config: {
      settings_schema: v1.config.settings_schema,
      settings_data: { current: {}, presets: {} },
    },
    templates: {
      index: {
        name: 'Home',
        layout: 'theme',
        sections: {
          'spotlight-default': {
            type: 'spotlight',
            settings: { heading: 'Default heading' },
          },
        },
        order: ['spotlight-default'],
      },
    },
    sections: {
      spotlight: {
        path: 'sections/spotlight.liquid',
        source: spotlightNoBadgeSource,
        schema: {
          name: 'Spotlight V2',
          settings: [{ id: 'heading', type: 'text', label: 'Heading', default: 'Default' }],
          blocks: [], // ← badge block type removed
          presets: [{ name: 'Spotlight' }],
        },
      },
    },
    blocks: {}, // ← global badge block removed
    locales: v1.locales,
    renderer: v1.renderer,
  });
}

test('phase-ab: retained section with dropped block type surfaces lostContent in diff.conflicts (NO-DATA-LOSS)', () => {
  // V1 doc has spotlight with first_badge (type: badge, label: 'Zero storefront code change').
  // V2 bundle keeps spotlight BUT removes badge block type from both inline and global defs.
  // Expected per NO-DATA-LOSS LAW:
  //   - spotlight action = 'retained' (type still exists in new bundle)
  //   - retainedEntry.lostContent.blocks has the dropped badge block with its label
  //   - spotlight appears in diff.conflicts (not just removed sections)
  //   - diff.requiresDuplicateBeforeApply = true
  const currentDoc = makeV1Doc(); // has badge block with label: 'Zero storefront code change'
  const nextBundle = createV2BundleSpotlightWithoutBadgeBlock();

  const { diff, requiresConfirmation } = planThemeSafeUpdate({
    currentDocument: currentDoc,
    nextBundle,
  });

  // Spotlight section must be retained (same type in both bundles).
  const retainedEntry = diff.sections.find((s) => s.type === 'spotlight' && s.action === 'retained');
  assert.ok(retainedEntry, 'spotlight must be retained when its type is still in the new bundle');

  // Retained section must surface the dropped badge block (NO-DATA-LOSS LAW).
  assert.ok(retainedEntry.lostContent, 'retained spotlight must have lostContent when badge block is dropped');
  assert.ok(Array.isArray(retainedEntry.lostContent.blocks), 'lostContent.blocks must be an array');
  const droppedBadge = retainedEntry.lostContent.blocks?.find((b) => b.type === 'badge');
  assert.ok(droppedBadge, 'dropped badge block must appear in lostContent.blocks');
  assert.equal(
    droppedBadge.settings['label'],
    'Zero storefront code change',
    'badge block label (merchant content) must be in lostContent so merchant can recover it',
  );

  // Retained section with lostContent must appear in diff.conflicts (same as removed sections
  // with merchant content — both are scenarios where the merchant must decide whether to duplicate).
  const conflict = diff.conflicts.find((c) => c.type === 'spotlight');
  assert.ok(conflict, 'retained spotlight with dropped blocks must appear in diff.conflicts');
  assert.equal(conflict.action, 'retained', 'conflict entry action must be "retained" (not "removed")');

  // requiresDuplicateBeforeApply must fire when block content will be lost.
  assert.equal(
    diff.requiresDuplicateBeforeApply,
    true,
    'must require confirmation when retained-section block content is lost',
  );
  assert.equal(requiresConfirmation, true, 'requiresConfirmation must mirror requiresDuplicateBeforeApply');

  // Verify computeThemeUpdateDiff agrees with planThemeSafeUpdate.
  const previewDiff = computeThemeUpdateDiff(currentDoc, nextBundle);
  assert.equal(
    previewDiff.requiresDuplicateBeforeApply,
    true,
    'computeThemeUpdateDiff must also detect the dropped block content',
  );
  const previewConflict = previewDiff.conflicts.find((c) => c.type === 'spotlight');
  assert.ok(previewConflict, 'computeThemeUpdateDiff must include retained spotlight in conflicts');
});
