<!-- CODEX MISSION PROMPT — point Codex at this file. Single-runtime scope: apps/theme-marketplace. Safe to run in parallel with other single-runtime missions.
     LOCATION NOTE: this mission + its ledger/status live under docs/themes-marketplace-audit/ (NOT repo root). Governance validator
     scripts/validators/source-ledger-residue-validator.mjs forbids any CODEX*.md at repo root (except a hardcoded allow-list) or under apps/services/packages. -->

# CODEX MISSION — Theme Marketplace Foundation Hardening (single runtime, single go)

You are Codex operating **locally** on the LetBuyy monorepo. This mission makes the **Theme Marketplace** runtime *fundamentally strong* by implementing the entire 100-issue backlog from the audit in **one continuous run**. Where a step needs a human decision, a cross-runtime/backend change, secrets, or legal/brand sign-off, **do not stop** — apply the safe in-boundary part, then **mark the remainder `SKIPPED` with a reason and a contract** and keep going. This mirrors the prior `CODEX_FOUNDATION_HARDENING_*` missions (`DONE`, `DONE locally/SKIPPED live`, `DONE/SKIPPED human-gated`).

## 0. Single source of truth & required reading

Authority order (obey top-down): root `AGENTS.md` → `apps/theme-marketplace/AGENTS.md` → `docs/governance/*` → this mission. If anything here conflicts with `AGENTS.md`, **AGENTS.md wins** and you log the conflict.

