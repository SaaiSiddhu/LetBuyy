# LETBUYY — UI/UX UNIFICATION MASTER PLAN

**Program:** Strategic Canonicalization 2026 · Architecture Review Board (ABR)
**Author:** Principal Design-Systems Architect (Polaris/Linear-grade)
**Date:** 2026-06-10
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (current working tree)
**Status:** CANONICAL design-system unification roadmap. Subordinate to `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (the constitution) and to `_ANCHOR_DECISIONS_SPINE.md` A8/A7. This document does not invent architecture — it sequences the repayment of design-system debt against the V1 100→10k envelope.

---

## 0. Title · Methodology · Evidence integrity

This plan is the design-systems deliverable of the canonicalization program. It answers one question per surface: **at 10,000 India merchants, what is the ONE canonical design system, and what gets demoted/deleted to get there?**

**Authoritative inputs (read in full, cited inline):**
- `_ANCHOR_DECISIONS_SPINE.md` **A8** (one token source = TS `@letbuyy/ui`/`packages/typescript/ui/src/tokens.ts` DTCG canonical for web; Dart `ui_kit` consumes a *generated bridge* from that single source; kill the 3rd bypassed Dart bridge + the 4 competing mobile color classes; ONE app shell `AppNavigation` across all surfaces; governance ratchet must **BLOCK** not baseline drift; stylelint wired in CI) and **A7** (operator-first IA; provider-mode honesty badge on every money/fulfillment surface).
- `FORENSIC_MASTER_2026_06_10/UI_UX_GOVERNANCE_AUDIT.md` (the Phase-8 source-level audit: per-app ×9 scoring matrix, 3 token sources, shell adoption 2/9, ratchet baselines that freeze drift, mobile-as-separate-DS, findings UIUX-001…033 with `path:line`).
- `FORENSIC_MASTER_2026_06_10/MOBILE_FORENSIC_AUDIT.md` (Phase-10 Flutter DS reality: 3 Dart token sources + 4 color classes, generated bridge bypassed by `ThemeData`, honesty badge absent → MOB-001…022).
- `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` **§10** (operator-first merchant OS; ships-before-beta list; delete the parity catalog/TD-5; honesty badge mandatory) + **§1 Principle 4** (mock-by-default, honest-always; a stub must never read as `success`).
- `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` **§4** (Phase-4 merchant-OS adjustments: redesign IA store-builder-first → operator-first; honesty badge across money/fulfillment) and the FREEZE risk register (R2 honesty).
- `FORENSIC_MASTER_2026_06_10/LETBUYY_MASTER_EXECUTION_PLAN.md` (the master Phase A–E ordering; DS/perf debt is Phase E, gated on Phase-C constitution unification; honesty badge is Phase B/D money-surface work).

**Evidence-integrity rule.** Every Current-State claim is grounded in `grep`/`rg`/file:line against the **current working tree, re-verified 2026-06-10**. This is a **source-level audit, not a rendered one**: contrast-on-screen, focus-ring visibility, reflow/overflow at a viewport, touch-target pixels, and dark-mode visual correctness are marked **UNVERIFIED — source-level** (see §13). I do not run apps, take screenshots, or modify repo code. This plan is the single deliverable.

**Working-tree facts re-confirmed for this plan (the load-bearing five):**
- Canonical web token engine: `packages/typescript/ui/src/tokens.ts` = **1,388 lines** (verified `wc -l`). DTCG projection `packages/typescript/ui/tokens.json` = present (8,345 bytes).
- Canonical shell primitive: `packages/typescript/ui/src/navigation/app-navigation.tsx` = **88 lines**; consumers = exactly **2** (`apps/platform-console/src/app/(dashboard)/layout.tsx`, `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx`) → **2/9 adoption** confirmed.
- Mobile token forks: `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`, `packages/dart/ui_kit/lib/src/themes/app_colors.dart`, and the generated `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` all present; `apps/mobile/merchant-app/lib/theme/store_theme.dart` (the `ThemeData` that **bypasses** the generated bridge) present.
- Ratchet baseline `scripts/validators/design-system-baseline.json` confirms the **frozen** counts: `appCssNakedRgbHsl:573`, `tailwindPaletteClasses:606`, `rawPxSpacing:1382`, `rawPxFontSize:536`, `tsxInlineStyles:638`, `appLocalLbTokenRedefs:112`, `tsxArbitraryRadius:328`, `tsxArbitraryShadow:8`, `appCssRawHex:0`, `tsxRawHex:0`; `exiledApps:["apps/marketing-site"]`.
- stylelint: **0 hits in `pnpm-lock.yaml`** (not installed); `lint:css` script exists in `package.json:27` and `packages/typescript/ui/package.json:56`; **CI never calls it** (grep over `.github/workflows/` = empty). `validate:design-system` IS wired (`ci.yml:87`, `architecture-governance.yml:58`). **No provider-mode honesty-badge component exists in `@letbuyy/ui`** (grep = empty) — it must be built, not adopted.

---

## 1. Executive verdict — the unification call (5 sentences)

LetBuyy already owns a **Polaris-grade token engine** (`tokens.ts`, primitive→semantic→component + density/surface/motion, with runtime WCAG validation) and a **real CI ratchet gate**, but the system is fractured into **three token sources, eight hand-rolled navigations, four mobile color classes, and two design cultures sharing one token file**, so the work is not "build a design system" — it is **collapse the duplicates onto the one that should exist at 10k merchants and make the governance block new drift instead of grandfathering it.** The canonical decision is unambiguous: **`@letbuyy/ui` / `packages/typescript/ui/src/tokens.ts` (DTCG) is the SINGLE source of truth for web; the Dart `ui_kit` consumes a *generated bridge* from that one source (type + density added) and `ThemeData` is re-pointed at it; everything else — the bypassed Dart bridge, the four competing mobile color classes, the eight forked shells, the per-app `--lb-*` redefinitions — is demoted to LEGACY and deleted only after its consumers migrate.** ONE app shell (`AppNavigation`, today 2/9) is rolled to 9/9 starting with the cheapest proven path (console→ops already done → merchant → the rest), which simultaneously repays the active-state, sidebar-width, and navigation-a11y gaps for free. Governance is upgraded from "freeze the drift" to "**ratchet it down on a clock and BLOCK new drift**": install stylelint and wire `lint:css` to CI, promote the warn-only ESLint color/form rules to error after burn-down, and add a scheduled `--update` that lowers each ratchet metric 10%/release. **Honesty over polish:** the entire design-unification body of work is **debt-paydown sequenced into Waves 4–5 (Phase E) — explicitly NOT a go-live blocker — with exactly one exception that is go-live-relevant: the provider-mode honesty badge** (a money-surface truth requirement, Principle 4 / R2), which ships in Waves 2–3 alongside real payouts, and the non-negotiable floor that no migration may regress accessibility.

---

## 2. The unified token + shell architecture (web canonical → generated mobile bridge)

### 2.1 The single source of truth (target topology)

```
                       ┌──────────────────────────────────────────────┐
                       │  CANONICAL AUTHORING SOURCE (web, the one)    │
                       │  packages/typescript/ui/src/tokens.ts (1,388) │
                       │  primitive → semantic → component             │
                       │  + density/surface/motion + WCAG validator    │
                       └───────────────┬──────────────────────────────┘
                                       │
            ┌──────────────────────────┼───────────────────────────────┐
            │ (CI-gated parity)        │ (CI-gated parity)              │ (CI-gated parity, EXTENDED)
            ▼                          ▼                               ▼
  tokens.json (DTCG/W3C)      letbuyyTokenCss → --lb-*         mobile-tokens.ts → generator →
  (Figma/codegen interchange)  injected once 9/9 via            letbuyy_color_tokens.dart
  generate-design-tokens.mjs   LetbuyyThemeProvider             generate-mobile-tokens.mjs
  --check  (ci gate)           (DesignSystemRoot)               validate:mobile-tokens (ci gate)
                                       │                               │
                                       ▼                               ▼  (TARGET: ThemeData consumes this)
                          9 web apps consume var(--lb-*)      store_theme.dart light/dark bound to
                          via @letbuyy/ui components          the GENERATED tokens (not ui_kit AppColors)
