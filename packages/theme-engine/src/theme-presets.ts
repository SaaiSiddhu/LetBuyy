// ============================================================================
// THEME PRESET ENGINE + EXPERIENCE REGISTRY  (Phase-2 Streams B + C)
// ----------------------------------------------------------------------------
// LetBuyy ships ONE first-party Core theme. Merchants never see "themes" — they
// see "Experiences": named, industry-tuned presets that overlay the Core theme's
// design tokens and section layout. An Experience is a validated preset document.
//
// This module is the preset engine (schema · registry · loader · resolver ·
// validation · metadata · preview · export · import) and the 10 Experience
// definitions. It is a NEW module — it does NOT touch the frozen
// theme-registry.ts, the Urban Kicks bundle fixture, or any governance pin.
// It composes on top of the existing settings_data.current → :root token flow.
//
// Honesty notes (carried from docs/theme-research + docs/theme-discovery):
//  - 4 experiences (Forge, Sense, Craft, Refresh) and Summit are GROUNDED in the
//    research palettes; the other 5 are DESIGNED on-brand variations. Each carries
//    a `metadata.grounding` flag.
//  - Non-system fonts (Playfair Display, Cormorant Garamond, …) only render once a
//    font-loading mechanism is wired into the Liquid head assets (deferred — see
//    docs/v1-execution/phase-2/03-experience-registry-report.md). Until then those
//    experiences render with system-font fallback; colors/layout apply fully.
// ============================================================================

import { z } from 'zod';
import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const HexColorSchema = z.string().regex(HEX, 'Expected a 6-digit hex color');
const EXPERIENCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Schemas ─────────────────────────────────────────────────────────────────

/** Flat design-token overlay. A subset of ThemeSettings (index.ts) — the keys that
 *  map directly into settings_data.current and the :root CSS variable layer. */
export const ExperienceTokensSchema = z
  .object({
    primaryColor: HexColorSchema,
    secondaryColor: HexColorSchema,
    accentColor: HexColorSchema,
    backgroundColor: HexColorSchema,
    textColor: HexColorSchema,
    surfaceColor: HexColorSchema,
    fontFamily: z.string().min(1).max(80), // body font family
    headingFontFamily: z.string().min(1).max(80),
    borderRadius: z.number().int().min(0).max(48),
  })
  .strict();

export const ExperienceColorSystemSchema = z
  .object({
    primary: HexColorSchema,
    secondary: HexColorSchema,
    accent: HexColorSchema,
    background: HexColorSchema,
    text: HexColorSchema,
    surface: HexColorSchema,
  })
  .strict();

export const ExperienceTypographySchema = z
  .object({
    headingFont: z.string().min(1).max(80),
    bodyFont: z.string().min(1).max(80),
  })
  .strict();

export const ExperienceLayoutSchema = z
  .object({
    borderRadius: z.number().int().min(0).max(48),
    sectionOrder: z.array(z.string().min(1)).min(1),
  })
  .strict();

/** A renderable preview DESCRIPTOR — not a binary asset. Color swatches + section
 *  count let the editor/onboarding render a live mini-preview without a screenshot. */
export const ExperiencePreviewSchema = z
  .object({
    label: z.string().min(1).max(80),
    summary: z.string().min(1).max(400),
    swatches: z.array(HexColorSchema).min(2).max(6),
    headingFont: z.string().min(1).max(80),
    sectionCount: z.number().int().min(1),
  })
  .strict();

export const ExperienceMetadataSchema = z
  .object({
    grounding: z.enum(['research', 'designed']),
    notes: z.string().max(600).default(''),
  })
  .strict();

export const ThemeExperienceSchema = z
  .object({
    id: z.string().min(1).max(60).regex(EXPERIENCE_ID, 'Experience id must be kebab-case'),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(400),
    industry: z.string().min(1).max(60).nullable(),
    tokens: ExperienceTokensSchema,
    colorSystem: ExperienceColorSystemSchema,
    typography: ExperienceTypographySchema,
    layout: ExperienceLayoutSchema,
    defaultSections: z.array(z.string().min(1)).min(1),
    preview: ExperiencePreviewSchema,
    metadata: ExperienceMetadataSchema,
  })
  .strict();

