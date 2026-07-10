// ============================================================================
// PHASE L7 — AI Personalization: deterministic experience selection + token overlay
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All logic is deterministic — same inputs → same outputs. No live visitor data,
//   no ML model, no external service is called.
//
// NOT-CONNECTED seam:
//   The SEGMENT DECISION (which segment a given visitor belongs to at request time)
//   requires live audience data — page views, purchase history, cohort membership.
//   That signal is NOT available to this library. applyPersonalizationOverlay accepts
//   a pre-resolved SegmentTokens value; the caller is responsible for resolving the
//   segment from live data (e.g. via services/api-gateway's audience endpoint, which
//   is not yet implemented).
//
// What this module provides:
//   - selectExperienceForMerchant: extends resolveExperienceForIndustry with a
//     priority-scored, annotated selection that covers override → onboarding-pick →
//     inferred-industry → fallback. Purely deterministic; no live signals needed.
//   - applyPersonalizationOverlay: merges segment-level token overrides onto a
//     settings map or bundle's settings_data.current, using the same G6-validated
//     applyExperienceToSettingsData discipline.
// ============================================================================

import {
  resolveExperienceForIndustry,
  type ExperienceResolution,
} from './industry-experience-map';
import {
  applyExperienceToSettingsData,
  validateExperienceOverlay,
  ExperienceSettingsOverlaySchema,
} from './theme-presets';
import type { LiquidThemePackageBundle } from './theme-bundle';
import { parseLiquidThemePackageBundle } from './theme-bundle';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A structured segment descriptor provided by the caller.
 * The caller resolves which segment a merchant/visitor belongs to from live data.
 * This library only applies the overlay — it does not make the segment decision.
 *
 * NOT-CONNECTED: the segment signal (e.g. "high-GMV" or "new-store") requires
 * real audience/cohort data not available in packages/theme-engine.
 */
export interface SegmentTokens {
  /**
   * A human-readable segment name (e.g. 'new-merchant', 'high-gmv', 'returning-buyer').
   * Used for logging/annotation; not used for any logic in this module.
   */
  segmentId: string;

  /**
   * Token overrides to apply for this segment. These map to ExperienceTokens fields:
   *   primaryColor, secondaryColor, accentColor, backgroundColor, textColor,
   *   surfaceColor, fontFamily, headingFontFamily, borderRadius.
   * Partial: only supplied keys are overlaid; unrecognised keys are dropped by G6 validation.
   */
  tokens: Partial<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    surfaceColor: string;
    fontFamily: string;
    headingFontFamily: string;
    borderRadius: number;
  }>;
}

/** A merchant profile descriptor used for deterministic experience selection. */
export interface MerchantProfile {
  /** The merchant's declared industry (or an alias/label). */
  industry?: string | null;
  /** An explicit experience override chosen during onboarding. */
  onboardingExperiencePick?: string | null;
  /** The experience the merchant had in a previous session (for consistency). */
  previousExperienceId?: string | null;
  /** Locale (e.g. 'en-IN', 'hi-IN') — reserved for future locale-aware selection. */
  locale?: string | null;
}

/** Annotated experience resolution with priority chain and confidence. */
export interface MerchantExperienceResolution extends ExperienceResolution {
  /**
   * Confidence level of the selection.
   * 'high'   — explicit override or onboarding pick.
   * 'medium' — inferred from industry.
   * 'low'    — fallback (no industry signal available).
   */
  confidence: 'high' | 'medium' | 'low';
  /** Human-readable reasoning for the selection. */
  reasoning: string;
}

// ── selectExperienceForMerchant ───────────────────────────────────────────────

/**
 * Deterministically select the best experience for a merchant profile.
 *
 * Priority chain:
 *   1. onboardingExperiencePick (high confidence — merchant chose it)
 *   2. Industry inference via resolveExperienceForIndustry (medium confidence)
 *   3. Fallback: Summit/General (low confidence)
 *
 * previousExperienceId is used for tie-breaking when both industry and previous are
 * available: we favour continuity (previous experience wins when industry maps to
 * the same experience id as previous).
 *
 * Deterministic: same MerchantProfile → same MerchantExperienceResolution.
 */
export function selectExperienceForMerchant(profile: MerchantProfile): MerchantExperienceResolution {
  const { industry, onboardingExperiencePick, previousExperienceId } = profile;

  // 1. Explicit onboarding pick — highest priority
  if (onboardingExperiencePick) {
    const base = resolveExperienceForIndustry(industry, onboardingExperiencePick);
    if (base.source === 'override') {
      return {
        ...base,
        confidence: 'high',
        reasoning: `Merchant explicitly chose experience "${onboardingExperiencePick}" during onboarding.`,
      };
    }
    // onboardingExperiencePick was not a valid experience id — fall through
  }

  // 2. Industry inference
  const base = resolveExperienceForIndustry(industry);

  if (base.source === 'industry') {
    // Favour consistency: if the previous experience matches the inferred one, note it
    const consistent = previousExperienceId === base.experience.id;
    return {
      ...base,
      confidence: 'medium',
      reasoning: consistent
        ? `Industry "${base.industry}" maps to experience "${base.experience.id}" (consistent with previous session).`
        : `Industry "${base.industry}" maps to experience "${base.experience.id}".`,
    };
  }

  // 3. Fallback
  return {
    ...base,
    confidence: 'low',
    reasoning: 'No industry or onboarding preference available. Using General (Summit) fallback experience.',
  };
}