```

**Two naming traps preserved from the audit (do not regress):**
1. `packages/token-core` is the **auth/JWT envelope** (`TokenKind = 'id_token' | …`, `src/index.ts:4`), **NOT** design tokens. The design-token engine is `packages/typescript/ui/src/tokens.ts`. (UIUX-030.)
2. There is no `packages/design-system` / `packages/ui`. The one web library is `@letbuyy/ui` at `packages/typescript/ui`; the one mobile library is `packages/dart/ui_kit`.

### 2.2 The single shell (target topology)

`packages/typescript/ui/src/navigation/app-navigation.tsx` (composes `AppFrame`+`Sidebar`+`Navigation`) is the **ONE canonical shell**. It reads `usePathname`, computes `isNavItemActive` per item, emits `aria-current="page"`, and defaults to the canonical `width='md'`. Target: **all surfaces with primary nav adopt it** — console + ops (done) → merchant (the primary OS, highest value) → theme-marketplace → developer-portal → app-marketplace → storefront account shell. Marketing and identity are special cases (marketing = public chrome; identity = auth-flow-only, no primary nav). Mobile keeps its own Flutter navigation paradigm but converges on the same IA contract and tokens.

### 2.3 The single theme controller (already canonical — protect it)

`packages/typescript/ui/src/theme-provider.tsx` (`LetbuyyThemeProvider` + `ThemeScript`) is the one controller: key `localStorage["letbuyy-theme"]`, vocabulary `light|dark|system`, resolved-theme feed into `DesignSystemRoot`, adopted **9/9**. The `theme="auto"` cascade bug (old THEME-1) is FIXED and HARD-invariant-banned. **This is CANONICAL and stays.** The only remaining dark-mode work is **reachability** (toggle missing in 7/9) — not wiring.

---

## 3. Per-system canonical decisions (the central Part-8 call)

For each design subsystem, the canonical source is chosen and the rest demoted. Verdicts apply across the four primary surfaces (Merchant Control Plane, Storefront, Checkout, Mobile Merchant App) plus the other apps.

| Subsystem | CANONICAL source | Demoted (→ classification) | Verdict basis (evidence) |
|---|---|---|---|
| **Color** | `tokens.ts` semantic+component light/dark roles → `--lb-color-*`; per-store dynamic colors are a *separate legitimate axis* in storefront | 573 naked `rgb()/hsl()` (LEGACY, ratchet-down); 25 marketing hex (LEGACY); mobile `AppColors`/`StoreAdminColors`/`Light|DarkThemeColors` + duplicate `LetbuyyColorTokens` (LEGACY → reconcile to generated bridge) | `tokens.ts:186-488`; baseline `appCssNakedRgbHsl:573`; `app_colors.dart` `#A4E500/#B02525`; UIUX-004/010/011/012/023, MOB-004 |
| **Typography** | `tokens.ts` type scale (incl. fluid `clamp()`) → `--lb-font-size-*`/`--lb-font-*`; mobile bridge **must be extended** to carry type | 536 raw `font-size:px` in app CSS (LEGACY, ratchet-down); mobile 712 raw `fontSize:` + 44 inline `GoogleFonts.inter()` (LEGACY); mobile type-token refs = **0** (DEAD coverage) | `tokens.ts:672-800`; baseline `rawPxFontSize:536`; mobile 712 `fontSize:`; UIUX-021, MOB-005 |
| **Spacing** | `tokens.ts` 12-step `--lb-space-*` (0–7xl) | 1,382 raw px spacings in app CSS (LEGACY, ratchet-down); mobile 2,040 raw `EdgeInsets`/`SizedBox` + 0 density refs (LEGACY) | `tokens.ts:672-800`; baseline `rawPxSpacing:1382`; mobile 2,040 EdgeInsets; UIUX-022, MOB-005 |
| **Component library** | `@letbuyy/ui` (`packages/typescript/ui/src/index.ts`, ~60 components, imported 9/9); `ui_kit` for Dart | StatusBadge re-derived 5×; `developer-docs.tsx` 15+ bespoke tables; console/ops `_local-ui` workspace twins; duplicated marketing `{Header,Footer}` ×2 (all LEGACY → adopt exported primitives) | `index.ts`; `developer-docs.tsx` (554 lines); UIUX-013/024/033 |
| **Dark-mode system** | `LetbuyyThemeProvider`+`ThemeScript` (one key, resolved feed, adopted 9/9) | old per-app `theme-provider` files / `theme="auto"` / legacy keys = **DEAD** (HARD-invariant-banned); reachability gap (toggle in only 2/9) = TRANSITIONAL fix | `theme-provider.tsx`; `validate-design-system.mjs:115-116`; UIUX-008 |
| **Elevation (shadow/radius)** | `tokens.ts` `--lb-shadow-*` (5) / `--lb-radius-*` (5) | 328 arbitrary `rounded-[…]` + 8 `shadow-[…]` (LEGACY, ratchet-down); mobile `LetbuyyShadowTokens`/`LetbuyyRadiusTokens` only via bridge | `tokens.ts:672-800`; baseline `tsxArbitraryRadius:328`/`tsxArbitraryShadow:8`; UIUX-028 |
| **Density** | `tokens.ts` `letbuyyDensityTokens` (compact/comfortable/spacious) + `DensityToggle` | Defined but barely rendered (TRANSITIONAL — expose in merchant settings); mobile uses 0 density tokens (LEGACY) | `tokens.ts:500-585`; UIUX-031 |
| **Breakpoints/responsive** | `tokens.ts` `letbuyyBreakpointTokens` exported as Tailwind preset | Hand-`@media` px in marketing(76)/app-mktpl(8)/identity(5)/developer(3) (LEGACY → adopt preset) | `tokens.ts:125-147`; UIUX-017 |
| **App shell / IA** | `AppNavigation` (`app-navigation.tsx:51-88`) | 8 hand-rolled navs across 7 apps, 4 sidebar widths (LEGACY → adopt shell) | `app-navigation.tsx`; UIUX-003/019/027 |
| **Honesty badge (money truth)** | **NEW** shared `ProviderModeBadge` in `@letbuyy/ui` + Flutter `ui_kit`, bound to backend `provider_mode` | Today: **none in `@letbuyy/ui`** (grep empty); mobile only a raw `provider_mode ?? 'sandbox'` text echo (`money_screen.dart:256`) = DEAD pattern | V1 §1 Principle 4 / §10; FREEZE §4; MOB-005; A7 |

### 3.1 The four primary surfaces — one-line canonical verdict each

- **Merchant Control Plane** (`apps/merchant-control-plane`, score 6.6, the primary OS): CANONICAL surface. Deepest `@letbuyy/ui` adoption (~74 import files), best a11y on platform (469 `aria-*`, 105 focus-visible), genuinely operator-first IA — but carries the **largest single drift store (`globals.css` = 10,335 lines / 2,210 raw px / 405 `rgb()`)** and **has NOT adopted `AppNavigation`** (still `AdminShell`/`Sidebar`/`HeaderBar` + `merchantNavigation.ts`). It is the highest-value shell-adoption and CSS-burn-down target. One IA gap: **no first-class Money/Finance node** (UIUX-009).
- **Storefront** (`apps/storefront-runtime`, score 4.3, worst-drift app): CANONICAL buyer surface but a **deliberately bespoke runtime that consumes per-store theme tokens, not the `--lb-*` admin tokens** — partly by design (merchants render their own colors), partly debt. Decision: **separate the two axes** — per-store dynamic theming stays (correct); static hardcodes (`coming-soon/page.tsx:95,129` `rgb(5 5 5)`) become tokens; define a small "storefront kit" of themable primitives. 794 `rgb()` / 582 inline / 231 TW-palette → ratchet-down (UIUX-012).
- **Checkout** (the hosted `checkout.letbuyy.com` origin): per A4, this origin is **currently MISSING** (signed handoff URLs are dead links). When built, its UI is **served from the storefront read-path** (no separate `checkout-runtime`, R-3) and **MUST consume `@letbuyy/ui` + `--lb-*` from day one** — it is greenfield, so there is no legacy to migrate; it is born canonical. Honesty-badge and money-surface a11y apply here too. Classification: **CANONICAL (to-be-built, born on the canonical DS)** — this is the one surface where the DS plan defers to the checkout-build plan for timing.
- **Mobile Merchant App** (`apps/mobile/merchant-app`, score 4.4): the most-built surface in the repo (71k lines), strong theme editor, but a **de-facto separate design system** — `ThemeData` (`store_theme.dart`) binds `ui_kit` `AppColors`/`LetbuyyColorTokens`, **not** the in-sync generated bridge (`letbuyy_color_tokens.dart`, imported by ~62 screens but not the theme). Decision: **re-point `ThemeData` at the generated bridge, extend the bridge to carry type+density, delete the duplicate `LetbuyyColorTokens` and reconcile `AppColors`** (UIUX-004/005, MOB-004). The mobile honesty badge and TD-5 parity-catalog deletion are tracked here.

---

## 4. Shell-consolidation plan (2/9 → 9/9)

**Current (verified):** canonical `AppNavigation` consumers = **2** (console + ops). **8 hand-rolled implementations remain across 7 apps** with **4 sidebar widths** (`w-72` console/ops, `w-56` theme, `w-64` storefront account, `260px` canonical default) and mixed/no/dropdown-as-active strategies.

| App | Today | Target | Order | Note |
|---|---|---|---|---|
| platform-console | **AppNavigation** ✓ | keep | done | `(dashboard)/layout.tsx:1` |
| platform-operations-portal | **AppNavigation** ✓ | keep | done | `(dashboard)/layout.tsx:1` |
| merchant-control-plane | `AdminShell`/`Sidebar`/`HeaderBar` + `merchantNavigation.ts` | **AppNavigation** (preserving operator-first IA + command palette + shortcuts) | **1st** (highest value) | adds active-state/`aria-current`/canonical width for free; fold in the new Money node here |
| theme-marketplace | `navbar.tsx` + dashboard `layout.tsx` (`pathname===href`) | AppNavigation (dashboard) + keep marketing navbar | 2nd | glassy `bg-white/[0.06]` chrome → token it |
| developer-portal | `_local-ui/PortalChrome.tsx` | AppNavigation | 3rd | also fixes its 0-role a11y (UIUX-026) |
| app-marketplace | `Header.tsx` mega-menu (dropdown=active) | AppNavigation for app surfaces; shared marketing kit for chrome | 4th | extract `MarketingHeader`/`Footer` (UIUX-024) |
| storefront-runtime | `dynamic-header.tsx` + `account/layout.tsx` (`usePathname`) | AppNavigation for **account** shell; storefront chrome stays per-store | 5th | nav chrome `inline 'white'` → token (UIUX-019) |
| marketing-site | `Header.tsx` mega-menu | shared marketing kit (not the admin shell) | special | public chrome; un-exile after token migration |
| identity-platform | — (auth flow, no primary nav) | n/a | n/a | a11y pass on auth forms instead (UIUX-015) |

**Enforcement:** after merchant adopts the shell, add a **HARD invariant** to `validate-design-system.mjs` forbidding new inline `<aside>`/`<nav>` primary navigation in app layouts (UIUX-003). The fix path is **proven** (console/ops did it); the remaining work is rollout, not invention.

---

## 5. Mobile DS convergence (3 token sources + 4 color classes + bypassed bridge → 1)

**Current (verified):** mobile is effectively a separate DS. Four color classes / three token sources:
1. `packages/dart/ui_kit/.../tokens/letbuyy_tokens.dart` — `LetbuyyColorTokens` (semantic) + primitive/spacing/typography/radius/shadow/density token classes; bound by `store_theme.dart` ColorScheme.
2. `packages/dart/ui_kit/.../themes/app_colors.dart` — `AppColors` (~343 screen refs; `success #A4E500`, `error #B02525` **diverge** from web).
3. `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` (**generated**, in-sync with web) — imported by ~62 screens as `mobile_tokens`, **but NOT by `ThemeData`**.
4. `apps/mobile/merchant-app/lib/theme/{store_admin_colors,light_theme_colors,dark_theme_colors}.dart` — extra per-screen palettes.

Two classes share the name `LetbuyyColorTokens` (collision active). The bridge feeds **screen code** but not the **`ThemeData` that actually colors the app** (`store_theme.dart` imports `ui_kit` only).

