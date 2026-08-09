// ============================================================================
// Phase O — Experience Apply Engine Tests
// ============================================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyExperienceToDocument,
  computeExperienceApplyDiff,
  type ExperienceApplyOptions,
  type ExperienceApplyDiff,
} from '../src/experience-apply';
import { EXPERIENCE_IDS } from '../src/theme-presets';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle';
import { toThemeDocumentV2, parseThemeDocument, type ThemeDocument } from '../src/theme-document';
import { EXPERIENCE_COMPOSITIONS } from '../src/experience-compositions';
import { collectSectionTypeMapIssues, resolveLiquidSectionType } from '../src/section-type-map';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _ukDoc: ThemeDocument | undefined;
function getUrbanKicksDoc(): ThemeDocument {
  if (!_ukDoc) {
    _ukDoc = toThemeDocumentV2(createUrbanKicksLiquidThemeBundleFixture());
  }
  return _ukDoc;
}

const STYLE_ONLY: ExperienceApplyOptions = { mode: 'STYLE_ONLY' };
const COMPLETE_PRESERVE: ExperienceApplyOptions = { mode: 'COMPLETE_DESIGN', preserveContent: true };
const COMPLETE_REPLACE: ExperienceApplyOptions = { mode: 'COMPLETE_DESIGN', preserveContent: false };

// ── Section type map integrity ────────────────────────────────────────────────

describe('experience-apply: section-type-map integrity', () => {
  test('collectSectionTypeMapIssues returns no issues', () => {
    const issues = collectSectionTypeMapIssues();
    assert.deepStrictEqual(
      issues,
      [],
      `Section type map has issues: ${issues.join('; ')}`,
    );
  });

  test('resolveLiquidSectionType resolves heroBanner → hero-banner in UK bundle', () => {
    const doc = getUrbanKicksDoc();
    const resolved = resolveLiquidSectionType('heroBanner', doc.section_definitions);
    assert.strictEqual(resolved, 'hero-banner');
  });

  // faqAccordion and collectionFilter USED to assert null here: both types had a kebab mapping but no
  // Liquid section file, which is why every experience's collection template — and all of craft —
  // degraded. The bundle now ships both, so the expectation inverts.
  test('resolveLiquidSectionType resolves faqAccordion → faq-accordion in UK bundle', () => {
    const doc = getUrbanKicksDoc();
    assert.strictEqual(resolveLiquidSectionType('faqAccordion', doc.section_definitions), 'faq-accordion');
  });

  test('resolveLiquidSectionType resolves collectionFilter → collection-filter in UK bundle', () => {
    const doc = getUrbanKicksDoc();
    assert.strictEqual(resolveLiquidSectionType('collectionFilter', doc.section_definitions), 'collection-filter');
  });

  // The mapped-but-absent branch still needs coverage; instagramFeed and videoHero remain the two
  // BUILT_IN types with a kebab mapping and no Liquid section file.
  test('resolveLiquidSectionType returns null for a mapped type absent from the bundle', () => {
    const doc = getUrbanKicksDoc();
    assert.strictEqual(resolveLiquidSectionType('instagramFeed', doc.section_definitions), null);
    assert.strictEqual(resolveLiquidSectionType('videoHero', doc.section_definitions), null);
  });

  test('resolveLiquidSectionType returns null for unknown type', () => {
    const doc = getUrbanKicksDoc();
    assert.strictEqual(resolveLiquidSectionType('totally-unknown', doc.section_definitions), null);
  });

  test('cta-section IS present in UK bundle section_definitions', () => {
    const doc = getUrbanKicksDoc();
    const resolved = resolveLiquidSectionType('ctaSection', doc.section_definitions);
    assert.strictEqual(resolved, 'cta-section', 'ctaSection must resolve in the UK bundle (required for Nova distinctness)');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('experience-apply: error handling', () => {
  test('applyExperienceToDocument throws for unknown experience id', () => {
    const doc = getUrbanKicksDoc();
    assert.throws(
      () => applyExperienceToDocument(doc, 'does-not-exist', STYLE_ONLY),
      /Unknown experience id/,
    );
  });

  test('computeExperienceApplyDiff throws for unknown experience id', () => {
    const doc = getUrbanKicksDoc();
    assert.throws(
      () => computeExperienceApplyDiff(doc, 'does-not-exist', STYLE_ONLY),
      /Unknown experience id/,
    );
  });
});

// ── STYLE_ONLY mode ───────────────────────────────────────────────────────────

describe('experience-apply: STYLE_ONLY mode', () => {
  test('STYLE_ONLY does NOT change template sections', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'forge', STYLE_ONLY);
    // Template structure must be identical
    for (const t of doc.templates) {
      const rt = result.templates.find((x) => x.key === t.key);
      assert.ok(rt, `Template '${t.key}' missing from result`);
      assert.strictEqual(rt.sections.length, t.sections.length, `Template '${t.key}': section count changed in STYLE_ONLY`);
      for (let i = 0; i < t.sections.length; i++) {
        assert.strictEqual(rt.sections[i].id, t.sections[i].id, `Template '${t.key}': section id changed at index ${i}`);
        assert.strictEqual(rt.sections[i].type, t.sections[i].type, `Template '${t.key}': section type changed at index ${i}`);
      }
    }
  });

  test('STYLE_ONLY updates settings_data.current with token overlay', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'forge', STYLE_ONLY);
    const current = result.config.settings_data.current as Record<string, unknown>;
    assert.strictEqual(current.primaryColor, '#1E3A5F', 'forge primaryColor not applied');
    assert.strictEqual(current.accentColor, '#00B4D8', 'forge accentColor not applied');
    assert.strictEqual(current.fontFamily, 'Inter', 'forge fontFamily not applied');
  });

  test('STYLE_ONLY diff has no template sections', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'sense', STYLE_ONLY);
    assert.deepStrictEqual(diff.templates, {}, 'STYLE_ONLY diff must have no template entries');
    assert.strictEqual(diff.mode, 'STYLE_ONLY');
  });

  test('STYLE_ONLY diff settings lists changed token keys', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'forge', STYLE_ONLY);
    assert.ok(diff.settings.length > 0, 'STYLE_ONLY must have at least one settings change');
    for (const entry of diff.settings) {
      assert.strictEqual(entry.classification, 'token');
    }
  });

  test('STYLE_ONLY diff has requiresDuplicateBeforeApply = false', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'summit', STYLE_ONLY);
    assert.strictEqual(diff.requiresDuplicateBeforeApply, false);
  });

  test('STYLE_ONLY result passes parseThemeDocument validation', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'aura', STYLE_ONLY);
    assert.doesNotThrow(() => parseThemeDocument(result));
  });
});

