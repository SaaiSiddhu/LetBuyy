# CODEX SHOPIFY EXPERIENCE TRANSFORMATION MISSION — LetBuyy Phase 4 (Merchant Experience)

**Driver:** GPT‑5.5 in Codex. Reasoning: `xhigh` for the design‑system + theme‑editor work, `medium` for page migrations and mechanical edits.
**Mode:** Continuous, autonomous, local, 24h+. Never stop while unblocked work remains.
**Predecessors (done/expected):** `CODEX_FOUNDATION_MISSION.md`, `CODEX_FEDERATION_MISSION.md`, `CODEX_PRODUCTION_READINESS_MISSION.md`. Authoritative UX source of truth: **`LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`** (the 26‑area audit, Top‑100, and the 12‑item "80% set"). This mission executes that audit.
**Governance posture (carried forward):** KEEP ALL 128 VALIDATORS GREEN at every commit. Never delete/weaken a validator; update governance memory in lockstep only when legitimately required. Anything needing a human credential/policy decision → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE

Make LetBuyy's **merchant‑facing experience feel comparable to Shopify** — unified design language, one layout grammar, relentless feedback, designed empty states, intuitive navigation, a flagship theme editor, trustworthy marketplaces, and real merchant productivity — **without changing architecture, backend, platform services, contracts, or the database.** This is a **frontend + workflow** mission only. Shopify does not feel better because of its backend; it feels better because of its product layer. Build that product layer on top of LetBuyy's already‑correct platform.

**SUCCESS CRITERIA — COMPLETE only when all are proven with recorded evidence (commands + before/after screenshots):**

1. Every merchant‑facing admin screen uses **one unified design language** (`@letbuyy/ui`), no ad‑hoc styling where a component exists.
2. Every admin page follows the **same layout grammar** (`Page` → `PageHeader` → `Card` → `Section`).
3. Every form has proper **save states** (sticky save bar: Unsaved / Saving / Saved).
4. Every list/page has a proper **empty state** (no blank pages anywhere).
5. Every major workflow feels **guided** (setup guide, smart defaults, contextual next actions).
6. The **Theme Editor is a flagship experience** (live preview canvas + section tree + visual selection).
7. The **Apps Marketplace feels trustworthy** (ratings, screenshots, pricing, badges, permissions, confident install).
8. The **Theme Marketplace feels premium** (rich previews, filters, draft library, preview‑in‑store).
9. **Navigation is intuitive** (~9 grouped items + global ⌘K search + shortcuts), not ~40 flat items.
10. **Merchant productivity** improves (IndexTable, bulk actions, saved views, inline edit, command palette).
11. **No governance regressions** (128/128). 12. **No architectural regressions** (zero edits under the DO‑NOT‑TOUCH list). 13. **All 7 apps continue functioning.** 14. **All tests stay green.**
15. `CODEX_SHOPIFY_UX_LEDGER.md` records every task DONE (with evidence) or `[SKIP — NEEDS HUMAN]`; `CODEX_SHOPIFY_EXPERIENCE_STATUS.md` summarizes with before/after screenshots.

---

## 1. OPERATING CONTRACT (how you must run)

