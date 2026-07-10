// K1 — Theme Version: pure version comparator for date-based opaque schema version strings.
//
// The compatibility_range field carries strings like '>=2026-06-liquid-sections', NOT SemVer.
// The authoritative ordered epoch list is KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS from theme-bundle.ts.
// A range is satisfied when at least one version in the known list satisfies the constraint.
//
// Supported range operators:
//   '>=' — the version must be at an index >= the minimum version's index.
//   '^'  — same as >= but additionally the version must share the same epoch family (year prefix).
//
// This is a closed pure function set — no new npm dependency, no I/O, no side effects.

import type { LiquidThemePackageBundle } from './theme-bundle';
import { KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS, isKnownLiquidBundleSchemaVersion } from './theme-bundle';

// ---- Range parsing ----

export interface ParsedSchemaRange {
  op: '>=' | '^';
  minVersion: string;
}

/**
 * Parse a range string into an operator + minimum-version pair.
 * Supported forms: '>=X', '^X', or a bare 'X' (treated as '>=X').
 * Returns null when the string is empty or unparseable.
 */
export function parseSchemaRange(range: string): ParsedSchemaRange | null {
  const trimmed = range.trim();
  if (trimmed.startsWith('>=')) {
    const minVersion = trimmed.slice(2).trim();
    return minVersion.length > 0 ? { op: '>=', minVersion } : null;
  }
  if (trimmed.startsWith('^')) {
    const minVersion = trimmed.slice(1).trim();
    return minVersion.length > 0 ? { op: '^', minVersion } : null;
  }
  // Bare version string — treat as >=
  return trimmed.length > 0 ? { op: '>=', minVersion: trimmed } : null;
}

// ---- Epoch-list index lookup ----

/**
 * Return the index of `version` in KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS (the ordered epoch list).
 * Returns -1 when the version is not in the list (unknown / future).
 */
export function schemaVersionIndex(version: string): number {
  return (KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS as readonly string[]).indexOf(version);
}

// ---- Comparison ----

/**
 * Compare two known schema versions by their position in the ordered epoch list.
 *
 * Returns:
 *  -1  — a is older than b (a appears before b in the list)
 *   0  — a and b are the same version
 *   1  — a is newer than b (a appears after b in the list)
 *  null — either version is not in the known list
 */
export function compareSchemaVersions(a: string, b: string): -1 | 0 | 1 | null {
  const ai = schemaVersionIndex(a);
  const bi = schemaVersionIndex(b);
  if (ai === -1 || bi === -1) return null;
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

// ---- Family extraction ----

/**
 * Extract the epoch family prefix from a version string.
 * For date-based version strings like '2026-06-liquid-sections', the family is the year ('2026').
 * For strings without a dash, the full string is returned (no cross-family upgrade allowed).
 */
export function versionFamily(version: string): string {
  const dashIdx = version.indexOf('-');
  // No dash → the full string is the family identifier.
  if (dashIdx === -1) return version;
  // Everything before the first dash is the family prefix.
  // If the string starts with a dash (dashIdx === 0), the prefix is ''.
  return version.slice(0, dashIdx);
}

// ---- Range satisfaction ----

/**
 * Check whether `version` satisfies `range`.
 *
 * - `>=minVersion`: version must appear at an index >= minVersion's index in the known list.
 * - `^minVersion`:  same as >= but version must also share the same epoch family (year prefix).
 *
 * Fail-closed: if either the target version or the range's minimum version is not in the
 * known list, the range is NOT satisfied.
 */
export function satisfiesSchemaRange(version: string, range: string): boolean {
  const parsed = parseSchemaRange(range);
  if (!parsed) return false;

  const targetIdx = schemaVersionIndex(version);
  const minIdx = schemaVersionIndex(parsed.minVersion);

  // Unknown minimum — the bundle requires a version this engine has not registered.
  if (minIdx === -1) return false;
  // Unknown target — this engine does not know this version.
  if (targetIdx === -1) return false;

  if (targetIdx < minIdx) return false;

  if (parsed.op === '^') {
    // Same-family constraint: both versions must share the same year prefix.
    if (versionFamily(version) !== versionFamily(parsed.minVersion)) return false;
  }

  return true;
}

// ---- Bundle compatibility gate ----

/**
 * isThemeBundleSchemaCompatible: returns true when:
 *  1. The bundle's schema_version is in KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS (via the G4 gate).
 *  2. At least one version in KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS satisfies the bundle's
 *     compatibility_range constraint.
 *
 * This is the primary compatibility gate composed by K3 (validateThemeInstall) and K2 (planThemeUpgrade).
 */
export function isThemeBundleSchemaCompatible(bundle: LiquidThemePackageBundle): boolean {
  // Gate 1: schema_version must be known.
  if (!isKnownLiquidBundleSchemaVersion(bundle.schema_version)) return false;

  // Gate 2: at least one engine-known version must satisfy the bundle's compatibility range.
  const range = bundle.package.compatibility_range;
  return (KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS as readonly string[]).some(
    (v) => satisfiesSchemaRange(v, range),
  );
}
