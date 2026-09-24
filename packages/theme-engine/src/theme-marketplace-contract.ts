// Phase AE — Theme Marketplace Partner-Submission Validation Contract
//
// validateThemeForMarketplace(rawBundle) → { ok, violations[] }
//
// A third-party (partner) theme submission MUST pass this gate before it could
// ever be listed in the LetBuyy theme marketplace. The gate is:
//
//   PURE          — no DB writes, no network I/O, no side effects.
//   DETERMINISTIC — same input always produces the same result.
//   FAIL-CLOSED   — any unrecognised/error state → ok:false.
//
// Validator composition (all stages run; K hard-failure skips AA/Y/N to avoid noise):
//
//   Stage K  validateThemeInstall  (subsumes G4 + H + compat-range + parity)
//            – G4: parseLiquidThemePackageBundle schema_version gate
//            – H:  lintThemeBundle forbidden-tag / forbidden-attr / schema-block checks
//            – Compat range: compatibility_range satisfied by an engine-known version
//            – Parity:       section types with no built-in Liquid parity file (advisory)
//
//   Stage AA validateCustomCss — applied to every string leaf in
//            config.settings_data.current; a bundled default that contains
//            @import / url(javascript:) / expression() / </style> etc. is rejected.
//
//   Stage Y  BLOCKED_APP_BLOCK_SETTING_KEYS — applied to the settings of every
//            `@app`-typed template block.  An @app block that ships with
//            api_key / webhook_secret / access_token in its default settings
//            is rejected before any merchant ever installs the theme.
//
//   Stage N  parseThemeDocument(toThemeDocumentV2(bundle)) — converts the bundle
//            to the editor's stable-id document format and re-validates it.
//            Catches template-key charset and block-nesting problems that
//            LiquidThemePackageBundleSchema does not enforce.
//
// DESIGN CONTRACT:
//   This module ONLY composes existing validators.  It adds NO new allow-lists,
//   no new deny-lists, and NO sanitizer relaxation.  The locked sanitizer
//   (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG) and frozen theme-registry.ts are
//   untouched.  NO new React-per-section code is added (ART-17 frozen).
//
// SCOPE:
//   This is the readiness gate contract, NOT a live pipeline.  The frozen apps
//   (apps/frozen/app-store, apps/frozen/developer-portal, apps/frozen/theme-store) are
//   NOT referenced here.  Marketplace launch remains ARB/human-gated.

import {
  parseLiquidThemePackageBundle,
  isLiquidAppBlockType,
  type LiquidThemePackageBundle,
} from './theme-bundle';
import { validateThemeInstall } from './theme-install';
import { validateCustomCss } from './custom-css-sanitizer';
import { BLOCKED_APP_BLOCK_SETTING_KEYS } from './app-block-model';
import { toThemeDocumentV2, parseThemeDocument } from './theme-document';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Which validation stage produced a given violation.
 *
 *   K  — Stage K: validateThemeInstall (schema / lint / compat / parity)
 *   AA — Stage AA: Custom CSS safety on settings_data.current values
 *   Y  — Stage Y: @app block credential-key check
 *   N  — Stage N: ThemeDocument parse (toThemeDocumentV2 + parseThemeDocument)
 */
export type ThemeMarketplaceStage = 'K' | 'AA' | 'Y' | 'N';

export interface ThemeMarketplaceViolation {
  /** Stage that produced this violation. */
  stage: ThemeMarketplaceStage;
  /**
   * Machine-readable code.
   *   'K:<install-code>'      e.g. 'K:schema-invalid', 'K:lint-error', 'K:compat-range'
   *   'K:<warn-code>'         e.g. 'K:lint-warn', 'K:parity-gap'  (advisory, not blocking)
   *   'AA:css-injection'      settings_data value contains a CSS injection vector
   *   'Y:blocked-setting-key' @app template block ships a credential-adjacent key
   *   'N:document-parse-failed' bundle fails the ThemeDocument parse
   */
  code: string;
  /** Human-readable description of the violation. */
  message: string;
  /**
   * true for advisory violations (warn-level lint / parity-gap).
   * These are surfaced but do NOT cause ok=false.
   */
  advisory?: boolean;
}

export interface ThemeMarketplaceValidationResult {
  /**
   * true when NO error-level violations were produced by any stage.
   * Advisory violations (parity-gap, lint-warn) never affect ok.
   */
  ok: boolean;
  /**
   * All violations, ordered:
   *   1. Stage K errors  (blocking)
   *   2. Stage AA errors (blocking)
   *   3. Stage Y errors  (blocking)
   *   4. Stage N errors  (blocking)
   *   5. Advisory warnings (non-blocking; advisory=true)
   */
  violations: ThemeMarketplaceViolation[];
}

