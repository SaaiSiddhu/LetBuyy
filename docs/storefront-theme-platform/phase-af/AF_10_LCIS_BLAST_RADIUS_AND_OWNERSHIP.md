# AF_10: LCIS Blast-Radius & Ownership Evidence

**Workstream:** AF-J — LCIS blast-radius & ownership evidence
**Status:** STALE (graph) / VERIFIED_CURRENT (git-grep fallback)
**Date of audit:** 2026-07-17
**Auditor:** AF.0 read-only discovery agent (claude-sonnet-4-6)
**Branch/HEAD:** stepup/main @ 7e1441a6

---

## 1. LCIS Graph Availability & Freshness

### 1.1 Graph files present

| File | Last-modified | Size | Method |
|------|--------------|------|--------|
| `graphify-out/graph.json` | 2026-06-14 00:23 | 52 246 nodes / 66 761 links | `ls -la` |
| `graphify-out/db-intel.json` | 2026-06-15 16:10 | 417 tables / 164 RPCs / 658 policies | `ls -la` |
| `graphify-out/domain-intel.json` | 2026-06-15 16:10 | 22 domains; generatedAt=2026-06-15T10:40:05Z | parsed |
| `graphify-out/infra-intel.json` | 2026-06-14 11:23 | 26 CODEOWNERS entries | parsed |
| `graphify-out/manifest.json` | 2026-06-14 00:23 | per-file mtimes | parsed |

All graphify-out JSON files were generated at or before 2026-06-15. Today is 2026-07-17; they are **27–33 days stale**.

### 1.2 Built-at commit vs HEAD

```
graph.json built_at_commit : 0db025a6  (2026-06-14T00:00:09+0530)
HEAD at time of audit      : 7e1441a6  (2026-07-11T12:42:54+0530)
Commits since graph build  : 58  (verified: git log --oneline 0db025a6..HEAD | wc -l)
```

The 58 commits since the graph build include Phases B–AE of the Liquid transformation program — every theme-engine feature, migration 188–191, the marketplace gate, AI customization proxy, and the RLS closure on `theme_purchases`. These are precisely the symbols this workstream must audit. LCIS graph results for those symbols are HISTORICAL_ONLY; git-grep provides VERIFIED_CURRENT data for them.

### 1.3 LCIS server

```
curl -s --connect-timeout 2 http://localhost:3333/api/blast?q=getSupabaseAdmin → (empty / no response)
```

**LCIS graph server is NOT RUNNING** on port 3333. No live queries possible.

### 1.4 graphify CLI

```
which graphify → /Users/saai_sidd/.local/bin/graphify
uv tool list   → graphifyy v0.8.39 (graphify, graphify-mcp)
```

CLI installed. Commands `graphify explain` and `graphify path` are **read-only** (no filesystem writes, confirmed by reading source). Used below for symbol lookups over the stale graph.

`graphify update .` writes/rewrites `graphify-out/graph.json` — **NOT run** per AF.0 prohibition on mutation side-effects.

### 1.5 validate-governance.mjs side-effect assessment

Read `scripts/validate-governance.mjs` (line 179). When the `stale-artifact-validator.mjs` validator runs, it calls `fs.rmSync` on any directory named `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods` found under `apps/`, `packages/`, `services/`. These are generated/gitignored artifact directories. **Assessment: PENDING — not run**. Rationale: while the targets are normally gitignored build outputs, removing `.next/` or `dist/` directories has operational impact (breaks local dev server restarts) and the read-only AF.0 prohibition covers working-tree mutations. A human operator should run this validator before merge.

### 1.6 Git status delta

Pre-operations check: `git status --porcelain | wc -l → 378`
Post-operations check: `git status --porcelain | wc -l → 378`

**Zero delta. All operations in this audit were read-only.**

---

## 2. Query Methodology

For each target symbol, both methods are reported where available:

| Method | Applies when | Freshness label |
|--------|-------------|-----------------|
| `node tools/graph-server/intelligence.mjs blast/consumers/rpc/table` | LCIS graph stale but symbol existed before 0db025a6 | HISTORICAL_ONLY |
| `graphify explain <symbol>` | same | HISTORICAL_ONLY |
| `git grep -r "..." --include="*.ts" -l` (no node_modules/.next) | all symbols, current tree | VERIFIED_CURRENT |
| file read on migration SQL / TS routes | all symbols | VERIFIED_CURRENT |

All LCIS blast/consumer counts below that are HISTORICAL_ONLY reflect the codebase state at commit 0db025a6 (2026-06-14). All git-grep counts reflect HEAD 7e1441a6 (2026-07-11).

---

## 3. Ownership — All Symbols

**Single-owner project.** CODEOWNERS (`/Users/saai_sidd/Git/Letbuyy_Store/.github/CODEOWNERS`):

```
* @saai-sidd                          ← wildcard catch-all
/services/   @saai-sidd
/packages/   @saai-sidd
/database/   @saai-sidd
/apps/storefront-runtime/   @saai-sidd
/apps/merchant-control-plane/   @saai-sidd
/apps/identity-platform/   @saai-sidd
/apps/theme-marketplace/   @saai-sidd
/scripts/validators/   @saai-sidd
```

No dedicated GitHub team grants exist; no path escapes the wildcard. Every symbol in this audit is owned by `@saai-sidd`. CODEOWNERS was read at `/Users/saai_sidd/Git/Letbuyy_Store/.github/CODEOWNERS` (VERIFIED_CURRENT; file is tracked in git per CODEOWNERS own wildcard rule).

Domain-level ownership from LCIS `domain-intel.json` (HISTORICAL_ONLY, 2026-06-15):

```json
themes domain: owners: ["@saai-sidd"]
```

---

## 4. Symbol-level Blast Radius & Consumer Evidence

### 4.1 `getSupabaseAdmin()`

**Source:** `services/api-gateway/src/lib/supabase.ts:L17`
**Ownership:** @saai-sidd (`/services/` rule)

| Metric | LCIS value (HISTORICAL_ONLY, commit 0db025a6) | Current git-grep (VERIFIED_CURRENT) |
|--------|----------------------------------------------|--------------------------------------|
| Degree (edges) | 170 | — |
| Blast: impacted nodes | 197 (3 layers: 169 → 26 → 2) | — |
| Blast: impacted files | 115 | — |
| Direct importers (`.ts` files) | (not separated by method) | **120 files** |
| Community | 52 | — |

**Query:** `git grep -r "getSupabaseAdmin" --include="*.ts" -l | grep -v node_modules | wc -l → 120`

The 5-file gap vs the LCIS 115 count is accounted for by files added in the 58 post-build commits (LCIS packages, theme AI routes, auxiliary gateway routes).

**Top LCIS-identified consumers (HISTORICAL_ONLY):**

```
services/api-gateway/src/index.ts                        degree=209
services/api-gateway/src/routes/storefront.ts            degree=124
services/api-gateway/src/lib/supabase.ts                 degree=118
services/api-gateway/src/routes/app-store/shared.ts      degree=84
services/api-gateway/src/routes/customers.ts             degree=82
```

**Stop/Go relevance:** Any change to `getSupabaseAdmin` (signature, import, or singleton pattern) propagates to at least 120 files across the entire gateway. This is the highest single-function blast radius in the services layer. AF.0 prohibition on modification applies.

---

### 4.2 `@letbuyy/shared-types`

**Source:** `packages/shared-types/src/index.ts`
**Ownership:** @saai-sidd (`/packages/` rule)

| Metric | LCIS (HISTORICAL_ONLY) | Current git-grep (VERIFIED_CURRENT) |
|--------|------------------------|--------------------------------------|
| Degree | **806** (highest in graph) | — |
| Blast: impacted nodes | 0 | — |
| Blast: impacted files | 0 | — |
| Files importing `@letbuyy/shared-types` | — | **154 files** |