export type ExperienceTokens = z.infer<typeof ExperienceTokensSchema>;
export type ThemeExperience = z.infer<typeof ThemeExperienceSchema>;

// ── defineExperience factory (single source of truth = tokens + sections) ─────

interface RawExperience {
  id: string;
  name: string;
  description: string;
  industry: string | null;
  tokens: ExperienceTokens;
  defaultSections: string[];
  grounding: 'research' | 'designed';
  notes?: string;
}

function defineExperience(raw: RawExperience): ThemeExperience {
  const t = raw.tokens;
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    industry: raw.industry,
    tokens: t,
    colorSystem: {
      primary: t.primaryColor,
      secondary: t.secondaryColor,
      accent: t.accentColor,
      background: t.backgroundColor,
      text: t.textColor,
      surface: t.surfaceColor,
    },
    typography: { headingFont: t.headingFontFamily, bodyFont: t.fontFamily },
    layout: { borderRadius: t.borderRadius, sectionOrder: raw.defaultSections },
    defaultSections: raw.defaultSections,
    preview: {
      label: raw.name,
      summary: raw.description,
      swatches: [t.primaryColor, t.accentColor, t.surfaceColor],
      headingFont: t.headingFontFamily,
      sectionCount: raw.defaultSections.length,
    },
    metadata: { grounding: raw.grounding, notes: raw.notes ?? '' },
  };
}

// ── The 10 Experiences (Stream C) ─────────────────────────────────────────────

const COMMERCE_BASE_SECTIONS = [
  'announcementBar',
  'heroBanner',
  'categoryGrid',
  'featuredProducts',
  'productGrid',
  'newsletter',
] as const;

const FORGE = defineExperience({
  id: 'forge',
  name: 'Forge',
  description:
    'A precise, technical look for electronics, gadgets, and tech accessories. Deep navy authority with electric-cyan accents — built for spec-heavy products.',
  industry: 'electronics',
  grounding: 'research',
  tokens: {
    primaryColor: '#1E3A5F',
    secondaryColor: '#1E40AF',
    accentColor: '#00B4D8',
    backgroundColor: '#FFFFFF',
    textColor: '#1A202C',
    surfaceColor: '#F0F4F8',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 8,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'trustBadges', 'featuredProducts', 'productGrid', 'newsletter'],
});

const SENSE = defineExperience({
  id: 'sense',
  name: 'Sense',
  description:
    'Editorial fashion with bold typography and lookbook imagery. Near-black and crimson for a modern, aspirational apparel brand.',
  industry: 'fashion',
  grounding: 'research',
  notes: 'Heading font Playfair Display renders system-fallback until font loading is wired.',
  tokens: {
    primaryColor: '#1A1A2E',
    secondaryColor: '#2D2D44',
    accentColor: '#E63946',
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A2E',
    surfaceColor: '#FAFAFA',
    fontFamily: 'Inter',
    headingFontFamily: 'Playfair Display',
    borderRadius: 4,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'testimonials', 'newsletter'],
});

const AURA = defineExperience({
  id: 'aura',
  name: 'Aura',
  description:
    'Soft and luxurious for beauty, skincare, and cosmetics. Muted rose with a champagne accent — the aesthetic of a premium beauty brand.',
  industry: 'beauty',
  grounding: 'designed',
  notes: 'DESIGNED — no beauty vertical in research; derived from the jewelry palette. Fonts render system-fallback until font loading lands.',
  tokens: {
    primaryColor: '#C2798B',
    secondaryColor: '#9E5A6F',
    accentColor: '#D4AF7A',
    backgroundColor: '#FFFFFF',
    textColor: '#2D1B22',
    surfaceColor: '#FFF8F9',
    fontFamily: 'Lato',
    headingFontFamily: 'Cormorant Garamond',
    borderRadius: 16,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'trustBadges', 'testimonials', 'newsletter'],
});

