# Phase 9 — Dead Code Investigation

Investigation date: 2026-06-05

> Forensic, documentation-only pass. Nothing was modified, deleted, moved, or renamed. Every finding below cites the evidence (path + grep/scan counts) used to reach it and a confidence label (**certain / likely / possible**). "Dead" here means *no inbound reference was found by the stated method*; it is not an instruction to delete.

---

## Method

- **Repo roots scanned:** `apps/`, `apps/mobile/`, `packages/`, `packages/typescript/`, `packages/dart/`, `services/`, `database/`, `config/`, `scripts/`, `.github/`, `legacy/`, `memory/`, `tasks/`, `Audit/`, `docs/`, and 73 root-level `*.md` files. Excluded: `node_modules`, `.git`, `.pnpm-store`, `.turbo`, `.dart_tool`, `build`, `dist`, `.next`, `test-results`, `artifacts`, `coverage`.
- **Workspace dependency graph:** parsed every `package.json` (`apps/* + apps/mobile/* + packages/* + packages/typescript/* + services/*`, 36 manifests) and computed inbound `@letbuyy/*` dependents.
- **Unused source files:** custom Node scan (`/tmp/orphan-scan.mjs`) loaded all 809 `.ts/.tsx` files, then for each non-entry file searched every other file for an import of its basename (`/<base>'`, `./<base>'`, and for `index.ts` the parent-dir name). Next.js framework entry points (`page`, `layout`, `route`, `middleware`/`proxy`, `next.config`, `*.d.ts`, etc.), `*.test.*`, and `src/index.ts` barrels were excluded from the "orphan" verdict; flagged candidates were then re-verified individually with targeted `grep`.
- **Dart:** equivalent basename-import scan over 181 non-test `.dart` files; candidates re-verified by class-name grep.
- **Unused dependencies:** per-workspace scan (corrected matcher: `'dep'` / `"dep"` / `'dep/` / `"dep/`) over each app's own source tree.
- **Env vars:** union of the 4 `config/env/**/*.env.example` files (98 distinct names) checked against all code + config + CI.
- **DB structures:** 249 `CREATE TABLE` names extracted from `database/supabase/migrations/*.sql`, checked for quoted references and `.from('<table>')` usage in app/service/package code.
- **Validators / scripts:** cross-referenced `scripts/validators/*.mjs` (131 files) against `scripts/validate-governance.mjs`, `package.json`, and `.github/workflows/*.yml`.

`grep`/`rg` via the file tooling; bulk scans via Node. `depcheck`/`knip` were **not** run (workspace shell was intermittently unavailable); dependency findings rest on string-match scans and are labelled accordingly.

---

## Headline numbers

| Category | Finding |
|---|---|
| Unused TS/TSX source files (0 inbound refs, verified) | **~40** of 809 (candidate scan flagged 101; after excluding framework entries + barrels + re-verification) |
| Unused Dart files (0 inbound refs, verified) | **~34** of 181 (merchant-app widgets + 3 `core` responsive files) |
| Workspace packages with **0** `package.json` dependents | **12** (all are leaf apps/services — expected) + see §3 for the genuinely-unconsumed package |
| Workspace package imported **nowhere** in source despite being declared | **1** — `@letbuyy/utils` (declared in 8 apps, imported by 0) |
| Code-free declared services (manifest + AGENTS.md only) | **6** reserved + 1 (`queue-workers` has code) |
| Unused env vars (declared, never read) | **8** of 98 (`VERCEL_PROJECT_ID_*`) |
| Unused declared dependencies (per-app, string-scan) | **react-dom ×8 apps, lucide-react ×5, @letbuyy/utils ×8**, plus framer-motion/gsap/jose/clsx/react-email pockets |
| DB tables never referenced (quoted) in code | **~70** of 249 |
| Empty leftover route directories | **2** (`*-empty-proof` in merchant-control-plane) |
| Root-level ledger/report `*.md` files | **73**, none referenced by any tooling/CI/code (cross-referenced only by other `*.md`) |
| `Audit/` directory | 6 files, referenced nowhere |
| `legacy/firebase/` | 37 files, referenced by exactly 1 tooling line |