**Note on LCIS blast=0:** `findBlastRadius` in `intelligence.mjs` traverses **incoming** edges (who imports this node). The graph resolves `@letbuyy/shared-types` to its entry-point node `packages/shared-types/src/index.ts` which has degree=806 outgoing edges (it is itself a large barrel file), but consumers of the package import specific symbols — the graph records those edges ON the symbol nodes, not as incoming edges TO the entry node. Result: LCIS cannot measure shared-types blast radius via the `blast` query. The **154 git-grep files** are the reliable consumer count.

**Consumer breakdown (VERIFIED_CURRENT):**

```
packages/               ~6 packages (billing-core, payments, api-client, auth-core, cms-core, etc.)
apps/app-marketplace/   8 files
apps/merchant-control-plane/ (via imports)
apps/storefront-runtime/ (via theme-engine which re-exports shared-types)
services/api-gateway/   (via stores-localization.ts importing StoreLocalizationSummary etc.)
tests/ + docs/archive/  small count
```

**Stop/Go relevance:** Breaking change to any export in shared-types propagates to 154+ files across all runtimes. Schema/type changes here are an ARB-gate item.

---

### 4.3 `@letbuyy/theme-engine`

**Source:** `packages/theme-engine/src/index.ts`
**Ownership:** @saai-sidd (`/packages/` rule)

| Metric | LCIS (HISTORICAL_ONLY) | Current git-grep (VERIFIED_CURRENT) |
|--------|------------------------|--------------------------------------|
| Degree | 119 | — |
| Blast: impacted nodes | 0 | — |
| Consumers (graph) | 1 (self-referential) | — |
| Files importing `@letbuyy/theme-engine` | — | **68 files** |

Same LCIS limitation as shared-types (package barrel, blast=0 by graph direction).

**Consumer breakdown (VERIFIED_CURRENT, by location):**

```
apps/storefront-runtime/src/components/sections/   ~17 section components
apps/storefront-runtime/src/lib/theme-engine/       5 engine adapters
apps/storefront-runtime/src/app/                    2 pages (preview, layout)
apps/storefront-runtime/src/lib/                    2 lib files
apps/merchant-control-plane/src/components/theme-editor/ ~4 panel components
apps/merchant-control-plane/src/lib/                1 file
apps/merchant-control-plane/src/app/api/themes/     1 settings route
apps/theme-marketplace/                             ~13 files (FROZEN app — import is in frozen code)
packages/tenant-core/src/index.ts
packages/typescript/api-types/src/                  2 files
services/api-gateway/src/execution/                 2 adapters
services/api-gateway/src/routes/                    3 files
tests/e2e/federation/                               1 spec
docs/archive/dead-code/                             1 file (archive)
```

**Stop/Go relevance:** 68 files span storefront-runtime (critical production path), merchant-control-plane, gateway, and the frozen theme-marketplace. Any breaking change to theme-engine exports requires coordination across at least 3 live runtimes plus frozen apps (which are import-only, not deploy targets but still build-time consumers).

---

### 4.4 `parseLiquidThemePackageBundle()`

**Source:** `packages/theme-engine/src/theme-bundle.ts:L1282`
**Ownership:** @saai-sidd (`/packages/` rule)

| Metric | LCIS (HISTORICAL_ONLY) | Current git-grep (VERIFIED_CURRENT) |
|--------|------------------------|--------------------------------------|
| Degree | 9 | — |
| Blast: impacted nodes | 40 | — |
| Blast: impacted files | 20 | — |
| Files referencing symbol | — | **27 files** |

**Consumer breakdown (VERIFIED_CURRENT):**

```
packages/theme-engine/src/  12 source files (bundle, renderer, AI files, SDK, linter, doc-migrations, etc.)
packages/theme-engine/test/ 9 test files
services/api-gateway/src/execution/theme-execution.adapter.ts
services/api-gateway/src/routes/themes/theme-update-route.ts
scripts/liquid-parity/build-urban-kicks-bundle.mjs
tests/launch/lb-l-ai-theme-platform.test.mjs
tests/launch/lb-liquid-l3-compiler.test.mjs
```

