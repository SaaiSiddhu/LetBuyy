# Phase 9 — Dead Code Investigation

Investigation date: 2026-06-05 (second pass, post-remediation)

> Forensic, documentation-only pass. Nothing was modified, deleted, moved, or renamed. Every finding below cites the evidence (path + grep/scan counts) used to reach it and a confidence label (**certain / likely / possible**). "Dead" here means *no inbound reference was found by the stated method*; it is not an instruction to delete.
>
> **Second pass:** the first-pass body below has been re-verified against the post-remediation tree (~68 commits, `cd71e612..HEAD`; merges of WS1/WS5/WS7/WS9/WS10 + `stream/letbuyy-remediation`). Sections updated in place where the facts changed; the new **"Changes since first pass"** section summarises the deltas with per-item STILL-OPEN / RESOLVED / NEW status.

---

## Changes since first pass

| Item (first-pass claim) | Second-pass status | Evidence |
|---|---|---|
| ~40 unused TS/TSX files | **STILL-OPEN, net +1** — every first-pass dead TS file re-verified at 0 refs; remediation streams added/wired new modules but did not wire or remove the dead sets. One file became newly dead (`AppsSettingsContent.tsx`), one previously-flagged file became live (`SchemaFormRenderer.tsx`, wired into the live editor). | §2a–2f re-verified per-file (each grep → 0); `editor/page.tsx:45` now imports `SchemaFormRenderer`; `settings/apps/page.tsx` switched from `AppsSettingsContent` (imported at cd71e612) to `AppsSettingsClient` |
| Theme-editor modular set + `useEditorUrl` | **STILL-OPEN, cluster grew** — all 7 components still 0 external refs; 2 files were *added* to the dir (commit 866cdbc1 "polish theme editor icons"): `SchemaFormRenderer.tsx` (LIVE — imported by the monolith editor) and `SectionItem.tsx` (dead — imported only by dead `LeftSidebar.tsx`). `useEditorHistory.ts` is **re-classified dead**: its only importers are the dead components (`RightSidebar`, `LeftSidebar`, `SectionItem`); the live `editor/page.tsx` does not use it (true at both passes — first pass mis-classified it as live). Dead cluster now: 7 components + `SectionItem` + `useEditorUrl` + `useEditorHistory` = 10 files. | grep `EditorHeader…IconRail` → 0 external; grep `useEditorHistory` in `src/app/**` → 0 files; `git show cd71e612:…editor/page.tsx \| grep -c useEditorHistory` → 0 |
| Marketing-site dead twin set (9 files) | **STILL-OPEN, unchanged** — all 9 exist, 0 refs each; `page.tsx` imports the same live family. | per-file grep → 0 (§2b) |
| ~34 unused Dart files | **STILL-OPEN, unchanged** — spot re-check of 9 representative widgets + `domain_service`/`theme_resolver` → all exist, 0 import refs; 181 non-test `.dart` files (same count). Core responsive trio now *listed* in `packages/dart/core/AGENTS.md:58-61` ("Key Files" inventory) but still has 0 Dart importers. | §11 re-verified |
| `@letbuyy/utils` dead edge (8 declared / 0 imported) | **STILL-OPEN, unchanged** — grep `@letbuyy/utils` outside the package → 0; still declared in the same 8 app manifests; `git diff cd71e612..HEAD -- packages/typescript/utils/` → empty (package untouched). | §3a |
| Per-app unused dependencies (§4) | **STILL-OPEN, unchanged** — `git diff cd71e612..HEAD -- 'apps/*/package.json'` shows zero dependency changes. | §4 |
| 8 unused `VERCEL_PROJECT_ID_*` env vars | **STILL-OPEN, declarations doubled** — still read by nothing; now declared in **4** files instead of 2: the original `staging/production.env.example:94-101` plus new `config/env/staging.env.template:23-30` and `config/env/production.env.template:23-30`. Repo-wide grep for readers → only env files + docs/ledgers. | §5 updated |
| ~70 unreferenced DB tables | **STILL-OPEN, ~67** — 250 distinct `CREATE TABLE` (was 249; counting method, no new table — migrations 087/088/089 are ALTER + functions only). 77 tables have zero quoted reference across apps/services/packages/scripts/tests/infrastructure/config; 10 of those are partition shadows (deliberate pattern) → **67 genuinely-unreferenced**. Migration `087_theme_template_drafts.sql` only ALTERs the *live* `theme_editor_drafts` table — the orphan theme set (`theme_templates`, `theme_layouts`, `theme_presets`, `theme_section_definitions`, `theme_block_definitions`, `theme_assets`, `theme_migrations`, `theme_template_assignments`) is unchanged. `public.carts` still has 0 quoted code refs (the lone `'cart_items'` hit is a Dart storage-key constant, `packages/dart/core/lib/src/constants/storage_constants.dart`, not a DB read). | §6 updated; `/tmp/t.txt`/`/tmp/qfull.txt` comm → 77; migration heads inspected |
| 73 root ledger `*.md` files, tooling-inert | **PARTLY RESOLVED / residue remains** — 71 ledger files + the 6-file `Audit/` directory were moved to `docs/archive/root-residue/2026-06-05-foundation-hardening/` (77 added files). Root is now **11** `.md` (was 74 incl. AGENTS/CLAUDE/README). BUT: (a) **5 NEW ledger files** accumulated at root since the archive (`CODEX_FOUNDATION_HARDENING_{MISSION,LEDGER,STATUS}.md`, `CODEX_FOUNDATION_REMEDIATION_MISSION.md`, `CODEX_WS5_LEDGER.md`); (b) `CODEX_MASTER_EXECUTION_LEDGER.md` (269,700 B) and `CODEX_WS12_LEDGER.md` exist **byte-identical in both root and archive**; (c) `CODEX_WS7_LEDGER.md` exists in both and has **diverged** (root 54 lines vs archive 51); (d) 3 new ledgers appeared *inside workspace source trees*: `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md`, and `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md` (a ledger inside a Next.js App Router segment). Tooling refs to any `CODEX_*` remain **0**. | §9a rewritten |
| `Audit/` inert | **RESOLVED (relocated)** — root `Audit/` no longer exists; its 6 files live at `docs/archive/root-residue/2026-06-05-foundation-hardening/Audit/`. | `ls Audit` → No such file |
| `legacy/firebase/` quarantined | **STILL-OPEN, unchanged** — 37 files; still exactly 1 tooling reference (`scripts/generate-repository-intelligence.mjs`). | §9e |
| 2 empty `*-empty-proof` route dirs | **STILL-OPEN, unchanged** — both dirs still exist, 0 files each. | §10 |
| 3 unused api-gateway schemas | **STILL-OPEN, unchanged** — `product/common/shipping.schema.ts` exist, 0 import refs each. | §2f |
| New modules added by remediation (for the record) | **All wired (not dead)** — `routes/internal-billing.ts` (197) + `routes/internal-events.ts` (61) mounted at `api-gateway/src/index.ts:459-460`; `execution/subscription-execution.adapter.ts` (203) imported by internal-billing + payments routes; `execution/cloudflare-queue-triggers.ts` (137) imported by `index.ts:53`; `routes/storefront/internal-payment-routes.ts` (233) imported/registered at `storefront.ts:33,1826`; webhook-service `gateway-{events,order-transitions,billing-transitions}.ts` + queue-workers `gateway-events.ts` consumed by `index.ts`/`platform-queue-consumer.ts`; merchant settings hub (`components/settings/{SettingsShell,SettingsPane,SettingsIndex,SettingsSearch,BackendNeededPane}` — refs 1–8 each); `@letbuyy/ui` additions barrel-exported via `src/index.ts`; marketplace `lib/logger.ts` ×2 + `MarketplaceUnavailable` ×2 all imported by pages/services. None of the ~36 new non-test TS files is dead **except none** — the only newly-dead file is the *orphaned pre-existing* `AppsSettingsContent.tsx`. | `git diff --diff-filter=A cd71e612..HEAD` file list, per-file ref greps |

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