1. **Continuous execution.** Finish a task → update ledger → start the next unblocked task. Never pause to ask. Never end while unblocked work remains.
2. **The Green Law.** Tree green after every commit: area validators + `pnpm turbo typecheck` + `pnpm lint` each increment; full `pnpm run validate:governance` at every phase gate. Never commit red. Can't go green in 3 attempts → revert, log `BLOCKED` + diagnosis, move on.
3. **★ The No‑Architecture Law (paramount).** Touch ONLY presentation: `apps/*/src/**` (UI/pages/components) and `packages/typescript/ui/**` (`@letbuyy/ui`). You may **consume** `@letbuyy/api-client` and `@letbuyy/shared-types` but **never modify** them. See §2 for the DO‑NOT‑TOUCH list. If a UX feature needs data the gateway doesn't already return, do NOT add backend logic — build the UI with a graceful placeholder/empty state and log `[SKIP — NEEDS BACKEND]` with the exact endpoint/field required.
4. **★ The Visual Proof Law.** Every UX change is proven with **before/after screenshots**. During development use Storybook + Playwright component/page screenshots; after push, prove full flows through staging preview deployments against staging APIs. If staging is not credentialed or deployed, mark only the full live journey screenshots as `[SKIP — NEEDS HUMAN: staging deploy + secrets]`. Never claim a visual change without a screenshot.
5. **★ The One‑Design‑System Law.** Every screen composes from `@letbuyy/ui`. No new ad‑hoc CSS where a component/token exists. Tokenize and **incrementally delete the 9,248‑line `apps/merchant-control-plane/src/app/globals.css`** as pages migrate. Do not introduce a second spacing/color system.
6. **Small reversible increments.** One component or one page → validate → screenshot → commit. Hundreds of small green commits over one big red one.
7. **Human‑skip ledger (mark and continue).** Anything needing a human (new backend data, live keys, design assets/illustrations you cannot generate, brand decisions, copy approval) → append to `CODEX_SHOPIFY_UX_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with the exact requirement, then continue.
8. **Anti‑ceremony.** No new validators, no new services, no business‑logic API routes, no new top‑level docs beyond the two ledger/status files. This mission ADDS UI and REMOVES bespoke CSS — net surface should not balloon.
9. **No fabrication.** Every `DONE` needs command + result + screenshot evidence. Never fake a screenshot, never claim a page migrated that still uses bespoke layout, never mark an empty state done that's still blank.
10. **Anti‑thrash.** Max 3 attempts per task → log `BLOCKED` + diagnosis → next task.
11. **Accessibility baseline (non‑negotiable for new components).** Keyboard navigable, visible focus, ARIA roles/labels, WCAG‑AA contrast. Destructive actions gated by `ConfirmDialog`.
12. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`. Keep the build network‑free (self‑hosted fonts — do not reintroduce `next/font/google`).

---

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH (zero edits)

The following are **off‑limits**. Editing any of them is an automatic failure of this mission:

- `services/**` (api‑gateway, webhook‑service, queue‑workers) — backend.
- `packages/*-core/**` (commerce, checkout, auth, tenant, event, theme‑engine, cms, notification, search, billing, app‑engine, etc.) — domain logic.
- `packages/shared-types/**`, `packages/typescript/api-client/**`, `packages/typescript/api-types/**` — contracts (consume only).
- `database/**` — migrations/schema.
- `scripts/validators/**`, `docs/governance/**` — governance (read‑only; never weaken).
- Any auth/session/RBAC/event/webhook/OAuth/billing logic.

**Allowed:** `packages/typescript/ui/**` (build the design system) and `apps/*/src/**` (compose UI, migrate pages, wire existing `api-client` calls into new components). Routing/presentation changes within apps are fine; data/business logic changes are not.

> If you believe a UX goal truly requires a backend change, it is out of scope: build the best UI you can against existing data and `[SKIP — NEEDS BACKEND]` the rest.

---

## 3. THE DESIGN SYSTEM SPEC (`@letbuyy/ui`) — the foundation

Today `@letbuyy/ui` has **5 primitives** (`button`, `input`, `data-table`) + `icons` + `fonts`. Expand it into a real, token‑driven library.

**Design tokens (build first, single source):** color (semantic: bg/surface/border/text/primary/critical/warning/success/subdued), typography (a type scale: display/heading/body/caption with line‑heights), spacing (4·8·12·16·24·32·48), radius (sm/md/lg/full), shadow (sm/md/lg), motion (durations + easing). Expose as CSS variables + TS tokens from `@letbuyy/ui`. **All components consume tokens; no hard‑coded values.**

**Components to build (token‑driven, accessible, responsive, Storybook‑documented):**
`Page`, `PageHeader` (title · breadcrumb · primary action · secondary actions), `Card`, `Section`, `Badge` (status variants), `Banner` (info/warning/critical/success), `Toast` (+ provider), `Skeleton` (text/card/table variants), `EmptyState` (icon/illustration · title · body · primary + secondary action), `Modal`, `ConfirmDialog`, `Tabs`, `Select`/`Combobox`, `Tooltip`, `MetricCard` (label · value · delta · sparkline), `Avatar`, `Pagination`, `IndexTable` (sortable · bulk‑select · filter chips · saved‑view tabs · row actions), plus `SaveBar` (sticky unsaved/saving/saved), `CommandPalette` (⌘K), and the existing `Button`/`Input`/`DataTable` upgraded to tokens.

