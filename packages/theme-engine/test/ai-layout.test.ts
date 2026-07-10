// Phase L5 — ai-layout unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateSectionLayout, knownSectionTypeSet, type PageType } from '../src/ai-layout';
import { BUILT_IN_SECTION_TYPES } from '../src/built-in-section-schemas';

const ALL_SECTION_TYPES: ReadonlySet<string> = new Set(BUILT_IN_SECTION_TYPES);

// ── knownSectionTypeSet ───────────────────────────────────────────────────────

describe('knownSectionTypeSet', () => {
  it('returns a ReadonlySet', () => {
    const set = knownSectionTypeSet();
    assert.ok(set instanceof Set, 'expected a Set');
  });

  it('contains all BUILT_IN_SECTION_TYPES', () => {
    const set = knownSectionTypeSet();
    for (const type of BUILT_IN_SECTION_TYPES) {
      assert.ok(set.has(type), `missing type: ${type}`);
    }
  });

  it('returns the same object on repeated calls (singleton)', () => {
    assert.strictEqual(knownSectionTypeSet(), knownSectionTypeSet());
  });
});

// ── generateSectionLayout ─────────────────────────────────────────────────────

describe('generateSectionLayout', () => {
  it('is deterministic — same args → same result', () => {
    const a = generateSectionLayout('home', 'fashion');
    const b = generateSectionLayout('home', 'fashion');
    assert.deepEqual(a, b);
  });

  it('always starts with "header"', () => {
    const pageTypes: PageType[] = ['home', 'product', 'collection', 'page'];
    for (const pageType of pageTypes) {
      const layout = generateSectionLayout(pageType);
      assert.equal(layout[0], 'header', `${pageType}: first section should be header`);
    }
  });

  it('always ends with "footer"', () => {
    const pageTypes: PageType[] = ['home', 'product', 'collection', 'page'];
    for (const pageType of pageTypes) {
      const layout = generateSectionLayout(pageType);
      assert.equal(layout[layout.length - 1], 'footer', `${pageType}: last section should be footer`);
    }
  });

  it('every emitted type is in BUILT_IN_SECTION_TYPES', () => {
    const industries = ['electronics', 'fashion', 'beauty', 'furniture', 'food', 'sports', 'books', 'pet', 'general'];
    const pageTypes: PageType[] = ['home', 'product', 'collection', 'page'];
    for (const industry of industries) {
      for (const pageType of pageTypes) {
        const layout = generateSectionLayout(pageType, industry);
        for (const type of layout) {
          assert.ok(
            ALL_SECTION_TYPES.has(type),
            `pageType=${pageType} industry=${industry}: unknown type "${type}"`,
          );
        }
      }
    }
  });

  it('home layout includes heroBanner', () => {
    const layout = generateSectionLayout('home');
    assert.ok(layout.includes('heroBanner'), 'home layout should include heroBanner');
  });

  it('product layout includes productDetail', () => {
    const layout = generateSectionLayout('product');
    assert.ok(layout.includes('productDetail'), 'product layout should include productDetail');
  });

  it('collection layout includes productGrid', () => {
    const layout = generateSectionLayout('collection');
    assert.ok(layout.includes('productGrid'), 'collection layout should include productGrid');
  });

  it('page layout includes aboutSection or contentPage', () => {
    const layout = generateSectionLayout('page');
    const hasContent = layout.includes('aboutSection') || layout.includes('contentPage');
    assert.ok(hasContent, 'page layout should include aboutSection or contentPage');
  });

  it('returns at least 2 sections (header + footer minimum)', () => {
    const layout = generateSectionLayout('page');
    assert.ok(layout.length >= 2, 'expected at least 2 sections');
  });

  it('fashion home includes testimonials (editorial industry extension)', () => {
    const layout = generateSectionLayout('home', 'fashion');
    assert.ok(
      layout.includes('testimonials'),
      `fashion home should include testimonials, got: ${layout.join(', ')}`,
    );
  });

  it('no duplicates in any layout', () => {
    const pageTypes: PageType[] = ['home', 'product', 'collection', 'page'];
    for (const pageType of pageTypes) {
      const layout = generateSectionLayout(pageType);
      const seen = new Set<string>();
      for (const type of layout) {
        assert.ok(!seen.has(type), `duplicate type "${type}" in ${pageType} layout`);
        seen.add(type);
      }
    }
  });

  it('industry=undefined → no error, returns base layout', () => {
    assert.doesNotThrow(() => generateSectionLayout('home', undefined));
    assert.doesNotThrow(() => generateSectionLayout('home'));
  });

  it('unknown industry → falls back to base layout (no error)', () => {
    const withUnknown = generateSectionLayout('home', 'unknown-industry-xyz');
    const withNoIndustry = generateSectionLayout('home');
    assert.deepEqual(withUnknown, withNoIndustry);
  });
});
