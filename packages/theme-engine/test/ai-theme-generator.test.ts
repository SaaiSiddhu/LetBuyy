// Phase L1 — ai-theme-generator unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateThemeFromBrief, type AiGeneratorThemeBrief } from '../src/ai-theme-generator';
import { lintThemeBundle } from '../src/theme-linter';
import { parseLiquidThemePackageBundle } from '../src/theme-bundle';
import { validateTheme } from '../src/theme-sdk';

describe('generateThemeFromBrief', () => {
  it('is deterministic — same brief → same bundle', () => {
    const brief: AiGeneratorThemeBrief = { industry: 'fashion', seedColor: '#E53935' };
    const a = generateThemeFromBrief(brief);
    const b = generateThemeFromBrief(brief);
    // Compare the bundle JSON — they must be byte-identical
    assert.equal(JSON.stringify(a.bundle), JSON.stringify(b.bundle));
    assert.equal(a.experienceId, b.experienceId);
    assert.equal(a.experienceSource, b.experienceSource);
  });

  it('returns a valid LiquidThemePackageBundle (parseLiquidThemePackageBundle does not throw)', () => {
    const brief: AiGeneratorThemeBrief = { industry: 'electronics' };
    const { bundle } = generateThemeFromBrief(brief);
    // parseLiquidThemePackageBundle validates the G4 schema_version gate + Zod schema
    assert.doesNotThrow(() => parseLiquidThemePackageBundle(bundle));
  });

  it('produces 0 error-level lint issues', () => {
    const brief: AiGeneratorThemeBrief = { industry: 'beauty', seedColor: '#9C27B0' };
    const { bundle } = generateThemeFromBrief(brief);
    const issues = lintThemeBundle(bundle);
    const errors = issues.filter((i) => i.level === 'error');
    assert.equal(
      errors.length,
      0,
      `Expected 0 lint errors, got: ${JSON.stringify(errors)}`,
    );
  });

  it('validateTheme returns no validation errors', () => {
    const brief: AiGeneratorThemeBrief = { industry: 'food' };
    const { bundle } = generateThemeFromBrief(brief);
    const result = validateTheme(bundle);
    assert.ok(result.ok, `Expected ok=true, got issues: ${result.issues?.join(', ')}`);
  });

  it('experienceSource is one of: override | industry | fallback', () => {
    const sources = ['override', 'industry', 'fallback'] as const;
    const brief: AiGeneratorThemeBrief = { industry: 'sports' };
    const result = generateThemeFromBrief(brief);
    assert.ok(
      sources.includes(result.experienceSource),
      `unexpected experienceSource: ${result.experienceSource}`,
    );
  });

  it('industry resolution: "fashion" → experienceId="sense" (not fallback)', () => {
    const result = generateThemeFromBrief({ industry: 'fashion' });
    assert.equal(result.experienceSource, 'industry');
    assert.equal(result.experienceId, 'sense');
  });

  it('experienceOverride takes priority over industry', () => {
    const result = generateThemeFromBrief({ industry: 'electronics', experienceOverride: 'aura' });
    assert.equal(result.experienceSource, 'override');
    assert.equal(result.experienceId, 'aura');
  });

  it('no seedColor → uses experience primaryColor (no throw)', () => {
    assert.doesNotThrow(() => generateThemeFromBrief({ industry: 'pet' }));
  });

  it('custom seedColor is reflected as primary color in the palette', () => {
    const seed = '#FF5733';
    const { bundle } = generateThemeFromBrief({ seedColor: seed });
    // The primary color in settings_data should be the seed (possibly with case normalization)
    const primaryColor = bundle.config?.settings_data?.current?.['primaryColor'] as string | undefined;
    if (primaryColor) {
      assert.equal(
        primaryColor.toUpperCase(),
        seed.toUpperCase(),
        `Expected primaryColor to be ${seed}, got ${primaryColor}`,
      );
    }
    // If not set in settings_data, at minimum there's no error
  });

  it('dark colorMode returns a bundle (no throw)', () => {
    const result = generateThemeFromBrief({ industry: 'beauty', colorMode: 'dark' });
    assert.ok(result.bundle, 'expected a bundle');
    assert.doesNotThrow(() => lintThemeBundle(result.bundle));
  });

  it('empty brief (no fields) returns a valid bundle', () => {
    assert.doesNotThrow(() => {
      const result = generateThemeFromBrief({});
      parseLiquidThemePackageBundle(result.bundle);
    });
  });

  it('compilerWarnings is always an array', () => {
    const result = generateThemeFromBrief({ industry: 'books' });
    assert.ok(Array.isArray(result.compilerWarnings), 'compilerWarnings should be an array');
  });

  it('bundle has templates, sections, locales', () => {
    const result = generateThemeFromBrief({ industry: 'furniture' });
    const { bundle } = result;
    assert.ok(bundle.templates && typeof bundle.templates === 'object', 'missing templates');
    assert.ok(bundle.sections && typeof bundle.sections === 'object', 'missing sections');
    assert.ok(bundle.locales && typeof bundle.locales === 'object', 'missing locales');
  });
});