**Convergence steps (the canonical mobile DS):**
1. **Extend the bridge** — `mobile-tokens.ts` + `generate-mobile-tokens.mjs` to emit **typography + density** (today colors+spacing only), keeping the existing `validate:mobile-tokens` CI gate green and adding type/density parity to it.
2. **Re-point `ThemeData`** — `store_theme.dart` light/dark `ColorScheme`/`TextTheme` bind to the **generated** tokens, not `ui_kit` `AppColors` (UIUX-004, MOB-004).
3. **Delete the duplicate** `LetbuyyColorTokens` (resolve the name collision); reconcile `AppColors` semantic divergences (`#A4E500/#B02525` → canonical green/red) (UIUX-004).
4. **Fix mobile dark** — reconcile the off-spec teal dark body text (`app_colors.dart` `#D3E4E3/#AED9D8/#89CBCB`) to the canonical slate ramp (UIUX-025).
5. **Add a Dart lint** (`dart_code_metrics` / custom) banning raw `Color(0x…)`/`fontSize:`/`EdgeInsets(` outside the theme layer; wire to CI; ratchet-down the 334/712/2,040 raw counts (UIUX-005).
6. **Delete the parity catalog (TD-5)** — `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` (~974 lines) and the 6 orphan `/features/*` routes (2 of which render `[SKIP - NEEDS BACKEND]`), redirect Settings tiles to real screens (UIUX-007, MOB-003/004).
7. **Ship the mobile honesty badge** in `ui_kit` (shared design with the web `ProviderModeBadge`), replacing the raw `provider_mode ?? 'sandbox'` text echo (MOB-005).

---

## 6. Operator-first IA (merchant OS) — A7 / V1 §10 / FREEZE §4

**Verdict: merchant-control-plane IS operator-first — V1 §10's central demand is MET for the store profile, with one gap.** Verified IA order (`merchantNavigation.ts:63-123`): **Home → Orders → Products → Customers → Marketing → Content → Analytics → Online Store → Add → Settings.** Orders/Products/Customers are `section:'primary'` (NOT buried under Settings); Settings is correctly `section:'bottom'`. Operator affordances are real: keyboard shortcuts (`g o`, `g p`, `g c`, `g i`, `n p`), a command palette (`:294-341`), per-section child nav.

**The one IA gap (V1 §10 says "Orders / Money / Customers primary" — only 2/3 met):** there is **no dedicated top-level Money/Finance/Payouts node** (UIUX-009). Money is implicit inside Orders + Analytics. **Decision: add a first-class `Finance` primary nav item** (payouts, balances, settlement statements) — the single highest-value IA addition for a commerce OS, folded into the merchant shell-adoption work (§4, order 1).

**Scope note (not a defect, a product call):** the OS serves 5 site types (store/portfolio/resume/landing/blog, `:205-211`), which dilutes "commerce OS." Left as a product decision (UIUX-032); if commerce-first wins, demote non-store profiles behind a mode switch.

**Mobile IA** must converge on the same operator-first contract (Orders/Money/Customers primary) once the parity catalog is deleted (§5 step 6).

---

## 7. Governance-enforcement upgrade (ratchet must BLOCK; stylelint in CI)

**Current posture: 3.0/5** — a real CI ratchet exists (`validate:design-system` in `ci.yml:87` + `architecture-governance.yml:58`) and the theme architecture is HARD-invariant-protected, but **the gate freezes drift rather than repaying it**, **stylelint is wired-but-uninstalled**, and **ESLint color/form rules are warn-only + lint is changed-only**. Three concrete upgrades:

**G1 — Make the ratchet repay, not just freeze (UIUX-001).** Today `design-system-baseline.json` was seeded from current counts, so `appCssNakedRgbHsl:573` / `rawPxSpacing:1382` / `tsxInlineStyles:638` are permanently "passing." Add a **scheduled `--update`** that auto-lowers each metric by `ratchetPerWavePercent:10` per release (the field already exists, currently advisory). The budget must **ratchet down on a clock**, not merely "never up." This is the difference between debt-freeze and debt-paydown.

**G2 — Arm the third gate (UIUX-002, the cheapest high-value fix).** `lint:css` exists (`package.json:27`, `packages/typescript/ui/package.json:56`) and `.stylelintrc.cjs` is well-designed (bans hex, named colors, raw `rgb()/hsl()` outside the token layer), but **stylelint is absent from every `devDependencies` and from `pnpm-lock.yaml` (0 hits)** and **CI never calls `lint:css`**. Fix: `pnpm add -D stylelint stylelint-config-standard`; add `lint:css` to `turbo lint` + a CI step that **fails on error**. This makes the CSS channel block, not just the ratchet regex catch it incidentally.

**G3 — Promote warn→error after burn-down (UIUX-010/016).** `no-tailwind-default-color`, `no-raw-color-functions`, `no-raw-form-controls` are **warn-only** in all 9 apps (`*/eslint.config.mjs:18-20`) and `turbo lint` runs **changed-only** (`ci.yml:84` `--filter`), and warnings don't fail. So 606 Tailwind-palette classes + 573 `rgb()` survive visibly-but-unblocked. Fix: burn down each channel under the ratchet, then promote the three rules to `error`; add a Tailwind `blocklist` of default color classes; run lint repo-wide in a nightly fail-on-warn.

**Add two new HARD invariants** as the migrations land: (a) forbid new inline `<aside>`/`<nav>` primary navigation (locks shell adoption, §4); (b) forbid redefinition of any `--lb-*` outside `@letbuyy/ui` (locks the single-token-source, kills the 112 app-local redefs over time, UIUX-018).

**Target posture: 4.5/5** once the ratchet repays on a clock, all three channels block, and shell + token redefinition are HARD-invariant-locked.

---

## 8. Per-decision detail blocks (13 fields each)

> Every block carries all 13 fields: **Current State · Strategic State · Reasoning · Migration Plan · Validation Plan · Deletion Plan · Rollback Plan · Risk Level · Complexity (XS/S/M/L) · Timeline (Wave) · Owner · Dependencies · Success Criteria** — plus **Classification**. Waves map onto the master Phase model: Wave 0–1 ≈ Phase A (deploy + S0 security), Wave 2–3 ≈ Phase B + early D (money-safe + honesty badge), Wave 4 ≈ Phase C/D true-up + product-complete, Wave 5 ≈ Phase E hardening + DS burn-down, Waves 6–8 = deferred/ecosystem (Liquid marketplace, density UX, polish). **Owners use V1 §13 squad names.**

---

