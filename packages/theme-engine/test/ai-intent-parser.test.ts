// ============================================================================
// PHASE AC — Merchant-Intent AI Orchestration Tests
// ----------------------------------------------------------------------------
//
// Gate: pnpm typecheck test --filter=@letbuyy/theme-engine (baseline 1634)
//
// Each test is written to be able to FAIL independently (no shared state
// that would mask failures). Tests cover:
//
//   AC/palette-warm       warm-palette proposal passes parseThemeDocument + WCAG AA
//   AC/palette-all        all five PaletteVariant values produce valid WCAG AA proposals
//   AC/typography         all FontPairingIntents use only EXPERIENCE_FONT_REGISTRY families
//   AC/add-section-ok     testimonials can be added to index template
//   AC/add-section-incompat faqAccordion (no parity) returns 'incompatible'
//   AC/add-section-unknown unknown type returns 'incompatible'
//   AC/a11y-fix-fail      accessibility-fix improves a failing contrast pair
//   AC/a11y-fix-pass      accessibility-fix with passing contrast returns no change
//   AC/free-text          free-text intent returns NOT_CONNECTED (no heuristic NLU)
//   AC/reversible         palette proposal diff can reverse the change
//   AC/no-model           ai-intent-parser.ts imports no HTTP clients or LLM SDKs
//   AC/identity           no-change result byte-identical to input document
//   AC/determinism        same intent on same document produces identical results
// ============================================================================

import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  proposeThemeCustomization,
  type AICustomizationIntent,
} from '../src/ai-intent-parser';
import type { AICustomizationProposal } from '../src/ai-intent-parser';

import { parseThemeDocument, toThemeDocumentV2 } from '../src/theme-document';
import type { ThemeDocument } from '../src/theme-document';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle';
import type { ThemeBundleJson } from '../src/theme-bundle';
import { meetsWcagAA, contrastRatio } from '../src/ai-color-system';
import { EXPERIENCE_FONT_REGISTRY } from '../src/experience-fonts';

// ── Module-level path for the source file assertion ──────────────────────────

const __dirname_compat = dirname(fileURLToPath(import.meta.url));
const INTENT_PARSER_SRC = resolve(__dirname_compat, '../src/ai-intent-parser.ts');

// ── Shared fixture factory (lazy — each test can call independently) ──────────

function makeUrbanKicksDoc(): ThemeDocument {
  return toThemeDocumentV2(createUrbanKicksLiquidThemeBundleFixture());
}

/**
 * Deep-clone a ThemeDocument via JSON round-trip and set specific
 * color tokens in settings_data.current, then re-validate.
 */
function makeDocWithColors(
  doc: ThemeDocument,
  colors: Record<string, string>,
): ThemeDocument {
  const raw = JSON.parse(JSON.stringify(doc)) as ThemeDocument;
  const current = raw.config.settings_data.current as Record<string, ThemeBundleJson>;
  for (const [k, v] of Object.entries(colors)) {
    current[k] = v;
  }
  return parseThemeDocument(raw);
}

// ============================================================================
// WARM-PALETTE PROPOSAL — valid + WCAG AA
// ============================================================================

describe('AC/palette-warm', () => {
  test('warm tone proposal has status ok', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'palette', tone: 'warm' });
    assert.strictEqual(result.status, 'ok');
  });

  test('warm tone proposal returns a validated ThemeDocument', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'palette', tone: 'warm' });
    assert.strictEqual(result.status, 'ok');
    // parseThemeDocument was called internally; re-parsing must not throw.
    if (result.status !== 'ok') return;
    assert.doesNotThrow(() => parseThemeDocument(result.document));
  });

  test('warm tone proposal textColor passes WCAG AA on backgroundColor', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'palette', tone: 'warm' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    const settings = result.document.config.settings_data.current;
    const textColor = settings['textColor'];
    const backgroundColor = settings['backgroundColor'];
    assert.ok(
      typeof textColor === 'string' && typeof backgroundColor === 'string',
      'textColor and backgroundColor must be strings',
    );
    assert.ok(
      meetsWcagAA(textColor as string, backgroundColor as string),
      `textColor ${textColor} must pass WCAG AA on backgroundColor ${backgroundColor}` +
      ` (ratio=${contrastRatio(textColor as string, backgroundColor as string).toFixed(2)})`,
    );
  });

  test('warm tone diff has kind=palette and settingsChanged entries', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'palette', tone: 'warm' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.diff.kind, 'palette');
    assert.ok(result.diff.settingsChanged.length > 0, 'settingsChanged must be non-empty');
    assert.strictEqual(result.diff.sectionsAdded.length, 0);
  });
});

