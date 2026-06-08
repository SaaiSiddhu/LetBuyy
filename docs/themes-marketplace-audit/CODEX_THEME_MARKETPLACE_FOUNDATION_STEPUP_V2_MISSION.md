<!-- CODEX MISSION PROMPT — point Codex at this file. DEFINITIVE FULL-VERTICAL, SINGLE-RUNNER, SINGLE-GO, PROVE-ALL-100.
     This mission CONSOLIDATES and SUPERSEDES the prior theme-marketplace missions for this pass:
       - CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md (frontend-only)
       - CODEX_THEME_PLATFORM_BACKEND_MISSION.md (backend-only)
       - CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_MISSION.md (full-vertical step-up)
       - CODEX_THEME_MARKETPLACE_FOUNDATION_CLOSEOUT_MISSION.md (zero-skip closeout)
     It is mapped to the CURRENT audit Top-100 in docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md (2026-06-07 step-up-aware revision).
     LOCATION NOTE: this mission + its ledger/status live under docs/themes-marketplace-audit/ (NOT repo root, NOT under apps/services/packages)
     per scripts/validators/source-ledger-residue-validator.mjs. Do NOT create CODEX*.md anywhere else. -->

# CODEX MISSION — Theme Marketplace FOUNDATION STEP-UP V2 (full vertical · one runner · single go · prove all 100)

You are Codex operating **locally** on the LetBuyy monorepo. This is **THE foundation mission** — the main phase that makes the **Theme Marketplace fundamentally strong end-to-end**. In **one continuous run**, drive **every one of the 100 issues** in `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` (Phase 15, current 2026-06-07 revision) **and** the V2 essentials (Phase 14) to a **terminal, PROVEN state** — frontend, the theme routes in the gateway, the theme tables/seeds in the DB, and additive shared-package methods.

**You own the whole theme vertical, so "it's backend / it's a migration / it's a new table or route" is NOT a reason to skip — it is a reason to BUILD.** You stop-and-defer **only** for a genuine production **secret value**, a genuine **legal/business wording or number sign-off**, real **live infrastructure apply/deploy**, or a `scripts/`/root/`AGENTS.md` allow-list change. And even then you **do not halt**: you ship a **working local dev-default** so the feature functions and is testable now, write a one-line entry in the **DEFERRED / PROD-CUTOVER register** naming exactly what a human/operator swaps later, and **keep going**.

### The bar (read it once, hold it for all 100)
> **DONE = the capability works end-to-end locally and is proven by an automated test or a reproducible command.** "Code exists" is **not** DONE. A non-functional `SKIPPED` is **not** an allowed end state. The only thing that may remain open is a literal prod secret / legal wording / business number — and that ships with a working dev default so the feature runs now.

Terminal statuses allowed in this run:
- `DONE` — works + proven.
- `DONE (works locally; PROD-CUTOVER: <one secret/wording/number>)` — works now behind a dev default; one named value swaps at go-live.

The bare `SKIPPED live` / `SKIPPED human-gated` states from earlier runs are **forbidden as end states** — convert each to one of the two above.

---

## 0. Single source of truth & required reading

Authority order (obey top-down): root `AGENTS.md` → the owning runtime's `AGENTS.md` (`apps/theme-marketplace/AGENTS.md`, `services/api-gateway/AGENTS.md`, `packages/*/AGENTS.md`, `database/AGENTS.md` if present) → `docs/governance/*` → this mission. **If anything here conflicts with `AGENTS.md`, AGENTS.md wins and you log the conflict in the ledger.**