## Headline numbers (second pass, 2026-06-05 post-remediation)

| Category | Finding | vs first pass |
|---|---|---|
| Unused TS/TSX source files (0 inbound refs, verified) | **~41** of 838 (`find` count with same exclusions; ~36 new non-test files added by remediation, all wired) | STILL-OPEN (+1 net: `AppsSettingsContent.tsx` newly dead; `SchemaFormRenderer.tsx` escaped to live) |
| Unused Dart files (0 inbound refs, verified) | **~34** of 181 (unchanged) | STILL-OPEN |
| Workspace packages with **0** `package.json` dependents | **12** (leaf apps/services — expected); 36 manifests unchanged | unchanged |
| Workspace package imported **nowhere** in source despite being declared | **1** — `@letbuyy/utils` (declared in 8 apps, imported by 0; package untouched since first pass) | STILL-OPEN |
| Code-free declared services (manifest + AGENTS.md only) | **6** reserved + 1 (`queue-workers` has code; it gained `gateway-events.ts`) | unchanged |
| Unused env vars (declared, never read) | **8** of 98 (`VERCEL_PROJECT_ID_*`) — now declared in **4** env files (2 new `.env.template` files added) | STILL-OPEN, declarations doubled |
| Unused declared dependencies (per-app, string-scan) | **react-dom ×8 apps, lucide-react ×5, @letbuyy/utils ×8**, plus framer-motion/gsap/jose/clsx/react-email pockets — `git diff` on app manifests since cd71e612 is empty | STILL-OPEN, unchanged |
| DB tables never referenced (quoted) in code | **67** of 250 (77 zero-ref incl. 10 partition shadows; scan now includes scripts/tests/infrastructure/config) | STILL-OPEN (~70 → 67) |
| Empty leftover route directories | **2** (`*-empty-proof` in merchant-control-plane) | STILL-OPEN |
| Root-level ledger/report `*.md` files | **8 CODEX ledgers** at root (was 71 ledgers + Audit/) — 71+Audit archived to `docs/archive/root-residue/2026-06-05-foundation-hardening/`, but 5 new ledgers accrued, 2 root files are byte-identical archive duplicates, 1 diverged, and 3 new ledgers sit inside workspace source trees | PARTLY RESOLVED |
| `Audit/` directory | relocated to `docs/archive/root-residue/2026-06-05-foundation-hardening/Audit/` (root copy gone) | RESOLVED (relocated) |
| `legacy/firebase/` | 37 files, referenced by exactly 1 tooling line | STILL-OPEN, unchanged |

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

