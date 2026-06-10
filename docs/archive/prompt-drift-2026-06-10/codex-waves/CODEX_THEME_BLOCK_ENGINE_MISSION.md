# CODEX THEME BLOCK ENGINE MISSION — LetBuyy WS11 (Portable Sections & Blocks, exact‑Shopify)

**Driver:** Codex agent. Reasoning: `xhigh` throughout (this is the hardest architectural change in the program).
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `packages/theme-engine/**` + `apps/storefront-runtime/src/lib/theme-engine/**` + `apps/storefront-runtime/src/components/sections/**` + the theme routes in `services/api-gateway/src/routes/themes.ts` + `services/api-gateway/src/execution/theme-execution.adapter.ts` + `services/api-gateway/src/schemas/theme.schema.ts`. (This workstream is **backend + storefront** — it owns the theme engine end‑to‑end.)
**Dependencies:** WS7 (staging stack to render/prove against). **Predecessor:** WS7 staging proof ready.
**Source of truth:** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (Part 2). **Governance:** KEEP ALL 128 VALIDATORS GREEN; never break the `shared-types`/`api-client` theme contract other stages consume; migrations forward‑only & fresh‑replay‑safe; `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE
Replace the **"32 React sections compiled into one Next app"** model with an **exact‑Shopify portable theme engine**: a theme becomes a **versioned bundle of data + template files** (sections, blocks, templates, settings_schema, locales) that the storefront **interprets at render time** — so a third‑party designer can ship a **brand‑new section or block type with zero storefront code change or redeploy.** Implement the real **`LiquidRenderer`** behind the existing `ThemeRenderer` seam (Option A — literal Shopify), keep `JsonContractThemeRenderer` as the first‑party fast path during transition, and make **app blocks** (extension injection into themes) first‑class.

**SUCCESS CRITERIA (proven on staging, with evidence):**
1. A theme is a **portable bundle** — `layout/theme.liquid`, `templates/*.json`, `sections/*.liquid` (+ `{% schema %}`), `blocks/*.liquid`, `config/settings_schema.json`, `locales/*.json` — stored/served via `/v1/themes` (`theme_packages`/`theme_releases`).
2. **`LiquidRenderer` is real** (LiquidJS, server‑side, sandboxed): the storefront renders a page by interpreting the bundle, **not** by mapping to a fixed React registry.
3. **A new section/block type added as bundle files renders with ZERO storefront code change** (prove it: drop a new `sections/spotlight.liquid` into a theme, it appears — no `renderer-registry.tsx` edit, no redeploy).
4. The **block model** works: sections declare accepted block types; **theme blocks**, **section blocks**, and **app blocks** can be added/removed/reordered/configured (data‑driven).
5. **App blocks are first‑class:** an installed app injects a block into a section (the `app-block-slot.tsx` seed becomes a real extension point reading installed‑app block contributions).
6. **Interactivity preserved** via hydration islands (cart, search, add‑to‑cart) — small web components, not full‑page React.
7. **Themes are versioned + installable:** upload/validate/version/install/rollback a bundle; multi‑theme catalog works (≥2 distinct portable themes render correctly on staging).
8. Backward‑compatible: existing first‑party themes still render (JSON‑contract fast path) until migrated; **no storefront regression**; 128/128 governance, typecheck/build/tests green.
9. `CODEX_WS11_LEDGER.md` complete; `CODEX_WS11_STATUS.md` written.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next task. 2. **Green Law:** typecheck/lint/build + relevant validators per commit; full `validate:governance` (128/128) at each gate; 3 strikes → revert + BLOCKED → next. 3. **Contract stability:** the theme bundle contract in `shared-types`/`theme-engine` is consumed by WS2 (editor), WS3 (marketplace), WS8 (mobile) — evolve it **additively**; never break it. 4. **Real proof on staging:** render real themes against the staging storefront; before/after screenshots; the "new section with zero code change" test is mandatory evidence. 5. **Security:** LiquidJS runs **sandboxed** (no arbitrary code, no filesystem/network from templates); sanitize settings; app‑block content is sanitized. 6. SKIP‑and‑continue; no fabrication; small reversible commits.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
Non‑theme backend domains (`commerce/checkout/auth/billing/...-core` except where the theme engine legitimately reads them) · `database/**` except a forward‑only theme migration if truly required · other apps' UI (`merchant-control-plane`, marketplaces — they consume via contract/handoff) · governance validators · `packages/shared-types` except **additive** theme‑contract fields.

## 3. THE TARGET ENGINE (build THIS)
```
theme bundle (portable, versioned in theme_packages/theme_releases)
  layout/theme.liquid                 outer shell
  templates/{index,product,collection,page}.json   sections + their settings per page
  sections/<name>.liquid + {% schema %}             AUTHORABLE section types (settings + accepted blocks)
  blocks/<name>.liquid                              AUTHORABLE reusable theme blocks
  config/settings_schema.json                       generates the editor (WS2)
  locales/*.json                                    i18n
          │
          ▼  storefront-runtime
  ThemeRenderer (seam exists)
    ├─ JsonContractThemeRenderer  (first-party fast path, during transition)
    └─ LiquidRenderer (LiquidJS, sandboxed)  ← interpret bundle → HTML  [BUILD THIS]
          │  + hydration islands (cart/search add-to-cart as web components)
          ▼
  page = layout → template → sections → ordered blocks (theme/section/APP) → HTML
```

## 4. THE WORK — T0 → T7
- **T0 Baseline + bundle contract.** `CODEX_WS11_LEDGER.md`; finalize the portable bundle zod contract in `packages/theme-engine/src/theme-bundle.ts` (layout/templates/sections/blocks/settings_schema/locales + section `{% schema %}` shape: `settings`, `blocks` (accepted types), `presets`). Add a fixture portable theme. **Effort:** M. **Priority:** P0.
- **T1 LiquidRenderer (real).** Implement `LiquidRenderer` with **LiquidJS** server‑side in `storefront-runtime`, sandboxed (custom filesystem = the bundle only; no network; safe filters). Wire it behind the existing `ThemeRenderer` selector (`engine === 'liquid'`). Render `layout → template → sections`. **Effort:** L. **Priority:** P0. _Data: theme bundle via `/v1/themes`._
- **T2 Section/Block schema + the block model.** Parse `{% schema %}`; render a section + its **ordered blocks**; support **theme blocks** (`blocks/*.liquid`), **section blocks** (inline), and the block settings model. Templates JSON drives which sections + block order + settings. **Effort:** L. **Priority:** P0.
- **T3 App blocks (extension injection).** Make `app-block-slot.tsx` real: a section can accept an **app block** type; the renderer pulls **installed‑app block contributions** for the store (from `app-engine`/`/v1/app-store` installed‑apps) and renders them in‑place, sandboxed. (This is the theme half of WS13's extension model — coordinate the contract.) **Effort:** L. **Priority:** P0.
- **T4 Hydration islands.** Keep interactivity (cart drawer, add‑to‑cart, search, variant picker) as **small hydration islands / web components** mounted into the Liquid‑rendered HTML, so portability doesn't kill interactivity. **Effort:** L. **Priority:** P1.
- **T5 Bundle lifecycle.** Upload → **validate** (schema + safety) → **version** (`theme_releases`) → **install/activate** → **rollback**, all via `/v1/themes`. Multi‑theme catalog. **Effort:** M. **Priority:** P0.
- **T6 Migrate first‑party + prove portability.** Convert ≥1 of the existing 32‑section themes into a **portable Liquid bundle**; keep the rest on the JSON‑contract fast path. **Prove the headline:** add a brand‑new `sections/spotlight.liquid` to a theme and show it renders with **no `renderer-registry.tsx` edit and no redeploy**. **Effort:** L. **Priority:** P0. _DoD: the zero‑code‑change section test passes on staging._
- **T7 Handoff contracts.** Publish the stable bundle + block contract for **WS2** (editor edits real sections/blocks), **WS3** (install portable bundles), **WS8** (mobile renders the same engine via storefront WebView) in `CODEX_WS11_LEDGER.md`. **Effort:** S. **Priority:** P0.
- **GATE (FINAL):** Liquid renders real bundles on staging; new section/block = zero code change; app blocks inject; islands interactive; versioned install + ≥2 themes; no regression; 128/128; `CODEX_WS11_STATUS.md` written.

## 5. SHOPIFY REFERENCE
Shopify Online Store 2.0: JSON templates list sections + settings; sections are Liquid files with `{% schema %}` declaring settings + accepted blocks + presets; blocks are theme/section/app blocks; the editor is generated from `settings_schema.json`; the renderer interprets the bundle and is split out as a read‑optimized service. LetBuyy must match this **structure and portability** over its existing `theme_packages`/`theme_releases` tables and `ThemeRenderer` seam.

## 6. LEDGER — `CODEX_WS11_LEDGER.md`
```
# WS11 THEME BLOCK ENGINE LEDGER — started <ts>
## PROGRESS / SKIPPED — NEEDS HUMAN / VISUAL (staging renders, zero-code-change proof) / VALIDATOR (128/128) ledgers
## CONTRACT PUBLISHED: <bundle + block contract for WS2/WS3/WS8>
```

## 7. LAUNCH PROMPT
```
Read docs/Codex_waves/CODEX_THEME_BLOCK_ENGINE_MISSION.md and LETBUYY_SHOPIFY_PARITY_BLOCKERS.md (Part 2) in full,
then execute T0→T7 continuously and autonomously, 24h+.

OWN the theme engine end-to-end: packages/theme-engine/**, apps/storefront-runtime/src/lib/theme-engine/** +
src/components/sections/**, and services/api-gateway theme route/adapter/schema. Do NOT touch non-theme backend
domains, other apps' UI, or governance; evolve the theme contract ADDITIVELY (WS2/WS3/WS8 consume it).

Goal: replace the 32-React-sections model with a portable, versioned theme bundle (layout/templates/sections/blocks/
settings_schema/locales) that the storefront INTERPRETS. Implement a real sandboxed LiquidJS LiquidRenderer behind the
existing ThemeRenderer seam; build the section/block model (theme/section/APP blocks); make app-block injection real;
keep interactivity via hydration islands; version/install bundles via /v1/themes. PROVE the headline on staging: a new
sections/<name>.liquid renders with ZERO storefront code change + no redeploy. Keep JSON-contract as the first-party
fast path; no storefront regression.

Hard rules: keep all 128 validators green per commit; LiquidJS sandboxed (no fs/network from templates; sanitize
settings + app-block content); never break the theme contract; migrations forward-only; small reversible commits;
3 strikes → BLOCKED → next; no fabrication (every DONE = command + result + staging screenshot). Publish the bundle/
block contract for WS2/WS3/WS8. Maintain CODEX_WS11_LEDGER.md. Begin with T0 now.
```

## 8. NORTH STAR
A theme is data anyone can author; the storefront is an engine that renders any theme — sections and blocks (incl. app blocks) interpreted, not compiled — exactly like Shopify.