// ── COMPLETE_DESIGN mode ──────────────────────────────────────────────────────

describe('experience-apply: COMPLETE_DESIGN mode — index template', () => {
  test('COMPLETE_DESIGN rebuilds the index template with composition sections', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate, 'index template must exist after apply');

    // Summit index: announcementBar, heroBanner, categoryGrid, featuredProducts, productGrid, newsletter
    // All are compatible with UK bundle (no faqAccordion/collectionFilter).
    const types = indexTemplate.sections.map((s) => s.type);
    assert.ok(types.includes('announcement-bar'), 'summit index: must have announcement-bar');
    assert.ok(types.includes('hero-banner'), 'summit index: must have hero-banner');
    assert.ok(types.includes('category-grid'), 'summit index: must have category-grid');
    assert.ok(types.includes('featured-products'), 'summit index: must have featured-products');
    assert.ok(types.includes('product-grid'), 'summit index: must have product-grid');
    assert.ok(types.includes('newsletter-signup'), 'summit index: must have newsletter-signup');
  });

  test('COMPLETE_DESIGN uses composition section ids (not old template ids)', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_REPLACE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    const ids = indexTemplate.sections.map((s) => s.id);
    // New ids follow the composition pattern
    assert.ok(ids.includes('summit-announcementBar-index'), 'expected composition id for announcement bar');
    assert.ok(ids.includes('summit-heroBanner-index'), 'expected composition id for hero banner');
  });

  test('COMPLETE_DESIGN result passes parseThemeDocument validation', () => {
    const doc = getUrbanKicksDoc();
    for (const id of EXPERIENCE_IDS) {
      const { document: result } = applyExperienceToDocument(doc, id, COMPLETE_PRESERVE);
      assert.doesNotThrow(
        () => parseThemeDocument(result),
        `parseThemeDocument failed for experience '${id}'`,
      );
    }
  });

  test('COMPLETE_DESIGN also updates settings_data.current tokens', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'forge', COMPLETE_PRESERVE);
    const current = result.config.settings_data.current as Record<string, unknown>;
    assert.strictEqual(current.primaryColor, '#1E3A5F');
  });
});