// ---------------------------------------------------------------------------
// Internal: collect string leaves from settings_data.current
// ---------------------------------------------------------------------------

/**
 * Walk a plain JSON value tree (limited depth) and yield every string leaf
 * together with a human-readable path.
 *
 * Used to collect all string values from settings_data.current so each one
 * can be independently validated through the AA CSS sanitizer.
 *
 * Depth is capped at MAX_SETTINGS_WALK_DEPTH to prevent denial-of-service on
 * deeply nested bundles.  The cap is set well above the deepest legitimate theme
 * setting (nested blocks are themselves bounded at MAX_BLOCK_DEPTH=3, and
 * settings_data nests at most a few levels below that), so no clean bundle is
 * ever truncated.  Crucially, truncation is FAIL-CLOSED: if the walker reaches
 * the cap with content still below it, it records the truncation on `state` so
 * the caller can REJECT the bundle rather than silently skip un-scanned strings.
 * This closes the bypass where an @import buried below the cap would otherwise
 * pass the marketplace gate unvalidated.
 */
const MAX_SETTINGS_WALK_DEPTH = 12;

function* walkStringLeaves(
  value: unknown,
  path: string,
  depth: number,
  state: { truncated: boolean; truncatedPath: string | null },
): Generator<{ path: string; value: string }> {
  if (depth > MAX_SETTINGS_WALK_DEPTH) {
    // Reached the cap with a string or a further-nested container still below:
    // there is unscanned content, so mark truncation and let the caller fail closed.
    if (typeof value === 'string' || (value !== null && typeof value === 'object')) {
      if (!state.truncated) {
        state.truncated = true;
        state.truncatedPath = path;
      }
    }
    return;
  }
  if (typeof value === 'string') {
    yield { path, value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkStringLeaves(value[i], `${path}[${i}]`, depth + 1, state);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      yield* walkStringLeaves(child, `${path}.${key}`, depth + 1, state);
    }
  }
}

// ---------------------------------------------------------------------------
// Main gate
// ---------------------------------------------------------------------------

/**
 * Validate a raw (potentially unknown-shape) third-party theme bundle against
 * the full partner-submission safety contract.
 *
 * This function never throws.  All failures are captured as violations[].
 *
 * @param rawBundle  Raw (unknown) JSON payload from the partner.  Stage K
 *                   re-validates it via the Zod schema and the G4 version gate.
 *                   Passing an already-typed LiquidThemePackageBundle is safe.
 */