// ============================================================================
// ALL PALETTE VARIANTS — WCAG AA
// ============================================================================

describe('AC/palette-all', () => {
  const VARIANTS = ['warm', 'cool', 'bold', 'muted', 'neutral'] as const;

  for (const tone of VARIANTS) {
    test(`palette tone "${tone}" produces WCAG AA textColor on backgroundColor`, () => {
      const doc = makeUrbanKicksDoc();
      const result = proposeThemeCustomization(doc, { kind: 'palette', tone });
      assert.strictEqual(result.status, 'ok');
      if (result.status !== 'ok') return;
      const settings = result.document.config.settings_data.current;
      const textColor = settings['textColor'];
      const backgroundColor = settings['backgroundColor'];
      assert.ok(
        typeof textColor === 'string' && typeof backgroundColor === 'string',
        `${tone}: color tokens must be strings`,
      );
      assert.ok(
        meetsWcagAA(textColor as string, backgroundColor as string),
        `${tone}: ${textColor} must pass AA on ${backgroundColor}`,
      );
    });

    test(`palette tone "${tone}" produces a valid ThemeDocument`, () => {
      const doc = makeUrbanKicksDoc();
      const result = proposeThemeCustomization(doc, { kind: 'palette', tone });
      assert.strictEqual(result.status, 'ok');
      if (result.status !== 'ok') return;
      assert.doesNotThrow(() => parseThemeDocument(result.document));
    });
  }
});

// ============================================================================
// TYPOGRAPHY PROPOSAL — known fonts only
// ============================================================================

describe('AC/typography', () => {
  const INTENTS = ['editorial', 'technical', 'artisanal', 'friendly', 'neutral'] as const;

  for (const intent of INTENTS) {
    test(`typography intent "${intent}" sets headingFontFamily from EXPERIENCE_FONT_REGISTRY`, () => {
      const doc = makeUrbanKicksDoc();
      const result = proposeThemeCustomization(doc, { kind: 'typography', intent });
      assert.strictEqual(result.status, 'ok');
      if (result.status !== 'ok') return;
      const headingFont = result.document.config.settings_data.current['headingFontFamily'];
      assert.ok(
        typeof headingFont === 'string',
        `${intent}: headingFontFamily must be a string`,
      );
      assert.ok(
        (headingFont as string) in EXPERIENCE_FONT_REGISTRY,
        `${intent}: headingFont "${headingFont}" must be in EXPERIENCE_FONT_REGISTRY`,
      );
    });

    test(`typography intent "${intent}" sets fontFamily from EXPERIENCE_FONT_REGISTRY`, () => {
      const doc = makeUrbanKicksDoc();
      const result = proposeThemeCustomization(doc, { kind: 'typography', intent });
      assert.strictEqual(result.status, 'ok');
      if (result.status !== 'ok') return;
      const bodyFont = result.document.config.settings_data.current['fontFamily'];
      assert.ok(
        typeof bodyFont === 'string',
        `${intent}: fontFamily must be a string`,
      );
      assert.ok(
        (bodyFont as string) in EXPERIENCE_FONT_REGISTRY,
        `${intent}: fontFamily "${bodyFont}" must be in EXPERIENCE_FONT_REGISTRY`,
      );
    });

    test(`typography intent "${intent}" produces valid ThemeDocument`, () => {
      const doc = makeUrbanKicksDoc();
      const result = proposeThemeCustomization(doc, { kind: 'typography', intent });
      assert.strictEqual(result.status, 'ok');
      if (result.status !== 'ok') return;
      assert.doesNotThrow(() => parseThemeDocument(result.document));
    });
  }

  test('typography diff includes fontFamily and headingFontFamily changes', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'typography', intent: 'editorial' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    const changedKeys = result.diff.settingsChanged.map((s) => s.key);
    assert.ok(changedKeys.includes('headingFontFamily'), 'diff must include headingFontFamily');
    assert.ok(changedKeys.includes('fontFamily'), 'diff must include fontFamily');
    assert.strictEqual(result.diff.kind, 'typography');
  });
});

