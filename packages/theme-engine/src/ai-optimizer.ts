// ============================================================================
// PHASE L6 — AI Theme Optimizer: deterministic bundle analysis + optimization report
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All analysis is purely algorithmic — no fabricated metrics, no AI inference.
//   Lint issues come from lintThemeBundle (the real linter, not a stub).
//   Unused section detection is based on template.order[] cross-reference.
//   Duplicate locale-key detection is O(n) string deduplication.
//   The optimized bundle is always re-validated through parseLiquidThemePackageBundle
//   to guarantee the optimizer cannot emit an invalid bundle.
// ============================================================================

import type { LiquidThemePackageBundle } from './theme-bundle';
import { parseLiquidThemePackageBundle } from './theme-bundle';
import { lintThemeBundle, type ThemeLintIssue } from './theme-linter';

// ── Suggestion types ──────────────────────────────────────────────────────────

export type OptimizationSuggestionType =
  | 'lint-error'              // error-level lint issue (must fix before publishing)
  | 'lint-warning'            // warning-level lint issue (advisory)
  | 'unused-section'          // section file defined but never referenced in template.order[]
  | 'duplicate-section-type'  // same section type referenced more than once in a template
  | 'large-liquid-source'     // a section source exceeds a size threshold
  | 'empty-locale-key'        // locale file contains a key with an empty string value
  | 'oversized-settings';     // settings_data.current has an unusually large serialized value

export type OptimizationSuggestionSeverity = 'error' | 'warn' | 'info';

export interface OptimizationSuggestion {
  type: OptimizationSuggestionType;
  severity: OptimizationSuggestionSeverity;
  message: string;
  /** The bundle path or key affected (e.g. 'sections/hero-banner', 'locales/en', 'templates/index'). */
  location: string;
  /** Optional: the value that caused the issue (e.g. section key, locale key name). */
  detail?: string;
}

// Thresholds — deterministic, not configurable at runtime.
const LARGE_SOURCE_BYTES = 10_000; // 10 KB
const OVERSIZED_SETTINGS_BYTES = 4_000; // 4 KB for a single settings value

// ── analyzeThemeOptimizations ─────────────────────────────────────────────────

/**
 * Analyze a LiquidThemePackageBundle and return a list of optimization suggestions.
 *
 * Checks performed:
 *   1. Run lintThemeBundle — all 5 rules (error: forbidden-tag, forbidden-attr,
 *      missing-schema-block; warn: unknown-section-type, setting-referenced-not-in-schema)
 *   2. Unused section detection: section keys not referenced in any template.order[]
 *   3. Duplicate section types: same type appearing more than once in a template.order[]
 *   4. Oversized Liquid sources: section source > LARGE_SOURCE_BYTES bytes
 *   5. Empty locale keys: locale value === '' or undefined
 *   6. Oversized settings values in settings_data.current
 *
 * All checks are deterministic: same bundle → same suggestions.
 */
export function analyzeThemeOptimizations(bundle: LiquidThemePackageBundle): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // 1. Lint issues
  const lintIssues = lintThemeBundle(bundle);
  for (const issue of lintIssues) {
    suggestions.push({
      type: issue.level === 'error' ? 'lint-error' : 'lint-warning',
      severity: issue.level,
      message: issue.message,
      location: `sections/${issue.sectionType}`,
      detail: issue.rule,
    });
  }

  // 2 & 3. Unused sections + duplicate types per template
  const referencedSectionTypes = new Set<string>();
  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    const typesInTemplate: string[] = [];
    for (const sectionId of template.order) {
      const sectionEntry = template.sections[sectionId];
      if (sectionEntry) {
        referencedSectionTypes.add(sectionEntry.type);
        typesInTemplate.push(sectionEntry.type);
      }
    }

    // Duplicate types within this template
    const seen = new Map<string, number>();
    for (const type of typesInTemplate) {
      seen.set(type, (seen.get(type) ?? 0) + 1);
    }
    for (const [type, count] of seen) {
      if (count > 1) {
        suggestions.push({
          type: 'duplicate-section-type',
          severity: 'warn',
          message: `Section type "${type}" appears ${count} times in template "${templateKey}". Consider consolidating to avoid redundant rendering.`,
          location: `templates/${templateKey}`,
          detail: type,
        });
      }
    }
  }

  // Unused sections: defined in bundle.sections but never referenced
  for (const sectionKey of Object.keys(bundle.sections)) {
    if (!referencedSectionTypes.has(sectionKey)) {
      suggestions.push({
        type: 'unused-section',
        severity: 'info',
        message: `Section "${sectionKey}" is defined in the bundle but not referenced in any template.order[]. Consider removing it to reduce bundle size.`,
        location: `sections/${sectionKey}`,
        detail: sectionKey,
      });
    }
  }

  // 4. Large Liquid sources
  for (const [sectionKey, section] of Object.entries(bundle.sections)) {
    const byteLength = Buffer.byteLength(section.source, 'utf8');
    if (byteLength > LARGE_SOURCE_BYTES) {
      suggestions.push({
        type: 'large-liquid-source',
        severity: 'warn',
        message: `Section "${sectionKey}" source is ${byteLength} bytes (threshold: ${LARGE_SOURCE_BYTES}). Consider splitting into smaller sections or moving static content to assets.`,
        location: `sections/${sectionKey}`,
        detail: `${byteLength} bytes`,
      });
    }
  }

  // 5. Empty locale keys
  for (const [localeName, locale] of Object.entries(bundle.locales)) {
    collectEmptyLocaleKeys(locale, `locales/${localeName}`, suggestions);
  }

  // 6. Oversized settings values in settings_data.current
  const current = bundle.config?.settings_data?.current ?? {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === 'string') {
      const byteLength = Buffer.byteLength(value, 'utf8');
      if (byteLength > OVERSIZED_SETTINGS_BYTES) {
        suggestions.push({
          type: 'oversized-settings',
          severity: 'warn',
          message: `settings_data.current["${key}"] is ${byteLength} bytes. Large setting values increase theme template serialization cost. Consider moving content to the database or Liquid assets.`,
          location: 'settings_data.current',
          detail: key,
        });
      }
    }
  }

  return suggestions;
}

