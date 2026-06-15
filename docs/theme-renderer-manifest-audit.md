# `theme_renderer_manifests` Audit — Phase 7

> Mission Phase 7. Audits renderer selection / versioning / bundle references / canary / rollback and documents the rollout process. **Evidence-only.**

## Verdict

`theme_renderer_manifests` is a **publish-time registry table, not wired to runtime selection or rollback**. It has the schema shape to support renderer selection, canary, and performance governance, but the storefront render path never reads it — it uses `release.release_manifest` instead. This duplication is a latent desync risk.

## Schema (`database/supabase/migrations/000_baseline.sql:12885`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `theme_package_version_id` | uuid | FK → `theme_package_versions(id)` **ON DELETE CASCADE**, **UNIQUE** (one manifest per version) |
| `renderer_manifest` | jsonb | the renderer manifest (can carry `liquid*Canary` keys the gate reads) |
| `approved_renderer_keys` | text[] | governance allowlist |
| `asset_manifest` | jsonb | |
| `performance_budget` | jsonb | perf budget per version |
| `created_at` / `updated_at` | timestamptz | trigger `update_theme_renderer_manifests_updated_at` |

**RLS:** enabled; policy `theme_renderer_manifests_public_read` allows `SELECT` only when the linked package version is `release_status = 'published'` and not soft-deleted. No write policy → service-role (gateway) writes only.

## Who uses it

**Only** `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` — `upsert` (`:390`, `:584`) and `select renderer_manifest, approved_renderer_keys, asset_manifest, performance_budget` by `theme_package_version_id` (`:447`). This is the theme-package publish/registry flow. **No `storefront-runtime` / `theme-engine` reference** (LCIS: `reachedByRoutes: []`, `touchedByRpcs: []`).

## Audit matrix

| Capability | In table? | Wired to runtime? |
|-----------|-----------|-------------------|
| renderer selection | `renderer_manifest` jsonb | ⛔ **No** — runtime reads `release.release_manifest` (`store-service.ts:549`), not this table |
| versioning | ✅ per `theme_package_version_id` (unique FK) | n/a — registry grain |
| bundle references | partial — renderer/asset manifest, **not** the `liquidBundle` (that lives in `themes.default_template` / `release_manifest`) | ⛔ |
| canary support | shape present (`renderer_manifest.liquid*Canary` is read by the gate) | ⛔ **No** — gate reads `templateConfig`/`release_manifest`, not the table |
| rollback support | none explicit (only `ON DELETE CASCADE`) | runtime rollback = flip `liquidRenderingCanary` in the release manifest |
| performance_budget | ✅ jsonb column | ⛔ not enforced by the storefront runtime |
| approved_renderer_keys | ✅ allowlist | used by gateway / `auditThemeRendererRegistry`, not by the render path |

## The exact rollout process (as built today)

Runtime engine selection/rollback does **not** use `theme_renderer_manifests`. It uses:

1. **Bundle** — persisted at `themes.default_template.liquidBundle` (migration `172`) and/or the in-code fixture fallback (`store-service.ts:671`).
2. **Per-theme canary flag** — `templateConfig.liquidRenderingCanary`, resolved from `release.release_manifest` by `resolveThemeLiquidRenderingEnabled`.

- **Roll out:** set the canary flag truthy for a theme/store → no deploy.
- **Roll back:** set it `false`/absent → no deploy.

`theme_renderer_manifests` is a separate, currently-disconnected publish-time registry.

## Recommendation

Pick **one** source of truth before scale: (a) wire the runtime to read `theme_renderer_manifests` (renderer manifest + approved keys + perf budget) as the authoritative selection/governance record, or (b) formally designate `release.release_manifest` as the runtime source and scope this table to registry/governance only. Phase 9's `renderer.engine` switch should target whichever is chosen — not add a third representation.