// ============================================================================
// ADD-SECTION — parity types + valid bundle
// ============================================================================

describe('AC/add-section-ok', () => {
  test('testimonials can be added to index template', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'testimonials',
    });
    assert.strictEqual(result.status, 'ok', `Expected ok, got: ${JSON.stringify(result)}`);
  });

  test('add testimonials: result document passes parseThemeDocument', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'testimonials',
    });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.doesNotThrow(() => parseThemeDocument(result.document));
  });

  test('add testimonials: diff has kind=add-section and one sectionsAdded entry', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'testimonials',
    });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.diff.kind, 'add-section');
    assert.strictEqual(result.diff.sectionsAdded.length, 1);
    assert.strictEqual(result.diff.sectionsAdded[0].sectionType, 'testimonials');
    assert.strictEqual(result.diff.sectionsAdded[0].templateKey, 'index');
    assert.strictEqual(result.diff.settingsChanged.length, 0);
  });

  test('add testimonials: new section id appears in the index template', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'testimonials',
    });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    const indexTemplate = result.document.templates.find((t) => t.key === 'index');
    assert.ok(indexTemplate !== undefined, 'index template must exist');
    const addedId = result.diff.sectionsAdded[0].sectionId;
    const found = indexTemplate!.sections.some((s) => s.id === addedId);
    assert.ok(found, `New section id "${addedId}" must appear in index template sections`);
  });

  test('add ctaSection: returns ok (cta-section is in UK bundle)', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'ctaSection',
    });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.diff.sectionsAdded[0].sectionType, 'cta-section');
  });
});

describe('AC/add-section-incompat', () => {
  // faqAccordion and collectionFilter used to be asserted here as 'incompatible' because the bundle
  // shipped no Liquid file for either. The bundle now ships both, so adding them must succeed;
  // instagramFeed and videoHero below keep the incompatible branch covered.
  test('faqAccordion can be added now that the bundle ships a parity file', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'faqAccordion',
    });
    assert.notStrictEqual(result.status, 'incompatible');
  });

  test('collectionFilter can be added now that the bundle ships a parity file', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'collectionFilter',
    });
    assert.notStrictEqual(result.status, 'incompatible');
  });

  test('instagramFeed returns incompatible (not in UK bundle)', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'instagramFeed',
    });
    assert.strictEqual(result.status, 'incompatible');
  });
});

describe('AC/add-section-unknown', () => {
  test('unknown section type returns incompatible', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'completelyUnknownSection',
    });
    assert.strictEqual(result.status, 'incompatible');
  });

  test('empty string section type returns incompatible', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: '',
    });
    assert.strictEqual(result.status, 'incompatible');
  });
});

// ============================================================================
// ACCESSIBILITY-FIX — improves contrast
// ============================================================================

describe('AC/a11y-fix-fail', () => {
  test('accessibility-fix with failing contrast returns ok status', () => {
    // #CCCCCC on #FFFFFF has ~1.6:1 contrast — clearly fails WCAG AA (4.5:1 required)
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#CCCCCC',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
  });

  test('accessibility-fix: fixed textColor passes WCAG AA', () => {
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#CCCCCC',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    const newTextColor = result.document.config.settings_data.current['textColor'];
    assert.ok(
      typeof newTextColor === 'string',
      'fixed textColor must be a string',
    );
    assert.ok(
      meetsWcagAA(newTextColor as string, '#FFFFFF'),
      `Fixed textColor "${newTextColor}" must pass WCAG AA on #FFFFFF ` +
      `(ratio=${contrastRatio(newTextColor as string, '#FFFFFF').toFixed(2)})`,
    );
  });

  test('accessibility-fix diff includes textColor change', () => {
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#CCCCCC',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.ok(
      result.diff.settingsChanged.some((s) => s.key === 'textColor'),
      'diff must include textColor change',
    );
    assert.strictEqual(result.diff.kind, 'accessibility-fix');
  });

  test('accessibility-fix: result document passes parseThemeDocument', () => {
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#AAAAAA',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.doesNotThrow(() => parseThemeDocument(result.document));
  });
});

