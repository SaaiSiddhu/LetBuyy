// ============================================================================
// PHASE L1 — AI Theme Generator: deterministic ThemeBrief → LiquidThemePackageBundle
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   generateThemeFromBrief is fully deterministic — same ThemeBrief → same bundle.
//   No LLM or AI generation provider is called anywhere in this module.
//   Every step is a pure algorithm composing existing validated primitives.
//
// NOT-CONNECTED seam (the only model boundary):
//   The function that maps a merchant's FREE-TEXT description ("I sell artisanal
//   leather bags in Jaipur, earthy and premium feel") to a typed ThemeBrief requires
//   a real LLM. That boundary is NOT implemented here. The env var that would be
//   needed is THEME_AI_PROVIDER_API_KEY (provider TBD: OpenAI, Anthropic, Gemini)
//   via a dedicated route in services/api-gateway that calls the model and returns
//   the structured brief. That route does not exist.
//   All callers of generateThemeFromBrief must provide a pre-structured ThemeBrief.
//
// Composition chain:
//   ThemeBrief
//     → resolveExperienceForIndustry  (industry → base experience + tokens)
//     → generateColorSystem           (seedColor → 6 WCAG-guaranteed hex tokens)
//     → generateTypographyPairing     (industry/tone → heading + body font)
//     → generateSectionLayout         (pageType + industry → ordered section list)
//     → compilePortableToLiquidBundle (PortableThemeTemplateConfig → LiquidThemePackageBundle)
//
// Safety guardrails (all enforced by the real validators, not stubs):
//   - generateColorSystem validates output through ExperienceColorSystemSchema.parse()
//   - compilePortableToLiquidBundle validates output through parseLiquidThemePackageBundle
//   - lintThemeBundle is called inside generateThemeFromBrief; 0 error-level issues guaranteed
// ============================================================================

import { resolveExperienceForIndustry } from './industry-experience-map';
import { generateColorSystem } from './ai-color-system';
import { generateTypographyPairing } from './ai-typography';
import { generateSectionLayout, type PageType } from './ai-layout';
import {
  compilePortableToLiquidBundle,
  type PortableThemeTemplateConfig,
  type PortableSectionInstance,
} from './portable-to-liquid';
import type { LiquidThemePackageBundle } from './theme-bundle';
import { lintThemeBundle } from './theme-linter';

// ── ThemeBrief ───────────────────────────────────────────────────────────────

/**
 * A structured merchant brief — the TYPED input boundary for all generative functions.
 * This is NOT a natural-language string. The NL→ThemeBrief mapping is NOT-CONNECTED
 * (documented above). Callers supply structured values directly.
 *
 * Named AiGeneratorThemeBrief to distinguish from the higher-level ThemeBrief in
 * theme-ai-sdk.ts (which has a different shape: industry?, primaryColor?, mood?,
 * typography?, goals?, experienceId?). This is the LOWER-LEVEL typed input used
 * directly by the deterministic pipeline below.
 */
export interface AiGeneratorThemeBrief {
  /**
   * Canonical industry key (e.g. 'electronics', 'fashion', 'beauty', 'furniture',
   * 'food', 'sports', 'books', 'pet', 'general') or a normalizable alias.
   * Controls experience selection, typography, and section layout.
   */
  industry?: string | null;

  /**
   * Seed hex color (#RRGGBB) for palette derivation.
   * When provided, the color system is derived from this seed with WCAG-AA guarantees.
   * When omitted, the base experience's primaryColor is used.
   *
   * NOT-CONNECTED seam: mapping a NL mood ("earthy and warm") to a seed hex requires
   * a model — that step is not in this library.
   */
  seedColor?: string | null;

  /**
   * Design tone hint (e.g. 'premium', 'playful', 'technical', 'artisanal').
   * Used to select the typography pairing when no industry is supplied.
   */
  tone?: string | null;

  /**
   * Target page type for the home template section layout.
   * Defaults to 'home'.
   */
  pageType?: PageType;

  /**
   * Explicit experience id override (e.g. 'forge', 'sense').
   * Bypasses industry resolution if valid.
   */
  experienceOverride?: string | null;

  /**
   * Color mode for palette derivation.
   * Defaults to 'light'.
   */
  colorMode?: 'light' | 'dark';
}

// ── GeneratedThemeResult ──────────────────────────────────────────────────────