Gap vs LCIS 20: AI-related files and new tests were added in the 58 post-build commits.

**Stop/Go relevance:** This function is the entry point for parsing all Liquid theme packages. Changes propagate to the gateway's theme update path, test harness, and all internal theme-engine consumers. Signature changes require coordinated updates.

---

### 4.5 `ThemeRendererInput`

**Source:** `packages/theme-engine/src/theme-renderer.ts:L81`
**Ownership:** @saai-sidd (`/packages/` rule)

| Metric | LCIS (HISTORICAL_ONLY) | Current git-grep (VERIFIED_CURRENT) |
|--------|------------------------|--------------------------------------|
| Degree | 5 | — |
| Blast: impacted nodes | 3 | — |
| Blast: impacted files | 3 | — |
| Files referencing symbol | — | **1 file** |

**Current consumer:** Only `packages/theme-engine/src/theme-renderer.ts` (internal use).

**Note:** The LCIS stale blast of 3 files reflects pre-refactor state. Current tree shows this type is used only internally. LCIS-reported expansion may have been collapsed/consolidated in Phases B–AE.

---

### 4.6 `buildLiquidThemeHeadAssets()`

**Source:** `packages/theme-engine/src/theme-renderer.ts:L231`
**Ownership:** @saai-sidd (`/packages/` rule)

| Metric | LCIS (HISTORICAL_ONLY) | Current git-grep (VERIFIED_CURRENT) |
|--------|------------------------|--------------------------------------|
| Degree | 4 | — |
| Blast: impacted nodes | 17 (3 layers: 3 → 3 → 11) | — |
| Blast: impacted files | 15 | — |
| Files referencing symbol | — | **4 files** |

**Current consumers (VERIFIED_CURRENT):**

```
packages/theme-engine/src/theme-renderer.ts       (definition)
packages/theme-engine/test/custom-css-sanitizer.test.ts
packages/theme-engine/test/liquid-l2-assets.test.ts
packages/theme-engine/test/qi-security.test.ts
```

The LCIS blast of 17 nodes reflected pre-refactor wiring through storefront-runtime. Current tree shows this function is exclusively internal to theme-engine (definition + tests).

---

### 4.7 `publish_theme_release` RPC

**Defined in:** `database/supabase/migrations/073_order_item_required_field_compatibility.sql` (also present in `000_baseline.sql`)
**Ownership:** @saai-sidd (`/database/` rule)

**LCIS RPC record (db-intel.json, HISTORICAL_ONLY):**

```json
{
  "name": "publish_theme_release",
  "securityDefiner": true,
  "idempotency": true,
  "forUpdate": false,
  "money": false,
  "tables": [
    "theme_instances", "theme_package_versions", "theme_releases",
    "sites", "theme_instance_drafts", "storefront_cache_tags",
    "outbox_events", "audit_activity_events"
  ],
  "callers": ["services/api-gateway/src/execution/theme-execution.adapter.ts"]
}
```

**Current callers (VERIFIED_CURRENT, git-grep):**

```
services/api-gateway/src/execution/theme-execution.adapter.ts   (production call)
services/api-gateway/src/routes/themes/theme-update-route.ts    (route using adapter)
services/api-gateway/src/__tests__/theme-persistence-p.test.ts  (test)
services/api-gateway/src/__tests__/theme-update.test.ts         (test)
```

**Key properties:**
- `SECURITY DEFINER`: YES (verified in LCIS db-intel.json)
- `hasIdempotency`: YES (verified; idempotency_key added by migration 189)
- `FOR UPDATE`: NO (theme_releases is not a money table)
- Not in money flow; touches outbox for analytics

**Stop/Go relevance:** Single production call path. Any change to signature (args) must align between the SQL function and the TypeScript adapter.

