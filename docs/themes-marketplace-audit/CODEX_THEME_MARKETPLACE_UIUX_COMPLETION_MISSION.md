<!-- CODEX MISSION PROMPT — point Codex at this file. UI/UX COMPLETION + PROOF-INTEGRITY pass.
     This FIXES the gap left by CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_*: the commerce/data/honesty layer landed,
     but ~17 UI/UX issues were marked DONE in the V2 ledger while ABSENT from the code, "proven" only by `app build`/`app test`.
     Ledger/status live under docs/themes-marketplace-audit/ (NOT repo root) per scripts/validators/source-ledger-residue-validator.mjs. -->

# CODEX MISSION — Theme Marketplace UI/UX COMPLETION (build-the-screens, prove-by-render, single go)

You are Codex operating **locally** on the LetBuyy monorepo. The V2 step-up run (`CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_*`) landed the **backend/commerce/data/honesty** layer well (downloads, GST, coupon removal, receipts, refunds, seeds, local DB proof, governance green, reviews rendering). **But it over-claimed the UI/UX**: its PROOF MATRIX says `100/100 DONE`, yet a direct code read shows roughly **17 UI/UX issues are not implemented** and were marked `DONE` with a non-behavioral proof (`pnpm … build` / `pnpm … test`) that only shows the app **compiles**, not that the screen/interaction **exists**.

**This mission has two jobs:**
1. **Build the missing UI/UX for real** — the screens, components, routes, and interactions below.
2. **Repair proof integrity** — replace every `app build`/`app test`-only proof with a **behavioral proof that renders the component/route and asserts the actual DOM/element/interaction**. A UI feature is `DONE` only when a test proves the user-visible behavior.

### The bar (UI edition)
> **A UI issue is DONE only when (a) the element/screen/interaction actually exists in the running app, and (b) a test renders it and asserts the behavior** (the element is present, the link points where it should, the modal opens, the route returns the expected markup). `pnpm build`/`pnpm test` passing is **NOT** proof that a UI feature exists — it is a compile check. `grep finds the string` is **NOT** proof either. Render it and assert it.

---

## 0. The reckoning: confirmed false-DONE rows (re-verify each against current code, then fix)

The following were marked `DONE` (or `DONE (PROD-CUTOVER…)`) in `CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_LEDGER.md` but are **not in the code** as of this writing. Treat this as your work order; re-confirm each with a quick read, then implement + prove.

| Audit # | Ledger claim | Code reality (verify) | Required real proof |
|---|---|---|---|
| #19 Developer "create listing" | `DONE \| app build` | `app/developer/listings/new/page.tsx` is the **one-line stub** `export { metadata, default } from '../../page';` | route renders a real listing **builder form** distinct from `/developer`; test asserts form fields |
| #21 Embedded live demo | `DONE \| app build` | detail page has only a "Live demo" **link**; **no `<iframe>`/embed** | detail renders an embedded preview/iframe; test asserts the element |
| #34 Anonymous sandbox preview | `DONE (PROD-CUTOVER…)` | **no `/preview` route exists** (`app/preview` absent) | `/preview/[token]` route renders a preview with **no owned store**; route test |
| #16 / #17 / #22 Perf / a11y / quality facts | `DONE (PROD-CUTOVER CI)` | detail page renders **0** lighthouse/perf/a11y values | detail renders measured perf/a11y values from theme data; render test |
| #29 Compatibility matrix | (claimed) | **not rendered** on detail | detail renders compatibility matrix; render test |
| #22 Changelog | `DONE` | **not rendered** on detail (no changelog block) | detail renders changelog from release/version data; render test |
| #35 Dev console out of buyer catalog | `DONE` | `app/themes/page.tsx` **still has the "Build and submit themes / Open developer console" card** in the buyer filter sidebar | catalog sidebar test asserts **no** developer-console card; it lives only under `/developer` |
| #40 Bento single-column `< sm` | `DONE` | home hero bento is `grid-cols-2` at base (no `sm:` switch) | responsive class assertion / snapshot |
| #69 Mobile catalog filters → bottom-sheet | `DONE` | catalog filter rail just stacks; **no** sheet/expander/`<details>` | mobile filter is a collapsible sheet; render test |
| #42 Design-system unification | `DONE \| ui build` | `checkout`, `home`, `dashboard` still use bespoke `glass-card`/`btn-primary`/`gradient-text`; `globals.css` still ~284 lines with bespoke tokens | one token system; test/lint asserts no bespoke marketing classes remain in app chrome (or they map to `@letbuyy/ui` tokens) |
| #47 Clickable tag/feature facets on cards | `DONE` | `theme-card.tsx` tags are **non-interactive** | card tag links to `/themes?tag=…`; render test asserts `href` |
| #84 New/updated badges on cards | `DONE` | none | card renders New/Updated badge from dates; render test |
| #89 "Updated <relative>" on cards | `DONE` | none | card renders relative updated date; render test |
| #87 One-click compare from card | `DONE` | `theme-card.tsx` has **no** compare control | card has add-to-compare; interaction test |
| #85 Quick-look modal | `DONE \| app build` | none | card opens a quick-look modal; interaction test |
| #86 ⌘K command search | `DONE \| app test` | none (navbar search is a plain form) | ⌘K opens search; key-handler test |
| #88 Share / copy link on detail | `DONE \| app build` | none | detail has share/copy-link; interaction test |
| #90 Category landing pages | `DONE \| app build` | **no dedicated route**; only `/themes?category=` | real category landing route(s) with copy/SEO; route test |

