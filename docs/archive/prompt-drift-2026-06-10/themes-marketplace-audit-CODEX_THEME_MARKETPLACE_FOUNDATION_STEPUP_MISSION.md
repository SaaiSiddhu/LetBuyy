<!-- CODEX MISSION PROMPT — point Codex at this file. FULL-VERTICAL, SINGLE-RUNNER, SINGLE-GO.
     This mission CONSOLIDATES the two prior parallel missions (CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md = frontend only,
     CODEX_THEME_PLATFORM_BACKEND_MISSION.md = backend only) into ONE non-stop pass owned by ONE runner. It is NOT meant to run
     in parallel with those two — it supersedes them for this pass. If you instead want the parallel split, run those two; do not run all three.
     LOCATION NOTE: this mission + its ledger/status live under docs/themes-marketplace-audit/ (NOT repo root, NOT under apps/services/packages)
     per scripts/validators/source-ledger-residue-validator.mjs. -->

# CODEX MISSION — Theme Marketplace FOUNDATION STEP-UP (full vertical, one runner, single go)

You are Codex operating **locally** on the LetBuyy monorepo. This is the **foundation mission**: make the **Theme Marketplace fundamentally strong end-to-end** by driving **every one of the 100 issues** in `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` (Phase 15) to a terminal state in **one continuous run** — frontend **and** the backend/data that makes it real.

This time you own the **whole theme vertical**, so the prior split's "SKIPPED cross-boundary" class **mostly disappears**: if the work lives anywhere in the theme vertical (app + the theme routes in the gateway + the theme tables/seeds in the DB + additive shared-package methods), you **IMPLEMENT it now**. You **only** stop-and-skip for genuine **HUMAN** gates (legal/policy/marketing copy, brand creative, a chosen revenue-share %/payout schedule) and genuine **LIVE** gates (real provider secrets/keys, real object storage, applying migrations to a live DB, deploys). For every skip: ship the maximal reversible in-code part, write a one-line **DEFERRED-HUMAN/LIVE** register entry naming exactly what a human must later do, and **keep going**. Never halt the run for approval.

Status vocabulary (matches prior missions): `DONE` · `DONE locally/SKIPPED live (<reason>)` · `DONE/SKIPPED human-gated (<decision needed>)`.

---

## 0. Single source of truth & required reading

Authority order (obey top-down): root `AGENTS.md` → the owning runtime's `AGENTS.md` (`apps/theme-marketplace/AGENTS.md`, `services/api-gateway/AGENTS.md`, `packages/*/AGENTS.md`, `database/AGENTS.md` if present) → `docs/governance/*` → this mission. **If anything here conflicts with `AGENTS.md`, AGENTS.md wins and you log the conflict in the ledger.**

