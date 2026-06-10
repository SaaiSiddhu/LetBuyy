<!-- CODEX MISSION PROMPT. Paste this entire file to Codex as the task brief, or point Codex at this path. Single-go, autonomous, FULL-STACK execution. Scope: the entire LetBuyy Apps Marketplace vertical across apps/, services/, packages/, and database/. Supersedes the boundary-scoped V1 (docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION.md). -->

# CODEX MISSION — LetBuyy Apps Marketplace Foundation Hardening (V2 · full-stack · single-go)

> **You are Codex.** Your job is to take the LetBuyy Apps Marketplace from "a strong platform skeleton wearing a marketplace costume" to a **fundamentally strong, end-to-end-real foundation** — in a **single autonomous run**, across the **whole stack** (front-end, gateway, queue workers, shared packages, and database). Work the full 100-issue register from the audit in priority order, commit as you go, keep the governance validators green, and **never stop for a human**: when a step needs a business decision, a secret, a legal sign-off, production infra, or a production migration apply, do every part you *can* do in code, then log it `SKIPPED (HUMAN-APPROVAL)` with a precise unblock note and continue. Read this entire file before writing any code.

This is **the foundation phase**. Depth and correctness beat breadth-of-the-moment. No theater, no fake data, no dead controls left behind.

---

## 0. Non-negotiables (read first)

1. **FULL-STACK OWNERSHIP, ONE OWNER.** Unlike V1, there is **no parallel task**. You own the entire marketplace vertical and may create/modify/delete across all of:
   - `apps/app-marketplace/**` (storefront + developer surfaces + BFF routes)
   - `services/api-gateway/src/routes/app-store/**`, `services/api-gateway/src/routes/app-api.ts`, and the marketplace-relevant middleware (`middleware/app-auth.ts`, `middleware/auth.ts`, `lib/rbac.ts`, `lib/rateLimit.ts`, `index.ts` wiring) — **only the app-store/app-api surface**, not unrelated domains.
   - `services/queue-workers/**` (payout settlement, marketplace event consumers) and the gateway's `queue-execution.adapter.ts` payout writer.
   - `packages/billing-core/**`, `packages/app-engine/**`, `packages/typescript/api-client/**` (the `appStore` namespace), `packages/typescript/shared-types/**`, `packages/typescript/ui/**` (marketplace-used primitives only), `packages/auth-core/**` (app-token/OAuth helpers only).
   - `database/supabase/migrations/**` — **add new forward migrations only** (never edit `000_baseline.sql` or any applied migration in place).
   - `docs/apps-marketplace-audit/**` and the mission ledger/status files you own (§6).
2. **STAY IN THE MARKETPLACE LANE.** You may touch shared packages and the gateway, but **only the code paths the Apps Marketplace depends on**. Do not refactor unrelated domains (storefront, themes, checkout, identity, merchant-control-plane) except where a cited issue requires it, and then minimally. If a change to a shared package would ripple into other apps, keep it **additive and backwards-compatible**.
3. **GOVERNANCE IS LAW.** Run `node scripts/validate-governance.mjs` after every wave. It enforces domain boundaries, **single-writer table ownership**, fail-closed internal routes, single-source helpers (INR/date/crypto/logger), route line-count (<=1500), and topology honesty. **It must pass** (ignore only the pre-existing `node_modules` "stale artifact" line, which is a local-install artifact, not your change). Also obey root `AGENTS.md`, each local `AGENTS.md`, and `docs/governance/`.
4. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs a human/business/legal decision, a secret/key, production data, infra provisioning, or applying a migration to a real environment, mark it `SKIPPED (HUMAN-APPROVAL)` in the ledger with an exact unblock note, implement every in-code part anyway, and continue. See §5 for the pre-identified skip catalog.
5. **TRUTH OVER THEATER — the prime directive of this mission.** Zero fake data, fake metrics, fake reviews, unconditional "trust" badges, or copy that leaks internal state (no `Flag: NEXT_PUBLIC_*`, no `SKIPPED (HUMAN-APPROVAL)`, no "contract-gated"/"pending business approval" strings shown to end users). If a feature isn't ready, **hide it** or show an honest, generic empty/loading/error state — never narrate the internal reason. Every badge must be backed by real data; every control must do something or not exist.
6. **GREEN BEFORE DONE.** Every wave ends with `typecheck`, `lint`, `build`, and `test` passing for **every workspace you touched** plus `node scripts/validate-governance.mjs` (§9). Migrations must apply cleanly to a local Supabase and be reversible. Don't mark an issue `DONE` if anything you touched is red.
7. **EVIDENCE OR IT DIDN'T HAPPEN.** Every closed issue gets a ledger row: files changed, how you verified it, and the validator/test result (§6).
8. **NO SCOPE INVENTION.** Implement exactly the 100 issues in §7 (plus correctness defects you discover, logged as `FOUND-###`). Don't wander into refactors no issue requires. Don't add new runtime roots, packages, or top-level config without a cited issue.
9. **DECIDE THE DEFAULT, FLAG THE SIGN-OFF.** Where the audit found a contradiction with an obvious correct resolution (e.g. one revenue-share number), **implement the documented/standard default now** from a single source of truth and log the *business confirmation* as SKIPPED — do not leave the contradiction live.

---

## 1. Mission context — what you are hardening

The Apps Marketplace is a **Next.js 16 / React 19 thin client** (`apps/app-marketplace`) over a **Hono API gateway** app-store surface (`services/api-gateway/src/routes/app-store/*` + `app-api.ts`, 33 endpoints) backed by **Supabase Postgres** (12 `marketplace_*`/`app_*` tables), with shared logic in `@letbuyy/billing-core`, `@letbuyy/app-engine`, `@letbuyy/api-client` (`appStore` namespace, 26 methods), `@letbuyy/auth-core`, and `@letbuyy/ui`. Payout/event side effects run through `services/queue-workers` and the gateway `queue-execution.adapter.ts`.