**Set up Storybook** in `packages/typescript/ui` if absent (dev‑tooling only) — it is the component documentation + visual‑proof surface.

---

## 4. LEDGER — create and maintain `CODEX_SHOPIFY_UX_LEDGER.md`

```
# CODEX SHOPIFY UX LEDGER — started <ISO ts>

## BASELINE (UX0)
- screens inventoried · components · tokens · navigation · workflows
- before-screenshots: <paths> (real stack | storybook)

## PROGRESS LOG (newest first)
- <ts> [UX#] <task> — DONE — evidence: <cmd> -> <result> — screenshot <path> — commit <sha>
- <ts> [UX#] <task> — BLOCKED — tried A/B/C — error — hypothesis

## SKIPPED — NEEDS HUMAN / BACKEND   (append-only)
- [SKIP] <task> — requires <data/endpoint/asset/decision> — unblocks <tasks>

## VISUAL LEDGER   (append-only, before/after)
- <ts> <screen> — before <path> | after <path>

## VALIDATOR LEDGER   (append-only)
- <ts> validate:governance -> 128/128 PASS after <sha>
```

---

## 5. THE WORK — UX0 → UX11 (in order; don't start a phase until the prior gate is green)

### UX0 — Baseline Audit (understand before changing)
- **UX0.1** Create `CODEX_SHOPIFY_UX_LEDGER.md`. Inventory current screens, components, design tokens (note: none — 9,248‑line `globals.css`), navigation (~40 flat sidebar items), and key workflows. _DoD: inventory recorded._
- **UX0.2 Before‑State Visual Inventory.** Boot the stack (real if available, else Storybook/dev), and capture **before screenshots** of: Dashboard, Products, Orders, Customers, Themes, Apps, Analytics, Settings. _DoD: 8 before‑screenshots in the VISUAL LEDGER (live‑stack or dev‑server)._
- **GATE UX0:** visual inventory complete; governance 128/128.

### UX1 — LetBuyy Design System Foundation (`@letbuyy/ui`)
- **UX1.1 Tokens.** Build the token system (§3) as CSS vars + TS tokens. _DoD: tokens exported; one source._
- **UX1.2 Components.** Build every component in §3, token‑driven, accessible, responsive, each with a Storybook story. Upgrade existing `Button`/`Input`/`DataTable` to tokens. _DoD: all components render in Storybook; typecheck/lint green._
- **UX1.3 Guardrail.** Ensure no component hard‑codes color/spacing; document usage in Storybook. _DoD: components documented._
- **GATE UX1:** all components built + documented; Storybook builds; governance 128/128; build network‑free.

### UX2 — Layout Grammar (one page skeleton everywhere)
- **UX2.1 Standard Page Template.** Create the canonical `Page → PageHeader → Card → Section` template. _DoD: template + Storybook example._
- **UX2.2 Migrate major admin pages** in `merchant-control-plane` onto the template, deleting their bespoke layout/CSS as you go: Dashboard, Products, Orders, Customers, Themes/Online‑Store, Apps, Analytics, Settings. Screenshot each before/after. _DoD: each page uses the grammar; bespoke `globals.css` shrinks; before/after recorded._
- **GATE UX2:** all 8 major pages migrated; `globals.css` materially reduced; all routes still function; governance 128/128.

### UX3 — Feedback System
- **UX3.1 Toasts** (success/error/warning/info) fired on every create/update/delete across the admin. _DoD: every mutation path shows a toast._
- **UX3.2 Skeletons** on every list, card, form, and table during load. _DoD: no blank flashes; skeletons everywhere._
- **UX3.3 Sticky Save Bar** (Unsaved/Saving/Saved) on every form. _DoD: all forms use it._
- **UX3.4 Confirm Dialogs** gate delete/archive/dangerous actions. _DoD: destructive actions confirmed._
- **GATE UX3:** every mutation provides feedback; before/after screenshots; governance 128/128.

