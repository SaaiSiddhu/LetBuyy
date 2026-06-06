# CODEX MISSION — Developer App Foundation Hardening (single-pass, scope-locked)

> Paste everything below the line into Codex as one task. It is self-contained, scope-fenced for safe parallel execution, and instructs Codex to implement every developer-app-owned issue in one pass and to **SKIP + log** anything outside its ownership or needing human approval.

---

## 0) ROLE & MISSION

You are a senior platform engineer hardening the **LetBuyy Developer App** so it is *fundamentally strong*: coherent, styled, honest, navigable, and trustworthy to a first-time external developer. You will implement, in a **single pass**, every issue from the audit that falls inside your ownership, and you will **SKIP-and-log** (never silently drop) every issue that requires another owner or human approval, then keep going.

Your definition of success: a developer can land on the portal, understand the platform, find one coherent set of docs that all render correctly, follow a quickstart, reach the real console, and never hit a broken/duplicate/placeholder/unstyled page **inside your ownership**.

This is the **foundation phase**. Prioritize correctness, coherence, and trust over new features. Do not break the build, the type-checker, the lint gate, or governance validation.

---

## 1) ABSOLUTE OWNERSHIP & SCOPE FENCE (read first, obey always)

A second Codex task runs in **parallel on services/backend + packages**. To avoid collisions, you must stay strictly inside your allowlist.

### ✅ YOU OWN (write freely):
- `apps/developer-portal/**` — the entire docs portal (incl. `src/app/globals.css`, `next.config.ts`, `package.json`).
- `apps/app-marketplace/src/app/(auth)/developers/**`
- `apps/app-marketplace/src/app/(auth)/my-apps/**`
- `apps/app-marketplace/src/app/api/developers/**`
- New files **only under the paths above** (e.g., a new `(auth)/developers/apps/[id]/edit/page.tsx`, new CSS Modules, new portal pages/components).