**The verdict you are fixing (from the audit): platform B−, marketplace experience D.** The platform primitives are real (OAuth/PKCE, enforced scopes, extension/function model, the 3 mandatory GDPR webhooks, idempotent install). The failures are: empty catalog; 10/26 SDK methods never surfaced; visible governance theater; no app update/versioning; payouts that never settle; a 15%-vs-20% revenue contradiction; dropped registration data; dead/placeholder UI.

**Authoritative sources you MUST read before writing code (your issue source of truth):**
- `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` — verdict, architecture, the **nine lifecycle flows (§1.3)**, merchant/developer experience, the **Top-100 register (§6 / Phase 17)**, brutal review. **Issue numbers in this mission match that register.**
- `docs/apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md` — the **"backend exists / UI missing" table (§A)** = your cheapest wins.
- `docs/apps-marketplace-audit/APP_PLATFORM_ARCHITECTURE_AUDIT.md` — auth/scopes/webhooks/billing/RLS specifics with file:line.
- `docs/apps-marketplace-audit/APP_INSTALLATION_JOURNEY_AUDIT.md`, `APP_DISCOVERY_AUDIT.md`, `APP_REVIEW_SYSTEM_AUDIT.md` — the journeys to make real.
- `docs/apps-marketplace-audit/APPS_CONTENT_GAP_ANALYSIS.md` — the exact theater strings to delete.
- `docs/apps-marketplace-audit/MERCHANT_TRUST_SCORECARD.md`, `DEVELOPER_TRUST_SCORECARD.md`, `ECOSYSTEM_SCALABILITY_REPORT.md`, `APPS_MARKETPLACE_UI_UX_AUDIT.md`, `APPS_RESPONSIVENESS_REPORT.md`, `SHOPIFY_APP_STORE_COMPARISON.md`.
- `docs/apps-marketplace-audit/LETBUYY_APPS_MARKETPLACE_V2.md` — **the target design you build toward** (IA, discovery, billing, lifecycle, review, analytics, data model additions, phased roadmap).
- Root `AGENTS.md` + each touched workspace's `AGENTS.md` + `docs/governance/`.

---

## 2. The insight that makes this finishable in one run

**Most of the "missing" marketplace is un-wired, not un-built.** The audit confirms the platform already implements the hard, get-them-wrong-and-rebuild primitives. Your job is mostly **finishing the wiring and operationalizing the lifecycle/economics**, plus targeted new build. Three buckets:

- **Bucket A — wire what exists (cheap, do first):** 10 of 26 `appStore` SDK methods are never called by any UI (`oauthAuthorize/oauthToken/oauthTokenExchange`, `createCharge/approveCharge`, `extensionRegistry/updateExtensionRegistration/updateFunctionRegistration`, `embedSession`, `bridgeFetch`) plus the public developer profile endpoint. Build the BFF routes + UI; the gateway already does the work.
- **Bucket B — finish the lifecycle/economics (new build, the spine):** app update/versioning, payout settlement, one revenue rate, self-serve approval, real submission checks, media upload, registration integrity, pricing plans/usage/trials.
- **Bucket C — earn discovery & trust, then harden & scale:** real taxonomy/curation/recommendations, real "Built for LetBuyy" program, reviews/abuse, analytics, RLS/rate-limit/quotas, and minimal real versions of the reserved scale services.

Always prefer wiring an existing capability over inventing a new one. When you add a gateway endpoint, add the matching `@letbuyy/api-client` `appStore` method **and** the marketplace BFF route + UI in the same wave so nothing is half-wired.

---

## 3. Ownership discipline & single-writer rule (do not break governance)

Full-stack ownership does **not** mean "edit anything." The validators enforce **single-writer table ownership** (one module owns writes to each table) and **domain boundaries**. Follow these:

1. **One writer per table.** Marketplace tables are written only by the app-store routes / queue workers that already own them (`marketplace_apps`, `app_installations`, `app_billing_charges`, `partner_payout_ledger_entries`, `marketplace_review_records`, `app_extension_registrations`, …). New tables you add (`app_versions`, `app_pricing_plans`, `app_install_events`, …) get a single declared writer module — document it where the validator expects (e.g. the route/service ownership manifest) and run the validator.
2. **Migrations are forward-only and reversible.** Add new files under `database/supabase/migrations/NNN_*.sql` (next number after the highest existing). Never edit `000_baseline.sql` or any prior migration. Every new table: PK, FKs, indexes, `updated_at` trigger, and **real RLS** (service-role + owner/tenant predicate) — match the pattern of `076_app_extension_registry.sql`, not the blanket-`service_role` pattern of the legacy 7 tables.
3. **Shared-package changes are additive & backwards-compatible.** `@letbuyy/api-client`, `@letbuyy/shared-types`, `@letbuyy/billing-core`, `@letbuyy/app-engine`, `@letbuyy/ui` are consumed by other apps. Add fields/methods; don't break existing signatures. If a breaking change is unavoidable, that's `SKIPPED (HUMAN-APPROVAL)` (cross-domain blast radius needs sign-off) — implement behind a new additive API instead.
4. **Single-source helpers.** Reuse `@letbuyy/ui/formatting` (INR/date), the gateway `lib/crypto.ts`, the marketplace logger, and `@letbuyy/api-client` base-URL helpers — the validator fails on duplicated implementations.
5. **Generated files.** Never hand-edit any `AGENTS.md` or generated topology/intelligence file; regenerate via the script and commit the diff (§9).
6. **Tenant isolation via `site_id`.** New tenant-scoped tables use `site_id` referencing `public.sites` (not a new `store_id`); part of issue #9 is converging the existing `store_id` usages — do it additively (keep a compatibility view/column if needed) and never with a destructive rename on applied data.

