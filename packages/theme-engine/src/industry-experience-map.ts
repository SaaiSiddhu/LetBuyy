// ============================================================================
// INDUSTRY → EXPERIENCE MAPPING  (Phase-2 Stream D)
// ----------------------------------------------------------------------------
// Maps a merchant's declared industry to a recommended Experience. The merchant
// can always override the recommendation (override wins). When no industry is
// known, falls back to the General experience (Summit) — which mirrors the
// platform default tokens, so the fallback is visually safe.
//
// NOTE on the source industry map: the Phase-2 brief listed "Food → Harvest",
// but Harvest is not one of the 10 defined experiences. Per the research grocery
// preset, Food maps to REFRESH. See theme-presets.ts (REFRESH.metadata.notes).
// ============================================================================

import {
  EXPERIENCE_REGISTRY,
  FALLBACK_EXPERIENCE_ID,
  getExperience,
  isThemeExperienceId,
  type ThemeExperience,
} from './theme-presets';

/** Canonical industry keys → experience id. Every value MUST exist in the registry. */
export const INDUSTRY_EXPERIENCE_MAP: Readonly<Record<string, string>> = Object.freeze({
  electronics: 'forge',
  fashion: 'sense',
  beauty: 'aura',
  furniture: 'craft',
  food: 'refresh',
  sports: 'ride',
  books: 'dawn',
  pet: 'bloom',
  general: 'summit',
});

/** Common synonyms → canonical industry key, so free-text/legacy values still resolve. */
const INDUSTRY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  tech: 'electronics',
  electronic: 'electronics',
  gadgets: 'electronics',
  apparel: 'fashion',
  clothing: 'fashion',
  cosmetics: 'beauty',
  skincare: 'beauty',
  home: 'furniture',
  decor: 'furniture',
  homedecor: 'furniture',
  grocery: 'food',
  groceries: 'food',
  organic: 'food',
  fitness: 'sports',
  athletics: 'sports',
  outdoor: 'sports',
  book: 'books',
  stationery: 'books',
  education: 'books',
  pets: 'pet',
  animals: 'pet',
  // explicit "harvest" alias → food, in case the legacy brief value is passed through
  harvest: 'food',
});

/** Merchant-facing industry options for the onboarding/store-creation picker. */
export interface IndustryOption {
  id: string;
  label: string;
  experienceId: string;
}

export const INDUSTRY_OPTIONS: ReadonlyArray<IndustryOption> = Object.freeze(
  [
    { id: 'electronics', label: 'Electronics & Tech' },
    { id: 'fashion', label: 'Fashion & Apparel' },
    { id: 'beauty', label: 'Beauty & Cosmetics' },
    { id: 'furniture', label: 'Furniture & Home' },
    { id: 'food', label: 'Food & Grocery' },
    { id: 'sports', label: 'Sports & Fitness' },
    { id: 'books', label: 'Books & Stationery' },
    { id: 'pet', label: 'Pet & Animals' },
    { id: 'general', label: 'General / Multi-category' },
  ].map((o) => Object.freeze({ ...o, experienceId: INDUSTRY_EXPERIENCE_MAP[o.id] })),
);

/** Normalize a raw industry string to a canonical key (or null if unrecognizable). */
export function normalizeIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  const lower = industry.trim().toLowerCase();
  const compact = lower.replace(/[\s_&/-]+/g, '');
  if (Object.prototype.hasOwnProperty.call(INDUSTRY_EXPERIENCE_MAP, compact)) return compact;
  if (Object.prototype.hasOwnProperty.call(INDUSTRY_ALIASES, compact)) return INDUSTRY_ALIASES[compact];
  // Token fallback: resolve labels/compounds like "Electronics & Tech" or "Tech & Gadgets".
  for (const token of lower.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (Object.prototype.hasOwnProperty.call(INDUSTRY_EXPERIENCE_MAP, token)) return token;
    if (Object.prototype.hasOwnProperty.call(INDUSTRY_ALIASES, token)) return INDUSTRY_ALIASES[token];
  }
  return null;
}

export interface ExperienceResolution {
  experience: ThemeExperience;
  source: 'override' | 'industry' | 'fallback';
  industry: string | null;
}

/**
 * Resolve an experience. Precedence:
 *   1. `override` — an explicit experience id the merchant chose (wins if valid).
 *   2. `industry` — mapped via INDUSTRY_EXPERIENCE_MAP (after normalization).
 *   3. fallback — the General experience (Summit).
 */
export function resolveExperienceForIndustry(
  industry: string | null | undefined,
  override?: string | null,
): ExperienceResolution {
  if (override && isThemeExperienceId(override)) {
    return { experience: getExperience(override)!, source: 'override', industry: normalizeIndustry(industry) };
  }
  const canonical = normalizeIndustry(industry);
  if (canonical) {
    const experienceId = INDUSTRY_EXPERIENCE_MAP[canonical];
    const experience = experienceId ? getExperience(experienceId) : undefined;
    if (experience) return { experience, source: 'industry', industry: canonical };
  }
  return { experience: getExperience(FALLBACK_EXPERIENCE_ID)!, source: 'fallback', industry: canonical };
}

/** Map integrity check (tests + governance). Returns [] when clean. */
export function collectIndustryMapIssues(): string[] {
  const issues: string[] = [];
  for (const [industry, experienceId] of Object.entries(INDUSTRY_EXPERIENCE_MAP)) {
    if (!isThemeExperienceId(experienceId)) {
      issues.push(`industry '${industry}' maps to unknown experience '${experienceId}'`);
    }
  }
  for (const option of INDUSTRY_OPTIONS) {
    if (INDUSTRY_EXPERIENCE_MAP[option.id] !== option.experienceId) {
      issues.push(`industry option '${option.id}' experienceId is out of sync with the map`);
    }
  }
  if (!isThemeExperienceId(FALLBACK_EXPERIENCE_ID)) {
    issues.push(`fallback experience '${FALLBACK_EXPERIENCE_ID}' is not registered`);
  }
  // Every registry experience with a non-null industry should be reachable from the map.
  for (const exp of Object.values(EXPERIENCE_REGISTRY)) {
    if (exp.industry && INDUSTRY_EXPERIENCE_MAP[exp.industry] !== exp.id) {
      issues.push(`experience '${exp.id}' claims industry '${exp.industry}' but the map does not point back to it`);
    }
  }
  return issues;
}