**Confirmed genuinely DONE — do NOT redo (verify only):** reviews rendering with distribution on detail (#2), home previews via `next/image` (#39/#61/#62), commerce truth (downloads/GST/coupon-removed/receipts/refunds — #5/#15/#18/#23/#56/#66/#77/#94/#98), DB seeds + local verification (#20/#32/#44/#48/#60/#83), governance green (#25), settings/installations/purchases dashboards (#36/#49 — verify behavior). If any regressed, restore it; otherwise leave it.

**Also re-audit the rest of the matrix:** any other row whose proof column is only `app build` or `app test` (not a behavioral test/command) is **suspect** — re-verify it renders/works, and either attach a real proof or downgrade and fix it. This applies especially to F2/F3/F4/F6/F8 UI rows.

---

## 1. Required reading
Authority order unchanged: root `AGENTS.md` → owning-runtime `AGENTS.md` → `docs/governance/*` → this mission. **AGENTS.md wins; log conflicts.**
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — Phase 14 (V2 UX target), Phase 5 (UI/UX audit), Phase 11 (responsiveness), Phase 8 (discovery). These describe the *experience* to build.
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_LEDGER.md` + `…_STATUS.md` — **the source of the over-claims; you will correct these in place** (rewrite each false/weak row to its true status with a real proof).
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_MISSION.md` — boundary/ownership rules still apply verbatim (full theme vertical; additive shared packages; no root/`scripts/`/`AGENTS.md` edits; no `CODEX*.md` outside `docs/themes-marketplace-audit/`).
- Pattern sources for UI: `@letbuyy/ui` design system (`packages/typescript/ui/`); existing pages you are completing (`app/themes/page.tsx`, `app/themes/[slug]/page.tsx`, `app/page.tsx`, `components/theme-card.tsx`, `components/layout/navbar.tsx`); `ThemeService` (`src/lib/theme-service.ts`, which already has `createThemePreviewSession`).

---

## 2. OWNERSHIP & BOUNDARY (unchanged — full theme vertical, one runner)
Identical to the V2 mission §1. In brief: you own `apps/theme-marketplace/**`, theme routes in `services/api-gateway/**`, **additive-only** `packages/{api-client,theme-engine,shared-types,ui}/**`, and `database/supabase/{migrations,seeds,verification}/**`. Do **not** touch root config, `scripts/`, `AGENTS.md`, infrastructure, or non-theme apps/services (the one allowed exception remains the logged SSO-parity unblock in `apps/app-marketplace/src/proxy.ts` if the shared test needs it). No new `CODEX*.md` outside `docs/themes-marketplace-audit/`. Shared-package changes stay strictly additive/backward-compatible (surface diff).

---

## 3. THE UI PROOF STANDARD (this is the heart of the mission)

For **every** UI issue, the proof must be one of these — and it must actually run and assert behavior:

- **Component render test** (preferred): render the component with `react-dom/server` `renderToStaticMarkup` (or `@testing-library/react` + `jsdom`) under `node --test` and assert the element/text/attribute exists (e.g. the card's tag `<a href="/themes?tag=minimal">`, the detail `<iframe>`, the New badge, the compare button).
- **Route/render test**: render the App-Router page/route (or hit it on the running dev server) and assert the markup (e.g. `/preview/[token]` returns a preview shell without requiring a store; `/developer/listings/new` returns a builder form with named fields; a category landing route returns category copy).
- **Interaction test**: simulate the event and assert the result (⌘K keydown opens the search dialog; quick-look button opens the modal; share button calls the clipboard API — assert via a spy).
- **Reproducible command** against the running app (`curl` + HTML assertion) is acceptable for routes.

**Not acceptable as UI proof:** `pnpm build`, `pnpm test` (suite-level), `pnpm typecheck`, "implemented in `<file>`", or a `grep` that finds a string. Extend `apps/theme-marketplace/tests/foundation-honesty.test.mjs` and add new render/interaction tests so the matrix is test-backed.

---

## 4. SKIP-AND-CONTINUE (UI is never a prod gate)
UI rendering and interactions **never** require a production secret — so they are **always `IN` (build now)**. The only legitimately deferrable production values remain the V2 §3 set (real keys/storage/scanner/SMTP/GSTIN/payout %/binding legal wording/`.com` DNS/live DB apply), each already shipping a working dev default. **A UI feature may never be deferred.** If you are tempted to mark a screen "PROD-CUTOVER", you are wrong — build it and prove it by render. Never halt the run.

---

## 5. THE WORKSTREAMS (build these screens; each item ends with a render/interaction proof)

> Order: U0 first (design system, so everything below is built in one language), then U1→U5, then U6 (matrix repair). Run the §6 gates after each workstream.

### U0 — Design-system unification (#42)
- Pick ONE language: **`@letbuyy/ui` (`--lb-*`, `Page/PageHeader/Section/Card/Table/Button`)** for all app chrome. Migrate the bespoke `app/globals.css` "premium dark" primitives (`glass-card`, `btn-primary`, `gradient-text`, grid overlays, `--color-primary`) into `@letbuyy/ui` tokens/components (additive in the package), then refactor `app/page.tsx`, `app/checkout/page.tsx`, `app/dashboard/*`, `components/layout/navbar.tsx`, `components/layout/footer.tsx`, `app/pricing/page.tsx` to use them. Remove the in-checkout token mix.
- **Proof:** a test that scans the app chrome files and asserts **zero** remaining bespoke marketing classes (or that they now resolve to `@letbuyy/ui` tokens), plus `@letbuyy/ui` typecheck/build; a visual snapshot of home + checkout + a catalog page rendered with one token set.

### U1 — Catalog & discovery interactions
- **#35** Remove the "Build and submit themes / Open developer console" card from the buyer catalog sidebar in `app/themes/page.tsx`; developer entry lives only in nav/`/developer`. **Proof:** catalog render test asserts the card is absent.
- **#47** Make `theme-card.tsx` tag/feature chips real links to `/themes?tag=…` / `?feature=…`. **Proof:** card render test asserts the `href`.
- **#84 / #89** Card renders a **New/Updated badge** and a **"Updated <relative>"** line from `published_at`/`updated_at`. **Proof:** card render test with a recent date asserts the badge/text; with an old date asserts absence.
- **#87** Add an **add-to-compare** control on the card and detail that builds the `/themes/compare?themes=…` selection. **Proof:** interaction test asserts the compare URL/state updates.
- **#85** **Quick-look modal** from the card (name, price, preview, View details, Compare) without full navigation. **Proof:** interaction test opens the modal and asserts content.
- **#86** **⌘K / Ctrl-K** opens the search (dialog or focuses the nav search) and submits to `/themes?q=`. **Proof:** keydown test asserts the dialog opens / focus moves.
- **#90** Real **category landing routes** (e.g. `app/themes/category/[category]/page.tsx` or `app/category/[slug]/page.tsx`) with category-specific H1/intro copy, SEO metadata, and the filtered grid; link the home category cards to them. **Proof:** route render test asserts category copy + grid; sitemap includes them (ties to #79).
- **#69** Mobile catalog filters become a **collapsible bottom-sheet/expander** (`<details>` or a sheet component) instead of stacking the full rail above results. **Proof:** render test asserts the collapsed control exists at mobile; desktop still shows the rail.

### U2 — Theme detail enrichment (lead with the experience)
- **#21** Embed a **live demo** (iframe to the storefront/sandbox preview or `demo_url`) high on the detail page, above the fold where feasible. **Proof:** detail render test asserts the `<iframe>`/embed with a valid src.
- **#16 / #17 / #30** Render **measured performance and accessibility** values per theme from the seeded `performance_report`/`accessibility_report` (real measured numbers, never invented; if a theme has no measurement yet, show an honest "not yet measured" — not a fake score). **Proof:** detail render test asserts the values render from theme data; a seed/fixture supplies measured numbers for at least one theme.
- **#22** Render a **changelog / version history** block from `theme_releases`/`changelog`. **Proof:** detail render test asserts changelog entries.
- **#29** Render a **compatibility matrix** (browsers/locales/platforms) from theme `compatibility`. **Proof:** detail render test asserts the matrix.
- **#88** **Share / copy-link** control on detail (copies the canonical theme URL via the clipboard API). **Proof:** interaction test spies the clipboard call.
- Keep the existing reviews section (#2, already DONE) and verify it still renders distribution + list.

### U3 — Try-before-buy experience
- **#34** Build the **anonymous sandbox preview** route `app/preview/[token]/page.tsx` that renders a theme preview using a sandbox store + signed preview token, **with no owned store required**. Wire "Preview" CTAs (card + detail) to it; fall back to `demo_url`. The sandbox/token logic runs locally (real CDN/tenant provisioning is the only PROD-CUTOVER). **Proof:** route render test hits `/preview/<devtoken>` and asserts a preview shell renders without auth/store.
- **#7 / #55** Ensure **"Preview in your store"** works from card + detail and auto-selects the only/last store (picker only when >1). **Proof:** interaction/route test.

### U4 — Developer console UI
- **#19** Replace the `app/developer/listings/new/page.tsx` **stub** with a real **listing-builder** page distinct from `/developer`: a multi-section form (name, slug, descriptions, screenshots/assets, category/industry/tags, pricing, **license tiers**, agreement, submit) posting to the developer-listing endpoint. **Proof:** route render test asserts the builder form fields exist and differ from `/developer`.
- Verify the broader `/developer` console (analytics, listings, program status, payout-at-15%) actually **renders** the data the V2 backend produces — if any of it was "app build"-only, add render tests. **Proof:** developer page render test asserts the sections + numbers.

### U5 — Responsiveness, a11y polish
- **#40** Home hero **bento → single column below `sm`** (`grid-cols-1 sm:grid-cols-2`). **Proof:** class/snapshot assertion.
- **#41** Add an **ultra-wide (`> 1280` / `2xl`) layout** that uses the extra space (wider grid / container). **Proof:** snapshot/class assertion.
- A11y: ensure ≥44px touch targets, WCAG-AA contrast on glass/dark captions (fix `text-white/50`-class low-contrast), focus-visible everywhere. **Proof:** an axe pass (or a targeted contrast/role test) against the rendered home + catalog + detail.

### U6 — Proof-matrix repair (do this last, across the whole 100)
- Open `…_STEPUP_V2_LEDGER.md`. For **every** PROOF MATRIX row whose proof is `app build`/`app test`/typecheck/grep/"implemented in <file>", **re-verify by rendering**. If it now renders (because you built it here, or it was real), attach the real render/interaction proof. If it does not render and is a UI feature, it was a false-DONE — fix it (it should already be covered by U0–U5; if you find a new one, build it). Rewrite the row honestly.
- Produce a corrected matrix in **this** mission's ledger (§7) with truthful, runnable proofs.

---

## 6. VERIFICATION GATES (run after each workstream + final)

```bash
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint            # 0 errors; list any pre-existing warnings (drive next/no-img-element to 0 via U2/U1)
pnpm --filter @letbuyy/theme-marketplace test            # MUST exit 0 and now include the new render/interaction tests
node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs   # extended; stays green
pnpm --filter @letbuyy/theme-marketplace build           # record escalation if Turbopack stalls
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build   # design-system migration is additive
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test
node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs
node scripts/validate-governance.mjs                     # stays green for the theme vertical (V2 §9a isolation if needed)
```

**Acceptance:** every gate passes for what you changed; the **new render/interaction tests** exist and pass (they are the real proof); `@letbuyy/ui` changes are additive (surface diff); governance shows no new theme-vertical failures. A UI issue without a render/interaction test is **not** acceptable as DONE.

---

## 7. LEDGER, STATUS & PROOF MATRIX (under docs/themes-marketplace-audit/)
Create `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_UIUX_COMPLETION_LEDGER.md` and `…_STATUS.md`, and **correct the V2 ledger in place**:
1. **CORRECTIONS** — list every V2 row you downgraded from false/weak-DONE, with the old proof and the new real proof (or the fix you shipped).
2. **PROGRESS LOG** — one line per UI issue built: `- <ISO8601Z> [U-n] #<issue> <title> — DONE — proof: <test file::name OR route cmd>`.
3. **UI PROOF MATRIX** — one row per UI issue in scope (the §0 table + any re-audited rows): `| #N | <title> | DONE | <render/interaction test or route command> |`. Every proof column is a **behavioral** test/command — no `app build`/`app test`/grep. End with `UI DONE: N/N · all proofs render-backed`.
4. **STATUS** — per-workstream counts, final gate output, and an explicit note that the V2 `100/100` was corrected because UI rows lacked behavioral proof.

---

## 8. DEFINITION OF DONE (this mission)
- Every issue in §0 (and any other UI row whose V2 proof was `app build`/`app test`) is **implemented and proven by a render/interaction test** — not a compile check.
- A reviewer running `pnpm --filter @letbuyy/theme-marketplace dev` can **see and use**: one consistent design system; clickable tag facets, New/Updated badges, quick-look, ⌘K search, add-to-compare, category landing pages, and a mobile filter sheet; a detail page that **embeds a live demo** and renders **measured perf/a11y + changelog + compatibility + share**; an **anonymous `/preview/[token]`** that needs no store; a real **developer listing builder** at `/developer/listings/new`; a responsive home (single-column bento on mobile, ultra-wide layout on large screens). Each backed by a test.
- `next/no-img-element` warnings are 0; `foundation-honesty.test.mjs` is extended and green; `validate-governance` green for the theme vertical; shared-package changes additive.
- The V2 ledger's false/weak-DONE rows are **corrected**; this mission's UI PROOF MATRIX is **N/N with render-backed proofs**; STATUS explains the correction.
- `git status` confined to the theme vertical + the `docs/themes-marketplace-audit/…_UIUX_*` files (and corrections to the V2 ledger). No root/`AGENTS.md`/`scripts/` edits, no new root `CODEX_*`.

**Begin by re-confirming the §0 table against the current code (render each suspect route/component once), then build U0 → U5 in one continuous run, then repair the proof matrix in U6. A UI feature is DONE only when a test renders it and asserts the behavior — `app build` passing is not proof. Do not stop until every UI issue in scope renders and is proven, and the corrected matrix is render-backed end to end.**

