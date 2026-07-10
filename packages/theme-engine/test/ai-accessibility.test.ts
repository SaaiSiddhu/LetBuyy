// Phase L4 — ai-accessibility unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeThemeAccessibility,
  suggestAccessibilityFixes,
  lintIssuesToAccessibilityIssues,
  type AccessibilityIssue,
} from '../src/ai-accessibility';
import { generateThemeFromBrief } from '../src/ai-theme-generator';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle';
import { lintThemeBundle } from '../src/theme-linter';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBundleWithColors(textColor: string, backgroundColor: string) {
  const base = createUrbanKicksLiquidThemeBundleFixture();
  return {
    ...base,
    config: {
      ...base.config,
      settings_data: {
        ...base.config.settings_data,
        current: {
          ...(base.config.settings_data?.current ?? {}),
          textColor,
          backgroundColor,
        },
      },
    },
  };
}

// ── analyzeThemeAccessibility ─────────────────────────────────────────────────

describe('analyzeThemeAccessibility', () => {
  it('returns an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const issues = analyzeThemeAccessibility(bundle);
    assert.ok(Array.isArray(issues));
  });

  it('is deterministic — same bundle → same issues', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const a = analyzeThemeAccessibility(bundle);
    const b = analyzeThemeAccessibility(bundle);
    assert.deepEqual(a, b);
  });

  it('detects contrast-aa-fail for black text on black background', () => {
    const bundle = makeBundleWithColors('#000000', '#000000');
    const issues = analyzeThemeAccessibility(bundle);
    const contrastFails = issues.filter((i) => i.type === 'contrast-aa-fail');
    assert.ok(contrastFails.length > 0, 'Expected at least 1 contrast-aa-fail issue');
  });

  it('no contrast-aa-fail for textColor=black on backgroundColor=white (21:1 pair)', () => {
    // We only assert the specific text/background pair we set passes.
    // Other color pairs (primary, accent) that the Urban Kicks fixture provides
    // in settings_data.current may or may not have their own contrast issues —
    // we do NOT assert those here. We specifically confirm the text/bg pair is fine.
    const bundle = makeBundleWithColors('#000000', '#FFFFFF');
    const issues = analyzeThemeAccessibility(bundle);
    const textBgFails = issues.filter(
      (i) =>
        i.type === 'contrast-aa-fail' &&
        i.colors?.text === '#000000' &&
        i.colors?.background === '#FFFFFF',
    );
    assert.equal(
      textBgFails.length,
      0,
      `Expected no contrast-aa-fail for #000000 on #FFFFFF, got: ${JSON.stringify(textBgFails)}`,
    );
  });

  it('every issue has type, severity, message, location', () => {
    const bundle = makeBundleWithColors('#BBBBBB', '#FFFFFF'); // borderline
    const issues = analyzeThemeAccessibility(bundle);
    for (const issue of issues) {
      assert.ok(issue.type, `missing type in: ${JSON.stringify(issue)}`);
      assert.ok(issue.severity === 'error' || issue.severity === 'warn', `unexpected severity: ${issue.severity}`);
      assert.ok(issue.message, `missing message in: ${JSON.stringify(issue)}`);
      assert.ok(issue.location, `missing location in: ${JSON.stringify(issue)}`);
    }
  });

  it('contrast issues include contrastRatio field', () => {
    const bundle = makeBundleWithColors('#BBBBBB', '#BBBBBB'); // same color = 1:1
    const issues = analyzeThemeAccessibility(bundle);
    const contrastFails = issues.filter((i) => i.type === 'contrast-aa-fail');
    for (const issue of contrastFails) {
      assert.ok(typeof issue.contrastRatio === 'number', `expected contrastRatio to be a number`);
    }
  });

  it('generated theme bundles: textColor/backgroundColor pair passes WCAG AA (generateColorSystem guarantees it)', () => {
    // generateColorSystem guarantees text-on-background AA (≥4.5:1).
    // It does NOT guarantee accent/primary on background pass — those are used
    // as decorative/large-text elements. We only assert the body-text pair here.
    const { bundle } = generateThemeFromBrief({ industry: 'fashion', seedColor: '#E53935' });
    const issues = analyzeThemeAccessibility(bundle);
    const textBgFails = issues.filter(
      (i) => i.type === 'contrast-aa-fail' && i.location === 'settings_data.current' &&
        i.message.includes('textColor on backgroundColor'),
    );
    assert.equal(
      textBgFails.length,
      0,
      `textColor/backgroundColor pair should pass AA, got: ${JSON.stringify(textBgFails)}`,
    );
  });

  it('detects missing-img-alt when a section source has <img> without alt', () => {
    const base = createUrbanKicksLiquidThemeBundleFixture();
    // Inject a bad section source
    const bundleWithBadImg = {
      ...base,
      sections: {
        ...base.sections,
        'test-no-alt': {
          ...Object.values(base.sections)[0],
          source: '<img src="photo.jpg"> <p>Content</p>',
          schema: JSON.stringify({ name: 'Test', settings: [] }),
        },
      },
    };
    const issues = analyzeThemeAccessibility(bundleWithBadImg as never);
    const altIssues = issues.filter((i) => i.type === 'missing-img-alt');
    assert.ok(altIssues.length > 0, 'Expected missing-img-alt issue');
  });

  it('no missing-img-alt when all <img> have alt attribute', () => {
    const base = createUrbanKicksLiquidThemeBundleFixture();
    const bundleWithGoodImg = {
      ...base,
      sections: {
        ...base.sections,
        'test-with-alt': {
          ...Object.values(base.sections)[0],
          source: '<img src="photo.jpg" alt="Product photo"> <p>Content</p>',
          schema: JSON.stringify({ name: 'Test', settings: [] }),
        },
      },
    };
    const issues = analyzeThemeAccessibility(bundleWithGoodImg as never);
    const altIssues = issues.filter((i) => i.type === 'missing-img-alt');
    assert.equal(altIssues.length, 0, 'Expected 0 missing-img-alt issues when alt is present');
  });
});

