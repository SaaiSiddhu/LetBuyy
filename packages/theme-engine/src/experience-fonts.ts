// ============================================================================
// EXPERIENCE FONT SYSTEM  (Phase-2.5 Stream D)
// ----------------------------------------------------------------------------
// Experiences declare heading/body font families (Inter, Playfair Display, …).
// Until now non-system fonts silently fell back to system-ui because nothing
// emitted a font stylesheet. This module maps each Experience font to its Google
// Fonts spec + fallback stack and builds the `<link rel="stylesheet">` href that
// the storefront head (React layout + Liquid head) injects.
//
// Pure data + string building — no DOM, no network. The actual <link> injection
// is the storefront integration point (documented in
// docs/v1-execution/phase-2-5/04-font-system.md); this module is the reusable,
// testable core both render paths share.
// ============================================================================

import { listExperiences, type ThemeExperience } from './theme-presets';

export interface ExperienceFontSpec {
    /** Display family name as used in CSS / experience typography. */
    family: string;
    /** Google Fonts `family=` query value (spaces become `+`, with weight axis). */
    googleFamily: string;
    /** CSS fallback stack appended after the family. */
    fallback: string;
}

const GOOGLE_FONTS_CSS2 = 'https://fonts.googleapis.com/css2';

/** Every font family referenced by an Experience, with its Google Fonts spec + fallback. */
export const EXPERIENCE_FONT_REGISTRY: Readonly<Record<string, ExperienceFontSpec>> = Object.freeze({
    Inter: { family: 'Inter', googleFamily: 'Inter:wght@400;500;600;700', fallback: 'system-ui, -apple-system, sans-serif' },
    'Playfair Display': { family: 'Playfair Display', googleFamily: 'Playfair+Display:wght@400;500;600;700', fallback: 'Georgia, "Times New Roman", serif' },
    'Cormorant Garamond': { family: 'Cormorant Garamond', googleFamily: 'Cormorant+Garamond:wght@400;500;600;700', fallback: 'Georgia, "Times New Roman", serif' },
    'Libre Baskerville': { family: 'Libre Baskerville', googleFamily: 'Libre+Baskerville:wght@400;700', fallback: 'Georgia, "Times New Roman", serif' },
    'Source Sans Pro': { family: 'Source Sans Pro', googleFamily: 'Source+Sans+Pro:wght@400;600;700', fallback: 'system-ui, -apple-system, sans-serif' },
    Lato: { family: 'Lato', googleFamily: 'Lato:wght@400;700', fallback: 'system-ui, -apple-system, sans-serif' },
});

export function getExperienceFontSpec(family: string): ExperienceFontSpec | undefined {
    return EXPERIENCE_FONT_REGISTRY[family];
}

/** A full CSS font-family value (family + fallback stack) for the given family. */
export function fontFamilyWithFallback(family: string): string {
    const spec = EXPERIENCE_FONT_REGISTRY[family];
    const fallback = spec ? spec.fallback : 'system-ui, -apple-system, sans-serif';
    return `"${family}", ${fallback}`;
}

/** The unique font families an experience needs (heading + body). */
export function collectExperienceFontFamilies(experience: ThemeExperience): string[] {
    return [...new Set([experience.typography.headingFont, experience.typography.bodyFont])];
}

/** Build a Google Fonts css2 stylesheet href for the given families (known families only). Returns
 *  null when there is nothing to load (e.g. only system fonts). `display=swap` avoids invisible text. */
export function buildGoogleFontsHref(families: string[]): string | null {
    const known = [...new Set(families)]
        .map((f) => EXPERIENCE_FONT_REGISTRY[f])
        .filter((spec): spec is ExperienceFontSpec => Boolean(spec));
    if (known.length === 0) return null;
    const query = known.map((spec) => `family=${spec.googleFamily}`).join('&');
    return `${GOOGLE_FONTS_CSS2}?${query}&display=swap`;
}

/** The Google Fonts stylesheet href an experience needs in the storefront head (or null). */
export function buildExperienceFontLinkHref(experience: ThemeExperience): string | null {
    return buildGoogleFontsHref(collectExperienceFontFamilies(experience));
}

/** Integrity check (tests + governance): every experience font is registered. Returns [] when clean. */
export function collectExperienceFontIssues(): string[] {
    const issues: string[] = [];
    for (const exp of listExperiences()) {
        for (const family of collectExperienceFontFamilies(exp)) {
            if (!EXPERIENCE_FONT_REGISTRY[family]) {
                issues.push(`${exp.id}: font '${family}' is not in EXPERIENCE_FONT_REGISTRY`);
            }
        }
    }
    return issues;
}