const CRAFT = defineExperience({
  id: 'craft',
  name: 'Craft',
  description:
    'Warm, artisanal aesthetics for furniture, home decor, and handcrafted goods. Rich walnut earth tones that convey quality and longevity.',
  industry: 'furniture',
  grounding: 'research',
  notes: 'Heading font Libre Baskerville renders system-fallback until font loading is wired.',
  tokens: {
    primaryColor: '#3E2723',
    secondaryColor: '#5D3B2E',
    accentColor: '#8D6E63',
    backgroundColor: '#FFFFFF',
    textColor: '#2C1B12',
    surfaceColor: '#FFF8F0',
    fontFamily: 'Source Sans Pro',
    headingFontFamily: 'Libre Baskerville',
    borderRadius: 6,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'trustBadges', 'featuredProducts', 'aboutSection', 'testimonials', 'faqAccordion', 'newsletter'],
});

const REFRESH = defineExperience({
  id: 'refresh',
  name: 'Refresh',
  description:
    'Fresh and inviting for grocery, organic food, and daily essentials. Deep forest green with warm orange — the look of a trusted neighbourhood store.',
  industry: 'food',
  grounding: 'research',
  notes: 'Resolves the industry-map "Food → Harvest" error: Harvest is not a defined experience; Food maps to Refresh (grounded in the research grocery preset).',
  tokens: {
    primaryColor: '#2D6A4F',
    secondaryColor: '#1B4332',
    accentColor: '#F4A261',
    backgroundColor: '#FFFFFF',
    textColor: '#1B2521',
    surfaceColor: '#F8FFF4',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 10,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'trustBadges', 'categoryGrid', 'featuredProducts', 'productGrid', 'newsletter'],
});

const RIDE = defineExperience({
  id: 'ride',
  name: 'Ride',
  description:
    'High-energy design for sports equipment, fitness gear, and outdoor brands. Performance orange and carbon black — built for movement.',
  industry: 'sports',
  grounding: 'designed',
  notes: 'DESIGNED — no sports vertical in research; designed from the streetwear/sneaker domain.',
  tokens: {
    primaryColor: '#FF4D00',
    secondaryColor: '#1C1C1C',
    accentColor: '#FFD100',
    backgroundColor: '#FFFFFF',
    textColor: '#111111',
    surfaceColor: '#F5F5F5',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 6,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'trustBadges', 'newsletter'],
});

const DAWN = defineExperience({
  id: 'dawn',
  name: 'Dawn',
  description:
    'Calm and scholarly for bookshops, stationery, and educational content. Warm parchment tones with a slate-blue accent — for the thoughtful reader.',
  industry: 'books',
  grounding: 'designed',
  notes: 'DESIGNED — no books vertical in research. Fonts render system-fallback until font loading lands.',
  tokens: {
    primaryColor: '#3B4F6B',
    secondaryColor: '#2C3E50',
    accentColor: '#C0832B',
    backgroundColor: '#FFFFFF',
    textColor: '#2C2C2C',
    surfaceColor: '#FDF6EC',
    fontFamily: 'Source Sans Pro',
    headingFontFamily: 'Libre Baskerville',
    borderRadius: 4,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'aboutSection', 'newsletter'],
});

const BLOOM = defineExperience({
  id: 'bloom',
  name: 'Bloom',
  description:
    'Warm and playful for pet food, accessories, and veterinary products. Sunny tangerine and leaf green — the colours of a happy pet store.',
  industry: 'pet',
  grounding: 'designed',
  notes: 'DESIGNED — no pet vertical in research; designed from first principles.',
  tokens: {
    primaryColor: '#E07B39',
    secondaryColor: '#B55E24',
    accentColor: '#4CAF73',
    backgroundColor: '#FFFFFF',
    textColor: '#2C1A0A',
    surfaceColor: '#FFF9F0',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 14,
  },
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'trustBadges', 'productGrid', 'newsletter'],
});

const NOVA = defineExperience({
  id: 'nova',
  name: 'Nova',
  description:
    'Bold and contemporary for direct-to-consumer brands and general merchandise. Deep violet and amber — brand-forward for any product category.',
  industry: null,
  grounding: 'designed',
  notes: 'DESIGNED — the brand-forward D2C experience; matches the Core theme baseline tokens. No fixed industry (selectable as an override).',
  tokens: {
    primaryColor: '#8B5CF6',
    secondaryColor: '#6D28D9',
    accentColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A2E',
    surfaceColor: '#F8FAFC',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 10,
  },
  // Commerce base + the brand-forward ctaSection that makes Nova structurally distinct from
  // Summit. This list is what `preview.sectionCount` reports to the merchant, so it MUST mirror
  // EXPERIENCE_COMPOSITIONS.nova.index — collectExperienceCompositionIssues() enforces that.
  defaultSections: ['announcementBar', 'heroBanner', 'categoryGrid', 'featuredProducts', 'productGrid', 'ctaSection', 'newsletter'],
});

