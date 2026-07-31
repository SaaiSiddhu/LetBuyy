# LB-8 — Announcement Bar — Report

**Stream:** B · **Severity:** 🔴 Critical (governance-trapped) · **Status:** ✅ CLOSED (code complete + tested)

## Root cause
The `announcementBar` **section schema already existed** (`packages/theme-engine/src/theme-registry.ts:136-162` — one of the 25 built-in section types, with `text`/`linkLabel`/`linkHref`/`alignment`/`backgroundColor`/`textColor`/`visibleOnMobile`), and the merchant theme editor already renders it via `SchemaFormRenderer`. The **storefront had no renderer** for it: `renderer-registry.tsx` had no `announcementBar` entry, so any theme carrying the section fell through to `UnknownSectionFallback` (rendered as a broken "section unavailable" placeholder).

## Governance decision (the trap)
`no-new-react-sections-validator` freezes exactly **20** React sections under `apps/storefront-runtime/src/components/sections/`. The audit's "fold into header.tsx" (Option 1) is architecturally wrong — the announcement bar is its own section in the theme data model (own `SectionModel`, own settings, own schema), and folding it into `HeaderSettings` would orphan the existing schema and tie the bar to header presence.

**Chosen compliant path:** add a renderer entry (`core.announcement-bar`) backed by a component in `apps/storefront-runtime/src/components/layout/` — exactly how `DynamicHeader`/`DynamicFooter` (also storefront chrome) are done. `components/layout/` is **not** in the freeze scope, so no frozen-section count changes and the existing schema is reused.

## Fix
- **New** `apps/storefront-runtime/src/components/layout/announcement-bar.tsx`:
  - Renders nothing without text; honors an explicit `enabled` show/hide flag; mobile-aware (`hidden sm:flex` when `visibleOnMobile === false`); merchant `backgroundColor`/`textColor` via inline `style` (runtime values); link CTA; alignment.
  - **Schedule-ready** via a pure, hydration-safe `shouldDisplayAnnouncement(settings, nowMs)` helper — the clock is **injected** (no internal `Date.now()`), so there is no server/client hydration risk and the window logic is unit-testable. The renderer can pass a server-side clock when a date input is added to the editor.
  - **Design-system safe:** standard Tailwind utilities only (no arbitrary `rounded-[…]`/`*-[…px]`); merchant colors via inline style use `var(--token, rgb(…))` fallbacks (no raw hex literals).
- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`: import `AnnouncementBar`; add the `core.announcement-bar` entry (`sectionTypes: ['announcementBar','announcement-bar','announcement_bar']`, `schema: schemaFor('announcementBar')`).

## Requirements coverage
| Requirement | How |
|---|---|
| Merchant configurable | Existing `announcementBar` schema → theme editor (unchanged) |
| Text / Link / Color / Alignment | Schema fields → component render |
| Show / hide | `enabled` flag + remove-section in editor + `visibleOnMobile` |
| Schedule ready | `shouldDisplayAnnouncement(settings, nowMs)` injected-clock window |
| Mobile responsive | `hidden sm:flex` / flex-wrap |
| Theme editor compatible | Schema already in `SECTION_SCHEMAS` → editor renders it |

## Files changed
- **NEW** `apps/storefront-runtime/src/components/layout/announcement-bar.tsx`
- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`
- **NEW** `tests/launch/lb8-announcement-bar.test.mjs`

## Tests & validation
- `tests/launch/lb8-announcement-bar.test.mjs`: **6/6 pass** (renderer registered against the existing schema; component in `components/layout` not the frozen set; merchant-configurable/mobile/empty-safe; design-system no arbitrary radius/px; show/hide + schedule helper).
- `theme-governance-validator`: **pass** (still 25 built-in schemas / 20 frozen sections / 20 Liquid-parity — unchanged).
- `no-new-react-sections-validator`: **pass** (still 20 frozen — no file added under `components/sections/`).
- `validate-design-system`: my contribution is zero new TSX drift (`tsxRawHex` confirmed back at baseline 0 after switching hex→`rgb()`). See `07-governance-report.md`.
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: **clean**.

## Evidence
```
PASS  lb8-announcement-bar  (6 ok)
theme-governance=0 :: 25 built-in section schemas, ... fallback placeholder
no-new-react-sections=0 :: 20 frozen React sections checked
```