### UX4 — Empty States (no blank pages anywhere)
- **UX4.1** Apply the `EmptyState` component to: Products, Orders, Customers, Themes, Apps, Discounts/Coupons, Blogs, Collections (and any other empty list). Each: icon/illustration + headline + description + primary action (+ secondary). _DoD: 100% empty‑state coverage; before/after screenshots of empty lists._
- **GATE UX4:** zero blank pages; governance 128/128.

### UX5 — Navigation Restructure
- **UX5.1** Replace the ~40 flat sidebar items with ~9 grouped sections: **Home, Orders, Products, Customers, Marketing, Content, Online Store, Apps, Analytics, Settings** (collapsible sub‑items, section icons via the centralized Lucide layer). Map all existing routes into groups — no route lost. _DoD: grouped nav; every old route reachable._
- **UX5.2** Add a sticky top bar + **⌘K Command Palette** (search + quick actions over existing `api-client` list/search endpoints) + keyboard shortcuts (g+p, g+o, n…). _DoD: palette opens, searches, navigates._
- **GATE UX5:** simplified nav + palette; before/after screenshots; governance 128/128.

### UX6 — Shopify Home Experience
- **UX6.1 Setup Guide** checklist card (Add product · Customize theme · Set up payment · Connect domain · Launch) driven by existing store state; progress + per‑item CTA + completion. _DoD: checklist reflects real state._
- **UX6.2 Metric Cards** (Revenue, Orders, Visitors, Conversion) via `MetricCard` over existing analytics data. _DoD: metrics render._
- **UX6.3 Recent Activity** card. _DoD: recent orders/events listed._
- **GATE UX6:** dashboard redesigned + actionable; before/after; governance 128/128.

### UX7 — Shopify Theme Experience (FLAGSHIP — highest priority)
- **UX7.1 Theme Library** page: Current theme card + Draft themes grid; actions Publish / Preview / Duplicate. Default installs as draft (UI/workflow over existing `theme_releases` data; no backend change). _DoD: library renders; draft/live distinction visible._
- **UX7.2 Live Preview Canvas.** Beside the existing schema‑driven settings form, render an **iframe preview** of the storefront using the draft `settings_data` (use/extend a storefront *preview route* that reads draft settings via existing gateway endpoints — presentational only; if a new endpoint is genuinely required, `[SKIP — NEEDS BACKEND]` and ship the preview against published settings). Device toggle: Desktop / Tablet / Mobile. _DoD: edits reflect in the preview._
- **UX7.3 Section Tree.** Left rail listing template sections with **drag‑drop reorder + add/remove** wired to the existing `templates/*.json` section array. _DoD: reorder/add/remove works and persists via existing endpoints._
- **UX7.4 Visual Selection.** Click a section in the preview → highlight + open its settings in the rail (postMessage between iframe and editor). _DoD: canvas↔rail selection sync._
- **GATE UX7:** live preview operational; section manipulation works; before/after screenshots + a short screen recording if possible; governance 128/128.

