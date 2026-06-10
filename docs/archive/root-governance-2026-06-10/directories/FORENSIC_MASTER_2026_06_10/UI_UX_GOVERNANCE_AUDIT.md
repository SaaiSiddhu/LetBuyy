# PHASE 8 — UI/UX Governance Audit

**Auditor:** Design-Systems & UI/UX Governance Auditor (Polaris/Linear-grade)
**Date:** 2026-06-10
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (current working tree)
**Scope:** All 9 Next.js/React web apps + the Flutter merchant app (UI layer) + shared design-system packages.
**Companion Phase-8 audits in this folder:** `FOUNDATION_AUDIT.md`, `REPO_TOPOLOGY_AUDIT.md`, `ARCHITECTURE_COMPLIANCE_AUDIT.md`, `DATABASE_FORENSIC_AUDIT.md`, `AUTH_FORENSIC_AUDIT.md`, `CHECKOUT_FORENSIC_AUDIT.md`, `PAYMENTS_FORENSIC_AUDIT.md`.

---

## 0. Methodology & evidence integrity

This audit reads **source, not a running app**. Every score and count is grounded in `grep`/`rg` measurement and file:line citations against the current tree (re-run 2026-06-10). Rendering-dependent claims (actual contrast on screen, focus-ring visibility, layout overflow at a given viewport) are marked **UNVERIFIED — source-level audit**. I do not run the apps, take screenshots, or modify code.

I was asked to supersede ~16 prior root-level reports (`DESIGN_SYSTEM_MASTER_AUDIT.md`, `DESIGN_TOKEN_AUDIT.md`, `DESIGN_SYSTEM_ADOPTION_SCORECARD.md`, `NAVIGATION_GOVERNANCE_AUDIT.md`, `COMPONENT_DUPLICATION_REPORT.md`, `DARK_MODE_GOVERNANCE_REPORT.md`, `MOBILE_DESIGN_SYSTEM_REPORT.md`, etc.). **Those reports are dated 2026-06-08/09 and several are now materially stale** — between then and now a canonical `LetbuyyThemeProvider` shipped and was adopted 9/9, a `validate:design-system` ratchet gate was wired into CI, and `tokens.json` (DTCG) was emitted. I re-verified everything; supersession notes are in §13.

**Two naming traps the mission brief itself inherited from stale docs — corrected here:**

1. **`packages/token-core` is NOT the design-token system.** It is the auth/JWT token-envelope package (`packages/token-core/src/index.ts:4` → `TokenKind = 'id_token' | 'access_token' | 'refresh_token' | …`). The real design-token engine is **`packages/typescript/ui/src/tokens.ts`** (1,389 lines), exported by `@letbuyy/ui`. Anyone (human or agent) who greps "token-core" for color scales is misdirected.
2. **There is no `packages/design-system` / `packages/ui`.** The single UI library is **`@letbuyy/ui` at `packages/typescript/ui`**. Mobile's library is **`packages/dart/ui_kit`** (`@letbuyy/ui_kit`).

---

## 1. Executive verdict

**LetBuyy has a Polaris-grade design-system *core*, a now-real (if shallow) governance *gate*, and a long tail of baselined visual debt that the gate freezes but does not repay.** This is no longer the "world-class bones, zero governance" story the June-09 reports told. The governance has been switched on — but it was switched on by **baselining the existing drift as acceptable** (573 naked `rgb()/hsl()`, 1,382 raw-px spacings, 638 inline styles, 606 Tailwind-palette classes are all "passing" because they sit at or below a frozen ratchet). New drift is blocked; the accumulated drift is grandfathered.

The platform is still **two design cultures sharing one token file**: internal-ops apps (`platform-console`, `platform-operations-portal`, `merchant-control-plane`) are token-disciplined and near-clean in CSS; customer-facing apps (`storefront-runtime`, `marketing-site`, `app-marketplace`, `identity-platform`) carry virtually all of the raw-value debt and bespoke chrome. The single biggest *adoption* gap is unchanged: **the canonical app-shell (`AppFrame`/`Sidebar`/`Navigation`) still has ~0 real consumers** — 10 hand-rolled navigations persist, and the two operations-portal sidebars are still active-state-less twins.

The good news is concentrated and real:
- **The merchant Admin OS is genuinely operator-first** (Orders / Products / Customers are top-level primary nav, not buried under Settings) — V1 §10's central demand is **met** for the store profile (one caveat: no first-class "Money/Finance" node).
- **The theme editor — "the differentiator" — is a 1,892-line Shopify-class visual editor** with undo/redo history, device preview, draft/publish versioning, schema-driven forms, and AI assist. It is the strongest single surface in the platform.
- **Dark mode is now systematic at the library level and adopted 9/9** via `LetbuyyThemeProvider` + `ThemeScript`. The old `theme="auto"` cascade bug (THEME-1) is fixed.
- **The canonical shell now has its first 2 consumers.** `platform-console` and `platform-operations-portal` adopted the new `AppNavigation` shell primitive (`navigation/app-navigation.tsx`), which computes active state from `usePathname` and emits `aria-current` for free. This supersedes the June-09 "0/9 shell adoption" / "console+ops have no active state" findings — those two apps are now fixed on both axes. Shell adoption is **2/9** (7 apps still hand-roll).

The bad news is also concentrated: dark mode is **wired but not user-reachable** in 7 of 9 apps (no toggle); accessibility is **excellent in merchant, thin in the customer apps, and weakest in developer-portal** (0 `role`, ~0 focus management); the **7 hand-rolled navs that did NOT adopt `AppNavigation`** still carry 4 widths / mixed active-state strategies / lost a11y; mobile is **effectively a separate, un-tokenized design system** (334 raw `Color(0x`, 2,040 raw `EdgeInsets`/`SizedBox`, 712 raw `fontSize:`, 4 competing color classes); and the V1 §10 instruction to **delete the mobile parity catalog (TD-5) was not done** — `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` are still present and routed.

### Overall design-maturity score: **2.8 / 5** (↗ from the June-09 reports' 2.3)

The half-point uplift over the prior `DESIGN_SYSTEM_MASTER_AUDIT.md` (2.3) reflects three concrete, verified changes since June-09: canonical theme provider built **and** adopted 9/9; a CI-enforced design-system ratchet gate; and a DTCG `tokens.json` interchange file. It is held below 3.5 by: grandfathered drift (the gate freezes rather than repays), 0/9 shell adoption, stylelint still uninstalled, mobile divergence, and dark-mode unreachability.

---

## 2. Token-system reality (what's actually there, and is it consumed?)

### 2.1 The engine — `packages/typescript/ui/src/tokens.ts` (1,389 lines) — is Polaris-grade

A genuine **primitive → semantic → component** three-tier model, plus density / surface / motion axes:

| Tier | Symbol | Location | Notes |
|---|---|---|---|
| Primitive | `letbuyyPrimitiveTokens` | `tokens.ts:47-121` | purple 100-900, gray 50-900 (+125/150/175), slate, green/amber/red/blue, opacity. Brand purple `#8B5CF6`/`#7C3AED`. |
| Semantic | `letbuyySemanticTokens` | `tokens.ts:186-315` | full `light` **and** `dark` role sets: background/button/text/border/accent/status/statusText/statusSoft/focusRing/overlay. |
| Component | `letbuyyComponentTokens` | `tokens.ts:317-488` | per-component light/dark: button, card, sidebar, emptyState, input, table, pageHeader, badge, banner. |
| Density | `letbuyyDensityTokens` | `tokens.ts:500-585` | compact / comfortable / spacious — heights, paddings, gaps, icon sizes, even empty-state illustration sizing. |
| Type/space/radius/shadow/z/motion/size | `letbuyyTokens.*` | `tokens.ts:672-800` | type scale (incl. fluid `clamp()` display/h1/h2), 12-step space scale (`0`–`7xl`), 5 radii, 5 shadows, 8 z-indices, motion durations+easings, 40+ semantic sizes. |
| Breakpoints | `letbuyyBreakpointTokens` | `tokens.ts:125-147` | xs 360 / mobile 480 / sm 640 / md 768 / lg 1024 / xl 1280, exported as a Tailwind preset. |
| CSS emitter | `letbuyyTokenCss` | `tokens.ts:1274-1388` | serializes every tier to `--lb-*` custom properties under theme/density/surface selectors. |