*(Second pass: all 11 files re-verified — each still exists with 0 refs. STILL-OPEN.)*

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

*(Second pass: all 9 dead twins still exist at 0 refs each; `page.tsx` imports the same live family; line counts unchanged (Header 620 / Navbar 32). STILL-OPEN.)*

### 2c. Merchant-control-plane theme-editor modular components — **certain** *(second pass: still dead, cluster grew)*
The live theme editor is the monolithic `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (`'use client'`, imports its own icons). A separate modular component set exists under `src/components/theme-editor/` and is imported by nothing external (each 0 refs, re-verified second pass):

```
EditorHeader.tsx  ThemeSettingsPanel.tsx  CenterPanel.tsx  RightSidebar.tsx
LeftSidebar.tsx   AddSectionModal.tsx     IconRail.tsx     SectionItem.tsx (NEW, dead)
```
Plus the hooks `apps/merchant-control-plane/src/hooks/useEditorUrl.ts` (0 refs) **and** `useEditorHistory.ts` — re-classified **dead** on second pass: its only importers are the dead components themselves (`RightSidebar.tsx`, `LeftSidebar.tsx`, `SectionItem.tsx`); the live `editor/page.tsx` does not import it at HEAD and did not at cd71e612 either (`git show cd71e612:…/editor/page.tsx | grep -c useEditorHistory` → 0). The first pass mis-classified it as live because the basename scan counted the dead importers.

Second-pass note: commit `866cdbc1` ("feat(merchant): polish theme editor icons") added two files to the same directory — `SectionItem.tsx` (dead, imported only by dead `LeftSidebar.tsx`) and `SchemaFormRenderer.tsx`, which **is live** (imported by the monolith at `editor/page.tsx:45` and used at lines 1784/1796/1822). So the dir now mixes 1 live file with a 10-file dead cluster (7 components + SectionItem + 2 hooks); the dead components were even *modified* (icon polish) without being wired.

### 2d. Merchant-control-plane plan/settings components — **certain** *(second pass: still dead, +1 new)*
0 refs each (all re-verified second pass):
```
apps/merchant-control-plane/src/components/plans/PlanBillingTimeline.tsx
apps/merchant-control-plane/src/components/plans/PlanCard.tsx
apps/merchant-control-plane/src/components/plans/ComparePlans.tsx
apps/merchant-control-plane/src/components/WelcomeScreen.tsx
apps/merchant-control-plane/src/components/SettingsSidebar.tsx
apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsContent.tsx   (NEW dead — see below)
```
(`StubPage.tsx` was flagged by the scan but is **live** — imported by `[store]/ats-score/page.tsx` and one other; not dead.)

Second-pass notes:
- `SettingsSidebar.tsx` remains 0 refs even after the WS9 settings hub landed — the hub built a *new* navigation module instead (`src/components/settings/{SettingsShell,SettingsPane,SettingsIndex,SettingsSearch,BackendNeededPane}.tsx` + `settings-navigation.ts`, all live with 1–8 refs each).
- **`AppsSettingsContent.tsx` (311 lines) is newly dead.** At first-pass commit cd71e612, `settings/apps/page.tsx` imported it (`import AppsSettingsContent, { type AppUninstallResult } from './AppsSettingsContent'`). The WS9 rework replaced that import with `AppsSettingsClient` (285 lines, commit lineage ff42d186/81fda463/9cb111ed); the old file was orphaned, not removed. Current grep for `AppsSettingsContent` outside its own file → 0.

### 2e. App-marketplace — **certain**
`apps/app-marketplace/src/components/HeroSection.tsx` — 0 refs (the live hero is `@/components/sections/hero` referenced from `renderer-registry.tsx`; this `HeroSection.tsx` is unrelated and unused). *(Second pass: still exists, 0 refs. STILL-OPEN.)*

### 2f. API-gateway schemas — **likely**
Three Zod schema modules under `services/api-gateway/src/schemas/` have no `import … from '../schemas/<name>.schema'` anywhere (other schema modules in the same dir *are* imported by their matching `routes/*.ts`):
```
services/api-gateway/src/schemas/product.schema.ts    (0 import refs)
services/api-gateway/src/schemas/common.schema.ts     (0 import refs)
services/api-gateway/src/schemas/shipping.schema.ts   (0 import refs)
```
Evidence: `grep -rn "product.schema|common.schema|shipping.schema" services/api-gateway/src` → no `import` lines (only the files themselves). Labelled *likely* (not *certain*) because schema modules can be re-exported indirectly; none was found here.

*(Second pass: all 3 still exist, 0 import refs each — the new `internal-billing`/`internal-events`/`internal-payment-routes` modules import none of them. STILL-OPEN.)*

### NOT dead (scan false-positives, documented for completeness)
- All 7 `apps/*/src/proxy.ts` files were flagged by the basename scan but are **Next.js 16 middleware** (this repo pins `next@16.1.6`, which renamed `middleware.ts` → `proxy.ts`). They export `proxy()` + `config` and are framework entry points. Confirmed: `apps/*/package.json` → `"next": "16.1.6"`; `docs/frontend/README.md` line 54 references `apps/app-marketplace/src/proxy.ts` as a "source" entry. **Live, not dead.**
- All `packages/*/src/index.ts` and `packages/*/<sub>/index.ts` barrels (flagged because referenced by package name, not relative path) — live (see §3 inbound-dependents table).

---

## 3. Unused / under-consumed packages

### 3a. `@letbuyy/utils` — declared in 8 apps, imported by 0 — **certain**
`packages/typescript/utils` (entry `src/index.ts`, re-exports `supabase`/`auth`/`api`) is listed as a `dependencies` entry in 8 app manifests (storefront-runtime, merchant-control-plane, identity-platform, app-marketplace, theme-marketplace, marketing-site, platform-console, platform-operations-portal — visible in the inbound table) **but no source file anywhere imports `@letbuyy/utils`**.
Evidence: `grep -rln "@letbuyy/utils" --include=*.ts --include=*.tsx apps services packages | grep -v packages/typescript/utils` → **empty**. The package itself only re-exports `@letbuyy/infrastructure/supabase-adapter`. Classification: **dead workspace dependency** (manifest edge with no import edge).

*(Second pass: unchanged — 0 importers, still declared in the same 8 app manifests; `git diff cd71e612..HEAD -- packages/typescript/utils/` is empty and `git diff cd71e612..HEAD -- 'apps/*/package.json'` shows no dependency changes. STILL-OPEN.)*

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

