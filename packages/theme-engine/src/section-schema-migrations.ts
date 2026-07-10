// Phase G / G1+G2 — Section schema migration registry.
//
// The migration ENGINE (`migrateThemeTemplateSchemas` in theme-governance.ts) is generic and complete:
// given a list of `ThemeSectionSchemaMigration`s it walks every stored SectionModel across a template
// config and applies forward-only, idempotent, per-section-type version migrations. Before Phase G it
// was exercised ONLY by unit tests — no production caller ran it, so a future section-schema field
// rename would silently break stored merchant configs.
//
// This module is the single production REGISTRY of real migrations plus the convenience wrapper the
// gateway publish path calls. The honest Phase G verdict (see docs/storefront-liquid-discovery/phase-g):
// there are ZERO real historical field renames to migrate — no production create/save/apply path has
// ever stamped `SectionModel.schemaVersion`, so every stored section is `unversioned`, and no built-in
// section type has undergone a persisted field rename. `REGISTERED_SECTION_SCHEMA_MIGRATIONS` is
// therefore intentionally empty. Its value is structural: the engine now RUNS on every publish, so the
// day a real migration is needed it is added here (with a before/after render-parity test) and stored
// configs are migrated forward automatically — never silently corrupted.

import type { StoreTemplateConfig } from './index';
import {
  migrateThemeTemplateSchemas,
  type ThemeSectionSchemaMigration,
  type ThemeSchemaMigrationResult,
} from './theme-governance';

// The schema version NEW sections should be stamped with. Bump this in lockstep with a registered
// migration whose `toVersion` equals the new value. `unversioned` remains the implicit version of every
// section that predates versioning; migrations from 'unversioned' bring them forward.
export const CURRENT_SECTION_SCHEMA_VERSION = '2026-07-sections-v1';

// The authoritative, ordered list of production section-schema migrations. EMPTY by design (see header).
// Adding an entry is the ONLY sanctioned way to change a persisted section-settings shape: pair it with
// a test proving the pre-migration stored shape renders identically to the post-migration shape.
export const REGISTERED_SECTION_SCHEMA_MIGRATIONS: readonly ThemeSectionSchemaMigration[] = Object.freeze([]);

// Convenience wrapper the gateway publish path (and any future caller) uses so the registry is applied
// consistently. With an empty registry this is a structural no-op that returns the config unchanged with
// `applied: []` — safe to call unconditionally on every publish. It never throws on well-formed input;
// migration authors are responsible for total `migrateSettings` functions.
export function migrateThemeTemplateSchemasWithRegistry(
  templateConfig: StoreTemplateConfig,
): ThemeSchemaMigrationResult {
  return migrateThemeTemplateSchemas({
    templateConfig,
    migrations: [...REGISTERED_SECTION_SCHEMA_MIGRATIONS],
  });
}
