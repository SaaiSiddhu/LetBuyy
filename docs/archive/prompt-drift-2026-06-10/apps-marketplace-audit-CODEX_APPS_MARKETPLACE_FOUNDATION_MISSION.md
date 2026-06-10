<!-- CODEX MISSION PROMPT. Paste this entire file to Codex as the task brief, or point Codex at this path. Single-go, autonomous execution. Scope: apps/app-marketplace ONLY. -->

# CODEX MISSION — Apps Marketplace Foundation Hardening (V1)

> **You are Codex.** You are hardening the **LetBuyy Apps Marketplace** to a fundamentally strong foundation in a single autonomous run. Work through the full issue register (derived from the audit in `docs/`) in priority order, committing as you go, and **do not stop for human approval** — when a step needs a human or a business decision, log it as `SKIPPED (HUMAN-APPROVAL)` and continue. A **second Codex task runs in parallel on the backend/platform**, so you must stay strictly inside your ownership boundary and hand every out-of-boundary need to that task through a written contract. Read this entire file before writing any code.

---

## 0. Non-negotiables (read first)

1. **OWNERSHIP IS ABSOLUTE.** You may only create/modify/delete files under **`apps/app-marketplace/**`** (plus the mission docs you own under that path, see §6). You must **NOT** touch any of:
   - `services/**` (api-gateway, etc.) — owned by the parallel backend task
   - `database/**` (migrations/schema) — owned by the parallel backend task
   - `packages/**` (`@letbuyy/api-client`, `@letbuyy/shared-types`, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/app-engine`) — shared; **read-only** for you
   - any other `apps/**`, root configs (`AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, validators), or root docs
   If a fix *requires* a change outside this boundary, you do **NOT** make it. Implement the in-boundary part, guard it, and record a contract (§4). Crossing the boundary will collide with the parallel task and is a hard failure.
2. **PARALLEL-SAFE.** Assume another agent is editing `services/`, `database/`, and `packages/` right now. Never edit a file both tasks could touch. All cross-boundary needs flow through `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` (you create and own this file).
3. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs human approval, a secret, a business decision, production data, or a governance sign-off, mark it `SKIPPED (HUMAN-APPROVAL)` in the ledger with a precise description of what's needed, then continue.
4. **TRUTH OVER THEATER.** No fake data, fake metrics, fake reviews, or unconditional "trust" badges. Honest empty/loading/error states are required. If you can't make something real in-boundary, make it *honest* (hide it or label it) and contract the real version.
5. **GREEN BEFORE DONE.** Every wave ends with `typecheck`, `lint`, `build`, and `test` passing for `@letbuyy/app-marketplace` (commands in §9). Don't mark an issue `DONE` if any fail for code you touched.
6. **EVIDENCE OR IT DIDN'T HAPPEN.** Every closed issue gets a ledger row with files changed and how you verified it (§6).
7. **NO SCOPE INVENTION.** Implement exactly the issues in §7. If you find a new in-boundary defect, log it as `FOUND-###` and fix it; don't wander into refactors no issue requires.

---

## 1. Mission context — what the Apps Marketplace is

`apps/app-marketplace` is a **Next.js 16 / React 19 thin client** rendering the storefront (catalog, search, categories, collections, app detail, install) and developer surfaces (portal, registration, partner console, submit-app, my-apps). It owns **no business logic of record** — it calls the platform gateway through **`@letbuyy/api-client`'s `appStore` namespace** and falls back to an explicit `MarketplaceUnavailable` state when the gateway is unreachable.

Authoritative context you MUST read before starting:

- `apps/app-marketplace/AGENTS.md` — your ownership boundary, runtime rules, security/scalability notes (generated; treat as law).
- Root `AGENTS.md` — the engineering constitution (tenant isolation via `site_id`, contracts over tribal knowledge, validation requirements).
- The audit set (your issue source of truth), all under `docs/`:
  - `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` — architecture, flows, the **Top-100 register (Phase 17)**, brutal review.
  - `docs/apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md` — missing vs. backend-exists-no-UI.
  - `docs/apps-marketplace-audit/APP_DISCOVERY_AUDIT.md`, `APP_INSTALLATION_JOURNEY_AUDIT.md`, `APP_REVIEW_SYSTEM_AUDIT.md`, `APP_PLATFORM_ARCHITECTURE_AUDIT.md`, `APPS_MARKETPLACE_UI_UX_AUDIT.md`, `APPS_RESPONSIVENESS_REPORT.md`, `APPS_CONTENT_GAP_ANALYSIS.md`, `MERCHANT_TRUST_SCORECARD.md`, `DEVELOPER_TRUST_SCORECARD.md`, `ECOSYSTEM_SCALABILITY_REPORT.md`, `SHOPIFY_APP_STORE_COMPARISON.md`.
  - `docs/apps-marketplace-audit/LETBUYY_APPS_MARKETPLACE_V2.md` — the target design you build toward.

---

## 2. The boundary insight that makes this task large and real

Much "backend exists, no UI" can be built **entirely in-boundary**, because `@letbuyy/api-client`'s `appStore` already exposes methods the marketplace never calls. Wire them with **BFF route handlers** under `apps/app-marketplace/src/app/api/**` (using the in-boundary `createAppMarketplaceApiClient`) plus UI. These are **IN-BOUNDARY** — implement them:

| Already in `@letbuyy/api-client` `appStore.*` | Build in-boundary |
|---|---|
| `oauthAuthorize`, `oauthToken`, `oauthTokenExchange` | Real OAuth-based install consent |
| `createCharge`, `approveCharge` | Billing approval UI + billing-at-install |
| `validateDeveloperAppManifest` | Pre-submit manifest validator |
| `rotateDeveloperAppKey` | API-key management UI |
| `extensionRegistry`, `updateExtensionRegistration`, `updateFunctionRegistration` | Extension configuration UI |
| `embedSession`, `bridgeFetch` | App-Bridge-style embedded launch (replace raw iframe) |
| `collaboratorCode` | Collaborator request/redeem flow |
| `developerApps` | "Your other apps" + app management list |
| `categories` | Replace 29 hard-coded categories with live data |

If a method does **not** exist in `@letbuyy/api-client`, do **not** add it (that package is out of boundary) — contract it (§4).

---

## 3. Execution model (single-go, wave-based)

Work top-to-bottom. Each wave: implement every in-boundary issue, run §9 checks, commit, update ledger/status. Don't reorder priorities; don't stop between waves.

- **Wave 0 — Truth & correctness** (remove theater + visible bugs). All IN-BOUNDARY.
- **Wave 1 — Discovery** (categories from API, working filters/sort/pagination, safer search, recency, empty-state guidance, recommendations).
- **Wave 2 — Developer lifecycle UI** (manifest validation, API-key, extension config, collaborator flow, dev profile, "your other apps", listing preview, draft autosave, edit/new-version behind contract).
- **Wave 3 — Trust & install** (OAuth consent, granular scopes, billing UI + billing-at-install, post-install onboarding, data disclosure, review write UI + report, earned-badge rendering).
- **Wave 4 — UX system, a11y, mobile, i18n, SEO** (unify dev pages on `@letbuyy/ui` tokens, mobile nav + 320px, skeletons, dark-mode-safe, localization scaffold, JSON-LD).
- **Wave 5 — Hardening & handoff** (finalize contracts, telemetry hooks, caching/revalidate, ledger/status rollup, final validation).

**Commit discipline:** one commit per issue/tight group, message `feat(app-marketplace): #NN <short> [wave N]` or `fix(app-marketplace): …`, always inside the boundary. After route/page/export changes, run the repo-intelligence generator if available and commit only the regenerated `apps/app-marketplace/AGENTS.md` (never hand-edit it).

---

## 4. Cross-boundary protocol (the contract file)

For anything needing something outside `apps/app-marketplace/**`, do all three:

1. **Implement the in-boundary part** behind a capability guard so the app builds/behaves correctly whether or not the backend capability exists. Use `apps/app-marketplace/src/lib/capabilities.ts` reading `process.env.NEXT_PUBLIC_MP_*` flags (default **off**) — never hard-code "on".
2. **Degrade honestly** when absent: hide the surface or show a clearly-labeled "coming soon / unavailable" state. Never fake it.
3. **Write the contract** in `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md`:

```
### CONTRACT C-### — <title>
- Needed by issue(s): #NN
- Owner: parallel task (services|database|packages/<name>)
- Capability: <what the marketplace needs>
- Proposed interface: <endpoint path+method+request/response, OR api-client method signature, OR DB field/type, OR shared-types addition>
- Marketplace flag: NEXT_PUBLIC_MP_<FLAG> (default off)
- FE behavior when absent: <honest degradation>
- Acceptance: <how both sides verify the contract is met>
- Status: PROPOSED
```

Do not import from, or write to, the out-of-boundary package/service. Contracts are the only handoff.

---

## 5. Skip protocol (human-approval & business decisions)

```
- #NN <title> — SKIPPED (HUMAN-APPROVAL)
  Reason: <why a human/business decision/secret/governance sign-off is required>
  Unblock: <exactly what a human must provide or decide>
  In-boundary work done anyway: <what you still implemented/guarded>
```

MUST be skipped (not guessed): final revenue-share/commission **rate** (business), which **launch-partner apps** to seed (content/legal), KYC/identity policy, production secrets/keys, anything that would change root `AGENTS.md` or add a runtime name, and anything needing a DB migration approved/applied.

---

## 6. Ledger & status (you create and maintain — docs you own, inside your boundary)

- `apps/app-marketplace/CODEX_FOUNDATION_LEDGER.md` — one row per issue:
  `| #NN | title | wave | boundary (IN/IN+C/C/H) | status (DONE/PARTIAL/CONTRACTED/SKIPPED) | files changed | verification | contract id |`
- `apps/app-marketplace/CODEX_FOUNDATION_STATUS.md` — rollup: counts by status, % of in-boundary issues DONE, open contracts (C-###) for the parallel task, open human skips, and the exact validation commands last run + result.
- `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` — see §4.

Keep these honest and current after every wave.

---

## 7. The issue register (all 100 + correctness items)

Boundary key: **IN** = do fully in-boundary · **IN+C** = in-boundary part now + contract the rest · **C** = cross-boundary, only write the contract (parallel task owns it) · **H** = human/business decision, log SKIPPED and continue. Numbers match `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` Phase 17.

### Wave 0 — Truth & correctness (all IN unless noted)

| # | Issue | Bnd | In-boundary action | Acceptance |
|---|---|---|---|---|
| 5 | "Built for LetBuyy" on every app | IN+C | Render badge only when `app.built_for_letbuyy === true`; default hidden | Badge never shows unless field true; C-badge written |
| 9 | Dead pricing/rating filters | IN | Wire Pricing to existing `pricing` query param; Rating as client filter; real buttons | Filters change results + URL; no inert controls |
| 10 | Fake collections | IN+C | Rewrite collection copy truthfully now; gate real curation behind flag | No misleading copy; C-collections written |
| 12 | Category icon rendered as text | IN | Use `<MaterialIcon name=…>` in search sidebar, category header, submit dropdown | No raw icon-name strings |
| 13/18 | Reviews count = first 10 | IN | Use `getReviewCount(app)` total in detail heading | True total shown |
| 17 | `usage_based` offered, DB rejects | IN+C | Remove `usage_based` from submit + display until supported | Option gone; C-pricing-enum written |
| 21 | "Updated" shows 1970 epoch | IN | Hide/`—` when no real timestamp | No 1970 dates |
| 36 | Dead Pencil edit affordance | IN | Remove/disable until edit ships (Wave 2) | No dead control |
| 44 | Docs links unverified | IN+H | Point links to canonical docs path; SKIP "do docs exist?" | Links correct; skip logged |
| 51 | Country list cosmetic vs India-only payout | IN | Align country options with supported payout geos + copy | Consistent messaging |
| 59 | Hardcoded error colors ignore dark mode | IN | Replace raw hex with `@letbuyy/ui` tokens | Correct in dark mode |
| 63 | Client re-sort masks server sort | IN | Trust server sort; remove redundant client re-sort | Single source of sort truth |

### Wave 1 — Discovery

| # | Issue | Bnd | In-boundary action | Acceptance |
|---|---|---|---|---|
| 19 | Hard-coded categories diverge from DB | IN | Drive nav from `appStore.categories()`; constants as fallback only | Nav reflects live data |
| 20 | No category counts / empty handling | IN+C | Show counts if API returns; hide empty categories | Counts when available; C-counts |
| 56 | No pagination | IN | Pagination/"load more" using `total/page/limit` already returned | Catalog paginates |
| 57 | Category sort `<select>` inert | IN | Wire sort to query + refetch | Sort works |
| 4 | Search `.or()` injection | IN+C | Sanitize/encode query client+BFF (defense-in-depth) | Crafted input can't alter filter; **C-4 backend fix is the real fix** |
| 62 | Debounce w/o cancellation | IN | `AbortController` cancels stale fetches | No stale races |
| 61 | No empty-search guidance | IN | Suggest popular categories/queries on empty/zero | Helpful empty state |
| 64 | No recency signals | IN | "New"/"Updated" badges from real timestamps only | Recency visible (honest) |
| 25 | Weak "similar apps" | IN | Improve same-category recs; "more from developer" | Useful related apps |
| 27 | No featured/editorial | IN+C | Featured rail surface fed by flagged data | Renders when present; C-featured |
| 77 | No full-text/synonym search | C | — | C-search-ranking |
| 89 | No catalog caching/CDN | IN+C | Next `revalidate`/cache config for public reads | Caching set; C-CDN |

### Wave 2 — Developer lifecycle UI

| # | Issue | Bnd | In-boundary action | Acceptance |
|---|---|---|---|---|
| 39 | No manifest validation UI | IN | BFF + UI on `appStore.validateDeveloperAppManifest` in submit | Devs validate pre-submit |
| 38 | No API-key UI (endpoint exists) | IN | BFF + console UI on `appStore.rotateDeveloperAppKey` (reveal-once) | Rotation works |
| 40 | No extension config UI | IN | BFF + UI on `extensionRegistry`/`updateExtensionRegistration` | Extensions configurable |
| 37 | Collaborator code shown, no flow | IN | Request/redeem via `appStore.collaboratorCode` | Flow works |
| 82 | No developer profile page | IN+C | Build profile shell; needs public dev fetch | C-public-developer; shell renders |
| 83 | No "developer's other apps" | IN | `appStore.developerApps` on profile/detail | Cross-listing shown |
| 35 | No per-app management | IN+C | App list + manage panel via `developerApps` | List works; edit gated on C-2 |
| 2/46/47 | No update/version + re-review + scope re-consent | IN+C | Edit + "new version" form + scope-diff re-consent UI behind flag | UI complete; C-2 update endpoint + C-46 re-review |
| 97 | No listing preview | IN | Live preview from submit form | Preview matches detail |
| 98 | No draft autosave | IN | Autosave submit form to localStorage | Draft restores |
| 99 | No delist/archive | IN+C | Delist UI; C-99 endpoint | UI present; gated |
| 94 | No private-app distribution UX | IN+C | Private install-link UI (`type` exists) | UI present; C-94 |
| 45 | No published review rubric | IN+H | Review-requirements content page; SKIP final policy text | Page renders; skip logged |
| 43 | No SDK/CLI references | IN | SDK/CLI/docs links in portal + submit | Links present |
| 48 | No suspension/appeal UX | IN+C | Status messaging for suspended/rejected; C-48 appeal | States communicated |

### Wave 3 — Trust & install

| # | Issue | Bnd | In-boundary action | Acceptance |
|---|---|---|---|---|
| 7 | OAuth consent bypassed | IN+C | Route install via `oauthAuthorize`/`oauthToken`; keep legacy behind flag | Real consent path when enabled; C-7 readiness |
| 30 | All-or-nothing scopes | IN+C | Optional-scope + incremental request UI | Granular consent; C-30 |
| 8 | No billing UI | IN+C | Charge approval UI via `createCharge`/`approveCharge`; merchant charge list | Approve/decline works; C-8 charge-list |
| 74 | Billing terms not at install | IN | Combine price + trial + scopes in one consent | Single approval surface |
| 70/71 | Trials/annual/usage not capturable | IN+C | Trial/yearly/usage fields in submit + plan UI | Captured; C-pricing persist |
| 28 | No post-install onboarding | IN+C | Setup checklist + deep link after install | Renders; C-app-config |
| 29 | Unsafe embed iframe | IN | Tighten sandbox; use `embedSession`/`bridgeFetch` | No `allow-same-origin`+`allow-scripts` on 3rd-party; embed via session |
| 31 | No data-handling disclosure | IN+C | Render disclosure block | Renders when present; C-31 field |
| 33 | No changelog | IN+C | Render changelog/release notes | Renders when present; C-33 model |
| 22 | No review write UI | IN | Composer on `/my-apps` per active install → `POST reviews` | Verified merchants can review |
| 24 | No rating histogram | IN+C | Compute distribution from loaded reviews | Histogram renders; C-24 full |
| 66 | No review report/moderation | IN+C | "Report review" UI | UI present; C-66 |
| 23 | No developer reply | C | — | C-23 reply model |
| 49 | Unearned badges | IN+C | Render earned badges only when field set | No unearned badges; C-49 program |
| 75 | No "works with" compatibility | IN+C | Render when present | C-75 field |
| 73 | Unclear per-store install scope | IN | Show target store in consent + my-apps | Store shown |
| 85 | No notifications | IN+C | Notifications inbox UI | UI present; C-85 endpoint |
| 87 | No uninstall reason | IN+C | Reason prompt on uninstall | Prompt present; C-87 persist |
| 81 | No "report listing" | IN+C | Report UI on detail | UI present; C-81 |
| 86 | No app activity log | IN+C | Render activity when available | C-86 data |

### Wave 4 — UX system, a11y, mobile, i18n, SEO

| # | Issue | Bnd | In-boundary action | Acceptance |
|---|---|---|---|---|
| 58 | Two UI idioms (inline styles) | IN | Migrate dev pages to `@letbuyy/ui` + tokens | No ad-hoc inline color/spacing; dark-mode safe |
| 11 | Mobile nav disappears | IN | Hamburger/bottom nav; keep search reachable | Full nav usable <768/<640px |
| 100 | No ≤360/320px tier | IN | Small-screen rules; verify no overflow | Clean at 320px |
| 54 | a11y gaps | IN | Keyboard + ARIA on all controls | Basics pass |
| 55 | Non-semantic `<div onClick>` | IN | Replace with `button`/`a` | Focusable, roled |
| 60 | No skeletons on server pages | IN | Suspense skeletons | Loading states everywhere |
| 52 | No localization | IN+H | i18n scaffold (keys + provider); SKIP translations | Scaffold ready; skip logged |
| 53 | INR-only | IN+C | Currency-aware display scaffold | C-53 multi-currency pricing |
| 90 | Thin SEO | IN | JSON-LD for apps + sitemap/metadata | Structured data validates |
| 78 | Naive markdown | IN | Sanitized markdown renderer | Safe rendering |
| 79 | No screenshot lightbox | IN | Lightbox/zoom | Works |
| 80 | No video/demo | IN+C | Render video when present | C-80 field |
| 26 | No compare | IN | Compare tray (client) | Compare up to N apps |
| 84 | No partner directory | IN+C | Directory page shell | C-84 listing endpoint |
| 32 | No support SLA signal | IN+C | Render SLA when present | C-32 tracking |
| 34 | No status link | IN | Render status URL field | Renders when present |
| 76 | Single category_id | IN+C | Render multiple tags | C-76 schema |

### Wave 5 — Hardening & handoff

| # | Issue | Bnd | Action | Acceptance |
|---|---|---|---|---|
| 91 | No funnel telemetry | IN+C | discovery→install event hooks (no-op sink behind flag) | Hooks present; C-91 sink |
| 92 | No experimentation | IN+C | Experiment-flag scaffold | Scaffold; C-92 |
| 88 | Rate-limit visibility | C | — | C-88 doc |
| 93 | Env catalog parity | C | — | C-93 |
| 95 | Dev team roles | C | — | C-95 |
| 96 | 2FA/security settings | C | — | C-96 |
| 65 | Install-count credibility | C | — (trigger already active-only) | Note only |

### Cross-boundary issues the parallel task owns (only write contracts; do NOT implement)

`#1 seed catalog (database)`, `#2 app-update endpoint (services+db)`, `#3 revenue-share default (services)` **+ H rate**, `#4 search-injection backend fix (services)`, `#6 real review gating/scanning (services)`, `#14 media upload (media-service)`, `#15 per-app analytics`, `#16 app-health/API-usage`, `#17 pricing_model enum (database)`, `#23 review-reply model`, `#41 webhook CRUD`, `#42 dev-store provisioning`, `#50 KYC` **+ H**, `#67 payout statements`, `#68 GST invoices`, `#69 refunds`, `#72 proration`, `#77 search ranking`, `#88/#93/#95/#96`.

### Human-only decisions (log SKIPPED, keep moving)

`#3 final commission rate`, `#1 which launch-partner apps to seed`, `#45 review-policy text`, `#50 KYC policy`, `#44 docs existence`, and anything that would edit root `AGENTS.md`, add a runtime name, apply a DB migration, or touch secrets.

---

## 8. File-level change map (in-boundary surface)

- **Pages:** `src/app/page.tsx`, `src/app/(store)/apps/[slug]/page.tsx`, `(store)/search/page.tsx`, `(store)/categories/page.tsx`, `(store)/categories/[slug]/page.tsx`, `(store)/collections/[slug]/page.tsx`, `(auth)/developers/*`, `(auth)/my-apps/page.tsx`.
- **Components:** `AppCard.tsx`, `AppInstallConsentPanel.tsx`, `InstalledAppsGrid.tsx`, `CategoryGrid.tsx`, `Header.tsx`, `Footer.tsx`, `StarRating.tsx`, `MarketplaceUnavailable.tsx`; add `MobileNav`, `Pagination`, `ReviewComposer`, `BillingApprovalPanel`, `ApiKeyPanel`, `ManifestValidator`, `CompareTray`, `Lightbox`, `Skeletons`, etc.
- **Lib:** `app-service.ts`, `marketplace-display.ts`, `api/client.ts`, `constants/categories.ts` (fallback only); add `capabilities.ts` (flags), `seo.ts`, `i18n/*`.
- **BFF routes (add under `src/app/api/**`, thin pass-throughs to `appStore.*` via `createAppMarketplaceApiClient`, mirroring existing routes; extend `proxy.ts` `PROTECTED_*` lists as needed):** `apps/[id]/charges`, `charges/[id]/approve`, `developers/apps/[id]/api-key`, `developers/apps/manifest/validate`, `installations/[id]/extensions`, `installations/[id]/embed-session`, `apps/[id]/oauth/authorize`, `partners/collaborator-code`, `developers/apps` (GET).
- **Styles:** `src/app/globals.css` (mobile nav, 320px tier, dark-mode tokens, skeletons) — prefer `@letbuyy/ui` tokens over raw values.
- **Docs you own:** `CODEX_FOUNDATION_LEDGER.md`, `CODEX_FOUNDATION_STATUS.md`, `CROSS_BOUNDARY_CONTRACTS.md`, and the regenerated `AGENTS.md` (via script only).

Keep business logic out of page components (per `apps/app-marketplace/AGENTS.md`): put data shaping in `lib/` and call `appStore.*` through BFF routes/server components. Do not add new runtime roots, packages, or top-level config.

---

## 9. Definition of Done & validation

An issue is **DONE** only when in-boundary code is complete, it degrades honestly if a contract is unmet, the ledger row is filled (files + verification), and these all pass:

```bash
pnpm --filter @letbuyy/app-marketplace typecheck
pnpm --filter @letbuyy/app-marketplace lint
pnpm --filter @letbuyy/app-marketplace build
pnpm --filter @letbuyy/app-marketplace test    # federation thin-client + install/review tests
```

After route/page/export changes, regenerate intelligence if available and commit only the marketplace `AGENTS.md`:

```bash
node scripts/generate-repository-intelligence.mjs   # read-only generator; commit only apps/app-marketplace/AGENTS.md diff
node scripts/validate-governance.mjs                 # if it fails for reasons OUTSIDE apps/app-marketplace, log in STATUS and continue — do not "fix" out-of-boundary
```

The mission is **complete** when every IN and IN+C issue is DONE or PARTIAL-with-contract, every C issue has a contract, every H item is logged SKIPPED, the four package checks are green, and STATUS shows the rollup.

---

## 10. First actions (do these now, in order)

1. Read `apps/app-marketplace/AGENTS.md`, root `AGENTS.md`, and the audit docs in §1.
2. Create `apps/app-marketplace/CODEX_FOUNDATION_LEDGER.md`, `CODEX_FOUNDATION_STATUS.md`, `CROSS_BOUNDARY_CONTRACTS.md`, and `src/lib/capabilities.ts` (all flags default off).
3. Run the four package checks once for a clean baseline; record it in STATUS.
4. Execute **Wave 0** end-to-end, commit per issue, update ledger/status, re-run checks.
5. Proceed through Waves 1→5 without stopping. Mark skips, write contracts, never cross the boundary.

> A strong foundation here means **truthful, in-boundary, parallel-safe** work. When in doubt, do the honest in-boundary thing and write a contract. Do not block. Do not cross the line.