### UX8 — Shopify App Experience
- **UX8.1 Apps Marketplace redesign:** app cards with icon, rating stars, category, pricing; detail page with screenshot carousel, reviews, **permissions list**, and a "Built for LetBuyy" badge (from the existing quality‑gate result). _DoD: redesigned listing + detail._
- **UX8.2 Install flow:** a clear **consent screen** (scopes rendered from the app's declared permissions), success state + toast, and **auto‑launch** of the embedded app. _DoD: consent → success → embed._
- **GATE UX8:** marketplace + install redesigned; before/after; governance 128/128.

### UX9 — Shopify Productivity
- **UX9.1 IndexTable** adoption for Products, Orders, Customers: bulk‑select + **bulk actions** (over existing gateway endpoints), **saved views** (tabs), **filter chips**, **inline editing** where safe, column sort. _DoD: lists upgraded._
- **UX9.2 Command‑palette actions** (create product, find order…) + keyboard shortcuts. _DoD: actions work from ⌘K._
- **GATE UX9:** product + order workflows upgraded; before/after; governance 128/128.

### UX10 — Mobile Experience
- **UX10.1** Responsive layout grammar (mobile nav drawer, bottom‑sheet actions, responsive tables→cards, responsive forms) baked into `@letbuyy/ui` and applied. _DoD: critical workflows (browse products, view/fulfil order, edit settings) usable on a 375px viewport — proven by mobile‑viewport Playwright screenshots._
- **GATE UX10:** critical workflows tested on mobile; screenshots; governance 128/128.

### UX11 — Visual Polish
- **UX11.1** Typography, spacing, motion, and icon passes (replace any remaining emoji/ad‑hoc SVG affordances with the centralized Lucide system); accessibility pass (focus order, ARIA, contrast); final consistency sweep deleting remaining bespoke `globals.css`. _DoD: consistency audit passes; minimal bespoke CSS remains._
- **GATE UX11 (FINAL):** design‑consistency audit passes; all §0 criteria proven with before/after screenshots; full typecheck/lint/build(no‑net)/test/governance 128/128 green; all 7 apps function.

---

## 6. FINAL REPORT — write `CODEX_SHOPIFY_EXPERIENCE_STATUS.md`

Include: per‑phase completion table; **before/after screenshots** for each major screen; the UX improvements delivered; a migration summary (pages migrated, components built, bespoke‑CSS lines removed); the full `SKIPPED — NEEDS HUMAN / BACKEND` list; and final gate results. Mark **COMPLETE only if** all phases pass, all tests green, governance 128/128, the experience is visibly transformed (before/after prove it), and **zero edits touched the DO‑NOT‑TOUCH list**. Otherwise `BLOCKED — AWAITING HUMAN` with exact gaps.

---

## 7. LAUNCH PROMPT (paste into Codex `/goal`)

```
Read CODEX_SHOPIFY_UX_MISSION.md and LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md in full.
Execute CODEX_SHOPIFY_UX_MISSION.md, Phases UX0→UX11, continuously and autonomously.

Hard rules (obey strictly):
- NO ARCHITECTURE CHANGES. Touch only apps/*/src/** and packages/typescript/ui/**. NEVER edit
  services/**, packages/*-core/**, shared-types, api-client, database/**, or governance. If a UX
  feature needs new backend data, ship the UI with a graceful placeholder and log
  [SKIP — NEEDS BACKEND] with the exact endpoint/field. (See the DO-NOT-TOUCH list.)
- VISUAL PROOF: every UX change needs a before/after screenshot. Use Storybook + Playwright
  component/page screenshots during development; after push, prove full flows through staging
  preview deployments. If staging is unavailable, mark only full live journey screenshots
  [SKIP — NEEDS HUMAN: staging deploy + secrets]. Never claim a visual change without a screenshot.
- ONE DESIGN SYSTEM: compose every screen from @letbuyy/ui; build tokens first; no new ad-hoc CSS;
  incrementally delete the 9,248-line merchant globals.css as pages migrate.
- Keep all 128 validators green after every commit; full validate:governance at each gate.
- Keep the build network-free (self-hosted fonts; do NOT reintroduce next/font/google).
- Do NOT stop between tasks. Human/backend-gated items -> append to CODEX_SHOPIFY_UX_LEDGER.md under
  "SKIPPED — NEEDS HUMAN / BACKEND" with exact requirements, then continue.
- Small reversible commits (one component or one page each); max 3 attempts per task then log BLOCKED.
- Accessibility baseline on every new component (keyboard, focus, ARIA, AA contrast); ConfirmDialog
  on destructive actions. No fabrication: every DONE needs command + result + screenshot.
- xhigh reasoning for the design system + theme editor; medium for page migrations.

Maintain CODEX_SHOPIFY_UX_LEDGER.md from UX0.1. When the §0 criteria are proven with before/after
screenshots, write CODEX_SHOPIFY_EXPERIENCE_STATUS.md. Begin with UX0.1 now.
```

---

## 8. ONE‑LINE NORTH STAR

One design system, one page grammar, constant feedback, no blank pages, intuitive navigation, and a live theme editor — all built on the existing, untouched platform — is what turns "functional" into "feels like Shopify."