8 are never read anywhere (re-verified second pass — repo-wide grep for `VERCEL_PROJECT_ID_` hits only env files, root mission ledgers, the archived production ledger, and this report):
```
VERCEL_PROJECT_ID_APP_MARKETPLACE        VERCEL_PROJECT_ID_PLATFORM_CONSOLE
VERCEL_PROJECT_ID_IDENTITY               VERCEL_PROJECT_ID_PLATFORM_OPERATIONS_PORTAL
VERCEL_PROJECT_ID_MARKETING              VERCEL_PROJECT_ID_STOREFRONT
VERCEL_PROJECT_ID_MERCHANT               VERCEL_PROJECT_ID_THEME_MARKETPLACE
```
Declared at `config/env/staging.env.example:94-101` (and prod equivalent). **Second pass:** the declaration count *doubled* — two new files, `config/env/staging.env.template:23-30` and `config/env/production.env.template:23-30`, re-declare all 8 names (now 4 declaring files, still 0 readers). The deploy workflows instead read **differently-named** GitHub secrets via a matrix (`deploy-production.yml:86-93` uses `PRODUCTION_<APP>_PROJECT_ID` mapped through `matrix.app.project_secret` → consumed at line 127 as the env var `VERCEL_PROJECT_ID`). So the `VERCEL_PROJECT_ID_*` template names are **orphaned naming** superseded by the matrix secret scheme, and the orphaned naming was propagated rather than retired. The other 90 env names resolve to at least one read. STILL-OPEN.

