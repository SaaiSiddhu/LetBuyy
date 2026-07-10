// K4 — Theme Publish Manifest Builder
//
// buildThemePublishManifest(bundle) produces a deterministic, self-contained descriptor that
// a future gateway publish route would store in theme_package_versions.release_manifest without
// needing to re-run validation from scratch.
//
// The ThemePublishManifest is a higher-level wrapper over ThemePackageManifest (from the H5
// theme-packager). Both coexist without collision:
//   - ThemePackageManifest (packageThemeBundle) — content-addressed artifact hash; file-level.
//   - ThemePublishManifest (this module) — distributable descriptor; gateway/marketplace level.
//
// GATEWAY OWNERSHIP NOTICE:
//   This function is PURE — no DB writes, no network I/O. Persisting the manifest into
//   theme_packages / theme_package_versions is exclusively the responsibility of the gateway:
//     services/api-gateway/src/execution/schema-registry-execution.adapter.ts (lines 323, 354)
//     services/api-gateway/src/execution/theme-execution.adapter.ts (lines 612, 668-677)
//   Phase K does NOT add any new DB-writing route. The gateway calls this function (or its
//   equivalent) before upserting into theme_package_versions.release_manifest.
//
// Determinism: same bundle input → bit-identical ThemePublishManifest on every call.

import type { LiquidThemePackageBundle } from './theme-bundle';
import { packageThemeBundle, type ThemePackageManifestFile } from './theme-packager';
import { lintThemeBundle } from './theme-linter';
import { validateTheme } from './theme-sdk';

// ---- Types ----

export interface ThemePublishManifest {
  // ---- Identity ----
  /** Canonical theme slug (from bundle.package.slug). */
  slug: string;
  /** Human-readable theme name. */
  name: string;
  /** Theme version string (e.g. '1.0.0', '2026-06'). */
  version: string;
  /** Bundle schema_version epoch (e.g. '2026-06-liquid-sections'). */
  schema_version: string;
  /** The bundle's declared compatibility range (e.g. '>=2026-06-liquid-sections'). */
  compatibility_range: string;

  // ---- Content fingerprint (from packageThemeBundle / ThemePackageManifest) ----
  /** SHA-256 fingerprint over all file checksums — stable cross-deploy identity. */
  contentHash: string;
  /** Per-file metadata: path, SHA-256 checksum, byte size. */
  files: ThemePackageManifestFile[];
  /** path → SHA-256 checksum lookup. */
  checksums: Record<string, string>;

  // ---- Provenance ----
  provenance: {
    /** The renderer engine declared in the bundle (e.g. 'liquid', 'json-contract'). */
    engine: string;
    /** The renderer_version string from the bundle's renderer manifest. */
    renderer_version: string;
  };

  // ---- Summary stats (gateway stores these in theme_package_versions) ----
  /** Number of lint issues found (error + warn combined). 0 = clean. */
  lint_issue_count: number;
  /** True when the bundle passes the Zod schema + G4 schema_version gate. */
  schema_verified: boolean;
  /** Number of Liquid section files in the bundle. */
  section_count: number;
  /** Number of Liquid block files in the bundle. */
  block_count: number;
  /** Total number of exported artifact files (from ThemePackageManifest.files). */
  exported_file_count: number;
}

// ---- Builder ----

/**
 * buildThemePublishManifest produces a deterministic ThemePublishManifest from a
 * LiquidThemePackageBundle. It reuses packageThemeBundle for content-addressed checksums,
 * lintThemeBundle for the lint summary, and validateTheme for the schema_verified flag.
 *
 * Same bundle → identical manifest on every call (no timestamps, no random values).
 */
export function buildThemePublishManifest(bundle: LiquidThemePackageBundle): ThemePublishManifest {
  // Content-addressed artifact manifest (deterministic file hashes).
  const pkg = packageThemeBundle(bundle);

  // Lint summary — count all issues (error + warn).
  const lintIssues = lintThemeBundle(bundle);

  // Schema + G4 gate check.
  const validateResult = validateTheme(bundle);

  return {
    // Identity
    slug: bundle.package.slug,
    name: bundle.package.name,
    version: bundle.package.version,
    schema_version: bundle.schema_version,
    compatibility_range: bundle.package.compatibility_range,

    // Content fingerprint (from H5 packageThemeBundle)
    contentHash: pkg.contentHash,
    files: pkg.files,
    checksums: pkg.checksums,

    // Provenance
    provenance: {
      engine: bundle.renderer.engine,
      renderer_version: bundle.renderer.renderer_version,
    },

    // Summary stats
    lint_issue_count: lintIssues.length,
    schema_verified: validateResult.ok,
    section_count: Object.keys(bundle.sections).length,
    block_count: Object.keys(bundle.blocks).length,
    exported_file_count: pkg.files.length,
  };
}
