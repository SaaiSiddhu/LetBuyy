# Phase M — Architecture Decision Records

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Date authored:** 2026-07-10
**Branch:** `stepup/main` · **HEAD:** `8c1ac94b`

These ADRs govern architectural decisions for Phases M→AE. Each record includes a status, reversibility assessment, rationale grounded in actual repository evidence, and (where applicable) a `DEFERRED_NEEDS_HUMAN` marker for decisions that require ARB or business-authority approval before implementation may proceed.

Status key:
- **ACCEPTED** — decision is in effect; future work must follow it
- **PROPOSED** — technically sound proposal; not yet ratified by ARB or scope-owner
- **DEFERRED_NEEDS_HUMAN** — blocked on a business or governance decision outside the scope of this program

---

## ADR-M-001 — Complete the Merchant Theme Editor as React-Only Before Any Liquid Merchant Activation

**Status:** ACCEPTED
**Reversible:** Yes — the React-only constraint applies to the editor preview path; the per-theme Liquid canary gate remains independently wired.

### Decision

Phase N editor work — drag-and-drop section reorder, richtext WYSIWYG, code editor, block move, theme duplication, rollback UI wire-up — targets the React-rendered composition engine only. The global Liquid canary flag `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false`; its flip authority remains with ARB. Editor feature completeness is not gated on the Liquid activation decision.

### Rationale

`packages/theme-engine/src/theme-governance.ts:14` — `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`. `theme-governance.ts:16-21` — `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` has `status='deferred'`, `authority='ARB'`; the reason cites render-parity, security (SSTI/XSS), and performance evidence required before a global flip.

