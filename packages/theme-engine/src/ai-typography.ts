// ============================================================================
// PHASE L3 — AI Typography Pairing: deterministic font-pair selection
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All functions are deterministic — same input → same output.
//   Every font family returned is a member of EXPERIENCE_FONT_REGISTRY (6 families).
//   No invented or external font is ever emitted.
//
// Naming note: TypographyPairing / TypographyIntent / TYPOGRAPHY_PAIRING_CATALOG are
// the Phase L canonical names for this module's surface. theme-ai-sdk.ts has its own
// FontPairing / FontPairingIntent / FONT_PAIRING_CATALOG with a compatible but distinct
// shape (includes googleFontsHref). Both are valid; this module is the implementation
// source and theme-ai-sdk.ts is the high-level facade.
// ============================================================================

import { EXPERIENCE_FONT_REGISTRY, buildGoogleFontsHref } from './experience-fonts';

// ── Types ────────────────────────────────────────────────────────────────────

/** The five design intents, each mapping to a distinct heading+body pair. */
export type TypographyIntent = 'editorial' | 'technical' | 'artisanal' | 'friendly' | 'neutral';

/**
 * A resolved heading + body font pairing.
 * Both families are guaranteed to be present in EXPERIENCE_FONT_REGISTRY.
 */
export interface TypographyPairing {
  /** Font family for headings (maps to ExperienceTokens.headingFontFamily). */
  headingFontFamily: string;
  /** Font family for body text (maps to ExperienceTokens.fontFamily). */
  fontFamily: string;
  /** The design intent this pairing expresses. */
  intent: TypographyIntent;
  /** Google Fonts CSS2 stylesheet href for the pair, or null if system fonts only. */
  googleFontsHref: string | null;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

/**
 * All valid heading+body pairings derived from the 6 known EXPERIENCE_FONT_REGISTRY families.
 * No pairing uses a font family that is not in the registry.
 */
export const TYPOGRAPHY_PAIRING_CATALOG: ReadonlyArray<TypographyPairing> = Object.freeze([
  {
    intent: 'editorial' as const,
    headingFontFamily: 'Playfair Display',
    fontFamily: 'Inter',
    googleFontsHref: buildGoogleFontsHref(['Playfair Display', 'Inter']),
  },
  {
    intent: 'technical' as const,
    headingFontFamily: 'Inter',
    fontFamily: 'Source Sans Pro',
    googleFontsHref: buildGoogleFontsHref(['Inter', 'Source Sans Pro']),
  },
  {
    intent: 'artisanal' as const,
    headingFontFamily: 'Cormorant Garamond',
    fontFamily: 'Lato',
    googleFontsHref: buildGoogleFontsHref(['Cormorant Garamond', 'Lato']),
  },
  {
    intent: 'friendly' as const,
    headingFontFamily: 'Inter',
    fontFamily: 'Lato',
    googleFontsHref: buildGoogleFontsHref(['Inter', 'Lato']),
  },
  {
    intent: 'neutral' as const,
    headingFontFamily: 'Libre Baskerville',
    fontFamily: 'Source Sans Pro',
    googleFontsHref: buildGoogleFontsHref(['Libre Baskerville', 'Source Sans Pro']),
  },
]);

// Every pairing family must be registered — validated at module load, never at runtime:
for (const pairing of TYPOGRAPHY_PAIRING_CATALOG) {
  if (!EXPERIENCE_FONT_REGISTRY[pairing.headingFontFamily]) {
    throw new Error(
      `ai-typography: headingFontFamily "${pairing.headingFontFamily}" is not in EXPERIENCE_FONT_REGISTRY`,
    );
  }
  if (!EXPERIENCE_FONT_REGISTRY[pairing.fontFamily]) {
    throw new Error(
      `ai-typography: fontFamily "${pairing.fontFamily}" is not in EXPERIENCE_FONT_REGISTRY`,
    );
  }
}

// ── Lookup maps ──────────────────────────────────────────────────────────────

/** Canonical industry key → typography intent. Covers the 9 INDUSTRY_EXPERIENCE_MAP keys. */
const INDUSTRY_TYPOGRAPHY_INTENT: Readonly<Record<string, TypographyIntent>> = Object.freeze({
  electronics: 'technical',
  fashion: 'editorial',
  beauty: 'artisanal',
  furniture: 'neutral',
  food: 'friendly',
  sports: 'technical',
  books: 'editorial',
  pet: 'friendly',
  general: 'neutral',
});

/** Recognized mood/tone keywords → typography intent. */
const TONE_TYPOGRAPHY_INTENT: Readonly<Record<string, TypographyIntent>> = Object.freeze({
  premium: 'editorial',
  luxury: 'artisanal',
  editorial: 'editorial',
  technical: 'technical',
  precise: 'technical',
  artisanal: 'artisanal',
  handcrafted: 'artisanal',
  craft: 'artisanal',
  minimal: 'neutral',
  clean: 'neutral',
  playful: 'friendly',
  friendly: 'friendly',
  warm: 'friendly',
  bold: 'editorial',
  modern: 'technical',
});

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Look up the TypographyPairing for a given design intent.
 * Always returns a result (falls back to 'neutral').
 * Internal helper; callers should use generateTypographyPairing.
 */
export function findTypographyPairing(intent: TypographyIntent): TypographyPairing {
  return TYPOGRAPHY_PAIRING_CATALOG.find((p) => p.intent === intent)
    ?? TYPOGRAPHY_PAIRING_CATALOG.find((p) => p.intent === 'neutral')!;
}

export interface TypographyPairingOptions {
  industry?: string | null;
  tone?: string | null;
}

/**
 * Deterministically select a font pairing from the catalog based on industry and/or tone.
 *
 * Priority: tone > industry > 'neutral' fallback.
 * All returned families are members of EXPERIENCE_FONT_REGISTRY — no invented fonts.
 *
 * NOT-CONNECTED seam: mapping a merchant's free-text description to a tone keyword
 * requires an LLM; this function accepts only structured, pre-tokenized inputs.
 */
export function generateTypographyPairing(opts: TypographyPairingOptions = {}): TypographyPairing {
  const { industry, tone } = opts;

  // 1. Tone wins if recognised
  if (tone) {
    const normalizedTone = tone.toLowerCase().trim();
    const intent = TONE_TYPOGRAPHY_INTENT[normalizedTone];
    if (intent) return findTypographyPairing(intent);
  }

  // 2. Industry lookup
  if (industry) {
    const normalizedIndustry = industry.toLowerCase().trim();
    const intent = INDUSTRY_TYPOGRAPHY_INTENT[normalizedIndustry];
    if (intent) return findTypographyPairing(intent);
  }

  // 3. Fallback: neutral
  return findTypographyPairing('neutral');
}