Read before editing (the evidence base; every issue ID traces here):
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — **Phase 15 "Top 100 issues" is the canonical backlog (#1–#100); Phase 14 is the V2 target; §1.10/§1.11 list the six operational gates and the real catalog state.**
- `docs/themes-marketplace-audit/` companion docs and the prior mission **ledgers/status** (`…_STEPUP_LEDGER.md`, `…_STEPUP_STATUS.md`, `…_CLOSEOUT_*` if present). **These tell you what already landed** (migration `091`, gateway routes, api-client methods, compare/collections/authors/favorites, drafts, route split) **and what was left as `SKIPPED` — every prior `SKIPPED` line is an item you must finish here.** Do not re-do what is already `DONE`; verify it still passes and move on.
- Patterns to mirror (do not fork): gateway theme routes `services/api-gateway/src/routes/themes.ts` + `src/lib/theme-marketplace-auxiliary-routes.ts` + `src/execution/theme-execution.adapter.ts`; api-client themes resource in `packages/typescript/api-client/src/index.ts`; `ThemeReview`/types in `packages/theme-engine/src/index.ts`; the theme tables in `database/supabase/migrations/` (incl. the `091_theme_marketplace_stepup` set and `theme_reviews`, `theme_purchase_receipts`, `theme_refund_requests`, `theme_download_artifacts`, `theme_developer_listings`, `theme_developer_payout_accounts`); seed/verification convention `database/supabase/seeds/urban-kicks-theme.sql` + `…/seeds/theme-marketplace-sample-catalog.sql` + `database/supabase/verification/055_*` (single-theme rule ALREADY retired) and `091_*`; Razorpay via `@letbuyy/infrastructure/razorpay-adapter`; INR/currency single-source `packages/typescript/ui/src/formatting.ts`; the honesty gate `apps/theme-marketplace/tests/foundation-honesty.test.mjs`; intelligence regenerator `scripts/generate-repository-intelligence.mjs`.

**State you can assume is already DONE (verify, don't rebuild):** single-theme DB rule retired (`055` allows N themes); 10-sample + urban-kicks catalog seeded with honest zeros; compare (`/themes/compare`), collections (`/collections/[slug]`), author profiles (`/authors/[handle]`), saved searches, faceted filters (category/pricing/industry/price-range/layout), page-number pagination, refund-request form, receipts on `/checkout/success`, favorites; URL helper libs throw instead of hardcoding hosts; support email is `support@letbuyy.com`; domain drift reduced to **2** `${subdomain}.letbuyy.store` refs. If any of these regressed, restore them — but they are not your primary work. Your primary work is the **still-broken** capabilities in §6.

---

## 1. OWNERSHIP & BOUNDARY (full theme vertical — one runner)

**You OWN and may modify (the entire theme vertical):**
- `apps/theme-marketplace/**` — all source, config, public assets, app-local tests.
- `services/api-gateway/**` — **theme-related routes/handlers/workers only** (reviews, settlement→receipt/license, refunds, downloads, settings persistence, developer-program, catalog params, collections/ranking, author profiles, scanner hook, analytics, payouts). Business orchestration via execution adapters, **not** in `services/*/src/services/*.service.ts`. Keep `routes/themes.ts` under the 1500-line governance ceiling (split into auxiliary route files as already established).
- `packages/typescript/api-client/**` — **additive only** (new methods/types; never rename/remove/repurpose existing exports or change existing response shapes).
- `packages/theme-engine/**` — additive only, and only if new shared types are required (prefer reusing existing types like `ThemeReview`).
- `packages/typescript/shared-types/**` — additive only, canonical cross-runtime DTOs (new theme/commerce DTOs are canonical here, not hand-rolled app-local types).
- `packages/typescript/ui/**` — additive only, for the design-system unification (migrate bespoke marketing tokens into `@letbuyy/ui` tokens).
- `database/supabase/**` — new **sequential, unique, reversible** migrations under the single root `database/supabase/migrations/`, idempotent `seeds/`, and `verification/` harnesses. New entity tables MUST include `id, created_at, updated_at, deleted_at`, audit columns, indexes, and **RLS policies**.
- Your tracking files **under docs (NOT root):** `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_LEDGER.md` and `…_STATUS.md`. You may also update the prior `…_STEPUP_*`/`…_CLOSEOUT_*` ledgers in place.
- You MAY regenerate generated intelligence **only** via `node scripts/generate-repository-intelligence.mjs` if route/schema/topology changes require it — **never hand-edit** generated `AGENTS.md`/intelligence; if the regenerator needs human review, mark the regen `PROD-CUTOVER` and continue.

**You MUST NOT touch:**
- Any **non-theme** code in `services/**` or other `apps/**` (merchant-control-plane, identity-platform, storefront-runtime app code, app-marketplace, etc.) **except** (a) the minimal, clearly-theme-owned storefront preview/render hook if a fix demands it (additive, logged), and (b) the single SSO-parity gate-unblock in `apps/app-marketplace/src/proxy.ts` **only if** that is genuinely the smallest way to make the shared `tests/auth/sso-redirects.test.mjs` pass (see §9b) — logged explicitly. The merchant editor is an **install target**: deep-link to it, do not rebuild it.
- `infrastructure/**`, `legacy/**`, generated-artifact trees (consume, never hand-edit), `scripts/**` validators (run them; do not edit them).
- Root shared/config: root `AGENTS.md`, root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`.
- Secrets of any kind. `NEXT_PUBLIC_*` is public and must never carry secrets; service-role keys stay server/worker-only; never put tokens in `localStorage` (preview-only wishlist/search prefs in `localStorage` are allowed).
- **Do NOT create any `CODEX*.md` at repo root or under `apps/`, `services/`, `packages/`** — the `source-ledger-residue-validator` fails on those. Ledger/status live under `docs/themes-marketplace-audit/` only. Registering anything in a validator allow-list is a HUMAN change → PROD-CUTOVER.
- Deprecated aliases (`apps/admin|auth|checkout|internal|merchant|storefront|analytics`, `apps/mobile/operator-team-app`, nested `consumer-storefront`) — never recreate.

**BACKWARD-COMPAT CONTRACT:** other runtimes consume `@letbuyy/api-client`, `@letbuyy/theme-engine`, `@letbuyy/shared-types`, `@letbuyy/ui`. All package changes are **strictly additive and backward-compatible** — every other app/service must keep typechecking and building against the existing surface at all times. New behavior lands behind clearly-named new methods/flags the app adopts in the same run. Prove it with a backward-compat surface diff (§7).

---

## 2. PRIME DIRECTIVES (the codebase-wide foundation standard)

These are the standards the **whole codebase** is held to; this run enforces them across the theme vertical.

1. **No dead controls.** Never ship a button/link/input implying a capability it lacks. In this mission the answer is **build it** — you own the vertical. If a control depends on a prod secret/wording, ship it **working behind a dev default** with an honest state; never a control that calls a missing endpoint, and never `href="#"`.
2. **No fabricated content, ever.** No hardcoded metrics, invented file sizes, fake ratings, or engineering placeholders (`[SKIP - NEEDS BACKEND]`, "pending", "TBD", "Signed URL pending", "Settlement syncing") in shipped UI. Numbers are data-derived or omitted. Honest zero where truly zero. The `foundation-honesty.test.mjs` gate must stay green and you should **extend** it.
3. **Working over pending.** A truthful flagged-off state is the *last* resort, reserved for the literal prod-secret/wording set in §3 — and even those ship a working dev default. Everything else is implemented and proven.
4. **Consume, don't fork; extend, don't break.** Reuse existing `@letbuyy/*` methods; when you must add to shared packages, add — never rename/remove/repurpose.
5. **Security & tenancy first.** Verify provider signatures on settlement/refund/webhooks; verified-purchase gating on reviews; authz + rate-limit + size caps + **asset scanning** on upload; **call the established store-ownership guard (`verifySiteOwnership` or equivalent) on every store-scoped op** — the gateway runs service-role (RLS-bypassing), so ownership is a manual invariant. Server-side price recalculation; webhook/CSRF verification parity.
6. **Single-source invariants.** INR/currency formatting via `@letbuyy/ui` `formatting.ts`; crypto via the api-gateway crypto lib; one Supabase migration root; canonical DTOs in `@letbuyy/shared-types`. Never duplicate.
7. **Idempotent, reversible migrations & seeds**, sequential unique numbering, never dependent on generated artifacts; ship a `verification/` harness for each schema change and **apply + verify on a real local Postgres** (§9c).
8. **Green gates always** (§7) after every phase — never leave any package/service/app non-building. Pre-existing failures from outside the theme vertical are isolated and proven pre-existing, not adopted.
9. **Prove it, log it.** Every issue #1–#100 gets a terminal ledger line **and** a PROOF MATRIX row with a runnable proof (§10). Silent changes are forbidden.

---

## 3. THE ONLY PERMITTED DEFERRAL — a named PROD-CUTOVER set (each still works locally)

You may **not** defer a *capability*. You may defer only the *production value* of the items below, and each must ship a working **dev default** so the feature is fully functional and testable now.

| PROD-CUTOVER item | Dev default you MUST implement now (so it works) | What a human/operator swaps at go-live |
|---|---|---|
| Razorpay/payment keys | Sandbox/test-key mode + a local **mock provider** behind `PAYMENTS_PROVIDER=mock\|razorpay_test`; purchase → signature-verify → **receipt + license issued** works end-to-end in dev + tests | Real prod keys |
| Download storage/CDN | A **local object-store adapter** (filesystem or supabase-storage-local) that stores bundles and returns **real file sizes + working signed URLs** in dev | Prod bucket creds |
| Malware/asset scanner | A **scanner interface with a working local implementation** (hash + zip-inspection/heuristics, or `clamscan` if installable) that runs on every upload and records a verdict | Vendor scanner key |
| Email/notifications | A **local transport (DB outbox + log)** that actually emits receipt/update notifications and is assertable in tests | Prod SMTP/provider key |
| GST invoice | A **generated invoice (JSON + rendered)** using `GSTIN` from env with a clearly-labelled dev placeholder GSTIN; numbering series works | Real registered GSTIN |
| Revenue share % / payouts | A **concrete default rate in config (15% as the documented default)** so payout amounts **compute and display real numbers**, and a payout-intent record is created | Ratified % + payout provider contract |
| Legal/Privacy/Refund/License/About copy | **Real draft copy that renders and is navigable**; nothing in the app reads "pending approval" as the whole page | Final binding wording |
| `.com` platform domain | Conform source defaults to the **governed** value so governance is GREEN; ship a single env switch (`NEXT_PUBLIC_PLATFORM_DOMAIN`) | Governance-owner allow-list edit + DNS/cookie cutover |
| Production creative themes/screenshots | Functional **sample** themes + generated/placeholder-but-real-dimensioned previews; a second sample author for diversity | Brand-approved creative + real third-party devs |
| Live DB / deploy | Apply migrations + seeds + verification to a **local** Postgres (§9c) | Apply to prod DB + deploy |

Rule: if it's on this list, the feature **must demonstrably work in dev** and only the literal secret/wording/number is open. If it's **not** on this list, it is plain `DONE`. Anything you're tempted to skip that isn't here → **implement it.**

---

## 4. CLASSIFICATION & SKIP-AND-CONTINUE PROTOCOL (apply to each of the 100 + each V2 task)

- **`IN` — implement now and prove (default for almost everything).** Lives anywhere in the theme vertical. Build it, wire it end-to-end, test it.
- **`DEV-DEFAULT` — implement working locally; one prod value deferred.** Maps to a §3 row. Ship the mock/local adapter so it works + is tested now; add the one-line PROD-CUTOVER register entry; continue.
- **`HUMAN` — apply the §8 default + ship the structure working; defer only the wording/number.** Legal copy, revenue-share %, taxonomy strategy, governance allow-list. Ship a working dev default (draft copy renders; 15% computes), register the precise decision, continue.

There is **no "skip because it's backend."** Backend in the theme vertical is `IN`.

**The skip-and-continue contract (do not halt the run):**
1. Ship the maximal **working** in-code part now (dev default/mock/local adapter/draft copy) so the feature **functions and is testable**.
2. Add one line to the DEFERRED / PROD-CUTOVER register, exact shape:
   `- [PROD-CUTOVER|HUMAN] #<issue(s)> <title> — DEV-DEFAULT: <what works now> — SWAP AT GO-LIVE: <the one secret/wording/number> — code: <files> — proof: <test/cmd>`
3. Continue immediately to the next item. **Never leave the run idle waiting on a person.**

---

## 5. EXECUTION ORDER & WORKFLOW (one continuous run)

1. **BASELINE capture** → ledger BASELINE section: restore deps if needed; run `pnpm -w` typecheck (or per-filter), the §7 gate suite for the theme vertical, `node scripts/validate-governance.mjs`, and **enumerate every prior `SKIPPED` line** from the step-up/closeout ledgers (that is your conversion target list). Record worktree state and any pre-existing non-theme failures you will isolate, not adopt.
2. **Stand up a local Postgres early (§9c)** so DB-backed features are testable for the whole run.
3. **Work phases F0 → F8 in order (§6).** Within each phase: data/schema first → gateway routes + api-client methods → app wiring + tests, so the frontend wires **real** endpoints in the same pass.
4. **After each phase:** run the §7 gates; append a PROGRESS-LOG line for every issue/sub-task; update the PROOF MATRIX rows you just earned; update the DEFERRED/PROD-CUTOVER register for any §3 item.
5. **Final sweep:** all gates green for your changes; governance shows no new theme-vertical failures (with the isolation proof, §9a); migrations applied + verified on local Postgres; backward-compat surface diff confirms additive-only package changes; PROOF MATRIX reads **100/100 DONE**; write STATUS + the PROD-CUTOVER register + a one-screen "what an operator swaps to go live" list.
6. **Local only.** No deploys, no prod, no live secrets, no live DB.

---

## 6. THE PHASES (one ordered full-vertical build — closes all current #1–#100 + V2 P0–P5)

> `#N` = `MASTER_AUDIT.md` (2026-06-07) Phase 15 issue number. Each phase does **data/schema → gateway+api-client → app+tests** in that order. Every issue must end `DONE` or `DONE (PROD-CUTOVER: …)` with a PROOF MATRIX row. Phase→issue coverage is exhaustive and non-overlapping; a coverage grep at the end must show all 100.

### F0 — Foundation: domain, design-system unification, hygiene (closes #25, #42, #63, #71, #73, #99, #100)
- **#25 Domain:** remove the 2 remaining `${subdomain}.letbuyy.store` host literals (`app/install/page.tsx:29`, `app/dashboard/installations/page.tsx:86`). Tenant storefront hosts stay `*.letbuyy.store`; **platform/support** links resolve via a single env flag `NEXT_PUBLIC_PLATFORM_DOMAIN` (default = the value `validate-governance` accepts, so governance stays GREEN — see §9a). `.com` cutover = one PROD-CUTOVER line. `IN` + PROD-CUTOVER.
- **#42 Design system:** unify on `@letbuyy/ui` (`--lb-*`, `Page/PageHeader/Section/Card/Table`). Migrate the bespoke `app/globals.css` "premium dark" marketing tokens into `@letbuyy/ui` tokens (additive) so Home/Navbar/Footer/cards/checkout/dashboard and the catalog/detail read as **one** product; remove the in-checkout token mix. `IN`.
- **#63 Disabled affordances:** stop relying on opacity alone — add `aria-disabled`, `disabled`, and a visible non-opacity treatment. `IN`.
- **#71 Type hygiene:** replace `any` with `@letbuyy/theme-engine`/`shared-types` types across `app/api/themes/*` and components; resolve the pre-existing lint warnings you can (`next/no-img-element` is handled by #39/#61/#62). `IN`.
- **#73 Favicon / #100 OG image:** ship a real favicon and a real OG/social image asset (generated is fine; not a 404). `IN`.
- **#99 InfoPlaceholder:** either delete `components/info-placeholder.tsx` if unused after F8 content work, or wire it where genuinely appropriate; no orphaned placeholder component. `IN`.
- Governance baseline; regen intelligence via `scripts/generate-repository-intelligence.mjs` only if routes/topology change (never hand-edit output).

### F1 — Catalog depth & honesty (closes #20, #32, #43, #44, #45, #48, #60, #83, #91, #92)
- **#20, #60, #91, #92 Real, distinct samples:** extend the seed (`theme-marketplace-sample-catalog.sql` style) so each of the 5 categories has genuinely distinct section sets, specific (not generic) descriptions, varied `font_pairings`, and varied `color_presets` (#83). Keep honest zeros and real `created_at`. Production creative = HUMAN; ship functional samples now.
- **#44 Author diversity:** seed a **second** first-party sample author (e.g. `letbuyy-labs`) so author profiles, filtering, and "by author" are meaningful; real third-party devs = HUMAN/onboarding in F7.
- **#43 Previews:** replace reused SVG placeholders with **per-theme** preview images of correct dimensions (generated/screenshotted from the renderer if possible); wire `next/image`. Real brand creative = PROD-CUTOVER.
- **#45 demo_url:** point sample `demo_url` at a real storefront preview route (ties to F3 sandbox), not `/themes/slug?demo=sample`.
- **#48 Honest counts:** surface `download_count`/`purchase_count` on cards/detail **when > 0** (hide at zero). `#32` Category counts: render real counts and pluralize correctly.
- Verification: replace/extend the catalog-integrity harness to assert distinct categories + required metadata; apply + run locally (§9c).

### F2 — Discovery, ranking, SEO surfaces (closes #31, #33, #47, #54, #57, #58, #79, #81, #82, #84, #85, #86, #87, #88, #89, #90)
- **#33, #54, #31 Real ranking:** implement a composite signal `rating × installs × recency` as a real `sort=trending`/`sort=popular` endpoint + ranked home rows; Home "Featured" uses the ranked query (not top-4-by-zero-rating). `IN`.
- **#47 Facets:** make tag/feature chips on cards clickable into `/themes?tag=…`/`?feature=…`. **#81** add a price-range slider over the existing min/max. **#82** humanize layout facet labels shown to buyers. `IN`.
- **#57 Structured data:** per-theme `Product`/`Offer`/`AggregateRating` JSON-LD on the detail page. **#79** add collections + author routes to `sitemap.ts`. `IN`.
- **#84 badges** (new/updated from `published_at`/`updated_at`), **#85 quick-look** modal from a card, **#86 ⌘K** search shortcut to the existing search, **#87 compare** selection from cards/detail (one-click add), **#88 share/copy-link** on detail, **#89 "updated <relative>"** on cards, **#90 category landing pages** (`/themes` category views with copy + SEO). `IN`.
- **#58 Similar themes:** improve with the richer catalog + ranking. `IN`.

### F3 — Try-before-buy (closes #7, #21, #34, #39, #55, #61, #62)
- **#7, #55 Wire `previewSession` everywhere** ("Preview in your store" + a card-level preview) and remove the forced explicit store-selection friction (auto-select the only/last store; offer picker only when needed). `IN`.
- **#34 Anonymous sandbox preview** (`/preview/[token]`) using a sandbox store + signed preview token, so a prospect with **no** store can try a theme; fall back to `demo_url`. `IN` (signed-token infra local; real CDN = PROD-CUTOVER if needed).
- **#21 Embedded live demo** on the listing (iframe to the sandbox/storefront preview). `IN`.
- **#39, #61, #62 Images:** all home/category/detail previews via `next/image` with correct `sizes` (kills LCP/CLS and the `no-img-element` lint); per-theme preview art from F1. `IN`.

### F4 — Trust layer: reviews, authors, proof (closes #2, #26, #28, #46, #72, #74, #96)
- **#2 Reviews come alive:** reviews already exist server-side (verified-purchase gated, moderation). Make them **work and visible**: seed dev/pilot review + install data (honestly labelled as sample data, **not** fabricated production metrics — i.e. real rows created by the seed/test flow, clearly first-party), render the reviews section + rating distribution + aggregate, and make the write form submit end-to-end behind the verified-purchase gate. `IN`.
- **#28 Review pipeline:** developer reply + ops moderation `pending → published/rejected` with written feedback fields, surfaced to the developer. `IN`.
- **#26, #72 Authors:** verified-author **badge** (boolean model now; verification *program* = HUMAN), and ensure author profiles render real portfolio + aggregate rating + support SLA for both seeded authors. `IN`.
- **#46 Proof:** "X stores use this"/install proof derived from **real** counts, shown only when > 0. **#74** correct review pluralization at 0/1/n. `IN`.
- **#96 Report flow** reachable from detail **and** from `/dashboard/purchases` / `/dashboard/installations`. `IN`.

### F5 — Commerce truth: downloads, GST, refunds, notifications, coupon, tax, currency, licensing (closes #5, #15, #18, #23, #24, #37, #56, #59, #65, #66, #77, #93, #94, #95, #98)
- **#5, #93 Downloads:** local object-store adapter (filesystem/supabase-storage-local) that stores real bundles per platform (`letbuyy/wordpress/html/react`), returns **real sizes + working signed URLs**, entitlement-checked; `/dashboard/downloads` renders real artifacts (no `pending_storage`). Multi-platform export delivered or platforms not advertised. `DEV-DEFAULT` (prod bucket = PROD-CUTOVER).
- **#15 GST invoice:** generate a real invoice (JSON + rendered) with a working numbering series and env `GSTIN` (dev placeholder); remove "pending" GST copy. Real GSTIN = PROD-CUTOVER. **#66 Tax:** compute and display real tax, not "Confirmed by provider".
- **#18, #65 Coupons:** either implement a working coupon endpoint + validation, or remove the coupon UI entirely (D-10). No permanently-disabled control. `IN`.
- **#23, #37 Currency:** INR via `@letbuyy/ui` formatting single-source; either make USD/multi-currency real and consistent or drop USD price fields from UI (keep INR-only display). Stripe/global rail = PROD-CUTOVER. `IN`.
- **#56 Refunds:** refund request → operator decision → `refunded` transition working via a local payment-provider mock; policy window text = HUMAN. `DEV-DEFAULT`.
- **#24, #59, #95 Notifications:** local outbox transport (DB + log) emitting **receipt**, **order-confirmation**, **update**, and **saved-search alert** notifications, assertable in tests; real SMTP = PROD-CUTOVER. (Closes saved-search **alerts** #59.)
- **#94 Checkout** prefilled from the session when logged in (no manual re-entry). **#77** "Premium Licenses" dashboard stat reads a real count. **#98** license-tier captured and enforced at purchase/entitlement. `IN`.

### F6 — Safe lifecycle & settings (closes #36, #49, #76)
- **#36 Uninstall/revert** surfaced in the marketplace (in addition to the existing draft→preview→publish→rollback, which you verify still works end-to-end). `IN`.
- **#76 Install presets:** explain and actually apply `default/conversion/editorial` as real `config_overrides`. `IN`.
- **#49 Settings persistence:** profile + notification-preference storage + endpoints so `/dashboard/settings` persists real prefs. `IN`.

### F7 — Developer program: list → review → get paid (closes #1, #3, #4, #6, #12, #14, #19, #27, #35, #53, #97)
- **#35, #19 Console:** move the developer surface OUT of the buyer's catalog sidebar; build a real `/developer` + replace the `/developer/listings/new` **stub** with a working listing builder (name, descriptions, screenshots/assets, pricing, **license tiers**, category/industry/tags) writing to `theme_developer_listings`. `IN`.
- **#14, #6 Assets + scanner:** accept real theme **zip + assets** (authz + rate-limit + size caps), run the **local malware/asset scanner** on every upload and record a verdict; reject on fail. `DEV-DEFAULT` (vendor scanner = PROD-CUTOVER).
- **#12 Review pipeline + SLA:** developer-agreement gate (structural now; binding terms = HUMAN), lifecycle `submitted → in_review → changes_requested → approved/rejected` via the ops queue with **written feedback** and developer-visible status + a documented SLA field. `IN`.
- **#27 Analytics:** read endpoints returning **real computed** funnel (views→install→purchase), revenue, and refund numbers from seeded data + dashboards. `IN`.
- **#3, #4, #97 Revenue share & payouts:** model + compute at a **15% default** (config) so payout amounts display real numbers; create payout-intent records over the modeled rails (`razorpay_route/razorpayx/upi/manual`). Final % + payout provider contract = HUMAN/PROD-CUTOVER. `DEV-DEFAULT`.
- **#53 Licensing:** bundle / gift / transfer license flows (entitlement records). `IN`.
- **#1 Third-party supply:** build the **onboarding** path (developer signup → profile → first listing) end-to-end so a third party *could* list; actually recruiting humans = HUMAN. Seed the second sample author as proof the multi-author path works. `IN` + HUMAN(recruitment).

### F8 — Polish, perf, a11y, legal, content, responsiveness, telemetry, SEO (closes #8, #9, #10, #11, #13, #16, #17, #22, #29, #30, #38, #40, #41, #50, #51, #52, #64, #67, #68, #69, #70, #75, #78, #80)
- **#8, #9, #10, #11, #13 Legal:** publish real, navigable `/legal/{terms,privacy,refund,license}` (replace the "Draft policy" whole-page placeholder with real **draft** copy + structure); this clears the PSP-compliance blocker structurally (#13). Binding wording = HUMAN/PROD-CUTOVER. **#51, #52, #67** Pricing/marketing copy: per D-1 subscriptions are marketing-only with honest CTAs (or removed); align "for Every Business"/OG copy with the real (India-first, growing) catalog.
- **#16, #17, #29, #30, #22 Quality facts:** run **real** Lighthouse (`@lhci/cli`) + an axe a11y pass against the running app/preview and **store measured scores per theme** (no invented numbers); compute a real **compatibility** matrix from theme metadata; render a real **changelog** from `theme_releases`/version history; surface perf/a11y/compatibility/changelog on the detail page. `DEV-DEFAULT` (CI wiring) / `IN` (rendering).
- **#40, #41, #69, #70 Responsiveness:** single-column bento `< sm`; mobile catalog filters → bottom-sheet/expander (the developer card already left the buyer catalog in F7); responsive container padding; an ultra-wide (`> 1280`) layout. `IN`.
- **#38, #68 i18n/locale:** one consistent locale (`en-IN`) across dates/numbers; i18n scaffolding. `IN`.
- **#50 Telemetry:** funnel events (browse→preview→purchase→install) via the approved analytics path (no PII in `NEXT_PUBLIC_*`). `IN`.
- **#75 Copy:** replace dev-facing empty-state strings with merchant-facing copy. **#78** keep the honest inline `MarketplaceUnavailable` on API failure (verify it still triggers correctly).
- **#64, #80 SEO finalize:** flip `noindex` → indexable **only** on pages that are now real (legal/docs/support/about/developer as appropriate); ensure `robots`/`sitemap` never list placeholder stubs. `IN`.

**V2 (Phase 14) alignment:** F1–F2 deliver "Activate proof + catalog"; F3 delivers "Try-before-buy"; F5 delivers "Fulfillment + commerce truth"; F7 delivers "Developer business"; F0/F8 deliver "Coherence & compliance." The V2 P0–P5 roadmap is satisfied by F0–F8 above.

> **Coverage check (run before finishing):** grep the audit's Top-100 numbers against your PROGRESS LOG + PROOF MATRIX and prove **#1–#100 each appear** with a terminal status and a runnable proof. None silently unaddressed.

---

## 7. VERIFICATION GATES (run after every phase + at final; record exact commands incl. escalation)

```bash
# App
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint            # 0 errors; warnings only if pre-existing — list them
pnpm --filter @letbuyy/theme-marketplace build           # record escalation if Turbopack stalls
pnpm --filter @letbuyy/theme-marketplace test            # MUST exit 0 (see §9b)
node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs   # keep green; extend it

# Shared packages you extended (ADDITIVE ONLY)
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/theme-engine typecheck && pnpm --filter @letbuyy/theme-engine test
pnpm --filter @letbuyy/shared-types typecheck
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build

# Gateway (theme routes)
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test

# Federation / theme suites (extend, keep green)
node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs

# Database: APPLY to a real LOCAL Postgres + run BOTH verification harnesses (see §9c) — capture output
# Governance + intelligence
node scripts/validate-governance.mjs                     # green for the theme vertical; isolate/prove non-theme failures (§9a)
node scripts/generate-repository-intelligence.mjs        # only if routes/schema/topology changed; never hand-edit output
```

**Acceptance:** typecheck/lint/build/test pass for everything you changed; `validate-governance` reports **no new** failures attributable to the theme vertical (with the §9a isolation proof); each new/changed migration has a passing **local** verification harness applied to a real Postgres; a **backward-compat surface diff** confirms `api-client`/`theme-engine`/`shared-types`/`ui` changed **only by addition**. Add focused tests for **every** behavioral change. If a change can only pass by editing outside the theme vertical, revert it and re-plan inside the vertical (or reclassify the precise out-of-vertical bit as PROD-CUTOVER/HUMAN).

---

## 8. DEFAULT DECISIONS (apply now; each flagged in the register for ratification)

- **D-1 Pricing model — RATIFIED:** per-theme one-time INR purchase is the live commerce path. Build settlement/receipts/licensing/refunds for one-time purchases. Free/Pro/Unlimited subscription tiers are **marketing-only** with honest CTAs (waitlist/contact) or removed; **do not build subscription billing**. Subscriber-entitlement gating out of scope.
- **D-2 Revenue share % / payouts — HUMAN, with working default:** compute at **15%** (config) so numbers are real; final % + payout schedule + provider contract = ratify later.
- **D-3 Catalog — DEFAULT functional samples, honest zeros + two sample authors.** Production creative themes/screenshots = PROD-CUTOVER; real third-party devs = HUMAN recruitment.
- **D-4 Legal/policy/marketing copy — HUMAN, with working draft:** routes + real draft copy render and are navigable now; binding wording = sign-off. Never block payments-readiness on this.
- **D-5 Payments/geography — DEFAULT Razorpay/INR with mock provider for dev.** GST invoice structure + dev GSTIN now; registration details + Stripe/global = PROD-CUTOVER/HUMAN.
- **D-6 Live execution — local-apply only.** Migrations/seeds/provider/object-storage/notification/scanner integrations are built, run with **working local/mock adapters**, and verified on a **local** Postgres; live DB apply, real keys/buckets, deploys = PROD-CUTOVER.
- **D-7 Domain — env-driven, governed default.** `NEXT_PUBLIC_PLATFORM_DOMAIN` defaults to the governance-accepted value (governance GREEN); tenant storefronts stay `*.letbuyy.store`; `.com` cutover = governance-owner allow-list + DNS, one PROD-CUTOVER line. **Do not edit `scripts/`.**
- **D-8 Design system — unify on `@letbuyy/ui`** (migrate bespoke marketing tokens in, additively).
- **D-9 Generated intelligence — regenerate via script**, never hand-edit; if it needs human review, PROD-CUTOVER and continue.
- **D-10 Coupons — implement OR remove.** No permanently-disabled control. Default: implement a working coupon-validation endpoint; if descoped, remove the UI entirely.
- **D-11 Perf/a11y numbers — measured only.** Lighthouse/axe run against the running app; store measured values; never invent a score.
- **D-12 Sample review/install data — real rows, clearly first-party.** Seed/test-created rows are acceptable proof data; they are honest (real DB rows), not fabricated UI metrics, and must be labelled/sourced as first-party sample data, not presented as third-party social proof.

---

## 9. RESOLVE THE THREE RED GATES (decisively — these have blocked prior runs)

**(a) Governance GREEN for the theme vertical.** Conform theme-app platform/support **source defaults** to the value `validate-governance` accepts (via `NEXT_PUBLIC_PLATFORM_DOMAIN`, D-7), keeping tenant hosts `*.letbuyy.store`. Then prove the theme vertical adds **zero** new governance failures: run `node scripts/validate-governance.mjs` on a tree where non-theme untracked pollution is stashed (e.g. `git stash -u -- ':!apps/theme-marketplace' ':!services/api-gateway' ':!packages' ':!database' ':!docs/themes-marketplace-audit'` or equivalent) and record the result. If a remaining failure is caused by a non-theme file (e.g. `apps/app-marketplace/...` inventory drift), prove it is pre-existing and out of the 100 — do **not** edit those files, and do **not** claim green if it isn't; report the precise separation.

**(b) `pnpm --filter @letbuyy/theme-marketplace test` exits 0.** Today it fails because the app `test` script runs the shared `tests/auth/sso-redirects.test.mjs`, which fails on `apps/app-marketplace/src/proxy.ts`. Fix properly: (i) make the theme-owned SSO redirect assertions pass; and (ii) either restore SSO-redirect parity in `apps/app-marketplace/src/proxy.ts` **if** it is a small, obvious regression that unblocks the shared gate (allowed as a logged gate-unblock), **or** scope the theme app's `test` script to theme-owned suites and move the shared SSO test to a shared runner. The gate must pass **without** "ignore the unrelated failure." Document any escalation (Turbopack/tsx IPC) so it is reproducible.

**(c) DB migration APPLIED + VERIFIED on a real local Postgres — not "SQL written."** Stand one up, in order of preference: repo Supabase local (`supabase start` / documented local DB) → Docker (`docker run … postgres`) → `apt-get install -y postgresql` + `initdb`/`pg_ctl`. Apply the theme migrations + `theme-marketplace-sample-catalog.sql` + your new migrations, then run **both** verification harnesses and capture output. Only if every approach genuinely fails after a real attempt may DB-apply remain a single PROD-CUTOVER line — and then still run a SQL parse/lint (e.g. `pgsql-parser` in Node) so the SQL is proven valid.

---

## 10. PROOF MATRIX (mandatory deliverable)

Append a **PROOF MATRIX** to the ledger — one row per issue **#1–#100**:

`| #N | <title> | DONE | <exact test file::name OR reproducible command that proves it> |`

Rules:
- Every row is `DONE` or `DONE (works locally; PROD-CUTOVER: <x>)` (the §3 set only).
- The proof column must be **runnable** — a `node --test …`, a gateway test name, a `curl`/script against the dev server, or a stored-data assertion. "Implemented in `<file>`" is **not** acceptable proof.
- Add real automated tests so the matrix is mostly test-backed: reviews (create-gated/list/aggregate/reply), purchase→verify→receipt+license, GST invoice, download signed-URL+size, install→preview→publish→rollback→uninstall, update-apply, refund→refunded, saved-search persist+rerun+alert, report submit, favorites, compare, collections, author profile, settings persistence, developer listing submit→scan→review→decision, analytics numbers, payout compute at 15%, perf/a11y stored values rendered on detail, telemetry events. Extend the federation + `foundation-honesty` suites; keep all green.
- End with a computed line: `DONE: X/100 · PROD-CUTOVER pending: Y (names)` where **X must be 100** and **Y is only the §3 named items**.

---

## 11. LEDGER & STATUS (create + maintain under docs/themes-marketplace-audit/, NOT root)

Create `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_LEDGER.md`:
1. **ARCHITECTURE DECISIONS** — record D-1…D-12 with chosen default + any AGENTS conflicts.
2. **BASELINE** — pre-edit §7 gate results + worktree state + the enumerated prior-`SKIPPED` conversion list + pre-existing non-theme failures isolated (not adopted).
3. **PROGRESS LOG** — one line per issue #1–#100 and per sub-task:
   `- <ISO8601Z> [F-P{n}] #<issue> <short title> — <STATUS> — evidence: <files / cmd / migration / test>`
4. **DEFERRED / PROD-CUTOVER REGISTER** — the consolidated §3/§4 lines; the operator's go-live to-do (secrets/wording/numbers + env flips + live apply).
5. **PROOF MATRIX** — §10.
6. **VERIFICATION / INTEGRATION NOTES** — new api-client methods + routes + tables; backward-compat surface-diff result; local DB apply + harness output.

Create `…_STEPUP_V2_STATUS.md`: per-phase counts (DONE / DONE-with-PROD-CUTOVER), final gate output, the one-screen "what an operator swaps to go live" summary, and an explicit statement that this run **supersedes** the prior step-up/closeout missions for this pass.

---

## 12. DEFINITION OF DONE (this mission)

- **PROOF MATRIX = 100/100 DONE.** No issue is a non-functional skip. The only open items are the §3 PROD-CUTOVER secrets/wording/numbers, each with a working dev default and a one-line cutover note.
- A reviewer running `pnpm --filter @letbuyy/theme-marketplace dev` (+ gateway + local DB) can **actually**: browse a multi-theme, multi-category, multi-author catalog with working facets/ranking/collections/search; **preview/try** a theme (incl. anonymous sandbox, no store needed); read **and write** a verified review; buy a theme and receive a **real receipt + license + GST invoice**; **download a real file**; install → preview → publish → **rollback** → uninstall; request a refund that reaches `refunded`; save/compare/favorite; and as a developer, onboard, submit a listing that runs a **scan** and moves through **review with written feedback**, with **analytics** and a **payout computed at 15%**. Each backed by a test.
- Shipped UI has **zero** fabricated metrics, **zero** placeholder/dev/"pending"/"TBD" strings, **zero** `href="#"`, **zero** controls calling missing endpoints. `foundation-honesty.test.mjs` passes and is extended.
- §7 gates pass for everything changed; **`theme-marketplace test` exits 0**; `validate-governance` is green for the theme vertical (with §9a isolation proof); the DB migration is **applied + both harnesses pass** on a real local Postgres; shared-package changes are **additive & backward-compatible** (surface diff proves it).
- `git status` shows changes confined to the **theme vertical** (`apps/theme-marketplace/**`, theme routes in `services/api-gateway/**`, additive `packages/{api-client,theme-engine,shared-types,ui}/**`, `database/supabase/{migrations,seeds,verification}/**`) + the `docs/themes-marketplace-audit/…_STEPUP_V2_*` files. The only allowed out-of-vertical edit is the §9b SSO-parity gate-unblock in `apps/app-marketplace/src/proxy.ts` **if** taken — logged. No root/`AGENTS.md`/`scripts/` edits, no new root `CODEX_*`.
- STATUS + PROD-CUTOVER register written so a human/operator finishes go-live with **only** secret/wording/number swaps + env flips + a live migration apply — no rebuilds.

---

**Begin with the BASELINE capture (and enumerate every prior `SKIPPED` line), stand up local Postgres, then work F0 → F8 in one continuous run. Default rule: if it lives in the theme vertical, BUILD it now, wire it end-to-end, prove it with a test, log it. Defer only a literal prod secret / legal wording / business number / live-apply — and even then ship a working dev default, record one PROD-CUTOVER line, and keep going. Do not stop until the PROOF MATRIX reads 100/100 DONE and all gates (typecheck/lint/build/test/governance/local-DB) are green. This is the foundation — make it fundamentally strong.**


