// K3 — Theme Install Validator
//
// validateThemeInstall({ bundle, targetSlug? }) runs a multi-stage pre-install validation
// pipeline and returns { ok, issues[] }. It is PURE — no DB writes, no network I/O, no
// persistence of any kind.
//
// INSTALLATION PERSISTENCE IS GATEWAY-OWNED:
//   The storefront install route (apps/customer_web/src/app/api/themes/install/route.ts)
//   permanently returns 410 Gone by design — it guards against direct client-side writes.
//   Actual persistence flows through the api-gateway (services/api-gateway) via
//   theme-execution.adapter.ts (buildReleaseArtifacts, theme_releases table) and
//   schema-registry-execution.adapter.ts (theme_packages / theme_package_versions tables).
//   Phase K does NOT add any new DB-writing route. This function is called by the gateway
//   or CLI before it persists to theme_package_versions.
//
// Validation pipeline (in order):
//   Stage 1: Structural validation — validateTheme() enforces the Zod schema + G4 schema_version gate.
//   Stage 2: Lint — lintThemeBundle() checks forbidden tags/attrs and best-practice rules.
//             Error-level lint issues block installation; warn-level issues are surfaced as warnings.
//   Stage 3: Schema compatibility — isThemeBundleSchemaCompatible() confirms the bundle's
//             compatibility_range is satisfied by at least one engine-known schema version.
//   Stage 4: Parity check — collectLiquidPortableSectionParityGaps() reports section types that
//             lack Liquid parity files. These are surfaced as warnings (not blocking) since a
//             theme may include private sections with no built-in parity requirement.
//   Stage 5: Slug coherence — when targetSlug is provided, confirm it matches bundle.package.slug
//             (resolving canonical aliases via resolveCanonicalThemeSlug).

import type { LiquidThemePackageBundle } from './theme-bundle';
import { validateTheme } from './theme-sdk';
import { lintThemeBundle } from './theme-linter';
import { collectLiquidPortableSectionParityGaps } from './theme-governance';
import { isThemeBundleSchemaCompatible } from './theme-version';
import { resolveCanonicalThemeSlug } from './theme-bundle-core';

// ---- Types ----

export type ThemeInstallIssueLevel = 'error' | 'warn';

export interface ThemeInstallIssue {
  /** Severity level — 'error' blocks installation; 'warn' is advisory. */
  level: ThemeInstallIssueLevel;
  /**
   * Machine-readable issue code:
   *   'schema-invalid'       — Zod schema or schema_version gate failed.
   *   'lint-error'           — Lint rule at error level (forbidden tag/attr, etc.).
   *   'lint-warn'            — Lint rule at warn level (unknown section type, etc.).
   *   'compat-range'         — compatibility_range not satisfied by any engine-known version.
   *   'parity-gap'           — Section type lacks a built-in Liquid parity file (advisory).
   *   'slug-mismatch'        — bundle.package.slug does not match the targetSlug argument.
   */
  code:
    | 'schema-invalid'
    | 'lint-error'
    | 'lint-warn'
    | 'compat-range'
    | 'parity-gap'
    | 'slug-mismatch';
  message: string;
}

export interface ThemeInstallValidationResult {
  /** True when no error-level issues were found — the bundle is safe to persist. */
  ok: boolean;
  /** All issues found, ordered by severity (errors first, then warnings). */
  issues: ThemeInstallIssue[];
}

// ---- Validation pipeline ----

/**
 * validateThemeInstall runs the full pre-install validation pipeline.
 *
 * @param bundle    The LiquidThemePackageBundle to validate. Pass a raw parsed-but-unvalidated
 *                  bundle — stage 1 re-validates it with the Zod schema + G4 gate.
 * @param targetSlug Optional. When provided, must match bundle.package.slug (after canonical alias
 *                   resolution) or a slug-mismatch error is added.
 *
 * @returns ThemeInstallValidationResult with ok=true when all error-level stages pass.
 *
 * NOTE: This function never throws. All failures are captured as issues[].
 */
export function validateThemeInstall(input: {
  bundle: LiquidThemePackageBundle;
  targetSlug?: string;
}): ThemeInstallValidationResult {
  const { bundle, targetSlug } = input;
  const issues: ThemeInstallIssue[] = [];

  // Stage 1: Structural validation (Zod schema + G4 schema_version gate).
  const validateResult = validateTheme(bundle);
  if (!validateResult.ok) {
    for (const msg of validateResult.issues) {
      issues.push({ level: 'error', code: 'schema-invalid', message: msg });
    }
    // If structural validation fails the remaining stages may throw or produce noise —
    // return early with a single, clear error set.
    return { ok: false, issues };
  }

  // Stage 2: Lint — error-level issues block installation; warn-level are advisory.
  const lintIssues = lintThemeBundle(bundle);
  for (const lintIssue of lintIssues) {
    if (lintIssue.level === 'error') {
      issues.push({
        level: 'error',
        code: 'lint-error',
        message: `[${lintIssue.rule}] ${lintIssue.message}`,
      });
    } else {
      issues.push({
        level: 'warn',
        code: 'lint-warn',
        message: `[${lintIssue.rule}] ${lintIssue.message}`,
      });
    }
  }

  // Stage 3: Schema compatibility range check.
  if (!isThemeBundleSchemaCompatible(bundle)) {
    issues.push({
      level: 'error',
      code: 'compat-range',
      message:
        `Bundle compatibility_range "${bundle.package.compatibility_range}" is not satisfied ` +
        `by any engine-known schema version. The bundle targets an unsupported schema epoch.`,
    });
  }

  // Stage 4: Liquid parity gap check (advisory warnings — not blocking).
  const sectionTypes = Object.keys(bundle.sections);
  const parityGaps = collectLiquidPortableSectionParityGaps(sectionTypes);
  for (const gap of parityGaps) {
    issues.push({
      level: 'warn',
      code: 'parity-gap',
      message: gap,
    });
  }

  // Stage 5: Target slug coherence check.
  if (targetSlug !== undefined) {
    const canonicalBundleSlug = resolveCanonicalThemeSlug(bundle.package.slug);
    const canonicalTargetSlug = resolveCanonicalThemeSlug(targetSlug);
    if (canonicalBundleSlug !== canonicalTargetSlug) {
      issues.push({
        level: 'error',
        code: 'slug-mismatch',
        message:
          `Bundle package slug "${bundle.package.slug}" (canonical: "${canonicalBundleSlug}") ` +
          `does not match the target slug "${targetSlug}" (canonical: "${canonicalTargetSlug}").`,
      });
    }
  }

  // ok = true when no error-level issues were found.
  const ok = issues.every((issue) => issue.level !== 'error');

  // Sort: errors first, then warnings.
  const sorted = [
    ...issues.filter((i) => i.level === 'error'),
    ...issues.filter((i) => i.level === 'warn'),
  ];

  return { ok, issues: sorted };
}