export interface GeneratedThemeResult {
  /** The compiled, schema-valid Liquid theme bundle. */
  bundle: LiquidThemePackageBundle;
  /**
   * The experience id that was resolved as the generation seed.
   * 'override' | 'industry' | 'fallback' — see ExperienceResolution.source.
   */
  experienceId: string;
  experienceSource: 'override' | 'industry' | 'fallback';
  /**
   * Any section types that could not be mapped to Liquid files by the compiler.
   * These are not errors — the compiler skips them and the lint/validation still passes.
   */
  compilerWarnings: string[];
}

// ── generateThemeFromBrief ────────────────────────────────────────────────────

/**
 * Generate a validated LiquidThemePackageBundle from a structured ThemeBrief.
 *
 * The output bundle passes parseLiquidThemePackageBundle (schema + G4 version gate)
 * and produces zero error-level ThemeLintIssues — lintThemeBundle is called inside
 * this function and throws if any error-level issue is found, so callers never
 * receive a lint-failing bundle.
 *
 * Deterministic: the same ThemeBrief always produces the same bundle.
 */
export function generateThemeFromBrief(brief: AiGeneratorThemeBrief): GeneratedThemeResult {
  const {
    industry = null,
    seedColor = null,
    tone = null,
    pageType = 'home',
    experienceOverride = null,
    colorMode = 'light',
  } = brief;

  // ── Step 1: resolve base experience ─────────────────────────────────────
  const resolution = resolveExperienceForIndustry(industry, experienceOverride ?? undefined);
  const experience = resolution.experience;

  // ── Step 2: derive color system ──────────────────────────────────────────
  const seed = seedColor ?? experience.tokens.primaryColor;
  const colorSystem = generateColorSystem(seed, colorMode);

  // ── Step 3: select typography pairing ────────────────────────────────────
  const typoPairing = generateTypographyPairing({ industry: resolution.industry, tone });

  // ── Step 4: generate section layout ──────────────────────────────────────
  const sectionOrder = generateSectionLayout(pageType, resolution.industry);

  // ── Step 5: build portable template config ───────────────────────────────
  // Separate header, footer, and template sections
  const HEADER = 'header';
  const FOOTER = 'footer';

  const templateSections: PortableSectionInstance[] = sectionOrder
    .filter((type) => type !== HEADER && type !== FOOTER)
    .map((type) => ({ type }));

  const themeSettings = {
    primaryColor: colorSystem.primary,
    secondaryColor: colorSystem.secondary,
    accentColor: colorSystem.accent,
    backgroundColor: colorSystem.background,
    textColor: colorSystem.text,
    surfaceColor: colorSystem.surface,
    fontFamily: typoPairing.fontFamily,
    headingFontFamily: typoPairing.headingFontFamily,
    borderRadius: experience.tokens.borderRadius,
  };

  const templateConfig: PortableThemeTemplateConfig = {
    themeId: experience.id,
    themeSettings,
    sections: {
      header: { type: HEADER },
      template: templateSections,
      footer: { type: FOOTER },
    },
  };

  // ── Step 6: compile → validated LiquidThemePackageBundle ─────────────────
  const { bundle, warnings } = compilePortableToLiquidBundle(templateConfig, {
    slug: `${experience.id}-generated`,
    name: `${experience.name} (Generated)`,
  });

  // ── Safety: lint check — 0 error-level issues guaranteed ─────────────────
  // parseLiquidThemePackageBundle (inside compilePortableToLiquidBundle) catches
  // schema violations, but not all lint rules (e.g. forbidden-attr via style=).
  // Running lintThemeBundle here ensures the documented safety contract holds:
  // callers never receive a bundle with error-level lint issues.
  const errorLintIssues = lintThemeBundle(bundle).filter((i) => i.level === 'error');
  if (errorLintIssues.length > 0) {
    throw new Error(
      `[ai-theme-generator] generateThemeFromBrief: generated bundle has ` +
      `${errorLintIssues.length} lint error(s): ` +
      errorLintIssues.map((i) => `${i.rule}:${i.sectionType}`).join(', ') +
      '. This is a bug in the generator pipeline.',
    );
  }

  return {
    bundle,
    experienceId: experience.id,
    experienceSource: resolution.source,
    compilerWarnings: warnings,
  };
}