const SUMMIT = defineExperience({
  id: 'summit',
  name: 'Summit',
  description:
    'Clean and professional for multi-category stores and general retail. Teal and lime — a versatile, safe baseline for any type of online store.',
  industry: 'general',
  grounding: 'research',
  notes: 'Tokens intentionally match DEFAULT_THEME_SETTINGS (index.ts) so the General fallback produces zero visual regression vs the platform default.',
  tokens: {
    primaryColor: '#00B3B3',
    secondaryColor: '#008080',
    accentColor: '#A4E500',
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A2E',
    surfaceColor: '#F9FAFB',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 12,
  },
  defaultSections: [...COMMERCE_BASE_SECTIONS],
});

// ── Registry (Stream B: loader) ───────────────────────────────────────────────

export const EXPERIENCE_REGISTRY: Readonly<Record<string, ThemeExperience>> = Object.freeze({
  forge: FORGE,
  sense: SENSE,
  aura: AURA,
  craft: CRAFT,
  refresh: REFRESH,
  ride: RIDE,
  dawn: DAWN,
  bloom: BLOOM,
  nova: NOVA,
  summit: SUMMIT,
});

export const EXPERIENCE_IDS = Object.keys(EXPERIENCE_REGISTRY) as ReadonlyArray<string>;

/** The General/fallback experience id — used when no industry resolves. */
export const FALLBACK_EXPERIENCE_ID = 'summit';

// ── Engine (Stream B: resolver · validation · metadata · export · import) ─────

/** Own-property lookup: an inherited key ('constructor', 'toString', …) must resolve to
 *  undefined, so callers that pass merchant-supplied ids get the documented
 *  "unknown experience" path instead of a truthy non-experience object. */
export function getExperience(id: string): ThemeExperience | undefined {
  if (!Object.prototype.hasOwnProperty.call(EXPERIENCE_REGISTRY, id)) return undefined;
  return EXPERIENCE_REGISTRY[id];
}

export function listExperiences(): ThemeExperience[] {
  return Object.values(EXPERIENCE_REGISTRY);
}

export function isThemeExperienceId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPERIENCE_REGISTRY, id);
}

/** Parse + validate an arbitrary value into a ThemeExperience (throws on invalid). */
export function validateExperience(input: unknown): ThemeExperience {
  return ThemeExperienceSchema.parse(input);
}

export function safeValidateExperience(input: unknown): ReturnType<typeof ThemeExperienceSchema.safeParse> {
  return ThemeExperienceSchema.safeParse(input);
}

/** The flat overlay written into settings_data.current AND themeSettings. Emits BOTH
 *  `fontFamily` (React JSON-contract path) and `bodyFontFamily` (Liquid token map) so
 *  every render path picks up the experience font. */
export function buildExperienceSettingsOverlay(experience: ThemeExperience): Record<string, unknown> {
  const t = experience.tokens;
  return {
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    accentColor: t.accentColor,
    backgroundColor: t.backgroundColor,
    textColor: t.textColor,
    surfaceColor: t.surfaceColor,
    fontFamily: t.fontFamily,
    bodyFontFamily: t.fontFamily,
    headingFontFamily: t.headingFontFamily,
    borderRadius: t.borderRadius,
  };
}

// Phase G / G6 — the exact shape `buildExperienceSettingsOverlay` may write into a merchant's
// settings_data.current. Validating the OUTPUT (not just the experience input) guarantees the apply path
// can never inject a malformed value into a store, even if a future caller hands us an experience that
// bypassed `validateExperience` (e.g. a hostile `importExperience` payload). Colors must be hex, fonts
// non-empty strings, borderRadius a bounded int — mirrors ExperienceTokensSchema.
export const ExperienceSettingsOverlaySchema = z
  .object({
    primaryColor: HexColorSchema,
    secondaryColor: HexColorSchema,
    accentColor: HexColorSchema,
    backgroundColor: HexColorSchema,
    textColor: HexColorSchema,
    surfaceColor: HexColorSchema,
    fontFamily: z.string().min(1).max(80),
    bodyFontFamily: z.string().min(1).max(80),
    headingFontFamily: z.string().min(1).max(80),
    borderRadius: z.number().int().min(0).max(48),
  })
  .strict();