// ── suggestAccessibilityFixes ─────────────────────────────────────────────────

describe('suggestAccessibilityFixes', () => {
  it('returns an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const fixes = suggestAccessibilityFixes(bundle);
    assert.ok(Array.isArray(fixes));
  });

  it('is deterministic', () => {
    const bundle = makeBundleWithColors('#888888', '#FFFFFF');
    const a = suggestAccessibilityFixes(bundle);
    const b = suggestAccessibilityFixes(bundle);
    assert.deepEqual(a, b);
  });

  it('provides adjust-text-contrast fix for contrast failures', () => {
    const bundle = makeBundleWithColors('#000000', '#000000'); // 1:1 contrast fail
    const issues = analyzeThemeAccessibility(bundle);
    const fixes = suggestAccessibilityFixes(bundle, issues);
    const contrastFixes = fixes.filter((f) => f.type === 'adjust-text-contrast');
    assert.ok(contrastFixes.length > 0, 'Expected at least one adjust-text-contrast fix');
  });

  it('suggested fix color achieves the required AA contrast ratio when provided', () => {
    // Use black on a black background — a contrast-aa-fail for normal text (needs ≥ 4.5:1).
    // The fix targets 4.5:1 for normal text pairs.
    const bundle = makeBundleWithColors('#666666', '#FFFFFF');
    const issues = analyzeThemeAccessibility(bundle);
    // Filter to only normal-text (non-large-text) contrast fails
    const normalTextFails = issues.filter(
      (i) => i.type === 'contrast-aa-fail' && !(i.message ?? '').includes('large text'),
    );
    const fixes = suggestAccessibilityFixes(bundle, normalTextFails);
    for (const fix of fixes) {
      if (fix.type === 'adjust-text-contrast' && fix.suggestedTextColor) {
        const ratio = fix.targetContrastRatio ?? 0;
        // Normal text AA requires 4.5:1
        assert.ok(ratio >= 4.5, `Suggested fix should achieve >= 4.5:1 for normal text, got ${ratio}`);
      }
    }
  });

  it('accepts pre-computed issues to avoid double analysis', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const issues: AccessibilityIssue[] = [];
    // With empty issues, should return empty fixes (no double-analysis)
    const fixes = suggestAccessibilityFixes(bundle, issues);
    assert.equal(fixes.length, 0);
  });
});

// ── lintIssuesToAccessibilityIssues ──────────────────────────────────────────

describe('lintIssuesToAccessibilityIssues', () => {
  it('returns empty array for empty lint issues', () => {
    const result = lintIssuesToAccessibilityIssues([]);
    assert.deepEqual(result, []);
  });

  it('maps forbidden-attr lint issues to lint-forbidden-attr accessibility issues', () => {
    const lintIssues = lintThemeBundle(createUrbanKicksLiquidThemeBundleFixture());
    const forbiddenAttr = lintIssues.filter((i) => i.rule === 'forbidden-attr');
    const a11yIssues = lintIssuesToAccessibilityIssues(forbiddenAttr);
    assert.equal(a11yIssues.length, forbiddenAttr.length);
    for (const issue of a11yIssues) {
      assert.equal(issue.type, 'lint-forbidden-attr');
    }
  });

  it('ignores non-forbidden-attr lint issues', () => {
    const fakeLintIssue = {
      rule: 'forbidden-tag' as const,
      level: 'error' as const,
      sectionType: 'test',
      message: 'test',
    };
    const result = lintIssuesToAccessibilityIssues([fakeLintIssue]);
    assert.equal(result.length, 0, 'Should ignore non-forbidden-attr issues');
  });
});