Read before editing (the evidence base; every issue ID traces here):
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — **Phase 15 "Top 100 issues" is the canonical backlog (#1–#100); Phase 14 is the V2 target.**
- The companion audit docs in `docs/themes-marketplace-audit/` (Shopify comparison, UI/UX, content gap, feature gap, discovery, installation journey, review system, responsiveness, merchant + developer trust scorecards, V2).
- The two prior missions in this folder (`CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md`, `CODEX_THEME_PLATFORM_BACKEND_MISSION.md`) — **for their phase logic and CROSS-BOUNDARY CONTRACTS list, which you now FULFILL rather than defer.** If their ledgers/status exist, treat them as prior art and supersede them in this run's STATUS.
- Patterns to mirror (do not fork): gateway theme routes `services/api-gateway/src/routes/themes.ts` (existing: `GET /`, `/categories`, `/industries`, `/purchases/list`, `/installations/list`, `/:slug`, `/:slug/schema`, `/:slug/editor`, `PUT /:slug/editor/draft`, `DELETE …/draft`, `POST /:slug/publish`, `/:slug/preview-session`, `GET /:slug/releases`, `POST /:slug/releases/:releaseId/rollback`, `POST /packages/upload`, `POST /:slug/install`, `POST /:slug/purchase`, `POST /:slug/purchase/verify`); api-client themes resource in `packages/typescript/api-client/src/index.ts`; `ThemeReview` in `packages/theme-engine/src/index.ts`; existing theme tables in `database/supabase/migrations/000_baseline.sql` (incl. **`theme_reviews` already exists**); the seed/verification convention `database/supabase/seeds/urban-kicks-theme.sql` + `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql`; INR single-source `packages/typescript/ui/src/formatting.ts`; intelligence regenerator `scripts/generate-repository-intelligence.mjs`.

---

## 1. OWNERSHIP & BOUNDARY (full theme vertical — one runner)

**You OWN and may modify (the entire theme vertical):**
- `apps/theme-marketplace/**` — all source, config, public assets, app-local tests.
- `services/api-gateway/**` — **theme-related routes/handlers/workers only** (reviews, settlement→receipt/license, refunds, downloads, settings persistence, developer-program, catalog params, collections/ranking, author profiles). Follow the service's AGENTS conventions: business orchestration via execution adapters, **not** in `services/*/src/services/*.service.ts`.
- `packages/typescript/api-client/**` — **additive only** (new methods/types; never rename/remove/repurpose existing exports or change existing response shapes).
- `packages/theme-engine/**` — additive only, and only if new shared types are required (prefer reusing `ThemeReview` and existing types).
- `packages/typescript/shared-types/**` — additive only, for canonical cross-runtime DTOs (per AGENTS, new commerce/theme DTOs are **canonical here**, not hand-rolled app-local types).
- `database/supabase/**` — new **sequential, unique, reversible** migrations under the single root `database/supabase/migrations/`, idempotent `seeds/`, and `verification/` harnesses. New entity tables MUST include `id, created_at, updated_at, deleted_at`, audit columns, indexes, and **RLS policies** (AGENTS rule).
- Your tracking files **under docs (NOT root):** `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_LEDGER.md` and `…_STATUS.md`.
- You MAY regenerate generated intelligence **only** via `node scripts/generate-repository-intelligence.mjs` if route/schema/topology changes require it — **never hand-edit** generated `AGENTS.md`/intelligence; if the regenerator needs human review, mark the regen `SKIPPED human-gated` and continue.

**You MUST NOT touch:**
- Any **non-theme** code in `services/**` or other `apps/**` (e.g. merchant-control-plane app screens, identity-platform, storefront-runtime app code) **except** the minimal, clearly-theme-owned storefront preview/render hook if a fix demands it — and only additively, logged. The merchant editor is an **install target**: deep-link to it, do not rebuild it.
- `infrastructure/**`, `legacy/**`, generated-artifact trees (consume, never hand-edit), `scripts/**` validators (run them; do not edit them).
- Root shared/config: `AGENTS.md` (root), root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`.
- Secrets of any kind. `NEXT_PUBLIC_*` is public and must never carry secrets; service-role keys stay server/worker-only; never put tokens in `localStorage` (preview-only wishlist/search prefs in `localStorage` are allowed).
- **Do NOT create any `CODEX*.md` at repo root or under `apps/`, `services/`, `packages/`** — the `source-ledger-residue-validator` fails on those. Your ledger/status live under `docs/themes-marketplace-audit/` only. Registering anything in a validator allow-list is a HUMAN change → SKIP.
- Deprecated aliases (`apps/admin|auth|checkout|internal|merchant|storefront|analytics`, `apps/mobile/operator-team-app`, nested `consumer-storefront`) — never recreate.

**BACKWARD-COMPAT CONTRACT:** other runtimes consume `@letbuyy/api-client`, `@letbuyy/theme-engine`, `@letbuyy/shared-types`, `@letbuyy/ui`. All your package changes are **strictly additive and backward-compatible** — every other app/service must keep typechecking and building against the existing surface at all times. New behavior lands behind clearly-named new methods/flags the app adopts in the same run.

---

## 2. PRIME DIRECTIVES (the foundation principles)

1. **No dead controls.** Never ship a button/link/input implying a capability it lacks. In this mission the answer is usually **build it** (you own the vertical). If a control depends on a HUMAN/LIVE gate, ship it behind an **off-by-default feature flag** with an honest disabled state — never a control that calls a missing endpoint.
2. **No fabricated content, ever.** No hardcoded metrics, invented file sizes, fake ratings, or engineering placeholders (`[SKIP - NEEDS BACKEND]`) in shipped UI. Seeded data starts at **honest zero** (0 installs/reviews/purchases, no invented ratings). Numbers are data-derived or omitted.
3. **Honesty over completeness** for HUMAN/LIVE gates only. A truthful "pending"/flagged-off state beats a fake working one — but a gate is HUMAN/LIVE only if it truly needs a person, secret, or live infra; otherwise **implement it**.
4. **Consume, don't fork; extend, don't break.** Reuse existing `@letbuyy/*` methods; when you must add to shared packages, add — never rename/remove/repurpose.
5. **Security & tenancy first.** Verify provider signatures on settlement/refund/webhooks; verified-purchase gating on reviews; authz + rate-limit + size caps + asset scanning on upload; **call `verifySiteOwnership` (or the established ownership guard) on every store-scoped op** — the gateway runs as service-role (RLS-bypassing), so ownership is a manual invariant you must uphold. Server-side price recalculation; CSRF/webhook-verification parity per `tasks/todo.md`.
6. **Single-source invariants.** INR/currency formatting via `@letbuyy/ui` `formatting.ts`; crypto via the api-gateway crypto lib; one Supabase migration root; canonical DTOs in `@letbuyy/shared-types`. Never duplicate.
7. **Idempotent, reversible migrations & seeds**, sequential unique numbering, never dependent on generated artifacts; ship a `verification/` harness for each schema change.
8. **Green gates always** (§6) after every phase — never leave any package/service/app non-building. Pre-existing failures from outside the theme vertical are noted, not adopted.
9. **Log everything** (§9). Silent changes are forbidden. Every issue #1–#100 gets a terminal ledger line.

---

## 3. CLASSIFICATION PROTOCOL (apply to each of the 100 issues + each V2 task)

- **`IN` — implement now (default for almost everything).** Lives anywhere in the theme vertical you own (app, theme routes, theme tables/seeds, additive shared methods). Build it, wire it end-to-end, test it.
- **`LIVE` — implement locally, SKIP live execution.** Needs real provider keys/secrets, real object storage/CDN, applying migrations to a live DB, or a deploy. Write the full code + local/dry-run verification + the migration/verification SQL; log `DONE locally/SKIPPED live` with exactly what to run live.
- **`HUMAN` — SKIP + DEFAULT + continue.** Needs a person: legal/policy/marketing copy, brand creative, the revenue-share % / payout schedule, anything requiring a validator allow-list edit or root/AGENTS change. Apply the §7 DEFAULT, ship the reversible structural part, log `DONE/SKIPPED human-gated` with the precise decision needed.

There is **no "skip because it's backend"** in this mission — backend in the theme vertical is `IN`.

---

## 4. EXECUTION ORDER & WORKFLOW (backend-first, then wire, then polish — all in one run)

1. **BASELINE capture** → ledger BASELINE section: run and record `pnpm -w typecheck` (or per-filter), the §6 gate suite for the theme vertical, and `node scripts/validate-governance.mjs`. Record worktree state and any pre-existing non-theme failures you will not adopt.
2. **Work phases F0 → F8 in order** (§5). Within each phase, do data/schema first, then gateway routes + api-client methods, then app wiring + tests, so the frontend wires **real** endpoints in the same pass.
3. **After each phase:** run the gate suite (§6); append a PROGRESS-LOG line for every issue/sub-task touched; update the DEFERRED register for any HUMAN/LIVE skip.
4. **Final sweep:** all gates green for your changes; governance shows no new failures; migration verification harnesses pass locally (or `SKIPPED live` with SQL written); backward-compat surface diff confirms additive-only package changes; write STATUS (per-phase counts) + the DEFERRED-HUMAN/LIVE register + a short "what a human/operator must do to go live" list.
5. **Local only.** No deploys, no prod, no live secrets, no live migration apply.

---

## 5. THE PHASES (one ordered full-vertical build — closes all 100 issues + V2 P0–P5)

> `#N` = `MASTER_AUDIT.md` Phase 15 issue. Class per §3. Each phase lists the data/gateway/app slices.

### F0 — Foundation: compatibility, domain, design-system, governance (closes #18, #68, #69, #72, #75-partial, #78, #82-#83-prep, #85, #87, #88, #100-prep)
- **Domain migration to `letbuyy.com`** across the app's 16 `letbuyy.store` references (`public-urls.ts`, `proxy.ts`, `footer.tsx`, `info-placeholder.tsx`, success/install/dashboard, pricing). `IN`. The governance rule that *rejects* `@letbuyy.com` active-source defaults is a **HUMAN** conflict (it needs a validator/allow-list decision): default app copy/links to `letbuyy.com`, and log `SKIPPED human-gated (governance rejects @letbuyy.com — needs governance owner to update source-default allow-list)`. Do not edit `scripts/`.
- **Unify the design system (#68, #69):** pick ONE token language for the marketplace. DEFAULT = standardize on `@letbuyy/ui` (`--lb-*`, `Page/PageHeader/Section/Card`) for app chrome and migrate the bespoke `globals.css` marketing tokens into `@letbuyy/ui` tokens (additive package changes), so marketing + catalog read as one product. Remove the in-checkout token mix.
- **Type hygiene (#78):** replace `any` with `@letbuyy/theme-engine`/`shared-types` types in `app/api/themes/*`.
- **Governance baseline + regen** via `node scripts/generate-repository-intelligence.mjs` if topology/routes change (never hand-edit). Keep `validate-governance` green for theme-vertical changes.

### F1 — Catalog data: a real catalog (closes #1, #54, #33, #37, #46-data, #65, #76, #77, #94)
- **Remove the single-theme enforcement (#1).** Replace `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql` semantics with a new migration + verification harness that **allows N active themes** and asserts catalog integrity (every active theme has a renderer/schema manifest, a default preset, valid templates) instead of "exactly one". Keep `urban-kicks` as one of the seeds.
- **Seed a real starter catalog (#54):** idempotent seeds for **≥2 first-party SAMPLE themes per category** across `store, portfolio, resume, landing, saas`, modeled on `urban-kicks-theme.sql` (renderer/schema manifests, templates, section/block definitions, presets). **Honest metadata:** 0 installs/reviews/purchases, no fabricated ratings, real `created_at`. Distinct category-appropriate section sets so categories are meaningfully different. Production creative themes + marketing copy = **HUMAN** (ship clearly-labelled samples now).
- **Industry taxonomy seed (#37)** so `themes.industries()` returns real options; wire the app filter to show real options, hide when empty.
- **Catalog query params (#33, #46-data):** add `price_min`/`price_max` and `layout`/`site_type` support to the catalog route + `listCatalog` (additive); re-enable those filters in the app (no longer "hide").
- **Pagination (#65):** page-number pagination using `total`/`limit`/`offset` (keep URL-addressable).
- Show modeled-but-hidden honest fields where they exist (#76 install/purchase counts when > 0); fix `publicationLabel` (#77) and dev-facing empty copy (#94).

### F2 — Discovery: real facets, collections, ranking (closes #23, #24, #34, #36, #52, #53, #58, #61, #93, #95)
- **Collections/curation (#23):** `theme_collections` + `theme_collection_items` tables (standard cols + RLS), gateway list/read routes, `api-client` methods, and `/collections/[slug]` + home curated rows. Curation *content* (which themes are featured) = **HUMAN** default to a sensible auto-rule (e.g. top-rated per category) until an editor curates.
- **Trending/new/popular (#24, #93):** composite ranking signal `rating × installs × recency` as a real `sort`/endpoint; replace the "Trending → /themes" implication with a real ranked row.
- **Tag/feature facets (#34)** and **whole-catalog autocomplete (#36)** server-backed (suggest endpoint), replacing current-page-only suggestions.
- **Category taxonomy (#53):** keep the 5 site-types but make them genuinely distinct via the seeded catalog; document the website-builder-vs-commerce positioning decision in the ledger (strategy note = **HUMAN** to ratify; default keeps current taxonomy).
- **Saved searches/alerts (#52):** persist via new `user_saved_searches` (or `localStorage` for non-secret prefs per AGENTS) — implement the persisted version.
- **Per-theme structured data (#61):** Product/Offer/AggregateRating JSON-LD on the detail page.
- Parallelize home/dashboard API calls (#58, #95 install-config note handled in F6).

### F3 — Try-before-buy (closes #7, #19, #50-preview, #51, #63, #66, #67-prep)
- **Wire `previewSession` everywhere (#7):** "Preview in your store" + card "Preview" call `api.themes.previewSession`; honest disabled only if truly unavailable.
- **Embedded live demo on the listing (#19)** + **anonymous sandbox preview (#51)** that needs no owned store (sandbox store + signed preview token); fall back to `demo_url`.
- Replace reused category preview image (#63) with per-theme/preset previews from the seeds; optimize hero/detail images via `next/image` (#66, #67).

### F4 — Trust layer: reviews, ratings, author identity (closes #2, #20-author, #21, #30, #35, #67, #98, #75)
- **Reviews API (#2, #21):** reuse the existing `theme_reviews` table; add gateway routes + `api-client` methods `themes.reviews(slug, query)` (list published) and `themes.createReview(slug, input)` (**verified-purchase gated**, moderation status `pending`); ratings aggregation (avg + distribution) on the theme record; developer reply path; ops moderation via the existing `/operations/marketplace-reviews` queue. App: real reviews section + write form (flag-on once endpoints land in this run), honest empty-state, rating distribution; remove the "gated, can't submit" dead path.
- **Author/developer profiles (#20, #35, #67):** `developer_profiles` (or author) table + `themes.author(handle)` read API; `/authors/[handle]` page (portfolio, aggregate rating, support SLA, verification flag). Verification = boolean model now; the *verification program* = **HUMAN**.
- **Real "X stores use this" / marketplace proof (#30, #75, #98):** derive from real install/review counts; show only when > 0; correct pluralization.

### F5 — Commerce truth: settlement, receipts, license, tax/GST, refunds, downloads (closes #9, #10, #14, #15, #16-mechanism, #28-mechanism, #44-#48, #46-delivery, #91, #99)
- **Settlement → receipt + license (#9):** signature-verified Razorpay settlement path that, on verified purchase, issues a **real receipt + license key** and flips status to `completed`; success page renders real order #, amount, and license (kills all "pending/syncing" placeholders). `LIVE` for real keys → build + local test + `SKIPPED live`.
- **Tax + GST invoice (#14):** India-first GST fields on checkout + a generated GST invoice artifact; remove "Confirmed by provider" tax placeholder. Invoice numbering/series config = structure now; legal GST registration details = **HUMAN**.
- **Currency (#15):** keep INR via `@letbuyy/ui` formatting single-source; if USD prices are shown they must be real and the rail consistent — DEFAULT INR-only, copy aligned; enabling a non-INR/Stripe rail = **HUMAN/LIVE**.
- **Refunds (#28-mechanism, #16-mechanism):** theme-purchase refund path extending `orders.refund`; status → `refunded`; policy *fields* now, policy *text/window* = **HUMAN**.
- **Downloads (#10, #46-delivery, #99):** artifact generation + **entitlement-checked signed-URL** endpoint per platform (`letbuyy/wordpress/html/react`) returning **real sizes**; app Downloads page renders real artifacts (no "Signed URL pending"); object storage/CDN wiring = `LIVE`.
- **Order history + receipts surface (#48)**, **email notifications (#47)** (receipts/updates via the notification path; provider keys = `LIVE`), and fix the "Premium Licenses" stat to a real count (#91).

### F6 — Safe lifecycle: install/preview/publish/rollback/update/uninstall + settings (closes #12, #13, #22, #49, #62, #70, #95)
- **Non-destructive install (#12):** install → **draft release → preview → publish**, reusing `api.themes.releases`/`rollbackRelease`/`publish`; rollback available from the marketplace; remove the "rollback handled outside this runtime" caveat once wired.
- **Apply-update (#13):** wire the `update_available` badge to a real apply-release action.
- **Uninstall/revert (#49)**, **install preset choice (#95)** (pass real `config_overrides`/preset), **Customize deep-link (#22)** to the merchant editor (env-based admin URL; do not rebuild the editor).
- **Settings persistence (#62)** + **real plan badge (#70):** profile + notification-preference storage + endpoints so Settings persists; dashboard plan badge reads the real plan (no hardcoded "Free").

### F7 — Developer program: list, review, get paid (closes #3, #4, #38, #39, #40, #41, #42, #43, #44, #45, #55, #57, #59, #60-dev)
- **Developer console + listing builder (#3, #39, #45):** move the developer surface OUT of the buyer's catalog sidebar (#38); build `/developer` + `/developer/listings/new` with a real listing builder (name, descriptions, screenshots, pricing, **license tiers**, category/industry tags) writing to listing/submission records (`theme_packages` + new listing fields/tables).
- **Asset/zip upload + malware scan (#40, #57):** accept real theme bundles (zip + assets), authz + rate-limit + size caps, and an asset-scan hook (`IN` for the hook; external scanner = `LIVE`).
- **Submission/review pipeline (#41, #42, #43):** developer-agreement gate (real terms text = **HUMAN**; structural gate now); lifecycle `submitted → in_review → changes_requested → approved/rejected` via the ops review queue with **written-feedback** fields and developer-visible status.
- **Analytics (#44)** read endpoints (views→install/purchase funnel, revenue, refunds) + dashboards.
- **Revenue share & payouts (#4):** model the structure + endpoints; the **rate (benchmark 15%) and payout schedule = HUMAN** (default display "TBD pending program terms"); payout provider = `LIVE`.
- **Report-a-problem/abuse (#55)** and per-theme report flow.

### F8 — Polish, responsiveness, perf, a11y, SEO, telemetry, content (closes #5-copy, #6, #8-legal, #11, #17, #26-finalize, #29, #31, #32, #56, #64, #71, #72, #73, #74, #79, #80, #81, #82, #83, #84, #85, #86, #89, #90, #92, #96, #97, #100 + any remaining P2)
- **Legal/content (#5, #8, #11, #89, #90, #100):** publish real `/legal/{terms,privacy,refund,license}`, `/docs`, `/docs/api`, `/support`, `/about`, `/contact`, `/changelog` structurally; the **binding legal/marketing copy = HUMAN** (ship clearly-labelled draft copy + structure now, register for legal sign-off). Resolve pricing "TBD" (#17, #89): per D-1, subscription tiers are marketing-only with honest CTAs (waitlist/contact) or removed; per-theme purchase is the live path.
- **Responsiveness/perf/a11y (#29, #31, #32, #56, #64, #66, #67, #71, #72, #73, #74, #79, #80, #81, #82, #83, #96, #97):** mobile catalog filters → bottom-sheet/expander (remove the upload panel from the buyer catalog — moved to /developer in F7); single-column bento < `sm`; responsive container padding; ultra-wide layout > 1280; ≥44px touch targets; fix contrast on glass/dark captions to WCAG AA; locale consistency (one `en-IN`); favicon + real OG image; per-theme perf (Lighthouse) + a11y + compatibility/changelog data surfaced (#25, #26, #27, #29, #32) from real theme metadata.
- **Wishlist/favorites (#31)** persisted; **compare view (#32-feature)**; **i18n scaffolding (#56)**.
- **Telemetry (#84, #86):** funnel events (browse→preview→purchase→install) via the approved analytics path (no PII in `NEXT_PUBLIC_*`).
- **SEO finalize (#60, #81, #100):** valid sitemap/robots that don't list placeholder stubs as indexable; flip `noindex` only on pages that become real.

> Coverage check: every issue #1–#100 is named in F0–F8. Before finishing, grep the audit's Top-100 numbers against your PROGRESS LOG to prove none is silently unaddressed.

---

## 6. VERIFICATION GATES (run after every phase + at final)

```bash
# App
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint
pnpm --filter @letbuyy/theme-marketplace build
pnpm --filter @letbuyy/theme-marketplace test        # keep the 3 federation/auth tests green; add app tests

# Shared packages you extended (additive only)
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/theme-engine typecheck && pnpm --filter @letbuyy/theme-engine test
pnpm --filter @letbuyy/shared-types typecheck
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build

# Gateway (theme routes)
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test

# Federation / theme suites (extend, keep green)
node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs

# Database: apply to a LOCAL db if available, else validate SQL + run the verification harness pattern
# (never apply to a live DB — that is SKIPPED live)

# Governance + intelligence
node scripts/validate-governance.mjs
node scripts/generate-repository-intelligence.mjs   # only if routes/schema/topology changed; never hand-edit output
```

**Acceptance:** typecheck/lint/build/test pass for everything you changed; `validate-governance` reports **no new** failures attributable to your changes; each new/changed migration has a passing local verification harness (or `SKIPPED live` with the verification SQL written); a **backward-compat surface diff** confirms `api-client`/`theme-engine`/`shared-types`/`ui` changed **only by addition**. If a change can only pass by editing outside the theme vertical, revert it and re-plan inside the vertical or reclassify the precise out-of-vertical bit as HUMAN/LIVE. Add focused tests for **every** behavioral change (reviews gating, settlement→receipt, signed downloads, non-destructive install/rollback, real filters, removed dead controls, honest empty states).

---

## 7. DEFAULT DECISIONS (apply now; each flagged in the DEFERRED register for ratification)

- **D-1 Pricing model — RATIFIED (owner, 2026-06-07):** **per-theme one-time purchase is the live commerce path.** Build settlement/receipts/licensing/refunds for one-time purchases. Free/Pro/Unlimited subscription tiers are **marketing-only**: fix CTAs to honest waitlist/contact (or remove); **do not build subscription billing** in this mission. Subscriber-entitlement gating is out of scope.
- **D-2 Revenue share %/payouts — HUMAN.** Model the structure with the rate held in config and displayed as "TBD pending program terms"; the **% and payout schedule are a human decision** (Shopify 15% is a benchmark, not a commitment). Payout provider integration = LIVE.
- **D-3 Seeded catalog — DEFAULT samples, honest zeros.** Ship functional first-party **sample** themes (≥2/category) with zero metrics and no invented ratings. Production creative themes + marketing copy = HUMAN.
- **D-4 Legal/policy/marketing copy — HUMAN.** Build the routes/structure and ship clearly-labelled **draft** copy that does not assert binding terms; final Terms/Privacy/Refund/License/About copy = legal/brand sign-off. Never block payments-readiness work on this; just register it.
- **D-5 Payments/geography — DEFAULT Razorpay/INR.** Make all copy India-first; GST invoice structure now (registration details HUMAN). Enabling Stripe/global = HUMAN + LIVE.
- **D-6 Live execution — LIVE-skip.** All migrations/seeds/provider/object-storage/notification integrations are built and locally verified; **applying to live DB, real keys/secrets, real buckets, and deploys are SKIPPED live** with exact run instructions.
- **D-7 Domain — `letbuyy.com`.** Default all app copy/links to `letbuyy.com`. The governance rule that rejects `@letbuyy.com` active-source defaults is a HUMAN conflict (needs the governance owner to update the source-default allow-list in `scripts/`); do not edit `scripts/` — register it.
- **D-8 Design system — unify on `@letbuyy/ui`.** Migrate bespoke marketing tokens into `@letbuyy/ui` (additive) rather than maintaining two languages.
- **D-9 Generated intelligence — regenerate via script.** Use `scripts/generate-repository-intelligence.mjs`; never hand-edit AGENTS/intelligence; if it needs human review, SKIP-human and continue.

---

## 8. THE SKIP-AND-CONTINUE CONTRACT (read this twice)

This mission **does not stop for approval.** When you hit a HUMAN or LIVE gate:
1. **Ship the maximal reversible in-code part now** (schema/model/endpoint/flag/structure/draft copy) so the moment the human/secret/infra lands, the feature activates with a flag flip or key, not a rebuild.
2. **Add one line to the DEFERRED register** (a dedicated ledger section) in this exact shape:
   `- [HUMAN|LIVE] #<issue(s)> <title> — DEFERRED: <the precise human action / secret / live step> — UNBLOCKS: <what flips on> — code ready at: <files>`
3. **Continue immediately** to the next item. Never leave the run idle waiting on a person.

A gate is **only** HUMAN/LIVE if it genuinely needs a person, a secret, real infra, or a `scripts/`/root/AGENTS allow-list edit. "It's backend", "it's a migration", "it's a new table/route", "it touches the gateway theme routes" are **NOT** skip reasons here — they are `IN`. If you find yourself skipping something for a non-HUMAN/non-LIVE reason, you are doing it wrong: implement it.

**Canonical HUMAN/LIVE deferrals expected (everything else = build now):** binding legal/refund/privacy/license + marketing/about copy (HUMAN); revenue-share % + payout schedule (HUMAN); production creative themes/screenshots (HUMAN); the governance `@letbuyy.com` allow-list change (HUMAN); GST registration identifiers (HUMAN); Stripe/global enablement (HUMAN+LIVE); real Razorpay/notification/scanner keys (LIVE); object storage/CDN buckets for downloads (LIVE); applying migrations/seeds to a live DB and any deploy (LIVE).

---

## 9. LEDGER & STATUS (create + maintain under docs/themes-marketplace-audit/, NOT root)

Create `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_LEDGER.md`:
1. **ARCHITECTURE DECISIONS** — record D-1…D-9 with chosen DEFAULT and any AGENTS conflicts encountered.
2. **BASELINE** — pre-edit gate results (§6) + worktree state + pre-existing non-theme failures noted (not adopted).
3. **PROGRESS LOG** — one line per issue #1–#100 **and** per sub-task:
   `- <ISO8601Z> [F-P{n}] #<issue> <short title> — <STATUS> — evidence: <files / cmd / migration>`
   e.g. `- 2026-06-07T11:40:00Z [F5] #9 settlement→receipt+license issued — DONE locally/SKIPPED live (Razorpay live keys) — evidence: services/api-gateway/src/routes/themes.ts (settlement handler), packages/typescript/api-client/src/index.ts (themes.receipt), apps/theme-marketplace/src/app/checkout/success/page.tsx`
4. **DEFERRED-HUMAN/LIVE REGISTER** — the consolidated §8 lines; this is the human/operator's to-do to finish go-live.
5. **VERIFICATION / INTEGRATION NOTES** — new api-client methods + routes + tables added; backward-compat surface-diff result; migration verification results.

Create `…_STEPUP_STATUS.md`: per-phase counts (DONE / SKIPPED-live / SKIPPED-human), final gate output, a one-screen "what an operator must do to ship live" summary, and an explicit statement that this run supersedes the parallel two-mission split for this pass.

---

## 10. DEFINITION OF DONE (this mission)

- **All 100 issues** (and the V2 P0–P5 essentials) have a terminal ledger line: `DONE`, `DONE locally/SKIPPED live`, or `DONE/SKIPPED human-gated`. **None left silently unaddressed** (prove it with a Top-100 grep against the PROGRESS LOG).
- A merchant can: browse a multi-theme catalog, filter by real facets, **preview/try** a theme, read **verified reviews**, **buy with a real receipt + license + GST invoice**, **install to a draft → preview → publish → roll back**, see real **downloads** and **order history**. Each is implemented locally; only real keys/storage/live-apply are `SKIPPED live`.
- A developer can: onboard, build a real listing (assets/zip), submit through a **review pipeline with written feedback**, see **analytics**, and have a **revenue/payout structure** (rate "TBD" pending the human %).
- Shipped UI has: zero fabricated metrics, zero placeholder/dev strings, zero `href="#"`, zero controls that call missing endpoints (flag-off honest states only where HUMAN/LIVE-gated).
- §6 gates pass for everything you changed; `validate-governance` shows no new failures; migrations carry passing local verification harnesses (or `SKIPPED live` with SQL); shared-package changes are **additive & backward-compatible** (surface diff proves it); the 3 existing app tests stay green and new tests cover every behavioral change.
- `git status` shows changes only within the **theme vertical** you own (`apps/theme-marketplace/**`, theme routes in `services/api-gateway/**`, additive `packages/{api-client,theme-engine,shared-types,ui}/**`, `database/supabase/{migrations,seeds,verification}/**`) and the two `docs/themes-marketplace-audit/…_STEPUP_*` files — **no root/AGENTS/scripts edits, no new root `CODEX_*`**.
- STATUS + DEFERRED register written so a human/operator can finish go-live with flag flips, copy, keys, and a live migration apply — no rebuilds.

**Begin with the BASELINE capture, then F0, and work F0→F8 in one continuous run. Default rule: if it lives in the theme vertical, build it now, wire it end-to-end, test it, log it. Skip only true HUMAN/LIVE gates — record each in the DEFERRED register and keep going until every one of the 100 issues is terminal.**