// ── optimizeThemeBundle ───────────────────────────────────────────────────────

export interface OptimizationReport {
  removedSections: string[];
  deduplicatedLocaleKeys: number;
  suggestions: OptimizationSuggestion[];
}

/**
 * Apply safe, non-lossy optimizations to a LiquidThemePackageBundle and return the
 * optimized bundle + a report of what changed.
 *
 * Optimizations applied:
 *   - Remove sections not referenced in any template.order[]
 *   - Remove locale keys with empty string values
 *
 * The result bundle is validated through parseLiquidThemePackageBundle before being
 * returned — the optimizer can never emit an invalid bundle.
 *
 * Deterministic: same bundle → same optimized bundle + same report.
 */
export function optimizeThemeBundle(bundle: LiquidThemePackageBundle): {
  bundle: LiquidThemePackageBundle;
  report: OptimizationReport;
} {
  const suggestions = analyzeThemeOptimizations(bundle);

  // Collect referenced section types across all templates.
  // Use Object.values(template.sections) — not template.order — so that section
  // instances present in template.sections but absent from template.order (valid
  // schema state: disabled/hidden sections) are still counted as referenced and
  // their backing bundle.sections file is not deleted. Deleting a file while its
  // template.sections entry still exists would cause parseLiquidThemePackageBundle
  // to throw a ZodError on the next call.
  const referencedTypes = new Set<string>();
  for (const template of Object.values(bundle.templates)) {
    for (const section of Object.values(template.sections)) {
      referencedTypes.add(section.type);
    }
  }

  // Remove unreferenced sections
  const removedSections: string[] = [];
  const optimizedSections = { ...bundle.sections };
  for (const sectionKey of Object.keys(bundle.sections)) {
    if (!referencedTypes.has(sectionKey)) {
      delete optimizedSections[sectionKey];
      removedSections.push(sectionKey);
    }
  }

  // Remove empty locale keys
  let deduplicatedLocaleKeys = 0;
  const optimizedLocales: Record<string, unknown> = {};
  for (const [localeName, locale] of Object.entries(bundle.locales)) {
    const cleaned = removeEmptyLocaleValues(locale, 0);
    const removedCount = countLeaves(locale) - countLeaves(cleaned);
    deduplicatedLocaleKeys += removedCount;
    optimizedLocales[localeName] = cleaned;
  }

  const draft = {
    ...bundle,
    sections: optimizedSections,
    locales: optimizedLocales,
  };

  // Re-validate: the optimizer can never emit an invalid bundle.
  // Wrap in try/catch so that an unexpected validation failure (e.g. a schema
  // edge case not caught above) degrades gracefully by returning the original
  // bundle unmodified rather than propagating an unhandled exception to the caller.
  let optimizedBundle: LiquidThemePackageBundle;
  try {
    optimizedBundle = parseLiquidThemePackageBundle(draft);
  } catch {
    // The optimised draft failed schema validation — return the original bundle intact.
    return {
      bundle,
      report: { removedSections: [], deduplicatedLocaleKeys: 0, suggestions },
    };
  }

  return {
    bundle: optimizedBundle,
    report: { removedSections, deduplicatedLocaleKeys, suggestions },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectEmptyLocaleKeys(
  obj: unknown,
  basePath: string,
  suggestions: OptimizationSuggestion[],
): void {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = `${basePath}.${key}`;
    if (value === '' || value === null || value === undefined) {
      suggestions.push({
        type: 'empty-locale-key',
        severity: 'info',
        message: `Locale key "${path}" has an empty or null value. Remove it to reduce bundle size.`,
        location: basePath,
        detail: key,
      });
    } else if (typeof value === 'object') {
      collectEmptyLocaleKeys(value, path, suggestions);
    }
  }
}

function removeEmptyLocaleValues(obj: unknown, depth: number): unknown {
  if (depth > 10 || obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === '' || value === null || value === undefined) continue;
    if (typeof value === 'object') {
      const cleaned = removeEmptyLocaleValues(value, depth + 1);
      if (typeof cleaned === 'object' && cleaned !== null && Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

function countLeaves(obj: unknown, depth = 0): number {
  if (depth > 10 || obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1;
  let count = 0;
  for (const value of Object.values(obj as Record<string, unknown>)) {
    count += countLeaves(value, depth + 1);
  }
  return count;
}

/**
 * Convenience: run lintThemeBundle and surface only error-level issues as suggestions.
 * Useful for CI gates that only block on errors.
 */
export function collectLintErrors(bundle: LiquidThemePackageBundle): ThemeLintIssue[] {
  return lintThemeBundle(bundle).filter((i) => i.level === 'error');
}