### ⛔ FORBIDDEN (do NOT modify — SKIP + hand off if needed):
- `services/**` (api-gateway, webhook-service, queue-workers, etc.) — **owned by the parallel backend task**.
- `packages/**` including **`@letbuyy/ui`** — owned by the parallel task. You may *import* `@letbuyy/ui` (it is the portal's only allowed workspace dep) but you may **not edit it**. Pin to its current public API; if a fix needs a `@letbuyy/ui` change, SKIP + hand off.
- Any `apps/**` other than the two roots above. In particular, in `apps/app-marketplace` do **NOT** touch shared files: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/**` (Header, Footer, etc.), `src/lib/**`, `src/proxy.ts`, or any `(store)/**` route. Read-only reference is fine; use **CSS Modules** for any new marketplace-dev-slice styling instead of the shared global stylesheet.
- `config/**`, `infrastructure/**`, `database/**`, `legacy/**`, `.github/**`, root build config, runtime manifests/topology, governance memory.
- Never recreate deprecated runtime aliases: `apps/{admin,auth,checkout,internal,merchant,storefront,analytics}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`.

### Runtime-manifest law (enforce in every edit):
- `apps/developer-portal` forbids importing from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, `provider-sdks`, `generated-artifacts`. Its **only** allowed workspace dependency is `@letbuyy/ui`. Cross-linking the portal to the console must be a **plain `<a>`/`next/link` to an env-configured URL** (e.g., `NEXT_PUBLIC_APP_MARKETPLACE_URL`), never an import.
- The portal has **no authority** over OAuth token minting, app installs, webhooks, payouts, or API-key mutation. Any feature needing those is **frontend-shell-only + handoff**.

---

## 2) GROUND TRUTH — REQUIRED READING (do this before writing code)

Read these audit documents; they are the source of truth for *what* and *why*. Implement against them.
- `docs/LETBUYY_DEVELOPER_PLATFORM_MASTER_AUDIT.md` (verdict, architecture, DX scorecard, roadmap)
- `docs/developer-platform-audit/TOP_100_ISSUES.md` ← **your work queue (issues #1–#100)**
- `docs/developer-platform-audit/DEVELOPER_UI_UX_AUDIT.md` (the undefined-CSS list)
- `docs/developer-platform-audit/INFORMATION_ARCHITECTURE_REDESIGN.md` (target IA + consolidation map)
- `docs/developer-platform-audit/CONTENT_GAP_ANALYSIS.md` (current text → replacement)
- `docs/developer-platform-audit/DEVELOPER_FEATURE_GAP_ANALYSIS.md`
- `docs/developer-platform-audit/APP_CREATION_JOURNEY_AUDIT.md`
- `docs/developer-platform-audit/API_EXPERIENCE_AUDIT.md`
- `docs/developer-platform-audit/DOCUMENTATION_GAP_ANALYSIS.md`
- `docs/developer-platform-audit/RESPONSIVENESS_REPORT.md`
- `docs/developer-platform-audit/DEVELOPER_TRUST_SCORECARD.md`
- `docs/developer-platform-audit/LETBUYY_DEVELOPER_PLATFORM_V2.md` (target design)
- `docs/developer-platform-audit/SHOPIFY_COMPARISON_MATRIX.md`

Also read and obey: root `AGENTS.md`, `apps/developer-portal/AGENTS.md`, `apps/developer-portal/runtime.manifest.json`, and `docs/governance/*` as referenced.

---

## 3) OPERATING RULES

1. **Single pass, all issues.** Walk the entire `TOP_100_ISSUES.md` queue (#1→#100). For each, either implement it (if owned) or SKIP-and-log it (if not). Do not stop at the first blocker — log and continue.
2. **Never silently skip.** Every non-implemented item gets a ledger entry (see §4) with reason + handoff owner.
3. **Honesty over fakery.** Never ship a placebo. If a feature can't be real in your scope, render an explicit, dated `Beta`/`Planned` state — never a fake "working" control. (This is LetBuyy's existing `[SKIP — NEEDS BACKEND/SDK]` ethos; keep it, but relabel it for external developers.)
4. **Preserve the source-backed ethos.** Keep "every claim ties to code," but every `source:` reference you keep or add **must resolve to a real file** (you will add a check — see WS-4).
5. **Keep gates green.** After your changes: `pnpm -w typecheck`, `pnpm -w lint`, the app's `test` script, and `node scripts/validate-governance.mjs` must pass. Regenerate `AGENTS.md` via `node scripts/generate-repository-intelligence.mjs` after any routing/structural change.
6. **Small, labeled commits per workstream** (WS-1, WS-2, …) so the parallel task can rebase cleanly.
7. **Coordinate via handoff file.** Maintain `apps/developer-portal/HANDOFF_TO_BACKEND.md` listing every backend contract/endpoint your UI shells need, so the parallel services task can implement them.
8. **No secrets, no auth/token logic, no payout/charge mutations** authored here (forbidden + manifest law).

---

## 4) SKIP / HANDOFF PROTOCOL

Create and continuously update a ledger: **`apps/developer-portal/CODEX_DEVELOPER_APP_FOUNDATION_LEDGER.md`**.

For EVERY issue #1–#100 add a row:

```
| Issue # | Title | Status | Owner | Notes / PR link / Handoff |
```

`Status` ∈ `DONE` · `SKIPPED:BACKEND` · `SKIPPED:PACKAGES` · `SKIPPED:HUMAN-APPROVAL` · `PARTIAL (UI shell, backend handoff)` · `N/A`.

**SKIP categories:**
- `SKIPPED:BACKEND` — needs `services/**` (OpenAPI gen, GraphiQL execution, webhook test-sender dispatch, key inventory/revoke endpoints, analytics data, dev-store create, app versioning, EventBridge). → add to `HANDOFF_TO_BACKEND.md`.
- `SKIPPED:PACKAGES` — needs `@letbuyy/ui` or a new package (CLI, browser App Bridge SDK, server SDKs, design-system primitives). → handoff.
- `SKIPPED:HUMAN-APPROVAL` — needs a human decision: final commission % / pricing, legal ToS & Privacy copy, brand/domain decisions, deleting content with possible external links, anything altering security/compliance posture. Implement a clearly-marked placeholder and continue.
- `PARTIAL` — you built the frontend shell (disabled or static) inside your scope and logged the backend dependency.

> Also FIX the broken citation: the 3 references to `apps/developer-portal/CODEX_WS10_LEDGER.md` in `src/lib/developer-surface.ts` must be repointed to a **real** file (use this new ledger path or `apps/developer-portal/AGENTS.md`). Issue #11.

---

## 5) WORK PLAN — implement in this order (maps to all 100 issues)

> Status key per item: **[DO]** implement now (owned) · **[SHELL]** build UI shell + handoff · **[SKIP→BACKEND]** / **[SKIP→PKG]** / **[SKIP→HUMAN]**.

### WS-0 — Setup (no behavior change)
- Read §2 docs. Create the ledger (§4) pre-filled with all 100 rows. Create `HANDOFF_TO_BACKEND.md`. Confirm current `pnpm -w typecheck && pnpm -w lint && node scripts/validate-governance.mjs` baseline is green; record it.

### WS-1 — P0 Kill the unstyled-rendering failure  *(issues #1, #18, #19, #20, #33, #54, #55, #56, #57, #59)*
- **[DO]** In `apps/developer-portal/src/app/globals.css`, define **every** currently-undefined class used by System B and the state pages. Enumerate by grepping the portal for class names and cross-checking against `globals.css`. At minimum: `.docs-card`, `.docs-grid`, `.docs-grid--two`, `.docs-grid--three`, `.docs-page-hero`, `.endpoint-table`, `.endpoint-table-wrap` (must include `overflow-x:auto`), `.route-matrix`, `.schema-matrix`, `.response-contract-matrix`, `.payment-safety-matrix`, `.app-quality-gate-matrix`, `.webhook-topic-matrix`, `.webhook-delivery-rule-matrix`, `.scope-matrix`, `.oauth-token-lifecycle-matrix`, `.app-bridge-fetch-matrix`, `.sdk-contract-matrix`, `.tooling-gap-matrix`, `.dashboard-surface-matrix`, `.method-pill` (+ `--get/--post/--put/--patch/--delete` color variants), `.code-sample`, `.fact-list`, `.contract-grid`, `.contract-card` (+ `--stacked`), `.example-grid`, `.example-card`, `.skip-list`, `.source-ref`, `.category-pill`, `.scope-cloud`, `.step-list`, `.anchor-section`, `.section-kicker`, `.subtle-copy`, `.developer-button` (+ `--primary`), `.loading-stack`, `.loading-card`.
- Style them with the existing `--lb-*` design tokens and the System-A visual language so System A and System B look identical.
- **[DO]** Add visible `:focus-visible` styles and ≥44px tap targets for `.developer-button` and `.method-pill`. Add `<caption>`/`scope` styling for tables. Verify WCAG-AA contrast for the amber "skip"/status pills.
- **Acceptance:** a grep of the portal finds **zero** referenced classes without a CSS rule; `/api`, `/oauth`, `/webhooks`, `/sdks`, `error.tsx`, `loading.tsx`, `not-found.tsx` render fully styled; 6-column tables scroll horizontally instead of overflowing.

### WS-2 — P0 One IA, one nav, no duplicates  *(issues #2, #3, #16, #67, #71, #97)*
- **[DO]** Consolidate to **one page system**. Decision rule: keep the **richer System-B content** but render it with the now-complete styling, and retire the thinner System-A duplicates. Concretely:
  - Merge `/api` + `/api-reference` → single `/reference` (keep the System-B content). Add a `next.config.ts` redirect from the removed path.
  - Merge `/sdk` + `/sdks` → single `/sdks` (keep System-B). Redirect the removed path.
  - Replace `/docs` (combined OAuth+webhooks) by redirecting to canonical `/guides/oauth` and `/guides/webhooks` (or keep `/oauth`,`/webhooks` and redirect `/docs`). Remove the duplicated HMAC snippet so it lives in exactly one place.
- **[DO]** Delete one of the two header components; keep a **single** `PortalChrome` header whose nav targets are consistent everywhere. No label may resolve to two different routes.
- **[DO]** Resolve the GraphQL contradiction: state GraphQL **once**, accurately (Admin + Storefront GraphQL behind the gateway with query-cost limiting; mark the interactive explorer `Beta — pending` and handoff).
- **[DO]** Unify the footer text.
- **Acceptance:** one page per concept; one header; removed routes 301/308-redirect; `node scripts/validate-governance.mjs` green; `AGENTS.md` regenerated.

### WS-3 — P0 Kill the fake dashboard + connect the two surfaces  *(issues #4, #8, #45, #15)*
- **[DO]** Replace the portal `/dashboard` placebo: render a short explainer + a prominent link to the **real** Partner Console at `${NEXT_PUBLIC_APP_MARKETPLACE_URL}/developers/dashboard` (env-configured; plain link, no import). Do **not** simulate dashboard data.
- **[DO]** Add bidirectional cross-links: portal → console (Register / Open console) and, in the marketplace developer landing (`(auth)/developers/page.tsx`, owned), a "Read the docs" link to `${NEXT_PUBLIC_DEVELOPER_PORTAL_URL}`.
- **[DO]** Repoint the home hero CTA so the first click lands on a now-styled page.
- **Acceptance:** no placebo dashboard; a developer can move docs↔console in one click.

### WS-4 — P0 Content integrity & honesty  *(issues #11, #35, #44, #46, #47, #48, #75, #81, #89)*
- **[DO]** Fix the broken `CODEX_WS10_LEDGER.md` citations (#11). Add an owned script `apps/developer-portal/scripts/verify-sources.mjs` that asserts every `source:` path in `src/lib/*.ts` resolves on disk; wire it into the app `package.json` as `verify:sources` and run it in `test`.
- **[DO]** Remove dead exports `evidenceSources`, the duplicate `dashboardShell`, `dashboardSurfaces`, and the unused `DashboardSurfaceMatrix` component **OR** wire `dashboardSurfaces` content into a real (static, honest) "What the console shows" section. Pick one; no dead code left.
- **[DO]** De-jargon all public copy: replace "D0 app", "WS11", "ws13", and raw `file.ts:line` *as primary labels* with developer-facing language; keep source links as secondary, friendly references. Relabel `SKIP — NEEDS BACKEND/SDK` → `Beta`/`Planned` badges.
- **[DO]** Surface payment-safety/compliance as a positive "Why LetBuyy is safe" section. Add "last updated" + a "report a docs issue" link.
- **Acceptance:** `verify:sources` passes; zero dead exports; no internal milestone codes in public copy.

### WS-5 — P1 Build the missing docs surfaces (static, owned)  *(issues #10, #21, #22, #23(static), #32, #42, #43, #49, #50, #51, #52, #17, #73(static), #74(static), #82, #83, #85, #92, #94)*
- **[DO]** Add a persistent left **sidebar + right-rail TOC** (client component, anchors from headings) and a **client-side search** over the static content arrays.
- **[DO]** New pages/sections: `Get started` quickstart (register → create app → OAuth with cURL → receive a webhook → call `/v1/app/products`); `Guides` (oauth, webhooks, extensions, themes, billing); **error-code catalog** (VALIDATION, FORBIDDEN, NOT_FOUND, QUERY_COST_RATE_LIMITED, AMOUNT_MISMATCH, INVALID_GRANT, CONFLICT, INTERNAL_ERROR) with handling recipes; **rate-limit handling** guide; **webhook receiver tutorial** (full Node example); **glossary**; **changelog/versioning** page; **pricing/revenue** page (mark the commission % `SKIPPED:HUMAN-APPROVAL` until confirmed); **support/status** entry point.
- **[DO]** Code blocks: add copy-to-clipboard, language tabs, and syntax highlighting (client component; no new workspace deps beyond `@letbuyy/ui` — if highlighting needs a lib, vendor a tiny local highlighter or mark `PARTIAL`).
- **[SHELL]** Interactive API/GraphQL explorer (#6, #23 live, #73): build a read-only explorer UI shell labeled `Beta — pending backend`; **[SKIP→BACKEND]** the live execution + GraphiQL endpoint → handoff.
- **Acceptance:** four-bucket IA (Get started · Guides · Reference · Launch) exists; search + sidebar + TOC work; every new page is reachable from the single nav.

### WS-6 — P1 Marketplace developer-slice bug fixes  *(issues #9, #24, #25, #36, #53, #78, #68, #69)*
- **[DO]** #78 — Create `apps/app-marketplace/src/app/(auth)/developers/apps/[id]/edit/page.tsx` so the dashboard "Edit" link no longer 404s. Reuse the new-app form; load the app via the existing developer-apps API. (If an update endpoint doesn't exist, render the form read-only/disabled with `PARTIAL` + handoff for the PATCH endpoint.)
- **[DO]** #24 — Register wizard: replace the silent `? : null` step gate with real inline validation, error messages, and focus management.
- **[DO]** #25 — Stop misleading field claims: either pass `tax_id`/agreements through `api/developers/register/route.ts` (and `PARTIAL`+handoff if the backend/api-client doesn't accept them yet) or remove them and correct the help text. No field may claim to be saved if it is dropped.
- **[DO]** #36 — Dashboard: change the catch-all redirect so only `401/404` route to `/developers/register`; transient errors render an error state, not a redirect loop.
- **[DO]** #53 — Wire the collaborator-code copy button to an actual clipboard handler.
- **[DO]** #68/#69 — Add a post-registration confirmation + explain `pending`/`verified=false`.
- **[DO]** #9 — App-submission uploaders: remove the fake drag-drop affordance; replace with an honest "media upload — Beta" note. **[SKIP→BACKEND]** real media upload (needs a media endpoint) → handoff.
- **Style** any new marketplace-dev markup with **CSS Modules** (never the shared `globals.css`).
- **Acceptance:** no Edit 404; no silent wizard; no error-redirect loop; copy button works; no fake controls.

### WS-7 — P1 Responsiveness  *(issues #20, #41, #58, #59, #6(marketplace inline))*
- **[DO]** Confirm `.endpoint-table-wrap{overflow-x:auto}` and responsive `.docs-grid*` from WS-1 fix portal tables/grids at 320–768px.
- **[DO]** Marketplace dashboard app-row: move stats/actions to a layout that wraps below the title on small screens (CSS Module).
- **[DO]** Add a 640–768px tier so tablets aren't stuck in mobile layout; add a scroll affordance to the mobile nav.
- **[DO]** (Optional, in-scope via CSS Modules) migrate the heaviest marketplace-dev inline styles to a module; if time-boxed, mark remainder `PARTIAL`.
- **Acceptance:** no horizontal overflow at 320/375/768; dashboard usable on mobile.

### WS-8 — P2 Backend-dependent capabilities → SHELL + HANDOFF  *(issues #5, #7, #12, #14, #26, #27, #28, #29, #37, #62, #63, #66, #6/#23 live, #93, #100)*
For each, build the **frontend shell inside your scope** where it naturally lives (a console "API keys" view that calls the **existing** rotate route only; a webhook "test sender" form disabled with a `Beta` tag; an analytics/empty-state panel), and **[SKIP→BACKEND]/[SKIP→PKG]** the live functionality with a precise entry in `HANDOFF_TO_BACKEND.md` (endpoint, method, request/response contract, scope). Pure-package items (CLI `create-letbuyy`/`letbuyy`, browser App Bridge SDK, server SDKs, `@letbuyy/ui` design-system primitives) are **[SKIP→PKG]** with handoff — do not scaffold packages.
- **Acceptance:** no half-built backend calls; every shell is clearly `Beta/Planned`; `HANDOFF_TO_BACKEND.md` lists every required contract.

### WS-9 — Low-priority polish  *(issues #76, #77, #79, #80, #84, #86, #87, #88, #90, #91, #95, #96, #98, #99)*
- **[DO]** the cheap owned ones (CTA copy #76, reduce landing animation #77, clarify `/my-apps` vs dashboard #79, breadcrumbs #80, `/` search shortcut #84, OG/favicon metadata #98, print CSS #96, accessibility statement #95, deprecation-policy page #100 as static content).
- **[SKIP→HUMAN]** SLA/uptime (#87), localized docs/i18n rollout (#88), newsletter (#91) — log decisions needed.

---

## 6) DEFINITION OF DONE (must all hold before you finish)

1. `pnpm -w typecheck` ✅ · `pnpm -w lint` ✅ · `apps/developer-portal` `test` ✅ · `node scripts/verify-sources.mjs` (new) ✅ · `node scripts/validate-governance.mjs` ✅.
2. **Zero undefined CSS classes** in the portal (provide the grep command + its empty output in the PR).
3. **One** page per concept, **one** header, all removed routes redirect; `AGENTS.md` regenerated and committed.
4. No placebo UI; no fake controls; no internal jargon in public copy; the Edit-button 404 is gone.
5. Every issue #1–#100 has a ledger row with a terminal status; `HANDOFF_TO_BACKEND.md` is complete.
6. No edits outside the §1 allowlist (run `git diff --name-only` and confirm every path is owned).
7. Portal imports only `@letbuyy/ui` among workspace packages; no `apps/*` or `services/*` imports anywhere in your diff.
8. (If buildable) `pnpm --filter @letbuyy/developer-portal build` ✅; optionally capture screenshots at 320/768/1280 of `/reference`, `/oauth`, `/webhooks`, `/sdks`.

## 7) DELIVERABLES
- The code changes (scoped).
- `apps/developer-portal/CODEX_DEVELOPER_APP_FOUNDATION_LEDGER.md` (100-row status table).
- `apps/developer-portal/HANDOFF_TO_BACKEND.md` (contracts the parallel task must build).
- A PR description summarizing: counts of DONE / PARTIAL / SKIPPED-by-category, the green-gate evidence, the zero-undefined-CSS grep, and the redirect map.

## 8) EXECUTION DISCIPLINE
Work WS-0→WS-9 in order, committing per workstream. If any step would force you outside §1 ownership or require human approval, **log it and continue** — do not block the pass. Optimize the whole foundation, not any single feature.

— END OF CODEX MISSION —