---

## 4. Execution model (single-go, wave-based)

Work top-to-bottom through Waves 0→11. Each wave: implement every issue in it across all needed layers (db → package → gateway → api-client → BFF → UI), run §9 gates, commit per issue, update the ledger/status. **Do not reorder priorities and do not stop between waves.**

- **Wave 0** — Guardrails, truth cleanup, domain migration, baseline green.
- **Wave 1** — Money path: one revenue rate, payout settlement, pricing plans, usage/trials, charge UI, spend controls.
- **Wave 2** — App lifecycle: update/versioning, registration integrity, self-serve approval, real submission checks, media upload.
- **Wave 3** — Wire the platform-to-UI gap: OAuth install, extension/embed management, public dev profile, scope review/revocation, post-install onboarding.
- **Wave 4** — Discovery: catalog seed mechanism, DB taxonomy, real collections, recommendations/compare, search depth, discovery analytics.
- **Wave 5** — Trust, reviews, content: Built-for-LetBuyy program, reviews replies/abuse, partner directory, data-handling, app health/SLA, event logs.
- **Wave 6** — Developer analytics & tooling: time-series analytics, webhook management, collaborator/agency, sandbox/demo, telemetry sink.
- **Wave 7** — Hardening: OAuth rate limits, real RLS, quotas, GDPR real triggers, tenant-column convergence.
- **Wave 8** — Scale services (reserved): minimal-real search/analytics/event-bus/media/notification + webhook retries/DLQ (infra parts SKIPPED).
- **Wave 9** — Responsiveness/UX/a11y/i18n: fluid type, mobile-first, tokens, skeletons, lightbox, captions, dark-mode QA, WCAG, multi-currency.
- **Wave 10** — Growth & polish: saved/recently-viewed, category SEO, request-an-app, new-this-week, bundles, cross-store reviews.
- **Wave 11** — Ops, docs, governance reconcile, final full validation + status rollup.

**Commit discipline:** one commit per issue or tight group; message `feat(marketplace): #NN <short> [waveN]` / `fix(marketplace): …` / `feat(db): #NN <migration> [waveN]`. After route/page/export/topology changes, regenerate repository intelligence and commit only the regenerated `AGENTS.md`/topology diffs (§9) — never hand-edit them.

---

## 5. Skip protocol & the pre-identified human-approval catalog

When a step needs a human, log this and continue:

```
- #NN <title> — SKIPPED (HUMAN-APPROVAL)
  Reason: <business decision / secret / legal sign-off / infra / prod migration>
  Unblock: <exactly what a human must provide or decide>
  Done anyway: <every in-code part you implemented + how it degrades honestly>
```

**Pre-identified skips (implement everything except the human bit):**

| Issue | Implement now | SKIP (needs human) |
|---|---|---|
| #4 revenue share | Single-source the rate from one constant used by code, docs, and UI; **set default = 15% (8500 bps)** to match the docs/market and remove the 20% contradiction | Final business/legal confirmation of the exact rate & effective date |
| #1 catalog seed | Build a seed mechanism + a few clearly-labeled **first-party** demo apps; gate "demo" labeling honestly | Which real launch-partner apps to onboard (content/legal/BD) |
| #3 payout settlement | Build the ledger state machine (`pending→processing→released/failed`), a transfer-adapter interface, sandbox/dry-run path, statements | Live RazorpayX/Route credentials & go-live approval |
| #21 media upload | Build upload pipeline, validation, signed-URL flow, DB wiring | Production bucket/CDN provisioning + keys |
| #20 review policy / ToS / rubric | Build the pages + structure + a `app_review_policies` source | Final legal/policy wording |
| #28 domain migration | Change all `letbuyy.store` code refs → `letbuyy.com`; centralize host config | DNS/cert/infra cutover |
| #38 security scan | Build the scan hook + a basic in-house static/manifest check that gates the queue | Paid security-vendor selection & keys |
| #50/#93 sandbox/test stores | Build the provisioning flow + UI | Infra provisioning approval |
| #8/#9/#59 prod migration apply | Write + apply migrations **locally**; verify | Applying migrations to staging/prod |
| KYC/identity policy (dev onboarding) | Build the fields/flow | Policy definition & legal |
| Multi-region (scale) | Design notes only | Infra |

Anything that would (a) break a shared package's existing API, (b) apply a migration to a real environment, (c) touch secrets, or (d) edit root `AGENTS.md`/add a runtime name → **SKIPPED (HUMAN-APPROVAL)**, with the in-code part done.

---

## 6. Ledger & status (you create and maintain at repo root)

- `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_LEDGER.md` — one row per issue:
  `| #NN | title | wave | layers (db/pkg/gw/bff/ui) | status (DONE/PARTIAL/SKIPPED) | files changed | verification (tests/validator) |`
- `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md` — rollup after every wave: counts by status, % of issues DONE, open SKIPPED items with unblock notes, new tables/migrations added, and the exact commands last run + result (typecheck/lint/build/test per workspace + `validate-governance.mjs`).

Keep both honest and current after every wave. These are the proof the foundation is real.

---

## 7. The full issue register (all 100, by wave, full-stack)

Layers key: **db** = migration/schema · **pkg** = shared package · **gw** = api-gateway route/middleware · **bff** = marketplace `/api/*` route handler · **ui** = marketplace page/component. Issue numbers match `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` §6 (Phase 17). Every issue 1–100 appears exactly once (primary wave); cross-wave dependencies are noted.

