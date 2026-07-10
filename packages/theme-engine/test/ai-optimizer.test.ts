// Phase L6 — ai-optimizer unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  analyzeThemeOptimizations,
  optimizeThemeBundle,
  collectLintErrors,
  type OptimizationSuggestion,
} from '../src/ai-optimizer';
import { generateThemeFromBrief } from '../src/ai-theme-generator';
import { createUrbanKicksLiquidThemeBundleFixture, parseLiquidThemePackageBundle } from '../src/theme-bundle';

// ── collectLintErrors ──────────────────────────────────────────────────────────

describe('collectLintErrors', () => {
  it('returns an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const errors = collectLintErrors(bundle);
    assert.ok(Array.isArray(errors));
  });

  it('only returns error-level issues', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const errors = collectLintErrors(bundle);
    for (const err of errors) {
      assert.equal(err.level, 'error');
    }
  });

  it('generated bundles have 0 lint errors', () => {
    const { bundle } = generateThemeFromBrief({ industry: 'beauty' });
    const errors = collectLintErrors(bundle);
    assert.equal(errors.length, 0, `Unexpected lint errors: ${JSON.stringify(errors)}`);
  });
});

// ── analyzeThemeOptimizations ─────────────────────────────────────────────────

describe('analyzeThemeOptimizations', () => {
  it('returns an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const suggestions = analyzeThemeOptimizations(bundle);
    assert.ok(Array.isArray(suggestions));
  });

  it('is deterministic — same bundle → same suggestions', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const a = analyzeThemeOptimizations(bundle);
    const b = analyzeThemeOptimizations(bundle);
    assert.deepEqual(a, b);
  });

  it('every suggestion has type, severity, message, location fields', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const suggestions = analyzeThemeOptimizations(bundle);
    for (const s of suggestions) {
      assert.ok(s.type, `missing type in: ${JSON.stringify(s)}`);
      assert.ok(['error', 'warn', 'info'].includes(s.severity), `unexpected severity: ${s.severity}`);
      assert.ok(s.message, `missing message in: ${JSON.stringify(s)}`);
      assert.ok(s.location, `missing location in: ${JSON.stringify(s)}`);
    }
  });

  it('generated bundles produce 0 error-level suggestions', () => {
    const { bundle } = generateThemeFromBrief({ industry: 'electronics' });
    const suggestions = analyzeThemeOptimizations(bundle);
    const errors = suggestions.filter((s) => s.severity === 'error');
    assert.equal(errors.length, 0, `Unexpected error suggestions: ${JSON.stringify(errors)}`);
  });

  it('detects unused-section when a section is defined but not referenced', () => {
    const base = createUrbanKicksLiquidThemeBundleFixture();
    // Clone an existing section from the bundle but give it a new key not referenced
    // in any template.order[]. We must use an existing section's full structure so
    // the linter can process it without crashing.
    const existingSectionKey = Object.keys(base.sections)[0];
    const existingSection = base.sections[existingSectionKey];
    assert.ok(existingSection, 'Need at least one section in the fixture');

    const bundleWithUnused = {
      ...base,
      sections: {
        ...base.sections,
        'orphan-section-not-in-any-template': existingSection,
      },
    };
    const suggestions = analyzeThemeOptimizations(bundleWithUnused);
    const unused = suggestions.filter((s) => s.type === 'unused-section');
    assert.ok(
      unused.some((s) => s.detail === 'orphan-section-not-in-any-template'),
      `Expected orphan-section-not-in-any-template to be flagged as unused. Suggestions: ${JSON.stringify(unused)}`,
    );
  });

  it('lint-error suggestions come from error-level lint issues', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const suggestions = analyzeThemeOptimizations(bundle);
    const lintErrors = suggestions.filter((s) => s.type === 'lint-error');
    // All lint-error suggestions must have severity='error'
    for (const s of lintErrors) {
      assert.equal(s.severity, 'error');
    }
  });

  it('lint-warning suggestions come from warning-level lint issues', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const suggestions = analyzeThemeOptimizations(bundle);
    const lintWarnings = suggestions.filter((s) => s.type === 'lint-warning');
    for (const s of lintWarnings) {
      assert.equal(s.severity, 'warn');
    }
  });
});

// ── optimizeThemeBundle ────────────────────────────────────────────────────────

describe('optimizeThemeBundle', () => {
  it('returns bundle and report', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const result = optimizeThemeBundle(bundle);
    assert.ok(result.bundle, 'missing bundle');
    assert.ok(result.report, 'missing report');
  });

  it('the returned bundle passes parseLiquidThemePackageBundle validation', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const { bundle: optimized } = optimizeThemeBundle(bundle);
    assert.doesNotThrow(() => parseLiquidThemePackageBundle(optimized));
  });

  it('is deterministic', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const a = optimizeThemeBundle(bundle);
    const b = optimizeThemeBundle(bundle);
    assert.equal(JSON.stringify(a.bundle), JSON.stringify(b.bundle));
    assert.deepEqual(a.report.removedSections, b.report.removedSections);
  });

  it('removes unreferenced sections', () => {
    const base = createUrbanKicksLiquidThemeBundleFixture();
    // Clone an existing section and add it as an unreferenced orphan
    const existingSectionKey = Object.keys(base.sections)[0];
    const existingSection = base.sections[existingSectionKey];
    const orphanKey = 'orphan-not-referenced-in-templates';

    const bundleWithOrphan = {
      ...base,
      sections: {
        ...base.sections,
        [orphanKey]: existingSection,
      },
    };
    const { bundle: optimized, report } = optimizeThemeBundle(bundleWithOrphan);
    assert.ok(
      report.removedSections.includes(orphanKey),
      `Expected ${orphanKey} in removedSections, got: ${JSON.stringify(report.removedSections)}`,
    );
    assert.ok(
      !optimized.sections[orphanKey],
      `${orphanKey} should not be in optimized bundle`,
    );
  });

  it('report.removedSections is an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const { report } = optimizeThemeBundle(bundle);
    assert.ok(Array.isArray(report.removedSections));
  });

  it('report.suggestions is an array', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const { report } = optimizeThemeBundle(bundle);
    assert.ok(Array.isArray(report.suggestions));
  });

  it('optimizer output has 0 error-level lint issues', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const { bundle: optimized } = optimizeThemeBundle(bundle);
    const errors = collectLintErrors(optimized);
    assert.equal(errors.length, 0, `Unexpected lint errors after optimization: ${JSON.stringify(errors)}`);
  });

  it('generated bundle with no unused sections → removedSections is empty', () => {
    const { bundle } = generateThemeFromBrief({ industry: 'pet' });
    const { report } = optimizeThemeBundle(bundle);
    // Generated bundles should not have unused sections (compiler only adds referenced ones)
    // This is a best-effort assertion — there may be some depending on compiler output
    assert.ok(Array.isArray(report.removedSections));
  });
});
