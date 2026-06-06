# CODEX MISSION — THEME MARKETPLACE FOUNDATION (close the 100, make it honest)

**Owner runtime (HARD boundary):** `apps/theme-marketplace` **only.** This mission modifies source **exclusively** under `apps/theme-marketplace/**` plus this mission's own root ledger/status files. It is designed to run **in parallel** with a separate gateway/DB/developer-platform task — so it must **never** edit `services/**`, `packages/**`, `database/**`, or any other `apps/**`. Anything that requires a change outside the boundary is recorded as a SKIP (see §1.L9) and the in-app half is implemented up to the boundary.

**Issue source of truth (canonical):** the audit you must read first, in order:
1. `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — **Phase 15 "Top 100" is the traceability spine. Each row #1…#100 = issue `TM‑1…TM‑100`.**
2. `docs/themes-marketplace-audit/THEME_CONTENT_GAP_ANALYSIS.md`, `…/THEME_MARKETPLACE_UI_UX_AUDIT.md`, `…/THEME_INSTALLATION_JOURNEY_AUDIT.md`, `…/THEME_DISCOVERY_AUDIT.md`, `…/THEME_REVIEW_SYSTEM_AUDIT.md`, `…/THEME_RESPONSIVENESS_REPORT.md`, `…/THEME_FEATURE_GAP_ANALYSIS.md`, `…/MERCHANT_TRUST_SCORECARD.md`, `…/DEVELOPER_TRUST_SCORECARD.md`, `…/LETBUYY_THEME_MARKETPLACE_V2.md`, `…/SHOPIFY_THEME_STORE_COMPARISON.md`.

Trust the cited `file:line` evidence in those docs; verify only at the point of edit.

**Driver:** GPT‑5.5 in Codex — `xhigh` for money/auth/lifecycle work, `high` for behavior-preserving refactors + UI rewires, `medium` for mechanical content/copy edits.
**Mode:** Continuous, autonomous, single-go. Run as long as it takes. Never stop while an unblocked TM‑item remains.
**Branch:** `stream/theme-marketplace-foundation` off current `develop`.
**Governance posture (non‑negotiable):** keep **all** validators green at every commit — `node scripts/validate-governance.mjs` (**currently 157, never fewer**; add a validator only for a real invariant this mission establishes). Never delete/weaken a validator to pass. Obey root `AGENTS.md`, `CLAUDE.md`, `docs/governance/**`, and the **generated** `apps/theme-marketplace/AGENTS.md` (regenerate via `scripts/generate-repository-intelligence.mjs`; never hand-patch it).

> **This mission changes code** under one runtime. You are authorized and required to modify `apps/theme-marketplace/**` to close the TM findings below under the Operating Contract. The point of this phase is **foundational honesty**: a merchant or developer must never see a control, claim, or metric the system cannot back.

---

## 0. PRIME DIRECTIVE

The marketplace is a beautiful shell over an empty catalog, a half-wired checkout, decorative controls, and visible engineering placeholders. The audit found **100 ranked issues** (28 P0, 42 P1, 30 P2). The platform is **more capable than the marketplace shows** — `previewSession`, `publish`, `releases`, `rollbackRelease`, `orders.refund` already exist in `@letbuyy/api-client`. Your job is to make the marketplace **true to itself**:

- **Wire** every capability whose backing API already exists in `@letbuyy/api-client` (consume-don't-create).
- **Tell the truth** in every metric, claim, empty state, and control: derive from data or remove. No fabricated numbers, no `[SKIP - NEEDS BACKEND]` strings in shipped UI, no dead buttons.
- **Stop at the boundary.** When a fix needs a new gateway endpoint, a DB seed/migration, or a business/legal decision, implement the in-app half (honest state + correct client call up to the contract) and **SKIP‑record the remainder** for the parallel task or a human.

**Disposition rule (per TM‑item):**
- **REAL** — when the api-client method or in-app change suffices → implement, prove, commit.
- **HONEST** — when the backend isn't ready → ship a truthful state (empty/disabled-with-reason/"configure"/"coming soon" that links somewhere real), never a fake or a dead control.
- **`[SKIP — NEEDS GATEWAY/PARALLEL]`** — cross-boundary code (`services/**`, `packages/**`, `database/**`, other `apps/**`).
- **`[SKIP — NEEDS HUMAN]`** — legal text, pricing-model decision, revenue-share %, live payment keys, real catalog content/curation, any new marketing promise.

**SUCCESS — COMPLETE only when all are proven with recorded command + screenshot evidence:**
1. Every `TM‑1…TM‑100` ends `DONE`, `HONEST`, `SKIP — NEEDS GATEWAY/PARALLEL`, or `SKIP — NEEDS HUMAN` in the ledger TRACEABILITY MATRIX. Nothing disappears silently.
2. **No fabricated metric** ships: the home `STATS`, SEO copy, and any count/rating are data-derived or removed (TM‑2,3,4,71).
3. **No `[SKIP - NEEDS BACKEND]` / "needs seeded data" / "needs backend support" string** appears in any rendered surface (TM‑5, content-gap §C).
4. **No dead/decorative control** ships: every button/link/input either does what it implies or is removed/disabled-with-an-honest-reason (TM‑18,19,20,21,22,23,24,25,37,87,100).
5. **Preview + safe lifecycle real:** `previewSession` wired; install is non-destructive (draft→preview→publish) with update + rollback surfaced; "Customize" deep-links to the real editor (TM‑7,22,23,50,51,52,53).
6. **Checkout honest:** success page shows a real receipt/pending state (no placeholder); payment-rail copy matches reality; coupon wired or removed (TM‑5,6,17,87).
7. **Boundary respected:** `git diff --name-only develop` shows changes **only** under `apps/theme-marketplace/**` and the three root `CODEX_THEME_MARKETPLACE_*` files. Zero edits to `services/**`, `packages/**`, `database/**`, other `apps/**`.
8. **Every gate green on real evidence:** `pnpm --filter @letbuyy/theme-marketplace typecheck`, `lint`, `build` (no network); `node scripts/validate-governance.mjs` (≥157); marketplace tests in `package.json` pass; UI self-verified at 320/390/768/1024/1440 with screenshots.
9. `CODEX_THEME_MARKETPLACE_STATUS.md` summarizes outcomes with every SKIP remainder + exact follow-up command/decision and the cross-boundary contract each unblocks.

---

## 1. OPERATING CONTRACT (the laws)

1. **L1 Continuous execution.** Finish a TM‑item → update ledger → next unblocked item. Never pause to ask. Never end while unblocked items remain.
2. **L2 The Green Law.** Tree green after every commit: `pnpm --filter @letbuyy/theme-marketplace typecheck` + `lint` each increment; full `validate:governance` (≥157) at every WS gate. Never commit red. 3 failed attempts → revert, log `BLOCKED` + diagnosis, move on.
3. **L3 The Honesty Law.** Never pass a check by asserting something untrue; never "pass" a feature by faking it. A claim/metric must be data-derived or deleted. A provider/endpoint that isn't ready gets an **honest** state, never fake success and never a dead control.
4. **L4 The Boundary Law (defines parallelism).** Modify **only** `apps/theme-marketplace/**` + the three root `CODEX_THEME_MARKETPLACE_*` files. The marketplace is a **thin client**: it consumes `@letbuyy/api-client` and must add **no** backend/business logic (root `AGENTS.md`: the gateway is the sole Commerce API). If a fix needs a new client method, gateway route, schema, seed, or migration → **do not create it here** → SKIP‑record it and ship the honest in-app half.
5. **L5 Consume‑don't‑create.** If a needed method already exists on `api-client` (`previewSession`, `editor`, `saveDraft`, `deleteDraft`, `publish`, `releases`, `rollbackRelease`, `schema`, `orders.refund`), wire it through the existing server-only `ThemeService`/`createThemeMarketplaceApiClient` path. If it does **not** exist, that's cross-boundary.
6. **L6 Secrets & storage law.** No provider keys/secrets in client components; server-only for API access (keep the `server-only` boundary). `localStorage` only for non-secret UI prefs or preview-only wishlist/search (root `AGENTS.md`). No auth tokens in `localStorage`.
7. **L7 Design-system law.** Use `@letbuyy/ui` + app CSS variables/tokens; **no new raw hex** in components (the marketplace `AGENTS.md` forbids it; some legacy raw values exist — don't add more). Prefer skeletons over spinner-only loading. No new `any`; no `console.log` in shipped source.
8. **L8 REAL‑evidence law.** Behavioral/UI proof = a real browser against a local/staging stack with screenshots. Mocks are forbidden as proof. No stack creds → produce code + local proof and record the live proof as `SKIP — NEEDS HUMAN: staging secrets` with exact commands.
9. **L9 SKIP ledger (mark and continue).** Two SKIP classes, both appended to `CODEX_THEME_MARKETPLACE_LEDGER.md` with the exact cross-boundary contract or human decision + the TM‑ids they unblock, then continue:
   - `## SKIP — NEEDS GATEWAY/PARALLEL` (e.g., themes-review endpoints, catalog seed, industry taxonomy, filter server-support, developer-program backend, malware scan).
   - `## SKIP — NEEDS HUMAN` (legal text, pricing-model decision, revenue-share %/payouts, live payment keys, real catalog content, new marketing promises).
10. **L10 No fabrication.** Every `DONE` needs command/screenshot evidence. Never fake a test, never claim a provider works when it throws, never call a mock end-to-end.
11. **L11 Anti-thrash.** Max 3 attempts/item → `BLOCKED` + diagnosis → next.
12. **L12 Small reversible increments.** One logical change → validate → commit. UI rewires proven by a screenshot before/after; behavior-preserving refactors keep route/markup order.
13. **L13 Anti-ceremony.** No new top-level docs beyond this mission + its ledger + status. New in-app routes are allowed (e.g., honest legal/support landing) but prefer linking to canonical destinations over duplicating cross-app pages. On completion, these three `CODEX_THEME_MARKETPLACE_*` files archive to `docs/archive/` in the final commit.
14. **L14 Respect existing law.** Obey root `AGENTS.md`, `CLAUDE.md`, `docs/governance/**`, the Deprecated Runtime Policy, and the marketplace runtime rules. Regenerate `apps/theme-marketplace/AGENTS.md` via the generator if topology/routes change; never hand-edit it.

---

## 2. ARCHITECTURE INVARIANTS (never violate)
One backend (`api-gateway`) reached only through `@letbuyy/api-client`; one contract (`@letbuyy/shared-types`/`@letbuyy/theme-engine`) — no app-local `Theme`/`Order`/`Payment` DTOs; one identity verifier (`@letbuyy/auth-core`); one design system (`@letbuyy/ui`). Server-only secrets; tenant context explicit (`store_id`/`site_id`/ownership). Themes are **data-only** in this app — no business logic in pages. INR-first; the only configured rail today is Razorpay (test mode) — never imply more than is wired.

---

## 3. LEDGER & STATUS (create + maintain)
- Create `CODEX_THEME_MARKETPLACE_LEDGER.md` with: a **TRACEABILITY MATRIX** row per `TM‑1…TM‑100` (`id | title | WS | disposition | evidence | commit`), plus `## SKIP — NEEDS GATEWAY/PARALLEL`, `## SKIP — NEEDS HUMAN`, `## VALIDATOR LEDGER`, `## SCREENSHOT EVIDENCE`.
- Create `CODEX_THEME_MARKETPLACE_STATUS.md`: rolling summary + final outcome with every SKIP remainder and exact follow-up.
- Flip statuses as you go. A WS gate may not pass until every owned TM‑id is `DONE`/`HONEST`/`SKIP`.

---

## 4. THE WORK — WS0 → WS7 (WS0 first and complete, then in order)

> Each item: **what → do → DoD.** TM‑ids map to Master Audit Phase 15. Where a row is split, the in-app half is owned here and the rest is SKIP-recorded.

### WS0 — TRUTH & SAFETY GATE (do FIRST; stops active trust erosion)
*TM‑2,3,4,5,6(in-app half),13,17(copy),18,19,20,21,24,25,71,73,87,94,100,84.*
- **WS0.1 Kill fabricated metrics (TM‑2,3,4,71).** `src/app/page.tsx:7-12` `STATS` ("50+/10K+/4.8/4") and `src/app/layout.tsx:41` SEO "50+". Replace with values derived from `ThemeService.listThemes` totals (real counts), or remove the stat bar until the catalog is real. Fix "Categories: 4" vs the 5 real categories. _DoD: no hardcoded count/rating renders; home shows real totals or no stat bar; no metric contradicts the live category counts on screen._
- **WS0.2 Remove the post-payment placeholder (TM‑5,6 in-app half).** `src/app/checkout/success/page.tsx:36-65` shows `[SKIP - NEEDS BACKEND]…` and "pending provider confirmation". Render an **honest** receipt state from whatever the verify/purchase response actually returns (purchase id, status, theme); if settlement fields aren't in the response, show a truthful "Payment confirmed — license will appear in your Purchases" with a link, **not** a dev placeholder. Real settlement receipt/license fields = `SKIP — NEEDS GATEWAY/PARALLEL: settlement endpoint`. _DoD: no `[SKIP - NEEDS BACKEND]` string ships; success page reflects real response data; remainder SKIP-recorded._
- **WS0.3 Declaw every dead/decorative control (TM‑18,19,20,21,24,25,37,73,87,100).** Each must do what it implies or be removed/honestly disabled with a reason:
  - Navbar ⌘K search input (`navbar.tsx:124-201`) → wire to `/themes?q=` (submit/enter routes to catalog) or remove the input (TM‑24).
  - Notification bell (`navbar.tsx:318-350`) hitting non-existent `/api/notifications/count` → remove the bell, or HONEST-hide until a real source exists (TM‑25).
  - Card "Preview theme"/"Save" spans (`theme-card.tsx:46-53`) → make Preview a real `previewSession` action (see WS2) and Save a real wishlist (localStorage preview-only is allowed) or remove (TM‑37).
  - Purchases "Download" (`dashboard/purchases/page.tsx:83-86`) and Downloads buttons + fake sizes (`dashboard/downloads/page.tsx:25-28,84-101`) → wire to a real artifact/signed-URL if `api-client` exposes one, else HONEST "downloads available after settlement" and drop the fabricated MB sizes (TM‑20,21,74).
  - Settings (`dashboard/settings/page.tsx`) hardcodes identity + fake Save → load the real session user; persist via an existing client method or render read-only/honest; remove dead Password/2FA buttons or link them to the accounts app (TM‑18,19).
  - Coupon field (`checkout/page.tsx:410-422`) → remove it (no coupon contract) or HONEST-disable with reason (TM‑87).
  - Footer `#` links (`components/layout/footer.tsx:11-28`) → point each to a real destination (accounts/marketing/support) or remove; real Legal/Docs pages = SKIP (see WS5) (TM‑100).
  _DoD: zero controls render that do nothing; each is wired, removed, or disabled-with-reason; screenshot per surface._
- **WS0.4 Payment-rail copy honesty (TM‑17,84).** Home "Stripe & Razorpay integrated… global transactions" (`page.tsx:25`) vs checkout Stripe disabled/"Not configured" (`checkout/page.tsx:366-374`), INR-only. Change copy to match reality (Razorpay/INR today). Enabling Stripe / a global rail = `SKIP — NEEDS GATEWAY/PARALLEL + NEEDS HUMAN: keys`. _DoD: no claim exceeds what's wired._
- **WS0.5 Strip remaining "needs backend/seeded data" strings (TM‑94, content-gap §C).** The four catalog warnings (`themes/page.tsx:364-366,448-450,518-520`) and detail warnings (`[slug]/page.tsx:400-402,510-512`): either make the feature real (WS1/WS2) or hide the control and its banner. _DoD: no engineering-placeholder copy in any rendered surface._

**GATE WS0:** ≥157 validators; typecheck+lint+build green; no fabricated metric, no `[SKIP/NEEDS]` string, no dead control, no over-claim ship. Screenshots recorded.

### WS1 — DISCOVERY HONESTY
*TM‑26,39,46,47,64,65,66,81,38(in-app),54,55(in-app).*
- **WS1.1 Real or hidden filters (TM‑26,64).** Industry/layout/price filters are inert (`themes/page.tsx`). For each: if `api-client.themes.listCatalog` accepts the param and the gateway honors it, wire it; if not, **hide** the control (don't ship an inert filter). Server-side support for unsupported params = `SKIP — NEEDS GATEWAY/PARALLEL`. _DoD: every visible filter changes results; unsupported ones are hidden + SKIP-recorded._
- **WS1.2 Pagination (TM‑65).** `limit:30`, no next page. Add pagination/"load more" using the existing `total`/`offset`. _DoD: catalog pages beyond 30; offset reflected in URL._
- **WS1.3 Working navbar search + autocomplete from API (TM‑24,81).** Route ⌘K + catalog search to real queries; build suggestions from catalog data, not just current-page rows. _DoD: search returns results; suggestions are catalog-derived._
- **WS1.4 Honest curation rows (TM‑38,39,47).** "Trending" links to `/themes` (`navbar.tsx:642`); no collections. Either back trending/featured with a real `sort` signal or relabel honestly; replace empty-catalog "seed data" copy with merchant-appropriate empty state. Real curation/collections data = `SKIP — NEEDS GATEWAY/PARALLEL`. _DoD: no row implies a signal it lacks._

**GATE WS1:** ≥157; every shown discovery control is real; unsupported ones hidden + SKIP-recorded.

### WS2 — PREVIEW & SAFE LIFECYCLE (consume existing api-client)
*TM‑7,22,23,31,50,51,52,53,95,29(in-app),30(in-app).*
- **WS2.1 Wire live preview (TM‑7,50).** Detail "Preview in your store" is disabled (`[slug]/page.tsx:470-512`) though `api.themes.previewSession` exists (`api-client:1490`). Wire a real preview session via `ThemeService`; enable the card "Preview theme" too. _DoD: clicking Preview opens a real preview session; screenshot._
- **WS2.2 Non-destructive install (TM‑52).** Install replaces storefront with no preview/backup (`install/page.tsx`). Use the draft→preview→publish path (`saveDraft`/`previewSession`/`publish` exist) so the merchant previews before going live. Where install must remain a direct apply, surface the risk + a rollback affordance. _DoD: install offers preview-before-publish or an honest confirm + rollback path._
- **WS2.3 Update + rollback actions (TM‑23,31,51,53).** Installations shows "Update Available" with no action (`installations/page.tsx:11-14`). Add an "Apply update" action via `publish`/`releases`, and surface `rollbackRelease`. _DoD: a merchant can apply an update and roll back; both proven._
- **WS2.4 Customize deep-link (TM‑22).** "Customize" links to the public detail page (`installations/page.tsx:133-139`). Deep-link to the merchant editor URL (`merchant-control-plane` `/[store]/online-store/themes/[themeId]/editor`) via a configured public-URL helper. _DoD: Customize opens the real editor for that store/theme._
- **WS2.5 config_overrides (TM‑95).** `installTheme` always sends `{}` (`theme-service.ts:138-141`). Pass through any selected preset/overrides the UI offers. _DoD: overrides reach the install call when set._

**GATE WS2:** ≥157; preview real; install non-destructive or honest+rollback; update/rollback surfaced; Customize correct.

### WS3 — CHECKOUT & MONEY HONESTY
*TM‑5,6,16(copy),28(in-app),43,48,62,72,80,87.*
- **WS3.1 Honest receipt/license (TM‑5,6).** (See WS0.2.) Ensure success reflects real verify/purchase data; license issuance fields absent → honest "in Purchases" + `SKIP — NEEDS GATEWAY/PARALLEL`.
- **WS3.2 Currency consistency (TM‑48,72,80,62).** `formatPrice` defaults USD (`utils.ts:10-18`) while checkout charges INR; detail shows USD + "INR reference"; dates mix `en-IN`/`en-US`. Make currency + locale consistent and truthful to the charged rail. _DoD: displayed currency matches what's charged; one locale policy._
- **WS3.3 Tax honesty (TM‑43).** "Tax — Calculated by provider" (`checkout/page.tsx:472`). Keep only if true; otherwise remove the line. _DoD: tax line is accurate or absent._
- **WS3.4 Refund affordance (TM‑28 in-app).** "30-day money-back" promised (`pricing.tsx:75-77`) with no refund flow. Either wire a request-refund action to `api.orders.refund` (exists) **or** change the copy to the true policy. Refund **policy/eligibility** + provider settlement = `SKIP — NEEDS HUMAN/GATEWAY`. _DoD: copy matches a real, reachable action or the true policy._
- **WS3.5 Pricing-model coherence (TM‑14,15,16 in-app).** Pro CTA → broken `/checkout?plan=pro` (`pricing.tsx:34`; checkout only reads `?theme=`), Unlimited CTA `#`. Make the CTAs land somewhere real (working subscription checkout if a plan API exists, else an honest "contact"/"coming soon"). The **decision** per-theme-vs-subscription unification = `SKIP — NEEDS HUMAN`. _DoD: no pricing CTA dead-ends; decision SKIP-recorded._

**GATE WS3:** ≥157; checkout/success honest; currency consistent; no dead pricing CTA.

### WS4 — DASHBOARD TRUTH
*TM‑18,19,20,21,45,70,74,88,89,90.*
- **WS4.1 Real Settings (TM‑18,19).** Load session user; persist via an existing method or render honest read-only; remove/relocate dead Password/2FA. _DoD: no hardcoded identity; Save persists or is absent._
- **WS4.2 Real Downloads/Purchases actions (TM‑20,21,74).** Drop fabricated sizes; wire downloads to a real artifact if `api-client` exposes one, else honest-gate. _DoD: no fake size; buttons act or are honestly gated._
- **WS4.3 Real subscription badge + notifications (TM‑70,45).** Sidebar badge hardcoded "Free Plan" (`dashboard/layout.tsx:54-63`); notification toggles fake. Reflect real plan if available else HONEST; wire or remove notification prefs. _DoD: badge truthful; no fake toggles persist nothing silently._
- **WS4.4 Perf cleanups (TM‑88,89,90).** Parallelize dashboard calls; avoid N sequential category-count calls on home; stop the purchase-scan in `getThemeReviews`. _DoD: no obvious N+1 on home/dashboard; behavior preserved._

**GATE WS4:** ≥157; dashboard reflects real state or honest gates.

### WS5 — TRUST, CONTENT & LEGAL (honest in-app; real text = SKIP)
*TM‑8(in-app),11,12,35(in-app),36,40,67(in-app),75,100.*
- **WS5.1 Resolve every footer/nav `#` (TM‑11,12,40,100).** Point Legal/Support/Docs/Changelog/Company links to canonical destinations (accounts/marketing/support domains via a public-URL helper) or remove. **Real legal text + canonical pages** = `SKIP — NEEDS HUMAN` (and `SKIP — NEEDS GATEWAY/PARALLEL` if they live in another app). _DoD: no `#` ships; remainders SKIP-recorded._
- **WS5.2 Honest reviews surface (TM‑8 in-app, 75,36).** No themes-review API exists → **do not fake reviews.** Render an honest "No reviews yet" state and stop showing a `review_count`/rating with no content behind it; remove the misleading "Marketplace proof" numbers until real. Full reviews (list/create/verified-purchase) = `SKIP — NEEDS GATEWAY/PARALLEL: themes.reviews + createReview`. _DoD: no unanchored rating/review count ships; reviews gap SKIP-recorded with the exact endpoint contract._
- **WS5.3 Author identity (TM‑35,67 in-app).** Link `author_name` to a real author route if one exists, else render plain (no fake profile). Verified-author/profiles backend = `SKIP — NEEDS GATEWAY/PARALLEL`. _DoD: no fake author affordance._

**GATE WS5:** ≥157; no `#`; no unanchored trust signals; review/author gaps SKIP-recorded with contracts.

### WS6 — RESPONSIVENESS, A11Y & POLISH
*TM‑76,77,82,85,86,91,92,93,96,97,98 + RESPONSIVENESS_REPORT risks.*
- **WS6.1 Responsive fixes.** Replace fixed-height bento with aspect-ratio utilities (`page.tsx:142-214`); guard hero max-height clipping; verify catalog filter-rail on tablet; bump icon-button hit areas toward ≥44px on touch; review `text-[10px]/[11px]` legibility. _DoD: clean render at 320/390/768/1024/1440 with screenshots; no clipped hero; tap targets enlarged on touch._
- **WS6.2 Affordance + polish.** Stronger disabled-button affordance; detail-page skeleton; de-duplicate trivia (TM‑92,93,96,97,98); remove inline `style transform:none` hacks where a token/class works. _DoD: P2 items closed or SKIP-noted; no `console.log`/new `any` introduced._

**GATE WS6:** ≥157; responsive + a11y proven by screenshots; P2 list dispositioned.

### WS7 — DEVELOPER SURFACE (mostly cross-boundary → honest in-app + SKIP)
*TM‑9,10,35,56,57,58,59,60,67.*
- **WS7.1 Harden the in-app upload route (TM‑56,57 in-app).** `src/app/api/themes/route.ts` POST proxies uploads. Add **in-app** request hardening: require an authenticated session before proxying upload (reuse the protected-route/session pattern), basic payload size/shape guards, and a simple per-session rate limit at the route handler. Malware/asset scanning + server-side limits = `SKIP — NEEDS GATEWAY/PARALLEL`. _DoD: anonymous/oversized uploads rejected in-app; deep scan SKIP-recorded._
- **WS7.2 Honest submission UX (TM‑58,59 in-app).** The sidebar JSON upload is the whole "submission." Add an honest pre-upload notice (what's accepted, that review/listing/pricing isn't available yet) and, **only if** `uploadPackage`'s contract already accepts metadata, a minimal metadata field set. A real listing builder (assets/screenshots/pricing/categories), submission states, analytics, payouts, revenue-share = `SKIP — NEEDS GATEWAY/PARALLEL + NEEDS HUMAN`. _DoD: upload UX is honest about scope; the developer-program build is SKIP-recorded as a discrete cross-boundary epic._

**GATE WS7:** ≥157; upload authenticated + bounded in-app; developer-program remainder is a single, clearly-scoped SKIP epic for the parallel task.

---

## 5. CROSS-BOUNDARY REGISTER (hand-off to the parallel task — DO NOT build here)
Record these in `## SKIP — NEEDS GATEWAY/PARALLEL` with the exact contract each needs:
- **TM‑1 Real catalog** — DB seed/content beyond `urban-kicks` (also NEEDS HUMAN for content).
- **TM‑8 Themes reviews** — `themes.reviews` (list) + `createReview` (verified-purchase) in api-client + gateway + `theme_reviews` storage; then the UI un-gates.
- **TM‑26/64 Filter server-support** — gateway honoring industry/layout/price params.
- **TM‑55 Industry taxonomy** — seed + endpoint.
- **TM‑5/6 Settlement receipt/license** — provider settlement endpoint feeding the success page.
- **TM‑9/10/60/67 Developer program** — listing builder backend, submission states, analytics, payouts, revenue-share, author verification.
- **TM‑56 Upload malware/asset scanning + server limits.**
- **TM‑17 Stripe/global rail** — gateway + keys (also NEEDS HUMAN).

## 6. HUMAN REGISTER (decisions only a human makes)
Record in `## SKIP — NEEDS HUMAN`:
- Legal text: Terms, Privacy, **Refund Policy**, License Agreement (TM‑11,28).
- **Pricing-model decision:** per-theme one-time vs Free/Pro/Unlimited subscription unification (TM‑16).
- **Revenue-share % + payout rails** for developers (TM‑10).
- Enabling **live payment providers/keys** (TM‑17).
- Real **catalog content/curation** and any **new marketing promise** (TM‑1,13,38).

---

## 7. EXECUTION ORDER & EVIDENCE
1. Read the audit (§ source of truth) → build the TM‑1…100 matrix in the ledger.
2. WS0 → WS7 in order; each item: implement → `typecheck`+`lint` → screenshot (UI) → commit → flip ledger row.
3. At each WS gate: `node scripts/validate-governance.mjs` (≥157) + `pnpm --filter @letbuyy/theme-marketplace build` (no network).
4. Final: confirm `git diff --name-only develop` is inside the boundary; write `CODEX_THEME_MARKETPLACE_STATUS.md`; archive the three mission files to `docs/archive/`; leave every TM‑id dispositioned.

**Definition of done for the mission:** all 100 TM‑ids `DONE`/`HONEST`/`SKIP`-recorded; no fabricated metric, placeholder string, dead control, or over-claim ships; preview + safe lifecycle + honest checkout real; boundary respected; all gates green on recorded evidence.