### UX-001 — Single web token source = `tokens.ts` (DTCG), kill all bypasses · **CANONICAL**
- **Current State:** `tokens.ts` (1,388 lines) is Polaris-grade and reaches the DOM 9/9 via `LetbuyyThemeProvider`→`DesignSystemRoot`→`letbuyyTokenCss`; `tokens.json` DTCG projection exists and is CI-gated (`generate-design-tokens.mjs --check`, `architecture-governance.yml:61`). But customer apps bypass it in hand CSS (573 naked `rgb()/hsl()`, 1,382 raw px) and 112 app-local `--lb-*` redefinitions shadow it.
- **Strategic State:** `tokens.ts` is the SOLE authoring source; `tokens.json` is its interchange projection; `--lb-*` is the only color/space/type/elevation vocabulary in app code; **zero** app-local `--lb-*` redefinitions outside `@letbuyy/ui`.
- **Reasoning:** One source = one place to change brand, one parity contract for mobile, one thing to govern. Multiple sources is the root cause of every drift metric.
- **Migration Plan:** Burn down the raw-value channels (UX-010/011/012) against the ratchet; convert the 112 `--lb-*` aliases to derivations via `color-mix()` (merchant already started, `globals.css:50-59`); add the HARD invariant forbidding `--lb-*` redefinition outside the library.
- **Validation Plan:** Unit (token snapshot of `tokens.ts` exports); Contract (`tokens.json`↔`tokens.ts` parity gate, already green); Integration (every app's CSS references only `var(--lb-*)`, asserted by stylelint after G2).
- **Deletion Plan:** Delete app-local `--lb-*` redefinitions only after each app's aliases are derivations (no consumer reads a raw redefinition).
- **Rollback Plan:** Token changes are additive/versioned; revert a single PR restores prior `--lb-*` values; `ThemeScript` prevents FOUC during rollback.
- **Risk Level:** Low (additive). **Complexity:** L (the burn-down is large). **Timeline:** Wave 5 (Phase E; background burn-down can start after Wave 4 C2). **Owner:** Platform/DesignSystems squad. **Dependencies:** G2 (stylelint) to enforce; C2 constitution unification so the ratchet lives under one constitution.
- **Success Criteria:** `appLocalLbTokenRedefs` ratchets to 0; stylelint passes repo-wide; one documented source of truth in `AGENTS.md`.

---

### UX-002 — Generated Dart bridge from `tokens.ts`; re-point `ThemeData`; kill the bypass · **CANONICAL**
- **Current State:** Generated bridge `letbuyy_color_tokens.dart` is in-sync (CI-gated `validate:mobile-tokens`, `package.json:25`) and imported by ~62 screens, **but `ThemeData` (`store_theme.dart`) binds `ui_kit` `AppColors`/`LetbuyyColorTokens` instead** → the bridge is bypassed by the thing that colors the app; token relevance ~6%. Bridge covers colors+spacing only (no type).
- **Strategic State:** The generated bridge is the SOLE mobile token source; `ThemeData` light/dark consume it; the bridge carries color + spacing + **type + density**; the duplicate `LetbuyyColorTokens` is deleted; `AppColors` divergences reconciled.
- **Reasoning:** A8: Dart consumes a generated bridge from the single web source. A bridge that feeds screens but not the theme is theater — the app still renders a separate DS.
- **Migration Plan:** (1) extend `mobile-tokens.ts`+generator to emit type/density; (2) re-point `store_theme.dart` `ColorScheme`/`TextTheme` at the bridge; (3) delete duplicate `LetbuyyColorTokens`; (4) reconcile `AppColors` (`#A4E500/#B02525`→canonical) and dark teal→slate (UX-009).
- **Validation Plan:** Contract (web↔Dart token parity gate, extended to type/density); golden tests (`merchant_goldens_test.dart`) re-baselined; Dark-mode visual (mobile dark on slate ramp); Regression (the 62 screens importing `mobile_tokens` still compile).
- **Deletion Plan:** Delete duplicate `LetbuyyColorTokens` + redundant per-screen palettes (`store_admin_colors`, `light/dark_theme_colors`) only after `ThemeData` + all screens reference the bridge.
- **Rollback Plan:** `store_theme.dart` re-point is one file; revert restores `AppColors` binding; bridge regeneration is deterministic from `tokens.ts`.
- **Risk Level:** Medium (touches the live theme + golden tests). **Complexity:** L. **Timeline:** Wave 5 (Phase E). **Owner:** Mobile squad + DesignSystems. **Dependencies:** UX-001 (web source stable); mobile golden-test suite.
- **Success Criteria:** `store_theme.dart` imports only generated tokens; one `LetbuyyColorTokens`; mobile dark renders slate; `validate:mobile-tokens` covers type/density.

---

### UX-003 — Roll the canonical shell `AppNavigation` to 9/9 (start: merchant) · **CANONICAL**
- **Current State:** 2/9 (console+ops); 8 hand-rolled navs across 7 apps; 4 sidebar widths; mixed/no active-state; the **primary merchant OS still forks** (`AdminShell`/`Sidebar`/`HeaderBar`+`merchantNavigation.ts`).
- **Strategic State:** Every primary-nav surface adopts `AppNavigation` (route-computed active state, `aria-current`, canonical width); marketing uses a shared marketing kit; identity stays auth-flow-only.
- **Reasoning:** A8: one shell. Adoption fixes active-state, width consistency, and nav-a11y **for free** (the library emits `aria-current`); the path is proven by console/ops.
- **Migration Plan:** Order = merchant → theme-marketplace → developer-portal → app-marketplace → storefront-account (§4). Preserve merchant's operator-first IA, command palette, and shortcuts during the swap; fold in the Money node (UX-008).
- **Validation Plan:** Integration (shell-adoption count → 9/9 asserted by a new validator metric); E2E (visual-regression/screenshot diff per migrated app); Accessibility (`aria-current` present, focus order, keyboard nav); Regression (existing route deep-links resolve).
- **Deletion Plan:** Delete each app's hand-rolled nav component only after its layout renders `AppNavigation` and screenshot-diff passes.
- **Rollback Plan:** Per-app layout swap is one file; revert restores the prior nav; no shared deletion until all consumers migrated.
- **Risk Level:** Medium (merchant nav is high-traffic). **Complexity:** L. **Timeline:** Wave 5 (Phase E; merchant can pilot in late Wave 4). **Owner:** Merchant + each app's owning squad; DesignSystems shepherds. **Dependencies:** none hard; HARD invariant (UX-013) added after merchant lands.
- **Success Criteria:** shell adoption 9/9; one sidebar width; `aria-current` everywhere; HARD invariant blocks new inline nav.

---

### UX-004 — Provider-mode honesty badge (the ONE go-live-relevant UI item) · **CANONICAL**
- **Current State:** **No badge component exists in `@letbuyy/ui`** (grep empty). Mobile has only a raw, unlabeled `'${payout['status']} · ${payout['provider_mode'] ?? 'sandbox'}'` text echo (`money_screen.dart:256`) that **defaults to "sandbox" and conflates "no data" with sandbox.** V1 §1 Principle 4 / §10 and FREEZE §4 require a labeled live/sandbox/scaffold badge on **every** money/fulfillment surface; a stub must never read as `success` (R2).
- **Strategic State:** ONE shared `ProviderModeBadge` in `@letbuyy/ui` + a mirrored Flutter badge in `ui_kit`, bound to the backend `provider_mode`, rendered on every payouts/COD/wallet/commission/settlement/fulfillment surface (web + mobile), **validator-enforced** on those screens.
- **Reasoning:** This is **money-surface honesty, not design polish** — it is the only UI item that gates go-live. A sandbox no-op that reads as success is a trust/financial-integrity defect (R2/TD-1), sequenced with money, not with DS debt.
- **Migration Plan:** Build the badge in `@letbuyy/ui` (variants: live/sandbox/scaffold, status-token-driven) and `ui_kit`; bind to `provider_mode` from the payments/settlement APIs once the rail emits real mode (Phase B4); render on every money/fulfillment screen; add a validator that **fails** if a money/fulfillment screen lacks it.
- **Validation Plan:** Unit (badge renders each mode); Contract (badge reads the same `provider_mode` field web+mobile); Integration (validator enumerates money/fulfillment routes and asserts badge presence); E2E (sandbox build shows "Sandbox", never `success`); Accessibility (badge has text label + role, not color-only).
- **Deletion Plan:** Delete the mobile raw `provider_mode ?? 'sandbox'` text echo once the badge ships.
- **Rollback Plan:** Badge is additive; if `provider_mode` is unavailable it renders "scaffold/unknown" (never "success"); removing it reverts to prior screens (regression caught by the validator).
- **Risk Level:** Low-build / High-importance. **Complexity:** M. **Timeline:** **Waves 2–3 (Phase B4 → D1)** — earlier than all other DS work. **Owner:** Finance/Payments + DesignSystems + Mobile. **Dependencies:** B4 (rail emits real `provider_mode`); A0 (deploy).
- **Success Criteria:** badge on 100% of money/fulfillment surfaces web+mobile; validator-enforced; no surface renders a stubbed action as `success`.

---

### UX-005 — Add a first-class Money/Finance nav node (operator-first completion) · **CANONICAL**
- **Current State:** `merchantNavigation.ts:63-123` has Orders/Products/Customers primary but **no top-level Money/Finance/Payouts node**; money is implicit in Orders+Analytics → V1 §10 "Orders/Money/Customers primary" only 2/3 met.
- **Strategic State:** A `Finance` primary nav item (payouts, balances, settlement statements) at the same level as Orders/Customers.
- **Reasoning:** A7/V1 §10/FREEZE §4: operator-first means money is a first-class destination; payouts buried is the single highest-value IA addition for a commerce OS.
- **Migration Plan:** Add the `Finance` section to `merchantNavigation.ts` (web) and the mobile IA; route to existing payouts/settlement screens; fold into the merchant shell-adoption PR (UX-003) to avoid double-touch.
- **Validation Plan:** Integration (nav renders Finance primary); E2E (Finance → real payouts screen); Accessibility (nav item keyboard-reachable, `aria-current`).
- **Deletion Plan:** None (additive nav node).
- **Rollback Plan:** Revert the nav-config addition (one config object).
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 4 (Phase D, with merchant shell pilot). **Owner:** Merchant squad. **Dependencies:** real payouts/settlement screens (Phase B/D).
- **Success Criteria:** Finance is top-level primary on web+mobile; V1 §10 IA fully met (3/3).

---

### UX-006 — Governance ratchet must repay on a clock + arm stylelint + warn→error · **CANONICAL**
- **Current State:** Ratchet freezes drift (573/1382/638 "passing"); stylelint uninstalled (0 in lockfile) + `lint:css` never in CI; ESLint color/form rules warn-only + lint changed-only.
- **Strategic State:** Ratchet auto-lowers 10%/release; stylelint installed + `lint:css` fails CI on error; the three color/form rules are `error` after burn-down; two new HARD invariants (no inline nav; no `--lb-*` redefinition).
- **Reasoning:** A8: governance must BLOCK new drift and compel repayment, not grandfather it. The gate exists; this makes it bite.
- **Migration Plan:** G1 scheduled `--update`; G2 `pnpm add -D stylelint stylelint-config-standard` + CI step + `turbo lint` wiring; G3 burn-down then promote rules; add the two HARD invariants as UX-003/UX-001 land.
- **Validation Plan:** Integration (CI fails on an injected raw `rgb()` in CSS; CI fails on a metric increase); Regression (existing passing tree still passes at the new lower baseline after each `--update`).
- **Deletion Plan:** None (governance additive). The advisory `ratchetPerWavePercent` becomes enforced.
- **Rollback Plan:** Each gate is independently revertible; if a burn-down stalls, freeze that one metric (don't increase) while others continue.
- **Risk Level:** Low. **Complexity:** S (G2) / M (G1, G3). **Timeline:** G2 = Wave 4 (cheap, early); G1/G3 = Wave 5. **Owner:** Platform/DevEx + DesignSystems. **Dependencies:** C2 (one constitution) so the ratchet isn't enforcing rejected-architecture validators alongside.
- **Success Criteria:** stylelint in CI fail-on-error; every ratchet metric strictly decreasing each release; warn rules at error; HARD invariants live.

---

### UX-007 — Dark-mode reachability: toggle in 7/9 toggle-less apps · **TRANSITIONAL**
- **Current State:** Dark theme is library-complete and adopted 9/9, `theme="auto"` bug FIXED, but a **toggle exists in only 2/9** (merchant + theme-marketplace); the other 7 are `defaultTheme:'system'` (OS-only, no in-app override).
- **Strategic State:** A theme toggle in every app's header/account menu; users can deliberately choose dark.
- **Reasoning:** Wiring is done; only reachability is missing — `useTheme()` already exists. Cheap, high-perceived-quality.
- **Migration Plan:** Drop the existing toggle component into the 7 toggle-less apps' headers (the hook is shared).
- **Validation Plan:** Integration (toggle present + persists to `letbuyy-theme`); Dark-mode visual (per app, UNVERIFIED at render — flag storefront/marketing per-store palettes); Accessibility (toggle keyboard-operable, labeled).
- **Deletion Plan:** None.
- **Rollback Plan:** Remove the toggle (one component per header); `defaultTheme:'system'` remains a safe fallback.
- **Risk Level:** Low. **Complexity:** S. **Timeline:** Wave 5. **Owner:** each app owner; DesignSystems provides the component. **Dependencies:** none.
- **Success Criteria:** toggle in 9/9; dark reachable everywhere (rendering correctness still UNVERIFIED for re-authored-color apps).

---

### UX-008 — Mobile spacing/type/density tokenization + Dart lint · **CANONICAL**
- **Current State:** Mobile carries 334 `Color(0x`, 712 raw `fontSize:`, 2,040 `EdgeInsets`/`SizedBox`, 0 density-token refs, 44 inline `GoogleFonts.inter()`; no Dart lint bans raw color/size; bridge lacks typography.
- **Strategic State:** Mobile type/spacing/density flow from the extended bridge; a CI-wired Dart lint bans raw color/size outside the theme layer; raw counts ratchet down.
- **Reasoning:** A8: mobile must stop being a separate, un-tokenized DS; type/spacing/density parity is required for one cross-platform system.
- **Migration Plan:** (extends UX-002) emit type+density in the bridge; add `dart_code_metrics`/custom rule; migrate hot screens off raw values against a ratchet; replace `GoogleFonts.inter()` with theme `TextTheme`.
- **Validation Plan:** Unit (Dart token snapshot); Integration (lint fails on raw `Color(`/`fontSize:`/`EdgeInsets(` outside theme); golden re-baseline; Regression (screens compile).
- **Deletion Plan:** Remove inline `GoogleFonts.inter()` once `TextTheme` covers them.
- **Rollback Plan:** Lint can run warn-first; revert per-screen migrations independently.
- **Risk Level:** Medium. **Complexity:** L. **Timeline:** Wave 5. **Owner:** Mobile + DesignSystems. **Dependencies:** UX-002 (bridge re-point).
- **Success Criteria:** mobile type/spacing tokenized; Dart lint in CI; raw counts strictly decreasing.

---

### UX-009 — Reconcile mobile semantic colors + dark to canonical · **LEGACY → CANONICAL**
- **Current State:** `AppColors` diverges (`success #A4E500`, `error #B02525`); mobile dark renders teal body text (`#D3E4E3/#AED9D8/#89CBCB`), not the slate ramp.
- **Strategic State:** Mobile semantic + dark colors match the canonical web ramp via the generated bridge.
- **Reasoning:** Cross-platform parity (A8) — brand-consistent but off-spec semantics is still drift; the most-complete dark UX is on the wrong palette.
- **Migration Plan:** (part of UX-002) map `AppColors`/dark text to bridge values; delete divergent literals.
- **Validation Plan:** Contract (semantic color parity web↔Dart); Dark-mode visual; golden re-baseline.
- **Deletion Plan:** Delete divergent `AppColors`/dark literals after bridge binding.
- **Rollback Plan:** Per-file revert; bridge values are canonical.
- **Risk Level:** Low-Medium. **Complexity:** M. **Timeline:** Wave 5. **Owner:** Mobile + DesignSystems. **Dependencies:** UX-002.
- **Success Criteria:** mobile `success/error/dark` match canonical tokens; 0 divergent literals.

---

### UX-010 — Burn down Tailwind default-palette classes (606) · **LEGACY**
- **Current State:** 606 Tailwind default-palette classes (console 134, theme-mktpl 123, storefront 231) survive because `no-tailwind-default-color` is warn-only + lint changed-only; "clean CSS" apps push color drift into `className`.
- **Strategic State:** 0 default-palette classes; all color via `--lb-color-*` (Tailwind preset mapped to tokens); a Tailwind `blocklist` of default color classes.
- **Reasoning:** className color won't theme (dark/per-tenant); it is the same drift in a different channel.
- **Migration Plan:** Map default classes → token-backed utilities; add the blocklist; promote the rule to error after burn-down (G3).
- **Validation Plan:** Integration (lint fails on a default color class); E2E (dark renders correctly post-migration); Regression.
- **Deletion Plan:** N/A (replace in place).
- **Rollback Plan:** Per-app PRs revertible; rule stays warn until burn-down complete.
- **Risk Level:** Low. **Complexity:** S-M. **Timeline:** Wave 5. **Owner:** each app owner. **Dependencies:** UX-006 G3.
- **Success Criteria:** `tailwindPaletteClasses` → 0; rule at error.

---

### UX-011 — Burn down merchant `globals.css` (10,335 lines / 2,210 px / 405 rgb) · **LEGACY**
- **Current State:** The primary OS carries the largest single drift store (`apps/merchant-control-plane/src/app/globals.css`).
- **Strategic State:** Migrated to `var(--lb-*)`; globals.css reduced to a thin reset + token-derived aliases.
- **Reasoning:** Biggest line-item in the repayment plan; on the highest-value surface.
- **Migration Plan:** Migrate `rgb()`/px/font-size → tokens against the ratchet; convert `--header-*` aliases fully to `color-mix(--lb-*)` derivations (started, `:50-59`).
- **Validation Plan:** E2E (screenshot diff of merchant pages); Dark-mode visual; Regression; stylelint (post-G2).
- **Deletion Plan:** Remove redundant CSS blocks after token migration; no shared deletion.
- **Rollback Plan:** Migrate page-group by page-group; revert any group independently.
- **Risk Level:** Medium (large surface). **Complexity:** L. **Timeline:** Wave 5 (longest single burn-down). **Owner:** Merchant squad. **Dependencies:** UX-006 (ratchet+stylelint to hold the line).
- **Success Criteria:** merchant `rawPxSpacing`/`rgb()` ratcheted toward 0; globals.css materially shrunk.

---

### UX-012 — Storefront: separate per-store dynamic theming from static hardcodes · **LEGACY (partial) / CANONICAL (storefront kit)**
- **Current State:** Worst-drift app (794 `rgb()`, 582 inline `style={`, 231 TW-palette, 1,056 px). **Important nuance:** much of the inline styling is *legitimate per-store dynamic theming* (`product-details-client.tsx:125` `backgroundColor: colors.backgroundColor`) — correct, not debt. But genuine hardcodes are mixed in (`coming-soon/page.tsx:95,129` `rgb(252 165 165)`/`rgb(5 5 5)`).
- **Strategic State:** Per-store dynamic colors stay (a separate, blessed axis); static hardcodes become tokens; a small "storefront kit" of themable primitives in `@letbuyy/ui` covers the static chrome.
- **Reasoning:** Storefront is a bespoke buyer runtime consuming per-store tokens by design (A6); the fix is to *distinguish* legit dynamic theming from genuine hardcodes, not to force `--lb-*` admin tokens onto merchant-themed surfaces.
- **Migration Plan:** Tag dynamic-color inline styles as allowed (lint exception by pattern); migrate static hardcodes to tokens; extract a storefront-kit of primitives.
- **Validation Plan:** E2E (per-store theme still renders; static chrome themes with `--lb-*`); Regression; lint distinguishes dynamic vs static.
- **Deletion Plan:** Delete static hardcodes after tokenization; keep dynamic.
- **Rollback Plan:** Per-component; dynamic theming untouched.
- **Risk Level:** Medium (must not break per-store rendering). **Complexity:** L. **Timeline:** Wave 5. **Owner:** Storefront squad. **Dependencies:** UX-006; checkout-origin build (A4) shares the kit.
- **Success Criteria:** static `rgb()`/inline reduced; per-store theming intact; storefront kit shipped.

---

### UX-013 — Composite/component duplication: StatusBadge ×5, developer-docs tables, workspace twins, marketing chrome ×2 · **LEGACY**
- **Current State:** StatusBadge re-derived 5× despite exported `Badge`; `developer-docs.tsx` (554 lines) hand-rolls 15+ table renderers vs the imported `Table`; console/ops `_local-ui` workspace twins (`[CONSOLIDATE]`-tagged, refactored just under the gate's regex); `{Header,Footer}` duplicated across app-marketplace + marketing-site.
- **Strategic State:** One `Badge`/`StatusVariant`, one configurable `Table`, one consolidated workspace grammar, one shared marketing kit (`MarketingHeader`/`MarketingFooter` in `@letbuyy/ui`).
- **Reasoning:** Forked logic drifts; bug-fixes don't propagate; the validator reporting `localWorkspaceImplementations:0` is a regex artifact, not consolidation.
- **Migration Plan:** Replace local StatusBadge → `Badge variant`; collapse developer-docs tables to `Table`; consolidate workspace twins; extract marketing kit.
- **Validation Plan:** Unit (Badge/Table render); Integration (no local re-derivation); E2E (developer-portal + marketing render unchanged).
- **Deletion Plan:** Delete local StatusBadge/table renderers/twins after adoption.
- **Rollback Plan:** Per-component revert.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 5. **Owner:** each app owner; DesignSystems. **Dependencies:** none.
- **Success Criteria:** 0 re-derived StatusBadge; developer-docs on `Table`; one marketing chrome.

---

### UX-014 — Delete the mobile parity catalog (TD-5) + redirect Settings · **DEAD**
- **Current State:** `merchant_feature_screen.dart` (353) + `merchant_feature_definitions.dart` (621) present and routed; 6 orphan `/features/*` routes fall through to a generic read-only viewer, **2 of which render `[SKIP - NEEDS BACKEND]`** (`/features/checkout`, `/features/security`) and are reachable from Settings (`settings_screen.dart:411`). V1 §10 ordered these deleted; not done.
- **Strategic State:** Both files deleted; Settings tiles route to real screens; no `SKIP-NEEDS-BACKEND` surface user-reachable.
- **Reasoning:** A7/V1 §10/TD-5: a "parity grid" of fake read-only screens contradicts operator-first and erodes trust (a merchant taps Settings→Checkout and sees a placeholder).
- **Migration Plan:** Replace the Settings hub's group rendering with explicit tiles to real routes; delete the two parity files + the orphan route fallthroughs.
- **Validation Plan:** Integration (no `/features/*` resolves to the generic viewer); E2E (Settings tiles open real screens); Regression (the 36 already-real routes unchanged).
- **Deletion Plan:** Delete `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` + route entries + Settings group rendering, after MOB-003 redirect lands.
- **Rollback Plan:** Revert the deletion PR; the 36 real routes are independent.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 4 (with mobile product-complete). **Owner:** Mobile squad. **Dependencies:** real screens exist for the 6 orphans or tiles removed.
- **Success Criteria:** parity files gone; 0 placeholder screens in nav; ~974 lines removed.

---

### UX-015 — marketing-site: add focus-visible + un-exile after token migration · **LEGACY → CANONICAL**
- **Current State:** marketing-site is **governance-exiled** (`design-system-baseline.json` `exiledApps`), owns all 25 hex literals, 355 `rgb()`, 1,245 px, a 5,319-line globals.css, 76 hand-`@media`, and **0 focus-visible** → keyboard focus a11y effectively absent.
- **Strategic State:** `:focus-visible` token styles present; hex/rgb/px migrated; un-exiled from the ratchet.
- **Reasoning:** A public surface with 0 keyboard focus is an accessibility floor violation; exile is a temporary quarantine, not a destination.
- **Migration Plan:** Add `:focus-visible` token styles; migrate the 25 hex + rgb/px to tokens; adopt the Tailwind breakpoint preset; remove from `exiledApps`.
- **Validation Plan:** Accessibility (focus-visible on interactive elements, keyboard nav); E2E (screenshot diff); stylelint post-migration.
- **Deletion Plan:** Remove the `exiledApps` entry after migration.
- **Rollback Plan:** Re-add to `exiledApps` if migration stalls (temporary).
- **Risk Level:** Medium (large hand-CSS surface). **Complexity:** L. **Timeline:** Wave 5. **Owner:** Marketing/Web. **Dependencies:** UX-006.
- **Success Criteria:** focus-visible present; 0 hex; un-exiled; under the ratchet.

---

### UX-016 — identity-platform: a11y pass on auth forms; remove inline styles + `!important` · **LEGACY**
- **Current State:** Security-critical auth screens with thin aria (41 `aria-*`), 43 inline `style={`, **11 `!important`** (most of any app), 2,005-line globals.css.
- **Strategic State:** Labeled, announced, error-handled auth forms using DS controls; 0 inline-style/`!important` specificity wars.
- **Reasoning:** Auth a11y (label/announce/error) is the highest-stakes a11y surface; specificity hacks fight the token layer.
- **Migration Plan:** Manual a11y pass (labels, `aria-describedby` errors, focus management); replace inline styles + `!important` with DS controls/tokens.
- **Validation Plan:** Accessibility (form labels, error announcement, focus order, keyboard); E2E (login/reset flows); stylelint.
- **Deletion Plan:** Remove inline styles + `!important` after DS-control adoption.
- **Rollback Plan:** Per-screen revert.
- **Risk Level:** Medium (auth is sensitive). **Complexity:** M. **Timeline:** Wave 5. **Owner:** Identity squad + DesignSystems. **Dependencies:** none.
- **Success Criteria:** auth forms pass a11y review; 0 `!important`; inline styles eliminated.

---

### UX-017 — Unify responsive strategy on the Tailwind breakpoint preset · **TRANSITIONAL**
- **Current State:** Two incompatible strategies — Tailwind breakpoints (ops/merchant/storefront/theme) vs hand-`@media` literal-px (marketing 76, app-mktpl 8, identity 5, developer 3); hand-`@media` values can drift from `--lb-bp-*`.
- **Strategic State:** All apps use `letbuyyTailwindPreset` screens; literal-px `@media` replaced with token breakpoints.
- **Reasoning:** One breakpoint scale; eliminates value drift between CSS media queries and the token scale.
- **Migration Plan:** Adopt the preset in the 4 hand-`@media` apps; convert literal-px queries to `--lb-bp-*`.
- **Validation Plan:** Responsive (breakpoints match the scale); E2E (reflow at each viewport — UNVERIFIED at render, screenshot-diff to approximate).
- **Deletion Plan:** Remove literal-px `@media` after preset adoption.
- **Rollback Plan:** Per-app revert.
- **Risk Level:** Low-Medium. **Complexity:** M. **Timeline:** Wave 5. **Owner:** each hand-`@media` app owner. **Dependencies:** none.
- **Success Criteria:** one breakpoint source; 0 literal-px `@media` in app CSS.

---

### UX-018 — developer-portal a11y: add roles/landmarks; adopt DS Table/Tabs · **LEGACY**
- **Current State:** 0 `role`, 22 `aria-*`, 2 focus-visible across the app; bespoke `PortalChrome` + hand tables.
- **Strategic State:** Landmarks/roles present; DS `Table`+`Tabs` adopted; AppNavigation shell (UX-003).
- **Reasoning:** Weakest a11y on the platform; the docs portal is keyboard/SR-hostile.
- **Migration Plan:** Add landmarks/roles; replace hand tables with `Table`; adopt shell.
- **Validation Plan:** Accessibility (roles, focus, keyboard); E2E.
- **Deletion Plan:** Delete hand tables after `Table` adoption (overlaps UX-013).
- **Rollback Plan:** Per-component revert.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 5. **Owner:** DevPortal owner. **Dependencies:** UX-003/UX-013.
- **Success Criteria:** roles present; DS Table/Tabs adopted; a11y review passes.

---

### UX-019 — console/ops non-nav a11y (roles/labels on tables+panels) · **TRANSITIONAL**
- **Current State:** Nav a11y now good (AppNavigation supplies `aria-current`+landmarks), but non-nav surfaces are thin (`platform-console` = 1 `aria-*`, 0 `role` outside the shell).
- **Strategic State:** Roles/labels on data tables + panels, reusing DS `Table`/`Badge`.
- **Reasoning:** The shell fixed nav a11y; tables/panels/forms still under-labeled.
- **Migration Plan:** Extend roles/labels to tables+panels; reuse DS primitives.
- **Validation Plan:** Accessibility (table/panel roles, labels); E2E.
- **Deletion Plan:** None.
- **Rollback Plan:** Per-surface revert.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 5. **Owner:** Platform-ops owner. **Dependencies:** none.
- **Success Criteria:** console/ops non-nav surfaces labeled; a11y review passes.

---

### UX-020 — Tokenize hardcoded marketing/storefront nav chrome · **LEGACY**
- **Current State:** `marketing-site/Header.tsx` `rgb(255 255 255)`; `app-marketplace/globals.css` `rgba(5,7,12,0.98)`; `dynamic-header.tsx:199` inline `'white'` → nav bars stay fixed across themes.
- **Strategic State:** Nav colors via `--lb-color-*`; chrome themes correctly.
- **Reasoning:** Pre-token headers won't respond to dark/per-tenant; covered by stylelint once armed.
- **Migration Plan:** Route nav colors through tokens; rely on stylelint (G2) to hold.
- **Validation Plan:** Dark-mode visual (nav themes); E2E; stylelint.
- **Deletion Plan:** Remove hardcoded chrome colors after tokenization.
- **Rollback Plan:** Per-header revert.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 5. **Owner:** Marketing/Storefront owners. **Dependencies:** UX-006 G2; UX-003 (shared chrome).
- **Success Criteria:** nav chrome tokenized; themes across light/dark.

---

### UX-021 — Ratchet down raw type/spacing/radius/shadow channels · **LEGACY**
- **Current State:** baseline `rawPxFontSize:536`, `rawPxSpacing:1382`, `tsxArbitraryRadius:328`, `tsxArbitraryShadow:8` frozen-passing.
- **Strategic State:** Each migrated to `--lb-font-size-*`/`--lb-space-*`/`--lb-radius-*`/`--lb-shadow-*`; metrics ratchet to (near) 0.
- **Reasoning:** The excellent token scales (type/space/radius/shadow) are unused exactly where the debt is; the ratchet must compel repayment (G1).
- **Migration Plan:** Channel-by-channel migration under the scheduled `--update` (G1); biggest stores first (merchant/app-mktpl/marketing).
- **Validation Plan:** Unit (token snapshot); E2E (screenshot diff); Regression.
- **Deletion Plan:** N/A (replace in place).
- **Rollback Plan:** Per-channel, per-app revert.
- **Risk Level:** Low-Medium. **Complexity:** L. **Timeline:** Wave 5 (ongoing). **Owner:** each app owner. **Dependencies:** UX-006 G1.
- **Success Criteria:** all four metrics strictly decreasing each release.

---

### UX-022 — Expose density axis in merchant settings · **TRANSITIONAL**
- **Current State:** `letbuyyDensityTokens` (compact/comfortable/spacious) defined + `DensityToggle` exported but barely rendered; defaults to compact.
- **Strategic State:** Density switch in merchant settings; improves data-table operator UX.
- **Reasoning:** A built capability sits idle; operator-first tables benefit from density choice.
- **Migration Plan:** Render `DensityToggle` in merchant settings; persist; wire to `--lb` density selector.
- **Validation Plan:** Integration (density switch changes table density); Accessibility (toggle labeled).
- **Deletion Plan:** None.
- **Rollback Plan:** Remove the setting (default compact remains).
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 6 (polish). **Owner:** Merchant + DesignSystems. **Dependencies:** UX-003.
- **Success Criteria:** density user-switchable in merchant.

---

### UX-023 — Rename/document `token-core` to end the naming trap · **DEAD (naming)**
- **Current State:** `packages/token-core` is the auth/JWT envelope (`src/index.ts:4` `TokenKind`) but its name implies design tokens; the mission brief itself was misled.
- **Strategic State:** Renamed (`@letbuyy/auth-token-core`) or explicitly documented in `AGENTS.md` as the auth envelope, with `tokens.ts` documented as the design-token home.
- **Reasoning:** Prevents future agents/humans grepping the wrong package; a one-line clarity fix with outsized leverage.
- **Migration Plan:** Rename the package + update importers, OR add an `AGENTS.md` note + a package README banner (lower-risk).
- **Validation Plan:** Integration (importers resolve); doc check.
- **Deletion Plan:** None.
- **Rollback Plan:** Rename revert (mechanical).
- **Risk Level:** Low. **Complexity:** S. **Timeline:** Wave 4 (cheap, with C2 doc unification). **Owner:** Platform. **Dependencies:** none.
- **Success Criteria:** no ambiguity between auth-token-core and design tokens in docs/code.

---

### UX-024 — Editor chrome should use `var(--lb-*)`, not raw `letbuyyPrimitiveTokens` · **TRANSITIONAL**
- **Current State:** The theme editor (the differentiator, `editor/page.tsx`) imports raw `letbuyyPrimitiveTokens` (`:38`) for some chrome → JS-literal colors instead of CSS variables.
- **Strategic State:** Editor chrome uses `var(--lb-*)`; primitives kept only for canvas/preview math.
- **Reasoning:** The one place the best surface sidesteps the CSS-variable layer; keep the differentiator clean.
- **Migration Plan:** Swap chrome colors to `var(--lb-*)`; retain `letbuyyPrimitiveTokens` only where pixel math needs JS values.
- **Validation Plan:** Dark-mode visual (editor chrome themes); E2E (editor renders); Regression (undo/redo, device preview intact).
- **Deletion Plan:** None.
- **Rollback Plan:** Revert the chrome swap (editor logic untouched).
- **Risk Level:** Low. **Complexity:** S. **Timeline:** Wave 5. **Owner:** Merchant/Theme squad. **Dependencies:** none.
- **Success Criteria:** editor chrome themeable; primitives only in canvas math.

---

### UX-025 — Wire OS deep-links + remove dead `go_router` (mobile nav hygiene) · **LEGACY**
- **Current State:** `AppDeepLinkRouter.resolve` maps deep-links but `AndroidManifest.xml` has no deep-link `<intent-filter>` and iOS registers only the Google scheme → links inert; `go_router` is a shipped-but-unused dep (referenced only in its own file).
- **Strategic State:** OS intent filters / Universal Links route into the resolver; `go_router` removed or adopted consistently.
- **Reasoning:** Navigation correctness + dead-code hygiene; push/share deep-links can't currently be delivered.
- **Migration Plan:** Add Android App Links + iOS Universal Links/custom scheme → `AppDeepLinkRouter.resolve`; delete `go_router` (app uses `onGenerateRoute`).
- **Validation Plan:** Integration (deep-link opens the right screen); Regression (named-route table unaffected).
- **Deletion Plan:** Remove `go_router` dep + the unused `GoRouter`.
- **Rollback Plan:** Revert manifest/plist + dep changes independently.
- **Risk Level:** Low. **Complexity:** M (links) / S (go_router). **Timeline:** Wave 6 (mobile polish). **Owner:** Mobile squad. **Dependencies:** none.
- **Success Criteria:** deep-links deliverable; `go_router` gone.

---

### UX-026 — Liquid storefront renderer alignment vs the editor (differentiator) · **FROZEN**
- **Current State:** The theme editor can compose sections the storefront renders as **fallbacks** — Liquid rendering defaults OFF (`theme-governance-validator.mjs:56` `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`), renderer governance WARN (`:53`), `UnknownSectionFallback` placeholder. The editor is ahead of the renderer.
- **Strategic State:** Per A5, **Liquid is CANONICAL but DEFERRED (Waves 6–8, gated on theme-marketplace / 3rd-party demand)**; until then, FREEZE the React/Liquid duplication and keep ONE seam. The editor↔renderer mismatch is capped, not closed, until the Wave-6+ product decision flips Liquid on.
- **Reasoning:** A5 is explicit — do not chase Liquid for completeness; it unlocks a *marketplace* and 3rd-party authors, which is the ecosystem trigger, not a beta blocker. The DS plan inherits A5's sequencing.
- **Migration Plan:** (deferred) when demand triggers: resolve the Liquid decision, flip renderer governance to error once the mismatch audit is clean. Until then: freeze new-section duplication; designate the single seam.
- **Validation Plan:** (at trigger) Contract (editor schema ↔ renderer parity); E2E (no `UnknownSectionFallback` on shipped sections).
- **Deletion Plan:** (at trigger) retire the React-per-section fast-path once Liquid hits parity.
- **Rollback Plan:** Liquid stays flag-off; fallback placeholder is the safe state.
- **Risk Level:** Medium (ecosystem-scoped). **Complexity:** L. **Timeline:** Waves 6–8 (deferred). **Owner:** Theme/Storefront squad. **Dependencies:** A5 theme-marketplace demand trigger.
- **Success Criteria:** (at trigger) editor and renderer at parity under one seam; until then, duplication frozen, not growing.

---

### UX-027 — Marketing kit consolidation (`MarketingHeader`/`MarketingFooter`) · **LEGACY**
- **Current State:** `{Header,Footer}.tsx` duplicated across app-marketplace + marketing-site → brand chrome drifts between the two public surfaces.
- **Strategic State:** Shared `MarketingHeader`/`MarketingFooter` in `@letbuyy/ui` (or a marketing kit), consumed by both.
- **Reasoning:** Two public surfaces with forked chrome drift; one kit keeps brand consistent.
- **Migration Plan:** Extract the kit; consume in both apps; delete the duplicates.
- **Validation Plan:** E2E (both public surfaces render the shared chrome); Regression.
- **Deletion Plan:** Delete the two duplicated `{Header,Footer}` after kit adoption.
- **Rollback Plan:** Revert to local chrome per app.
- **Risk Level:** Low. **Complexity:** M. **Timeline:** Wave 5. **Owner:** Marketing/Web + DesignSystems. **Dependencies:** UX-013/UX-015.
- **Success Criteria:** one marketing chrome source; duplicates deleted.

---

## 9. Test & validation plan (per the testing mandate)

Every migration above carries the test types below; this section is the consolidated matrix. **No shell or token source is deleted until all consumers are migrated and the relevant tests pass.**

| Test type | What it asserts | Where it gates |
|---|---|---|
| **Unit (token snapshot)** | `tokens.ts` exports (primitive/semantic/component/density/type/space/radius/shadow) are stable; Dart bridge snapshot stable | UX-001/002/008/021 |
| **Integration (shell adoption)** | shell-adoption count → 9/9; AppNavigation present per app; no inline nav (HARD invariant); ratchet metrics strictly decreasing | UX-003/006 |
| **Contract (token bridge web↔Dart parity)** | `tokens.json`↔`tokens.ts` parity (existing gate); `mobile-tokens` color+spacing+**type+density** parity (extended); honesty-badge `provider_mode` field identical web/mobile | UX-001/002/004/008/009 |
| **E2E (visual regression / screenshot diff)** | per migrated app, before/after screenshot diff within tolerance; storefront per-store theming intact; editor undo/redo/device-preview intact | UX-003/010/011/012/013/024/027 |
| **Accessibility (WCAG AA)** | contrast (token validator + per-screen review), focus-visible present (esp. marketing/identity), keyboard nav + focus order, `aria-current`, touch targets ≥44px (mobile density) | UX-007/015/016/018/019; floor for ALL |
| **Dark-mode visual** | toggle reachable 9/9; dark renders on the slate ramp (mobile re-pointed); nav chrome themes; per-store dark correctness flagged UNVERIFIED | UX-007/009/011/020/024 |
| **Responsive** | breakpoints match `--lb-bp-*`; reflow at each viewport (screenshot-diff proxy; true reflow UNVERIFIED) | UX-017 |
| **Regression** | named routes resolve; the 36 real mobile routes unaffected by parity deletion; 62 screens still compile after bridge re-point | UX-002/003/014 |
| **Rollback validation** | each migration revertible by single PR; `ThemeScript` prevents FOUC during token rollback; lint can run warn-first before error | ALL |
| **Deletion validation** | no shell/token source deleted while a consumer references it (grep-gated in CI before deletion PRs) | UX-001/002/013/014/023/027 |

**Accessibility is a hard floor, not a wave item:** no migration may *regress* a11y (per the mission and V1). The token library already ships a real WCAG validator (`tokens.ts:1154-1185`, AA 4.5 / focus 3.0) and honors `prefers-reduced-motion` (`:1360-1372`) — adoption inherits this; forks lose it (the reason shell adoption is a11y-positive).

---

## 10. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| RR-1 | Honesty badge slips past Waves 2–3 → a sandbox no-op reads as `success` on a live money surface (R2/TD-1) | Med | **High (go-live)** | Badge is Phase B4→D1, validator-enforced; ban silent `success` in the payments path; it is the ONE DS item gated to go-live | Finance/Payments |
| RR-2 | Shell migration of the **merchant** OS regresses operator-first IA, command palette, or shortcuts | Med | High | Pilot in late Wave 4; preserve `merchantNavigation.ts` IA + palette + shortcuts; screenshot-diff + a11y gate before cutover | Merchant |
| RR-3 | Mobile `ThemeData` re-point breaks golden tests / live colors | Med | High | Re-baseline goldens; do it behind the extended `validate:mobile-tokens`; one-file revert | Mobile |
| RR-4 | Ratchet `--update` lowers a metric faster than the team can burn down → CI red blocks unrelated PRs | Med | Med | Per-metric pause (freeze, don't increase) if a channel stalls; 10%/release is conservative | Platform/DevEx |
| RR-5 | stylelint armed before burn-down → mass CI failures | Low | Med | Install + run warn-first; promote to fail-on-error only after the channel is clean (G2 then G3) | DevEx |
| RR-6 | Storefront tokenization erases legitimate per-store dynamic theming (treated as "debt") | Med | High | Explicitly tag dynamic-color inline styles as allowed by pattern; lint distinguishes dynamic vs static (UX-012) | Storefront |
| RR-7 | DS work pulled earlier than Wave 4–5, competing with security/money/tenancy for the critical path | Med | Med | This plan is explicitly Phase E; only the honesty badge (+a11y floor) is earlier; do not reprioritize DS above S0/money | ABR |
| RR-8 | Deleting a token source/shell while a consumer still references it | Low | High | Deletion-validation CI gate (grep) blocks any deletion PR with a live consumer | Platform |
| RR-9 | marketing-site un-exile before focus-visible/token migration → public a11y + drift regression | Low | Med | Keep exiled until UX-015 completes; un-exile is the *last* step | Marketing |
| RR-10 | Liquid renderer alignment (UX-026) pulled forward for "completeness," violating A5 | Low | Med | A5 is binding: Liquid is deferred to the marketplace trigger; freeze duplication, don't chase parity | ABR/Theme |
| RR-11 | Constitution split (AGENTS.md 9-app + rejected-arch validators) keeps the ratchet enforcing the wrong thing | Med | Med | Gate G1/G3 on C2 (regenerate AGENTS.md from V1; retarget validators) so DS governance lives under one constitution | Platform |

---

## 11. Classification summary

| Classification | Count | Items |
|---|--:|---|
| **CANONICAL** | 12 | UX-001, UX-002, UX-003, UX-004, UX-005, UX-006, UX-008, UX-009 (→), UX-011-kit-part, UX-012 (kit), + the existing canonical engines (tokens.ts, AppNavigation, LetbuyyThemeProvider) treated as protect-not-build |
| **TRANSITIONAL** | 6 | UX-007, UX-009 (entry), UX-017, UX-019, UX-022, UX-024 |
| **LEGACY** | 11 | UX-010, UX-011, UX-012 (drift part), UX-013, UX-015, UX-016, UX-018, UX-020, UX-021, UX-025, UX-027 |
| **DEAD** | 2 | UX-014 (parity catalog), UX-023 (token-core naming trap) |
| **FROZEN** | 1 | UX-026 (Liquid renderer alignment, deferred to marketplace trigger per A5) |

(Items spanning classes are counted by their dominant verdict; UX-009 and UX-012 appear in two rows because they each carry a CANONICAL target and a LEGACY-demotion.)

---

## 12. Sequencing honesty (where UI/UX sits)

**Design unification is debt-paydown, sequenced AFTER security/money/tenancy.** Per the master Phase model and A8's cross-cutting law: S0 data-leaks + the deploy meta-blocker first (Phase A / Waves 0–1); money-correctness for live keys (Phase B / Waves 2–3); tenancy + architecture true-up incl. regenerating the constitution so the ratchet enforces V1 (Phase C / Wave 4); product-complete for beta (Phase D / Wave 4); **then the DS burn-down + shell adoption + dark reachability + mobile convergence + governance upgrade (Phase E / Wave 5)**; ecosystem (Liquid marketplace, density UX, deep-links) at Waves 6–8.

**The two exceptions that move earlier:**
1. **Provider-mode honesty badge (UX-004)** — money-surface *honesty*, not polish. Ships Waves 2–3 (Phase B4→D1) with real payouts, validator-enforced. This is the only DS line item that is a **go-live concern**.
2. **The accessibility floor** — no migration in any wave may regress a11y (contrast, focus, keyboard, touch targets). Not a wave item; a constant constraint.

Everything else explicitly does **not** block go-live. Do not let DS polish compete with S0/money/tenancy for the critical path (RR-7).

---

## 13. UNVERIFIED (rendering-dependent / out-of-repo)

This is a source-level audit. The following cannot be confirmed without running the apps or out-of-repo systems:
- **On-screen color contrast** per screen (the library ships an AA validator and AA-capable ramps, but nothing was rendered). Highest risk: marketing (0 focus-visible), storefront/mobile (per-store / off-spec palettes).
- **Real responsive reflow/overflow** at each breakpoint, especially the hand-`@media` desktop-first apps (marketing, app-marketplace) on mobile web.
- **Dark-mode visual correctness** in the 7 system-only apps and the customer apps that re-author colors (storefront/marketing render their own palettes, not the `--lb-*` dark ramp).
- **Touch-target sizes** in Flutter (density tokens would guarantee ≥44px but are 0% adopted; sizing is per-widget).
- **Focus-trap / keyboard-nav behavior** of modals / command palette / theme editor at runtime (source shows the wiring; behavior unverified).
- **Whether `validate:design-system` runs to completion in the real GitHub Actions runner** (it passes locally; the CI environment was not exercised).
- **Mobile golden-test stability after the `ThemeData` re-point** (UX-002) — must be re-baselined and visually reviewed; not pre-validated here.
- **Server-side `provider_mode` truthfulness** feeding the honesty badge (UX-004) depends on Phase-B4 rail emitting a real mode — the badge is only as honest as that field; the field's correctness is a payments-plan concern, not verifiable in the DS layer.

---

## UI/UX Unification Findings/Actions

| ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line) |
|---|---|---|---|--:|---|---|
| UX-001 | Web token source (`tokens.ts` DTCG) | Single source of truth; kill bypasses + 112 app-local redefs | CANONICAL | 5 | Low | `packages/typescript/ui/src/tokens.ts:1-1388`; `tokens.json`; baseline `appLocalLbTokenRedefs:112` |
| UX-002 | Mobile token bridge | Generated bridge from `tokens.ts`; re-point `ThemeData`; delete duplicate class | CANONICAL | 5 | Med | `letbuyy_color_tokens.dart`; `store_theme.dart` (imports ui_kit only); `package.json:25` |
| UX-003 | App shell `AppNavigation` | Roll 2/9 → 9/9, merchant first; HARD invariant blocks inline nav | CANONICAL | 5 | Med | `navigation/app-navigation.tsx:51-88`; consumers `(dashboard)/layout.tsx` ×2; `merchantNavigation.ts` |
| UX-004 | Provider-mode honesty badge | Build shared `ProviderModeBadge` web+mobile; validator-enforced; **go-live-relevant** | CANONICAL | **2–3** | High | none in `@letbuyy/ui` (grep ∅); `money_screen.dart:256`; V1 §1 P4/§10; FREEZE §4 |
| UX-005 | Merchant Money/Finance nav node | Add first-class Finance primary item | CANONICAL | 4 | Low | `merchantNavigation.ts:63-123` (no finance node) |
| UX-006 | Governance ratchet + stylelint + ESLint | Repay on a clock; arm stylelint in CI; warn→error; 2 HARD invariants | CANONICAL | 4–5 | Low | `design-system-baseline.json`; `package.json:27`; `pnpm-lock.yaml` (0); `ci.yml:84,87` |
| UX-007 | Dark-mode reachability | Add toggle to 7/9 toggle-less apps | TRANSITIONAL | 5 | Low | `theme-provider.tsx`; toggles in merchant(3)+theme-mktpl(5) only |
| UX-008 | Mobile spacing/type/density + Dart lint | Tokenize; extend bridge with type/density; CI Dart lint | CANONICAL | 5 | Med | mobile 334 `Color(0x`/712 `fontSize:`/2,040 EdgeInsets/0 density |
| UX-009 | Mobile semantic + dark colors | Reconcile `AppColors`/dark teal to canonical ramp | LEGACY→CANONICAL | 5 | Low-Med | `app_colors.dart` `#A4E500/#B02525`, dark `#D3E4E3/#AED9D8/#89CBCB` |
| UX-010 | Tailwind default-palette classes | Burn down 606; blocklist; rule→error | LEGACY | 5 | Low | baseline `tailwindPaletteClasses:606`; `*/eslint.config.mjs:20` |
| UX-011 | merchant `globals.css` | Burn down 10,335 lines / 2,210 px / 405 rgb to tokens | LEGACY | 5 | Med | `apps/merchant-control-plane/src/app/globals.css` |
| UX-012 | Storefront drift vs dynamic theming | Separate per-store dynamic (keep) from static hardcodes (tokenize); storefront kit | LEGACY/CANONICAL | 5 | Med | `coming-soon/page.tsx:95,129`; `product-details-client.tsx:125` |
| UX-013 | Component duplication | StatusBadge×5 / developer-docs tables / workspace twins / marketing chrome → DS primitives | LEGACY | 5 | Low | `developer-docs.tsx` (554); `_local-ui/{console,ops}-workspace.tsx` |
| UX-014 | Mobile parity catalog (TD-5) | Delete both files + 6 orphan routes; redirect Settings | DEAD | 4 | Low | `screens/parity/merchant_feature_{screen,definitions}.dart`; `settings_screen.dart:411` |
| UX-015 | marketing-site a11y + un-exile | Add focus-visible; migrate 25 hex/rgb/px; remove from `exiledApps` | LEGACY→CANONICAL | 5 | Med | `marketing-site/.../globals.css:4934,4936,5095`; baseline `exiledApps` |
| UX-016 | identity auth-form a11y | a11y pass; remove 43 inline styles + 11 `!important` | LEGACY | 5 | Med | `identity-platform/.../globals.css`; 41 `aria-*`, 11 `!important` |
| UX-017 | Responsive strategy | Unify on Tailwind breakpoint preset; kill literal-px `@media` | TRANSITIONAL | 5 | Low-Med | marketing 76 `@media`/1 tw-bp; app-mktpl 8/0; identity 5/0 |
| UX-018 | developer-portal a11y | Add roles/landmarks; adopt DS Table/Tabs; shell | LEGACY | 5 | Low | `developer-portal/src/**` 0 `role`/2 focus-visible |
| UX-019 | console/ops non-nav a11y | Roles/labels on tables+panels (nav already fixed) | TRANSITIONAL | 5 | Low | console 1 `aria-*`/0 `role` outside shell |
| UX-020 | marketing/storefront nav chrome | Tokenize hardcoded nav colors | LEGACY | 5 | Low | `marketing-site/Header.tsx` `rgb(255 255 255)`; `dynamic-header.tsx:199` |
| UX-021 | Raw type/spacing/radius/shadow | Ratchet down to token scales | LEGACY | 5 | Low-Med | baseline `rawPxFontSize:536`/`rawPxSpacing:1382`/`tsxArbitraryRadius:328`/`tsxArbitraryShadow:8` |
| UX-022 | Density axis UX | Expose `DensityToggle` in merchant settings | TRANSITIONAL | 6 | Low | `tokens.ts:500-585`; `DensityToggle` exported, rarely rendered |
| UX-023 | `token-core` naming trap | Rename/document; clarify vs `tokens.ts` | DEAD (naming) | 4 | Low | `packages/token-core/src/index.ts:4` (`TokenKind`) |
| UX-024 | Theme-editor chrome tokens | Use `var(--lb-*)` not raw `letbuyyPrimitiveTokens` | TRANSITIONAL | 5 | Low | `editor/page.tsx:38` import of `letbuyyPrimitiveTokens` |
| UX-025 | Mobile deep-links + `go_router` | Wire OS intent filters into resolver; remove dead dep | LEGACY | 6 | Low | `deep_link_router.dart:53-78`; `AndroidManifest.xml` (LAUNCHER only); `app.dart:54-56` |
| UX-026 | Liquid renderer vs editor | Freeze duplication; defer Liquid to marketplace trigger (A5) | FROZEN | 6–8 | Med | `theme-governance-validator.mjs:53,56`; `renderer-registry` `UnknownSectionFallback` |
| UX-027 | Marketing kit | Extract `MarketingHeader`/`Footer`; delete duplicates | LEGACY | 5 | Low | `app-marketplace/src/components/{Header,Footer}.tsx` vs `marketing-site/...` |

---

*End of UI/UX Unification Master Plan. This is a sequencing-and-decision deliverable, not new architecture; it subordinates to V1 + Freeze + A8/A7 and ties every action to the forensic evidence in `FORENSIC_MASTER_2026_06_10/`. The single go-live-relevant UI item is the provider-mode honesty badge (UX-004); everything else is Wave 4–5 debt-paydown that must not regress accessibility.*