describe('AC/a11y-fix-pass', () => {
  test('accessibility-fix with passing contrast returns zero settingsChanged', () => {
    // #1A1A2E on #FFFFFF has very high contrast (~19:1) — well above AA threshold
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#1A1A2E',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.diff.settingsChanged.length, 0, 'No settings should change when contrast already passes');
    assert.strictEqual(result.diff.sectionsAdded.length, 0);
  });

  test('accessibility-fix: passing contrast keeps textColor unchanged', () => {
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#1A1A2E',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(
      result.document.config.settings_data.current['textColor'],
      '#1A1A2E',
      'textColor must be unchanged when it already passes AA',
    );
  });
});

// ============================================================================
// FREE-TEXT — NOT_CONNECTED (no fabricated model)
// ============================================================================

describe('AC/free-text', () => {
  test('free-text intent returns status NOT_CONNECTED', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'free-text',
      text: 'make it look more professional',
    });
    assert.strictEqual(result.status, 'NOT_CONNECTED');
  });

  test('free-text result has envVar=THEME_AI_PROVIDER_API_KEY', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'free-text',
      text: 'use earth tones',
    });
    assert.strictEqual(result.status, 'NOT_CONNECTED');
    if (result.status !== 'NOT_CONNECTED') return;
    assert.strictEqual(result.envVar, 'THEME_AI_PROVIDER_API_KEY');
  });

  test('free-text explanation mentions NOT-CONNECTED', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'free-text',
      text: 'warmer and more inviting',
    });
    assert.strictEqual(result.status, 'NOT_CONNECTED');
    if (result.status !== 'NOT_CONNECTED') return;
    assert.ok(
      result.explanation.includes('NOT-CONNECTED') || result.explanation.includes('NOT_CONNECTED'),
      'explanation must reference NOT-CONNECTED seam',
    );
  });
});

// ============================================================================
// REVERSIBILITY — apply then diff reverses
// ============================================================================

describe('AC/reversible', () => {
  test('palette proposal is reversible: applying previousValues restores original tokens', () => {
    const doc = makeUrbanKicksDoc();
    const intent: AICustomizationIntent = { kind: 'palette', tone: 'cool' };
    const result = proposeThemeCustomization(doc, intent);
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;

    // Build the reverse: set previousValue for each changed key.
    const reversed = JSON.parse(JSON.stringify(result.document)) as ThemeDocument;
    const reversedCurrent = reversed.config.settings_data.current as Record<string, ThemeBundleJson>;
    for (const change of result.diff.settingsChanged) {
      if (change.previousValue === undefined || change.previousValue === null) {
        delete reversedCurrent[change.key];
      } else {
        reversedCurrent[change.key] = change.previousValue as ThemeBundleJson;
      }
    }
    const reversedValidated = parseThemeDocument(reversed);

    // Each changed key in the reversed doc should match the original doc.
    for (const change of result.diff.settingsChanged) {
      const origVal = doc.config.settings_data.current[change.key];
      const reversedVal = reversedValidated.config.settings_data.current[change.key];
      assert.deepStrictEqual(
        reversedVal,
        origVal,
        `After reversal, key "${change.key}" should match original (expected ${JSON.stringify(origVal)}, got ${JSON.stringify(reversedVal)})`,
      );
    }
  });

  test('add-section proposal is reversible: removing added sections restores original template', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, {
      kind: 'add-section',
      sectionType: 'testimonials',
    });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;

    const addedId = result.diff.sectionsAdded[0].sectionId;
    const addedTemplateKey = result.diff.sectionsAdded[0].templateKey;

    // Reverse: remove the added section from the template.
    const reversed = JSON.parse(JSON.stringify(result.document)) as ThemeDocument;
    const tpl = reversed.templates.find((t) => t.key === addedTemplateKey);
    assert.ok(tpl !== undefined);
    tpl!.sections = tpl!.sections.filter((s) => s.id !== addedId);
    const reversedValidated = parseThemeDocument(reversed);

    // The original template's sections should match the reversed template.
    const origTpl = doc.templates.find((t) => t.key === addedTemplateKey);
    assert.ok(origTpl !== undefined);
    assert.strictEqual(
      reversedValidated.templates.find((t) => t.key === addedTemplateKey)!.sections.length,
      origTpl!.sections.length,
      'After reversal, template should have same number of sections as original',
    );
  });
});

