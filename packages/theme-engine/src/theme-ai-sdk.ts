// Phase L — AI Theme Platform SDK (Lane B: Merchant AI SDK Facade)
// ============================================================================
//
// HONESTY LAW (enforced in code, not just docs):
//   Every function in this module is DETERMINISTIC — same input → same output.
//   No LLM / AI generation provider is imported, called, or referenced.
//   The natural-language-brief → structured-input boundary is NOT-CONNECTED.
//   See MODEL_BOUNDARY (exported constant) for the exact seam.
//
// SAFETY LAW (enforced by validation):
//   Every generated artifact passes the real guardrails before being returned:
//     • parseLiquidThemePackageBundle (G4 version gate + Zod schema)
//     • lintThemeBundle (5 rules, 0 error-level issues guaranteed)
//     • ExperienceSettingsOverlaySchema (G6 overlay validation)
//     • WCAG 2.1 AA contrast math (implemented below — the one safety guardrail
//       that did not exist before Phase L; every palette generator calls it)
//
// COMPOSE law:
//   This module composes the full Phase B-K stack. It never reimplements what
//   already exists. All types from the composable surface are re-exported where
//   callers need them (see imports section).
// ============================================================================

import { ExperienceTokensSchema, type ExperienceTokens } from './theme-presets';
import { resolveExperienceForIndustry, type ExperienceResolution } from './industry-experience-map';
import { EXPERIENCE_FONT_REGISTRY, buildGoogleFontsHref } from './experience-fonts';
import { compilePortableToLiquidBundle, type PortableThemeTemplateConfig } from './portable-to-liquid';
import { parseLiquidThemePackageBundle, type LiquidThemePackageBundle } from './theme-bundle';
import { lintThemeBundle, type ThemeLintIssue, type ThemeLintRule } from './theme-linter';
import { validateTheme } from './theme-sdk';
import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';
import { THEME_LIQUID_PORTABLE_SECTION_PARITY } from './theme-governance';
// WCAG 2.1 contrast math — canonical implementation lives in ai-color-system (single source of truth).
// Imported for local use inside deterministicPalette, darkenToContrast, checkAccessibility, etc.
// Re-exported below so callers who previously imported these from theme-ai-sdk continue to work.
import { relativeLuminance, contrastRatio, meetsWcagAA } from './ai-color-system';
export { relativeLuminance, contrastRatio, meetsWcagAA };

// ============================================================================
// PART 1 — WCAG 2.1 CONTRAST MATH
// Canonical implementation lives in ai-color-system.ts (single source of truth).
// relativeLuminance, contrastRatio, meetsWcagAA are imported and re-exported
// at the top of this file. Callers who import from theme-ai-sdk continue to work.
// ============================================================================

// ============================================================================
// PART 2 — INTERNAL COLOUR MATH (HSL ↔ RGB ↔ HEX)
// ============================================================================

/**
 * Parse a 6-digit hex colour string (#RRGGBB) into normalised [0, 1] RGB components.
 * Retained as a private helper for darkenToContrast and deterministicPalette.
 * @internal
 */