The editor page (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`, approximately 1930 lines) renders the preview via an iframe pointing at the React composition engine in `storefront-runtime`. Known editor gaps — the `GripVertical` drag icon has no event handlers (no `dnd-kit` in `package.json`), `SchemaFormRenderer.tsx:59-62` richtext falls through to a plain `<textarea>`, Monaco/CodeMirror is absent from `package.json`, the rollback route at `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` exists but is NOT_CONNECTED to the editor UI (grep for `rollback` in `editor/page.tsx` returns zero matches) — none of these gaps require touching the Liquid path.

Per-theme canary override via `releaseManifest.renderer_engine='liquid'` in `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:235-308` remains independently wired so individual themes can opt in without a global flip. Separating editor completeness from the Liquid authority decision keeps the ARB gate clean and delivers merchant value sooner.

---

## ADR-M-002 — Extend ThemePackageBundleSchema with a New schema_version Rather Than Creating a Parallel Theme Document Type

**Status:** ACCEPTED
**Reversible:** Yes — a future parallel type can always be introduced; the extension point is additive.

### Decision

Theme Document V2 is implemented as an increment to `THEME_BUNDLE_SCHEMA_VERSION` (currently `'2026-05-json-contract'` at `packages/theme-engine/src/theme-bundle.ts:3`) and a corresponding addition to the `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` allowlist. No parallel `ThemeDocumentV2` type, no alternative Zod root, and no new DB persistence column is introduced. All V2 fields must be optional or carry backward-compatible defaults so that existing `theme_releases` rows remain parseable.

### Rationale

`packages/theme-engine/src/theme-bundle.ts:388` — `ThemePackageBundleSchema` is the single Zod root for JSON-contract bundles; `theme-bundle.ts:484` — `LiquidThemePackageBundleSchema` extends the same metadata schema. `theme-bundle.ts:14` — `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` is the engine allowlist gate; adding the new version string there is the natural extension point.

`database/supabase/migrations/000_baseline.sql:12856` — `theme_releases.release_config JSONB` stores the serialised bundle. All existing published releases carry `schema_version='2026-05-json-contract'`. A parallel `ThemeDocumentV2` root would require a migration of all `theme_releases.release_config` rows and a fork of `validateThemeInstall()`, `lintThemeBundle()`, `planThemeUpgrade()`, and `compilePortableToLiquidBundle()` — at least five modules.

The existing `strict()` Zod validator already raises `ZodIssueCode.custom` on unknown fields, making extension fields unambiguous. `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` + `isKnownLiquidBundleSchemaVersion()` (`theme-bundle.ts:32`) implement a versioned extension gate with fail-closed behaviour (`UnsupportedLiquidBundleSchemaVersionError`). The existing machinery is the right extension point.

---

## ADR-M-003 — Liquid + JSON-Contract Bundle Is Canonical Source; TS Fixture in theme-bundle-core.ts Is a Generated Artifact

**Status:** PROPOSED (not ACCEPTED — migrating the store-creation path requires ARB scope alignment per CLAUDE.md)
**Reversible:** Yes — the TS-fixture shortcut can be reintroduced in a future phase if needed.

### Decision

For Liquid-path themes: the on-disk Liquid bundle (`sections/*.liquid` + `config/settings_schema.json` + `config/settings_data.json` + `templates/*.json` per `LIQUID_THEME_BUNDLE_PATHS`) is canonical source. For JSON-contract themes: the `ThemePackageBundleSchema`-validated JSON is canonical. The TypeScript fixture in `packages/theme-engine/src/theme-bundle-core.ts` is a build-time artifact generated from these canonical sources via `compilePortableToLiquidBundle()` and the section parity files. No TypeScript object is accepted as a substitute for an on-disk validated bundle at publish time.

### Rationale

`packages/theme-engine/src/theme-bundle.ts:48` — `LIQUID_THEME_BUNDLE_PATHS` mirrors Shopify's on-disk layout. `theme-bundle.ts:822` — `createLiquidParitySectionFiles()` generates 22 `.liquid` section files programmatically from a deterministic pipeline. `packages/theme-engine/src/theme-bundle-core.ts:20-22` — comment explicitly defers "switching the live compile/store-creation paths to the Core fixture...are the documented, deferred follow-ups", acknowledging the fixture is not yet the source. `packages/theme-engine/src/theme-artifact-exporter.ts` exports `.liquid` files as build artifacts, confirming the export direction is TS→Liquid not Liquid→TS. `packages/theme-engine/src/theme-packager.ts` computes SHA-256 `contentHash` over the bundle JSON — the hash is over the validated artifact, not over TS code.

Marked PROPOSED because migrating the `create-store` path in `services/api-gateway` away from the TS-fixture shortcut requires ARB scope alignment per CLAUDE.md: new API routes require route-ownership lockstep review.

---

## ADR-M-004 — Use Existing theme_instance_drafts for All Working-Draft State; Add Named Checkpoints as a JSONB Column Rather Than a New Revisions Table

**Status:** PROPOSED
**Reversible:** Yes — a proper `theme_draft_revisions` table migration can be added in Phase AE if checkpoint history grows beyond the JSONB column capacity.

### Decision

The working draft for a theme editor session lives in `theme_instance_drafts.working_manifest` (JSONB). Revision history is added as a `named_checkpoints` JSONB column (array of `{label: string, manifest: JSONB, saved_at: timestamptz}`) on `theme_instance_drafts`. No new `theme_draft_revisions` table is introduced. Published history lives in the existing immutable `theme_releases` spine. The draft's base snapshot pointer is `theme_instance_drafts.base_release_id`, already present in `000_baseline.sql:12641`.

### Rationale

`database/supabase/migrations/000_baseline.sql:12637` — `theme_instance_drafts` has `working_manifest JSONB`, `base_release_id UUID`, `draft_version integer`, `draft_status CHECK ('active'/'archived'/'published'/'discarded')`, `locked_by`, `locked_at`, `auto_saved_at`. `000_baseline.sql:18882` — `UNIQUE INDEX idx_theme_instance_drafts_one_active ON theme_instance_drafts(theme_instance_id) WHERE draft_status='active' AND deleted_at IS NULL` enforces exactly one active draft per theme instance, which is already the correct cardinality for a single working context.

`000_baseline.sql:12849` — `theme_releases` already provides the immutable published spine (`release_version`, `is_current`, `release_status`, `rollback_of_release_id`). A new revisions table would require a new FK to `theme_instance_drafts`, new RLS policies (following the `000_baseline.sql:27652` pattern), and a new gateway route. The JSONB checkpoints column is additive, migration-safe (NULL for existing rows = no checkpoints), and avoids a third persistence layer. `draft_status='archived'` already semantically handles discarded drafts.

---

## ADR-M-005 — Cap Block Nesting at Depth 2 and 50 Block Instances Per Section; Benchmark Required Before Raising Limits

**Status:** PROPOSED
**Reversible:** Yes — fully reversible by incrementing the allowed max in a future `schema_version`.

### Decision

Enforce: (a) no block-within-block nesting (depth limit = 2: section is depth 1, block instances are depth 2); (b) maximum 50 block instances per section in `ThemeBundleTemplateSectionSchema` (`block_order` array `max(50)`); (c) the existing `ThemeLiquidSectionSchema.blocks` `max(100)` is tightened to `max(50)` for new bundles via a `schema_version` bump. Current in-flight bundles with more than 50 blocks receive a `lint-warn` at install time (non-blocking). A Lighthouse render benchmark on the composition engine must pass before the limit is raised above 50.

### Rationale

`packages/theme-engine/src/theme-bundle.ts:208` — `ThemeLiquidSectionSchema.blocks z.array(...).max(100)`. `theme-bundle.ts:295` — `ThemeBundleTemplateSectionSchema.blocks` is a `z.record()` with no explicit cardinality cap, meaning `block_order` could grow unboundedly in practice. `theme-bundle.ts:296` — `block_order` array has no `max`.

`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — the block list renders synchronously in a single pass with no virtualisation. `THEME_LIQUID_PORTABLE_SECTION_PARITY` (`theme-governance.ts:23-44`) lists no section type with nested block groups; the Liquid renderer in `composition-engine.tsx` has no recursive block hydration loop.

Depth cap at 2 matches Shopify Online Store 2.0 architecture (sections contain blocks; blocks do not contain blocks). The limit is enforced by a new Zod `.superRefine()` on `ThemeBundleTemplateSectionSchema` and a new lint rule in `theme-linter.ts` (error level above 50, warn between 50–100).

---

## ADR-M-006 — Bind Dynamic Section Content to Existing Domain Tables via Gateway Routes; Defer Metafield/Metaobject Registry to Phase AE

**Status:** ACCEPTED
**Reversible:** Yes — the metafield layer is purely additive over the existing domain binding pattern.

### Decision

Dynamic data for theme sections (product, collection, blog post, page, customer) is resolved from existing domain tables via the existing `api-gateway` domain routes, using the pattern already established in `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts`. No metafield definition table, metaobject type registry, or per-resource structured-content column is added before Phase AE. Any AE-scope metafield system requires an ARB migration approval.

### Rationale

`apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:66-106` — `buildSectionDataPlan()` resolves product data for `PRODUCT_SECTION_TYPES` via `ProductService`; this pattern is directly reusable for collection, blog, and page bindings.

Parity matrix confirms "Metafields / metaobjects equivalent" is MISSING: no metafield definition system, metaobject type registry, or per-resource structured content columns in `000_baseline.sql`; no gateway route for metafield reads in `services/api-gateway/src/routes/themes.ts` or `routes/storefront/`.

CLAUDE.md operational rules require ARB approval for new app API routes with route-ownership lockstep and schema changes. Adding metafields requires new DB tables, new RLS policies (forced per CLAUDE.md), new gateway routes, and Liquid drop injection — all ARB gates. Deferral is reversible because the metafield layer is purely additive over the existing domain binding pattern.

---

## ADR-M-007 — Gateway-Proxied Supabase Storage Is the Sole Media Upload Path; No media-service Before Human Approval

**Status:** ACCEPTED
**Reversible:** Yes — a future media-service microservice can replace the storage backend without changing the gateway API surface.

### Decision

Image uploads for theme sections flow through `apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts`, which proxies to Supabase storage. The `api-gateway` resolves CDN URLs for published theme artifacts via `themes.ts:852` download route. `services/media-service` remains an empty reserved placeholder. No browseable media library UI, no CDN-backed asset browser modal, and no separate media microservice is introduced until a human-approved scope earns it per CLAUDE.md reserved-service policy.

### Rationale

CLAUDE.md canonical runtime map — `services/media-service` listed as "(reserved, not implemented)". `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx:268` — image upload to `/api/stores/${storeName}/upload` (per-field, no library modal). `apps/merchant-control-plane/src/app/api/stores/[store]/upload/route.ts:21-36` — file upload to Supabase storage (`filename`, `mime_type`, `size_bytes` captured). `services/api-gateway/src/execution/theme-execution.adapter.ts:913` — `storage_provider='local_object_store'` returned for artifact downloads. `services/api-gateway/src/routes/themes.ts:852-910` — signed URL resolution for theme artifacts.

A `media-service` microservice would require a new auth boundary (gateway must proxy into it), `site_id` isolation enforcement, new RLS policies, and new deployment topology — all ARB gates per CLAUDE.md. The existing route + bucket is already live and wired. A future browseable panel can be built as a UI-only page over the existing bucket-list API without a new service.

---

## ADR-M-008 — No Third-Party App-Extension Sandbox While app-marketplace Is Frozen; appBlockSlot Stays as a Compile-Time Contract Stub

**Status:** DEFERRED_NEEDS_HUMAN — blocked on ARB marketplace-unfreeze decision
**Reversible:** Yes — the stub infrastructure (section type + Liquid file) is additive; enabling it requires only a security architecture review and the ARB unfreeze.

### Decision

The `appBlockSlot` section type (position 20 of `BUILT_IN_SECTION_TYPES` in `built-in-section-schemas.ts`) and its Liquid section file (created by `createLiquidParitySectionFiles` in `theme-bundle.ts`) remain as compile-time schema contract stubs. No iframe sandbox, no third-party block registration API, no developer submission endpoint is opened for production traffic. Any sandbox specification or partner-facing extension API is WAITING_AUTHORITY on an ARB marketplace-unfreeze decision.

### Rationale

`apps/app-marketplace/runtime.manifest.json:9` — `runtimeCategory='frozen-next-app'`; `:49` — `deploymentAuthority.platform='frozen-not-deployed'`. CLAUDE.md — "app-marketplace and theme-marketplace frozen pending consolidation". `packages/theme-engine/src/built-in-section-schemas.ts:20` — `'appBlockSlot'` is position 20 in `BUILT_IN_SECTION_TYPES`. `packages/theme-engine/src/theme-bundle.ts:822` — `app-block-slot` Liquid section file is generated as a stub. `packages/theme-engine/src/theme-renderer.ts:202` — `FORBID_ATTR=['style']` and the full DOMPurify FORBID list blocks any script injection via Liquid.

`database/supabase/migrations/000_baseline.sql:9747` — `marketplace_review_records` table present with `submission_type CHECK ('app'/'theme')`. `services/api-gateway/src/routes/app-store/developer-routes.ts:507` — developer app submission pipeline is code-present but not exposed to a deployed UX. An iframe sandbox for extension blocks requires a security architecture review (CSP, `postMessage` origin validation — already identified as MISSING in all three inbound handlers per parity matrix), which is ARB scope.

---

## ADR-M-009 — Market Content Overrides Use Delta Rows in theme_template_assignments; Never Copy the Full Template Config Per Market

**Status:** PROPOSED
**Reversible:** Yes — falling back to per-market duplication is additive; the delta-row design is a strict subset.

### Decision

Per-market content variation is stored as a delta row in the existing `theme_template_assignments` table (`000_baseline.sql:12964`) with `market` (default `'default'`) and `locale` (default `'default'`) discriminators. The storefront template resolver reads the market-specific delta row and merges it over the default-market row at render time. The full `working_manifest` in `theme_instance_drafts` is always market-agnostic; market-specific overrides live only in `theme_template_assignments.metadata JSONB` as a JSON Merge Patch (RFC 7396). No per-market duplication of `theme_instance_drafts` or `theme_releases` rows is allowed.

### Rationale

`000_baseline.sql:12964-12980` — `theme_template_assignments` has `store_id`, `theme_instance_id`, `route_type`, `route_key`, `template_key`, `resource_id`, `market DEFAULT 'default'`, `locale DEFAULT 'default'`, `is_active`, `assigned_release_id`, `priority`, `metadata JSONB`. `000_baseline.sql:16319` — `UNIQUE(store_id, route_type, route_key, market, locale, is_active)` confirms the table was designed for multi-market per-route assignment. `000_baseline.sql:19075` — INDEX on `(store_id, route_type, route_key, priority)` confirms the resolver's lookup pattern.

The delta-not-copy rule prevents: (a) per-market duplication of multi-kilobyte `working_manifest` JSONB blobs, (b) divergent publish pipelines per market, (c) RLS policy combinatorial explosion. RFC 7396 JSON Merge Patch is additive and reversible by removing the delta row. The storefront resolver is NOT_CONNECTED to this table today; wiring it is an additive step.

---

## ADR-M-010 — Theme Update Merge Is a Structured Three-Way Diff over (base_release, working_manifest, new_bundle_defaults); Conflicts Surface as Resolvable Warnings

**Status:** PROPOSED
**Reversible:** Yes — falling back to last-writer-wins is a one-line change in `buildTemplateScopedInstanceDraftConfig`.

### Decision

When a merchant triggers a theme package upgrade, the update algorithm computes: `base` = `theme_releases.template_snapshot` at `theme_instance_drafts.base_release_id`; `ours` = `theme_instance_drafts.working_manifest`; `theirs` = the new bundle's compiled default template config. A key-level three-way diff is applied: keys unchanged from `base` in both `ours` and `theirs` take the `theirs` value (forward-migration); keys changed from `base` in `ours` only keep our value; keys changed from `base` in both `ours` and `theirs` with different values emit a conflict warning in `ThemeUpgradePlan.warnings[]`. Conflicts do not block the merge; they require explicit merchant resolution in the editor. The pure `planThemeUpgrade()` function in `theme-upgrade.ts` is extended with this logic; no new DB tables are required.

### Rationale

`000_baseline.sql:12641` — `theme_instance_drafts.base_release_id UUID` — explicitly designed as the base snapshot pointer. `000_baseline.sql:12870` — `theme_releases.template_snapshot JSONB` — the immutable published snapshot. `packages/theme-engine/src/theme-upgrade.ts:29-46` — `ThemeUpgradePlan` already has `schemaMigrations`, `settingsCarryover`, `sectionAdds`, `sectionRemoves`, `compatible`, `warnings[]` — the `warnings[]` slot is the correct surface for conflict reporting. `theme-upgrade.ts:1-19` comments confirm the planner is "pure, side-effect-free"; it composes existing primitives without DB writes.

`services/api-gateway/src/execution/theme-execution.adapter.ts:1051-1084` — `buildTemplateScopedInstanceDraftConfig()` performs a shallow last-writer-wins merge of draft config; a three-way diff replaces this in the upgrade path only, not the save path. The design is reversible: falling back to last-writer-wins is one line change. No DB schema changes are required because `base_release_id` and `template_snapshot` are already present.

---

## ADR-M-011 — AI-Assisted Edits Flow as a Typed ThemeAiChangePlan Struct; LLM Provider Call Lives in api-gateway Only; packages/theme-engine Remains Provider-Agnostic

**Status:** PROPOSED
**Reversible:** Yes — the plan struct is gateway-only; theme-engine already operates without any provider import.

### Decision

AI-assisted merchant edits are represented as a typed `ThemeAiChangePlan` (array of `{operation: 'set_setting'|'add_section'|'reorder_sections'|'apply_palette'|'set_block_setting', target: string, value: unknown}`). The gateway route `POST /v1/theme-ai/parse-brief` (does not yet exist) owns the NL→`ThemeAiChangePlan` LLM call using `THEME_AI_PROVIDER_API_KEY` (provider TBD: OpenAI, Anthropic, or Gemini). `packages/theme-engine` receives only the typed plan and executes it deterministically via the existing AI SDK primitives. No LLM SDK import, no provider credential, and no HTTP call is ever added to any file in `packages/theme-engine/`.

### Rationale

`packages/theme-engine/src/theme-ai-sdk.ts:919-933` — `MODEL_BOUNDARY = { status: 'NOT_CONNECTED', envVar: 'THEME_AI_PROVIDER_API_KEY', gatewayRoute: 'POST /v1/theme-ai/parse-brief (does not exist)' }`. `theme-ai-sdk.ts:892-918` — three NOT-CONNECTED seams documented: NL brief→`ThemeBrief`, NL colour mood→seed hex, NL section intent→`SectionGoal[]`. `packages/theme-engine/src/ai-theme-generator.ts:6` — "No LLM or AI generation provider is called anywhere in this module." `ai-theme-generator.ts:11-15` — "The env var that would be needed is `THEME_AI_PROVIDER_API_KEY` (provider TBD: OpenAI, Anthropic, Gemini) via a dedicated route in `services/api-gateway` that calls the model and returns the structured brief. That route does not exist."

The existing deterministic chain (`generateColorSystem` WCAG-AA, `generateTypographyPairing`, `generateSectionLayout`) in `packages/theme-engine` already handles the `ThemeBrief`→bundle leg. The typed plan approach: (a) is testable without a live LLM; (b) keeps the theme-engine edge-deployable and provider-agnostic; (c) makes the gateway the single trust boundary for outbound AI calls, consistent with CLAUDE.md gateway-proxy rule; (d) is reversible because the plan struct is a gateway-only addition.

---

## ADR-M-012 — Marketplace Review Pipeline Stays in Code; Merchant-Facing Discovery/Purchase UX Stays WAITING_AUTHORITY on ARB Marketplace Unfreeze

**Status:** DEFERRED_NEEDS_HUMAN — blocked on ARB marketplace-unfreeze decision, pricing-model decision, and partner-revenue-sharing governance
**Reversible:** Yes — unfreezing is an ARB decision and a deployment topology change, not a code rewrite.

### Decision

The existing marketplace review pipeline — `marketplace_review_records` table (`000_baseline.sql:9747`), `createMarketplaceReviewRecord()` function, `operations/marketplace-reviews.ts` state machine — continues to be exercised for first-party theme uploads (the `themes.ts:656` call site) and first-party app submissions. No new partner-facing submission entrypoints, no merchant browse/purchase UX, and no changes to the `app-marketplace` or `theme-marketplace` frozen runtime status are introduced. Any merchant-facing theme store or third-party partner program requires an explicit ARB decision that unfreezes the marketplace and scopes the governance model.

### Rationale

`apps/app-marketplace/runtime.manifest.json:9` — `runtimeCategory='frozen-next-app'`; `:49-51` — `deploymentAuthority.platform='frozen-not-deployed'`. CLAUDE.md — "app-marketplace, developer-portal, theme-marketplace and platform-operations-portal are frozen or pending consolidation, not production deploy targets."

`000_baseline.sql:9747` — `marketplace_review_records` with `status CHECK ('pending'/'in_review'/'approved'/'rejected'/'changes_requested')` and `submission_type CHECK ('app'/'theme')` — schema is present and functional. `services/api-gateway/src/routes/themes.ts:656` — `createMarketplaceReviewRecord()` is called today for first-party theme uploads — the review pipeline is actively used for internal governance. `services/api-gateway/src/routes/operations/marketplace-reviews.ts` — `themePackageStatusForDecision()` and `themeVersionStatusForDecision()` advance package status through the state machine for first-party approvals. `services/api-gateway/src/routes/app-store/developer-routes.ts:507` — partner submission route exists but the frozen `app-marketplace` is not deployed.

The DEFERRED_NEEDS_HUMAN status is warranted because: pricing model (`theme_packages.pricing_type CHECK` — free/paid/subscription), partner revenue sharing, storefront trust boundary for third-party code, and review SLA governance are business decisions, not technical ones. The code-present contracts (table schema, review state machine) are fully reversible: unfreezing is an ARB decision and a deployment topology change, not a code rewrite.

---

## ADR Index

| ID | Title | Status |
|----|-------|--------|
| ADR-M-001 | Complete merchant editor as React-only before any Liquid merchant activation | ACCEPTED |
| ADR-M-002 | Extend ThemePackageBundleSchema with new schema_version; no parallel type | ACCEPTED |
| ADR-M-003 | Liquid + JSON-contract bundle is canonical source; TS fixture is generated artifact | PROPOSED |
| ADR-M-004 | Use existing theme_instance_drafts; named checkpoints as JSONB column | PROPOSED |
| ADR-M-005 | Cap block nesting at depth 2 and 50 instances per section | PROPOSED |
| ADR-M-006 | Bind dynamic content to existing domain tables; defer metafields to Phase AE | ACCEPTED |
| ADR-M-007 | Gateway-proxied Supabase storage is sole media upload path; no media-service yet | ACCEPTED |
| ADR-M-008 | No third-party app-extension sandbox while app-marketplace is frozen | DEFERRED_NEEDS_HUMAN |
| ADR-M-009 | Market content overrides use delta rows; never copy full template config per market | PROPOSED |
| ADR-M-010 | Theme update merge is a structured three-way diff; conflicts surface as warnings | PROPOSED |
| ADR-M-011 | AI-assisted edits flow as typed ThemeAiChangePlan; LLM call lives in gateway only | PROPOSED |
| ADR-M-012 | Marketplace review pipeline stays in code; merchant UX stays WAITING_AUTHORITY | DEFERRED_NEEDS_HUMAN |