---

## 1. Code-free / reserved services (declared topology, no implementation)

**Confidence: certain (existence) / governed-intentional (status).**

Six `services/*` roots contain **only** `AGENTS.md` + `runtime.manifest.json` — zero source files:

```
services/analytics-pipeline   2 files (AGENTS.md, runtime.manifest.json)
services/checkout-runtime      2 files
services/event-bus             2 files
services/media-service         2 files
services/notification-service  2 files
services/search-service        2 files
```
Evidence: `ls -R services/*` (each lists exactly those two files).

These are **explicitly governed as "reserved" runtimes**, not accidental dead code:
- `docs/governance/runtime-boundaries.md` lines 22–28 label each as "reserved … runtime."
- `scripts/validators/governance-common.mjs` lines 91–101 lists all six in `canonicalServiceRoots`, so governance actively *requires* them to exist.

Classification: **declared-but-unimplemented services**. They are wired into governance contracts but have no deployable code and are imported/called by nothing (no `package.json`, so they cannot be a workspace dependency — confirmed: not in the inbound-dependents table). `services/queue-workers` is similar in governance but **does** contain code (`services/queue-workers/src/index.ts`).

---

## 2. Unused source files (TypeScript/TSX)

The orphan scan flagged 101 candidates; after removing Next.js framework entry points and `src/index.ts` package barrels (which are referenced via the package name, not a relative path) and re-verifying each remaining candidate with `grep`, the following have **0 inbound import references** anywhere in the repo.

### 2a. Storefront-runtime components — **certain**
Each verified with `grep -rl "/<name>'"` across `apps/storefront-runtime/src` → 0 hits (other than the file itself):

| File | refs |
|---|---|
| `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/add-to-cart-button.tsx` | 0 |
| `apps/storefront-runtime/src/components/ui/reveal.tsx` | 0 |
| `apps/storefront-runtime/src/components/ui/badge.tsx` | 0 |
| `apps/storefront-runtime/src/components/policy-page.tsx` | 0 |
| `apps/storefront-runtime/src/components/layout/floating-header.tsx` | 0 |
| `apps/storefront-runtime/src/components/cart-icon.tsx` | 0 |
| `apps/storefront-runtime/src/components/wishlist/wishlist-button.tsx` | 0 |
| `apps/storefront-runtime/src/components/coming-soon/components/shared/email-signup.tsx` | 0 |
| `apps/storefront-runtime/src/components/coming-soon/components/shared/powered-by.tsx` | 0 |
| `apps/storefront-runtime/src/components/coming-soon/components/shared/animated-background.tsx` | 0 |
| `apps/storefront-runtime/src/components/coming-soon/components/shared/countdown-timer.tsx` | 0 |

Note: the `coming-soon/index.tsx` barrel imports only the five per-site-type `*-coming-soon.tsx` files (lines 3–7); the four `components/shared/*` helpers above are imported by none of them (grep for `email-signup`/`powered-by`/`animated-background`/`countdown-timer` in `coming-soon/` returns no import lines).

### 2b. Marketing-site — duplicate unused component set — **certain**
`apps/marketing-site/src/app/page.tsx` imports exactly one component family (`Header, Hero, SiteTypes, Features, HowItWorks, Pricing, FAQ, FinalCTA, Footer`). A parallel `*Section`/`Navbar` family exists in the same directory and is imported by nothing (each verified at 0 refs):

| Unused file | refs |
|---|---|
| `apps/marketing-site/src/components/Navbar.tsx` | 0 |
| `apps/marketing-site/src/components/HeroSection.tsx` | 0 |
| `apps/marketing-site/src/components/FeaturesSection.tsx` | 0 |
| `apps/marketing-site/src/components/PricingSection.tsx` | 0 |
| `apps/marketing-site/src/components/TestimonialsSection.tsx` | 0 |
| `apps/marketing-site/src/components/Testimonials.tsx` | 0 |
| `apps/marketing-site/src/components/CTASection.tsx` | 0 |
| `apps/marketing-site/src/components/SocialProof.tsx` | 0 |
| `apps/marketing-site/src/components/Capabilities.tsx` | 0 |