Rare extras most teams never build: **per-tenant brand injection** (`createLetbuyyBrandVariables`) and **runtime WCAG contrast validation** (`validateLetbuyyBrandContrast`, `tokens.ts:1154-1185`, AA 4.5 / focus 3.0, with a real luminance implementation at `:1135-1152`). A `prefers-reduced-motion` block zeroes all motion tokens (`tokens.ts:1360-1372`). **On architecture alone this is 4.5/5 work.**

### 2.2 Is it consumed, or do apps hardcode? — Both.

The token CSS **reaches the DOM 9/9**: every app wraps its root in `LetbuyyThemeProvider` → `DesignSystemRoot`, which injects `letbuyyTokenCss` once via `TokenStyleBoundary`. So `var(--lb-*)` is available everywhere. **But** the customer-facing apps largely bypass it in hand-authored CSS and inline styles. The measured hardcode density (§6) is the proof: `merchant-control-plane/src/app/globals.css` is **10,335 lines**, `app-marketplace` **7,475**, `marketing-site` **5,319**, `identity-platform` **2,005** — versus **38** and **37** for the two operations apps. Those mega-stylesheets are where the raw `rgb()`/px live.

**The single best new fact:** raw **hex is effectively eliminated** — only **25 hex literals remain platform-wide**, all in `marketing-site/src/app/globals.css` (e.g. `:4934 #020303`, `:4936 #fff`, `:5095 #fff`). The June-09 reports' "560 naked rgb() + 25 hex" has become "0 app-CSS hex except marketing's 25; drift migrated entirely into `rgb()/hsl()` functions and raw px." The ESLint `no-hardcoded-hex` rule (error) plus the ratchet's `tsxRawHex: 0` / `appCssRawHex: 0` invariants did their job.

### 2.3 Interchange & cross-platform — improved, still split

- **`tokens.json` (W3C-DTCG) now exists** at `packages/typescript/ui/tokens.json` and is **CI-gated** by `scripts/generators/generate-design-tokens.mjs --check` (`architecture-governance.yml:61`). This closes the prior TOK-6 ("no machine-readable manifest"). `tokens.ts` remains the authoring source; `tokens.json` is its projection for Figma/codegen.
- **Mobile bridge** `mobile-tokens.ts` → `scripts/generators/generate-mobile-tokens.mjs` → `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart`, CI-gated by `validate:mobile-tokens` (package.json:25). But it covers **colors + spacing only, no typography**, and — critically — **the live Flutter `ThemeData` does not consume it** (§5, §7). Parity is real; relevance is ~6%.

**Token-system sub-scores:** architecture/tiering **4.5** · completeness **4.5** · interchange/manifest **3.5** (was 2.0 — `tokens.json` shipped) · enforcement **2.5** (ratchet exists but freezes drift; stylelint uninstalled; ESLint color rules warn-only) · cross-platform parity **2.0** (bridge bypassed on mobile).

---

## 3. The big SCORING MATRIX (apps × 9 categories, 0–10)

Scale: 0 = absent/broken · 5 = functional with gaps · 8 = strong · 10 = Polaris/Linear reference. Scores are **source-evidence-based**; "responsive" and "dark mode" carry an UNVERIFIED rendering caveat. **DM** = dark mode, **Comp** = component consistency, **A11y** = accessibility, **Nav** = navigation, **Hier** = visual hierarchy.

| App | Spacing | Type | Padding/Layout | Responsive | DM | Comp | A11y | Nav | Hier | **Avg** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **merchant-control-plane** | 5 | 6 | 6 | 7 | 6 | 6 | 8 | 8 | 7 | **6.6** |
| **platform-operations-portal** | 9 | 9 | 8 | 6 | 7 | 6 | 5 | 7 | 6 | **7.0** |
| **platform-console** | 9 | 9 | 8 | 6 | 6 | 6 | 4 | 7 | 6 | **6.8** |
| **theme-marketplace** | 7 | 7 | 7 | 7 | 6 | 6 | 6 | 5 | 6 | **6.3** |
| **developer-portal** | 8 | 6 | 7 | 5 | 5 | 5 | 3 | 5 | 6 | **5.6** |
| **app-marketplace** | 4 | 4 | 5 | 5 | 5 | 5 | 7 | 4 | 6 | **5.0** |
| **identity-platform** | 4 | 4 | 5 | 5 | 4 | 5 | 5 | — | 6 | **4.8** |
| **storefront-runtime** | 3 | 3 | 4 | 6 | 4 | 4 | 5 | 4 | 6 | **4.3** |
| **marketing-site** | 2 | 2 | 4 | 7 | 2 | 4 | 4 | 4 | 6 | **3.9** |
| **mobile/merchant-app (Flutter)** | 2 | 1 | 3 | 6 | 7 | 4 | 5 | 6 | 6 | **4.4** |
| **PLATFORM AVERAGE** | **4.8** | **5.1** | **5.6** | **6.0** | **5.2** | **5.0** | **4.8** | **5.3** | **6.1** | **5.4 / 10** |

**Reading the matrix (per category):**
- **Spacing (4.8):** bimodal. Ops apps 9 (near-zero raw px); merchant 2,210 raw px, app-marketplace 1,608, marketing 1,245, mobile 2,040 `EdgeInsets`/`SizedBox`. The 12-step `--lb-space-*` scale is excellent and unused where it matters most.
- **Typography (5.1):** ops apps consume type tokens; storefront/marketing/mobile carry 712 (mobile) + ~720 (web CSS) raw `fontSize:`. Mobile is 1/10 — **0 type-token refs, 44 inline `GoogleFonts.inter(...)`**.
- **Dark mode (5.2):** library-complete and adopted 9/9, but reachable (has a toggle) in only **merchant + theme-marketplace**; mobile dark is the most complete *rendered* dark UX but on the wrong (ui_kit) palette.
- **A11y (4.8):** merchant 469 `aria-*` / 105 focus-visible (8/10) leads; console/ops rose to 4–5 now that `AppNavigation` supplies `aria-current` + landmarks; **developer-portal is now the weakest** (0 `role`, 2 focus-visible).
- **Nav (5.3):** shell adoption rose from 0/9 to **2/9** — console/ops now use canonical `AppNavigation` (active state + `aria-current` + canonical width) and jump to 7/10; merchant's IA is operator-first (8/10); the other 7 apps still hand-roll (4–5/10).

Per-app one-line justifications are in §4.

---

## 4. Per-app evidence (the scores, defended)

**merchant-control-plane — 6.6 (the primary OS).** Best a11y on the platform (469 `aria-*`, 23 `role`, 105 `focus-visible`; 187 Tailwind responsive breakpoints). Deepest `@letbuyy/ui` adoption (~74 import files). IA is genuinely operator-first (§9). Theme editor is the platform's best surface (§11). Dragged down by the **10,335-line globals.css** carrying **2,210 raw px** and **405 `rgb()/hsl()`**, and **112 app-local `--lb-*`/alias redefinitions** (though most `--header-*` aliases now derive from canonical tokens via `color-mix()`, `globals.css:50-59` — an improvement over the prior "fragile second token layer"). Spacing scored low (5) purely on raw-px density.

