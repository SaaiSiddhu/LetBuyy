# CODEX APPS-MARKETPLACE FOUNDATION MISSION — Stream A (frontend-owned)

**Driver:** GPT‑5.5 in Codex. `xhigh` for OAuth/billing/consent + install-lifecycle work, `high` for discovery/data wiring + tests, `medium` for content/CSS/mechanical edits.
**Mode:** Continuous, autonomous. Run as long as it takes. Never stop while an unblocked task remains. Never pause to ask — encode every decision via the disposition rules below.
**Branch:** `stream/letbuyy-apps-marketplace-foundation` (off current `develop`). This stream runs **in parallel** with a backend stream; see §2 Ownership.
**Ledger/Status (create at start, this stream owns them):** `CODEX_APPS_MARKETPLACE_LEDGER.md` + `CODEX_APPS_MARKETPLACE_STATUS.md`. Do **not** write to `CODEX_FOUNDATION_HARDENING_LEDGER.md` (owned by the parallel stream).
**Issue source of truth (canonical):** the audit set produced 2026‑06‑06 — read these first, in order:
1. `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` (architecture, flows, **§7 Top‑100 issue register** = the work list, §5 evidence table).
2. `docs/apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md` (what's backend-present vs product-missing — your in‑scope map).
3. `docs/apps-marketplace-audit/APP_PLATFORM_ARCHITECTURE_AUDIT.md` (what the gateway already exposes via `@letbuyy/api-client`).
4. `docs/apps-marketplace-audit/APP_INSTALLATION_JOURNEY_AUDIT.md`, `APP_DISCOVERY_AUDIT.md`, `APPS_MARKETPLACE_UI_UX_AUDIT.md`, `APPS_RESPONSIVENESS_REPORT.md`, `APPS_CONTENT_GAP_ANALYSIS.md`, `APP_REVIEW_SYSTEM_AUDIT.md`, `MERCHANT_TRUST_SCORECARD.md`, `DEVELOPER_TRUST_SCORECARD.md`, `ECOSYSTEM_SCALABILITY_REPORT.md`, `LETBUYY_APPS_MARKETPLACE_V2.md` (the target design — build toward it).

Trust the cited `file:line` evidence in those docs; verify only at the point of edit.

**Governance posture (non‑negotiable):** KEEP ALL VALIDATORS GREEN at every commit — `node scripts/validate-governance.mjs`. The validator baseline is **160** (`scripts/validators/*.mjs`). Confirm the count at start; never go below it; never delete/weaken a validator to pass. After any topology/import/package/env/generated‑artifact/governance‑memory change inside `apps/app-marketplace`, re‑run `node scripts/validate-governance.mjs` and regenerate the app `AGENTS.md` via the repository‑intelligence generator rather than hand‑patching it.

> **This mission changes code — but only inside `apps/app-marketplace`.** It is Stream A. A parallel Stream B owns the backend/DB/shared packages. The two never touch the same files. Every cross‑boundary need becomes a precise, recorded handoff (§4), never an edit outside your boundary.

---

## 0. PRIME DIRECTIVE

The audit's verdict: LetBuyy has a **real, Shopify‑shaped app platform** under an **empty, under‑wired marketplace product**. The gateway already implements OAuth, billing‑with‑merchant‑approval, the three mandatory GDPR webhooks, extensions/manifest, idempotent installs, and partner payouts — and `@letbuyy/api-client.appStore` already exposes them. **Most of the Top‑100 is therefore frontend work: expose, correct, and finish the product on top of an API that already exists.**

**Your job, in order:** (M0) lock the boundary + baseline; (M1) make the product **honest** (kill trust theater, fake collections, dead UI, contradictions, the icon bug); (M2) make **discovery** a system; (M3) wire **install/consent/billing/OAuth**; (M4) **reviews & trust**; (M5) the **developer lifecycle**; (M6) **developer analytics & app health**; (M7) **mobile/responsive/a11y/design‑system unification**; (M8) **SEO/perf/telemetry/content polish**. Every one of the 100 issues ends `DONE`, `[SKIP — NEEDS HUMAN]`, or `[SKIP — NEEDS BACKEND]` in the ledger. Nothing disappears silently.

**Disposition rule (decide every item without asking):**
- **Make it real** when it can be built entirely inside `apps/app-marketplace` against the existing `@letbuyy/api-client` surface (or composing UI locally). This is the default and covers the majority.
- **Reconcile to truth** when copy/UI overstates what exists (e.g., remove `usage_based` from the submit form because the DB rejects it; stop hard‑coding "15% commission"; relabel/curate the fake collections). Honesty beats a fake feature.
- **`[SKIP — NEEDS BACKEND]`** when it requires editing `services/**`, `database/**`, or `packages/**` (new endpoint, schema/enum change, new client method, new shared type). Build the UI to the intended contract, feature‑flag it off or show an honest "coming soon / unavailable" state, and append a precise handoff spec to the ledger.
- **`[SKIP — NEEDS HUMAN]`** for policy/economics/legal/brand/real‑content/credential/irreversible decisions (the commission rate itself, real partner apps to seed, KYC policy, production secrets, relaxing a sandbox). Record the exact decision needed + what it unblocks, then continue.

**SUCCESS — COMPLETE only when all are proven with recorded command evidence:**
1. Every Top‑100 issue is `DONE` / `[SKIP — NEEDS BACKEND]` / `[SKIP — NEEDS HUMAN]` in `CODEX_APPS_MARKETPLACE_LEDGER.md`'s traceability matrix.
2. No file outside `apps/app-marketplace/**` (plus this stream's two ledger/status docs) is modified. `git diff --name-only develop... | grep -v '^apps/app-marketplace/\|^CODEX_APPS_MARKETPLACE_' ` is **empty**.
3. `node scripts/validate-governance.mjs` green (≥160); `pnpm --filter @letbuyy/app-marketplace typecheck` + `lint` + `build` green; the app's `test` script green.
4. No trust theater: "Built for LetBuyy" only renders when earned/flagged from data; no dead controls; no fake collections; no literal icon‑name text; no 1970 dates; reviews count = real total.
5. Discovery is data‑driven (categories + counts from the API), facets work, search input is sanitized, pagination exists.
6. Install runs through real OAuth consent with billing terms shown; billing, manifest‑validate, API‑key, extension, collaborator surfaces are wired to the existing client methods or are honest‑deferred.
7. Mobile navigation survives below 768px; a 320px tier exists.
8. `CODEX_APPS_MARKETPLACE_STATUS.md` summarizes every gate with evidence and lists every human/backend remainder with the exact decision or contract needed.

---

## 1. OPERATING CONTRACT (laws)

1. **Continuous execution.** Finish → update ledger → next unblocked task. Never pause to ask. Never end while unblocked tasks remain. Max 3 attempts/task → log `BLOCKED` + diagnosis → next.
2. **The Green Law.** Tree green after every commit: `pnpm --filter @letbuyy/app-marketplace typecheck` + `pnpm --filter @letbuyy/app-marketplace lint` each increment; full `node scripts/validate-governance.mjs` (≥160) at every wave gate. Never commit red.
3. **The Boundary Law (defining law of this stream).** You modify **only** `apps/app-marketplace/**` and this stream's ledger/status. `services/**`, `database/**`, `packages/**`, other `apps/**`, and root monorepo configs are **read‑only** — consume them, never edit them. Any need to change them is a `[SKIP — NEEDS BACKEND]` handoff, never an edit. Verify before every commit that the diff touches nothing outside the boundary.
4. **The Honesty Law.** Never ship trust theater or a fake feature. If a capability needs backend that isn't there, show an honest unavailable/disabled state behind a flag — never a fabricated success. Never assert a string in a test in place of real behavior.
5. **The Consume‑Don't‑Fork Law.** Use `@letbuyy/api-client` (`appStore.*`), `@letbuyy/shared-types`, `@letbuyy/auth-core`, and `@letbuyy/ui` as given. If a client method/type/UI primitive is missing, **compose locally inside the app** when reasonable; otherwise `[SKIP — NEEDS BACKEND/SHARED]`. Do not edit the packages.
6. **The Tenant‑Context Law.** Every store/merchant operation binds explicit tenant context (`site_id`/`store`/`subdomain`/ownership‑checked resource), per the app `AGENTS.md`. No secrets, provider keys, or service‑role access in client components.
7. **The REAL‑Evidence Law.** UI/behavioral proof = a real browser with screenshots and/or the app's `test` runner against a disposable local Postgres or staging. Mocks are not proof. No staging creds → produce code + local proof and record the live proof as `[SKIP — NEEDS HUMAN: staging deploy + secrets]` with exact commands.
8. **Small reversible increments.** One logical change → validate → commit. Refactors (e.g., design‑system unification) are behavior‑preserving and proven before/after with screenshots.
9. **Anti‑ceremony.** No new top‑level docs beyond this mission's ledger/status. New BFF routes/pages/components/lib live under `apps/app-marketplace/src/**`. Prefer the design system + tokens over new inline styles. Do not introduce new dependencies without recording why; prefer what `@letbuyy/ui` already provides.
10. **No fabrication / Traceability.** Every `DONE` needs command or screenshot evidence in the status doc. Every one of the 100 issues ends `DONE`/`SKIP — NEEDS BACKEND`/`SKIP — NEEDS HUMAN`. Update governance memory in the same commit when a change requires it.
11. **Respect existing law.** Obey root `AGENTS.md`, `apps/app-marketplace/AGENTS.md`, `CLAUDE.md`, `docs/governance/`, the Deprecated Runtime Policy, and migration governance (you write **no** migrations — that's Stream B).

---

## 2. OWNERSHIP & PARALLELISM CONTRACT

This stream is **frontend‑only** so a second Codex can run the backend in parallel with zero file conflicts.

**You OWN (read‑write):**
- `apps/app-marketplace/**` — all pages, components, lib, BFF route handlers (`src/app/api/**`), styles (`src/app/globals.css`), `proxy.ts`, app‑local config.
- `CODEX_APPS_MARKETPLACE_LEDGER.md`, `CODEX_APPS_MARKETPLACE_STATUS.md` (create at M0).
- The app's generated `apps/app-marketplace/AGENTS.md` — only via the repository‑intelligence generator, never hand‑edited.

**You CONSUME (read‑only — never edit):**
- `packages/typescript/api-client/**` — the `appStore.*` surface is your data layer. Already available and in‑scope to call: `apps`, `app`, `categories`, `reviews`, `submitReview`, `installations`, `install`, `uninstall`, `developer`, `registerDeveloper`, `developerApps`, `submitDeveloperApp`, `validateDeveloperAppManifest`, `rotateDeveloperAppKey`, `partnerDashboard`, `collaboratorCode`, `createCharge`, `approveCharge`, `oauthAuthorize`, `oauthToken`, `oauthTokenExchange`, `extensionRegistry`, `updateExtensionRegistration`, `updateFunctionRegistration`, `embedSession`, `bridgeFetch`.
- `packages/typescript/shared-types/**`, `packages/typescript/ui/**`, `packages/typescript/auth-core/**`.
- All `docs/**` audit files; `AGENTS.md`; `CLAUDE.md`.

**You MUST NOT modify (owned by Stream B / backend):**
- `services/**` (esp. `services/api-gateway/src/routes/app-store/**`), `database/**` (schema/migrations), `packages/**` (shared libs/types/client/ui), other `apps/**`, root build/workspace configs.
- Any required change here → `[SKIP — NEEDS BACKEND]` (or `[SKIP — NEEDS SHARED]` for packages) appended to the ledger's `## DEFERRED -- CROSS-BOUNDARY (BACKEND/SHARED)` section with: the exact endpoint/type/enum/method needed, the request/response contract, the issue # it unblocks, and the UI you built against it.

**Coordination with Stream B:** if a client method or type you need does not exist, build the UI to the intended contract, guard it behind a feature flag or honest‑unavailable state, and file the handoff. When Stream B lands the contract, flipping the flag is a one‑line follow‑up — do not block on it.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

One backend (`api-gateway`), one contract (`shared-types`/`api-client`), one identity verifier (`auth-core`), one design system (`@letbuyy/ui`). Keep business logic out of page components — use the client, app‑local presentation adapters, or BFF routes. Tenant context always explicit. No secrets/service‑role in client components. Prefer skeletons and retryable error states over spinner‑only loading (keep the existing honest `MarketplaceUnavailable`). Dark‑mode tokens and app‑level CSS variables — do not hard‑code new raw color values. INR‑first; GST/UPI first‑class. The real OAuth flow is the canonical install path — do not invent a second auth idiom.

---

## 4. LEDGER & STATUS (create and maintain)

Create `CODEX_APPS_MARKETPLACE_LEDGER.md` with these sections (mirror the existing foundation ledger's style):
- `## BASELINE` — validator count at start (expect 160), gate commands, HEAD sha.
- `## PROGRESS LOG` — one line per increment: issue #, what changed, file(s), evidence ref.
- `## TRACEABILITY MATRIX` — **all 100 issues**, columns `| # | Issue | Wave | Disposition |`, every row ending `DONE` / `SKIP — NEEDS BACKEND` / `SKIP — NEEDS HUMAN`.
- `## SKIPPED -- NEEDS HUMAN` — policy/economics/content/credential decisions, each with the exact decision + what it unblocks.
- `## DEFERRED -- CROSS-BOUNDARY (BACKEND/SHARED)` — each with the exact contract Stream B must ship.
- `## FLAGS` — every feature flag added, default state, and the contract that flips it on.

Create `CODEX_APPS_MARKETPLACE_STATUS.md` with a `## <Wave> gate evidence` section per wave (commands + results + screenshot paths), and a final `## Remainders` block listing every human/backend item with the exact decision/contract.

---

## 5. THE WORK — Waves M0 → M8 (do in order; each issue # maps to §7 Top‑100 of the master audit)

### M0 — Boundary & baseline (do first)
- Create branch, the ledger/status, record baseline gates (`validate-governance` count, typecheck/lint/build/test). Read all audit docs. Establish the **appStore BFF pattern**: a thin server route under `src/app/api/**` per new capability, calling `createAppMarketplaceApiClient().appStore.*`, mirroring the existing `install`/`reviews` routes. Add a single app‑local feature‑flag module for backend‑deferred surfaces.
- **GATE M0:** branch + ledger/status exist; baseline recorded; boundary‑diff check script noted.

### M1 — Honesty (kill trust theater & contradictions) — issues 3,5,6,10,12,17,18,19(copy),21,49,51,64
- **#5/#49 "Built for LetBuyy":** stop rendering unconditionally in `AppCard.tsx` and `apps/[slug]/page.tsx`. Render only from a real signal (e.g., a `built_for_letbuyy`/quality flag on the app if present); otherwise do not show it. The earned **program/criteria** themselves are `[SKIP — NEEDS HUMAN]` + `[SKIP — NEEDS BACKEND]` (flag field) — record both; ship the gated render now. _DoD: badge never appears without a truthful per‑app signal._
- **#3 commission copy:** remove hard‑coded "15% commission" from `developers/register/page.tsx` and `apps/new/page.tsx`; source the rate from a single config/value rendered dynamically. The **actual rate** (15% vs the backend's 20% default `revenue_share_bps=8000`) is `[SKIP — NEEDS HUMAN]`; the **backend default reconciliation** is `[SKIP — NEEDS BACKEND]`. _DoD: no screen states a commission number that isn't sourced from one config value._
- **#10 fake collections:** in `collections/[slug]/page.tsx`, either implement honestly within scope or relabel. `made-in-india` must apply a real developer‑country filter (filter client‑side on `app_developers.country` if present in the payload; if not exposed, `[SKIP — NEEDS BACKEND]` for a country filter param and relabel honestly meanwhile). `trending` = re‑label to "Popular" unless a velocity signal exists (`[SKIP — NEEDS BACKEND]` for true trending). `staff-picks` requires a curation source → `[SKIP — NEEDS BACKEND]`; until then relabel to "Top rated" (truthful). _DoD: no collection claims a curation/recency it doesn't perform._
- **#12 icon bug:** replace literal `{cat.icon}` text with `<MaterialIcon name={cat.icon}>` in `search/page.tsx`, `categories/[slug]/page.tsx`, and `apps/new/page.tsx` (match `CategoryGrid.tsx`). _DoD: no Material icon name renders as text anywhere._
- **#6 (icon) + #18 reviews count:** detail header uses real `review_count` total, not `reviews.length`. _DoD: count matches the catalog total._
- **#21 1970 date:** when `updated_at`/`created_at` is missing, render "—" / hide, never an epoch date. _DoD: no 1970 dates._
- **#17 usage_based:** remove `usage_based` from the submit dropdown and any price display path that the DB CHECK (`free/freemium/one_time/recurring`) rejects; `[SKIP — NEEDS BACKEND]` to extend the enum + billing. _DoD: UI offers only DB‑valid pricing models._
- **#19 "6 Extension Types":** correct copy to match the 8 schema types in `developers/page.tsx`. **#51:** align country select with India‑only payout copy (or mark non‑IN as "payouts coming soon"). **#64:** add truthful recency badges only when data supports them.
- **GATE M1:** validators ≥160; a manual pass of every store page shows zero fabricated badges, zero dead claims, zero icon‑name text; screenshots in status.

### M2 — Discovery as a system — issues 4(client),9,19,20,25,26,55,56,57,61,62,63,77(client),79,80
- **#19/#20 data‑driven categories:** drive category nav/landing from `appStore.categories()` with live counts; hide empty categories; keep the hard‑coded list only as a deterministic fallback. _DoD: nav reflects real categories + counts._
- **#9 facets:** wire the Search **Pricing**/**Rating**/site‑type facets to query params and the existing `apps` filter params (`pricing`, etc.); convert `<div onClick>` to semantic `<button>`/`<a>` (**#55**). _DoD: facets filter real results and are keyboard‑operable._
- **#56 pagination:** add pagination/infinite scroll (the API is paginated); remove the silent 20–24 cap. **#57:** wire the category‑page sort `<select>`. **#63:** trust server sort; drop client re‑sort hacks once facets/sort are wired.
- **#4 (client mitigation):** sanitize the search string in the BFF before sending (strip PostgREST meta‑chars `,()` and operators) as defense‑in‑depth; the **server‑side fix** is `[SKIP — NEEDS BACKEND]`. _DoD: crafted queries can't inject filter syntax from the client path._
- **#25/#26 recommendations/compare:** keep "similar apps" (same‑category) and add a compare tray; deeper personalization `[SKIP — NEEDS BACKEND]`. **#61/#62:** empty‑search suggestions + abort stale fetches. **#77(client):** broaden search UX; ranked full‑text is `[SKIP — NEEDS BACKEND]`. **#79/#80:** screenshot lightbox; video support if the field exists.
- **GATE M2:** validators ≥160; discovery demo on local/staging data shows working categories+counts, facets, pagination, sanitized search; screenshots in status.

### M3 — Install, consent, billing, OAuth (wire existing client methods) — issues 7,8,28,29,30,31(UI),47(UI),69(shell),70,71,72,73,74
- **#7/#74 OAuth consent:** route install through `appStore.oauthAuthorize` → `oauthToken` consent, replacing the direct scope POST as the canonical path; show **scopes + billing terms + privacy** in one approval. _DoD: install is an OAuth grant; consent shows price + trial + scopes together._
- **#30/#47 granular & re‑consent:** support optional scopes and a re‑consent prompt when an app's requested scopes grow (UI logic; the update trigger depends on M5/#2). 
- **#8/#70/#71/#72 billing UI:** build a billing surface using `appStore.createCharge`/`approveCharge` — view pending charges, approve/decline, show trials/yearly; plan‑change/cancel UI where the API allows, else honest‑deferred. **#69 refunds** = shell + `[SKIP — NEEDS BACKEND]`. _DoD: a merchant can see and approve a charge in the product._
- **#28 post‑install onboarding:** add a setup step after install; use `appStore.embedSession` + `bridgeFetch` for an authenticated embedded view instead of the raw iframe. **#29:** tighten the iframe `sandbox` (drop `allow-same-origin` for cross‑origin app URLs). **#31(UI):** render a data‑handling/privacy block on consent + detail (content sourced from the listing; required‑disclosure field is `[SKIP — NEEDS BACKEND]`). **#73:** show which store an install targets.
- **GATE M3:** validators ≥160; recorded run of an OAuth‑based install with combined consent + a sandbox charge approval (or honest‑unconfigured), screenshots in status.

### M4 — Reviews & trust UI — issues 22,23(UI),24,31,32,33(UI),49,66,81,82,83,85(UI),86(UI)
- **#22 review write UI:** on `/my-apps`, a verified installer can submit a review via `appStore.submitReview` (backend already enforces active‑install). **#24:** rating histogram on detail. **#23:** developer‑reply **read** UI now; reply **create** = `[SKIP — NEEDS BACKEND]`. **#66/#81:** report/moderation entry points (submit endpoint may be `[SKIP — NEEDS BACKEND]`).
- **#82/#83 developer profile:** build `/developers/[slug]` profile + that developer's other apps. **#32:** show support info/SLA fields. **#33(UI):** changelog/release‑notes display (data model `[SKIP — NEEDS BACKEND]`). **#85(UI):** a notifications inbox reading existing domain events if exposed, else `[SKIP — NEEDS BACKEND]`. **#86(UI):** app‑activity log surface (data `[SKIP — NEEDS BACKEND]`). **#49:** earned‑badge display logic (see M1).
- **GATE M4:** validators ≥160; a verified installer submits a review and sees the histogram update; screenshots in status.

### M5 — Developer lifecycle — issues 2(UI),11,13,14,33,35,36,37,38,39,40,41(UI),42,43,44,94,96,97,98,99
- **#35/#36/#2 app management + edit + versioning:** build an app detail/management page in the Partner Console with a working **edit** form and a **new‑version** flow, wired to the intended `PATCH /developers/apps/:id` + version endpoints. These endpoints do **not** exist → `[SKIP — NEEDS BACKEND]` (file the exact contract); ship the UI behind a flag and remove the dead `Pencil` affordance's no‑op. _DoD: edit/version UI exists and is wired to a named contract; flag off until Stream B lands it._
- **#13 submit completeness:** capture **scopes, webhooks, OAuth redirect URIs** in the submit form (the create payload already mints OAuth client + persists manifest). **#14 media:** wire icon/screenshot upload — if no client upload method exists, `[SKIP — NEEDS BACKEND/SHARED]` and keep the drop zones honest ("upload available soon") rather than decorative. **#39 manifest validate:** pre‑submit validation via `appStore.validateDeveloperAppManifest`. **#38 API keys:** key view + rotate via `appStore.rotateDeveloperAppKey` (reveal‑once). **#40/#41 extensions/webhooks management:** via `appStore.extensionRegistry`/`updateExtensionRegistration`/`updateFunctionRegistration`; delivery logs `[SKIP — NEEDS BACKEND]`. **#37 collaborator:** request/redeem flow via `appStore.collaboratorCode`. **#42 dev stores:** `[SKIP — NEEDS BACKEND]` (provisioning) — surface the existing `development_stores` from the dashboard. **#43/#44:** link SDK/CLI + docs; verify the docs URLs resolve, else mark the link honest. **#94 private apps / #96 security settings / #95 teams:** UI where client supports, else `[SKIP — NEEDS BACKEND]`. **#97 preview / #98 autosave / #99 delist.**
- **GATE M5:** validators ≥160; a developer can validate a manifest, rotate a key, and configure extensions in the product; edit/version UI present behind a flag with a filed backend contract; screenshots in status.

### M6 — Developer analytics & app health UI — issues 15,16,67,68,85,91
- **#15 per‑app analytics:** installs‑over‑time / funnel / churn built from `partnerDashboard` + install/charge data the API returns; deeper event metrics `[SKIP — NEEDS BACKEND]`. **#16 app health:** request volume / error rate / p95 panels — data source `[SKIP — NEEDS BACKEND]`, build the panels with honest "metrics unavailable" until fed. **#67/#68:** payout statements + GST invoice views (generation/export `[SKIP — NEEDS BACKEND]`). **#91:** instrument the discovery→install funnel with the app's logger.
- **GATE M6:** validators ≥160; analytics surfaces render real aggregate data + honest placeholders for deferred metrics; screenshots.

### M7 — Mobile, responsive, a11y, design‑system unification — issues 11,14,52,53,54,55,58,59,60,100
- **#11 mobile nav:** add a hamburger/mobile menu (+ optional bottom nav) so Home/Categories/Collections/Search/My Apps/Build survive below 768px; keep **Search** reachable at ≤640px. **#100:** add a ≤360/320px tier; verify brand/price/badge/category grid don't overflow. **#54/#55:** keyboard/ARIA on all controls; semantic elements. **#58/#59:** migrate developer pages off inline `style={{}}` + hard‑coded `#16a34a/#dc2626/#fef2f2` onto `@letbuyy/ui` + tokens (dark‑mode‑safe). **#60:** server‑page skeletons. **#52/#53:** i18n + currency **scaffolding** (string externalization, currency formatter seam); full translations/multi‑currency content `[SKIP — NEEDS HUMAN]`.
- **GATE M7:** validators ≥160; device‑width screenshots at 320/375/768/1024/1440 show working nav and no overflow; a11y spot‑check recorded.

### M8 — SEO, perf, telemetry, content polish — issues 78,84,87,88(client),89,90,92,93
- **#90 SEO:** JSON‑LD for apps/listings + sitemap; **#78:** sanitized markdown rendering for descriptions. **#89:** catalog caching via Next revalidation/ISR (CDN/edge = `[SKIP — NEEDS BACKEND/INFRA]`). **#88(client):** document client rate‑limit handling. **#87 uninstall reason / #84 partner directory / #92 experiments / #93 seed‑parity test (frontend env check).** Final content sweep: layout/footer "thousands of apps" honesty, drop the `"shopify alternatives"` keyword, keep tasteful India framing.
- **GATE M8:** validators ≥160; Lighthouse/SEO spot‑check recorded; full content pass screenshots.

---

## 6. CROSS‑BOUNDARY DEFERRALS (file these to Stream B — do NOT implement here)

Record each in `## DEFERRED -- CROSS-BOUNDARY (BACKEND/SHARED)` with the exact contract. The known set from the audit:
- **#1 Seed catalog** — categories + launch‑partner apps (`[SKIP — NEEDS HUMAN]` content + `[SKIP — NEEDS BACKEND]` seed). Blocks a non‑empty store.
- **#2 App update/versioning endpoint** — `PATCH /app-store/developers/apps/:id` + version records + `appStore.updateDeveloperApp` client method.
- **#3 Revenue‑share default** — change `revenue_share_bps` default (8000) to the decided rate; expose the rate to the client.
- **#4 Search injection** — server‑side escaping/parameterization or an RPC full‑text function in `app-store.ts GET /apps`.
- **#6/#46 Real review gates + update re‑review** — manifest lint, scope justification, URL/TLS reachability, GDPR‑webhook liveness check; re‑review on scope change.
- **#17 `usage_based`** — extend `marketplace_apps_pricing_model_check` + billing.
- **#23/#33/#85/#86 data models** — review replies, changelog/versions, notifications, app‑activity log.
- **#14 media upload**, **#42 dev‑store provisioning**, **#67/#68 statements/GST invoices**, **#16 app‑health metrics emitter**, **#50 developer KYC/GSTIN verification**, **#69 refunds/disputes**, **#77 ranked full‑text**, **#89 CDN/edge cache**.

---

## 7. TRACEABILITY MATRIX (seed — Codex completes & flips statuses)

Copy the master audit's **§7 Top‑100** verbatim into the ledger and assign each a Wave + Disposition. Quick map (Codex must record all 100):

| Disposition | Issue #s |
|---|---|
| **DONE — frontend, in‑scope** | 5,6,8 (UI),7,9,11,12,13,18,19,20,21,22,24,25,26,28,29,30,31(UI),32,35,36,37,38,39,40,43,49,51,55,56,57,58,59,60,61,62,63,64,71,73,74,78,79,80,82,83,87,90,91,93,96,97,98,99,100 |
| **DONE — reconcile to truth** | 3(copy),10,17(UI),44,84,88,89(ISR part),92 |
| **SKIP — NEEDS BACKEND/SHARED** | 1(seed),2(endpoint),4(server),6,14,16,17(enum),23(reply create),33(model),34,41(delivery logs),42,46,67,68,69,70(partial),72(partial),77,85(events),86(model),89(CDN),94,95 |
| **SKIP — NEEDS HUMAN** | 1(content),3(rate),31(required‑disclosure policy),48,49(program criteria),50(KYC policy),52,53(translations/currency content),65(anti‑gaming policy),75(compat policy) |

(Where an issue appears twice, it has a frontend part **and** a deferred part — ship the frontend part `DONE`, file the remainder. Every # must appear exactly once as resolved in the final matrix, with sub‑parts noted.)

---

## 8. FINAL GATE — mark COMPLETE only when ALL true
- [ ] `git diff --name-only develop...HEAD` touches only `apps/app-marketplace/**` + the two `CODEX_APPS_MARKETPLACE_*` docs. **(Boundary Law)**
- [ ] `node scripts/validate-governance.mjs` green, count ≥160; app `AGENTS.md` regenerated, not hand‑edited.
- [ ] `pnpm --filter @letbuyy/app-marketplace typecheck` + `lint` + `build` + `test` all green.
- [ ] Honesty: no unconditional "Built for LetBuyy"; no dead controls; no fake collections; no icon‑name text; no 1970 dates; reviews count = total; no UI‑only `usage_based`.
- [ ] Discovery: categories+counts from API, working facets, pagination, sanitized search.
- [ ] Install via OAuth consent with combined scope+billing terms; billing/manifest/API‑key/extension/collaborator surfaces wired or honestly deferred.
- [ ] Mobile nav works <768px; 320px tier present; developer pages on the design system.
- [ ] Traceability matrix: all 100 issues `DONE` / `SKIP — NEEDS BACKEND` / `SKIP — NEEDS HUMAN`.
- [ ] `CODEX_APPS_MARKETPLACE_STATUS.md` lists every remainder with the exact decision (HUMAN) or contract (BACKEND) and the commands to verify.

**Run until COMPLETE. Mark, don't block. Honesty over features. Stay inside the boundary.**