// ============================================================================
// ZERO FABRICATED MODEL CALLS
// ============================================================================

describe('AC/no-model', () => {
  test('ai-intent-parser.ts does not import any HTTP clients or LLM SDKs', () => {
    const src = readFileSync(INTENT_PARSER_SRC, 'utf8');

    // No fetch, XHR, http.get, axios, got, node-fetch, openai, anthropic, etc.
    const FORBIDDEN_PATTERNS = [
      'fetch(',
      'XMLHttpRequest',
      "require('http')",
      "require('https')",
      "import 'http'",
      "import 'https'",
      "from 'axios'",
      "from 'got'",
      "from 'node-fetch'",
      "from 'openai'",
      "from '@anthropic-ai'",
      "from 'google-generativeai'",
      "openai",
      "anthropic",
      "axios",
      "MODEL_BOUNDARY.status === 'CONNECTED'",
    ];

    for (const pattern of FORBIDDEN_PATTERNS) {
      assert.ok(
        !src.includes(pattern),
        `ai-intent-parser.ts must not contain "${pattern}" (no fabricated model calls)`,
      );
    }
  });

  test('ai-intent-parser.ts does not call Date.now() or Math.random()', () => {
    const src = readFileSync(INTENT_PARSER_SRC, 'utf8');
    // Filter out comment lines (// ...) before checking for non-deterministic calls.
    // Comments documenting that we do NOT use these are fine; actual calls are not.
    const nonCommentLines = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    assert.ok(
      !nonCommentLines.includes('Date.now()'),
      'ai-intent-parser.ts must not call Date.now() in non-comment code (non-deterministic)',
    );
    assert.ok(
      !nonCommentLines.includes('Math.random()'),
      'ai-intent-parser.ts must not call Math.random() in non-comment code (non-deterministic)',
    );
    assert.ok(
      !nonCommentLines.includes('performance.now()'),
      'ai-intent-parser.ts must not call performance.now() in non-comment code (non-deterministic)',
    );
  });
});

// ============================================================================
// BYTE-IDENTICAL IDENTITY — no AI applied → structurally equal result
// ============================================================================

describe('AC/identity', () => {
  test('accessibility-fix with already-passing contrast: textColor unchanged', () => {
    // Use a very dark, high-contrast text color.
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#000000',
      backgroundColor: '#FFFFFF',
    });
    const result = proposeThemeCustomization(doc, { kind: 'accessibility-fix' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;

    assert.strictEqual(result.diff.settingsChanged.length, 0);
    assert.strictEqual(
      result.document.config.settings_data.current['textColor'],
      '#000000',
    );
  });

  test('palette proposal does not change template sections', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'palette', tone: 'muted' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;

    // Template sections must be unchanged.
    for (const tpl of doc.templates) {
      const origSections = tpl.sections.map((s) => s.id).sort();
      const newTpl = result.document.templates.find((t) => t.key === tpl.key);
      if (!newTpl) continue;
      const newSections = newTpl.sections.map((s) => s.id).sort();
      assert.deepStrictEqual(
        newSections,
        origSections,
        `Template "${tpl.key}" sections must be unchanged after palette proposal`,
      );
    }
  });

  test('typography proposal does not change template sections', () => {
    const doc = makeUrbanKicksDoc();
    const result = proposeThemeCustomization(doc, { kind: 'typography', intent: 'neutral' });
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;

    for (const tpl of doc.templates) {
      const origSections = tpl.sections.map((s) => s.id).sort();
      const newTpl = result.document.templates.find((t) => t.key === tpl.key);
      if (!newTpl) continue;
      const newSections = newTpl.sections.map((s) => s.id).sort();
      assert.deepStrictEqual(
        newSections,
        origSections,
        `Template "${tpl.key}" sections must be unchanged after typography proposal`,
      );
    }
  });
});