---

### 4.8 `theme_purchases` table

**Source:** `database/supabase/migrations/000_baseline.sql`
**Ownership:** @saai-sidd (`/database/` rule)

**LCIS db-intel.json (HISTORICAL_ONLY — STALE, pre-migration 191):**

```json
{
  "name": "theme_purchases",
  "rls": true,
  "force": false,
  "tenant": false,
  "policies": [],
  "triggers": ["notify_theme_purchase", "update_theme_purchases_updated_at"],
  "indexes": 7
}
```

**Current state (VERIFIED_CURRENT — from migration 191 source):**

Migration 191 (`7e1441a6`) closed RISK-SEC-001: dropped both wide-open baseline policies and replaced with:

| Policy | Target role | Operation | Predicate |
|--------|------------|-----------|-----------|
| `tp_service_role` | service_role | ALL | USING (true) / WITH CHECK (true) |
| `tp_authenticated_select` | authenticated | SELECT | user_id = auth.uid() |
| `tp_authenticated_insert` | authenticated | INSERT | user_id = auth.uid() |

**Status:** RLS **ENABLED** (not FORCE). Baseline SQL: `ALTER TABLE public.theme_purchases ENABLE ROW LEVEL SECURITY;` — no FORCE. Post-migration 191, policies are properly scoped. STALE LCIS showed `policies: []` because migration 191 was added 27 days after the graph was built.

**Gap from CODEOWNERS:** `theme_purchases` is classified `tenant: false` in stale LCIS (it uses `user_id` for scoping, not `site_id`/`store_id`). This is correct; purchases are user-scoped not store-scoped. Not a missing RLS table; it now has proper user-scoped policies.

---

### 4.9 `theme_editor_drafts` table

**Source:** `database/supabase/migrations/000_baseline.sql`
**Ownership:** @saai-sidd (`/database/` rule)

**LCIS db-intel.json (HISTORICAL_ONLY):**

```json
{
  "name": "theme_editor_drafts",
  "rls": true,
  "force": false,
  "tenant": true,
  "policies": [
    "theme_editor_drafts_owner_delete",
    "theme_editor_drafts_owner_insert",
    "theme_editor_drafts_owner_select",
    "theme_editor_drafts_owner_update"
  ],
  "triggers": ["update_theme_editor_drafts_updated_at"],
  "indexes": 3
}
```

**Status (HISTORICAL_ONLY for policy names; policy count unlikely to have changed):** 4 owner-scoped policies (CRUD), RLS enabled, tenant=true. No wide-open USING(true) detected in LCIS. FORCE=false (consistent with other theme tables).

---

### 4.10 `tenant-tables.registry.ts`

**Source:** `services/api-gateway/src/tenant/tenant-tables.registry.ts`
**Ownership:** @saai-sidd (`/services/` rule)
**File status:** TRACKED in git (`git status` shows clean); GENERATED (header: `// GENERATED by scripts/generators/generate-tenant-table-registry.mjs at 2026-06-10T23:05:38.261Z`)

| Metric | Value | Method |
|--------|-------|--------|
| Line count | 3056 lines | `wc -l` |
| Generated at | 2026-06-10T23:05:38.261Z | file header |
| Direct importers | 1 file | git-grep VERIFIED_CURRENT |
| Import location | `services/api-gateway/src/tenant/tenant-scoped.ts` | `services/api-gateway/src/tenant/tenant-scoped.ts:import { tenantTableRegistryEntry }` |
| Staleness vs migrations | Generated before migrations 186–191 (Jun 10 vs Jun 14+) | VERIFIED_CURRENT |

**LCIS graph record (HISTORICAL_ONLY):**

```json
{
  "id": "tenant_tenant_tables_registry",
  "label": "tenant-tables.registry.ts",
  "file": "services/api-gateway/src/tenant/tenant-tables.registry.ts",
  "degree": 6,
  "community": 629
}
```