---

## 6. Unused database structures

**Confidence: likely** (string + `.from()` scan; some tables are reached only via SQL/RPC/views and may be live despite no quoted code reference).

**Second pass (post-remediation):** 3 new migrations landed (`087_theme_template_drafts.sql`, `088_inventory_available_batch.sql`, `089_quarantine_platform_queue_job.sql`) — none creates a table: 087 only `ALTER TABLE public.theme_editor_drafts` (adds `template_key`, re-keys the unique constraint; `theme_editor_drafts` is a *live* table), 088/089 are `CREATE OR REPLACE FUNCTION` only. The orphan-table set is therefore essentially unchanged.

- **250** distinct `CREATE TABLE` names across `database/supabase/migrations/*.sql` (was reported 249; counting-method delta, no new table); **127** distinct table names appear in `.from('<table>')` calls in app/service code. **77** never appear as any quoted reference in `.ts/.tsx/.mjs/.dart` across apps/services/packages **plus** scripts/tests/infrastructure/config; 10 of those 77 are the `_partitioned`/`_partitioned_default` shadows (deliberate pattern, below) → **67 genuinely-unreferenced tables**. (App/service/package code alone, excluding tooling, leaves ~108 with no quoted ref — the lower 67 figure credits validator/test/seed references as "referenced.")
- Representative never-referenced tables, all re-verified at 0 quoted refs on second pass: `analytics_events`, `carts`, `checkout_sessions`, `device_tokens`, `gift_card_accounts`, `gift_card_ledger_entries`, `gift_card_redemptions`, `fulfillment_orders`, `fulfillment_order_lines`, `promotions`, `promotion_codes`, `promotion_rules`, `promotion_effects`, `promotion_redemptions`, `promotion_usage_counters`, `return_requests`, `return_lines`, `refunds`, `refund_transactions`, `refund_attempts`, `refund_lines`, `shipments`, `shipment_events`, `smart_collections`, `collection_products`, `theme_templates`, `theme_layouts`, `theme_presets`, `theme_section_definitions`, `theme_block_definitions`, `theme_assets`, `theme_migrations`, `theme_template_assignments`, `wishlists`, `usage_meter_entries`, `plan_entitlements`, `site_api_clients`, `skill_endorsements`, `gallery_items`, `lead_forms`, `media_assets`, `payment_attempts`, `payment_transactions`, `inventory_reservations`, `contacts`.
  - `public.carts` specifically: still completely unwired — the only repo hit for `'cart_items'` is a Dart storage-key constant (`packages/dart/core/lib/src/constants/storage_constants.dart`), not a DB access; `'carts'` itself has 0 quoted code refs.
  - Caveat unchanged: tables reached only via SQL functions/RPC/views may be live despite 0 quoted refs — labelled "likely," not "certain."
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