**platform-operations-portal — 7.0 / platform-console — 6.8 (the clean twins — now the platform's top scorers).** Almost no hand-CSS (37/38 lines), so spacing/type/layout all 8–9. **Both now adopt the canonical `AppNavigation` shell** (`(dashboard)/layout.tsx:1`), which supersedes the June-09 NAV-1/NAV-2 findings: they get route-computed active state, `aria-current`, and the canonical width scale **for free** — so the earlier "no `usePathname`, no active highlight" critique is now stale (the active-state logic lives inside `AppNavigation` via `isNavItemActive`, not in the layout). Remaining gaps: they still push *color* drift into `className` (**console 134 Tailwind-palette classes, ops 44**; raw `bg-gray-*`/`text-slate-*` survive), and broader a11y is still thin outside the nav (console `aria-*` is concentrated in the now-canonical nav; non-nav surfaces have few roles). The `_local-ui/console-workspace.tsx` + `ops-workspace.tsx` twins still exist (self-tagged `[CONSOLIDATE -> @letbuyy/ui]`); the validator's `localWorkspaceImplementations` ratchet reports **0** because the twins no longer use `<main/article/section className=>` shells — refactored just under the gate's regex, not consolidated.

**theme-marketplace — 6.3.** Token-disciplined CSS (293 lines), 90 focus-visible, 127 responsive breakpoints, has a real theme toggle (5 theme-control files). Mixed chrome: top navbar + dashboard sidebar, `bg-white/[0.06]` glassy nav that won't theme cleanly (123 Tailwind-palette classes). Two nav surfaces, `pathname === href` active state.

**developer-portal — 5.6.** Clean-ish CSS (438 lines, 45 px, 12 rgb). But **0 `role`, only 22 `aria-*`, 2 focus-visible** across the app, and `_local-ui/developer-docs.tsx` is a 554-line file hand-rolling 15+ bespoke `*Matrix`/`*Table` renderers instead of the `Table` it imports (DUP-5, still current).

**app-marketplace — 5.0.** Surprisingly good a11y (262 `aria-*`, **18 alt / 18 imgs = full alt coverage**, 34 `role`). But it carries the **2nd-largest globals.css (7,475 lines)** with **1,608 raw px** and **252 `rgb()/hsl()`**, plus a marketing mega-menu header (`Header.tsx`) using `rgba(5,7,12,0.98)` that won't theme.

**identity-platform — 4.8.** Auth screens (login, signup, forgot/reset/set-password, lookup, select, onboarding, check-email). globals.css grew to **2,005 lines**; **43 inline `style={`** and **11 `!important`** (the most `!important` of any app). Only 41 `aria-*` for security-critical forms; alt coverage fine (3/3). No primary nav (auth flow only). Reachable dark mode: no toggle.

**storefront-runtime — 4.3 (the worst-drift app).** Largest customer surface, shallowest token adoption (uses ~4 primitives across 42 import files). Carries the platform's worst raw-value load: **794 `rgb()/hsl()`, 582 inline `style={`, 231 Tailwind-palette classes, 1,056 raw px.** **Important nuance:** a large share of those inline styles are *legitimate dynamic theming* — the storefront renders each merchant's chosen colors (`style={{ backgroundColor: colors.backgroundColor }}`, `product-details-client.tsx:125`), which is correct and not "hardcoding." But genuine hardcodes are mixed in (`coming-soon/page.tsx:95` `color:'rgb(252 165 165)'`, `:129` `background:'rgb(5 5 5)'`). The honest read: storefront is a **bespoke runtime that consumes per-store theme tokens, not the `--lb-*` admin tokens** — partly by design, partly debt.

**marketing-site — 3.9 (exiled from the gate).** The only app **explicitly exiled** from the design-system ratchet (`design-system-baseline.json` → `exiledApps: ["apps/marketing-site"]`; `validate-design-system.mjs:55,66`). It owns **all 25 of the platform's hex literals**, **355 `rgb()/hsl()`**, **1,245 raw px**, a 5,319-line globals.css with **76 `@media` queries** (its responsiveness is hand-CSS, not token breakpoints), and **0 focus-visible** rules → keyboard-focus a11y is effectively absent. It is governance-quarantined "until a product-owned token migration decision."

**mobile/merchant-app (Flutter) — 4.4.** See §5/§7. Strong rendered dark mode (7) and decent navigation/hierarchy on the strength of the theme editor screens; catastrophic on tokens (spacing 2, type 1).

---

## 5. Duplicate-design-system register (every shell / component-lib implementation path)

**Distinct design systems / token sources: 3** (1 web TS library, 1 Dart library, 1 generated-but-bypassed Dart bridge) — and at the *shell* level, **8 hand-rolled navigations remain** (down from 10: console + ops adopted the canonical `AppNavigation`) plus **4 competing mobile color classes**.

### Web — canonical libraries
| # | Implementation | Path | Status |
|---|---|---|---|
| A | `@letbuyy/ui` (the one real web library, ~34 export groups / ~60 components) | `packages/typescript/ui/src/index.ts` | Canonical, imported 9/9 |
| B | `@letbuyy/theme-engine` (storefront Liquid/section schemas — separate concern) | `packages/theme-engine/src/` | Storefront runtime, not admin DS |

### Web — shell / nav (canonical `AppNavigation` now has 2 consumers; 7 apps still fork)
| App | Nav implementation | Active-state strategy |
|---|---|---|
| canonical shell | `packages/typescript/ui/src/navigation/app-navigation.tsx` (composes `AppFrame`+`Sidebar`+`Navigation`; `app-shell.tsx`) | route-computed `isNavItemActive` → `aria-current` |
| **platform-console** | **adopts `AppNavigation`** (`(dashboard)/layout.tsx:1`, `NAV_SECTIONS`) | **canonical (built-in)** |
| **platform-operations-portal** | **adopts `AppNavigation`** (`(dashboard)/layout.tsx:1`, `NAV_SECTIONS`) | **canonical (built-in)** |
| merchant-control-plane | `src/components/{AdminShell,Sidebar,HeaderBar,AISidebar}.tsx` + `merchantNavigation.ts` | query-aware `isNavPathActive` |
| theme-marketplace | `src/components/navbar.tsx` + `src/app/dashboard/layout.tsx` | `pathname === href` |
| developer-portal | `src/components/_local-ui/PortalChrome.tsx` | header nav |
| app-marketplace | `src/components/Header.tsx` (mega-menu) | "active" = dropdown-open |
| marketing-site | `src/components/Header.tsx` (mega-menu) | "active" = dropdown-open |
| storefront-runtime | `src/components/layout/dynamic-header.tsx` + `account/layout.tsx` | `usePathname` |
| identity-platform | — (auth flow, no primary nav) | n/a |

**8 hand-rolled implementations remain across 7 apps; canonical shell consumers: 2 (console, ops).** This supersedes the June-09 "0/9 / 10 implementations." `AppNavigation` (`app-navigation.tsx:51-88`) reads `usePathname` (line 62), computes `active` per item (line 76), and defaults to the canonical `width='md'` — so the two ops apps inherit consistent width + active state + `aria-current`. The remaining 7 still diverge (4 widths, mixed/no active state).

### Web — composite duplication (still current)
- `_local-ui/console-workspace.tsx` ≈ `_local-ui/ops-workspace.tsx` (workspace grammar twins, `[CONSOLIDATE]`-tagged).
- StatusBadge/StatusPill re-derived 5× (console/ops workspaces, `ConsoleDataTable.tsx`, `developer-docs.tsx`, `PortalChrome.tsx`) despite exported `Badge`.
- `developer-docs.tsx` — 15+ bespoke table renderers vs the imported `Table`.
- `app-marketplace` vs `marketing-site` `{Header,Footer}.tsx` — duplicated marketing chrome.

### Mobile — 3 token sources + 4 color classes (forks the system, verified)
| # | File | Class | Role |
|---|---|---|---|
| 1 | `packages/dart/ui_kit/.../tokens/letbuyy_tokens.dart` | `LetbuyyColorTokens` (semantic) + `LetbuyyPrimitiveTokens`/`LetbuyySpacingTokens`/`LetbuyyTypographyTokens`/`LetbuyyRadiusTokens`/`LetbuyyShadowTokens`/`LetbuyyDensityTokens` | bound by `store_theme.dart` ColorScheme |
| 2 | `packages/dart/ui_kit/.../themes/app_colors.dart` | `AppColors` | live theme + ~343 screen refs; `success #A4E500`, `error #B02525` diverge from web |
| 3 | `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` (generated) | `LetbuyyColorTokens` (primitive) | imported by ~62 screens as `mobile_tokens`; **NOT** imported by the theme |
| 4 | `apps/mobile/merchant-app/lib/theme/{store_admin_colors,light_theme_colors,dark_theme_colors}.dart` | `StoreAdminColors`, `LightThemeColors`, `DarkThemeColors`, `AppThemeColors` | additional per-screen palettes |

Two classes share the name `LetbuyyColorTokens` (collision still active). Net: **the in-sync generated bridge feeds screen code but not the `ThemeData` that actually colors the app** — mobile is, in practice, a separate design system.

---

## 6. Hardcoded-style quantification table (per app, current tree)

Counts from `grep -rhoE` over `apps/<app>/src` (`.tsx`/`.ts`/`.css`). "Hex" = `#rgb`/`#rrggbb(aa)`; "rgb/hsl" = `rgb()/rgba()/hsl()/hsla()`; "px" = any `\d+px`; "inline" = `style={` in TSX; "TW-palette" = default Tailwind color classes (`bg-gray-*`, `text-slate-*`, `bg-white`, …); "!imp" = `!important` in CSS; "globals" = lines in `globals.css`.

| App | Hex | rgb/hsl | px | inline style={ | TW-palette | !imp | globals.css LOC |
|---|--:|--:|--:|--:|--:|--:|--:|
| merchant-control-plane | 0 | 405 | 2,210 | 24 | 5 | 3 | **10,335** |
| app-marketplace | 0 | 252 | 1,608 | 1 | 0 | 4 | 7,475 |
| marketing-site | **25** | 355 | 1,245 | 1 | 71 | 1 | 5,319 |
| storefront-runtime | 0 | **794** | 1,056 | **582** | **231** | 6 | 552 (+1,473 other CSS) |
| identity-platform | 0 | 141 | 629 | 43 | 0 | **11** | 2,005 |
| theme-marketplace | 0 | 69 | 199 | 0 | 123 | 0 | 293 |
| developer-portal | 0 | 12 | 45 | 0 | 0 | 0 | 438 |
| platform-console | 0 | 10 | 11 | 0 | 134 | 0 | 38 |
| platform-operations-portal | 0 | 10 | 16 | 0 | 44 | 0 | 37 |
| **WEB TOTAL** | **25** | **2,048** | **7,019** | **651** | **608** | **25** | — |
| mobile/merchant-app (Dart) | — | 334 `Color(0x` | 712 `fontSize:` | n/a | 1,243 `Colors.*` | — | 2,040 `EdgeInsets`/`SizedBox` |

**The ratchet baseline that "passes" today** (`design-system-baseline.json`, scoped to non-exiled apps, regex differs slightly from the raw greps above): `appCssNakedRgbHsl: 573` · `tailwindPaletteClasses: 606` · `rawPxFontSize: 536` · `rawPxSpacing: 1,382` · `tsxInlineStyles: 638` · `appLocalLbTokenRedefs: 112` · `tsxArbitraryRadius: 328` · `tsxArbitraryShadow: 8` · `appCssRawHex: 0` · `tsxRawHex: 0`. These are the numbers CI freezes — they may only go down.

**Read:** drift is **concentrated** — 3 apps (merchant, app-marketplace, marketing) own ~80% of raw px; storefront owns the inline-style and `rgb()` debt; console/ops own the Tailwind-palette debt. Hex is solved. The debt did not disappear; it **moved channels** (hex → rgb()/px/className) ahead of the gate, and the gate baselined it.

---

## 7. Dark-mode audit

**Library: systematic and now correct.** `LetbuyyThemeProvider` (`theme-provider.tsx`) is the single canonical controller: one persistence key `localStorage["letbuyy-theme"]`, one vocabulary `light|dark|system`, one DOM-signal set (`<html data-theme=…>` + `.light|.dark` class), and it feeds the **resolved** theme directly into `DesignSystemRoot` (`theme-provider.tsx:169`). `ThemeScript` is the single blocking pre-paint flash-preventer (`:208-223`).

**THEME-1 cascade bug — FIXED.** The June-09 reports' headline dark-mode defect was that `DesignSystemRoot` defaulted `theme="auto"`, and the emitter (`tokens.ts:1281-1292`) makes `[data-letbuyy-theme="auto"]` render **light** unless the OS is in dark mode — so apps toggling `.dark` on `<html>` stayed light on a light-OS machine. The provider now passes a concrete `resolvedTheme` (never `"auto"`), and the **`validate:design-system` HARD invariant bans `theme="auto"` in any app layout and bans direct `<DesignSystemRoot>` usage** (`validate-design-system.mjs:115-116`). Verified: HARD invariants report **OK**; 9/9 layouts wrap the provider + render `ThemeScript`.

**The remaining dark-mode failure is REACHABILITY, not wiring.** A complete dark theme exists and is applied — but most apps give the user **no way to switch to it**:

| App | Provider wired | Has a theme toggle (`useTheme`/setTheme/ThemeToggle) | Dark reachable? |
|---|:--:|:--:|:--:|
| merchant-control-plane | yes | **yes** (3 files) | yes |
| theme-marketplace | yes | **yes** (5 files) | yes |
| storefront-runtime | yes | no (0) | system-only |
| identity-platform | yes | no (0) | system-only |
| app-marketplace | yes | no (0) | system-only |
| developer-portal | yes | no (0) | system-only |
| marketing-site | yes | no (0) | system-only |
| platform-console | yes | no (0) | system-only |
| platform-operations-portal | yes | no (0) | system-only |

Because `defaultTheme = 'system'`, those 7 apps follow the OS but offer no in-app override. That's a defensible default — but it means LetBuyy has no *deliberate* dark mode in 7 of 9 apps; it has *whatever the OS says*. **(UNVERIFIED: actual rendered contrast in dark for the customer-facing apps that re-author colors — storefront/marketing render their own palettes, not the `--lb-*` dark ramp, so dark correctness there is per-store and unmeasured at source.)**

**Mobile dark** is the most *complete rendered* dark UX (symmetric light/dark `ThemeData`, default `dark`, key `app_theme_mode`) but renders ui_kit `AppColors` teal body text (`#D3E4E3/#AED9D8/#89CBCB`), not the canonical slate ramp — right mechanism, wrong palette.

---

## 8. Accessibility audit (source-level; UNVERIFIED at render)

Measured `aria-*` / `role` / `alt` vs `<img>/<Image>` counts (`grep` over `src/**/*.tsx`):

| App | aria-* | role | alt / imgs | focus-visible | Verdict |
|---|--:|--:|--:|--:|---|
| merchant-control-plane | 469 | 23 | 6/6 | 105 | **Strong** — best on platform |
| app-marketplace | 262 | 34 | 18/18 | 20 | Good; full alt coverage |
| marketing-site | 76 | 3 | 4/4 | **0** | alt ok; **no keyboard focus styling** |
| theme-marketplace | 74 | 14 | 17/17 | 90 | Good |
| storefront-runtime | 84 | 5 | 25/25 | 5 | alt ok; thin aria/focus for largest surface |
| identity-platform | 41 | 12 | 3/3 | 7 | **Thin for security-critical auth forms** |
| developer-portal | 22 | **0** | 0/0 | 2 | **Weak** — no roles, ~no focus mgmt |
| platform-operations-portal | 13 | 0 | 0/0 | 44 | Weak aria; focus ok |
| platform-console | **1** | **0** | 0/0 | 31 | **Worst** — 1 aria attr in whole app |

**Findings:**
- **Library a11y is good** — the canonical `Navigation` emits `aria-current="page"`, `EmptyState`/`Badge`/`Modal` are role-aware, and the token CSS honors `prefers-reduced-motion` (`tokens.ts:1360-1372`). Apps that *adopt* it inherit this.
- **The shell-fork apps lose it.** Because console/ops/theme-mktpl/marketing/storefront hand-roll nav, they don't get `aria-current` or focus management for free. `platform-console` (1 `aria-*`, 0 `role`, no active state) is the clearest casualty.
- **Touch targets (mobile):** density tokens define ≥44px control heights (`letbuyyDensityTokens.comfortable.buttonHeight = 40px`, sidebar rows 44px) — adequate **if used**; mobile uses 0 density tokens, so target sizing is per-widget and **UNVERIFIED**.
- **Color contrast:** the library ships a real validator; primitive ramps look AA-capable, but I did not render any screen, so **per-screen contrast is UNVERIFIED**. Flag: marketing's `0` focus-visible and storefront's per-store colors are the highest contrast/keyboard risk.
- **Form labels / semantic HTML:** the ESLint `no-raw-elements` (error) and `no-raw-form-controls` (warn) rules push apps toward labeled DS controls; identity's 43 inline styles + thin aria on auth forms is the spot to manually review.

---

## 9. Navigation / IA audit — operator-first verdict (V1 §10)

**Verdict: merchant-control-plane IS operator-first. V1 §10's central demand is MET for the store profile** — with one caveat (no first-class Money node) and the platform-wide caveat that the canonical shell is unused.

Evidence — `merchantNavigation.ts:63-123`, the store IA, in order:
**Home → Orders → Products → Customers → Marketing → Content → Analytics → Online Store → Add (apps) → Settings.**
- **Orders, Products, Customers are top-level primary items** (`section: 'primary'` default), **not** buried under Settings. Settings is correctly demoted to `section: 'bottom'` (`:49-55`). This is the Shopify pattern.
- Operator affordances are real: keyboard shortcuts (`g o` orders, `g p` products, `g c` customers, `g i` inventory, `n p` new product), a **command palette** with quick actions ("Create product", "Find order", "Find customer", "Update inventory", "Customize theme", "Install app", "Review discounts" — `:294-341`), and child sub-nav per section.
- **The one real IA gap vs V1 §10's "Orders / Money / Customers primary":** there is **no dedicated top-level Money / Finance / Payouts node.** Money is implicit inside Orders + Analytics. For a commerce OS this is the single highest-value nav addition.
- Scope note: the OS serves **5 site types** (store/portfolio/resume/landing/blog, `:205-211`), each with a tailored nav. This is product breadth, not a design defect, but it dilutes "the merchant OS is an e-commerce OS."

**Cross-app nav consistency: improving but still poor (2/9 on the shell).** The canonical `AppNavigation` now has 2 consumers (console, ops) — they share width, active state, and `aria-current`. The other 7 apps still hand-roll: 8 remaining implementations, ~4 sidebar widths (`w-56` theme dashboard, `w-64` storefront account, merchant's own, `260px` canonical default), and mixed/dropdown-as-active strategies. Marketing/storefront nav chrome is hardcoded (`marketing-site/Header.tsx` `rgb(255 255 255)`; `app-marketplace` `rgba(5,7,12,0.98)`) and won't theme. The fix path is proven (console/ops did it); it just needs to reach merchant + the rest.

---

## 10. Responsive audit (source-level; UNVERIFIED at render)

Breakpoint tokens are well-defined (`tokens.ts:125-141`, 6 steps, exported as Tailwind preset). Adoption splits by app architecture:

| App | `@media` (CSS) | Tailwind `sm:/md:/lg:` | Strategy |
|---|--:|--:|---|
| merchant-control-plane | 19 | 187 | Tailwind-first, healthy |
| storefront-runtime | 6 | 194 | Tailwind-first |
| theme-marketplace | 2 | 127 | Tailwind-first |
| platform-console | 1 | 84 | Tailwind-first |
| platform-operations-portal | 1 | 44 | Tailwind-first |
| marketing-site | **76** | 1 | Hand-CSS `@media` (un-tokenized) |
| app-marketplace | 8 | 0 | Hand-CSS `@media` |
| identity-platform | 5 | 0 | Hand-CSS `@media` |
| developer-portal | 3 | 0 | Hand-CSS `@media` |

**Read:** responsive *coverage* exists everywhere, but via **two incompatible strategies** — Tailwind breakpoints (ops/merchant/storefront/theme) vs hand-rolled `@media` (marketing/app-marketplace/identity/developer). The hand-CSS apps risk breakpoint values drifting from the token scale (their `@media` queries use literal px, not `--lb-bp-*`). **Overflow / actual reflow at each viewport is UNVERIFIED** — not testable from source. Mobile-web behavior of the desktop-first marketing/app-marketplace surfaces is the highest unverified risk.

---

## 11. Theme-editor UX (the differentiator — "protect it")

**This is the strongest surface in the platform and it earns the V1 "differentiator" label.** Location: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — **1,892 lines** — plus `src/components/theme-editor/{CenterPanel,SchemaFormRenderer}.tsx` (556 lines).

Verified UX capabilities (from source):
- **Three-panel Shopify-class layout:** sections/settings/versions left panel (`PanelMode`), live `CenterPanel` preview, schema-driven settings form.
- **Device preview** desktop / tablet / mobile (`PreviewDevice`, `PREVIEW_DEVICES` with explicit widths, `:160`).
- **Full undo/redo history stack** (`EditorHistory {past, future}`, `canUndo`/`canRedo`, keyboard-bound at `:885-889` → `undo()`/`redo()`).
- **Draft/publish versioning** (`draftVersion`, `currentReleaseVersion`, `release_version`, `published_at`, `isPublishing`) — a real release model, not a toy.
- **Schema-driven forms** via `SchemaFormRenderer` (16KB) reading `@letbuyy/theme-engine` section/block/settings schemas — drag-reorderable sections (`GripVertical`, block `order`/`visible`).
- **AI assist** affordances (`Bot`, `WandSparkles`, `Sparkles`) wired into the editor chrome.
- Built on `@letbuyy/ui` primitives (`Button`, `Badge`, `ConfirmDialog`, `SaveBar`, `Select`, `useToast`).

**UX-governance caveats (not architecture — Phase 9 owns that):**
1. It imports `letbuyyPrimitiveTokens` (the raw TS object) directly, so some editor chrome colors are JS-literal rather than `var(--lb-*)` — minor, but it's the one place the editor sidesteps the CSS-variable layer.
2. The storefront side that *renders* the theme defaults **Liquid rendering OFF** (`theme-governance-validator.mjs:56` → `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`) and renderer governance to **WARN** (`:53`), with an explicit `UnknownSectionFallback` placeholder for unknown sections (`:68`). So the editor can compose sections the runtime renders as fallbacks — the editor is ahead of the renderer. That's a deliberate safety gate, but it caps the *delivered* differentiation until the Wave-6 product decision flips Liquid on.

**Empty-state system (the other strong point, confirmed):** `docs/design-system/empty-states/` ships **36 SVG motif assets** + `motifs.manifest.json` + `gallery.html` + a generator, and `@letbuyy/ui` exports `EmptyState`/`EmptyStateIllustration` (token-driven, density-aware via `letbuyyComponentTokens.*.emptyState`). This is genuinely above-market polish.

---

## 12. Governance-enforcement reality — does it BLOCK, or is it advisory?

**It now blocks — but it blocks the wrong thing (new drift), not the accumulated debt, and one of the three gates is unarmed.** This is the most-changed area vs June-09.

**Gate 1 — `validate:design-system` (REAL, CI-enforced, the new keystone).** `scripts/validators/validate-design-system.mjs` (dependency-free Node) runs in **both** `ci.yml:87` and `architecture-governance.yml:58` (the latter on every PR touching `apps/**`/`packages/**`). It enforces:
- **HARD invariants (must be ZERO):** no `<DesignSystemRoot>` direct in app layouts; no `theme="auto"`; no legacy persistence keys (`letbuyy_theme`/`theme-marketplace-theme`); no bespoke `theme-provider` files; no `_local-ui` workspace shells. **Currently passing.**
- **RATCHET invariants:** the 11 drift metrics in `design-system-baseline.json` — **may only decrease**; any increase fails CI (`:173`). **Currently passing at the frozen baseline.**
This is the right architecture for a gate. **Its weakness is that it was seeded by baselining today's drift as acceptable**, so 573 rgb/hsl + 1,382 px + 638 inline styles "pass." It prevents regression; it does not compel repayment (only the `ratchetPerWavePercent: 10` convention nudges it down, and that's advisory).

**Gate 2 — `validate:design-tokens` (REAL, CI-enforced).** `generate-design-tokens.mjs --check` guards `tokens.json` ↔ `tokens.ts` parity (`architecture-governance.yml:61`). Closes prior TOK-6.

**Gate 3 — stylelint (WIRED BUT UNARMED).** `lint:css` **now exists** in `package.json:27` and `packages/typescript/ui/package.json:56`, and `.stylelintrc.cjs` is well-designed (bans hex, named colors, raw `rgb()/hsl()` outside the token layer). **But `stylelint` is not installed** — absent from every `devDependencies` and from `pnpm-lock.yaml` (`grep -c stylelint pnpm-lock.yaml` → 0), and **CI never calls `lint:css`** (`grep` over `.github/workflows/` → no `lint:css`/`stylelint` reference). So the dedicated CSS linter would error-out if run. The CSS channel is partly covered *by accident* — the `validate:design-system` ratchet regex now counts CSS `rgb()/hex/px` — but the purpose-built stylelint gate is one `pnpm add -D stylelint` away from real and isn't taken.

**ESLint plugin — partially armed (unchanged).** `@letbuyy/ui` ESLint plugin: `no-raw-elements` + `no-hardcoded-hex` = **error** (effective — TSX hex is 0); `no-raw-form-controls` / `no-raw-color-functions` / `no-tailwind-default-color` = **warn** in all 9 apps (`platform-console/eslint.config.mjs:18-20` representative). And **`turbo lint` runs changed-only** (`ci.yml:84` `--filter="...[HEAD^1]"`) and warnings don't fail. So the color/Tailwind-palette/form-control drift is visible-but-not-blocked, which is exactly why 606 Tailwind-palette classes and 573 rgb() survive.

**Net governance posture: 3.0/5** (↑ from the June-09 1.5). A real, CI-enforced ratchet gate now exists and the theme architecture is invariant-protected — a genuine step change. It's held below 4 because the gate freezes rather than repays drift, stylelint is wired-but-uninstalled, ESLint color rules are warn-only, and lint is changed-only.

---

## 13. Prior-report supersession notes (what's now stale)

| Prior report (root, 2026-06-08/09) | Claim | Current-tree reality (2026-06-10) |
|---|---|---|
| `DESIGN_SYSTEM_MASTER_AUDIT.md` | Overall 2.3/5; "turn on governance + force adoption" | **Partially superseded.** Governance turned on (ratchet gate + provider adoption). Now **2.8/5**. Adoption of the *shell* still 0/9. |
| `DESIGN_TOKEN_AUDIT.md` TOK-1 | stylelint "dormant — no dep, no script anywhere" | **Updated:** `lint:css` script now exists (root + ui pkg). **Still not installed / not in CI** — wired-but-unarmed, not dormant. |
| `DESIGN_TOKEN_AUDIT.md` TOK-3 / TOK-6 | "no design/token/CSS validator in CI"; "no machine-readable manifest" | **Superseded.** `validate:design-system` + `validate:design-tokens` are CI gates; `tokens.json` (DTCG) exists. |
| `DESIGN_SYSTEM_MASTER_AUDIT.md` THEME-1/THEME-2 | `theme="auto"` cascade bug; "no shared controller, 5 strategies, 3 keys" | **Superseded — FIXED.** `LetbuyyThemeProvider` (one key `letbuyy-theme`, one vocabulary, resolved-theme feed) adopted **9/9**; HARD invariant bans `theme="auto"`. |
| `DESIGN_SYSTEM_ADOPTION_SCORECARD.md` | "0/9 shell adoption"; per-app 24–87 | **Superseded — now 2/9.** Console + ops adopted `AppNavigation`. Theme dimension's "100 but no controller" is now genuinely 100 (controller exists). Customer-app scores still low. |
| `DARK_MODE_GOVERNANCE_REPORT.md` / `LIGHT_DARK_MODE_AUDIT.md` | "reachable in only 4/9; 3 keys; cascade bug" | **Mixed.** Cascade fixed, 1 key now. But reachability is **worse than reported on one axis**: only **2/9 have a toggle**; the other 7 are system-only. |
| `NAVIGATION_GOVERNANCE_AUDIT.md` NAV-1/NAV-2 | 0/9 shell; console/ops twins no active state | **Superseded.** Console + ops now import & use `AppNavigation` (`(dashboard)/layout.tsx:1`) → canonical shell, route-computed active state, `aria-current`. Shell adoption 2/9, not 0/9. |
| `NAVIGATION_GOVERNANCE_REPORT.md` | merchant Navigation scored 35/100 | **Superseded — too harsh.** Merchant IA is operator-first/Shopify-grade (§9); I score its Nav **8/10**. |
| `COMPONENT_DUPLICATION_REPORT.md` DUP-3 | `_local-ui` workspace twins, `localWorkspaceImplementations` | **Partially stale.** Validator reports `localWorkspaceImplementations: 0` (refactored under the regex), but the twin files still exist and StatusBadge-5×/developer-docs-tables persist. |
| `MOBILE_DESIGN_SYSTEM_REPORT.md` | ~11.5% adoption; bridge bypassed; counts 324/1,155/712 | **Confirmed + slightly worse.** Counts grew to **334 `Color(0x` / 1,243 `Colors.` / 712 `fontSize:` / 2,040 EdgeInsets**. Bridge still bypassed. |
| `LETBUYY_MERCHANT_OS_*` (V1 §10 TD-5) | "remove `merchant_feature_screen.dart` / `_definitions.dart`" | **NOT DONE.** Both files present (`lib/screens/parity/`) and routed (`routes.dart`, `settings_screen.dart`). |
| `marketing-site` (all reports) | counted in platform drift totals | **Now EXILED** from the governance ratchet (`design-system-baseline.json`) — quarantined, not governed. |

---

## 14. Findings Register

Severity: **S0** = ships-broken/blocks merchant now · **S1** = serious, blocks a key flow or large surface · **S2** = consistency/debt that degrades quality · **S3** = polish. Fix complexity: **S** = config/hours · **M** = days · **L** = weeks.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| UIUX-001 | S1 | Governance | Ratchet gate baselines existing drift as "passing" | Baseline seeded from current counts, not zero | `scripts/validators/design-system-baseline.json` (573/1382/638/606); `validate-design-system.mjs:166-175` | 573 rgb/hsl + 1,382 px + 638 inline styles are permanently "OK"; debt frozen not repaid | M | Add a scheduled `--update` that auto-lowers each metric by `ratchetPerWavePercent:10` per release; make the budget *ratchet down on a clock*, not just "never up". |
| UIUX-002 | S1 | Governance | stylelint wired but not installed → CSS channel has no dedicated linter | `lint:css` script added; `stylelint` never added to deps; CI never calls it | `package.json:27`; `pnpm-lock.yaml` (0 hits); `.github/workflows/*` (no `lint:css`) | Hand-CSS `rgb()/px` only caught by the ratchet regex, not the purpose-built gate | S | `pnpm add -D stylelint stylelint-config-standard`; add `lint:css` to `turbo lint` + a CI step that fails on error. |
| UIUX-003 | S1 | Navigation | Canonical shell adopted only 2/9; 8 hand-rolled navs remain (incl. the primary merchant OS) | Shell adoption not gated; merchant predates `AppNavigation` | `navigation/app-navigation.tsx` (consumers: console+ops `(dashboard)/layout.tsx:1`); 7 apps still fork | ~4 widths, mixed active-state, inconsistent IA, lost a11y in the 7 | L | Roll `AppNavigation` to merchant next (proven by console/ops); add a HARD invariant forbidding new inline `<aside>` nav. |
| UIUX-004 | S1 | Mobile | Flutter is effectively a separate design system; generated token bridge bypassed by live theme | `ThemeData` binds ui_kit `AppColors`/`LetbuyyColorTokens`, not the generated bridge | `apps/mobile/.../theme/store_theme.dart` (imports ui_kit only); `letbuyy_color_tokens.dart` imported by screens not theme | Brand consistent but semantic colors off-spec (`success #A4E500`, `error #B02525`); ~6% token relevance | L | Point `store_theme.dart` light/dark at the generated tokens; delete the duplicate `LetbuyyColorTokens`; reconcile `AppColors`. |
| UIUX-005 | S1 | Mobile | Mobile spacing/type almost entirely un-tokenized | No Dart lint for raw `Color(`/`fontSize:`/`EdgeInsets`; bridge lacks typography | `grep`: 334 `Color(0x`, 712 `fontSize:`, 2,040 `EdgeInsets/SizedBox`, 0 density-token refs | Mobile can't theme; type/spacing drift from web | L | Extend `mobile-tokens.ts`+generator to emit type+density; add `dart_code_metrics` rule banning raw color/size outside theme layer; wire to CI. |
| UIUX-006 | S2 | A11y | console/ops a11y thin outside the (now-canonical) nav | Adopted `AppNavigation` (fixes nav a11y) but non-nav surfaces lack roles | console non-nav `*.tsx` → few `role`/`aria` beyond the shell | Nav is now SR-navigable; tables/panels/forms still under-labeled | M | Extend roles/labels to data tables + panels; reuse DS `Table`/`Badge`. (Nav a11y already fixed via `AppNavigation`.) |
| UIUX-007 | S1 | Mobile | V1 §10 TD-5 not done — parity catalog still shipped & routed | Deletion instruction not executed | `apps/mobile/merchant-app/lib/screens/parity/merchant_feature_screen.dart` + `merchant_feature_definitions.dart`; `app/routes.dart`; `settings/settings_screen.dart` | "Feature parity grid" contradicts operator-first; dead surface area | M | Delete both files + route + settings entry; redirect to the real screens. |
| UIUX-008 | S2 | Dark mode | Dark mode wired but not user-reachable in 7/9 apps | No theme toggle component rendered; `defaultTheme:'system'` | Only merchant (3) + theme-mktpl (5) have `useTheme`/toggle; 7 apps have 0 | No deliberate dark mode; users stuck on OS default | S | Add the existing `DensityToggle`-style theme switch to each app's header/account menu (the hook already exists: `useTheme()`). |
| UIUX-009 | S2 | IA | Merchant OS has no first-class Money/Finance nav node | IA built around Orders/Products; money is implicit | `merchantNavigation.ts:63-123` (no finance/payouts top-level item) | V1 §10 "Orders/Money/Customers primary" only 2/3 met; payouts buried | M | Add a top-level `Finance` (payouts, balances, statements) primary nav item. |
| UIUX-010 | S2 | Tokens | 606 Tailwind default-palette classes survive (console 134, theme-mktpl 123, storefront 231) | `no-tailwind-default-color` is warn-only; lint changed-only | `*/eslint.config.mjs:20`; `ci.yml:84` (`--filter`) | "Clean CSS" apps push drift into className; won't theme | S | Promote `no-tailwind-default-color` to error after burn-down; add a Tailwind `blocklist` of default color classes. |
| UIUX-011 | S2 | Tokens | merchant globals.css = 10,335 lines / 2,210 raw px / 405 rgb() | Pre-token CSS never migrated | `apps/merchant-control-plane/src/app/globals.css` | Largest single drift store on the primary OS | L | Migrate to `var(--lb-*)` against a ratcheting budget; biggest line-item in the repayment plan. |
| UIUX-012 | S2 | Tokens | storefront-runtime: 794 rgb(), 582 inline styles, 231 TW-palette | Bespoke runtime + per-store dynamic theming mixed with hardcodes | `storefront-landing.tsx:269`; `coming-soon/page.tsx:95,129`; `product-details-client.tsx:125` | Hard to distinguish legit dynamic theming from debt | L | Separate per-store dynamic colors (keep) from static hardcodes (`rgb(5 5 5)` → token); define a "storefront kit" of themable primitives. |
| UIUX-013 | S2 | Components | 10-nav / StatusBadge-5× / developer-docs 15+ table renderers duplication | No shell/composite adoption requirement | `_local-ui/{console,ops}-workspace.tsx`; `developer-docs.tsx` (554 lines); `ConsoleDataTable.tsx` | Forked logic drifts; bug-fixes don't propagate | M | Delete local StatusBadge → `Badge variant`; collapse `developer-docs` tables to configurable `Table`; consolidate workspace twins. |
| UIUX-014 | S2 | A11y | marketing-site has 0 keyboard-focus styling | Hand-CSS chrome, no focus-visible rules; app is governance-exiled | `apps/marketing-site/src/**` → 0 `focus-visible`; baseline `exiledApps` | Keyboard users get no visible focus on the public marketing surface | M | Add `:focus-visible` token styles; un-exile from the ratchet once migrated. |
| UIUX-015 | S2 | A11y | identity-platform thin aria + 43 inline styles + 11 !important on security forms | Auth screens built bespoke | `identity-platform/src/app/{login,onboarding,select,lookup}/page.tsx`; 41 `aria-*`, 11 `!important` | Auth a11y (label/announce/error) under-built; specificity wars | M | Manual a11y pass on auth forms; replace inline styles + `!important` with DS controls/tokens. |
| UIUX-016 | S2 | Governance | ESLint color/form rules warn-only; lint changed-only; warnings don't fail | `configs.recommended` severities; `turbo lint --filter` | `packages/typescript/ui/eslint/index.cjs:158-160`; `ci.yml:84` | Color/form drift visible but never blocked | S | Promote the three warn rules to error after burn-down; run lint repo-wide in a nightly + fail-on-warn there. |
| UIUX-017 | S2 | Consistency | Two responsive strategies (Tailwind bp vs hand `@media` px) | Marketing/app-mktpl/identity/developer predate the Tailwind preset | marketing 76 `@media` / 1 tw-bp; app-mktpl 8/0; identity 5/0 | Breakpoint values can drift from `--lb-bp-*` token scale | M | Adopt the `letbuyyTailwindPreset` screens everywhere; replace literal-px `@media` with token breakpoints. |
| UIUX-018 | S2 | Tokens | 112 app-local `--lb-*`/alias redefinitions shadow canonical tokens | Historical per-app theming | `merchant .../globals.css:50-59` (`--header-*`); baseline `appLocalLbTokenRedefs:112` | Second token layer to keep in sync (improved: many now derive via `color-mix(--lb-*)`) | M | Add stylelint rule forbidding redefinition of any `--lb-*` outside `@letbuyy/ui`; finish converting aliases to derivations. |
| UIUX-019 | S2 | Nav | Hardcoded marketing/storefront nav chrome won't theme | Pre-token headers | `marketing-site/Header.tsx` `rgb(255 255 255)`; `app-marketplace/globals.css` `rgba(5,7,12,0.98)`; `dynamic-header.tsx:199` inline `'white'` | Nav bars stay fixed across themes | M | Route nav colors through `--lb-color-*`; covered by stylelint (UIUX-002). |
| UIUX-020 | S2 | Theme editor | Renderer is behind the editor (Liquid default OFF, governance WARN) | Wave-6 product decision pending | `theme-governance-validator.mjs:53,56`; `renderer-registry.tsx` `UnknownSectionFallback` | Editor can compose sections the storefront renders as fallbacks; differentiation capped at delivery | M | Resolve the Wave-6 Liquid decision; flip renderer governance to error once the mismatch audit is clean. |
| UIUX-021 | S2 | Type scale | ~536 raw px font-sizes in app CSS (ratchet) + 720 raw in raw grep | Hand-CSS type not migrated | baseline `rawPxFontSize:536`; merchant/app-mktpl/marketing globals | Type sizes bypass the (excellent) type token scale | L | Migrate `font-size:Npx` → `var(--lb-font-size-*)`; ratchet down. |
| UIUX-022 | S2 | Spacing scale | ~1,382 raw px spacings in app CSS (ratchet) | Hand-CSS spacing not migrated | baseline `rawPxSpacing:1382`; merchant 2,210 / app-mktpl 1,608 raw px | 12-step `--lb-space-*` scale unused where debt is | L | Migrate padding/margin/gap → `var(--lb-space-*)`; ratchet down. |
| UIUX-023 | S2 | Tokens | 25 hex literals remain (all marketing-site) | App is governance-exiled | `marketing-site/.../globals.css:4934,4936,5095,5096…` | Only un-fixed hex on the platform | S | Convert to tokens; this is the last hex cleanup. |
| UIUX-024 | S2 | Components | Marketing Header/Footer duplicated across 2 apps | No shared marketing kit | `app-marketplace/src/components/{Header,Footer}.tsx` vs `marketing-site/...` | Brand chrome drifts between the two public surfaces | M | Extract `MarketingHeader`/`MarketingFooter` into a marketing kit in `@letbuyy/ui`. |
| UIUX-025 | S2 | Mobile | Mobile dark renders teal body text, not the slate ramp | `AppColors` dark palette off-spec | `apps/mobile/.../theme/app_colors.dart` `#D3E4E3/#AED9D8/#89CBCB` | Most-complete dark UX is on the wrong palette | M | Reconcile dark text colors to the canonical slate ramp (part of UIUX-004). |
| UIUX-026 | S2 | A11y | developer-portal: 0 `role`, ~0 focus management | Bespoke `PortalChrome`, hand tables | `developer-portal/src/**` → 22 aria / 0 role / 2 focus-visible | Docs portal weak for SR/keyboard | M | Add landmarks/roles; adopt DS `Table` + `Tabs`. |
| UIUX-027 | S2 | Consistency | 4 sidebar widths for one concept | Each nav picked its own literal | `w-72` (console/ops), `w-56` (theme), `w-64` (storefront), `260px` (canonical) | LetBuyy's left-nav is visibly different per app | S | Standardize on `Sidebar` `width` prop (`md`) — falls out of UIUX-003. |
| UIUX-028 | S3 | Tokens | 328 arbitrary `rounded-[…]` + 8 `shadow-[…]` Tailwind classes (ratchet) | One-off radii/shadows vs token scale | baseline `tsxArbitraryRadius:328`, `tsxArbitraryShadow:8` | Corner/shadow inconsistency | M | Map to `--lb-radius-*`/`--lb-shadow-*`; ratchet down. |
| UIUX-029 | S3 | Theme editor | Editor imports raw `letbuyyPrimitiveTokens` (JS) for some chrome | Convenience over CSS-var layer | `editor/page.tsx:38` import of `letbuyyPrimitiveTokens` | Minor: editor chrome partly JS-literal-colored | S | Use `var(--lb-*)` for editor chrome; keep primitives only for canvas/preview math. |
| UIUX-030 | S3 | Naming | `packages/token-core` misnames itself as the design-token home | It's the auth/JWT envelope package | `packages/token-core/src/index.ts:4` (`TokenKind`) | Agents/humans grep the wrong package for tokens (the mission brief did) | S | Rename to `@letbuyy/auth-token-core` or document the distinction in `AGENTS.md`. |
| UIUX-031 | S3 | Density | Density axis (compact/comfortable/spacious) defined but barely used | No UI to switch; defaults to compact | `tokens.ts:500-585`; `DensityToggle` exported but rarely rendered | A built capability sits idle | M | Expose density in merchant settings; it improves data-table operator UX. |
| UIUX-032 | S3 | IA | Merchant OS spans 5 site types (store/portfolio/resume/landing/blog) | Product scope breadth | `merchantNavigation.ts:205-211` | Dilutes "commerce OS" focus; more nav surface to keep consistent | L | Product decision; if commerce-first, demote non-store profiles behind a mode switch. |
| UIUX-033 | S3 | Consistency | StatusBadge tone→color logic re-derived instead of `StatusVariant` | Local convenience | `ConsoleDataTable.tsx:~89`, `developer-docs.tsx`, 2 workspaces | Status colors can diverge from token tones | S | Standardize on exported `Badge`/`StatusVariant`. |

---

## 15. Recommended remediation sequence

1. **Arm the third gate (hours):** install stylelint + wire `lint:css` to CI (UIUX-002); promote ESLint color/form rules to error after a short burn-down (UIUX-010, UIUX-016). This makes the *CSS and className* channels block, not just the ratchet regex.
2. **Make the ratchet repay, not just freeze (days):** a scheduled `--update` that lowers each metric 10%/release (UIUX-001). Without this, 573 rgb()/1,382 px sit forever.
3. **Adopt the shell where it's cheapest (weeks):** console → ops → merchant onto `AppFrame`/`Sidebar`/`Navigation` (UIUX-003) — instantly fixes console's a11y (UIUX-006), the active-state gap, and 4-width inconsistency (UIUX-027).
4. **Repay the mobile gap (weeks):** point `ThemeData` at the generated bridge + add type/density to it (UIUX-004/005), delete the TD-5 parity catalog (UIUX-007), add the Dart lint.
5. **Reach dark mode (hours):** drop the theme toggle into the 7 toggle-less apps (UIUX-008) — the hook already exists.
6. **Add the Money node (days)** to the merchant IA (UIUX-009) — the one thing standing between "operator-first" and "fully V1 §10-compliant."
7. **Burn down the 3 big globals.css** (merchant/app-marketplace/marketing) and un-exile marketing (UIUX-011/012/014/021/022/023).

---

## 16. UNVERIFIED (rendering-dependent, not testable from source)

- **Actual on-screen color contrast** for every screen (the library has a validator and AA-capable ramps, but I rendered nothing). Highest risk: marketing (0 focus-visible) and storefront/mobile (per-store/off-spec palettes).
- **Real responsive reflow / overflow** at each breakpoint, especially the hand-`@media` desktop-first apps (marketing, app-marketplace) on mobile web.
- **Dark-mode visual correctness** in the 7 apps where it's system-only and in the customer apps that re-author colors.
- **Touch-target sizes** in the Flutter app (density tokens would guarantee ≥44px but are 0% adopted).
- **Whether `validate:design-system` actually runs to completion in the real CI runner** (I executed it locally — it passes — but did not exercise the GitHub Actions environment).
- **Focus-trap / keyboard-nav behavior** of modals/command palette/theme editor at runtime (source shows the wiring; behavior unverified).