**Gap:** The registry was generated on 2026-06-10, before migrations 188–191 added new tables (`theme_releases`, `theme_library`, `theme_purchases` policy changes, `theme_presets` variants). The registry may not reflect these tables' tenant-scope columns. This is a **potential staleness gap** that the generator script (`scripts/generators/generate-tenant-table-registry.mjs`) would close, but running it is prohibited per AF.0 (it regenerates a tracked file).

---

### 4.11 Metafield binding resolution

**Source (VERIFIED_CURRENT):**

```
packages/theme-engine/src/dynamic-source-binding.ts   ← binding engine
packages/theme-engine/test/dynamic-source-binding.test.ts
services/api-gateway/src/routes/metafields.ts         ← API route
services/api-gateway/src/__tests__/metafields.test.ts
services/api-gateway/src/tenant/tenant-tables.registry.ts  ← store_metafield_definitions registered
```

**Domain (LCIS, HISTORICAL_ONLY):** `store_metafield_definitions` and `store_metafield_values` are classified under the `products` domain.

**Status:** STRUCTURAL_ONLY — binding engine implemented in theme-engine, route in gateway, but live data connection requires DB access (NOT_CONNECTED in this audit).

---

### 4.12 Translation routes

**Source (VERIFIED_CURRENT):**

```
services/api-gateway/src/routes/stores-localization.ts   ← locales, markets, translations
packages/theme-engine/src/theme-renderer.ts              ← locale/translation in render
packages/theme-engine/src/experience-apply.ts            ← locale handling
```

**Domain (LCIS, HISTORICAL_ONLY):** `storefront_locales` and `storefront_translations` tables are classified under the `storefront` domain. `stores-localization.ts` route is listed among storefront domain routes.

**Route registration confirmed:** `services/api-gateway/src/index.ts` imports and mounts `stores-localization.ts`. Tables `store_markets`, `storefront_locales`, `storefront_translations` exist in migration history.

**Status:** STRUCTURAL_ONLY — route exists, tables referenced, live locale serving requires runtime (NOT_CONNECTED).

---

### 4.13 AI customization proxy

**MCP app route (VERIFIED_CURRENT):**

```
apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts
```

This route:
- GET: returns deterministic SDK catalog (no gateway call)
- POST: proxies to `POST /themes/:themeId/ai-customization` on the gateway

**Gateway endpoint (VERIFIED_CURRENT — NOT EXISTS):**

```
services/api-gateway/src/routes/themes/ → only: media-library.ts, theme-update-route.ts
services/api-gateway/src/routes/themes.ts → no ai-customization route registered
services/api-gateway/src/routes/ai.ts → no theme customization handling
```

No gateway route for `POST /themes/:themeId/ai-customization` exists.

Route file comment (from source):
> "This proxy forwards to POST /themes/:themeId/ai-customization on the gateway. That gateway route does NOT yet exist (Phase AC, Lane A, pending deployment). When the gateway returns 404 or 503, this proxy returns a structured NOT_CONNECTED response (HTTP 503)..."

**Status: NOT_CONNECTED.** The merchant-control-plane proxy exists; the gateway endpoint is missing. This is the honest documented state per Phase AC.

---

## 5. Migration 186–191 Audit (R-23 compliance)

R-23 rule: every migration ships a paired rollback.

| Migration | File | Git status | Rollback instruction | R-23 status |
|-----------|------|-----------|----------------------|-------------|
| 186 | `186_v1_scale_commerce_os_coming_soon.sql` | **UNTRACKED** (not in git) | Inline: `-- Revert: set status = 'available', purchasable = true.` | PARTIAL (comment only, no separate rollback file) |
| 187 | `187_v1_sites_site_settings.sql` | **UNTRACKED** (not in git) | Inline: `-- Rollback (forward-fix preferred): drop the column with IF EXISTS in a follow-up migration.` | PARTIAL (comment only) |
| 188 | `188_letbuyy_core_theme_row.sql` | TRACKED (commit 40741cb8) | **NONE FOUND** | GAP |
| 189 | `189_theme_persistence_idempotency.sql` | TRACKED (commit fa4e4786) | **NONE FOUND** | GAP |
| 190 | `190_theme_library_q.sql` | TRACKED (commit 016da8f0) | **NONE FOUND** | GAP |
| 191 | `191_theme_purchases_rls_tenant_scope.sql` | TRACKED (commit 7e1441a6) | **NONE FOUND** | GAP |

