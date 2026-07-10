// Phase L7 — ai-personalization unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  selectExperienceForMerchant,
  applyPersonalizationOverlay,
  applyPersonalizationOverlayToBundle,
  type MerchantProfile,
  type SegmentTokens,
  type MerchantExperienceResolution,
} from '../src/ai-personalization';
import { createUrbanKicksLiquidThemeBundleFixture, parseLiquidThemePackageBundle } from '../src/theme-bundle';

// ── selectExperienceForMerchant ────────────────────────────────────────────────

describe('selectExperienceForMerchant', () => {
  it('returns a MerchantExperienceResolution with required fields', () => {
    const result: MerchantExperienceResolution = selectExperienceForMerchant({});
    assert.ok(result.experience, 'missing experience');
    assert.ok(result.source, 'missing source');
    assert.ok(['high', 'medium', 'low'].includes(result.confidence), `unexpected confidence: ${result.confidence}`);
    assert.ok(result.reasoning, 'missing reasoning');
  });

  it('is deterministic — same profile → same resolution', () => {
    const profile: MerchantProfile = { industry: 'fashion' };
    const a = selectExperienceForMerchant(profile);
    const b = selectExperienceForMerchant(profile);
    assert.equal(a.experience.id, b.experience.id);
    assert.equal(a.confidence, b.confidence);
    assert.equal(a.reasoning, b.reasoning);
  });

  it('NOT-CONNECTED annotation: the segment decision requires live audience data', () => {
    // The selectExperienceForMerchant function accepts structured inputs only
    // The reasoning must mention the source of the decision
    const result = selectExperienceForMerchant({ industry: 'electronics' });
    assert.ok(result.reasoning.length > 0, 'reasoning should be non-empty');
  });

  it('industry="fashion" → sense experience (medium confidence)', () => {
    const result = selectExperienceForMerchant({ industry: 'fashion' });
    assert.equal(result.experience.id, 'sense');
    assert.equal(result.confidence, 'medium');
    assert.equal(result.source, 'industry');
  });

  it('onboardingExperiencePick overrides industry (high confidence)', () => {
    const result = selectExperienceForMerchant({
      industry: 'electronics',
      onboardingExperiencePick: 'aura',
    });
    assert.equal(result.experience.id, 'aura');
    assert.equal(result.confidence, 'high');
    assert.equal(result.source, 'override');
  });

  it('invalid onboardingExperiencePick falls back to industry', () => {
    const result = selectExperienceForMerchant({
      industry: 'food',
      onboardingExperiencePick: 'nonexistent-experience-id-xyz',
    });
    // Falls back to industry-based selection
    assert.equal(result.source, 'industry');
    assert.equal(result.experience.id, 'refresh'); // food → refresh
  });

  it('empty profile → fallback experience (low confidence)', () => {
    const result = selectExperienceForMerchant({});
    assert.equal(result.confidence, 'low');
    assert.equal(result.source, 'fallback');
  });

  it('unknown industry → fallback experience', () => {
    const result = selectExperienceForMerchant({ industry: 'unknown-xyz-123' });
    assert.equal(result.confidence, 'low');
    assert.equal(result.source, 'fallback');
  });
});

// ── applyPersonalizationOverlay ────────────────────────────────────────────────