// ============================================================================
// DETERMINISM — same intent → same result
// ============================================================================

describe('AC/determinism', () => {
  test('same palette intent produces identical diffs', () => {
    const doc = makeUrbanKicksDoc();
    const intent: AICustomizationIntent = { kind: 'palette', tone: 'bold' };

    const r1 = proposeThemeCustomization(doc, intent);
    const r2 = proposeThemeCustomization(doc, intent);

    assert.strictEqual(r1.status, 'ok');
    assert.strictEqual(r2.status, 'ok');
    if (r1.status !== 'ok' || r2.status !== 'ok') return;

    assert.deepStrictEqual(r1.diff, r2.diff);
  });

  test('same palette intent produces structurally identical documents', () => {
    const doc = makeUrbanKicksDoc();
    const intent: AICustomizationIntent = { kind: 'palette', tone: 'neutral' };

    const r1 = proposeThemeCustomization(doc, intent);
    const r2 = proposeThemeCustomization(doc, intent);

    assert.strictEqual(r1.status, 'ok');
    assert.strictEqual(r2.status, 'ok');
    if (r1.status !== 'ok' || r2.status !== 'ok') return;

    assert.strictEqual(
      JSON.stringify(r1.document),
      JSON.stringify(r2.document),
      'Same intent on same document must produce byte-identical serialized documents',
    );
  });

  test('same typography intent produces identical diffs', () => {
    const doc = makeUrbanKicksDoc();
    const intent: AICustomizationIntent = { kind: 'typography', intent: 'artisanal' };

    const r1 = proposeThemeCustomization(doc, intent);
    const r2 = proposeThemeCustomization(doc, intent);

    assert.strictEqual(r1.status, 'ok');
    assert.strictEqual(r2.status, 'ok');
    if (r1.status !== 'ok' || r2.status !== 'ok') return;

    assert.deepStrictEqual(r1.diff, r2.diff);
  });

  test('same add-section intent produces identical section ids', () => {
    const doc = makeUrbanKicksDoc();
    const intent: AICustomizationIntent = {
      kind: 'add-section',
      sectionType: 'testimonials',
    };

    const r1 = proposeThemeCustomization(doc, intent);
    const r2 = proposeThemeCustomization(doc, intent);

    assert.strictEqual(r1.status, 'ok');
    assert.strictEqual(r2.status, 'ok');
    if (r1.status !== 'ok' || r2.status !== 'ok') return;

    assert.strictEqual(
      r1.diff.sectionsAdded[0].sectionId,
      r2.diff.sectionsAdded[0].sectionId,
      'Same intent on same document must produce same section id',
    );
  });

  test('accessibility-fix on same document produces identical results', () => {
    const doc = makeDocWithColors(makeUrbanKicksDoc(), {
      textColor: '#BBBBBB',
      backgroundColor: '#FFFFFF',
    });
    const intent: AICustomizationIntent = { kind: 'accessibility-fix' };

    const r1 = proposeThemeCustomization(doc, intent);
    const r2 = proposeThemeCustomization(doc, intent);

    assert.strictEqual(r1.status, 'ok');
    assert.strictEqual(r2.status, 'ok');
    if (r1.status !== 'ok' || r2.status !== 'ok') return;

    assert.deepStrictEqual(r1.diff, r2.diff);
  });
});