**Notes:**

- Migrations 186 and 187 are UNTRACKED in git (`git status --porcelain` shows them as new untracked files). They are present on disk but have never been committed. They cannot be deployed via the normal git-based migration pipeline in this state.
- Migrations 188–191 are tracked (each added in its Phase commit). None carries a rollback file; 188 and 189 have rollback semantics implied (additive with ON CONFLICT DO NOTHING), but not documented.
- All 6 migrations are additive (ADD COLUMN IF NOT EXISTS, INSERT ON CONFLICT DO NOTHING, DROP POLICY + CREATE POLICY) — they pass the migration-safety-validator pattern checks. However the R-23 rollback documentation gap is a governance flag.

---

## 6. Graph Staleness — Impact on Downstream Workstreams

The following symbols/facts that LCIS should know about are **absent from or stale in the graph** because they were introduced in commits after 0db025a6:

| Symbol / Fact | When added (commit) | LCIS status |
|--------------|-------------------|-------------|
| parseLiquidThemePackageBundle (AI files: ai-optimizer, ai-personalization, ai-theme-generator, theme-ai-sdk) | Phase L (29f87115) | HISTORICAL_ONLY (stale consumers) |
| theme_editor_drafts policies (post-migration) | baseline | HISTORICAL_ONLY (correct) |
| theme_purchases policies (post-migration 191) | 7e1441a6 | HISTORICAL_ONLY (stale — policies=[]) |
| AI customization proxy route | Phase AC (83d61e0a) | ABSENT from graph |
| media-library.ts gateway route | Phase Q / 016da8f0 | ABSENT from graph |
| theme-update-route.ts refactored | various | PARTIAL |
| migration 189 idempotency_key on theme_releases | fa4e4786 | ABSENT from db-intel.json |
| migration 190 owned_by_site_id / is_site_private on themes | 016da8f0 | ABSENT from db-intel.json |
| migration 191 new RLS policies on theme_purchases | 7e1441a6 | ABSENT from db-intel.json |
| lcis-cli, lcis-core, lcis-mcp, lcis-pr-check packages | LCIS phases | ABSENT from graph |

**Recommendation:** Run `graphify update . && pnpm graph:v3` (or at minimum `pnpm graph:db`) on a clean branch to produce a current graph before making AF_1 decisions that rely on blast-radius counts. This is not safe to do within this AF.0 audit.

---

## 7. Domain Intelligence (Themes Domain, HISTORICAL_ONLY 2026-06-15)

From `graphify-out/domain-intel.json` (generatedAt: 2026-06-15T10:40:05Z):

```
domain: themes
tables (32): store_themes, theme_assets, theme_block_definitions, theme_draft_patches,
  theme_editor_drafts, theme_instance_drafts, theme_instances, theme_layouts,
  theme_migrations, theme_package_versions, theme_packages, theme_presets,
  theme_preview_sessions, theme_purchases, theme_releases, theme_renderer_manifests,
  theme_reviews, theme_schema_manifests, theme_section_definitions,
  theme_template_assignments, theme_templates, themes,
  theme_collections, theme_collection_items, theme_saved_searches,
  theme_download_artifacts, theme_purchase_receipts, theme_refund_requests,
  theme_reports, theme_marketplace_settings, theme_developer_listings,
  theme_developer_payout_accounts
rpcs (4): notify_on_theme_purchase, publish_theme_release, update_theme_install_count,
  update_theme_rating
dependsOn: analytics (2), merchant (1), storefront (1)
consumedBy: operations (1)
workers: letbuyy-api, letbuyy-queue-workers
```

