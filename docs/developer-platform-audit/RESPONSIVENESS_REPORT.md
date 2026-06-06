# Responsiveness Report (Phase 11)

> Method: code-based responsive analysis of the real `apps/developer-portal/src/app/globals.css` (the only stylesheet) + the `@letbuyy/ui` component Tailwind classes + the inline styles in the marketplace `/developers/*` pages. A live run for pixel screenshots was not feasible in-sandbox (no `pnpm`/`next` resolution); breakpoints below are derived from the actual CSS rules and grid declarations. Screenshot capture is recommended as a follow-up once the app builds.

## The responsive systems in play

1. **System A** (`/`, `/docs`, `/api-reference`, `/sdk`, `/dashboard`) — governed by `globals.css`:
   - Container: `width: min(1180px, calc(100% - 32px))` → 16px side gutters at all widths.
   - `@media (min-width:820px)`: hero + two-column become 2-col (`1.1fr / 0.9fr` with `minmax(320px,…)`), `.developer-grid.three`→3-col, `.developer-grid.two`→2-col.
   - `@media (min-width:1024px)`: `.developer-grid.four`→4-col.
   - `@media (max-width:720px)`: topbar stacks vertically, **nav becomes horizontal-scroll**, hero title→40px.
   - Below 820px everything is single-column (mobile-first defaults). This system is **genuinely responsive**.

2. **System B** (`/api`, `/oauth`, `/webhooks`, `/sdks`) — **NOT responsive**:
   - Outer `@letbuyy/ui` `Page`/`Card`/`Section` are responsive (Tailwind `sm:`/`md:` utilities).
   - But the inner content classes (`.docs-grid--two`, `.endpoint-table`, `.endpoint-table-wrap`, `.scope-matrix`, etc.) are **undefined**, so: `.docs-grid--two` never becomes 2-col (it's never a grid), and **6-column tables have no `overflow-x` wrapper** → they overflow the viewport with no scroll affordance on narrow screens.

3. **Marketplace `/developers/*`** — mixed: several sections use `gridTemplateColumns: repeat(auto-fit/auto-fill, minmax(260–280px, 1fr))` (responsive), but the **dashboard app rows** use a fixed horizontal flex (`gap:24` stats block + actions) that crowds/overflows on small screens; the register/new-app **forms** are `maxWidth:520/centered` (fine).

---

## Per-breakpoint findings

### 320px (small phone)
- **System A:** OK. Single column, 16px gutters, nav horizontal-scrolls, hero title 40px. Hero `clamp(36px,7vw,72px)`≈36px fits.
- **System B:** ❌ **Broken.** Endpoint/route/scope tables (6 columns) overflow well past 320px with no horizontal scroll wrapper styled → content clipped or causes page-wide horizontal scroll. `docs-grid--two` code-sample pairs stack but `<pre>` blocks overflow.
- **Marketplace dashboard:** ⚠️ App-row stats (`Installs · Rating · Reviews` with `gap:24`) + Edit/View actions in one flex row overflow; long app names rely on ellipsis but the action buttons can push off-screen. Stat-card grid (`dev-stats-grid`) — responsiveness depends on its CSS (defined in marketplace globals).
- **Marketplace forms:** OK (centered, full-width inputs).

### 375px / 390px (iPhone)
- **System A:** OK.
- **System B:** ❌ Same table overflow.
- **Marketplace:** ⚠️ Dashboard rows still tight; "how it works" 4-step uses `flexWrap` (OK).

### 768px (tablet portrait)
- **System A:** Still single-column (the first breakpoint is 820px), so on a 768px tablet the layout is mobile-style — acceptable but wastes width.
- **System B:** ❌ Tables overflow until viewport ≳ table intrinsic width (~900px+).
- **Marketplace:** Mostly OK (auto-fit grids collapse gracefully).

### 1024px (tablet landscape / small laptop)
- **System A:** ✅ Good — `grid.four`→4-col activates, two-column hero active.
- **System B:** ⚠️ Wide tables may now fit; grids still single-column (undefined `.docs-grid--two`).
- **Marketplace:** ✅ Good.

### 1280px / 1440px (laptop/desktop)
- **System A:** ✅ Capped at 1180px container, centered — clean.
- **System B:** ⚠️ Tables fit but remain unstyled (no borders/zebra/padding); grids still 1-col.
- **Marketplace:** ✅ Good; some sections capped by `maxWidth`, others full.

### 1920px (large desktop)
- **All:** Content centers within max-width containers (1180px System A; `--lb-size-page-max` System B). Lots of empty side space but no breakage. System B tables look especially sparse/unstyled at this width.

---

## Responsiveness defect register

| ID | Issue | Pages | Breakpoints | Severity |
|---|---|---|---|---|
| R1 | 6-column tables overflow with no `overflow-x` (undefined `.endpoint-table-wrap`) | `/api`,`/oauth`,`/webhooks`,`/sdks` | ≤900px (esp. 320–768) | Critical |
| R2 | `.docs-grid--two` never becomes a grid (undefined) → intended 2-col pairs always stack | System B | all | High |
| R3 | `<pre>` code samples overflow without styled scroll | System B | ≤480px | High |
| R4 | System A first breakpoint at 820px leaves 768px tablets in mobile layout | System A | 768px | Low |
| R5 | Dashboard app-row (stats + actions in one flex row) crowds/overflows | `/developers/dashboard` | ≤480px | Medium |
| R6 | Inline-style layouts can't be tuned per-breakpoint (no media queries in inline styles) | marketplace `/developers/*` | small screens | Medium |
| R7 | Nav horizontal-scroll (System A ≤720px) has no scroll affordance/shadow | System A header | ≤720px | Low |

## Fixes
1. **Define `.endpoint-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch }`** and the table styles (R1/R3) — single highest-impact responsive fix.
2. **Define `.docs-grid` / `.docs-grid--two`** as responsive grids (R2), or restyle System B onto System A classes.
3. Move dashboard app-rows to a responsive grid that wraps stats/actions below the title on small screens (R5).
4. Lower System A's first breakpoint toward 768px or add a 640–768px tier (R4).
5. Replace marketplace inline styles with CSS classes that carry media queries (R6).

## Note on verification
Because the live build did not run in-sandbox, these are **derived** from the CSS rules and JSX. They are high-confidence for System B (the breakage follows directly from undefined classes) and for System A (explicit `@media` rules). A follow-up screenshot pass at 320/375/768/1024/1440 is recommended to capture exact pixel behavior of the marketplace inline-styled sections.