### Wave 0 — Guardrails, truth cleanup, domain (no new capability)

First: create the §6 ledger/status files, run the §9 baseline, and inventory every `NEXT_PUBLIC_MP_*` flag.

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 28 | Stale `letbuyy.store` domain | ui | Replace every `letbuyy.store` ref with `letbuyy.com`; centralize host in one config helper (`Footer.tsx`, `proxy.ts:7` `ACCOUNTS_URL`, `apps/new` slug hint `:176`, layout/SEO) | No `letbuyy.store` in source (grep clean); host from one source |
| 36 | 9 empty BFF route folders | bff | Remove the dead empty `api/*` folders (charges, oauth/authorize, installations/*, etc.) — they're re-created properly when their wave wires them | No empty route dirs; tree honest |
| 41 | `experiments.ts` ignores its arg | ui | Either implement real per-experiment assignment or delete the module + `experiments` flag | No stub that pretends to be a framework |
| 42 | 18 of 20 capability flags gate nothing | ui | **Wire-or-delete policy:** every `NEXT_PUBLIC_MP_*` flag must gate a real surface by end of mission; in Wave 0 delete the ones with no planned owner and document the rest in STATUS | No flag that gates nothing remains |
| 73 | Emoji `🔑` in sign-in state | ui | Replace with `@letbuyy/ui` icon (`my-apps:38`) | No emoji as UI icon |
| 74 | "Collections" nav → single collection | ui | Point nav at a real `/collections` index (built Wave 4); until then link Browse | No misleading deep-link |
| 75 | Footer doc links likely dead | ui | Point to canonical docs path; real docs scaffolded Wave 11 | Links resolve to a real route |
| 18a/19a/20a | Stop leaking governance copy | ui | Remove every `Flag: NEXT_PUBLIC_*`, `SKIPPED (HUMAN-APPROVAL)`, "contract-gated", "pending business approval" string from user-facing copy (`partners/page.tsx:26`, `developers/[slug]:38`, `review-requirements:35`, `apps/new:307,358`, `AppInstallConsentPanel:91`) | No internal state in UI; full builds land in W3/W5 |

### Wave 1 — Money path (P0 economics)

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 4 | Revenue-share contradiction (20% vs 15% vs "pending") | pkg, ui, docs | Single-source the rate: keep `DEFAULT_APP_REVENUE_SHARE_BPS` as the one constant (`billing-core/src/index.ts:269`), **set it to 8500 (partner 85% / platform 15%)** to match docs/market; reference it everywhere (route `:150`, outbox `shared.ts:501`, payout writer `queue-execution.adapter.ts:449`); UI shows the real number, not "pending"; reconcile audit docs. **SKIP** final business confirmation | One rate, code=docs=UI; no hardcoded duplicates; SKIP logged |
| 35 | Pricing taxonomy mismatch | db, pkg, ui | Unify the enum across display (`marketplace-display.ts:33`), `marketplace_apps.pricing_model` CHECK, and `AppChargeBillingModeSchema` (`billing-core:69`): one canonical set incl. `free/freemium/recurring/one_time/usage` | Same enum everywhere; no "usage_based→not supported" dead branch |
| 60 | No pricing plans/tiers | db, pkg, gw, api-client, bff, ui | New `app_pricing_plans` table (+RLS); plan CRUD for developers; plan display + selection at install | Apps can define named plans/tiers; merchant picks a plan |
| 23 | No trial support | db, pkg, gw, ui | Add trial fields to charge/plan schema (`billing-core:80`); enforce trial→active transition; show "X-day trial" honestly | Trials capturable, billed correctly after trial |
| 22 | No usage metering | db, pkg, gw, api-client, bff, ui | Add a usage-event ingest endpoint + meter aggregation for `usage` mode; developer usage UI | `usage` charges actually meter & bill |
| 3 | Payouts never settle | db, gw, queue | Add ledger state machine (`pending→processing→released/failed`) + transfer-adapter interface + sandbox/dry-run + statements + idempotency; wire the `app.charge.activated` consumer to advance state (`queue-execution.adapter.ts:458`). **SKIP** live RazorpayX keys/go-live | Ledger advances in sandbox; "Released" reflects real state; SKIP logged |
| 82 | Payout ledger missing FKs | db | New migration adds FKs for `partner_payout_ledger_entries.charge_id`→`app_billing_charges`, `source_event_id`→event/outbox | FK integrity enforced |
| 10 | Paid-app billing has no UI | api-client, bff, ui | Wire `createCharge`/`approveCharge` (`billing-oauth-routes.ts:62,208`) into a charge-approval surface in My Apps + Partner Console + install | Merchant can review/approve/decline a charge end-to-end |
| 62 | No merchant spend controls | db, gw, ui | Add per-store app spend caps/alerts | Merchant can set a cap; over-cap charges blocked/flagged |
| 63 | No uninstall feedback | db, gw, bff, ui | Capture churn reason on uninstall (optional, honest) | Reason persisted when given |

### Wave 2 — App lifecycle (P0)

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 2 | No app update/versioning | db, pkg, gw, api-client, bff, ui | New `app_versions` table (+RLS); `PATCH /developers/apps/:id` + `POST /developers/apps/:id/versions`; edit + "new version" UI; bump `marketplace_apps.version`; **re-review on update** (new `marketplace_review_records` row) | Developer edits listing & ships v2; dashboard "Edit unavailable" badge removed (`dashboard:309`) |
| 46 | Changelog has no source | db, gw, ui | Populate changelog from `app_versions`; render real release notes (`apps/[slug]:509`) | Changelog shows real versions |
| 92 | No staged rollout | db, gw, ui | Add rollout controls (percentage/cohort) on version publish | Versions can roll out gradually |
| 6 | Registration drops GSTIN + consent | ui, gw, db | Send `tax_id`, `agreed_tos`, `agreed_privacy` in the register payload (`register/page.tsx:46-52`); persist consent with timestamp+policy version | All fields transmitted & stored; consent auditable |
| 5 | Approval not self-serve | gw, db, ui | Add a `pending→approved` review/approval endpoint + ops action + applicant status page; gate submit on approval (`rbac.ts:55`, `app-engine:88`). **SKIP** KYC policy | Developers progress without manual DB edits; SKIP logged for KYC |
| 7 | Submission checks hardcoded `passed` | gw, pkg | Replace the hardcoded `automated_checks` (`developer-routes.ts:683`) with real manifest/scope/redirect/URL checks that **block** the queue on hard failure | Checks reflect reality; bad submissions blocked |
| 38 | No security scan of submissions | gw, pkg | Add a scan hook + basic in-house static/manifest check before human review. **SKIP** paid vendor | Basic scan runs; SKIP logged for vendor |
| 21 | Icon/screenshot upload is dead UI | gw, bff, ui | Implement real media upload (validation + signed URL + DB wiring) (`apps/new:233-246`). **SKIP** prod bucket/CDN | Uploads work to local/sandbox storage; SKIP logged |
| 45 | Screenshots placeholder when none | gw, ui | Require ≥1 screenshot at submit; stop rendering 3 fake placeholders (`apps/[slug]:319`) | Listings have real media or none (no fake tiles) |

### Wave 3 — Wire the platform-to-UI gap (backend already exists)

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 12 | OAuth install flag throws | api-client, bff, ui | Implement the OAuth BFF route on `oauthAuthorize`/`oauthToken` (`billing-oauth-routes.ts:530,725`); remove the throw (`AppInstallConsentPanel:90`) | OAuth install works end-to-end |
| 29 | Two install paths | gw, ui | Make OAuth the canonical path; keep direct-token internal-only (`install-lifecycle-routes.ts:128`) | One documented install path |
| 11 | Extension config is a stub | api-client, bff, ui | Replace `ExtensionConfigPanel` stub with real config on `extensionRegistry`/`updateExtensionRegistration`/`updateFunctionRegistration` (`extension-routes.ts:73,149,223`) | Merchants enable/disable extensions/functions |
| 47 | Embedded launch unused (`embedUrl` null) | api-client, bff, ui | Wire `embedSession` (`extension-routes.ts:297`) for in-admin embedded launch (`AppInstallConsentPanel:67`) | Embedded apps launch via real session |
| 67 | No deep-link into admin for embedded apps | ui | Deep-link from My Apps into the embedded session | Launch lands in-context |
| 19 | Public developer profiles are placeholders | gw, bff, ui | Build profile from `GET /developers/:id` (`developer-routes.ts:842`) replacing the flag-name shell (`developers/[slug]`) | Real profile renders |
| 84 | No granted-scopes review post-install | gw, bff, ui | Show granted scopes per installation in My Apps | Merchant sees what each app can access |
| 85 | No per-scope revocation | gw, api-client, ui | Add scope revoke/re-consent flow | Merchant can revoke a scope |
| 66 | No post-install onboarding | ui | Setup checklist + first-run guide after install | Honest setup guidance shown |

### Wave 4 — Discovery (earn the surfaces)

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 1 | Empty catalog | db, gw | Build a catalog **seed mechanism** + a few clearly-labeled first-party demo apps; gate discovery rails on real depth (#16). **SKIP** real partner onboarding | Store is non-empty with honest first-party apps; SKIP logged |
| 55 | Hardcoded taxonomy ("Doc 15 §4") | db, gw, ui | Move categories to a DB-backed, admin-governed taxonomy with counts; `constants/categories.ts` becomes fallback only | Categories from API; counts real |
| 15 | 14/29 categories hidden in search | ui | Render all categories from the API (remove `slice(0,15)`, `search/page.tsx:154`) | All categories selectable |
| 14 | Fake collections | db, gw, ui | Real `app_collections` curation table; remove the self-incriminating re-sort copy (`collections/[slug]:13,19,25`) | Collections are real curated sets |
| 44 | No `/collections` index | ui | Build a collections index page | Index lists real collections |
| 43 | Orphan collections | ui | Link or remove `trending`/`made-in-india` (make them real or drop) | No orphan routes |
| 16 | Rails over empty catalog | ui | Gate every discovery rail on real catalog depth | Rails hidden when nothing to show |
| 33 | No compare | ui | Compare tray (up to 3 apps) | Side-by-side compare works |
| 34 | Weak recommendations | gw, ui | "Works with", "alternatives", "also installed" beyond same-category-3 (`apps/[slug]:183`) | Useful recommendations |
| 49 | No alternatives/switching | ui | Surface alternatives on detail | Alternatives shown |
| 56 | No featured/sponsored model | db, gw, ui | Featured-inventory model + rules feeding the `featuredRails` surface | Featured is data-driven, disclosed |
| 48 | No search pagination | gw, ui | Pagination/infinite scroll using `total/page/limit` (`search/page.tsx:69`) | Results paginate |
| 39 | Rating filter client-only | gw, ui | Push rating filter server-side (`search/page.tsx:83`) | Rating filter reaches whole catalog |
| 83 | No discovery analytics | gw, ui | Instrument search terms, zero-results, CTR via the analytics pipeline (W6/W8) | Discovery events captured |

### Wave 5 — Trust, reviews, content

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 17 | `built_for_letbuyy` has no column | db, gw, ui | Add the column + populate only via the program (#31); badge reads real data (`marketplace-display.ts:49`) | Badge backed by data |
| 31 | No "Built for LetBuyy" program | db, gw, ui | Define perf/design/integration criteria + a backing table + periodic re-check; award the badge | Program awards/revokes the badge |
| 26 | No developer review replies | db, gw, bff, ui | Developer response to reviews | Replies render under reviews |
| 27 | Report buttons disabled | gw, bff, ui | Implement abuse reporting for reviews + listings (`apps/[slug]:493,617`) | Reports submit & queue |
| 64 | Thin review verification | gw | Strengthen verified-install proof | Only verified installs can review |
| 99 | No review fraud controls | gw | Add basic fraud/abuse detection beyond one-per-user | Suspicious reviews flagged |
| 65 | No moderation queue UI | gw, ui | Surface `reviewModeration` queue (ops) | Moderators can act |
| 90 | No data-handling disclosure at submit | gw, ui | Require structured data-handling disclosure; render it | Disclosure required & shown |
| 91 | No app dependency/conflict detection | gw, ui | Detect conflicting apps at install | Conflicts warned |
| 52 | No app health/status to merchants | gw, ui | Surface uptime/incident from `status_url` | Health shown when present |
| 53 | No SLA signal | db, gw, ui | Capture + display support SLA | SLA shown when set |
| 54 | No "works with" data source | db, gw, ui | Real compatibility metadata (not tags) (`apps/[slug]:205`) | Compatibility data-driven |
| 37 | No merchant app activity log | db, gw, ui | Install/permission/billing activity feed | Activity visible to merchant |
| 94 | No app event log (installed/charged/updated) | db, gw, ui | Merchant-facing event history | Events listed |
| 18 | Partner directory placeholder | gw, bff, ui | Build a real partner directory (or remove if not launching) replacing the flag-name shell (`partners:26`) | Directory real or gone |
| 20 | review-requirements placeholder | db, gw, ui | Publish real review policy/rubric/SLA from an `app_review_policies` source; structure now. **SKIP** final legal wording | Policy page real; SKIP logged for legal text |

### Wave 6 — Developer analytics & tooling

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 24 | No install/revenue analytics (snapshot only) | db, gw, ui | Add time-series install/uninstall/revenue/usage tables + endpoints; replace the one-shot `partnerDashboard` snapshot (`developer-routes.ts:517`) | Console shows trends over time |
| 57 | Dashboard has no charts | ui | Add charts to the Partner Console | Time-series charts render |
| 58 | No per-app API usage metrics | db, gw, ui | Expose request/error/latency per app | Developers see API metrics |
| 25 | No developer webhook management | db, gw, api-client, bff, ui | CRUD for app webhook endpoints (give `app_webhooks` a real writer) | Developers register/list/update/delete webhooks |
| 30 | `app_webhooks` has no writer | db, gw | Wire the writer behind #25 (or drop the table if replaced) | Table is alive or gone — not dead |
| 13 | Collaborator code non-functional | db, gw, api-client, ui | Persist codes + redemption endpoint + agency seat model (`shared.ts:242`) | Codes redeem; agencies get seats |
| 96 | No partner tiers/badges | db, gw, ui | Partner program tiers (e.g. silver/gold) | Tiers awarded & shown |
| 93 | No dev sandbox/test stores | gw, ui | Provisioning flow + UI. **SKIP** infra provisioning | Flow works in sandbox; SKIP logged |
| 50 | No app demo/test-drive | gw, ui | Demo/preview path for merchants | Merchants can try before install |
| 40 | Telemetry has no sink | pkg, gw, ui | Wire `telemetry.ts` events to the analytics pipeline (W8) | Events reach a real sink |

### Wave 7 — Hardening & security

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 8 | No dedicated OAuth brute-force limit | gw | Add a strict per-client limiter to `/oauth/token`,`/authorize`,`/bridge/fetch` like `/auth/*` (`index.ts:543,570`, `rateLimit.ts`) | Credential-guessing limited beyond the coarse IP bucket |
| 9 | 7 core tables: blanket `service_role` RLS only | db | New migration adds owner/tenant RLS predicates to `marketplace_apps`,`app_developers`,`app_categories`,`app_extensions`,`app_installations`,`app_reviews`,`app_webhooks` (`000_baseline.sql:24311+`); converge `store_id`→`site_id` additively. **SKIP** prod apply | Real row isolation locally; SKIP logged for prod apply |
| 59 | No rate-limit/quota accounting per app/install | db, gw | Add quota table + per-app/install accounting + response headers | Quotas enforced & visible |
| 32 | GDPR `customers/redact` only fires on manual POST | gw, queue | Trigger compliance webhooks from the real customer/shop record lifecycle, not just merchant fan-out (`compliance-routes.ts:135`) | Redaction fires on actual deletion |

### Wave 8 — Scale services (reserved → minimal-real)

No new register numbers; this wave makes earlier issues hold at 1k–10k apps by standing up minimal-real versions of the reserved services (per `ECOSYSTEM_SCALABILITY_REPORT.md`). Build the code; **SKIP** cloud provisioning/secrets/multi-region.

| Capability | Layers | Action | Deepens |
|---|---|---|---|
| Search ranking + pagination at scale | gw | Real relevance ranking behind the search endpoint (reserved `services/search-service` minimal-real) | #39,#48 |
| Analytics pipeline sink | gw, queue | A real ingest+store for discovery/telemetry/usage events (reserved `services/analytics-pipeline` minimal-real) | #24,#40,#58,#83 |
| Event bus + notification delivery | queue | Reliable webhook delivery with **retries + DLQ** (reserved `services/event-bus`/`notification-service` minimal-real) replacing fire-and-forget (`shared.ts:553`) | #25,#32 |
| Media service + CDN wiring | gw | Real media storage/serving behind the upload pipeline (reserved `services/media-service` minimal-real). **SKIP** bucket/CDN provisioning | #21,#45 |
| Multi-region notes | — | Design notes only. **SKIP** infra | scale |

### Wave 9 — Responsiveness, UX, a11y, i18n

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 68 | Desktop-first CSS, no fluid type | ui | Add `clamp()` fluid type for hero/section/title sizes (`globals.css`) | Type scales between breakpoints |
| 69 | Only `page.tsx` uses responsive prefixes | ui | Standardize a mobile-first responsive system across pages/components | Consistent responsive behavior |
| 70 | Tokens split (undefined `--lb-*` locally) | ui, pkg | Consolidate token source (or document the `@letbuyy/ui` split clearly) | One token source of truth |
| 71 | No skeleton parity | ui | Skeletons on every async surface | Loading states everywhere |
| 72 | Retry only on search page | ui | `MarketplaceUnavailable` retry everywhere | Retry available on all error states |
| 76 | Missing breadcrumbs | ui | Consistent breadcrumbs on store pages | Breadcrumbs present |
| 88 | Anchor-only screenshot lightbox | ui | Real JS lightbox (`apps/[slug]:329`) | Lightbox works |
| 89 | Demo video `<track>` has no captions | ui | Add caption source / require captions (`apps/[slug]:344`) | Captions present |
| 87 | No dark-mode QA | ui | QA marketplace surfaces in dark mode; fix raw colors | No broken dark-mode surfaces |
| 98 | No a11y audit evidence | ui | WCAG pass on install modal/forms (keyboard + ARIA) | A11y basics pass |
| 86 | i18n only 5 strings | ui, pkg | Real i18n scaffold + key coverage (`i18n/messages.ts`). **SKIP** translations | Scaffold ready; SKIP logged |
| 51 | INR-only | pkg, gw, ui | Multi-currency display + pricing scaffold | Currency-aware display |

### Wave 10 — Growth & polish

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 77 | No "request an app" CTA on empty states | gw, ui | Demand-capture form on empty/zero-result states | Requests captured |
| 78 | No saved/wishlist apps | db, gw, ui | Saved apps per merchant | Save/unsave works |
| 79 | No "recently viewed" | ui | Recently-viewed apps | Personalization shown |
| 80 | No category landing SEO content | gw, ui | SEO copy per category landing | Category pages have content |
| 95 | No "new this week"/editorial tie-in | gw, ui | Editorial "new this week" rail (data-driven) | Rail renders from real data |
| 61 | No app bundling/multi-app discounts | db, gw, ui | Bundle model + discounts | Bundles purchasable |
| 97 | No cross-store review proof | gw | Cross-store verification/import of reviews | Reviews provably from installs |

### Wave 11 — Ops, docs, governance reconcile, final validation

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 100 | No marketplace ops runbooks | docs | Write runbooks for catalog, ledger/payouts, review queue, incident response (`docs/runbooks/`) | Runbooks exist |
| 75 | Developer docs | docs | Scaffold real developer docs (API reference, manifest spec, getting-started) at the canonical path. **SKIP** hosting | Docs scaffolded; SKIP logged for hosting |
| 20 | Economics/policy pages | docs, ui | Publish economics (one revenue rate from #4), review policy, trust/security pages. **SKIP** final legal wording | Pages real; SKIP logged |
| — | Governance reconcile | docs | Reconcile `docs/governance/` + audit docs to the new reality; regenerate repository intelligence; run the full validator | `validate-governance.mjs` green; intelligence regenerated |

### 7.x — Coverage matrix (every issue 1–100 → primary wave)

`1`W4 · `2`W2 · `3`W1 · `4`W1 · `5`W2 · `6`W2 · `7`W2 · `8`W7 · `9`W7 · `10`W1 · `11`W3 · `12`W3 · `13`W6 · `14`W4 · `15`W4 · `16`W4 · `17`W5 · `18`W0→W5 · `19`W0→W3 · `20`W0→W5→W11 · `21`W2 · `22`W1 · `23`W1 · `24`W6 · `25`W6 · `26`W5 · `27`W5 · `28`W0 · `29`W3 · `30`W6 · `31`W5 · `32`W7 · `33`W4 · `34`W4 · `35`W1 · `36`W0 · `37`W5 · `38`W2 · `39`W4 · `40`W6 · `41`W0 · `42`W0 · `43`W4 · `44`W4 · `45`W2 · `46`W2 · `47`W3 · `48`W4 · `49`W4 · `50`W6 · `51`W9 · `52`W5 · `53`W5 · `54`W5 · `55`W4 · `56`W4 · `57`W6 · `58`W6 · `59`W7 · `60`W1 · `61`W10 · `62`W1 · `63`W1 · `64`W5 · `65`W5 · `66`W3 · `67`W3 · `68`W9 · `69`W9 · `70`W9 · `71`W9 · `72`W9 · `73`W0 · `74`W0 · `75`W0→W11 · `76`W9 · `77`W10 · `78`W10 · `79`W10 · `80`W10 · `81`W0 (folded into #28) · `82`W1 · `83`W4 · `84`W3 · `85`W3 · `86`W9 · `87`W9 · `88`W9 · `89`W9 · `90`W5 · `91`W5 · `92`W2 · `93`W6 · `94`W5 · `95`W10 · `96`W6 · `97`W10 · `98`W9 · `99`W5 · `100`W11

All 100 assigned. If you discover a real defect not in this list, add it as `FOUND-###`, fix it in the right wave, and log it.

---

## 8. File-level change map (where the work lands)

- **Database** (`database/supabase/migrations/NNN_*.sql`, forward-only, with RLS): `app_versions`, `app_pricing_plans`, `app_usage_events`/meters, `app_install_events` + analytics rollups, `app_collections`, `app_review_policies`, `app_api_quota`, `app_partner_tiers`, saved-apps, bundles; FKs on `partner_payout_ledger_entries`; owner/tenant RLS predicates on the legacy 7 tables; `built_for_letbuyy` + SLA/works-with columns; `store_id`→`site_id` convergence (additive).
- **packages/billing-core** — single revenue-rate constant (8500 bps), unified pricing enum, plans/tiers/trials/usage, payout split helpers.
- **packages/app-engine** — real submission checks, manifest/scope validation hardening, developer approval state, compliance-trigger wiring.
- **packages/typescript/api-client** (`appStore`) — add methods for new endpoints (versions, plans, usage, webhooks CRUD, analytics, profile, charges if missing); keep additive.
- **packages/typescript/shared-types** — new DTOs (versions, plans, analytics, webhooks, tiers).
- **packages/typescript/ui** — fluid-type tokens, lightbox, charts primitives, skeletons (marketplace-used only).
- **services/api-gateway/src/routes/app-store/** — update/version, plans, usage metering, charges UI support, extension/embed wiring, public profile, approval, webhook CRUD, analytics, moderation, abuse reports; `index.ts` rate-limit wiring; `lib/rbac.ts` approval transition; `lib/rateLimit.ts` OAuth limiter.
- **services/queue-workers/** + gateway `queue-execution.adapter.ts` — payout settlement state machine + transfer adapter; reliable webhook delivery (retries/DLQ); analytics ingest.
- **apps/app-marketplace/src** — BFF routes for every newly-wired capability; UI for charge approval, extension config, OAuth install, embedded launch, versions/edit, analytics charts, collections/index, compare, reviews/replies/reports, partner directory, profiles, onboarding, saved/recently-viewed; remove theater copy; domain migration; responsive/a11y/i18n; capability-flag wire-or-delete.
- **docs/** — reconcile audit + governance; runbooks; developer docs; economics/policy pages; the V2 ledger/status at repo root.

Keep business logic out of page components (per `apps/app-marketplace/AGENTS.md`): data shaping in `lib/`, calls through BFF routes/server components to `appStore.*`.

---

## 9. Definition of Done & green gates

An issue is **DONE** only when: every layer it needs is implemented; it degrades honestly if a SKIPPED dependency is unmet; the ledger row is filled (files + verification); and all gates below pass for every workspace you touched.

```bash
# per touched workspace (examples)
pnpm --filter @letbuyy/app-marketplace typecheck && pnpm --filter @letbuyy/app-marketplace lint && pnpm --filter @letbuyy/app-marketplace build && pnpm --filter @letbuyy/app-marketplace test
pnpm --filter @letbuyy/api-gateway   typecheck && pnpm --filter @letbuyy/api-gateway   lint && pnpm --filter @letbuyy/api-gateway   build && pnpm --filter @letbuyy/api-gateway   test
pnpm --filter @letbuyy/billing-core  typecheck && pnpm --filter @letbuyy/billing-core  test
pnpm --filter @letbuyy/app-engine    typecheck && pnpm --filter @letbuyy/app-engine    test
pnpm --filter @letbuyy/api-client    typecheck && pnpm --filter @letbuyy/api-client    build
pnpm --filter @letbuyy/queue-workers typecheck && pnpm --filter @letbuyy/queue-workers test

# migrations: apply to a LOCAL supabase and verify reversibility (never prod)
# (use the repo's local db tooling; do not apply to staging/prod — that's SKIPPED)

# governance — MUST pass after every wave (ignore only the pre-existing node_modules "stale artifact" line)
node scripts/validate-governance.mjs

# after route/page/export/topology/schema changes: regenerate, commit only the generated diffs
node scripts/generate-repository-intelligence.mjs
```

The **mission is complete** when: every issue 1–100 is `DONE` or `PARTIAL` with a precise SKIPPED note; the §6 ledger and status are current; all touched-workspace gates are green; `validate-governance.mjs` passes; repository intelligence is regenerated; and `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md` shows the rollup (counts, % DONE, open SKIPPED items, new tables/migrations).

---

## 10. First actions (do these now, in order)

1. **Read** `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` + all 13 sub-reports in `docs/apps-marketplace-audit/`, root `AGENTS.md`, each touched workspace `AGENTS.md`, and `docs/governance/`.
2. **Create** `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_LEDGER.md` and `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md` (repo root); inventory every `NEXT_PUBLIC_MP_*` flag and its planned owner.
3. **Baseline:** run the §9 gates once across the workspaces you expect to touch; record the clean baseline in STATUS.
4. **Execute Wave 0** end-to-end (truth cleanup + domain + guardrails), commit per issue, update ledger/status, re-run gates + `validate-governance.mjs`.
5. **Proceed Waves 1→11 without stopping.** For each issue: db → package → gateway → api-client → BFF → UI, in that order; mark SKIPPED where §5 says; keep the validator green; never leave theater or a dead control behind.

> The foundation is strong when a **merchant can discover, install, pay for, configure, and trust** an app, and a **developer can register, get approved, read real docs, know the revenue share, ship updates, see real analytics, and get paid** — with **no fake data and no internal state leaking into the UI**. Build toward `LETBUYY_APPS_MARKETPLACE_V2.md`. Decide the default, flag the sign-off, and do not block.