The domain-intel correctly identifies `publish_theme_release` as crossing into storefront (via `storefront_cache_tags`) and analytics (via `outbox_events`, `audit_activity_events`).

---

## 8. Blockers & Unresolved Items

### Blockers for accurate LCIS data

1. **Graph rebuild required** — 27 days / 58 commits stale; `graphify update .` must be run on a fresh branch or by an authorized human operator. ETA: ~15 min rebuild. Until then, all blast/consumer counts for theme-engine symbols are HISTORICAL_ONLY.

2. **LCIS server not running** — `pnpm graph:ui` would start it; currently no live API queries possible.

3. **validate-governance.mjs PENDING** — has `fs.rmSync` side-effect on build artifact directories; not run in this audit. Must be run before merge per CLAUDE.md instruction. Human action required.

4. **tenant-tables.registry.ts generator PENDING** — generated on 2026-06-10, before migrations 186–191. May need regeneration if new tables (themes-related) have been added with tenant-scope columns. Running the generator (`scripts/generators/generate-tenant-table-registry.mjs`) regenerates a tracked file — AF.0 prohibits this. Human action required.

5. **Migrations 186–187 UNTRACKED** — these files exist on disk but are not in git history. If they represent real pending schema changes, they need to be committed before deployment. If they are superseded drafts, they may need deletion. This is a FOREIGN_WIP signal that requires human triage.

---

## 9. STOP/GO Inputs (AF_1 Decision)

The following evidence from this workstream is directly relevant to the Phase AF STOP/GO gate:

| Input | Evidence | Risk |
|-------|----------|------|
| LCIS graph is 27 days / 58 commits stale | `graph.json built_at_commit: 0db025a6`; HEAD: `7e1441a6`; 58 commits behind | MEDIUM — blast-radius numbers from LCIS cannot be trusted for theme-engine symbols; git-grep provides current consumer counts |
| `getSupabaseAdmin` blast radius: 120+ files (CURRENT) | git-grep result; LCIS stale count: 115 files | Any API-gateway-level change has platform-wide blast; change-control required |
| `@letbuyy/shared-types`: 154 consumer files (CURRENT) | git-grep result; LCIS blast=0 (direction issue, not real) | Widest-blast package; type changes require cross-runtime coordination |
| `@letbuyy/theme-engine`: 68 consumer files (CURRENT) | git-grep result across storefront/merchant/gateway/frozen apps | Cross-runtime blast; frozen apps are build-time consumers |
| `publish_theme_release` RPC: SECURITY DEFINER, idempotency confirmed | LCIS db-intel.json (HISTORICAL_ONLY but RPC predates build cutoff) | Correctly architectured; idempotency gap closed by migration 189 |
| `theme_purchases` RLS: wide-open policies CLOSED by migration 191 | migration 191 source read | RISK-SEC-001 remediated; policies now user_id-scoped |
| AI customization gateway endpoint: MISSING | ls services/api-gateway/src/routes/themes/ | Status: NOT_CONNECTED; proxy returns 503 per design |
| Migrations 186–187: UNTRACKED in git | `git status --porcelain` | These schema changes cannot be deployed via git pipeline; human triage required before launch |
| Migrations 188–191: R-23 gap (no rollback docs) | grep for rollback/revert in each file | Governance violation for 188–191; rollback instructions must be added before ARB sign-off |
| tenant-tables.registry.ts: stale (generated 2026-06-10) | file header timestamp | May not reflect theme-domain tables added in migrations 186–191; generator must be re-run by human |
| LCIS server not running; graph refresh not safe in AF.0 scope | connection check + prohibition analysis | Blast-radius decisions requiring accurate current counts need post-AF.0 graph refresh |
| Ownership: 100% `@saai-sidd` (no team delegation) | CODEOWNERS wildcard | Single point of approval; no parallel review lanes from a team structure |
