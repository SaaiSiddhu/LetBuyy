# PHASE L1 — BUNDLE PERSISTENCE

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only.

1. **Purpose.** Make a real store ship a schema-valid Liquid bundle so the existing read path renders Liquid (nothing renders Liquid until a bundle is persisted).
2. **Repository Reality.** The only producer of `liquidBundle` is `buildBundleTemplateConfig` (`schema-registry-execution.adapter.ts:164-187`) via theme-package upload. On publish/install, `buildReleaseArtifacts` re-detects it (`theme-execution.adapter.ts:601-607`) and writes `theme_releases.template_snapshot`/`release_manifest` + `sites.template_config`. **If `themes.default_template` carries a bundle, install auto-propagates it.** urban-kicks is seeded React/`theme-engine-v1` (`database/supabase/seeds/urban-kicks-theme.sql`, no bundle).
3. **Current State.** Zero stores carry a `liquidBundle`; read path complete; resolver returns undefined → React.
4. **Target State.** urban-kicks `themes.default_template`+`config` carry a valid `LiquidThemePackageBundle` (layout + 20 sections + `index/product/collection` templates), buildable from `createLiquidParitySectionFiles` (`theme-bundle.ts:769-1156`); a test store renders Liquid when canary is on.
5. **Files To Modify.** `database/supabase/seeds/urban-kicks-theme.sql`.
6. **Files To Create.** Migration `database/supabase/migrations/171_*` (backfill existing stores, if chosen); a build script (e.g. `scripts/liquid-parity/build-urban-kicks-bundle.mjs`) emitting the bundle JSON.
7. **Files To Delete.** None.
8. **Dependencies.** L0.
9. **Validator Impact.** `sequential-migration-validator` (new migration must be tracked — C0 untracked-migration guard applies); `migration-safety-validator`; bundle must satisfy `LiquidThemePackageBundleSchema` (`theme-bundle.ts:429-502`: section-key==file-type, `{% schema %}` required, forbids `<script>`/`{% render %}`/`{% include %}`/`{% layout %}`).
10. **Migration Impact.** Additive: a `171_*` migration if backfilling `sites.template_config`/re-seeding; no column drop. `site_settings`-style JSON only (no new column required — bundle lives in `template_config` JSON).
11. **Testing Requirements.** Test the seeded `default_template` parses as a liquid bundle and `rendererEngine==='liquid'`; install-carries-bundle test asserting `sites.template_config.liquidBundle` after install.
12. **Performance Requirements.** Bundle JSON adds to `template_config` payload read on every store fetch (ISR `revalidate=60`); keep bundle within the renderer's `parseLimit 300000`/`memoryLimit 2_000_000`; verify cached read latency unchanged.
13. **Security Requirements.** Bundle must pass the strict schema (no script/render/include/layout fragments); sanitizer config unchanged.
14. **Tenancy Requirements.** Bundle is per-store data on `sites`/`themes`/`theme_releases` (all RLS ENABLE) — written via the existing tenant-scoped adapters; no new tenancy surface.
15. **Identity Requirements.** N/A — no auth change.
16. **Money Requirements.** N/A — no money path; checkout untouched.
17. **Rollback Plan.** Revert the seed/migration → `resolveLiquidBundle` returns undefined → store renders React. No data loss (additive JSON). Canary stays off so production is unaffected regardless.
18. **Success Criteria.** A canary test store, post-install, has a schema-valid `sites.template_config.liquidBundle`; production default unaffected.
19. **Exit Criteria.** Install-carries-bundle test green; gate green (after human `git add` of the migration); bundle schema-valid.
20. **Evidence Requirements.** The seeded bundle JSON; the passing schema/install tests; a render of the canary store showing structured (if not yet styled) Liquid HTML.