// ── applyPersonalizationOverlay ───────────────────────────────────────────────

export interface PersonalizationResult {
  /** The merged settings map (settings_data.current shape). */
  settings: Record<string, unknown>;
  /** Which token keys were overridden by the segment. */
  appliedKeys: string[];
  /** Which token keys were rejected by G6 validation (invalid type/value). */
  rejectedKeys: string[];
  /** Segment id from the input SegmentTokens. */
  segmentId: string;
  /**
   * NOT-CONNECTED annotation. The segment decision (which segmentId to pass)
   * requires live audience data and is not implemented in this library.
   */
  segmentDecisionNotConnected: true;
}

/**
 * Apply a segment-level token overlay onto a settings map (settings_data.current shape).
 * Uses the same G6 ExperienceSettingsOverlaySchema validation discipline as
 * applyExperienceToSettingsData — invalid token values are rejected, not silently applied.
 *
 * The function is deterministic and pure: it does not mutate its inputs.
 *
 * NOT-CONNECTED: the SEGMENT DECISION (which SegmentTokens to pass) requires live audience
 * data. This function only applies a pre-resolved overlay; the caller owns the segment choice.
 */
export function applyPersonalizationOverlay(
  current: Record<string, unknown>,
  segmentTokens: SegmentTokens,
): PersonalizationResult {
  const appliedKeys: string[] = [];
  const rejectedKeys: string[] = [];

  // Build a candidate overlay from the segment tokens
  const candidate: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(segmentTokens.tokens)) {
    if (value !== undefined && value !== null) {
      candidate[key] = value;
    }
  }

  // Validate through the G6 schema (partial — we only check the keys that are present)
  // Strategy: merge into an ExperienceSettingsOverlaySchema-shaped object and validate each key.
  const merged: Record<string, unknown> = { ...current, ...candidate };

  // We only care about ExperienceSettingsOverlaySchema-shaped keys
  const schemaKeys = [
    'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor',
    'textColor', 'surfaceColor', 'fontFamily', 'bodyFontFamily', 'headingFontFamily', 'borderRadius',
  ] as const;

  const validatedOverlay: Record<string, unknown> = { ...current };

  for (const key of Object.keys(candidate)) {
    if (!schemaKeys.includes(key as typeof schemaKeys[number])) {
      rejectedKeys.push(key);
      continue;
    }
    // Build a test overlay with just this key against the current base
    const testOverlay = buildTestOverlay(current, key, candidate[key]);
    const result = validateExperienceOverlay(testOverlay);
    if (result.ok) {
      validatedOverlay[key] = candidate[key];
      appliedKeys.push(key);
    } else {
      rejectedKeys.push(key);
    }
  }
  void merged; // used above for reference; result is validatedOverlay

  return {
    settings: validatedOverlay,
    appliedKeys,
    rejectedKeys,
    segmentId: segmentTokens.segmentId,
    segmentDecisionNotConnected: true,
  };
}

/**
 * Apply a personalization overlay onto a LiquidThemePackageBundle's settings_data.current.
 * The result bundle is re-validated through parseLiquidThemePackageBundle.
 *
 * Returns the updated bundle + personalization result metadata.
 */
export function applyPersonalizationOverlayToBundle(
  bundle: LiquidThemePackageBundle,
  segmentTokens: SegmentTokens,
): { bundle: LiquidThemePackageBundle; personalization: PersonalizationResult } {
  const current = (bundle.config?.settings_data?.current ?? {}) as Record<string, unknown>;
  const personalization = applyPersonalizationOverlay(current, segmentTokens);

  const updatedBundle = parseLiquidThemePackageBundle({
    ...bundle,
    config: {
      ...bundle.config,
      settings_data: {
        ...bundle.config.settings_data,
        current: personalization.settings,
      },
    },
  });

  return { bundle: updatedBundle, personalization };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a complete ExperienceSettingsOverlaySchema-shaped object from the current settings
 * with a single key override, for G6 validation. Missing required keys get placeholder values
 * that always pass validation so we isolate the key under test.
 */
function buildTestOverlay(
  current: Record<string, unknown>,
  overrideKey: string,
  overrideValue: unknown,
): Record<string, unknown> {
  const PLACEHOLDER_COLOR = '#000000';
  const PLACEHOLDER_FONT = 'Inter';
  const PLACEHOLDER_RADIUS = 8;

  const base: Record<string, unknown> = {
    primaryColor: current['primaryColor'] ?? PLACEHOLDER_COLOR,
    secondaryColor: current['secondaryColor'] ?? PLACEHOLDER_COLOR,
    accentColor: current['accentColor'] ?? PLACEHOLDER_COLOR,
    backgroundColor: current['backgroundColor'] ?? '#FFFFFF',
    textColor: current['textColor'] ?? PLACEHOLDER_COLOR,
    surfaceColor: current['surfaceColor'] ?? '#FFFFFF',
    fontFamily: current['fontFamily'] ?? PLACEHOLDER_FONT,
    bodyFontFamily: current['bodyFontFamily'] ?? current['fontFamily'] ?? PLACEHOLDER_FONT,
    headingFontFamily: current['headingFontFamily'] ?? PLACEHOLDER_FONT,
    borderRadius: current['borderRadius'] ?? PLACEHOLDER_RADIUS,
  };

  base[overrideKey] = overrideValue;
  return base;
}

// Re-export ExperienceResolution for consumers that only import from this module
export type { ExperienceResolution };
