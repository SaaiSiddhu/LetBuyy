# Theme Marketplace Responsiveness Report (Phase 11)

**Method & honesty note:** this is a **static analysis of the actual Tailwind/responsive classes** in `apps/theme-marketplace/src`, not a live device-lab test. Findings are derived from the breakpoint utilities present in the code. Pixel-level rendering should still be confirmed in a real browser/device matrix before relying on these conclusions.

**Tailwind breakpoints in use:** `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Container (`container-main`) caps at **1280px** with 24px side padding (`globals.css:245-249`).

## Layout behavior by surface

| Surface | Key responsive classes | Behavior |
|---|---|---|
| Home hero | `lg:grid-cols-2`, bento `min-h-[220px]…lg:h-[260px]/[122px]` | 1-col < 1024; 2-col ≥ 1024; **fixed pixel heights** in bento |
| Featured grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | 1→2→4 |
| Category cards | `grid-cols-1 md:grid-cols-2` | 1→2 |
| Value props | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | 1→2→3 |
| Catalog | rail+results `lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]`; cards `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` | Filter rail stacks above results < 1024; cards 1→2→3 |
| Detail | `lg:grid-cols-[minmax(0,1fr)_340px]`; gallery `overflow-x-auto` | **Fixed 340px** sidebar ≥ 1024; thumbnails scroll horizontally |
| Checkout | `grid-cols-1 lg:grid-cols-5` (3+2) | Stacks < 1024 |
| Dashboard | sidebar `hidden lg:block w-56`; mobile nav `lg:hidden … overflow-x-auto` | Sidebar ≥ 1024; horizontal pill nav below |
| Navbar | desktop `hidden md:flex`; drawer `md:hidden` | Hamburger < 768 |

## Breakpoint pass (320 → 1920)

| Width | Assessment | Specific risks |
|---|---|---|
| **320px** | ⚠️ tight | Usable content ≈ 272px. `grid-cols-2`/`grid-cols-3` clusters get cramped: free/paid pills (`themes:409`), price Min/Max (`themes:485`), checkout payment methods (`checkout:365`). Hero `text-4xl` headline is large for 320. Many `text-[10px]`/`[11px]` labels approach legibility limits. |
| **375 / 390px** | ✅ ok | Comfortable single-column; cards full-width; drawer nav works; gallery/thumbnail and dashboard-nav horizontal scroll behave. |
| **768px (md)** | ⚠️ mixed | Cards go 2-col; **but** catalog filter rail is full-width above results (rail/results only split at `lg`), so a tall filter stack precedes content. Home bento is 2-col with **fixed heights** → possible awkward image aspect between 768–1023. Navbar shows full desktop actions at ≥768. |
| **1024px (lg)** | ✅ good | Intended layouts engage: catalog 2-pane, detail 1fr+340px, dashboard sidebar, checkout 3+2. Watch detail sidebar at exactly 1024 (340px fixed) — main column is `minmax(0,1fr)` so no overflow, but margins are tight. |
| **1280px (xl)** | ✅ good | Catalog cards reach 3-col; container hits max width. |
| **1440 / 1920px** | ✅ good | Content caps at 1280 with growing side gutters — intentional and fine. Hero ambient orbs/`blur` are large; negligible cost. |

## Specific responsive risks (ranked)
1. **Fixed-height bento hero** (`page.tsx:142-214`): pixel heights (`min-h-[220px]`, `lg:h-[260px]`, `lg:h-[122px]`) can distort image aspect ratios between breakpoints and on short viewports; prefer aspect-ratio utilities.
2. **Hero max-height clipping on short laptops:** `lg:min-h-[calc(100dvh-72px)]` + bento `lg:max-h-[calc(100dvh-72px-100px)]` (`page.tsx:57,142`) risks cropping on ~720px-tall screens.
3. **Touch-target size:** many 32px icon buttons (`w-8 h-8`) and `p-2`/`p-2.5` controls (navbar bell/theme toggle/user menu, card heart) are below the ~44px mobile guideline.
4. **Small type:** pervasive `text-[10px]`/`text-[11px]` captions (cards, stats, badges) reduce mobile legibility.
5. **Catalog filter rail at md:** full-width tall rail before results at 768–1023; consider a collapsible/drawer filter on tablet.
6. **Horizontal-scroll reliance:** dashboard mobile nav (`overflow-x-auto scrollbar-hide`), detail thumbnails — discoverability of scroll can be poor without affordances.
7. **`grid-cols-3` pill clusters at 320px** (free/paid) and `grid-cols-2` (price, payment) get cramped on the smallest phones.

## What's done well
- Mobile-first single-column defaults throughout; clean `sm/md/lg/xl` escalation.
- Dedicated mobile drawer + ⌘K modal sized with `mx-4 max-w-xl`.
- Skeleton loaders mirror the responsive grid (`loading.tsx`).
- Container max-width prevents over-wide line lengths on 1440/1920.

## Recommended verification
Run a real device/emulator pass at 320/360/390/414/768/834/1024/1280/1440/1920, focusing on: bento aspect ratios, detail sidebar at 1024, tablet filter rail, and tap-target sizing. Add `min-h`/aspect-ratio fixes and bump icon-button hit areas to ≥44px on touch.