/** Validate an experience overlay against the canonical settings-field types. Returns the parsed overlay
 *  or a list of issues — never throws. The apply functions use this to fall back safely in production. */
export function validateExperienceOverlay(
  overlay: Record<string, unknown>,
): { ok: true; overlay: Record<string, unknown> } | { ok: false; issues: string[] } {
  const parsed = ExperienceSettingsOverlaySchema.safeParse(overlay);
  if (parsed.success) return { ok: true, overlay: parsed.data };
  return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pure merge: overlay an experience onto an existing settings_data.current map.
 *  `merge` (default) keeps unrelated keys; `replace` returns only the overlay. */
export function applyExperienceToSettingsData(
  current: Record<string, unknown>,
  experience: ThemeExperience,
  mode: 'merge' | 'replace' = 'merge',
): Record<string, unknown> {
  const overlay = buildExperienceSettingsOverlay(experience);
  // G6: validate the applied output before it touches merchant data. A malformed overlay must never
  // corrupt a store — fall back to the pre-apply config (merge) or an empty overlay (replace).
  const validation = validateExperienceOverlay(overlay);
  if (!validation.ok) {
    console.warn(`[theme-presets] experience "${experience.id}" produced an invalid overlay; skipping apply: ${validation.issues.join('; ')}`);
    return mode === 'replace' ? {} : { ...current };
  }
  return mode === 'replace' ? { ...validation.overlay } : { ...current, ...validation.overlay };
}

/** Pure merge that produces a store template_config the storefront reads on BOTH the
 *  React (`templateConfig.themeSettings`) and Liquid (`config.settings_data.current`)
 *  paths, and records the applied experience id. Never auto-publishes — callers write
 *  this to a draft (editor) or to sites.template_config (store creation). */
export function applyExperienceToTemplateConfig(
  templateConfig: Record<string, unknown>,
  experience: ThemeExperience,
): Record<string, unknown> {
  const rawOverlay = buildExperienceSettingsOverlay(experience);
  // G6: validate before writing into template_config. On failure, return the config untouched (the store
  // keeps its current appearance) rather than persisting a malformed overlay.
  const validation = validateExperienceOverlay(rawOverlay);
  if (!validation.ok) {
    console.warn(`[theme-presets] experience "${experience.id}" produced an invalid overlay; template config left unchanged: ${validation.issues.join('; ')}`);
    return { ...templateConfig };
  }
  const overlay = validation.overlay;
  const existingThemeSettings = isRecord(templateConfig.themeSettings) ? templateConfig.themeSettings : {};
  const config = isRecord(templateConfig.config) ? templateConfig.config : {};
  const settingsData = isRecord(config.settings_data) ? config.settings_data : {};
  const currentData = isRecord(settingsData.current) ? settingsData.current : {};
  return {
    ...templateConfig,
    experienceId: experience.id,
    themeSettings: { ...existingThemeSettings, ...overlay },
    config: {
      ...config,
      settings_data: {
        ...settingsData,
        current: { ...currentData, ...overlay },
      },
    },
  };
}

export function exportExperience(experience: ThemeExperience): string {
  return JSON.stringify(validateExperience(experience), null, 2);
}

export function importExperience(input: string | unknown): ThemeExperience {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  return validateExperience(data);
}

/** Registry integrity check (used by tests + governance). Returns [] when clean. */
export function collectExperienceRegistryIssues(): string[] {
  const issues: string[] = [];
  const builtIns = new Set<string>(BUILT_IN_SECTION_TYPES);
  const seenIndustries = new Map<string, string>();
  for (const [key, exp] of Object.entries(EXPERIENCE_REGISTRY)) {
    if (key !== exp.id) issues.push(`registry key '${key}' does not match experience id '${exp.id}'`);
    const parsed = ThemeExperienceSchema.safeParse(exp);
    if (!parsed.success) {
      issues.push(`${exp.id}: invalid experience — ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    }
    for (const section of exp.defaultSections) {
      if (!builtIns.has(section)) issues.push(`${exp.id}: defaultSections references unknown built-in section '${section}'`);
    }
    if (exp.industry) {
      const prior = seenIndustries.get(exp.industry);
      if (prior) issues.push(`industry '${exp.industry}' is claimed by both '${prior}' and '${exp.id}'`);
      else seenIndustries.set(exp.industry, exp.id);
    }
  }
  if (!isThemeExperienceId(FALLBACK_EXPERIENCE_ID)) {
    issues.push(`FALLBACK_EXPERIENCE_ID '${FALLBACK_EXPERIENCE_ID}' is not in the registry`);
  }
  return issues;
}

// ── S4-FIX/Defect 2 — settings_data.presets as the single source ──────────────
//
// The bundle's settings_data.presets (theme-bundle.ts's buildLiquidThemeExperiencePresets, keyed
// by Experience `name`) is now the SINGLE SOURCE for which presets a theme has and what values
// applying one writes. This registry (EXPERIENCE_REGISTRY) stays the AUTHORING input that
// generates the bundle, plus the source of display metadata (description/industry/swatches/font)
// the bundle's flat value-only preset shape has no room for. A preset present in the bundle but
// absent from the registry (a hand-authored or third-party theme preset) still renders, with a
// generic fallback description and swatches derived from its own color values — the bundle stays
// authoritative for existence and values. A registry Experience with no bundle preset does not
// render — the bundle is what the merchant's theme actually carries, the registry is not a second
// runtime source.

const PRESET_SWATCH_KEYS = [
  'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor', 'surfaceColor',
] as const;

/** Merchant-facing preset item: bundle-sourced values + name-resolved (or fallback) display copy. */
export interface ExperiencePresetItem {
  /** Stable identifier for apply + active-state tracking — the matched Experience's id when the
   *  bundle preset name resolves against the registry, otherwise a slug of the preset name. */
  id: string;
  /** The bundle preset's key (Shopify-style preset display name, e.g. "Forge"). */
  name: string;
  description: string;
  industry: string | null;
  swatches: string[];
  headingFont: string | null;
  sectionCount: number | null;
  /** The exact values to write into themeSettings / settings_data.current when applied — read
   *  directly from the bundle preset, never recomputed from the registry. */
  values: Record<string, unknown>;
}

function slugifyPresetName(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'preset';
}

function derivePresetSwatches(values: Record<string, unknown>): string[] {
  const swatches: string[] = [];
  for (const key of PRESET_SWATCH_KEYS) {
    const value = values[key];
    if (typeof value === 'string' && HEX.test(value)) swatches.push(value);
  }
  return swatches;
}

/** Resolve a bundle's settings_data.presets into merchant-facing display items. `bundlePresets`
 *  should be `config.settings_data.presets` (or the root `settings_data.presets`, whichever a
 *  caller's loaded theme config carries) — an arbitrary JSON record, not assumed to be well-formed. */
export function resolveExperiencePresetItems(bundlePresets: Record<string, unknown>): ExperiencePresetItem[] {
  const registryByName = new Map(listExperiences().map((experience) => [experience.name, experience]));
  const items: ExperiencePresetItem[] = [];
  for (const [name, rawValues] of Object.entries(bundlePresets)) {
    if (!isRecord(rawValues)) continue;
    const matched = registryByName.get(name);
    if (matched) {
      items.push({
        id: matched.id,
        name: matched.name,
        description: matched.description,
        industry: matched.industry,
        swatches: matched.preview.swatches,
        headingFont: matched.typography.headingFont,
        sectionCount: matched.preview.sectionCount,
        values: rawValues,
      });
      continue;
    }
    items.push({
      id: slugifyPresetName(name),
      name,
      description: 'A saved preset from this theme.',
      industry: null,
      swatches: derivePresetSwatches(rawValues),
      headingFont: typeof rawValues.headingFontFamily === 'string' ? rawValues.headingFontFamily : null,
      sectionCount: null,
      values: rawValues,
    });
  }
  return items;
}
