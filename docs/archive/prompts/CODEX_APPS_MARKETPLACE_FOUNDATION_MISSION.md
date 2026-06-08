<!-- CODEX MISSION PROMPT. Paste this entire file to Codex as the task brief, or point Codex at this path. Single-go, autonomous execution. -->

# CODEX MISSION — Apps Marketplace Foundation Hardening (V1)

> **You are Codex.** You are hardening the **LetBuyy Apps Marketplace** to a fundamentally strong foundation in a single autonomous run. You will work through the full issue register derived from the audit, in priority order, committing as you go, and you will **not stop for human approval** — when a step needs a human or a business decision, you log it as `SKIPPED (HUMAN-APPROVAL)` and continue. A **second Codex task runs in parallel on the backend/platform**, so you must stay strictly inside your ownership boundary and hand every out-of-boundary need to that task through a written contract. Read this entire file before writing any code.

---

## 0. Non-negotiables (read first)

1. **OWNERSHIP IS ABSOLUTE.** You may only create/modify/delete files under **`apps/app-marketplace/**`**. You must **NOT** touch any of:
   - `services/**` (api-gateway, etc.) — owned by the parallel backend task
   - `database/**` (migrations/schema) — owned by the parallel backend task
   - `packages/**` (`@letbuyy/api-client`, `@letbuyy/shared-types`, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/app-engine`) — shared; **read-only** for you
   - any other `apps/**`, root configs (`AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, validators), or root docs except your own ledger/status files (see §6)
   If a fix *requires* a change outside this boundary, you do **NOT** make it. You implement the in-boundary part, guard it, and record a contract (see §4). Crossing the boundary will collide with the parallel task and is a hard failure.
2. **PARALLEL-SAFE.** Assume another agent is editing `services/`, `database/`, and `packages/` right now. Never edit a file both tasks could touch. All cross-boundary needs flow through `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` (you create and own this file).
3. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs human approval, a secret, a business decision, production data, or a governance sign-off, mark it `SKIPPED (HUMAN-APPROVAL)` in the ledger with a precise description of what's needed, then continue with the next item.
4. **TRUTH OVER THEATER.** Do not add fake data, fake metrics, fake reviews, or unconditional "trust" badges. Honest empty/loading/error states are required. If you cannot make something real in-boundary, make it *honest* (hide it or label it) and contract the real version.
5. **GREEN BEFORE DONE.** Every wave must end with: `pnpm --filter @letbuyy/app-marketplace typecheck`, `pnpm --filter @letbuyy/app-marketplace lint`, `pnpm --filter @letbuyy/app-marketplace build`, and `pnpm --filter @letbuyy/app-marketplace test` all passing. Do not mark an issue `DONE` if any of these fail for code you touched.
6. **EVIDENCE OR IT DIDN'T HAPPEN.** Every issue you close gets a ledger row with the files changed and how you verified it (§6).
7. **NO SCOPE INVENTION.** Implement exactly the issues in §7. If you discover a new in-boundary defect, add it to the ledger as `FOUND-###` and fix it; do not wander into refactors that aren't required by an issue.

---

## 1. Mission context — what the Apps Marketplace is

`apps/app-marketplace` is a **Next.js 16 / React 19 thin client** that renders the storefront (catalog, search, categories, collections, app detail, install) and the developer surfaces (portal, registration, partner console, submit-app, my-apps). It owns **no business logic of record** — it calls the platform gateway through **`@letbuyy/api-client`'s `appStore` namespace** and falls back to an explicit `MarketplaceUnavailable` state when the gateway is unreachable.

Authoritative context you MUST read before starting (do not skip):

- `apps/app-marketplace/AGENTS.md` — your ownership boundary, runtime rules, security/scalability notes (this is generated; treat it as law).
- Root `AGENTS.md` — the engineering constitution (tenant isolation via `site_id`, contracts over tribal knowledge, validation requirements).
- The audit set (your issue source of truth):
  - `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` — architecture, flows, the **Top-100 register (Phase 17)**, and the brutal review.
  - `docs/apps-marketplace-audit/APPS_FEATURE_GAP_ANALYSIS.md` — what's missing vs. backend-exists-but-no-UI.
  - `docs/apps-marketplace-audit/APP_DISCOVERY_AUDIT.md` — discovery defects.
  - `docs/apps-marketplace-audit/APP_INSTALLATION_JOURNEY_AUDIT.md` — install/consent/billing journey.
  - `docs/apps-marketplace-audit/APP_REVIEW_SYSTEM_AUDIT.md` — review gating (mostly backend).
  - `docs/apps-marketplace-audit/APP_PLATFORM_ARCHITECTURE_AUDIT.md` — what the gateway already exposes.
  - `docs/apps-marketplace-audit/APPS_MARKETPLACE_UI_UX_AUDIT.md` — UI defects.
  - `docs/apps-marketplace-audit/APPS_RESPONSIVENESS_REPORT.md` — mobile/responsive.
  - `docs/apps-marketplace-audit/APPS_CONTENT_GAP_ANALYSIS.md` — copy/content defects.
  - `docs/apps-marketplace-audit/MERCHANT_TRUST_SCORECARD.md` + `DEVELOPER_TRUST_SCORECARD.md` — what builds/destroys trust.
  - `docs/apps-marketplace-audit/ECOSYSTEM_SCALABILITY_REPORT.md` — sequencing rationale.
  - `docs/apps-marketplace-audit/LETBUYY_APPS_MARKETPLACE_V2.md` — the target design you are building toward.
  - `docs/apps-marketplace-audit/SHOPIFY_APP_STORE_COMPARISON.md` — the benchmark.

---

## 2. The boundary insight that makes this task large and real

A great deal of "backend exists, no UI" can be built **entirely in-boundary**, because `@letbuyy/api-client`'s `appStore` already exposes methods the marketplace never calls. You wire them by adding **BFF route handlers** under `apps/app-marketplace/src/app/api/**` (which use the in-boundary `createAppMarketplaceApiClient`) plus the UI. These are **IN-BOUNDARY** and you must implement them:

| Already in `@letbuyy/api-client` `appStore.*` | Use it to build (in-boundary) |
|---|---|
| `oauthAuthorize`, `oauthToken`, `oauthTokenExchange` | Real OAuth-based install consent flow |
| `createCharge`, `approveCharge` | Billing approval UI + billing-at-install |
| `validateDeveloperAppManifest` | Pre-submit manifest validator |
| `rotateDeveloperAppKey` | API-key management UI |
| `extensionRegistry`, `updateExtensionRegistration`, `updateFunctionRegistration` | Extension configuration UI |
| `embedSession`, `bridgeFetch` | App-Bridge-style embedded launch (replace raw iframe) |
| `collaboratorCode` | Collaborator request/redeem flow |
| `developerApps` | "Your other apps" + app management list |
| `categories` | Replace the 29 hard-coded categories with live data |

If a method does **not** exist in `@letbuyy/api-client`, you do **not** add it (that package is out of boundary) — you contract it (§4).

---

## 3. Execution model (single-go, wave-based)

Work top-to-bottom through the waves. Each wave: implement every in-boundary issue in it, run the §0.5 checks, commit, update the ledger and status. Do not reorder priorities. Do not stop between waves.

- **Wave 0 — Truth & correctness (remove theater + visible bugs).** All IN-BOUNDARY. Fastest trust wins.
- **Wave 1 — Discovery.** Categories from API, working filters/sort/pagination, safer search, recency, empty-state guidance, recommendations.
- **Wave 2 — Developer lifecycle UI.** Manifest validation, API-key mgmt, extension config, collaborator flow, developer profile, "your other apps", listing preview, draft autosave, edit/new-version UI (contract-gated).
- **Wave 3 — Trust & install.** OAuth-based consent, granular scopes, billing UI + billing-at-install, post-install onboarding, data-handling disclosure (render), review write UI + report, earned-badge rendering.
- **Wave 4 — UX system, a11y, mobile, i18n, SEO.** Unify dev pages onto `@letbuyy/ui` tokens, fix mobile nav + 320px, skeletons, dark-mode-safe styles, localization scaffold, JSON-LD/SEO.
- **Wave 5 — Hardening & handoff.** Finalize `CROSS_BOUNDARY_CONTRACTS.md`, telemetry hooks, caching/revalidate config, full ledger/status rollup, final validation.

**Commit discipline:** one commit per issue or tight issue-group, message `feat(app-marketplace): #NN <short> [wave N]` or `fix(app-marketplace): …`. Keep commits inside the boundary. After any change to routes/pages/exports, run the repo-intelligence generator if available and commit only the regenerated `apps/app-marketplace/AGENTS.md` (never hand-edit it).

---

## 4. Cross-boundary protocol (the contract file)

For every issue (or part of an issue) that needs something outside `apps/app-marketplace/**`, do all three:

1. **Implement the in-boundary part** behind a capability guard so the app builds and behaves correctly whether or not the backend capability exists yet. Use a feature flag pattern: a small `apps/app-marketplace/src/lib/capabilities.ts` reading `process.env.NEXT_PUBLIC_MP_*` flags (default off) — never hard-code "on".
2. **Degrade honestly** when the capability is absent: hide the surface, or show a clearly-labeled "coming soon / unavailable" state. Never fake it.
3. **Write the contract** in `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` using this template:

```
### CONTRACT C-### — <title>
- Needed by issue(s): #NN
- Owner: parallel task (services|database|packages/<name>)
- Capability: <what the marketplace needs>
- Proposed interface: <endpoint path + method + request/response shape, or api-client method signature, or DB field/type, or shared-types addition>
- Marketplace flag: NEXT_PUBLIC_MP_<FLAG> (default off)
- FE behavior when absent: <honest degradation>
- Acceptance: <how both sides verify the contract is met>
- Status: PROPOSED
```

Do not import from, or write to, the out-of-boundary package/service. Contracts are the only handoff.

---

## 5. Skip protocol (human-approval & business decisions)

When an item needs a human, record it and move on. Ledger entry format:

```
- #NN <title> — SKIPPED (HUMAN-APPROVAL)
  Reason: <why a human/business decision/secret/governance sign-off is required>
  Unblock: <exactly what a human must provide or decide>
  In-boundary work done anyway: <what you still implemented/guarded>
```

Examples that MUST be skipped (not guessed): the final revenue-share/commission **rate** (business decision), which **launch-partner apps** to seed (content/legal), KYC/identity verification policy, production secrets/keys, any governance decision that would change root `AGENTS.md` or add a runtime name, and anything requiring a DB migration to be approved/applied.

---

## 6. Ledger & status (you create and maintain these — they are in your boundary as docs you own)

Create and continuously update:

- `apps/app-marketplace/CODEX_FOUNDATION_LEDGER.md` — one row per issue:
  `| #NN | title | wave | boundary (IN/CROSS/HUMAN) | status (DONE/PARTIAL/CONTRACTED/SKIPPED) | files changed | verification | contract id |`
- `apps/app-marketplace/CODEX_FOUNDATION_STATUS.md` — rollup: counts by status, % of in-boundary issues DONE, open contracts (C-###) for the parallel task, open skips for humans, and the exact validation commands you last ran with their result.
- `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` — see §4.

Keep these honest and current after every wave. They are the interface to the human and the parallel task.

---
