# CODEX PARALLEL STREAMS — LetBuyy 4‑Instance 24/7 Playbook

**Purpose:** Run **4 Codex instances simultaneously, 24h+**, each owning a **disjoint set of folders** so no two agents ever edit the same file. This is the command center: ownership boundaries, the collision‑avoidance protocol, the shared operating contract, and **4 paste‑ready launch prompts**.

> **Why your original A–H split would collide:** your Stream B (Polaris), Stream C (Theme Editor), and Stream D (Productivity) all physically live inside **`apps/merchant-control-plane/src`** and the shared **`packages/typescript/ui`** package. Two autonomous agents editing the same `globals.css`, `layout.tsx`, `Sidebar.tsx`, or `@letbuyy/ui` component = guaranteed merge conflicts and "both correct, neither compiles." The partition below fixes that by giving each app/package **exactly one owner**.

---

## 0. THE FOUR STREAMS (disjoint ownership)

| Stream | Codex # | OWNS (only these paths) | Goal | Mission detail | Priority |
|---|---|---|---|---|---|
| **A — Production & Platform** | 1 | `database/**` · `services/**` · `packages/*-core/**` · `packages/infrastructure/**` · `scripts/staging/**` · `supabase/**` | Fresh DB (baseline), staging E2E, COD, GST, Cashfree/UPI | `CODEX_PRODUCTION_READINESS_MISSION.md` | **1 (now)** |
| **B — Design System** | 2 | `packages/typescript/ui/**` **only** | Tokens + ~20 components + Storybook + design‑system docs | This file §B + `CODEX_SHOPIFY_UX_MISSION.md` §3 | **1 (now)** |
| **C — Merchant Admin Experience** | 3 | `apps/merchant-control-plane/**` **only** | Layout grammar, feedback, empty states, nav, home, **theme editor (flagship)**, **productivity** | `CODEX_SHOPIFY_UX_MISSION.md` + `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` | **1–2** |
| **D — Marketplaces Experience** | 4 | `apps/theme-marketplace/**` + `apps/app-marketplace/**` **only** | Theme cards/filters/preview/ratings + app cards/badges/consent/permissions | This file §D + the audit (areas 5,6,9,10) | **2–3** |

**These four owned sets are pairwise disjoint — no shared file.** A is backend; B is one package; C is one app; D is two isolated apps. They can all run at once.

**What's deliberately NOT a separate stream (and why):** Theme Editor and Productivity are *inside* `apps/merchant-control-plane`, so they belong to **Stream C** (one owner) — they cannot be separate agents without colliding. Developer Platform (`developers.letbuyy.store`) + Docs are **Priority 4**, launched after these four stabilize (see §6).

---

## 1. ★ COLLISION‑AVOIDANCE PROTOCOL (read this twice)

1. **One owner per path. Period.** Each stream edits **only** its owned paths (§0). Every other stream's paths are on that stream's DO‑NOT‑TOUCH list.
2. **Run each stream in its own git worktree + branch.** This is the single most important rule — it eliminates *all* collisions, even on shared files:
   ```
   git worktree add ../letbuyy-streamA stream/A-production
   git worktree add ../letbuyy-streamB stream/B-designsystem
   git worktree add ../letbuyy-streamC stream/C-admin
   git worktree add ../letbuyy-streamD stream/D-marketplaces
   ```
   Each Codex instance runs in its own worktree on its own branch. **You (human) merge the branches sequentially** (recommended order: A → B → C → D). No agent ever sees another agent's uncommitted edits.