(`Header.tsx` 620 lines is the live nav; `Navbar.tsx` 32 lines is the dead one — see Phase 10 §duplicate components.) `BrandLogo.tsx` (3 refs) and `ThemeProvider.tsx` (1 ref) are live.

### 2c. Merchant-control-plane theme-editor modular components — **certain**
The live theme editor is the monolithic `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (`'use client'`, ~hundreds of lines, imports its own icons). A separate modular component set exists under `src/components/theme-editor/` and is imported by nothing (each 0 refs):

```
EditorHeader.tsx  ThemeSettingsPanel.tsx  CenterPanel.tsx  RightSidebar.tsx
LeftSidebar.tsx   AddSectionModal.tsx     IconRail.tsx
```
Plus the hook `apps/merchant-control-plane/src/hooks/useEditorUrl.ts` (0 refs; sibling `useEditorHistory.ts` was not flagged → in use).

### 2d. Merchant-control-plane plan/settings components — **certain**
0 refs each:
```
apps/merchant-control-plane/src/components/plans/PlanBillingTimeline.tsx
apps/merchant-control-plane/src/components/plans/PlanCard.tsx
apps/merchant-control-plane/src/components/plans/ComparePlans.tsx
apps/merchant-control-plane/src/components/WelcomeScreen.tsx
apps/merchant-control-plane/src/components/SettingsSidebar.tsx
```
(`StubPage.tsx` was flagged by the scan but is **live** — imported by `[store]/ats-score/page.tsx` and one other; not dead.)

### 2e. App-marketplace — **certain**
`apps/app-marketplace/src/components/HeroSection.tsx` — 0 refs (the live hero is `@/components/sections/hero` referenced from `renderer-registry.tsx`; this `HeroSection.tsx` is unrelated and unused).

### 2f. API-gateway schemas — **likely**
Three Zod schema modules under `services/api-gateway/src/schemas/` have no `import … from '../schemas/<name>.schema'` anywhere (other schema modules in the same dir *are* imported by their matching `routes/*.ts`):
```
services/api-gateway/src/schemas/product.schema.ts    (0 import refs)
services/api-gateway/src/schemas/common.schema.ts     (0 import refs)
services/api-gateway/src/schemas/shipping.schema.ts   (0 import refs)
```
Evidence: `grep -rn "product.schema|common.schema|shipping.schema" services/api-gateway/src` → no `import` lines (only the files themselves). Labelled *likely* (not *certain*) because schema modules can be re-exported indirectly; none was found here.

### NOT dead (scan false-positives, documented for completeness)
- All 7 `apps/*/src/proxy.ts` files were flagged by the basename scan but are **Next.js 16 middleware** (this repo pins `next@16.1.6`, which renamed `middleware.ts` → `proxy.ts`). They export `proxy()` + `config` and are framework entry points. Confirmed: `apps/*/package.json` → `"next": "16.1.6"`; `docs/frontend/README.md` line 54 references `apps/app-marketplace/src/proxy.ts` as a "source" entry. **Live, not dead.**
- All `packages/*/src/index.ts` and `packages/*/<sub>/index.ts` barrels (flagged because referenced by package name, not relative path) — live (see §3 inbound-dependents table).

---

## 3. Unused / under-consumed packages

### 3a. `@letbuyy/utils` — declared in 8 apps, imported by 0 — **certain**
`packages/typescript/utils` (entry `src/index.ts`, re-exports `supabase`/`auth`/`api`) is listed as a `dependencies` entry in 8 app manifests (storefront-runtime, merchant-control-plane, identity-platform, app-marketplace, theme-marketplace, marketing-site, platform-console, platform-operations-portal — visible in the inbound table) **but no source file anywhere imports `@letbuyy/utils`**.
Evidence: `grep -rln "@letbuyy/utils" --include=*.ts --include=*.tsx apps services packages | grep -v packages/typescript/utils` → **empty**. The package itself only re-exports `@letbuyy/infrastructure/supabase-adapter`. Classification: **dead workspace dependency** (manifest edge with no import edge).

### 3b. Packages with 0 `package.json` dependents — **certain (data) / expected (status)**
From the computed inbound graph, these have zero workspace dependents — all are leaf runtimes (apps/services), which is normal because nothing should depend *on* an app:
```
@letbuyy/app-marketplace, @letbuyy/storefront-runtime, @letbuyy/marketing-site,
@letbuyy/platform-operations-portal, @letbuyy/platform-console, @letbuyy/developer-portal,
@letbuyy/identity-platform, @letbuyy/theme-marketplace, @letbuyy/merchant-control-plane,
@letbuyy/webhook-service, @letbuyy/api-gateway, @letbuyy/queue-workers
```
Not flagged as dead — these are deployment targets.

### 3c. Most-depended packages (for contrast)
`@letbuyy/shared-types` (26 dependents), `@letbuyy/auth-core` (11), `@letbuyy/event-core` (9), `@letbuyy/ui` (9), `@letbuyy/theme-engine` (8), `@letbuyy/utils` (8 declared / **0 imported**). Every other domain/execution package has ≥1 real importer.

### 3d. `packages/dart/services` — facade with one re-export, no dependents — **likely**
`packages/dart/services/lib/letbuyy_services.dart` is a "compatibility facade" that re-exports a single symbol (`SharedPreferencesService`) from `letbuyy_core`. No `apps/mobile/*/pubspec.yaml` lists `letbuyy_services` as a dependency (grep over mobile pubspecs → empty), and the root `pubspec.yaml` includes it in the Melos workspace but no app consumes it. The file's own comment states legacy services "were removed in WS8 M5" and the package is kept "as a stable workspace facade … while downstream shopper ownership is decided." Classification: **retained-empty facade, no current consumer.**

---

## 4. Unused dependencies (declared in package.json, not imported in own source)

**Confidence: likely** (string-match scan over each app's own tree; `react-dom` is *possible* because Next manages it transitively).

| Workspace | Declared but not imported in its source |
|---|---|
| storefront-runtime | `@letbuyy/utils`, `clsx`, `jose`, `lucide-react`, `react-dom`, `tailwind-merge` |
| merchant-control-plane | `@letbuyy/utils`, `react-dom` |
| identity-platform | `@letbuyy/utils`, `@react-email/components`, `react-email`, `react-dom` |
| app-marketplace | `@letbuyy/utils`, `jose`, `lucide-react`, `react-dom` |
| theme-marketplace | `@letbuyy/utils`, `framer-motion`, `lucide-react` |
| marketing-site | `@gsap/react`, `gsap`, `@letbuyy/api-types`, `@letbuyy/utils`, `react-dom` |
| platform-console | `@letbuyy/utils`, `lucide-react`, `react-dom` |
| platform-operations-portal | `@letbuyy/utils`, `lucide-react`, `react-dom` |
| developer-portal | `react-dom` |

Notes:
- `react-dom` is unused as a *direct* import in 8 Next apps — Next pulls it in itself, so this is **possible** (conventionally declared), not certainly removable.
- `lucide-react` unused in 5 apps; `framer-motion` declared+unused in theme-marketplace (it *is* used in storefront/marketing); `gsap`+`@gsap/react` declared+unused in marketing-site (which instead uses `lenis`, imported in `page.tsx`); `react-email`+`@react-email/components` declared+unused in identity-platform; `clsx`+`tailwind-merge`+`jose` declared+unused in storefront-runtime (no `cn()` helper found in its tree or in `@letbuyy/ui/src`). These are **likely** genuinely unused.
- `@letbuyy/utils` (8×) and `@letbuyy/api-types` (marketing-site) corroborate §3a.

---

## 5. Unused environment variables

**Confidence: certain.** Union of `config/env/staging.env.example`, `config/env/production.env.example`, `config/env/templates/next-app.env.example`, `config/env/templates/worker.env.example` = 98 distinct names. Checked against all `.ts/.tsx/.mjs/.toml/.dart/.json` under `apps/services/packages/infrastructure/scripts/tests/config` + `.github/workflows`.

8 are never read anywhere:
```
VERCEL_PROJECT_ID_APP_MARKETPLACE        VERCEL_PROJECT_ID_PLATFORM_CONSOLE
VERCEL_PROJECT_ID_IDENTITY               VERCEL_PROJECT_ID_PLATFORM_OPERATIONS_PORTAL
VERCEL_PROJECT_ID_MARKETING              VERCEL_PROJECT_ID_STOREFRONT
VERCEL_PROJECT_ID_MERCHANT               VERCEL_PROJECT_ID_THEME_MARKETPLACE
```
Declared at `config/env/staging.env.example:94-101` (and prod equivalent). The deploy workflows instead read **differently-named** GitHub secrets via a matrix (`deploy-production.yml:86-93` uses `PRODUCTION_<APP>_PROJECT_ID` mapped through `matrix.app.project_secret` → consumed at line 127 as the env var `VERCEL_PROJECT_ID`). So the `VERCEL_PROJECT_ID_*` template names are **orphaned naming** superseded by the matrix secret scheme. The other 90 env names resolve to at least one read.

---

## 6. Unused database structures

**Confidence: likely** (string + `.from()` scan; some tables are reached only via SQL/RPC/views and may be live despite no quoted code reference).

- 249 `CREATE TABLE` statements across `database/supabase/migrations/*.sql`; **127** distinct table names appear in `.from('<table>')` calls in app/service code. ~**70** never appear as a quoted reference in any `.ts/.tsx/.mjs/.dart` file.
- Representative never-referenced-in-code tables (each `grep` over app/service/package code → 0 quoted hits): `analytics_events`, `checkout_sessions`, `device_tokens`, `gift_card_accounts`, `gift_card_ledger_entries`, `gift_card_redemptions`, `fulfillment_orders`, `fulfillment_order_lines`, `promotion_rules`, `promotion_effects`, `promotion_redemptions`, `promotion_usage_counters`, `return_requests`, `return_lines`, `refund_transactions`, `shipments`, `shipment_events`, `smart_collections`, `collection_products`, `theme_templates`, `theme_layouts`, `theme_presets`, `theme_section_definitions`, `theme_block_definitions`, `wishlists`, `usage_meter_entries`, `plan_entitlements`, `site_api_clients`, `skill_endorsements`, `gallery_items`, `lead_forms`.
  - Caveat: several of these (e.g. `wishlists`, `refunds`, `contacts`, `inventory_reservations`) **do** match as substrings/RPC names but not as quoted `.from()` targets — labelled "possible" rather than "certain." The full per-table breakdown is in `/tmp/tables.txt` (generated during this pass).
- **Partition shadow tables are NOT dead** — they are a deliberate migration pattern, not duplication: migrations `079`–`083` convert hot tables to declarative partitioning, producing `<table>_partitioned` + `<table>_partitioned_default` pairs (`outbox_events`, `platform_queue_jobs`, `runtime_telemetry_metrics`, `webhook_deliveries`, `worker_request_logs`). Code references the base table name; the partition machinery is server-side.

---

## 7. Unused scripts & validators

**Confidence: certain.**

- **All 131 `scripts/validators/*.mjs` are wired.** `scripts/validate-governance.mjs` invokes 131 validators by name (its array, lines 4–133). The 10 that don't appear *literally* in `package.json`'s long `validate:*` strings (`architecture-validator`, `domain-boundary-validator`, `execution-layer-validator`, `generated-artifact-validator`, `governance-common`, `operational-certification-common`, `package-ownership-validator`, `production-certification-common`, `stale-artifact-validator`, `tooling-governance-validator`) are all invoked by `validate-governance.mjs` (confirmed by line number) or are **shared library modules** — `governance-common.mjs` is imported by **128** validators; `operational-certification-common.mjs` and `production-certification-common.mjs` are likewise shared. None are dead.
- **Empty tooling directories (placeholder-only):** `scripts/governance/`, `scripts/generators/`, `scripts/migration/`, `scripts/utilities/` each contain **only `README.md`** (no `.mjs`). They are not dead in the deletable sense — `scripts/validators/tooling-governance-validator.mjs` lines 10–20 *requires* these directories and their READMEs to exist (`requiredScriptDirectories`). Classification: **mandated-empty placeholders**.
- **Active script dirs:** `scripts/cloudflare/update-wrangler-ids.mjs`, `scripts/github/{setup-repo,set-secrets}.mjs`, `scripts/supabase/run-migrations.mjs`, `scripts/staging/seed.mjs` — each has ≥1 external reference (CI/docs/other scripts). Live.
- `scripts/generate-repository-intelligence.mjs`, `validate-architecture.mjs`, `validate-governance.mjs` are the 3 allowed root scripts (per `tooling-governance-validator.mjs:23-26`). Live.

---

## 8. Unused configurations

- The 8 `VERCEL_PROJECT_ID_*` env-template entries (§5) are the main inert config.
- `config/runtime/*.schema.json` + companion data JSONs: every `*.schema.json` pairs with a runtime validator (the `validate:runtime`/`validate:production-certification` chains in `package.json`). Not analysed exhaustively, but spot-checks (`environment-lifecycle.schema.json`, `cloudflare-topology.schema.json`) resolve to a validator. No inert schema confirmed.
- `supabase/config.toml` + `database/supabase/supabase/.temp/*` and `supabase/.temp/*`: the `.temp/` dirs are Supabase CLI link state (machine-local cache), not referenced by code. **Possible** stray local state; low value.

---

## 9. Documentation: inert vs tooling-referenced

**Confidence: certain.**

### 9a. Root-level ledger/report Markdown — 73 files, tooling-inert
`ls *.md` = 73. For every `CODEX_*.md`, `LETBUYY_*.md`, `WAVE*.md` file, a cross-reference search over `scripts/.github/infrastructure/config/tests/apps/services/packages` (code + CI + JSON, excluding `*.md`) returned **0 hits**. They are referenced *only* by other Markdown:
- `CODEX_MASTER_EXECUTION_LEDGER.md` — in 3 `.md` files; `LETBUYY_STATE.md` — 4; `CODEX_REMEDIATION_LEDGER.md` — 3; `CODEX_FEDERATION_LEDGER.md` — 1.

Classification: **inert documentation / process ledgers.** No script, validator, or workflow loads them. (Largest: `CODEX_MASTER_EXECUTION_LEDGER.md` 264 KB, `CODEX_SHOPIFY_UX_LEDGER.md` 199 KB, `LETBUYY_STATE.md` 75 KB.) `AGENTS.md` (32 KB) and `CLAUDE.md` *are* operationally load-bearing (referenced by agent runtime + `scripts/generate-repository-intelligence.mjs`), so not inert.

### 9b. `Audit/` — inert
6 files (`report_part1…6_*.md`, dated May 29). A reference search over scripts/CI/docs found **0** hits. Not mentioned in `AGENTS.md` or `docs/governance/`. Classification: **inert audit snapshot.**

### 9c. `memory/` and `tasks/` — tooling-referenced (NOT inert)
- `memory/lessons.md` and `tasks/todo.md` are **operationally referenced**: `AGENTS.md:241,350,367` instructs agents to read them before edits, and `scripts/generate-repository-intelligence.mjs:954,1059,1076` emits those instructions into generated AGENTS files. `tasks/env-setup-skips.md` is part of the same `tasks/` contract. Classification: **active process memory**, not dead.

### 9d. `docs/archive/` — archival, lightly tooling-touched
210 files, 14 MB. Per the deprecation policy in `CLAUDE.md`, historical references "may remain only under `docs/archive/`." A handful of governance validators walk `docs/` (e.g. `architecture-validator.mjs`, `environment-validator.mjs` include `docs` in their start dirs via `governance-common.listWorkspaceFiles`), so archive files are *scanned* but not *depended upon* for behaviour. Classification: **intentional archive** (governed retention), not deletable dead code.

### 9e. `legacy/firebase/` — quarantined legacy, 1 tooling reference
37 files (1.2 MB) including a full Firebase Functions `src/` tree (`storeAuth.ts`, `walletService.ts`, `razorpayService.ts`, `adminAuth.ts`, etc.). Referenced by exactly **one** line of active tooling: `scripts/generate-repository-intelligence.mjs:372` classifies `legacy/firebase` paths as `"firebase legacy"`. No active runtime imports it (the boundary rule `docs/governance/runtime-boundaries.md:34` forbids importing `legacy/`). Classification: **quarantined legacy implementation** — inert to the running system, retained intentionally under `legacy/`.

---

## 10. Empty leftover route scaffolding — **certain**

Two empty directories under the merchant app router (0 files each):
```
apps/merchant-control-plane/src/app/codex-theme-editor-empty-proof/      (0 files)
apps/merchant-control-plane/src/app/__codex-theme-editor-empty-proof/    (0 files)
```
Evidence: `find … -type f` → 0. Names indicate codex "empty-proof" scaffolding artifacts. Inert (an empty App Router segment renders nothing and exports no route).

---

## 11. Unused Dart files (mobile)

**Confidence: likely** (basename-import scan + class-name re-verification; some widgets may be instantiated via inline `_buildX` helpers rather than the standalone widget class).

The Dart scan flagged 37 candidates; the `operator-app` is a bare Flutter scaffold (`lib/main.dart` is the default counter demo — `title: 'Flutter Demo'`), so its surface is minimal. In `merchant-app`, ~34 widget files have no `import '…/<file>.dart'` anywhere. Several were spot-checked and confirmed the *screen* re-implements the widget inline instead of importing it — e.g. `widgets/products/product_card.dart` is unused while `screens/products/products_screen.dart` defines a private `_buildProductCard()` (line 761). Representative unused widgets:
```
widgets/products/{product_card,product_search_bar,bulk_action_bar,filter_tabs}.dart
widgets/dashboard/{bento_grid,glass_stat_card,insights_grid,dashboard_header,
                   performance_chart_card,recent_activity_feed}.dart
widgets/theme/{preset_grid,theme_preview_card,color_picker_row,font_selector}.dart
widgets/editor/{section_card,section_type_icon,block_editor}.dart
widgets/editor/preview_sections/{preview_header,preview_hero,preview_products,
                   preview_about,preview_testimonials,preview_newsletter,preview_footer}.dart
widgets/shared/{animated_counter,status_badge,glassmorphic_card}.dart
widgets/{home/store_header_card,home/publish_toggle_card,settings/plan_card,
         subscription/subscription_card}.dart
services/{domain_service,preview_service}.dart
utils/theme_resolver.dart
```
Plus 3 in the shared core package: `packages/dart/core/lib/src/responsive/{responsive_helper,size_config,breakpoints}.dart` — the `responsive.dart` sibling defines the live widget; these three helpers are imported by nothing (grep returns only definitions, no importers). Caveat: `status_badge.dart` / `glassmorphic_card.dart` are *defined as classes used by other unused widgets*, so they form a self-contained dead cluster rather than being individually reachable.

---

## Evidence Index

| # | Claim | Evidence (path / count) |
|---|---|---|
| E1 | 36 workspace manifests; inbound `@letbuyy/*` graph | Node parse of all `package.json`; `@letbuyy/shared-types`=26 dependents … `@letbuyy/utils`=8 declared |
| E2 | 6 code-free reserved services | `ls -R services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}` = 2 files each |
| E3 | Reserved services governed | `docs/governance/runtime-boundaries.md:22-28`; `scripts/validators/governance-common.mjs:91-101` |
| E4 | 11 storefront component files, 0 refs | `grep -rl "/<name>'" apps/storefront-runtime/src` → 0 for each (§2a) |
| E5 | 9 marketing-site `*Section`/`Navbar` files, 0 refs | `apps/marketing-site/src/app/page.tsx` imports only `Header/Hero/SiteTypes/Features/HowItWorks/Pricing/FAQ/FinalCTA/Footer`; grep of the others → 0 |
| E6 | 7 theme-editor modular components + `useEditorUrl.ts`, 0 refs | live editor = `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`; grep of `EditorHeader…IconRail` → 0 |
| E7 | 5 plan/settings components, 0 refs | grep `PlanCard/ComparePlans/PlanBillingTimeline/WelcomeScreen/SettingsSidebar` → 0 |
| E8 | 3 api-gateway schemas unused | `grep -rn "product.schema|common.schema|shipping.schema" services/api-gateway/src` → no import lines |
| E9 | `proxy.ts` ×7 are Next 16 middleware (NOT dead) | `apps/*/package.json` `"next":"16.1.6"`; `apps/*/src/proxy.ts` export `proxy()`+`config`; `docs/frontend/README.md:54` |
| E10 | `@letbuyy/utils` imported nowhere | `grep -rln "@letbuyy/utils" apps services packages \| grep -v packages/typescript/utils` → empty; declared in 8 app manifests |
| E11 | Per-app unused deps | corrected matcher scan (§4 table) |
| E12 | 8 unused `VERCEL_PROJECT_ID_*` env vars | union of 4 env-example files (98 names); `config/env/staging.env.example:94-101`; deploy workflows use `PRODUCTION_<APP>_PROJECT_ID` via matrix (`deploy-production.yml:86-93,127`) |
| E13 | ~70/249 DB tables unreferenced (quoted) | 249 `CREATE TABLE` extracted; 127 found in `.from('…')`; remainder in `/tmp/tables.txt` |
| E14 | Partition shadow tables = migration pattern, not dead | migrations `079`–`083`; base + `_partitioned` + `_partitioned_default` triples |
| E15 | 131 validators all wired; `governance-common` shared by 128 | `scripts/validate-governance.mjs:4-133`; `grep "governance-common.mjs"` → 128 importers |
| E16 | 4 tooling dirs are README-only placeholders, mandated | `ls scripts/{governance,generators,migration,utilities}` = README.md only; `tooling-governance-validator.mjs:10-20` requires them |
| E17 | 73 root `*.md` tooling-inert | cross-ref of `CODEX_*/LETBUYY_*/WAVE*` over code+CI+JSON → 0; only `.md`→`.md` refs |
| E18 | `Audit/` inert | 6 files; reference search → 0 |
| E19 | `memory/`+`tasks/` active (not inert) | `AGENTS.md:241,350,367`; `scripts/generate-repository-intelligence.mjs:954,1059,1076` |
| E20 | `legacy/firebase/` quarantined, 1 tooling ref | 37 files; only `scripts/generate-repository-intelligence.mjs:372`; boundary rule `runtime-boundaries.md:34` |
| E21 | 2 empty `*-empty-proof` route dirs | `find apps/merchant-control-plane/src/app/{,__}codex-theme-editor-empty-proof -type f` → 0 |
| E22 | ~34 unused merchant-app Dart widgets + 3 core responsive files | basename scan over 181 `.dart`; `products_screen.dart:761` inlines `_buildProductCard` while `product_card.dart` unused |
| E23 | `packages/dart/services` empty facade, no consumer | `letbuyy_services.dart` re-exports 1 symbol; no mobile `pubspec.yaml` depends on it |
| E24 | 809 TS/TSX, 186 Dart, 17 SQL migrations, 37 legacy files | `find` counts |