### 9a. Root-level ledger/report Markdown — archived, with new residue *(updated second pass)*

**First pass:** 73–74 root `*.md`; every `CODEX_*/LETBUYY_*/WAVE*` file tooling-inert (0 hits in scripts/CI/code; `.md`→`.md` refs only).

**Second pass status — PARTLY RESOLVED:**
- **Archived:** 71 ledger/report `.md` files (plus the 6-file `Audit/` directory) were moved to `docs/archive/root-residue/2026-06-05-foundation-hardening/` (`ls docs/archive/root-residue/2026-06-05-foundation-hardening/*.md` → 71; +`Audit/` dir; 77 files added under `docs/` per `git diff --diff-filter=A cd71e612..HEAD -- docs/archive/root-residue/`). This matches the repo's own deprecation policy ("historical references may remain only under `docs/archive/`").
- **Root now:** **11** `.md` files — 3 canonical (`AGENTS.md`, `CLAUDE.md`, `README.md`) + **8 CODEX ledgers**: `CODEX_FOUNDATION_HARDENING_{MISSION,LEDGER,STATUS}.md`, `CODEX_FOUNDATION_REMEDIATION_MISSION.md`, `CODEX_MASTER_EXECUTION_LEDGER.md`, `CODEX_WS5_LEDGER.md`, `CODEX_WS7_LEDGER.md`, `CODEX_WS12_LEDGER.md`. Five of these are **new since the archive** (`git ls-tree cd71e612` lacks HARDENING_{MISSION,LEDGER,STATUS}, REMEDIATION_MISSION, WS5_LEDGER) — i.e. the remediation run re-accumulated ledger residue at root while archiving the prior generation.
- **Root↔archive duplicates:** `CODEX_MASTER_EXECUTION_LEDGER.md` (269,700 bytes) and `CODEX_WS12_LEDGER.md` exist **byte-identical in both root and the archive** (`diff -q` → identical). `CODEX_WS7_LEDGER.md` exists in both and has **diverged** (root 54 lines vs archive 51) — two competing copies of the same ledger.
- **Two mission files at root:** `CODEX_FOUNDATION_HARDENING_MISSION.md` (268 lines, "Phase 4 — Make It Honest & Solid") and `CODEX_FOUNDATION_REMEDIATION_MISSION.md` (237 lines, "Foundation Phase — Make It True") are two near-parallel mission documents for the same forensic-driven remediation (both cite `FORENSIC_REPORT/16` as source of truth, same governance posture, same predecessors); only the former is referenced by the active ledger/status pair.
- **Ledgers inside source trees (NEW pattern):** `apps/developer-portal/CODEX_WS10_LEDGER.md`, `packages/typescript/ui/CODEX_WS1_LEDGER.md`, and `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md` — the last sits *inside a Next.js App Router segment directory* (151 lines, committed with the WS9 settings diff).
- **Tooling references:** still **0** — `grep -rln "CODEX_" scripts .github config infrastructure` (mjs/yml/json) → 0 files; nothing references the archive path `root-residue` from scripts/CI/governance either.

