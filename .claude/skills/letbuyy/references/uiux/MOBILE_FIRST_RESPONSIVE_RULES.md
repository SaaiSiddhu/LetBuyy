# LetBuyy Mobile-First Responsive Rules

Grounded in `letbuyyBreakpointTokens` (`packages/typescript/ui/src/tokens.ts`), DOC 06 §4.8 / UX-R17 /
UX-R18, and `docs/ui-standards/mobile-first-guidelines.md`. Measured 2026-09-04 at `823aa5ee`.

---

## 1. The rule

**Design and build from 360 CSS px upward** (the `xs360` token) and prove reflow down to **320 px**
(WCAG 1.4.10). Merchants and shoppers are overwhelmingly on mid-range Android phones in Tier-2 India
on patchy 4G; the merchant OS is also used on a laptop all day. Mobile-first ≠ mobile-only: content
and capability are equivalent across sizes; the interface is optimised per size. Never carry a mobile
compromise (hidden hamburger on desktop, icon-only search) up.

---

## 2. Breakpoints — one scale, from the preset

```
xs      360   the design base
mobile  480
sm      640
md      768   Table switches to stacked cards below; the tablet band 768–1023 is deliberate
lg     1024   workspace chrome (AppNavigation sidebar) opens
xl     1280   desktop
```

Author breakpoints **only** through `letbuyyTailwindPreset` / `--lb-bp-*` (UX-R18). Literal-px
`@media` in app CSS is a violation (DOC 06 measured 76 in marketing, 8 app-marketplace, 5 identity,
3 developer-portal — marketing is exiled from the ratchet until its migration; the others count).
Prefer intrinsic layout (Grid `auto-fit`/`minmax`, Flexbox wrap, `clamp()`), so most components need
no media query; container queries for genuinely context-dependent components.

---

## 3. Non-negotiables

- **Zero horizontal overflow at 320 px.** Tables become stacked cards or scroll inside their own
  container with a visible affordance and an accessible name; the page never scrolls sideways.
- **Reflow at 320 px, usable at 200% zoom, text-spacing overrides survivable** (WCAG 1.4.10, 1.4.4, 1.4.12).
- Never `user-scalable=no` / `maximum-scale=1`.
- **Touch targets ≥ 44×44 px** (UX-R17; `min-h-11`), ≥ 8 px apart. On Flutter, density tokens
  (`LetbuyyDensityTokens`) guarantee this only when adopted — DOC 06 measured 0% adoption in the
  merchant app; `CANONICALIZATION_PROGRAMME.md` UX-7 owns it.
- **Thumb reach:** primary actions reachable at the bottom on long pages (`SaveBar` pins them).
- **Nothing essential behind hover** (`hover: none` devices exist).
- **Content parity** — nothing hidden on mobile "for space".
- Safe areas (`env(safe-area-inset-*)`) respected by any fixed element; both orientations work.

---

## 4. Navigation

- Web: `AppNavigation` handles the sidebar/drawer switch at `lg`; below it, a labelled disclosure
  toggle (`aria-expanded` + `aria-controls`), never `role="menu"`; open menu moves focus in, Escape
  closes and returns focus. Sticky headers must never fully obscure a focused element
  (`scroll-padding-top` = header height).
- Flutter: `custom_bottom_nav` / `custom_drawer` from `ui_kit`; the Orders / Finance / Customers
  primary contract holds on mobile too (UX-R19); no parity-catalog or `[SKIP]` screen is reachable (UX-R14).

---

## 5. Typography and measure

- Body ≥ 16 px at every size (`--lb-font-size-*`); merchant tables may use the compact density, never
  a smaller raw size.
- Measure 60–75 characters; real side padding on phones.
- Fluid type via the `clamp()` scales in `tokens.ts`; never pure `vw`.
- Money columns tabular at every width.

---

## 6. Images, media, performance on constrained networks

- `next/image` with a correct `sizes`; intrinsic `width`/`height`; AVIF/WebP (configured); `priority`
  only on the LCP image; lazy-load everything else; no background or hero video.
- Server components by default; light client bundles; cached reads (`stale-while-revalidate` headers
  are configured on the storefront proxy); last-known data shown while refreshing.
- Storefront pages must be readable before JavaScript.

---

## 7. Forms on mobile

Correct `type`/`inputmode` (`numeric` for amounts and pincodes, `tel` for `+91`), `autocomplete`,
visible labels above fields (placeholders are not labels), full-width targets, no side-by-side fields
below `sm`, inline validation on blur/submit, errors visible without scrolling and linked with
`aria-describedby`, input preserved on failure (`docs/ui-standards/forms-patterns.md`).

---

## 8. Required responsive QA

At **320 / 360 / 414 / 768 / 1024 / 1280**, light and dark, on every touched screen:

```
[ ] No horizontal scrollbar                 [ ] Nav opens, closes, traps nothing, returns focus
[ ] Every target ≥ 44 px, ≥ 8 px apart      [ ] Table stacks or scrolls inside its container
[ ] 200% zoom usable · 320 px reflows       [ ] Text-spacing overrides do not clip
[ ] Landscape works                         [ ] Nothing essential requires hover
[ ] The 768–1023 band is deliberate         [ ] Focused element never hidden by a sticky header
[ ] Money columns tabular, INR formatted    [ ] Evidence: screenshot paths recorded per viewport
```