describe('applyPersonalizationOverlay', () => {
  const BASE_SETTINGS: Record<string, unknown> = {
    primaryColor: '#336699',
    secondaryColor: '#224488',
    accentColor: '#FF5733',
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A2E',
    surfaceColor: '#F9FAFB',
    fontFamily: 'Inter',
    headingFontFamily: 'Playfair Display',
    borderRadius: 12,
  };

  it('returns a PersonalizationResult with required fields', () => {
    const segment: SegmentTokens = { segmentId: 'premium', tokens: {} };
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.ok(result.settings, 'missing settings');
    assert.ok(Array.isArray(result.appliedKeys), 'missing appliedKeys');
    assert.ok(Array.isArray(result.rejectedKeys), 'missing rejectedKeys');
    assert.equal(result.segmentId, 'premium');
    assert.equal(result.segmentDecisionNotConnected, true);
  });

  it('segmentDecisionNotConnected is always true (NOT-CONNECTED annotation)', () => {
    const result = applyPersonalizationOverlay(BASE_SETTINGS, { segmentId: 'test', tokens: {} });
    assert.equal(result.segmentDecisionNotConnected, true);
  });

  it('is deterministic — same inputs → same result', () => {
    const segment: SegmentTokens = { segmentId: 'vip', tokens: { primaryColor: '#FF0000' } };
    const a = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    const b = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.deepEqual(a, b);
  });

  it('applies valid primaryColor override', () => {
    const segment: SegmentTokens = { segmentId: 'red-segment', tokens: { primaryColor: '#FF0000' } };
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.ok(result.appliedKeys.includes('primaryColor'), 'primaryColor should be applied');
    assert.equal(result.settings['primaryColor'], '#FF0000');
  });

  it('applies valid borderRadius override', () => {
    const segment: SegmentTokens = { segmentId: 'sharp', tokens: { borderRadius: 0 } };
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.ok(result.appliedKeys.includes('borderRadius'), 'borderRadius should be applied');
    assert.equal(result.settings['borderRadius'], 0);
  });

  it('rejects unknown token keys', () => {
    const segment: SegmentTokens = {
      segmentId: 'bad',
      tokens: { primaryColor: '#000000' },
    };
    // Inject an unknown key by casting through any
    (segment.tokens as Record<string, unknown>)['unknownKey'] = 'value';
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.ok(result.rejectedKeys.includes('unknownKey'), 'unknownKey should be rejected');
  });

  it('rejects invalid hex color values (G6 validation enforcement)', () => {
    const segment: SegmentTokens = {
      segmentId: 'invalid-color',
      tokens: { primaryColor: 'notahexcolor' as string },
    };
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.ok(result.rejectedKeys.includes('primaryColor'), 'invalid hex should be rejected');
  });

  it('does not mutate the input settings', () => {
    const original = { ...BASE_SETTINGS };
    const segment: SegmentTokens = { segmentId: 'test', tokens: { primaryColor: '#FF0000' } };
    applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.deepEqual(BASE_SETTINGS, original, 'input settings should not be mutated');
  });

  it('empty segment tokens → appliedKeys is empty, settings unchanged', () => {
    const segment: SegmentTokens = { segmentId: 'empty', tokens: {} };
    const result = applyPersonalizationOverlay(BASE_SETTINGS, segment);
    assert.equal(result.appliedKeys.length, 0);
    // Non-token keys in settings should be preserved
    assert.equal(result.settings['primaryColor'], BASE_SETTINGS['primaryColor']);
  });
});

// ── applyPersonalizationOverlayToBundle ───────────────────────────────────────

describe('applyPersonalizationOverlayToBundle', () => {
  it('returns bundle and personalization result', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const segment: SegmentTokens = { segmentId: 'test', tokens: {} };
    const result = applyPersonalizationOverlayToBundle(bundle, segment);
    assert.ok(result.bundle, 'missing bundle');
    assert.ok(result.personalization, 'missing personalization');
  });

  it('returned bundle passes parseLiquidThemePackageBundle validation', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const segment: SegmentTokens = { segmentId: 'test', tokens: { borderRadius: 4 } };
    const { bundle: updated } = applyPersonalizationOverlayToBundle(bundle, segment);
    assert.doesNotThrow(() => parseLiquidThemePackageBundle(updated));
  });

  it('is deterministic', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const segment: SegmentTokens = { segmentId: 'segment-a', tokens: { primaryColor: '#6C63FF' } };
    const a = applyPersonalizationOverlayToBundle(bundle, segment);
    const b = applyPersonalizationOverlayToBundle(bundle, segment);
    assert.equal(JSON.stringify(a.bundle), JSON.stringify(b.bundle));
  });

  it('personalization.segmentDecisionNotConnected is true (NOT-CONNECTED)', () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const segment: SegmentTokens = { segmentId: 'any', tokens: {} };
    const { personalization } = applyPersonalizationOverlayToBundle(bundle, segment);
    assert.equal(personalization.segmentDecisionNotConnected, true);
  });
});