export function validateThemeForMarketplace(
  rawBundle: unknown,
): ThemeMarketplaceValidationResult {
  const blockingViolations: ThemeMarketplaceViolation[] = [];
  const advisoryViolations: ThemeMarketplaceViolation[] = [];

  // ------------------------------------------------------------------ Stage K
  // validateThemeInstall composes:
  //   Stage 1 — Structural (Zod + G4 schema_version gate)
  //   Stage 2 — Lint (lintThemeBundle: forbidden-tag, forbidden-attr, schema-block, setting refs)
  //   Stage 3 — Compat range
  //   Stage 4 — Liquid parity gap (advisory)
  //   Stage 5 — Slug coherence (skipped here; marketplace ignores slug)
  const installResult = validateThemeInstall({
    bundle: rawBundle as LiquidThemePackageBundle,
    // targetSlug omitted: slug coherence is a runtime installation concern,
    // not a marketplace submission concern.
  });

  for (const issue of installResult.issues) {
    const code = `K:${issue.code}`;
    const isAdvisory = issue.level === 'warn';
    const violation: ThemeMarketplaceViolation = {
      stage: 'K',
      code,
      message: issue.message,
      ...(isAdvisory ? { advisory: true } : {}),
    };
    if (isAdvisory) {
      advisoryViolations.push(violation);
    } else {
      blockingViolations.push(violation);
    }
  }

  // If Stage K produced a hard structural failure (schema-invalid or compat-range),
  // the bundle is unparseable by design; skip AA/Y/N to avoid misleading noise.
  const stageKHardFail = installResult.issues.some(
    (i) => i.level === 'error' && (i.code === 'schema-invalid' || i.code === 'compat-range'),
  );

  if (stageKHardFail) {
    return {
      ok: false,
      violations: [...blockingViolations, ...advisoryViolations],
    };
  }

  // Obtain a typed bundle for stages AA/Y/N.
  // validateThemeInstall already validated the bundle so this parse cannot fail.
  let bundle: LiquidThemePackageBundle;
  try {
    bundle = parseLiquidThemePackageBundle(rawBundle);
  } catch (err: unknown) {
    // Paranoid path: should not be reachable after a passing Stage K.
    blockingViolations.push({
      stage: 'K',
      code: 'K:schema-invalid',
      message:
        `Bundle re-parse failed after Stage K succeeded (unexpected): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      ok: false,
      violations: [...blockingViolations, ...advisoryViolations],
    };
  }

  // ----------------------------------------------------------------- Stage AA
  // Validate every string leaf in config.settings_data.current through the
  // custom-CSS sanitizer (Phase AA: validateAndScopeCustomCss via validateCustomCss).
  //
  // Rationale: a partner theme may ship bundled default values in settings_data
  // (e.g. background gradients, font-face declarations).  If any default value
  // contains a CSS injection vector (@import, url(javascript:), expression(),
  // </style> breakout), the theme is rejected before any merchant installs it.
  //
  // The AA validator returns ok:true on empty strings and on plain non-CSS values
  // (numbers-as-strings, color names, URLs to safe CDN assets), so checking all
  // string leaves produces no false positives for clean bundles.
  const settingsCurrent: unknown = bundle.config?.settings_data?.current ?? {};
  const walkState = { truncated: false, truncatedPath: null as string | null };
  for (const { path, value: rawCss } of walkStringLeaves(
    settingsCurrent,
    'settings_data.current',
    0,
    walkState,
  )) {
    const cssResult = validateCustomCss(rawCss);
    if (!cssResult.ok) {
      for (const v of cssResult.violations) {
        blockingViolations.push({
          stage: 'AA',
          code: 'AA:css-injection',
          message: `${path}: ${v}`,
        });
      }
    }
  }
  // Fail-closed: a bundle nested deeper than the walk cap has un-scanned string
  // leaves that could hide a CSS injection vector, so it is rejected outright
  // rather than admitted with a validation blind spot.
  if (walkState.truncated) {
    blockingViolations.push({
      stage: 'AA',
      code: 'AA:settings-too-deep',
      message: `settings_data.current is nested beyond the maximum validatable depth (${MAX_SETTINGS_WALK_DEPTH}) at ${walkState.truncatedPath ?? 'unknown path'}; the bundle cannot be safely scanned for CSS injection and is rejected`,
    });
  }

  // ------------------------------------------------------------------ Stage Y
  // For every template block with an @app block type, check that its default
  // settings do not include keys from BLOCKED_APP_BLOCK_SETTING_KEYS.
  //
  // Rationale: a bundled @app block's settings flow through filterAppBlockSettings
  // at render time, which silently strips credential-adjacent keys.  Shipping a
  // bundle that contains api_key / webhook_secret / access_token in default @app
  // block settings indicates either an accidental credential leak or an attempt
  // to probe the key-filtering mechanism — both are hard rejections.
  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    for (const [sectionId, section] of Object.entries(template.sections)) {
      for (const [blockId, block] of Object.entries(section.blocks)) {
        if (!isLiquidAppBlockType(block.type)) continue;

        const blockSettings = (block as { settings?: Record<string, unknown> }).settings ?? {};
        const blockedKeys = Object.keys(blockSettings).filter(
          (key) => BLOCKED_APP_BLOCK_SETTING_KEYS.has(key),
        );

        for (const key of blockedKeys) {
          blockingViolations.push({
            stage: 'Y',
            code: 'Y:blocked-setting-key',
            message:
              `templates["${templateKey}"].sections["${sectionId}"].blocks["${blockId}"] ` +
              `(type "${block.type}", @app block) ships blocked credential-adjacent ` +
              `setting key "${key}". Remove this key — it would be stripped silently ` +
              `by filterAppBlockSettings at render time and indicates a likely ` +
              `credential leak in the submitted bundle.`,
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------ Stage N
  // Convert to the editor-facing ThemeDocument format (Phase N: parseThemeDocument)
  // via the toThemeDocumentV2 adapter and re-validate the document structure.
  //
  // Rationale: toThemeDocumentV2 re-runs parseLiquidThemePackageBundle internally
  // and additionally validates template key charset (validateTemplateKey) and
  // builds the block tree.  parseThemeDocument then enforces the ThemeDocument
  // Zod schema.  Together these catch issues that LiquidThemePackageBundleSchema
  // does not, such as template keys with non-alphanumeric characters or
  // block-nesting depth violations.
  try {
    const doc = toThemeDocumentV2(bundle);
    // parseThemeDocument throws ZodError / UnsupportedThemeDocumentVersionError
    // if the document is structurally invalid.
    parseThemeDocument(doc);
  } catch (err: unknown) {
    blockingViolations.push({
      stage: 'N',
      code: 'N:document-parse-failed',
      message:
        `Theme document structure is invalid: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `The bundle passed bundle-schema validation (Stage K) but fails the ` +
        `ThemeDocument parse used by the editor.  Fix the template structure ` +
        `and resubmit.`,
    });
  }

  // ok=true when no blocking violations exist.
  const ok = blockingViolations.length === 0;

  return {
    ok,
    violations: [...blockingViolations, ...advisoryViolations],
  };
}