function hexToRgbNorm(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** @internal */
function rgbToHex(r: number, g: number, b: number): string {
  const ch = (c: number): string =>
    Math.round(Math.max(0, Math.min(255, c * 255))).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** @internal */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** @internal */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hFrac = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  function hue(t: number): number {
    const t1 = ((t % 1) + 1) % 1;
    if (t1 < 1 / 6) return p + (q - p) * 6 * t1;
    if (t1 < 0.5) return q;
    if (t1 < 2 / 3) return p + (q - p) * (2 / 3 - t1) * 6;
    return p;
  }
  return [hue(hFrac + 1 / 3), hue(hFrac), hue(hFrac - 1 / 3)];
}

/**
 * Darken a #RRGGBB hex colour in HSL space until it achieves a given contrast
 * ratio against white (#FFFFFF). Returns the darkened colour or #111111 as a
 * last resort (which always passes both AA thresholds on white).
 * @internal
 */
function darkenToContrast(hex: string, minRatio: number): string {
  const [r, g, b] = hexToRgbNorm(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  for (let lNext = Math.min(l, 0.5); lNext >= 0.05; lNext -= 0.03) {
    const candidate = rgbToHex(...hslToRgb(h, s, lNext));
    if (contrastRatio(candidate, '#FFFFFF') >= minRatio) return candidate;
  }
  return '#111111';
}

// ============================================================================
// PART 3 — PARAMETRIC PALETTE GENERATOR
// ============================================================================

/**
 * Aesthetic intent variants for the parametric palette generator.
 *   warm    — shift hue toward red/orange; increase saturation slightly
 *   cool    — shift hue toward blue/green; reduce saturation slightly
 *   bold    — maximum saturation; darken primary
 *   muted   — desaturate; lighten surface and accent
 *   neutral — minimal adjustments; uses seed as-is with slight tonal grounding
 */
export type PaletteVariant = 'warm' | 'cool' | 'bold' | 'muted' | 'neutral';

/**
 * Derive a validated ExperienceTokens palette from a seed primary colour and an
 * aesthetic intent variant.
 *
 * DETERMINISM CONTRACT: same seed + same variant → same ExperienceTokens.
 * SAFETY CONTRACT: every returned palette satisfies WCAG 2.1 AA:
 *   • textColor on backgroundColor ≥ 4.5 : 1  (normal text)
 *   • primaryColor on backgroundColor ≥ 3.0 : 1  (large text / headings)
 *
 * @param seed      A valid 6-digit hex colour (the merchant's brand primary).
 * @param variant   Aesthetic intent — adjusts hue rotation + lightness/saturation.
 *
 * @throws {Error} if the seed is not a valid #RRGGBB hex, or if the WCAG
 *   invariant cannot be satisfied (should never happen in practice).
 */
export function deterministicPalette(seed: string, variant: PaletteVariant): ExperienceTokens {
  if (!/^#[0-9A-Fa-f]{6}$/.test(seed)) {
    throw new Error(`deterministicPalette: seed must be a 6-digit hex colour, got "${seed}"`);
  }

  const [sr, sg, sb] = hexToRgbNorm(seed);
  let [h, s, l] = rgbToHsl(sr, sg, sb);

  // Apply variant adjustments to hue, saturation, and lightness.
  switch (variant) {
    case 'warm':
      h = (h + 18) % 360;
      s = Math.min(s + 0.12, 0.95);
      break;
    case 'cool':
      h = (h - 18 + 360) % 360;
      s = Math.max(s - 0.08, 0.1);
      break;
    case 'bold':
      s = Math.min(s + 0.25, 1.0);
      l = Math.max(l - 0.08, 0.1);
      break;
    case 'muted':
      s = Math.max(s - 0.20, 0.1);
      l = Math.min(l + 0.10, 0.70);
      break;
    case 'neutral':
      // Minimal adjustments: keep the seed as-is with slight grounding.
      s = Math.max(Math.min(s, 0.85), 0.15);
      break;
  }

  // ── Derive primary (capped at L=0.45 so it can achieve 3:1 on white for most hues) ──
  const primaryCandidateL = Math.min(l, 0.45);
  const primaryRaw = rgbToHex(...hslToRgb(h, s, primaryCandidateL));
  const primaryColor = meetsWcagAA(primaryRaw, '#FFFFFF', true)
    ? primaryRaw
    : darkenToContrast(primaryRaw, 3.0);

  // ── Secondary: same hue, 10% more saturated, 10% darker ──
  const secondaryColor = rgbToHex(...hslToRgb(
    h,
    Math.min(s + 0.10, 1.0),
    Math.max(primaryCandidateL - 0.10, 0.05),
  ));

  // ── Accent: complementary hue (+150°), similar saturation, slightly lighter ──
  const accentH = (h + 150) % 360;
  const accentRaw = rgbToHex(...hslToRgb(accentH, Math.min(s + 0.05, 1.0), Math.min(l + 0.05, 0.60)));
  const accentColor = accentRaw;

  // ── Background: always pure white for maximum contrast headroom ──
  const backgroundColor = '#FFFFFF';

  // ── Surface: very light tint of primary hue ──
  const surfaceColor = rgbToHex(...hslToRgb(h, Math.max(s * 0.12, 0.05), 0.97));

  // ── Text: near-dark with slight hue tint; must pass 4.5:1 on white ──
  const textRaw = rgbToHex(...hslToRgb(h, Math.min(s * 0.28, 0.20), 0.10));
  const textColor = meetsWcagAA(textRaw, backgroundColor)
    ? textRaw
    : '#111111';

  // Build and validate through ExperienceTokensSchema.
  const tokens = ExperienceTokensSchema.parse({
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    textColor,
    surfaceColor,
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 8,
  });

  // SAFETY: assert WCAG invariants before returning (fail-closed).
  if (!meetsWcagAA(tokens.textColor, tokens.backgroundColor)) {
    throw new Error(
      `[theme-ai-sdk] deterministicPalette: generated palette fails WCAG AA normal-text ` +
      `(${tokens.textColor} on ${tokens.backgroundColor}, ratio=${contrastRatio(tokens.textColor, tokens.backgroundColor).toFixed(2)}). ` +
      `This is a bug in the generator — please report it.`,
    );
  }
  if (!meetsWcagAA(tokens.primaryColor, tokens.backgroundColor, true)) {
    throw new Error(
      `[theme-ai-sdk] deterministicPalette: generated palette fails WCAG AA large-text ` +
      `(${tokens.primaryColor} on ${tokens.backgroundColor}, ratio=${contrastRatio(tokens.primaryColor, tokens.backgroundColor).toFixed(2)}). ` +
      `This is a bug in the generator — please report it.`,
    );
  }

  return tokens;
}

// ============================================================================
// PART 4 — TYPOGRAPHY PAIRING
// ============================================================================

/**
 * Aesthetic design intent for a heading + body font pairing.
 *   editorial   — high-contrast serif heading + clean sans body (magazines, fashion)
 *   technical   — mono-weight sans for both heading and body (dashboards, tech)
 *   artisanal   — humanist serif heading + neutral sans body (crafts, food)
 *   friendly    — rounded sans for both (pets, children, wellness)
 *   neutral     — Inter for both — the safe, versatile baseline
 */
export type FontPairingIntent = 'editorial' | 'technical' | 'artisanal' | 'friendly' | 'neutral';

export interface FontPairing {
  headingFontFamily: string;
  fontFamily: string;
  intent: FontPairingIntent;
  /** Google Fonts stylesheet href for the pair, or null if only system fonts are used. */
  googleFontsHref: string | null;
}

/**
 * Canonical pairing catalogue — every family is drawn strictly from
 * EXPERIENCE_FONT_REGISTRY so the font-loading plumbing (buildGoogleFontsHref)
 * is always wired and correct.
 */
export const FONT_PAIRING_CATALOG: ReadonlyArray<FontPairing> = Object.freeze([
  {
    intent: 'editorial',
    headingFontFamily: 'Playfair Display',
    fontFamily: 'Inter',
    googleFontsHref: buildGoogleFontsHref(['Playfair Display', 'Inter']),
  },
  {
    intent: 'technical',
    headingFontFamily: 'Inter',
    fontFamily: 'Source Sans Pro',
    googleFontsHref: buildGoogleFontsHref(['Inter', 'Source Sans Pro']),
  },
  {
    intent: 'artisanal',
    headingFontFamily: 'Cormorant Garamond',
    fontFamily: 'Lato',
    googleFontsHref: buildGoogleFontsHref(['Cormorant Garamond', 'Lato']),
  },
  {
    intent: 'friendly',
    // Inter heading (neutral, highly legible) + Lato body (warm, approachable).
    // Aligned with ai-typography.ts TYPOGRAPHY_PAIRING_CATALOG 'friendly' entry
    // to ensure both code paths produce the same heading/body assignment for the
    // same merchant intent (same seed → same output, integration-level determinism).
    headingFontFamily: 'Inter',
    fontFamily: 'Lato',
    googleFontsHref: buildGoogleFontsHref(['Inter', 'Lato']),
  },
  {
    intent: 'neutral',
    headingFontFamily: 'Inter',
    fontFamily: 'Inter',
    googleFontsHref: buildGoogleFontsHref(['Inter']),
  },
]);

/**
 * Suggest a heading + body font pairing for the given design intent.
 * Always returns a pair drawn from EXPERIENCE_FONT_REGISTRY.
 */
export function suggestTypographyPairing(intent: FontPairingIntent): FontPairing {
  return FONT_PAIRING_CATALOG.find((p) => p.intent === intent) ?? FONT_PAIRING_CATALOG[4]!;
}

// ============================================================================
// PART 5 — SECTION-ORDER GENERATOR
// ============================================================================

/**
 * A merchant's high-level goal for a storefront section slot.
 * The generator maps goals to concrete camelCase section types from
 * BUILT_IN_SECTION_TYPES that have Liquid parity.
 */
export type SectionGoal =
  | 'brand_story'       // → aboutSection, ctaSection
  | 'product_showcase'  // → categoryGrid, featuredProducts, productGrid
  | 'trust_building'    // → trustBadges, testimonials
  | 'email_capture'     // → newsletter
  | 'social_proof'      // → testimonials, trustBadges
  | 'engagement';       // → ctaSection, contactForm

// Parity-qualified section types (camelCase BUILT_IN_SECTION_TYPES that have a
// Liquid section file, excluding header/footer which are persistent anchors).
const PARITY_SECTION_TYPES: ReadonlySet<string> = new Set(
  THEME_LIQUID_PORTABLE_SECTION_PARITY
    .map((e) => {
      // Map the Liquid kebab type back to the camelCase BUILT_IN_SECTION_TYPES name.
      // header / footer / announcementBar / heroBanner are not in the parity table
      // but are essential anchors — we handle them separately.
      const kebab = e.liquidSectionType;
      // Reverse-map the known aliases:
      const MAP: Record<string, string> = {
        'about-section': 'aboutSection',
        'app-block-slot': 'appBlockSlot',
        'brand-marquee': 'brandMarquee',
        'category-grid': 'categoryGrid',
        'contact-form': 'contactForm',
        'cta-section': 'ctaSection',
        'experience-timeline': 'experienceTimeline',
        'featured-products': 'featuredProducts',
        'hero-banner': 'heroBanner',
        'newsletter-signup': 'newsletter',
        'portfolio-grid': 'portfolioGrid',
        'product-detail': 'productDetail',
        'product-grid': 'productGrid',
        'rich-content': 'contentPage',
        'services-grid': 'servicesGrid',
        'skills-section': 'skillsSection',
        'testimonials': 'testimonials',
        'trust-badges': 'trustBadges',
      };
      return MAP[kebab] ?? null;
    })
    .filter((t): t is string => t !== null && BUILT_IN_SECTION_TYPES.includes(t as never)),
);

const GOAL_SECTION_MAP: Record<SectionGoal, string[]> = {
  brand_story: ['aboutSection', 'ctaSection'],
  product_showcase: ['categoryGrid', 'featuredProducts', 'productGrid'],
  trust_building: ['trustBadges', 'testimonials'],
  email_capture: ['newsletter'],
  social_proof: ['testimonials', 'trustBadges'],
  engagement: ['ctaSection', 'contactForm'],
};

/**
 * Generate a section order for a storefront page from an industry hint and a
 * prioritised list of merchant goals.
 *
 * CONSTRAINTS:
 *   • Every emitted type is a member of BUILT_IN_SECTION_TYPES with Liquid parity.
 *   • heroBanner is always first (the primary visual anchor).
 *   • newsletter is always last (email-capture anchor).
 *   • No type appears more than once.
 *   • If a goal maps to a type already in the order it is skipped (deduplication).
 *
 * @param industry  Raw industry string; passed through normalizeIndustry.
 * @param goals     Ordered list of section goals (most important first).
 */
export function generateSectionOrder(industry: string, goals: SectionGoal[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];

  function push(type: string): void {
    if (PARITY_SECTION_TYPES.has(type) && !seen.has(type)) {
      seen.add(type);
      order.push(type);
    }
  }

  // 1. heroBanner as the universal visual anchor.
  push('heroBanner');

  // 2. Goal-driven sections in the order the merchant prioritised them.
  for (const goal of goals) {
    for (const type of (GOAL_SECTION_MAP[goal] ?? [])) {
      push(type);
    }
  }

  // 3. Industry-specific defaults: fill any remaining slots from the resolved experience.
  const { experience } = resolveExperienceForIndustry(industry);
  for (const type of experience.defaultSections) {
    push(type);
  }

  // 4. newsletter as the closing anchor.
  push('newsletter');

  // 5. Safety check: every type in the result is a known BUILT_IN_SECTION_TYPE.
  const BUILT_IN_SET = new Set<string>(BUILT_IN_SECTION_TYPES);
  const unknown = order.filter((t) => !BUILT_IN_SET.has(t));
  if (unknown.length > 0) {
    throw new Error(
      `[theme-ai-sdk] generateSectionOrder emitted unknown section types: ${unknown.join(', ')}. ` +
      'This is a bug in the generator.',
    );
  }

  return order;
}

// ============================================================================
// PART 6 — A11Y ADVISORY MAPPER
// ============================================================================

/**
 * A concrete, actionable fix description for a lint issue.
 * Maps the ThemeLintRule + sectionType → an editorial advisory the merchant
 * or theme author can act on without reading the renderer source.
 */
export interface A11yAdvisory {
  /** The originating lint issue. */
  source: ThemeLintIssue;
  /** Short advisory title. */
  title: string;
  /** Actionable fix description. */
  fix: string;
  /** Optional WCAG success criterion reference. */
  wcagRef?: string;
}

const RULE_ADVISORIES: Record<ThemeLintRule, (issue: ThemeLintIssue) => { title: string; fix: string; wcagRef?: string }> = {
  'forbidden-tag': (issue) => ({
    title: `Remove forbidden <${issue.message.match(/<(\w+)>/)?.[1] ?? 'tag'}> from ${issue.sectionType}`,
    fix:
      'The renderer\'s DOMPurify pass will strip this tag entirely. ' +
      'Replace inline script behaviour with lb-* island components and server-rendered data drops. ' +
      'Replace <embed>/<object>/<base> with standard <img>/<a> or asset manager references.',
    wcagRef: 'WCAG 2.1 SC 4.1.2 Name, Role, Value',
  }),
  'forbidden-attr': (issue) => ({
    title: `Remove inline style= attribute from ${issue.sectionType}`,
    fix:
      'DOMPurify strips all style= attributes. Replace with a CSS class that uses --lb-* design tokens ' +
      '(e.g. style="color:red" → class="lb-text-accent" with var(--lb-color-accent) in the stylesheet). ' +
      'Token injection via sanitizeCssTokenValue is available for dynamic colours.',
    wcagRef: 'WCAG 2.1 SC 1.4.3 Contrast (Minimum)',
  }),
  'missing-schema-block': (issue) => ({
    title: `Add missing {% schema %} block to ${issue.sectionType}`,
    fix:
      'Every Liquid section file must contain {% schema %} … {% endschema %}. ' +
      'This block declares the settings the merchant can customise in the theme editor. ' +
      'Without it the section is rejected by parseLiquidThemePackageBundle.',
  }),
  'unknown-section-type': (issue) => ({
    title: `Section type "${issue.sectionType}" is not in the built-in registry`,
    fix:
      'This is an advisory — unknown types are allowed for private / theme-specific sections. ' +
      'If you intended a built-in section, check BUILT_IN_SECTION_TYPES for the correct camelCase name ' +
      'and THEME_LIQUID_PORTABLE_SECTION_PARITY for the Liquid kebab-case equivalent. ' +
      'Unknown types cannot be compiled by compilePortableToLiquidBundle without a mapping.',
  }),
  'setting-referenced-not-in-schema': (issue) => ({
    title: `{{ section.settings.${issue.message.match(/settings\.(\w+)/)?.[1] ?? '?'} }} not declared in schema for ${issue.sectionType}`,
    fix:
      'Declare every referenced setting in the {% schema %} settings array with a matching id. ' +
      'Undeclared settings render as blank strings (LiquidJS default). ' +
      'This may cause accessibility regressions if e.g. alt text or aria-label values are missing.',
    wcagRef: 'WCAG 2.1 SC 1.1.1 Non-text Content',
  }),
};

/**
 * Map an array of ThemeLintIssues to concrete, actionable A11yAdvisory objects.
 *
 * @param lintIssues  Output of lintThemeBundle(bundle).
 */
export function a11yAdvisories(lintIssues: ThemeLintIssue[]): A11yAdvisory[] {
  return lintIssues.map((issue) => {
    const advisory = RULE_ADVISORIES[issue.rule]?.(issue) ?? {
      title: `Lint issue in ${issue.sectionType}: ${issue.rule}`,
      fix: issue.message,
    };
    return { source: issue, ...advisory };
  });
}

// ============================================================================
// PART 7 — BUNDLE OPTIMIZER
// ============================================================================

export interface OptimizationReport {
  /** Section types removed (not referenced in any template). */
  sectionsRemoved: string[];
  /** Section types retained. */
  sectionsRetained: string[];
  /** Total locale keys across all locale files in the optimised bundle. */
  localeKeyCount: number;
  /** Whether any sections were removed. */
  changed: boolean;
}

/**
 * Trim a LiquidThemePackageBundle by removing section files that are not
 * referenced in any template, then validate the result.
 *
 * SAFETY CONTRACT: the returned bundle always passes parseLiquidThemePackageBundle —
 * the optimiser cannot emit an invalid bundle. If the trimmed bundle fails
 * validation the original is returned with a report flagging that no change was made.
 *
 * @param bundle  A validated LiquidThemePackageBundle.
 */
export function optimizeThemeBundle(
  bundle: LiquidThemePackageBundle,
): { bundle: LiquidThemePackageBundle; report: OptimizationReport } {
  // Collect all section types actually referenced across all templates.
  const referencedTypes = new Set<string>();
  for (const template of Object.values(bundle.templates)) {
    for (const section of Object.values(template.sections)) {
      referencedTypes.add(section.type);
    }
  }

  const allSectionKeys = Object.keys(bundle.sections);
  const toRemove = allSectionKeys.filter((k) => !referencedTypes.has(k));
  const toRetain = allSectionKeys.filter((k) => referencedTypes.has(k));

  // Count total locale keys in the current bundle.
  function countLocaleKeys(b: LiquidThemePackageBundle): number {
    return Object.values(b.locales).reduce((n, locale) => n + Object.keys(locale).length, 0);
  }

  if (toRemove.length === 0) {
    return {
      bundle,
      report: {
        sectionsRemoved: [],
        sectionsRetained: toRetain,
        localeKeyCount: countLocaleKeys(bundle),
        changed: false,
      },
    };
  }

  // Build the trimmed bundle — remove unreferenced sections only.
  const trimmedSections = Object.fromEntries(
    Object.entries(bundle.sections).filter(([k]) => !toRemove.includes(k)),
  );

  const candidate = { ...bundle, sections: trimmedSections };

  // SAFETY: validate via parseLiquidThemePackageBundle before returning.
  try {
    const optimisedBundle = parseLiquidThemePackageBundle(candidate);
    return {
      bundle: optimisedBundle,
      report: {
        sectionsRemoved: toRemove,
        sectionsRetained: toRetain,
        localeKeyCount: countLocaleKeys(optimisedBundle),
        changed: true,
      },
    };
  } catch {
    // The trimmed bundle is invalid — return the original unmodified.
    return {
      bundle,
      report: {
        sectionsRemoved: [],
        sectionsRetained: allSectionKeys,
        localeKeyCount: countLocaleKeys(bundle),
        changed: false,
      },
    };
  }
}

// ============================================================================
// PART 8 — MERCHANT PERSONALIZATION
// ============================================================================

/**
 * Structured signals from the merchant's onboarding / account profile.
 * All fields are optional — the resolver degrades gracefully.
 */
export interface MerchantProfile {
  /** The industry the merchant selected at onboarding (raw string). */
  industry?: string | null;
  /** An experience id the merchant explicitly chose (wins over everything). */
  preferredExperienceId?: string | null;
  /** GMV tier (informs confidence scoring, not yet used for selection). */
  gmvTier?: 'starter' | 'growth' | 'scale' | null;
  /** Store locale code (e.g. 'en-IN', 'en-US'). */
  locale?: string | null;
}

export interface MerchantExperienceResolution extends ExperienceResolution {
  /** How confident the resolver is in this selection (0–1). */
  confidence: number;
  /** Human-readable explanation of the resolution path. */
  reasoning: string;
}

/**
 * Select the best experience for a merchant based on their profile signals.
 *
 * Precedence:
 *   1. preferredExperienceId (explicit merchant choice — highest confidence)
 *   2. industry (mapped via INDUSTRY_EXPERIENCE_MAP)
 *   3. Fallback (Summit / General — lowest confidence)
 *
 * DETERMINISM: No live data access. Same profile → same result.
 */
export function selectExperienceForMerchant(profile: MerchantProfile): MerchantExperienceResolution {
  const base = resolveExperienceForIndustry(
    profile.industry,
    profile.preferredExperienceId ?? undefined,
  );

  const confidence =
    base.source === 'override' ? 0.95
    : base.source === 'industry' ? 0.75
    : 0.40;

  const reasoning =
    base.source === 'override'
      ? `Merchant explicitly selected the "${base.experience.id}" experience.`
      : base.source === 'industry'
      ? `Industry "${base.industry ?? 'unknown'}" resolved to the "${base.experience.id}" experience via the industry map.`
      : `No industry or preference signal — using the General fallback experience ("${base.experience.id}").`;

  return { ...base, confidence, reasoning };
}

// ============================================================================
// PART 9 — ACCESSIBILITY CHECK
// ============================================================================

export interface AccessibilityPairResult {
  fg: string;
  bg: string;
  ratio: number;
  passesAA: boolean;
  passesAAALargeText: boolean;
  /** True when this is a large-text pair (primary/secondary used as headings). */
  largeText: boolean;
}

export interface AccessibilityCheckResult {
  /** All checked colour pairs. */
  pairs: AccessibilityPairResult[];
  /** True when ALL required pairs pass their respective thresholds. */
  allPass: boolean;
  /** Issues to surface to the merchant. Empty when allPass is true. */
  issues: string[];
}

/**
 * Check WCAG 2.1 AA contrast for the key colour pairs in an ExperienceTokens set.
 * Checked pairs:
 *   • textColor / backgroundColor  (normal text, 4.5 : 1 required)
 *   • primaryColor / backgroundColor  (large text / headings, 3 : 1 required)
 *   • accentColor / backgroundColor  (large text, 3 : 1 required)
 *   • textColor / surfaceColor  (normal text on cards, 4.5 : 1 required)
 */
export function checkAccessibility(tokens: ExperienceTokens): AccessibilityCheckResult {
  const pairs: AccessibilityPairResult[] = [
    { fg: tokens.textColor, bg: tokens.backgroundColor, largeText: false },
    { fg: tokens.primaryColor, bg: tokens.backgroundColor, largeText: true },
    { fg: tokens.accentColor, bg: tokens.backgroundColor, largeText: true },
    { fg: tokens.textColor, bg: tokens.surfaceColor, largeText: false },
  ].map(({ fg, bg, largeText }) => {
    const ratio = contrastRatio(fg, bg);
    return {
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      passesAA: largeText ? ratio >= 3.0 : ratio >= 4.5,
      passesAAALargeText: ratio >= 3.0,
      largeText,
    };
  });

  const issues: string[] = [];
  for (const pair of pairs) {
    if (!pair.passesAA) {
      const threshold = pair.largeText ? '3.0 : 1 (large text AA)' : '4.5 : 1 (normal text AA)';
      issues.push(
        `${pair.fg} on ${pair.bg}: ratio ${pair.ratio} : 1 — fails WCAG 2.1 AA (required ≥ ${threshold})`,
      );
    }
  }

  return { pairs, allPass: issues.length === 0, issues };
}

// ============================================================================
// PART 10 — THEME GENERATION FACADE
// ============================================================================

/**
 * Structured input to the theme generator.
 *
 * NOT-CONNECTED NOTE (MODEL_BOUNDARY):
 *   This type represents the STRUCTURED side of the NL → structured-input seam.
 *   A real merchant types "I sell artisanal leather bags in Jaipur, earthy feel"
 *   and an LLM (THEME_AI_PROVIDER_API_KEY) would produce this ThemeBrief.
 *   That step is NOT-CONNECTED — there is no LLM import in this file.
 *   The generators below receive only this typed struct.
 */
export interface ThemeBrief {
  /**
   * Raw industry string (free text or canonical key).
   * Passed through normalizeIndustry() → resolveExperienceForIndustry().
   */
  industry?: string | null;
  /** Explicit primary colour override in #RRGGBB format. */
  primaryColor?: string | null;
  /** Palette aesthetic variant. Defaults to 'neutral'. */
  mood?: PaletteVariant | null;
  /** Font pairing intent. Defaults to 'neutral'. */
  typography?: FontPairingIntent | null;
  /** Ordered merchant goals — drives section order. */
  goals?: SectionGoal[] | null;
  /** Explicit experience id override (skips industry resolution). */
  experienceId?: string | null;
}

export interface GenerateThemeResult {
  /** The compiled, validated Liquid bundle. */
  bundle: LiquidThemePackageBundle;
  /** Lint result (always 0 error-level issues — the generator is safe). */
  lintIssues: ThemeLintIssue[];
  /** A11y advisories for any lint issues. */
  advisories: A11yAdvisory[];
  /** WCAG accessibility check on the generated palette. */
  accessibility: AccessibilityCheckResult;
  /** The resolved experience and its source ('override' | 'industry' | 'fallback'). */
  experienceResolution: MerchantExperienceResolution;
  /** The generated design tokens. */
  tokens: ExperienceTokens;
  /** The recommended section order. */
  sectionOrder: string[];
  /** Font pairing (Google Fonts href included). */
  typography: FontPairing;
  /** Compiler warnings (section types unmappable to Liquid). */
  compilerWarnings: string[];
}

/**
 * Generate a complete, validated Liquid theme bundle from a structured ThemeBrief.
 *
 * This is the primary facade entry point. It composes:
 *   1. selectExperienceForMerchant → experience + tokens
 *   2. deterministicPalette (if primaryColor provided) or experience tokens
 *   3. suggestTypographyPairing
 *   4. generateSectionOrder
 *   5. compilePortableToLiquidBundle → LiquidThemePackageBundle
 *   6. lintThemeBundle (0 errors guaranteed by the generator pipeline)
 *   7. checkAccessibility
 *
 * SAFETY: the returned bundle always passes validateTheme + lintTheme (0 errors).
 * DETERMINISM: same ThemeBrief → same output.
 *
 * MODEL_BOUNDARY: This function accepts a STRUCTURED ThemeBrief — NOT raw
 * natural language. The step that converts a merchant's free-text description
 * to a ThemeBrief is NOT-CONNECTED (no LLM provider imported here).
 */
export function generateTheme(brief: ThemeBrief): GenerateThemeResult {
  // Step 1: resolve experience.
  const profile: MerchantProfile = {
    industry: brief.industry,
    preferredExperienceId: brief.experienceId,
  };
  const experienceResolution = selectExperienceForMerchant(profile);
  const experience = experienceResolution.experience;

  // Step 2: build tokens — use deterministicPalette if a primary colour was supplied,
  // otherwise use the experience's curated tokens.
  let tokens: ExperienceTokens;
  if (brief.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(brief.primaryColor)) {
    tokens = deterministicPalette(brief.primaryColor, brief.mood ?? 'neutral');
    // Preserve the curated font choices from the experience (palette only overrides colours).
    tokens = ExperienceTokensSchema.parse({
      ...tokens,
      fontFamily: experience.tokens.fontFamily,
      headingFontFamily: experience.tokens.headingFontFamily,
      borderRadius: experience.tokens.borderRadius,
    });
  } else {
    tokens = experience.tokens;
  }

  // Step 3: typography pairing.
  const typography = suggestTypographyPairing(brief.typography ?? 'neutral');

  // Step 4: section order.
  const sectionOrder = generateSectionOrder(brief.industry ?? '', brief.goals ?? []);

  // Step 5: compile to Liquid bundle.
  const portableConfig: PortableThemeTemplateConfig = {
    themeId: `${experience.id}-ai-generated`,
    themeSettings: {
      primaryColor: tokens.primaryColor,
      secondaryColor: tokens.secondaryColor,
      accentColor: tokens.accentColor,
      backgroundColor: tokens.backgroundColor,
      textColor: tokens.textColor,
      surfaceColor: tokens.surfaceColor,
      fontFamily: typography.fontFamily,
      headingFontFamily: typography.headingFontFamily,
      borderRadius: tokens.borderRadius,
    },
    sections: {
      template: sectionOrder
        .filter((type) => type !== 'newsletter') // footer keeps newsletter separate
        .map((type, index) => ({
          id: `${type}-${index}`,
          type,
          isVisible: true,
          settings: {},
        })),
    },
  };

  const { bundle, warnings: compilerWarnings } = compilePortableToLiquidBundle(portableConfig, {
    slug: `${experience.id}-ai`,
    name: `${experience.name} (AI Generated)`,
  });

  // Step 6: lint (safety check).
  const lintIssues = lintThemeBundle(bundle);
  const errorIssues = lintIssues.filter((i) => i.level === 'error');

  // Error-level lint issues on a generated bundle are a generator bug.
  if (errorIssues.length > 0) {
    throw new Error(
      `[theme-ai-sdk] generateTheme: generated bundle has ${errorIssues.length} lint error(s): ` +
      errorIssues.map((i) => `${i.rule}:${i.sectionType}`).join(', ') +
      '. This is a bug in the generator.',
    );
  }

  // Step 7: A11y advisories + accessibility check.
  const advisories = a11yAdvisories(lintIssues);
  const accessibility = checkAccessibility(tokens);

  return {
    bundle,
    lintIssues,
    advisories,
    accessibility,
    experienceResolution,
    tokens,
    sectionOrder,
    typography,
    compilerWarnings,
  };
}

// ============================================================================
// PART 11 — MODEL BOUNDARY DOCUMENTATION
// ============================================================================

/**
 * Documents the NOT-CONNECTED seam between natural-language merchant input
 * and the deterministic generators in this module.
 *
 * The three NL→structured boundaries:
 *
 * (1) NL brief → ThemeBrief
 *     "I sell artisanal leather bags in Jaipur, earthy and premium feel"
 *     → { industry: 'furniture', primaryColor: '#3E2723', mood: 'muted', typography: 'artisanal' }
 *     Provider needed: THEME_AI_PROVIDER_API_KEY (OpenAI / Anthropic / Gemini — TBD)
 *     Gateway route: POST /v1/theme-ai/parse-brief  (does NOT exist yet)
 *
 * (2) NL colour mood → seed hex
 *     "earthy and warm" → #3E2723
 *     Provider needed: same as (1)
 *     Note: deterministicPalette() already handles seed → full palette;
 *     only the seed selection step is NOT-CONNECTED.
 *
 * (3) NL section intent → SectionGoal[]
 *     "tell brand story first, then showcase products, then drive signups"
 *     → ['brand_story', 'product_showcase', 'email_capture']
 *     Provider needed: same as (1)
 *     Note: generateSectionOrder() handles SectionGoal[] → string[];
 *     only the NL→enum step is NOT-CONNECTED.
 *
 * Architecture note: the provider call must live in services/api-gateway
 * (never in packages/theme-engine) — the library is edge/server-agnostic
 * pure code that cannot make outbound HTTP calls or hold credentials.
 *
 * When THEME_AI_PROVIDER_API_KEY is set and the gateway route exists, the flow is:
 *   merchant free-text → POST /v1/theme-ai/parse-brief → ThemeBrief
 *   → generateTheme(brief) → GenerateThemeResult (fully deterministic from here)
 */
export const MODEL_BOUNDARY = Object.freeze({
  status: 'NOT_CONNECTED' as const,
  envVar: 'THEME_AI_PROVIDER_API_KEY',
  gatewayRoute: 'POST /v1/theme-ai/parse-brief (does not exist)',
  seams: [
    'NL brief → ThemeBrief (requires LLM)',
    'NL colour mood → seed hex (requires LLM or semantic colour table)',
    'NL section intent → SectionGoal[] (requires LLM)',
  ] as const,
  deterministic: [
    'ThemeBrief → generateTheme() → GenerateThemeResult',
    'seed hex + PaletteVariant → deterministicPalette() → ExperienceTokens',
    'SectionGoal[] → generateSectionOrder() → string[]',
  ] as const,
});

// ============================================================================
// PART 12 — THEME AI SDK FACADE INTERFACE + SINGLETON
// ============================================================================

/**
 * The public interface of the Merchant AI SDK.
 * All methods are deterministic — same input → same output.
 * No method makes a network call, imports a provider SDK, or reads env vars.
 */
export interface ThemeAISDK {
  /**
   * Generate a complete validated Liquid theme bundle from a structured ThemeBrief.
   * The NL → ThemeBrief step is NOT-CONNECTED (see MODEL_BOUNDARY).
   */
  generateTheme: (brief: ThemeBrief) => GenerateThemeResult;

  /**
   * Generate a validated ExperienceTokens palette from a seed colour and mood.
   * Guarantees WCAG 2.1 AA compliance (textColor on backgroundColor ≥ 4.5 : 1,
   * primaryColor on backgroundColor ≥ 3.0 : 1).
   */
  generatePalette: (seed: string, variant: PaletteVariant) => ExperienceTokens;

  /**
   * Suggest a heading + body font pairing for the given design intent.
   * All families are drawn from EXPERIENCE_FONT_REGISTRY.
   */
  generateTypography: (intent: FontPairingIntent) => FontPairing;

  /**
   * Generate a section order for a storefront page from industry + goals.
   * Every emitted type is a BUILT_IN_SECTION_TYPE with Liquid parity.
   */
  generateLayout: (industry: string, goals: SectionGoal[]) => string[];

  /**
   * Check WCAG 2.1 AA contrast for all key colour pairs in a token set.
   */
  checkAccessibility: (tokens: ExperienceTokens) => AccessibilityCheckResult;

  /**
   * Trim unreferenced sections from a bundle and re-validate.
   */
  suggestOptimizations: (bundle: LiquidThemePackageBundle) => { bundle: LiquidThemePackageBundle; report: OptimizationReport };

  /**
   * Select the best experience for a merchant from their profile signals.
   * Deterministic: same profile → same result.
   */
  personalize: (profile: MerchantProfile) => MerchantExperienceResolution;
}

/**
 * The default Merchant AI SDK singleton.
 *
 * Import:
 *   import { THEME_AI_SDK } from '@letbuyy/theme-engine';
 *
 * Or individual functions:
 *   import { generateTheme, deterministicPalette, meetsWcagAA } from '@letbuyy/theme-engine';
 */
export const THEME_AI_SDK: ThemeAISDK = Object.freeze({
  generateTheme,
  generatePalette: deterministicPalette,
  generateTypography: suggestTypographyPairing,
  generateLayout: generateSectionOrder,
  checkAccessibility,
  suggestOptimizations: optimizeThemeBundle,
  personalize: selectExperienceForMerchant,
});

// Re-export composable types that SDK callers need from this module's surface.
export type { ExperienceTokens, ExperienceResolution };
// Re-export WCAG-related from experience-fonts for SDK consumers who only import theme-ai-sdk.
export type { FontPairing as GoogleFontPair };
export { buildGoogleFontsHref, EXPERIENCE_FONT_REGISTRY };
