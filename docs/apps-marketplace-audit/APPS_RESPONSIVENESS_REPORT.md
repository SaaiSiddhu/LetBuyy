# Apps Marketplace Responsiveness Report (Phase 12)

Assessed from `apps/app-marketplace/src/app/globals.css` (breakpoints at 768px, 640px, 480px) and component markup. No build/screenshots were run; findings are from the CSS rules and layout structure. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Breakpoint coverage

| Width | Handling | Verdict |
|---|---|---|
| **320px** | **No rule** (smallest media query is 480px) | ❌ Untested; long brand/price strings and 2-col category grid likely overflow |
| **375px** | Inherits ≤480px + ≤640px rules | ◐ Works but nav is gone (see below) |
| **390px** | Same as 375px | ◐ |
| **768px** | Major breakpoint: grids collapse to 1 col, header nav hidden | ◐ Layout OK, navigation broken |
| **1024px** | Desktop layout (`auto-fill minmax` grids) | ✅ |
| **1280 / 1440 / 1920px** | Containers cap at `max-width: 1200px`, centered | ✅ |

## The critical defect: navigation disappears on mobile

From `globals.css`:

- **≤768px:** `.appstore-header-nav { display: none; }` — hides Home / Categories / Collections / Developers / Partner Console.
- **≤640px:** `.appstore-header-center, .appstore-header-btn { display: none; }` — also hides the **search** entry point and the **My Apps** and **Build an app** buttons.

`Header.tsx` has **no mobile-menu/hamburger state** and no replacement nav. So on a phone the header is reduced to **logo + theme toggle only**. A merchant on mobile cannot reach Categories, Collections, Search, Developers, or My Apps from the chrome — they can only scroll the current page. For a marketplace where mobile is a large share of Indian traffic, this is a severe navigation failure.

## What responsive handling *is* present (and fine)

- `.app-card-grid` → 1 column ≤768px; `.category-grid` → 2 columns ≤768px and ≤480px.
- `.app-detail` and `.app-detail-hero` → single column, centered, ≤768px; sidebar becomes static.
- `.app-pricing-grid` / `.app-permission-review-grid` → 1 column ≤768px.
- `.search-page` → column stack, full-width sidebar ≤768px.
- `.my-apps-grid` and `.dev-stats-grid` collapse to 1 column ≤768px.
- App screenshots use `width: min(320px, calc(100vw - 36px))` ≤480px — good carousel handling.
- Hero scales down (`font-size: 22px`, stacked) ≤768px.

So the **grid/content reflow is competent**; the failure is specifically **navigation** and **the missing 320px tier**.

## Component-level responsiveness risks

| Surface | Risk at narrow widths |
|---|---|
| Header brand "LetBuyy Apps" | Ellipsis applied ≤768px (good), but ≤640px with toggle only, fine |
| Partner console (`dashboard`) | Dense multi-column grids with inline `repeat(auto-fit, minmax(260–320px,1fr))` — collapses, but payout/charge rows use `gridTemplateColumns: '1fr auto'` and small text; cramped on phones |
| Search facets | Become full-width but are non-semantic `<div>`s — touch targets/keyboard untested |
| App detail pricing/permission cards | Reflow to 1 col; OK |
| Submit form | Long single-column form; fine but upload zones fixed 120px icon ok |
| Tables/ledgers | No horizontal-scroll containers; risk of overflow <360px |

## Recommendations (ranked)

1. **Add a mobile menu** (hamburger or bottom nav) so Home/Categories/Search/My Apps/Build remain reachable below 768px. **This is the #1 mobile fix.**
2. **Add a ≤360/320px tier** and verify brand, prices, badges, and the 2-column category grid don't overflow.
3. Keep **search reachable** at all widths (don't hide the only search entry at ≤640px).
4. Make the partner console **mobile-designed** (stacked cards, wrap ledger rows, horizontal-scroll for any tabular data).
5. Convert search facets to **semantic, touch-sized** controls.
6. Validate with real device testing once a build is available (this report is static-analysis only).