Classification unchanged: **inert documentation / process ledgers**, now split across root (8), archive (71), and source trees (3), with 2 exact and 1 diverged root/archive duplicate.

### 9b. `Audit/` — relocated *(updated second pass)*
First pass: 6 files (`report_part1…6_*.md`, dated May 29) at repo root, referenced nowhere. **Second pass: RESOLVED (relocated)** — root `Audit/` no longer exists (`ls Audit` → No such file or directory); the 6 files now live at `docs/archive/root-residue/2026-06-05-foundation-hardening/Audit/`. Still referenced by nothing (consistent with archive status).

### 9c. `memory/` and `tasks/` — tooling-referenced (NOT inert)
- `memory/lessons.md` and `tasks/todo.md` are **operationally referenced**: `AGENTS.md:241,350,367` instructs agents to read them before edits, and `scripts/generate-repository-intelligence.mjs:954,1059,1076` emits those instructions into generated AGENTS files. `tasks/env-setup-skips.md` is part of the same `tasks/` contract. Classification: **active process memory**, not dead.

### 9d. `docs/archive/` — archival, lightly tooling-touched
210 files, 14 MB. Per the deprecation policy in `CLAUDE.md`, historical references "may remain only under `docs/archive/`." A handful of governance validators walk `docs/` (e.g. `architecture-validator.mjs`, `environment-validator.mjs` include `docs` in their start dirs via `governance-common.listWorkspaceFiles`), so archive files are *scanned* but not *depended upon* for behaviour. Classification: **intentional archive** (governed retention), not deletable dead code.

### 9e. `legacy/firebase/` — quarantined legacy, 1 tooling reference
37 files (1.2 MB) including a full Firebase Functions `src/` tree (`storeAuth.ts`, `walletService.ts`, `razorpayService.ts`, `adminAuth.ts`, etc.). Referenced by exactly **one** line of active tooling: `scripts/generate-repository-intelligence.mjs:372` classifies `legacy/firebase` paths as `"firebase legacy"`. No active runtime imports it (the boundary rule `docs/governance/runtime-boundaries.md:34` forbids importing `legacy/`). Classification: **quarantined legacy implementation** — inert to the running system, retained intentionally under `legacy/`.

*(Second pass: unchanged — still 37 files, still exactly 1 tooling reference. STILL-OPEN/intentional.)*

---

## 10. Empty leftover route scaffolding — **certain**

Two empty directories under the merchant app router (0 files each):
```
apps/merchant-control-plane/src/app/codex-theme-editor-empty-proof/      (0 files)
apps/merchant-control-plane/src/app/__codex-theme-editor-empty-proof/    (0 files)
```
Evidence: `find … -type f` → 0. Names indicate codex "empty-proof" scaffolding artifacts. Inert (an empty App Router segment renders nothing and exports no route).

*(Second pass: both directories still exist, still 0 files (`ls -la` shows empty dirs). STILL-OPEN.)*

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

**Second pass:** unchanged — 181 non-test `.dart` files (same count); 9 representative widgets plus `domain_service.dart`/`theme_resolver.dart` re-verified at 0 import refs; the responsive trio remains at 0 Dart importers (the only new "references" are an inventory listing in `packages/dart/core/AGENTS.md:58-61` "Key Files" — documentation, not code). STILL-OPEN.

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
| E24 | 809 TS/TSX, 186 Dart, 17 SQL migrations, 37 legacy files | `find` counts (first pass) |

### Second-pass evidence (2026-06-05, post-remediation, `cd71e612..HEAD` = 68 commits)