3. **Separate ledgers — no ledger collision.** Each stream writes its OWN ledger: `CODEX_STREAM_A_LEDGER.md`, `CODEX_STREAM_B_LEDGER.md`, `CODEX_STREAM_C_LEDGER.md`, `CODEX_STREAM_D_LEDGER.md`. Never write to another stream's ledger.
4. **The shared‑file rule.** Root configs (`package.json`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig*.json`) and `docs/governance/**` are **shared**. Streams must NOT edit them except: a stream MAY edit the `package.json` *inside its owned folder* (e.g. B edits `packages/typescript/ui/package.json`, C edits `apps/merchant-control-plane/package.json`). If a change to a **root** file or the **lockfile** is unavoidable, **log it as `[NEEDS HUMAN MERGE]`** in the stream ledger and let the human reconcile at merge time — do not fight over the lockfile. (Worktrees make this safe: each branch carries its own lockfile delta; the human resolves on merge.)
5. **★ Stream B is ADDITIVE‑ONLY.** B may add components/tokens to `@letbuyy/ui` but must **never break or rename an existing export** — because C and D import from it live. New API only; deprecate, never delete, during the parallel window.
6. **★ Consumers (C, D) never edit B.** C and D **import** from `@letbuyy/ui` (read‑only). If a needed component doesn't exist in B yet, the consumer builds a **temporary local component** inside its own app (`apps/<app>/src/components/_local-ui/`) and logs `[CONSOLIDATE → @letbuyy/ui]` for a later swap. This keeps consumers unblocked without touching B's folder.
7. **Each stream keeps the whole repo green from its branch.** Every stream runs `pnpm run validate:governance` (128/128) + `typecheck` + `lint` + `build` before each commit on its branch. A stream is responsible for not red‑lining the build *from its own branch*.

---

## 2. SHARED OPERATING CONTRACT (applies to all 4 streams)

1. **Continuous & autonomous.** Finish a task → update your stream ledger → next unblocked task. Never stop while unblocked work remains. Never pause to ask.
2. **The Green Law.** Tree green after every commit on your branch; full `validate:governance` (128/128) at every phase gate. Can't go green in 3 attempts → revert, log `BLOCKED`, move on.
3. **Human‑/Backend‑skip ledger.** Anything needing a human (live keys, prod DB, design assets you can't generate, brand/copy decisions) or **another stream's data/folder** → append to your stream ledger under `## SKIPPED — NEEDS HUMAN / OTHER‑STREAM` with the exact requirement, then continue. (E.g. Stream C needing a new gateway field → SKIP, it's Stream A's territory.)
4. **No fabrication.** Every `DONE` needs evidence (command + result; UI streams also need a **before/after screenshot**).
5. **Anti‑thrash.** Max 3 attempts per task → `BLOCKED` + diagnosis → next.
6. **Small reversible commits.** One unit (component / page / migration) per commit.
7. **Reasoning:** `xhigh` for architecture/design‑system/theme‑editor; `medium` for mechanical work.
8. **UI streams (B, C, D) additionally obey:** the **No‑Architecture Law** (never edit backend/contracts/db/governance — see each stream's DO‑NOT‑TOUCH), the **Visual Proof Law** (before/after screenshots via Storybook/component proof during development, then staging preview proof after deploy), the **One‑Design‑System Law** (compose from `@letbuyy/ui`; no new ad‑hoc CSS; kill bespoke CSS as you migrate), and the **Accessibility baseline** (keyboard, focus, ARIA, AA contrast; `ConfirmDialog` on destructive actions). Keep the build network‑free (self‑hosted fonts; never reintroduce `next/font/google`).

---

## STREAM A — Production & Platform (Codex #1)

**Owns:** `database/**`, `services/**`, `packages/*-core/**`, `packages/infrastructure/**`, `scripts/staging/**`, `supabase/**`. **Ledger:** `CODEX_STREAM_A_LEDGER.md`.
**DO‑NOT‑TOUCH:** `apps/**` (any app), `packages/typescript/**` (the design system + clients). This stream is **backend only** — the mirror image of the UI streams.
**Goal:** Fresh‑DB provisioning (baseline squash), staging proof, real J1‑J5 E2E, **COD** + **GST** real, one real online provider (**Cashfree or UPI**).
**Detail:** execute `CODEX_PRODUCTION_READINESS_MISSION.md` exactly (Phases P0→P4) — it already encodes this. Add the ownership header below.
**Gate:** fresh DB provisions; J1‑J5 green on staging Postgres; governance 128/128.

**Launch prompt (Codex #1):**
```
You are Stream A in CODEX_PARALLEL_STREAMS.md. Work ONLY in git worktree branch stream/A-production.
Read CODEX_PARALLEL_STREAMS.md (§1, §2, Stream A) and CODEX_PRODUCTION_READINESS_MISSION.md in full.
OWN ONLY: database/**, services/**, packages/*-core/**, packages/infrastructure/**, scripts/staging/**, supabase/**.
NEVER edit apps/** or packages/typescript/** (other streams own those) — if you need a UI change, SKIP it.
Execute CODEX_PRODUCTION_READINESS_MISSION.md P0→P4 continuously and autonomously.
Keep all 128 validators green per commit; never touch the lockfile/root configs without logging
[NEEDS HUMAN MERGE]. Maintain CODEX_STREAM_A_LEDGER.md. Begin with P0.1 now.
```

---

## STREAM B — Design System `@letbuyy/ui` (Codex #2)

**Owns:** `packages/typescript/ui/**` **only**. **Ledger:** `CODEX_STREAM_B_LEDGER.md`.
**DO‑NOT‑TOUCH:** everything else — all `apps/**`, all `services/**`, all other `packages/**`, `database/**`, governance. B builds the library in isolation; it does **not** migrate any app (that's C/D's job).
**Goal:** Turn the 5‑primitive `@letbuyy/ui` into a real, token‑driven, accessible, Storybook‑documented design system — the foundation C and D consume.
**Phases:**
- **B0** Inventory current `@letbuyy/ui` (button/input/data‑table/icons/fonts); set up **Storybook** in the package; baseline screenshots of existing components. _Gate: Storybook builds._
- **B1 Tokens** (single source): color (semantic), typography scale, spacing (4·8·12·16·24·32·48), radius, shadow, motion — as CSS vars + TS tokens. _Gate: tokens exported._
- **B2 Components** (each token‑driven, accessible, responsive, with a Storybook story + visual screenshot): `Page`, `PageHeader`, `Card`, `Section`, `Badge`, `Banner`, `Toast`(+provider), `Skeleton`, `EmptyState`, `Modal`, `ConfirmDialog`, `Tabs`, `Select`/`Combobox`, `Tooltip`, `MetricCard`, `Avatar`, `Pagination`, `IndexTable`, `SaveBar`, `CommandPalette`; upgrade `Button`/`Input`/`DataTable` to tokens. **Additive‑only — never break existing exports.** _Gate: all render in Storybook; typecheck/lint green._
- **B3 Docs** (absorbs the user's "Design System Documentation" stream): component catalog, design‑token reference, usage rules, accessibility rules — in Storybook (MDX) under the package. _Gate: docs complete._
- **B4** Publish a stable component API list to `CODEX_STREAM_B_LEDGER.md` so C/D know exactly what's available. _Gate: API list published._

**Launch prompt (Codex #2):**
```
You are Stream B in CODEX_PARALLEL_STREAMS.md. Work ONLY in git worktree branch stream/B-designsystem.
Read CODEX_PARALLEL_STREAMS.md (§1, §2, Stream B), CODEX_SHOPIFY_UX_MISSION.md §3 (design system spec),
and LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md.
OWN ONLY: packages/typescript/ui/**. NEVER edit any app or other package.
Build tokens first, then every component in §3 (token-driven, accessible, responsive), each with a
Storybook story + screenshot, then docs. ADDITIVE-ONLY: never break or rename an existing @letbuyy/ui
export (C and D import it live). Keep all 128 validators green per commit. Maintain CODEX_STREAM_B_LEDGER.md.
Begin with B0 (inventory + Storybook setup) now.
```

---

## STREAM C — Merchant Admin Experience (Codex #3)

**Owns:** `apps/merchant-control-plane/**` **only**. **Ledger:** `CODEX_STREAM_C_LEDGER.md`.
**DO‑NOT‑TOUCH:** `packages/typescript/ui/**` (import only — Stream B owns it), all other apps, all backend/contracts/db/governance. If `@letbuyy/ui` lacks a component, build a temporary one under `apps/merchant-control-plane/src/components/_local-ui/` and log `[CONSOLIDATE → @letbuyy/ui]`.
**Goal:** The full Shopify‑grade admin: one layout grammar, feedback everywhere, designed empty states, grouped navigation, guided home, the **flagship theme editor**, and **merchant productivity**.
**Phases (from `CODEX_SHOPIFY_UX_MISSION.md`, scoped to this app):**
- **C0** Baseline inventory + before screenshots (Dashboard, Products, Orders, Customers, Themes, Apps, Analytics, Settings).
- **C2 Layout grammar** — migrate all 8 major pages onto `Page→PageHeader→Card→Section`; delete bespoke layout/CSS from `globals.css` as you go.
- **C3 Feedback** — toasts on every mutation, skeletons on every load, sticky `SaveBar`, `ConfirmDialog` on destructive actions.
- **C4 Empty states** — every admin list (Products/Orders/Customers/Themes/Apps/Discounts/Blogs/Collections).
- **C5 Navigation** — ~40 flat items → ~9 grouped sections + sticky top bar + ⌘K palette + shortcuts.
- **C6 Home** — setup‑guide checklist (from real store state) + metric cards + recent activity.
- **C7 Theme Editor (FLAGSHIP)** — theme library (draft vs live), **live preview iframe** beside the schema form, section tree (drag/add/remove over existing `templates/*.json`), visual section selection (postMessage). UI/workflow only; if a storefront preview endpoint is missing → `[SKIP — NEEDS BACKEND]` and preview against published settings.
- **C9 Productivity** — `IndexTable` for Products/Orders/Customers (bulk actions over existing endpoints, saved views, filter chips, inline edit), ⌘K actions.
- **C10 Mobile** — responsive admin (nav drawer, bottom sheets, tables→cards) on 375px.
- **C11 Polish** — typography/spacing/motion/icon/a11y passes; delete remaining bespoke `globals.css`.
**Gate:** every admin screen uses the grammar + feedback + empty states; theme editor live preview works; before/after screenshots; governance 128/128; app still functions.

**Launch prompt (Codex #3):**
```
You are Stream C in CODEX_PARALLEL_STREAMS.md. Work ONLY in git worktree branch stream/C-admin.
Read CODEX_PARALLEL_STREAMS.md (§1, §2, Stream C), CODEX_SHOPIFY_UX_MISSION.md, and
LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md.
OWN ONLY: apps/merchant-control-plane/**. IMPORT @letbuyy/ui but NEVER edit packages/typescript/ui
(Stream B owns it) — if a component is missing, build it under src/components/_local-ui/ and log
[CONSOLIDATE → @letbuyy/ui]. NEVER edit backend/contracts/db/governance or other apps; if a UX feature
needs new backend data, ship a placeholder and log [SKIP — NEEDS BACKEND].
Execute the merchant-admin phases C0,C2,C3,C4,C5,C6,C7,C9,C10,C11. Visual proof (before/after screenshots)
for every change. Keep all 128 validators green per commit. Maintain CODEX_STREAM_C_LEDGER.md.
Begin with C0 (inventory + before screenshots) now.
```

---

## STREAM D — Marketplaces Experience (Codex #4)

**Owns:** `apps/theme-marketplace/**` + `apps/app-marketplace/**` **only**. **Ledger:** `CODEX_STREAM_D_LEDGER.md`.
**DO‑NOT‑TOUCH:** `packages/typescript/ui/**` (import only), `apps/merchant-control-plane/**` and all other apps, backend/contracts/db/governance. Same `_local-ui/` fallback + `[CONSOLIDATE]` rule as C.
**Goal:** Make both marketplaces feel premium and trustworthy.
**Phases:**
- **D0** Baseline inventory + before screenshots (theme list/detail, app list/detail, install/consent).
- **D1 Theme Marketplace** (`apps/theme-marketplace`): rich 16:9 preview cards, filter rail (industry/layout/price), theme detail page (screenshot carousel + ratings + "Preview in your store"), premium browsing; empty/loading/feedback states via `@letbuyy/ui`.
- **D2 App Marketplace** (`apps/app-marketplace`): app cards (icon, rating stars, category, pricing), detail page (screenshot carousel, reviews, **permissions list**, "Built for LetBuyy" badge from the existing quality‑gate result), and a confident **install flow** (consent screen rendering declared scopes → success state + toast → auto‑launch embed).
- **D3 Polish** — layout grammar, empty states, skeletons, toasts, a11y, mobile — consistent across both apps.
**Gate:** both marketplaces redesigned; install/consent flow polished; before/after screenshots; governance 128/128; both apps function.

**Launch prompt (Codex #4):**
```
You are Stream D in CODEX_PARALLEL_STREAMS.md. Work ONLY in git worktree branch stream/D-marketplaces.
Read CODEX_PARALLEL_STREAMS.md (§1, §2, Stream D) and LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md (areas 5,6,9,10).
OWN ONLY: apps/theme-marketplace/** and apps/app-marketplace/**. IMPORT @letbuyy/ui but NEVER edit
packages/typescript/ui (Stream B owns it) — missing component? build under src/components/_local-ui/ and
log [CONSOLIDATE → @letbuyy/ui]. NEVER edit backend/contracts/db/governance, merchant-control-plane, or
other apps; UX feature needs new backend data → placeholder + [SKIP — NEEDS BACKEND].
Execute D0→D3 with before/after screenshots for every change. Keep all 128 validators green per commit.
Maintain CODEX_STREAM_D_LEDGER.md. Begin with D0 (inventory + before screenshots) now.
```

---

## 6. SEQUENCING & THE 5TH STREAM (your moat)

**Launch order on your machine:**
- **Now (Priority 1):** Stream **A** (backend/provisioning) + Stream **B** (design system) — these have the least overlap with anything and unblock the rest. A produces the real stack; B produces the components C/D consume.
- **+12–24h (Priority 2):** add Stream **C** (admin) + Stream **D** (marketplaces) once B has shipped the core components (`Card`, `Page`, `Toast`, `Badge`, `EmptyState`, `IndexTable`). They consume B read‑only and own different apps, so they're collision‑free with each other and with A/B.

**Merge cadence (human):** merge `stream/A` first (backend baseline), then `stream/B` (design system), then `stream/C`, then `stream/D`. Run governance + build after each merge.

**The 5th stream — your real moat (Priority 4, after these four stabilize):** stand up **`developers.letbuyy.store`** + **`docs.letbuyy.store`** — App SDK, Theme SDK, OAuth docs, Webhook docs, API reference, quick‑start, CLI docs. You're right: *a marketplace without developers is an organized empty shelf.* This is a **new app** (`apps/developer-portal`) so it gets its own disjoint owner — but it depends on Stream A's SDK/API surface being real, which is why it comes after. When ready, clone this playbook's pattern: own only `apps/developer-portal/**`, consume `@letbuyy/ui`, own ledger, own worktree.

---

## 7. ONE‑LINE NORTH STAR

Four agents, four disjoint folders, four branches, four ledgers — backend hardening, a design system, the admin, and the marketplaces all advancing at once, and not one of them able to touch another's files.