describe('experience-apply: COMPLETE_DESIGN — composition compatibility', () => {
  // These three used to assert that faq-accordion and collection-filter came back 'incompatible'.
  // That was the defect, encoded as an expectation: craft could apply none of its three templates and
  // every experience's collection template degraded. The bundle now ships both sections, so the
  // expectation inverts — they must resolve and be applied.
  test('craft index composition applies faqAccordion now that the bundle ships it', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'craft', COMPLETE_PRESERVE);
    const indexDiff = diff.templates['index'];
    assert.ok(indexDiff, 'diff must have index template entry');
    const incompatible = indexDiff.sections.filter((e) => e.action === 'incompatible');
    assert.ok(
      !incompatible.some((e) => e.type === 'faq-accordion'),
      `faq-accordion must no longer be incompatible. Got: ${incompatible.map((e) => e.type).join(', ')}`,
    );
  });

  test('a resolvable composition section reaches the result document', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'craft', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    assert.ok(
      indexTemplate.sections.some((s) => s.type === 'faq-accordion'),
      'faq-accordion resolves against the bundle and must be applied',
    );
  });

  test('collectionFilter resolves in collection template diffs', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE);
    const colDiff = diff.templates['collection'];
    assert.ok(colDiff, 'diff must have collection template entry');
    const incompatible = colDiff.sections.filter((e) => e.action === 'incompatible');
    assert.ok(
      !incompatible.some((e) => e.type === 'collection-filter'),
      `collection-filter must no longer be incompatible. Got: ${incompatible.map((e) => e.type).join(', ')}`,
    );
  });

  // The reason string is what a merchant sees when their bundle predates a section a composition wants.
  // The stock bundle now ships every section craft references, so this drops faq-accordion from the
  // document's section_definitions to reproduce that older-bundle case deterministically.
  test('incompatible entries include an informative reason string', () => {
    const doc = getUrbanKicksDoc();
    const { 'faq-accordion': _omitted, ...withoutFaqAccordion } = doc.section_definitions;
    const olderBundle = { ...doc, section_definitions: withoutFaqAccordion };
    const diff = computeExperienceApplyDiff(olderBundle, 'craft', COMPLETE_PRESERVE);
    const incomp = diff.templates['index']?.sections.find((e) => e.action === 'incompatible');
    assert.ok(incomp, 'Expected faq-accordion to be incompatible once removed from the bundle');
    assert.strictEqual(incomp.type, 'faq-accordion');
    assert.ok(incomp.incompatibleReason, 'incompatibleReason must be non-empty');
    assert.ok(incomp.incompatibleReason.length > 0);
  });
});

// ── Content preservation ──────────────────────────────────────────────────────

describe('experience-apply: content preservation', () => {
  test('preserveContent=true carries forward non-default text settings from same-typed sections', () => {
    const doc = getUrbanKicksDoc();
    // Urban Kicks index has category-grid with title:'Shop by style' (different from schema default 'Shop by Category').
    // Applying summit (which also has categoryGrid in index composition) should preserve the title.
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    const cg = indexTemplate.sections.find((s) => s.type === 'category-grid');
    assert.ok(cg, 'category-grid must exist in result index');
    // UK fixture sets title:'Shop by style' which is merchant-content (differs from schema default)
    assert.strictEqual(
      (cg.settings as Record<string, unknown>).title,
      'Shop by style',
      'Merchant-content title must be preserved from old section',
    );
  });

  test('preserveContent=false replaces all settings with composition placeholders', () => {
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_REPLACE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    const cg = indexTemplate.sections.find((s) => s.type === 'category-grid');
    assert.ok(cg, 'category-grid must exist in result index');
    // With preserveContent=false, the title should be from the summit composition spec
    const settings = cg.settings as Record<string, unknown>;
    assert.strictEqual(settings.title, 'Shop by category', 'Composition placeholder title must be used');
  });

  test('resource-binding keys (collectionHandle) are preserved by default', () => {
    // Create a document with an explicit collectionHandle on featuredProducts.
    const bundleFixture = createUrbanKicksLiquidThemeBundleFixture();
    // Inject a collectionHandle into the featured-products section in the index template.
    const featuredSection = bundleFixture.templates.index.sections['featured-collection-default'];
    (featuredSection.settings as Record<string, unknown>).collectionHandle = 'my-custom-collection';

    const doc = toThemeDocumentV2(bundleFixture);
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    const fp = indexTemplate.sections.find((s) => s.type === 'featured-products');
    assert.ok(fp, 'featured-products must exist in result index');
    const settings = fp.settings as Record<string, unknown>;
    assert.strictEqual(
      settings.collectionHandle,
      'my-custom-collection',
      'collectionHandle (resource-binding) must be preserved',
    );
  });
});