| # | Claim | Evidence (path / count) |
|---|---|---|
| E25 | All §2a/2b/2d/2e/2f TS dead files still 0 refs | per-file grep loop over each basename (11 storefront + 9 marketing + 5 merchant plan/settings + app-marketplace `HeroSection` + 3 gateway schemas) → 0 each |
| E26 | Theme-editor dead cluster grew to 10 files; `SchemaFormRenderer` live | `ls src/components/theme-editor/` = 9 files; external refs of 7 originals + `SectionItem` → 0; `editor/page.tsx:45` imports `SchemaFormRenderer`; `useEditorHistory` importers = 3 dead files only; `git show cd71e612:…editor/page.tsx \| grep -c useEditorHistory` → 0 |
| E27 | `AppsSettingsContent.tsx` newly dead (311 lines) | `git show cd71e612:…settings/apps/page.tsx` imports it; HEAD `page.tsx` imports `AppsSettingsClient` instead; grep `AppsSettingsContent` outside the file → 0 |
| E28 | `@letbuyy/utils` unchanged: 8 declared / 0 imported | grep → 0 importers; 8 `package.json` declarations; `git diff cd71e612..HEAD -- packages/typescript/utils/` empty |
| E29 | App dependency manifests unchanged | `git diff cd71e612..HEAD -- 'apps/*/package.json'` → empty |
| E30 | `VERCEL_PROJECT_ID_*` now declared in 4 files, read by 0 | `staging/production.env.example:94-101` + new `staging/production.env.template:23-30`; repo grep hits only env files + ledgers/reports |
| E31 | 250 tables; 77 zero-quoted-ref incl. tooling dirs; 67 excl. partition shadows | `CREATE TABLE` extraction → 250 (`/tmp/t.txt`); quoted-string union over apps/services/packages/scripts/tests/infrastructure/config (`/tmp/qfull.txt`); `comm -23` → 77; minus 10 `_partitioned*` |
| E32 | Migrations 087–089 create no tables; orphan theme set unchanged; `carts` unwired | 087 = `ALTER TABLE public.theme_editor_drafts` only; 088/089 = `CREATE OR REPLACE FUNCTION`; `theme_templates/layouts/presets/section_definitions/block_definitions/assets/migrations/template_assignments` all in the zero-ref list; `'carts'` → 0 code refs; lone `'cart_items'` hit = `packages/dart/core/lib/src/constants/storage_constants.dart` |
| E33 | Root residue archived: 71 md + Audit/ → archive; root = 11 md | `ls *.md` = 11; `ls docs/archive/root-residue/2026-06-05-foundation-hardening/*.md` = 71 + `Audit/` (6 files); `git diff --diff-filter=A … -- docs/archive/root-residue/` = 77 files; root `Audit/` gone |
| E34 | 5 new root ledgers; 2 byte-identical root/archive dups; 1 diverged | `git ls-tree cd71e612` lacks HARDENING_{MISSION,LEDGER,STATUS}/REMEDIATION_MISSION/WS5_LEDGER; `diff -q` MASTER_EXECUTION (269,700 B) + WS12 identical; WS7 root 54 vs archive 51 lines |
| E35 | 3 ledgers inside source trees | `find apps services packages -name "CODEX_*.md"` → developer-portal WS10, ui WS1, merchant `src/app/[store]/settings/CODEX_WS9_LEDGER.md` |
| E36 | CODEX files still tooling-inert; archive path unreferenced | grep `CODEX_` over scripts/.github/config/infrastructure (mjs/yml/json) → 0; grep `root-residue` over scripts/.github/docs-governance/AGENTS/CLAUDE → 0 |
| E37 | All ~36 new non-test TS files are wired | `git diff --diff-filter=A cd71e612..HEAD` list; internal-billing/events mounted `api-gateway/src/index.ts:42-43,459-460`; `subscription-execution.adapter` ← internal-billing.ts + payments.ts; `cloudflare-queue-triggers` ← index.ts:53; `internal-payment-routes` ← storefront.ts:33,1826; settings hub components refs 1–8; marketplace loggers/Unavailable components imported by pages/services |
| E38 | Dart unchanged; responsive trio "refs" are docs-only | 181 non-test `.dart`; widget greps → 0; `packages/dart/core/AGENTS.md:58-61` is a Key Files listing |
| E39 | 838 TS/TSX at HEAD (same exclusions) | `find apps packages services -name '*.ts(x)'` excl. node_modules/.next/dist/.turbo/build/coverage/test-results |