Read before editing (these are the evidence base; every issue ID below traces to them):
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — **Phase 15 "Top 100 issues" is the canonical backlog (issues #1–#100).**
- `docs/themes-marketplace-audit/SHOPIFY_THEME_STORE_COMPARISON.md`
- `docs/themes-marketplace-audit/THEME_MARKETPLACE_UI_UX_AUDIT.md`
- `docs/themes-marketplace-audit/THEME_CONTENT_GAP_ANALYSIS.md`
- `docs/themes-marketplace-audit/THEME_FEATURE_GAP_ANALYSIS.md`
- `docs/themes-marketplace-audit/THEME_DISCOVERY_AUDIT.md`
- `docs/themes-marketplace-audit/THEME_INSTALLATION_JOURNEY_AUDIT.md`
- `docs/themes-marketplace-audit/THEME_REVIEW_SYSTEM_AUDIT.md`
- `docs/themes-marketplace-audit/THEME_RESPONSIVENESS_REPORT.md`
- `docs/themes-marketplace-audit/MERCHANT_TRUST_SCORECARD.md`
- `docs/themes-marketplace-audit/DEVELOPER_TRUST_SCORECARD.md`
- `docs/themes-marketplace-audit/LETBUYY_THEME_MARKETPLACE_V2.md` — **target design; the phase plan below mirrors its roadmap.**

---

## 1. OWNERSHIP & BOUNDARY (hard rule — this is a single-runtime mission)

**You OWN and may modify ONLY:**
- `apps/theme-marketplace/**` (all source, config, public assets, app-local tests)
- Your two scoped tracking files **under docs (NOT root):** `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_LEDGER.md` and `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STATUS.md`
- You may *extend, not rewrite*, the three existing app tests referenced by `apps/theme-marketplace/package.json` (`tests/federation/theme-marketplace-thin-client.test.mjs`, `tests/auth/sso-redirects.test.mjs`, `tests/federation/theme-store-install-lifecycle.test.mjs`) — keep them green; only touch them if a behavior you ship requires it, and log it. Prefer adding new tests under `apps/theme-marketplace/**`.

**You MAY import (consume) but MUST NOT edit** the runtime's allowed workspace packages (`apps/theme-marketplace/runtime.manifest.json` → `allowedDependencies.workspacePackages`):
`@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, `@letbuyy/theme-engine`, `@letbuyy/ui`.

**You MUST NOT touch (these belong to other runtimes / coordination passes — editing them breaks parallel missions):**
- `packages/**` (incl. api-client, theme-engine, ui, shared-types, auth-core) — *consume only*.
- `services/**`, other `apps/**`, `database/**`, `infrastructure/**`, `legacy/**`, `generated-artifacts/**`.
- Root shared/config: `AGENTS.md`, root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `scripts/**` (incl. the governance validators), any other runtime's `CODEX_*` files.
- **Do NOT create any `CODEX*.md` at repo root or under `apps/`, `services/`, `packages/`.** The `source-ledger-residue-validator` fails on those. Your ledger/status live under `docs/themes-marketplace-audit/` only. (Registering a root mission file in the validator allow-list is a HUMAN/coordination change — **SKIP**; do not edit `scripts/`.)
- **Generated intelligence:** do **not** hand-edit any `AGENTS.md`. If route changes make it stale, **SKIP regeneration** and log it for the final coordination pass.

**PARALLEL-EXECUTION CONTRACT:** other Codex missions are running concurrently on other runtimes (you will see sibling `CODEX_*` churn at root — ignore it; it is not yours). Therefore: (a) every file you write is under `apps/theme-marketplace/**` or your two `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_*` files; (b) if a fix *requires* a change outside your boundary, you **do not make it** — implement the in-boundary half and record a `SKIPPED cross-boundary` entry naming the exact package/service/endpoint another mission must deliver. No exceptions.

---

## 2. PRIME DIRECTIVES (the foundation principles)

1. **No dead controls.** Never ship a button/link/input that implies a capability it does not have. If you can't make it real in-boundary → **remove or hide it** (that removal is in-boundary and is the fix), or gate it behind an off-by-default feature flag with an honest disabled state.
2. **No false or fabricated content.** No hardcoded metrics, no invented file sizes, no unverifiable claims, no engineering placeholders (e.g. `[SKIP - NEEDS BACKEND]`) in shipped UI. Numbers must be data-derived or removed.
3. **Honesty over completeness.** A truthful "not available yet / contact support" state beats a fake working one. This satisfies the audit.
4. **Consume, don't fork.** Use existing `@letbuyy/*` package methods (e.g. `api.themes.previewSession`, `api.themes.install`). Never reimplement them locally or edit the packages.
5. **Respect app runtime rules** (`apps/theme-marketplace/AGENTS.md`): business logic out of page components; no secrets/provider keys in client components; explicit tenant/store binding; design tokens + dark-mode CSS vars (no new hardcoded colors); skeletons over spinners; retryable error states.
6. **Green gates always.** After every phase: typecheck, lint, test, build for this app, plus governance validation, must pass for everything **you** changed. Never leave the app non-building. (Pre-existing failures from parallel missions — e.g. unrelated root `CODEX_*` residue — are not yours to fix; note them and proceed.)
7. **Log everything.** Every issue gets a ledger line with status + evidence. Silent changes are not allowed.

---

## 3. CLASSIFICATION PROTOCOL (apply to each of the 100 issues)

- **`IN` — In-boundary → IMPLEMENT now.** Fix lives entirely in `apps/theme-marketplace/**` (incl. consuming allowed packages). Do it.
- **`CROSS` — Cross-boundary → SKIP + contract + safe in-boundary half.** Needs `packages/*`, `services/*`, `database/*`, or another app. Implement the client-side scaffolding/guard/honest-state that *is* in-boundary, then log `SKIPPED cross-boundary` naming the exact endpoint/package/table required.
- **`HUMAN` — Needs human/legal/brand/secret decision → SKIP + DEFAULT.** Apply the **DEFAULT** named in §7, implement the reversible in-boundary part, and log `SKIPPED human-gated` with the decision needed.

**Ledger status vocabulary (match prior missions):** `DONE` · `DONE locally/SKIPPED live <reason>` · `DONE/SKIPPED human-gated <reason>` · `SKIPPED cross-boundary (needs <pkg/service/endpoint>)` · `SKIPPED human-gated (<decision needed>)`.

---

## 4. EXECUTION ORDER & WORKFLOW

1. **Baseline capture** → write the BASELINE section of the ledger: run and record results of `pnpm --filter @letbuyy/theme-marketplace typecheck`, `... lint`, `... build`, `... test`, and `pnpm run validate:governance` (== `node scripts/validate-governance.mjs`). Record the pre-existing worktree state (including unrelated root `CODEX_*` residue you will NOT touch).
2. **Work phases TM-P0 → TM-P5 in order** (§6). Within a phase: do all `IN`, scaffold all `CROSS`, default all `HUMAN`.
3. **After each phase:** run the gate suite (§5); append progress-log entries for every issue touched.
4. **Final gate sweep:** gates green for your changes; write the STATUS doc summary (counts of DONE / SKIPPED-cross / SKIPPED-human, per phase) and the "remaining cross-boundary contracts" list for coordination.
5. **Local only.** Do not open PRs, deploy, or run live/prod commands.

---

## 5. VERIFICATION GATES (run after every phase and at final)

```bash
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint
pnpm --filter @letbuyy/theme-marketplace build
pnpm --filter @letbuyy/theme-marketplace test          # keep the 3 federation/auth tests green; add app tests
pnpm run validate:governance                            # == node scripts/validate-governance.mjs
```
Acceptance: typecheck/lint/build pass; tests pass; governance reports no **new** failures attributable to your changes. If a change would only pass by editing out-of-boundary files, **revert it and reclassify as `CROSS`.** Add focused app tests for every behavioral change (honesty states, removed dead controls, preview wiring, filter wiring).

---

## 6. THE PHASES (mirror LETBUYY_THEME_MARKETPLACE_V2 roadmap)

> Issue numbers `#N` reference `MASTER_AUDIT.md` Phase 15 (Top 100). Class = IN / CROSS / HUMAN.

### TM-P0 — Truth & Safety (stop eroding trust)
**Goal:** zero false claims, zero shipped placeholders, zero dead controls, no abuse vectors. Highest priority.

| # | Issue | Class | Action |
|---|---|---|---|
|2,3|Hero "50+ Premium Themes" / "10K+ Active Installs" hardcoded (`page.tsx:7-12`)|IN|Derive from live API counts; if unavailable, remove the stat. Never hardcode.|
|71|"Categories: 4" vs 5 real categories|IN|Derive count from the real category set.|
|4|Hero "50+" contradicts live "0 themes" cards|IN|After #2 is data-derived, verify same-screen consistency.|
|6-grp|"50+" in SEO metadata (`layout.tsx:41,51`)|IN|Rewrite metadata to non-fabricated copy.|
|5,6|Success page leaks `[SKIP - NEEDS BACKEND]`; Order/Amount/License "pending" (`success/page.tsx:36-65`)|IN (copy) / CROSS (receipt)|Remove the placeholder string + show honest "payment confirming / receipt to follow" state. Real receipt/license = SKIP cross-boundary (settlement endpoint).|
|17|Stripe "global" claim vs Stripe disabled (`page.tsx:25`,`checkout:366-374`)|IN (copy) / HUMAN (enable)|Rewrite copy to Razorpay/India reality. Enabling Stripe = SKIP human-gated (keys/provider).|
|13|"24/7 support" with no support (`page.tsx:33`, pricing FAQ)|IN|Remove/soften until a support surface exists (#12).|
|28|"30-day money-back" with no refund flow (`pricing.tsx:75-77`)|IN (copy) / CROSS (refund)|Make copy accurate or remove. Real refunds via `api.orders.refund` = SKIP cross-boundary + human policy.|
|24|Navbar ⌘K search doesn't search (`navbar.tsx:124-201`)|IN|Submit input to `/themes?q=<query>` OR remove the field; remove/relink the `Documentation`→`#` action.|
|25|Notification bell hits missing `/api/notifications/count` (`navbar.tsx:322`)|IN|Remove/hide the bell until backed; do not call a nonexistent endpoint.|
|37,96|Card "Preview/Save" decorative spans (`theme-card.tsx:46-53`)|IN|Wire "Preview" to real preview (TM-P1 #7) or remove; wire "Save" to wishlist (TM-P3) or remove.|
|20|Downloads fake sizes + dead buttons (`downloads:25-28,84-101`)|IN (remove fakes) / CROSS (download)|Delete fabricated MB sizes; render only real metadata; honest "available after purchase/coming soon" state. Real artifact download = SKIP cross-boundary.|
|21|Purchases "Download" dead (`purchases:83-86`)|IN/CROSS|Honest state, no dead button; real download = SKIP cross-boundary.|
|18,19|Settings persists nothing; hardcodes identity (`settings:14-17,38-48`)|IN (identity+honesty) / CROSS (persist)|Load identity from session user if exposed by auth-core/api-client; else read-only from session (no fabricated defaults). Persistence = SKIP cross-boundary. Remove fake "Saved!"; wire Change Password/2FA to accounts flows or remove.|
|57|Public upload route lacks abuse guard (`api/themes/route.ts:43-64`)|IN (guard) / CROSS (scan)|Add auth assertion + basic rate-limit/size guard in the handler. Malware/asset scanning = SKIP cross-boundary.|
|11|Legal links dead (`footer.tsx:23-28`)|IN (routes) / HUMAN (text)|Create honest `/legal/{terms,privacy,refund,license}` placeholder routes; wire footer (no `#`). Legal copy = SKIP human-gated.|
|12|Support/Contact/About/Blog dead (`footer.tsx:17-22`)|IN (routes) / HUMAN (content)|Create honest `/support`, `/contact` (mailto support@); real `/about` or remove Blog. No `#`.|
|100|Docs/API/Changelog footer dead (`footer.tsx:11-16`)|IN (routes) / CROSS (real docs)|Honest `/docs` placeholder; changelog route if data exists, else remove. No `#`.|
|84|"Built with ♥ in India" + INR-only vs "global"|IN|Align global/India copy with Razorpay/INR reality.|
|78|`any` types flagged by AGENTS (`api/themes/route.ts:19`)|IN|Replace `any` with types from `@letbuyy/theme-engine`/`shared-types`.|

**TM-P0 acceptance:** grep the app for `href="#"`, `[SKIP`, `50+`/`10K+`/`4.8`, decorative `<span>` CTAs → none remain in shipped paths; gates green.

### TM-P1 — Catalog & Discovery (find & try)
| # | Issue | Class | Action |
|---|---|---|---|
|7,50|Preview disabled though `previewSession` exists (`[slug]:470-512`,`api-client:1490`)|IN|Wire "Preview in your store" + card preview to `api.themes.previewSession`; fall back to `demo_url`; honest disabled only if both unavailable.|
|26,64|Layout & price-range filters inert (`themes:454-521`)|IN|Catalog API has no layout/price params → **hide** these filters; log a `CROSS` contract for the params. Keep category/pricing/search/sort.|
|55|Industry filter empty (`themes:447-451`)|IN (wire) / CROSS (seed)|Render real `api.themes.industries()` options when present; hide gracefully when empty. Seeding = SKIP cross-boundary.|
|39,93|"Trending"→`/themes`; no trending/new/popular (`navbar:642`)|IN / CROSS|Use a real `sort` or drop the implication; true trending signal = SKIP cross-boundary.|
|65|No pagination (`themes:284`)|IN|Add pagination/"load more" using `total`/`limit`/`offset`.|
|81|Autocomplete from current page only (`themes:235-256`)|IN / CROSS|De-imply or scope clearly; server suggestions = SKIP cross-boundary.|
|38,47|No collections/curation|CROSS|Presentational collection UI behind a flag; data/curation = SKIP cross-boundary.|
|46|No ranking beyond `sort`|CROSS|SKIP cross-boundary; keep `sort` honest.|
|1|Catalog effectively empty (1 seed)|CROSS/HUMAN|SKIP (seeding = database + content). Ensure honest degradation on a sparse catalog.|

### TM-P2 — Trust layer (reviews, receipts, identity)
| # | Issue | Class | Action |
|---|---|---|---|
|8,9,75|No reviews/ratings; "Marketplace proof" shows empty counts (`[slug]:515-543`)|CROSS (endpoint) / IN (UI shell)|Build a presentational reviews section + verified-purchase write-form **behind an off-by-default flag**; honest empty-state; never POST to a nonexistent endpoint. `themes.reviews`/`createReview` = SKIP cross-boundary.|
|27|Navbar never shows logged-in identity (`layout.tsx:100`)|IN/CROSS|Pass session user into `AuthProvider` if retrievable in-boundary; else SKIP cross-boundary and stop rendering a fake "User".|
|67|No author verification/badges|CROSS|SKIP; render author honestly (no fake badges).|
|43,44,45|Tax/invoice, receipts/order history, email notifications|CROSS|SKIP cross-boundary; remove any fabricated tax/receipt/notification UI.|

### TM-P3 — Safe lifecycle (install/update/rollback non-destructive)
| # | Issue | Class | Action |
|---|---|---|---|
|22|"Customize" → public detail page, not editor (`installations:133-139`)|IN|Deep-link to merchant editor URL (env-based `NEXT_PUBLIC_ADMIN_URL` + `/[store]/online-store/themes/[themeId]/editor`); no editor logic here.|
|23|"Update Available" badge with no action (`installations:11-14`)|IN/CROSS|Add "Apply update" wired to the existing install/publish client method if safe; else SKIP cross-boundary with endpoint named.|
|52,53|Destructive install; no preview/backup/uninstall (`install:145-147`)|IN/CROSS|Add confirm + preview link (TM-P1 preview). Draft/rollback via `api.themes.releases`/`rollbackRelease` if invocable in-boundary; else SKIP cross-boundary.|
|37,61|Wishlist/favorites, saved searches|CROSS|SKIP cross-boundary (persistence); remove decorative "Save" or flag off.|
|70|Subscription badge hardcoded "Free Plan" (`dashboard/layout:54-63`)|IN/CROSS|Read real plan from session/api if available; else remove the hardcoded plan claim.|

### TM-P4 — Developer experience (scaffold only; backend is cross-boundary)
| # | Issue | Class | Action |
|---|---|---|---|
|9,58,59|Submission = one JSON upload; no listing builder/agreement/assets (`theme-upload-panel.tsx`)|CROSS (backend) / IN (UX shell + agreement gate)|Build a `/developer` console + listing-builder UI shell (assets/screens/pricing/category form) calling **typed client methods behind a flag**; add a developer-agreement checkbox gate before upload. Persistence + review pipeline = SKIP cross-boundary.|
|10,35,60,67|Revenue/payouts, profiles, analytics, verification|CROSS/HUMAN|SKIP cross-boundary; default rev-share display "TBD pending program terms" (HUMAN). Read-only placeholder dashboards that render real data when endpoints exist, honest empty otherwise.|

### TM-P5 — Polish & responsiveness
Address remaining in-boundary P2 items (#72–#99): currency-format consistency (#72), use-or-remove unused helpers (#73), responsiveness fixes from `THEME_RESPONSIVENESS_REPORT.md` (fixed bento heights #82, ≥44px touch targets, tablet filter rail, small-type legibility), parallelize sequential dashboard/home API calls (#88,#90), locale consistency (#80), faux-browser "preview" implication (#83). Anything needing data/endpoints → SKIP cross-boundary.

---

## 7. DEFAULT DECISIONS (apply now; flag `SKIPPED human-gated` for ratification)

- **D-1 Pricing model:** **RATIFIED (owner decision 2026-06-07) = per-theme one-time purchase is the live commerce path.** The Free/Pro/Unlimited subscription page is **marketing-only** for now: fix the broken Pro CTA (`/checkout?plan=pro`) → waitlist/contact or remove, and "Unlimited → `#`" → contact route. Do **not** build subscription checkout in this mission (a separate future mission owns it). Treat subscriber-entitlement gating as out of scope here.
- **D-2 Metrics:** DEFAULT = remove all hardcoded counts/ratings; show live values only where the API provides them; otherwise omit.
- **D-3 Legal/support pages:** DEFAULT = honest placeholder routes wired into the footer (no `#`), pointing to `support@letbuyy.com`; **actual legal/marketing copy = HUMAN (SKIP).**
- **D-4 Payments/geography:** DEFAULT = keep Razorpay/INR, make copy India-first; **enabling Stripe/global = HUMAN (SKIP — keys/provider).**
- **D-5 Reviews & developer console:** DEFAULT = build presentational/UI shells behind off-by-default feature flags that activate when the cross-boundary endpoints land; never ship a control that writes to a missing endpoint.
- **D-6 Catalog content:** DEFAULT = never fabricate themes/metrics; the app must degrade honestly on a sparse catalog. Seeding real themes = CROSS/HUMAN (SKIP).
- **D-7 Generated intelligence & root residue:** DEFAULT = do not regenerate any `AGENTS.md` and do not create root `CODEX_*` files; defer to the final coordination pass (SKIP) to avoid parallel-mission collisions.

---

## 8. LEDGER & STATUS (create and maintain — under docs/themes-marketplace-audit/, NOT root)

Create `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_LEDGER.md` with sections matching prior missions:
1. **ARCHITECTURE-DIRECTION DECISIONS** — record D-1…D-7 with chosen DEFAULT.
2. **BASELINE** — pre-edit gate results + worktree state (§4.1).
3. **PROGRESS LOG** — one line per issue/sub-task:
   `- <ISO8601Z> [TM-P{n}] #<issue> <short title> - <STATUS> - evidence: <files/cmd>`
   Example: `- 2026-06-07T10:12:00Z [TM-P0] #5 success placeholder removed - DONE locally/SKIPPED live (settlement endpoint) - evidence: apps/theme-marketplace/src/app/checkout/success/page.tsx`
4. **CROSS-BOUNDARY CONTRACTS** — consolidated list of endpoints/packages/tables other missions must deliver (reviews API, settlement/receipt, refunds, downloads artifact, settings persistence, catalog/industry seeding, developer-program backend, ranking/curation).

Create `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STATUS.md`: per-phase counts (DONE / SKIPPED-cross / SKIPPED-human), final gate output, and a "what's left and who owns it" summary.

---

## 9. DEFINITION OF DONE (this mission)

- All 100 issues have a ledger line with a terminal status (DONE or an explicit SKIPPED class + contract). **None left silently unaddressed.**
- Shipped UI contains: no fabricated metrics, no `[SKIP/NEEDS BACKEND]`/dev-placeholder strings, no `href="#"` dead links, no decorative CTAs implying missing capability.
- `previewSession` wired; `Customize` deep-links to the editor; filters are real-or-hidden; pagination works.
- §5 gates pass for your changes; the 3 existing app tests stay green; new app tests cover every behavioral change.
- `git status` shows changes **only** under `apps/theme-marketplace/**` and the two `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_*` files — nothing outside boundary, no new root `CODEX_*`.
- STATUS doc written; CROSS-BOUNDARY CONTRACTS list complete for the parallel/coordination missions.

**Begin with the BASELINE capture, then TM-P0. Work the whole list in one go. When in doubt: make it honest, keep it in-boundary, log it, and continue.**