// ── COMPLETE_DESIGN: block preservation in retained sections ─────────────────

describe('experience-apply: block preservation in retained sections (HIGH-2)', () => {
  test('preserveContent=true: category-grid blocks survive apply to retained section', () => {
    // UK bundle category-grid-default has 3 category blocks (Sneakers/Apparel/Accessories).
    // Summit's composition also includes categoryGrid in index, so the section is 'retained'.
    // With preserveContent=true the apply engine must carry all blocks forward.
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate, 'index template must exist after apply');
    const cg = indexTemplate.sections.find((s) => s.type === 'category-grid');
    assert.ok(cg, 'category-grid must be present in the result index');
    assert.strictEqual(
      cg.blocks.length,
      3,
      'All 3 category blocks (Sneakers/Apparel/Accessories) must be preserved when preserveContent=true',
    );
    const blockTypes = cg.blocks.map((b) => b.type);
    assert.ok(
      blockTypes.every((t) => t === 'category'),
      'All preserved blocks must be of type "category"',
    );
  });

  test('preserveContent=true: product-card blocks in featured-products section are preserved', () => {
    // UK bundle featured-collection-default (featured-products) has 3 product-card blocks.
    const doc = getUrbanKicksDoc();
    const { document: result } = applyExperienceToDocument(doc, 'summit', COMPLETE_PRESERVE);
    const indexTemplate = result.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate);
    const fp = indexTemplate.sections.find((s) => s.type === 'featured-products');
    assert.ok(fp, 'featured-products must be present');
    assert.strictEqual(fp.blocks.length, 3, 'All 3 product-card blocks must be preserved');
  });

  test('preserveContent=true: diff does NOT report block loss for retained sections', () => {
    // When preserveContent=true blocks are carried forward, so there is nothing to report as lost.
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'summit', COMPLETE_PRESERVE);
    const indexDiff = diff.templates['index'];
    assert.ok(indexDiff);
    const retainedOrReordered = indexDiff.sections.filter(
      (e) => e.action === 'retained' || e.action === 'reordered',
    );
    for (const entry of retainedOrReordered) {
      assert.strictEqual(
        entry.lostContent,
        undefined,
        `Section '${entry.type}' must not report lostContent when preserveContent=true`,
      );
    }
  });

  test('preserveContent=false: diff reports lost blocks on retained sections with blocks', () => {
    // With preserveContent=false the apply engine does NOT carry blocks forward.
    // The diff must surface this loss so the caller can offer "duplicate before apply".
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'summit', COMPLETE_REPLACE);
    const indexDiff = diff.templates['index'];
    assert.ok(indexDiff);
    // category-grid is retained by summit but its 3 category blocks would be dropped.
    const cgEntry = indexDiff.sections.find((e) => e.type === 'category-grid');
    assert.ok(cgEntry, 'category-grid entry must exist in index diff');
    assert.ok(
      cgEntry.lostContent?.blocks,
      'category-grid must carry lostContent.blocks when preserveContent=false',
    );
    assert.ok(
      cgEntry.lostContent!.blocks!.length > 0,
      'lostContent.blocks must be non-empty',
    );
  });

  test('preserveContent=false: requiresDuplicateBeforeApply=true when retained sections have blocks', () => {
    // Even when no section is removed at all, block loss in retained sections must trigger the flag.
    // We replace ALL managed templates so there are zero removed sections, and put one block on
    // category-grid to be the sole source of the required-duplicate signal.
    const bundleFixture = createUrbanKicksLiquidThemeBundleFixture();
    bundleFixture.templates.index = {
      name: 'Summit-like index with one block on category-grid',
      layout: 'theme',
      sections: {
        'ann-default': { type: 'announcement-bar', settings: {}, blocks: {}, block_order: [], disabled: false },
        'hero-default': { type: 'hero-banner', settings: {}, blocks: {}, block_order: [], disabled: false },
        'cg-default': {
          type: 'category-grid',
          settings: {},
          blocks: { 'cat-1': { type: 'category', settings: { name: 'Sneakers', slug: 'sneakers' } } },
          block_order: ['cat-1'],
          disabled: false,
        },
        'fp-default': { type: 'featured-products', settings: {}, blocks: {}, block_order: [], disabled: false },
        'pg-default': { type: 'product-grid', settings: {}, blocks: {}, block_order: [], disabled: false },
        'nl-default': { type: 'newsletter-signup', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['ann-default', 'hero-default', 'cg-default', 'fp-default', 'pg-default', 'nl-default'],
    };
    // Also clear product+collection so they have no sections that would be removed.
    bundleFixture.templates.product = {
      name: 'Clean product',
      layout: 'theme',
      sections: {
        'pd-default': { type: 'product-detail', settings: {}, blocks: {}, block_order: [], disabled: false },
        'fp-product': { type: 'featured-products', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['pd-default', 'fp-product'],
    };
    bundleFixture.templates.collection = {
      name: 'Clean collection',
      layout: 'theme',
      sections: {
        'pg-collection': { type: 'product-grid', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['pg-collection'],
    };
    const doc = toThemeDocumentV2(bundleFixture);
    const diff = computeExperienceApplyDiff(doc, 'summit', COMPLETE_REPLACE);
    // Verify no removed entries across any managed template.
    const removed = Object.values(diff.templates).flatMap((t) => t.sections).filter((e) => e.action === 'removed');
    assert.deepStrictEqual(removed, [], 'No sections should be removed across any managed template');
    // The sole content-loss signal must come from the category-grid block.
    assert.strictEqual(
      diff.requiresDuplicateBeforeApply,
      true,
      'Block loss in retained category-grid must trigger requiresDuplicateBeforeApply=true',
    );
  });

  test('preserveContent=false: diff hasContentLoss=true when retained sections have blocks', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'summit', COMPLETE_REPLACE);
    assert.strictEqual(
      diff.templates['index']?.hasContentLoss,
      true,
      'hasContentLoss must be true when retained sections have blocks that would be discarded',
    );
  });
});

// ── COMPLETE_DESIGN: removed sections and requiresDuplicateBeforeApply ──────

describe('experience-apply: requiresDuplicateBeforeApply', () => {
  test('UK index has spotlight section with merchant content — requiresDuplicateBeforeApply=true', () => {
    const doc = getUrbanKicksDoc();
    // The UK index template has a 'spotlight' section that is NOT in any experience composition.
    // It has non-empty settings (heading/subheading) → merchant content → triggers duplicate flag.
    const diff = computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE);
    assert.strictEqual(
      diff.requiresDuplicateBeforeApply,
      true,
      'UK bundle has a spotlight section with merchant content; requiresDuplicateBeforeApply must be true',
    );
  });

  test('removed section diff entries have lostContent when merchant content exists', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE);
    const indexDiff = diff.templates['index'];
    assert.ok(indexDiff);
    const removed = indexDiff.sections.filter((e) => e.action === 'removed');
    assert.ok(removed.length > 0, 'UK index must have at least one removed section');
    // spotlight section should be removed with lostContent
    const spotlight = removed.find((e) => e.type === 'spotlight');
    assert.ok(spotlight, 'spotlight must appear as removed');
    assert.ok(spotlight.lostContent, 'spotlight removed entry must have lostContent');
  });

  test('when document has no merchant content in to-be-removed sections, requiresDuplicate=false', () => {
    // Build a document where ALL managed templates contain only sections that summit's
    // composition would retain (no sections that would be removed with merchant content,
    // no blocks in any section). requiresDuplicateBeforeApply must be false.
    const bundleFixture = createUrbanKicksLiquidThemeBundleFixture();
    // index: exactly summit's compatible index section types, all with empty settings+blocks.
    bundleFixture.templates.index = {
      name: 'Clean index',
      layout: 'theme',
      sections: {
        'ann-default': { type: 'announcement-bar', settings: {}, blocks: {}, block_order: [], disabled: false },
        'hero-default': { type: 'hero-banner', settings: {}, blocks: {}, block_order: [], disabled: false },
        'cg-default': { type: 'category-grid', settings: {}, blocks: {}, block_order: [], disabled: false },
        'fp-default': { type: 'featured-products', settings: {}, blocks: {}, block_order: [], disabled: false },
        'pg-default': { type: 'product-grid', settings: {}, blocks: {}, block_order: [], disabled: false },
        'nl-default': { type: 'newsletter-signup', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['ann-default', 'hero-default', 'cg-default', 'fp-default', 'pg-default', 'nl-default'],
    };
    // product: summit's product section types (productDetail + featuredProducts), empty settings+blocks.
    bundleFixture.templates.product = {
      name: 'Clean product',
      layout: 'theme',
      sections: {
        'pd-default': { type: 'product-detail', settings: {}, blocks: {}, block_order: [], disabled: false },
        'fp-product': { type: 'featured-products', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['pd-default', 'fp-product'],
    };
    // collection: only productGrid (summit's only COMPATIBLE collection section), empty settings+blocks.
    // collectionFilter is INCOMPATIBLE so it appears as 'incompatible' (never removed), not 'removed'.
    bundleFixture.templates.collection = {
      name: 'Clean collection',
      layout: 'theme',
      sections: {
        'pg-collection': { type: 'product-grid', settings: {}, blocks: {}, block_order: [], disabled: false },
      },
      order: ['pg-collection'],
    };
    const doc = toThemeDocumentV2(bundleFixture);
    const diff = computeExperienceApplyDiff(doc, 'summit', COMPLETE_REPLACE);
    // No sections removed from any managed template, no blocks → no duplicate needed.
    for (const [key, tDiff] of Object.entries(diff.templates)) {
      const removed = tDiff.sections.filter((e) => e.action === 'removed');
      assert.deepStrictEqual(removed, [], `Clean ${key} template should have no removed sections for summit`);
    }
    assert.strictEqual(diff.requiresDuplicateBeforeApply, false);
  });

  // HIGH-1: requiresDuplicateBeforeApply must fire even when preserveContent=false
  test('preserveContent=false: requiresDuplicateBeforeApply=true when removed section has merchant content', () => {
    // The UK bundle has a spotlight section (heading/subheading + @app block) that is not in
    // any experience composition — it will be removed. Even with preserveContent=false the caller
    // still needs to know that content would be permanently lost so it can offer "duplicate first".
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'forge', COMPLETE_REPLACE);
    assert.strictEqual(
      diff.requiresDuplicateBeforeApply,
      true,
      'spotlight has merchant content and is removed — requiresDuplicateBeforeApply must be true even when preserveContent=false',
    );
    // The template-level hasContentLoss must also be set.
    assert.strictEqual(
      diff.templates['index']?.hasContentLoss,
      true,
      'index hasContentLoss must be true when spotlight is removed',
    );
  });
});

// ── Diff summary correctness ──────────────────────────────────────────────────

describe('experience-apply: diff summary', () => {
  test('COMPLETE_DESIGN diff summary counts are consistent with entries', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE);
    let added = 0, removed = 0, reordered = 0, retained = 0;
    for (const tDiff of Object.values(diff.templates)) {
      for (const e of tDiff.sections) {
        if (e.action === 'added') added++;
        else if (e.action === 'removed') removed++;
        else if (e.action === 'reordered') reordered++;
        else if (e.action === 'retained') retained++;
      }
    }
    assert.strictEqual(diff.summary.sectionsAdded, added);
    assert.strictEqual(diff.summary.sectionsRemoved, removed);
    assert.strictEqual(diff.summary.sectionsReordered, reordered);
    assert.strictEqual(diff.summary.sectionsRetained, retained);
  });

  test('STYLE_ONLY diff summary has zero section counts', () => {
    const doc = getUrbanKicksDoc();
    const diff = computeExperienceApplyDiff(doc, 'summit', STYLE_ONLY);
    assert.strictEqual(diff.summary.sectionsAdded, 0);
    assert.strictEqual(diff.summary.sectionsRemoved, 0);
    assert.strictEqual(diff.summary.sectionsReordered, 0);
    assert.strictEqual(diff.summary.sectionsRetained, 0);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('experience-apply: determinism', () => {
  for (const id of EXPERIENCE_IDS) {
    test(`${id} COMPLETE_DESIGN: two identical calls produce byte-equal documents`, () => {
      const doc = getUrbanKicksDoc();
      const { document: r1 } = applyExperienceToDocument(doc, id, COMPLETE_PRESERVE);
      const { document: r2 } = applyExperienceToDocument(doc, id, COMPLETE_PRESERVE);
      assert.strictEqual(
        JSON.stringify(r1),
        JSON.stringify(r2),
        `${id}: COMPLETE_DESIGN is not deterministic`,
      );
    });
  }

  test('STYLE_ONLY: two identical calls produce byte-equal documents', () => {
    const doc = getUrbanKicksDoc();
    const { document: r1 } = applyExperienceToDocument(doc, 'aura', STYLE_ONLY);
    const { document: r2 } = applyExperienceToDocument(doc, 'aura', STYLE_ONLY);
    assert.strictEqual(JSON.stringify(r1), JSON.stringify(r2));
  });

  test('applyExperienceToDocument does NOT mutate the input document', () => {
    const doc = getUrbanKicksDoc();
    const originalJson = JSON.stringify(doc);
    applyExperienceToDocument(doc, 'forge', COMPLETE_PRESERVE);
    assert.strictEqual(JSON.stringify(doc), originalJson, 'Input document was mutated');
  });

  test('computeExperienceApplyDiff does NOT mutate the input document', () => {
    const doc = getUrbanKicksDoc();
    const originalJson = JSON.stringify(doc);
    computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE);
    assert.strictEqual(JSON.stringify(doc), originalJson, 'Input document was mutated by diff computation');
  });
});

// ── Structural distinctness (post-apply) ─────────────────────────────────────

describe('experience-apply: structural distinctness across all experiences', () => {
  function indexFingerprint(doc: ThemeDocument): string {
    const index = doc.templates.find((t) => t.key === 'index');
    if (!index) return '';
    return index.sections.map((s) => s.type).join('|');
  }

  test('all 10 experiences produce structurally distinct index templates after COMPLETE_DESIGN', () => {
    const doc = getUrbanKicksDoc();
    const fingerprints = new Map<string, string>();
    for (const id of EXPERIENCE_IDS) {
      const { document: result } = applyExperienceToDocument(doc, id, COMPLETE_REPLACE);
      const fp = indexFingerprint(result);
      const prior = fingerprints.get(fp);
      assert.ok(
        !prior,
        `Experiences '${id}' and '${prior}' produced identical index compositions after apply: ${fp}`,
      );
      fingerprints.set(fp, id);
    }
  });

  test('nova and summit have different index fingerprints after COMPLETE_DESIGN', () => {
    const doc = getUrbanKicksDoc();
    const { document: novaDocs } = applyExperienceToDocument(doc, 'nova', COMPLETE_REPLACE);
    const { document: summitDoc } = applyExperienceToDocument(doc, 'summit', COMPLETE_REPLACE);
    assert.notStrictEqual(
      indexFingerprint(novaDocs),
      indexFingerprint(summitDoc),
      'nova and summit must produce structurally distinct index templates',
    );
  });
});

// ── section_definitions NOT mutated ──────────────────────────────────────────

describe('experience-apply: RISK-DUAL-N01 — section_definitions never mutated', () => {
  test('section_definitions is identical before and after COMPLETE_DESIGN apply', () => {
    const doc = getUrbanKicksDoc();
    const originalDefs = JSON.stringify(doc.section_definitions);
    applyExperienceToDocument(doc, 'craft', COMPLETE_PRESERVE);
    // (craft has faqAccordion which is incompatible — verifies incompatible skip doesn't mutate defs)
    assert.strictEqual(
      JSON.stringify(doc.section_definitions),
      originalDefs,
      'section_definitions was mutated (RISK-DUAL-N01 violation)',
    );
  });
});

// ── block_definitions NOT mutated ────────────────────────────────────────────

describe('experience-apply: block_definitions never mutated', () => {
  test('block_definitions is identical before and after COMPLETE_DESIGN apply', () => {
    const doc = getUrbanKicksDoc();
    const originalDefs = JSON.stringify(doc.block_definitions);
    applyExperienceToDocument(doc, 'nova', COMPLETE_PRESERVE);
    assert.strictEqual(
      JSON.stringify(doc.block_definitions),
      originalDefs,
      'block_definitions was mutated',
    );
  });
});

// ── Other templates not touched ───────────────────────────────────────────────

describe('experience-apply: non-managed templates are never modified', () => {
  const nonManagedKeys = ['cart', 'search', 'blog', 'article', 'page', '404', 'password'];

  for (const tKey of nonManagedKeys) {
    test(`${tKey} template is not modified by COMPLETE_DESIGN`, () => {
      const doc = getUrbanKicksDoc();
      const original = doc.templates.find((t) => t.key === tKey);
      if (!original) return; // Template not present in this fixture — skip.
      const { document: result } = applyExperienceToDocument(doc, 'nova', COMPLETE_PRESERVE);
      const resultTemplate = result.templates.find((t) => t.key === tKey);
      assert.ok(resultTemplate, `${tKey} template missing from result`);
      assert.strictEqual(
        JSON.stringify(resultTemplate),
        JSON.stringify(original),
        `${tKey} template was modified by COMPLETE_DESIGN (must be untouched)`,
      );
    });
  }
});

// ── No React sections introduced ──────────────────────────────────────────────

describe('experience-apply: ART-17 compliance', () => {
  test('no new React section types introduced in any composition', () => {
    const doc = getUrbanKicksDoc();
    // React-only section types are those NOT in section_definitions (they're rendered by React, not Liquid).
    // After apply, every section in managed templates must have a type that IS in section_definitions.
    for (const id of EXPERIENCE_IDS) {
      const { document: result } = applyExperienceToDocument(doc, id, COMPLETE_REPLACE);
      for (const t of result.templates) {
        for (const s of t.sections) {
          assert.ok(
            s.type in doc.section_definitions,
            `${id}/${t.key}: section type '${s.type}' is not in section_definitions — ART-17 violation`,
          );
        }
      }
    }
  });
});

// ── COMPLETE_DESIGN: all experiences validate post-apply ─────────────────────

describe('experience-apply: all experiences pass parseThemeDocument after apply', () => {
  for (const id of EXPERIENCE_IDS) {
    test(`${id} COMPLETE_DESIGN result passes parseThemeDocument`, () => {
      const doc = getUrbanKicksDoc();
      const { document: result } = applyExperienceToDocument(doc, id, COMPLETE_PRESERVE);
      assert.doesNotThrow(
        () => parseThemeDocument(result),
        `parseThemeDocument failed for ${id} COMPLETE_DESIGN`,
      );
    });

    test(`${id} STYLE_ONLY result passes parseThemeDocument`, () => {
      const doc = getUrbanKicksDoc();
      const { document: result } = applyExperienceToDocument(doc, id, STYLE_ONLY);
      assert.doesNotThrow(
        () => parseThemeDocument(result),
        `parseThemeDocument failed for ${id} STYLE_ONLY`,
      );
    });
  }
});

// ── Diff experienceId field ───────────────────────────────────────────────────

describe('experience-apply: diff metadata', () => {
  test('diff.experienceId matches the requested experience', () => {
    const doc = getUrbanKicksDoc();
    for (const id of EXPERIENCE_IDS) {
      const diff = computeExperienceApplyDiff(doc, id, STYLE_ONLY);
      assert.strictEqual(diff.experienceId, id);
    }
  });

  test('diff.mode matches the requested mode', () => {
    const doc = getUrbanKicksDoc();
    assert.strictEqual(
      computeExperienceApplyDiff(doc, 'forge', STYLE_ONLY).mode,
      'STYLE_ONLY',
    );
    assert.strictEqual(
      computeExperienceApplyDiff(doc, 'forge', COMPLETE_PRESERVE).mode,
      'COMPLETE_DESIGN',
    );
  });
});
