# LETBUYY UI/UX GOVERNANCE

**Document:** DOC 06 — UI/UX Governance (the design-system constitution)
**Program:** Governance Rewrite 2026 · Architecture Review Board (ARB)
**Author:** Principal Design-Systems Architect (Polaris / Stripe / Linear / Vercel pedigree)
**Date:** 2026-06-10
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (current working tree, re-verified 2026-06-10)
**Status:** CANONICAL, ratifiable. This is the single design-system authority for LetBuyy.

---

## 0. Supersession header & authority-chain position

**Authority-chain position (per `_GOVERNANCE_SPINE.md` S2):** Level 5. This document is subordinate to — and must conform to — `LETBUYY_CONSTITUTION.md` (DOC 01), `LETBUYY_AGENTS_V2.md` (DOC 02), and `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03). It governs everything below it: all design-token, shell, component, navigation, theming, accessibility, and visual-quality decisions across every LetBuyy surface. On any conflict, the higher document wins; on any UI/UX matter not addressed higher, **this document is supreme.**

**What it supersedes (these are now historical record, `docs/archive/` only):**

| Superseded artifact | Status |
|---|---|
| `DESIGN_SYSTEM_MASTER_AUDIT.md`, `DESIGN_TOKEN_AUDIT.md`, `DESIGN_SYSTEM_ADOPTION_SCORECARD.md` (2026-06-08/09) | Superseded — measurements stale (pre-`LetbuyyThemeProvider`, pre-ratchet) |
| `NAVIGATION_GOVERNANCE_AUDIT.md`, `NAVIGATION_GOVERNANCE_REPORT.md`, `COMPONENT_DUPLICATION_REPORT.md` | Superseded by §3, §6 below |
| `DARK_MODE_GOVERNANCE_REPORT.md`, `LIGHT_DARK_MODE_AUDIT.md`, `MOBILE_DESIGN_SYSTEM_REPORT.md` | Superseded by §3.D, §3.J below |
| Any `docs/governance/*` rule that mandates per-app theming, bespoke shells, or baselined-drift-as-acceptable | Repealed |

**What it ratifies as binding law:** the decisions already taken in `STRATEGIC_CANONICALIZATION_2026_06_10/UI_UX_UNIFICATION_MASTER_PLAN.md` (27 UX actions, UX-001…UX-027) and grounded in `FORENSIC_MASTER_2026_06_10/UI_UX_GOVERNANCE_AUDIT.md` (per-app ×9 scoring matrix, findings UIUX-001…033). This document does not re-litigate those winners; it **encodes them as enforceable governance** and extends them with the 10/10 target-state definition, the canonical design-system law, the scoring rubric, and the numbered rule table (§13).

**Scale envelope (constitutional constant, `_GOVERNANCE_SPINE.md` S3):** India-only, 100 → 1,000 → 10,000 merchants. The design system is built for **operator density and merchant trust at 10k**, never for 100k+/1M+. No design decision in this document optimizes for a scale the company has frozen out.

**Evidence-integrity rule.** Every current-state claim is grounded in `grep`/`rg`/`path:line` against the current tree, re-verified 2026-06-10. This is a **source-level governance document, not a rendered audit.** On-screen contrast, focus-ring visibility, reflow at a viewport, touch-target pixels, and dark-mode visual correctness are marked **UNVERIFIED — source-level** (consolidated in §14). The benchmark sections cite durable, published design-system principles; where a specific framework detail could have moved since the January-2026 knowledge boundary it is flagged. Polaris current-principle citations (typography hierarchy, tabular numerals for currency, motion restraint, the "Pro design language") were re-verified against `polaris-react.shopify.com/design/typography` on 2026-06-10.

---

## 1. Executive verdict — the design-leadership call (5 sentences)

LetBuyy already owns a **Polaris-grade token engine** (`packages/typescript/ui/src/tokens.ts`, 1,388 lines — primitive→semantic→component with density/surface/motion axes, runtime WCAG contrast validation, fluid `clamp()` type, and a `prefers-reduced-motion` kill-switch), a **canonical theme controller** adopted 9/9, a **DTCG interchange file** (`tokens.json`), and a **real CI ratchet gate** — so the mandate is emphatically **not "build a design system," it is "collapse the duplicates onto the one that should exist at 10k merchants and convert the governance from freezing drift to blocking it."** The system today is fractured into **three token sources, eight hand-rolled navigations (canonical shell adopted 2/9), four competing mobile color classes, two design cultures sharing one token file, and a governance gate that baselined 573 naked `rgb()/hsl()` + 1,382 raw-px spacings + 638 inline styles as permanently "passing"** — and it is missing the one component that is a money-truth requirement: the provider-mode honesty badge (verified absent from `@letbuyy/ui`; only a raw `provider_mode ?? 'sandbox'` text echo exists on mobile at `money_screen.dart:256`). The canonical law is therefore unambiguous: **ONE token source (`tokens.ts`, DTCG-projected) generates every platform (web `--lb-*`, Dart bridge); ONE shell (`AppNavigation`) reaches 9/9; ONE theme controller stays protected; the honesty badge is built and rendered on every money/fulfillment surface; and the ratchet is upgraded to block new drift AND repay accumulated drift on a clock.** Benchmarked against the references, LetBuyy's bones are at the level of the field — the gap is **adoption discipline and enforcement teeth, not architecture** — which is why the 10/10 path is a finite burn-down, not a rebuild. **Honesty over polish:** every line of this work except the honesty badge (a go-live money-truth requirement) and the non-negotiable accessibility floor is debt-paydown sequenced into Phase 7 / Waves 4–5, explicitly NOT a go-live blocker, and no migration may ever regress accessibility.

**Overall design-maturity score: 2.8 / 5 today → target 9.5 / 10 (≈ 4.75 / 5) at full ratification.** (Per-surface scorecard in §12.)

---

## 2. The 10/10 target state — the four-line definition

> **The benchmark every LetBuyy surface is held to.**

1. **One source, every platform.** `tokens.ts` is the sole authoring source of truth; it projects to DTCG `tokens.json`, to web `var(--lb-*)`, and to a generated Dart bridge that the Flutter `ThemeData` actually consumes — zero parallel token systems, zero app-local `--lb-*` redefinitions, zero hardcoded hex/px/inline-color anywhere a validator can see.
2. **One shell, one IA grammar, a first-class Money node.** `AppNavigation` is rendered 9/9 (one sidebar width, route-computed active state, `aria-current` for free); the merchant OS is operator-first with **Orders / Money / Customers** all top-level primary; mobile converges on the same IA contract.
3. **Complete states, complete themes, AA everywhere.** Every component ships all required states (light · dark · skeleton · empty · error-with-retry · focus · hover · active · disabled), light and dark are both complete and user-*reachable* 9/9, and every surface meets WCAG 2.1 AA (contrast, visible focus, full keyboard operability, ≥44px touch targets, labeled controls, semantic HTML).
4. **Honest by construction, governed by a ratchet that bites.** A governed `ProviderModeBadge` renders live/sandbox/scaffold truth on every money/fulfillment surface (a stub never reads as `success`); CI blocks all new drift via stylelint + token-lint + the `validate:design-system` ratchet, which simultaneously ratchets the legacy debt down 10%/release until it reaches zero.

---

## 3. Surface × Category deep analysis — current → 10/10 target → governing rule

> Five surfaces (Merchant Control Plane · Storefront · Checkout · Operations · Mobile Merchant App) across ten categories (Typography · Spacing · Component consistency · Navigation · Dark Mode · Light Mode · Accessibility · Responsiveness · Information Architecture · Visual hierarchy). For each cell: **Current** (forensic evidence/score, `path:line`) → **10/10 Target** → **Governing rule** (the UX-R rule from §13 that binds it). Surfaces are analyzed in priority order; the four other web apps (`admin-web`, `platform-operations-portal`, `theme-marketplace`, `developer-portal`, `app-marketplace`, `identity-platform`, `marketing-site`) are covered under §3.D (Operations cluster) and §3.K (cross-app supplement) so every one of the nine web apps + the Flutter app is addressed.

The forensic per-app ×9 scoring matrix this analysis is built on (`UI_UX_GOVERNANCE_AUDIT.md` §3):

| App | Spacing | Type | Layout | Responsive | DarkMode | Comp | A11y | Nav | Hier | **Avg** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| merchant-web | 5 | 6 | 6 | 7 | 6 | 6 | 8 | 8 | 7 | **6.6** |
| platform-operations-portal | 9 | 9 | 8 | 6 | 7 | 6 | 5 | 7 | 6 | **7.0** |
| admin-web | 9 | 9 | 8 | 6 | 6 | 6 | 4 | 7 | 6 | **6.8** |
| theme-marketplace | 7 | 7 | 7 | 7 | 6 | 6 | 6 | 5 | 6 | **6.3** |
| developer-portal | 8 | 6 | 7 | 5 | 5 | 5 | 3 | 5 | 6 | **5.6** |
| app-marketplace | 4 | 4 | 5 | 5 | 5 | 5 | 7 | 4 | 6 | **5.0** |
| identity-platform | 4 | 4 | 5 | 5 | 4 | 5 | 5 | — | 6 | **4.8** |
| customer-web | 3 | 3 | 4 | 6 | 4 | 4 | 5 | 4 | 6 | **4.3** |
| marketing-site | 2 | 2 | 4 | 7 | 2 | 4 | 4 | 4 | 6 | **3.9** |
| merchant_app | 2 | 1 | 3 | 6 | 7 | 4 | 5 | 6 | 6 | **4.4** |
| **PLATFORM AVG** | **4.8** | **5.1** | **5.6** | **6.0** | **5.2** | **5.0** | **4.8** | **5.3** | **6.1** | **5.4 / 10** |

---

### 3.A — MERCHANT CONTROL PLANE (`apps/merchant_web`, avg 6.6 — the primary OS)

The highest-value surface. Deepest `@letbuyy/ui` adoption (~74 import files), best accessibility on the platform, genuinely operator-first IA — but carries the single largest drift store and has not adopted the canonical shell.

| Category | Current state (evidence) | 10/10 target | Governing rule |
|---|---|---|---|
| **Typography** | Consumes type tokens in components, but `globals.css` carries a large share of the platform's raw `font-size:px`; merchant is one of the 3 apps owning ~80% of raw px. (`apps/merchant_web/src/app/globals.css`; baseline `rawPxFontSize:536`.) Score 6. | All type via `var(--lb-font-size-*)`/`--lb-font-*`; Polaris-style hierarchy through weight+size+position; **tabular numerals on every money/quantity column** (orders, payouts, inventory). | UX-R7, UX-R20 |
| **Spacing** | Scored 5 purely on raw-px density: **2,210 raw px** in a **10,335-line** `globals.css`. The 12-step `--lb-space-*` scale (`tokens.ts:672-800`) is excellent and unused where it matters most. | `globals.css` reduced to a thin reset + token-derived aliases; all padding/margin/gap on `var(--lb-space-*)`. | UX-R6 |
| **Component consistency** | Strong `@letbuyy/ui` adoption, but StatusBadge re-derived locally (part of the 5× platform pattern) and 112 app-local `--lb-*`/alias redefinitions shadow canonical tokens (most now derive via `color-mix()`, `globals.css:50-59`). Score 6. | Zero local StatusBadge re-derivation (exported `Badge`/`StatusVariant` only); zero app-local `--lb-*` redefinition outside `@letbuyy/ui`. | UX-R9, UX-R3 |
| **Navigation** | **8/10** and operator-first, but **forks the shell** — uses `AdminShell`/`Sidebar`/`HeaderBar`/`AISidebar` + `merchantNavigation.ts` instead of `AppNavigation`. Active state is real (`isNavPathActive`) but hand-maintained. | Adopts `AppNavigation` (1st migration target, §6) preserving operator-first IA + command palette + `g o`/`g p`/`g c` shortcuts; inherits canonical width + `aria-current` for free. | UX-R10, UX-R11 |
| **Dark Mode** | Provider wired; **toggle present** (3 files) → dark reachable. Score 6 (held by `globals.css` re-authored colors not all on the `--lb-*` dark ramp). | Every surface renders the `--lb-*` dark ramp; toggle stays; AA contrast in dark verified. | UX-R12, UX-R14 |
| **Light Mode** | Default; functional. The semantic light role set is complete (`tokens.ts:186-315`). | Light is the `--lb-*` light ramp end-to-end; no off-ramp literals. | UX-R12 |
| **Accessibility** | **Best on platform: 8/10** — 469 `aria-*`, 23 `role`, 105 `focus-visible`. | WCAG 2.1 AA across all flows; non-nav tables/panels fully labeled; keyboard-complete. | UX-R15, UX-R16, UX-R17 |
| **Responsiveness** | Healthy Tailwind-first (187 `sm:/md:/lg:`, 19 `@media`). Score 7. | All breakpoints from `letbuyyBreakpointTokens` preset; reflow verified at each viewport. | UX-R18 |
| **Information Architecture** | Operator-first **MET for the store profile**: Home → Orders → Products → Customers → Marketing → Content → Analytics → Online Store → Settings (`merchantNavigation.ts:63-123`); Orders/Products/Customers are `primary`, Settings is `bottom`. **One gap: no first-class Money/Finance node** (V1 §10 "Orders/Money/Customers primary" only 2/3 met) (`UIUX-009`). Score reflected in Nav 8. | A top-level **`Finance`** primary item (payouts, balances, settlement statements) at the level of Orders/Customers → 3/3 met. | UX-R19 |
| **Visual hierarchy** | 7/10 — clear, card-based, theme-editor-grade. | Polaris "type defines hierarchy" — weight/size/position, never color-alone; money legible (Stripe). | UX-R20, UX-R21 |

**The theme editor (the differentiator — protect it):** `online-store/themes/[themeId]/editor/page.tsx` (1,892 lines) is a Shopify-class three-panel visual editor with undo/redo history, device preview, draft/publish versioning, schema-driven forms, and AI assist — the strongest single surface in the platform. Governing rule: it stays canonical; its chrome must move off raw `letbuyyPrimitiveTokens` (`editor/page.tsx:38`) onto `var(--lb-*)` (UX-R3), and no migration may regress its undo/redo or device-preview behavior.

---

### 3.B — STOREFRONT (`apps/customer_web`, avg 4.3 — the buyer surface, worst-drift app)

A deliberately bespoke buyer runtime that renders each merchant's chosen colors. The governing insight: **per-store dynamic theming is a legitimate, blessed axis — it is NOT drift.** The fix is to distinguish it from genuine hardcodes, not to force admin `--lb-*` onto merchant-themed surfaces.

| Category | Current state (evidence) | 10/10 target | Governing rule |
|---|---|---|---|
| **Typography** | Worst on platform with marketing (3/10); part of the ~720 raw web `font-size:`. | Static chrome type on `--lb-font-size-*`; per-store type remains a merchant axis; both legible. | UX-R7, UX-R22 |
| **Spacing** | 3/10 — **1,056 raw px**, shallow token adoption (~4 primitives across 42 import files). | Static chrome spacing on `--lb-space-*`; "storefront kit" of themable primitives covers static structure. | UX-R6, UX-R22 |
| **Component consistency** | 4/10; shallowest token adoption of any large surface. | A small **storefront kit** in `@letbuyy/ui` (themable primitives) is the canonical static-chrome source. | UX-R9, UX-R22 |
| **Navigation** | `dynamic-header.tsx` + `account/layout.tsx` (`usePathname`); nav chrome hardcoded (`dynamic-header.tsx:199` inline `'white'`). Score 4. | **Account** shell adopts `AppNavigation`; storefront buyer chrome stays per-store but its *structural* colors tokenize. | UX-R10, UX-R8 |
| **Dark Mode** | 4/10 — provider wired, **no toggle** (system-only); per-store palettes, not the `--lb-*` dark ramp → **dark correctness per-store and UNVERIFIED**. | Static chrome respects `--lb-*` dark; per-store dark is a documented merchant responsibility; toggle added. | UX-R12, UX-R13 |
| **Light Mode** | Functional; per-store. | Static chrome on `--lb-*` light; per-store light is the merchant's. | UX-R12 |
| **Accessibility** | 5/10 — 84 `aria-*`, 5 `role`, 5 `focus-visible` for the **largest** surface; full alt coverage (25/25). | AA on all static chrome + checkout-adjacent flows; per-store theming carries a contrast guardrail (the token validator). | UX-R15, UX-R16 |
| **Responsiveness** | 6/10 — Tailwind-first (194 `sm:/md:/lg:`). | Breakpoint preset; reflow verified; buyer surface is mobile-web-first. | UX-R18 |
| **Information Architecture** | 6/10 hierarchy; buyer IA is product-led. | Clear product → cart → checkout path; account shell uses the canonical IA grammar. | UX-R19 |
| **Visual hierarchy** | 6/10. | Buyer hierarchy clear; **money legible** (price, totals, taxes) per Stripe. | UX-R20, UX-R21 |

**The separation rule (binding):** legitimate per-store dynamic-color inline styles (e.g. `product-details-client.tsx:125` `backgroundColor: colors.backgroundColor`) are **explicitly allowed by pattern** and must be lint-exempted as such; genuine hardcodes (`coming-soon/page.tsx:95,129` `rgb(252 165 165)`/`rgb(5 5 5)`) become tokens. The 794 `rgb()` / 582 inline `style={` / 231 Tailwind-palette / 1,056 px (`UIUX-012`) are burned down only against this distinction.

---

### 3.C — CHECKOUT (the hosted `checkout.letbuyy.com` origin — to-be-built, born canonical)

Per the canonical architecture (`_GOVERNANCE_SPINE.md` S4), checkout is served from the storefront read-path (no separate `checkout-runtime`); the hosted origin is **currently MISSING** (signed-handoff URLs are dead links). There is therefore **no legacy to migrate** — it is greenfield, and it is **born on the canonical design system.**

| Category | 10/10 target (born-canonical, no current-state debt) | Governing rule |
|---|---|---|
| **Typography** | `--lb-font-size-*` from day one; **tabular numerals on every amount** (Stripe money-legibility law). | UX-R7, UX-R21 |
| **Spacing** | `--lb-space-*` only; Stripe-grade form rhythm and field spacing. | UX-R6, UX-R23 |
| **Component consistency** | `@letbuyy/ui` form primitives only; zero bespoke inputs. **Stripe form-clarity principle adopted.** | UX-R9, UX-R23 |
| **Navigation** | Linear, single-purpose checkout flow; no primary nav; visible step state. | UX-R19 |
| **Dark Mode / Light Mode** | Both complete on `--lb-*` ramps from day one; respects the buyer's store theme where applicable. | UX-R12 |
| **Accessibility** | **AA is a launch gate here, not a wave item** — labeled fields, `aria-describedby` errors, focus management, ≥44px targets, keyboard-complete, error-with-retry on every payment failure. | UX-R15..R17, UX-R5 |
| **Responsiveness** | Mobile-web-first; breakpoint preset; verified reflow (checkout is the highest-stakes mobile surface). | UX-R18 |
| **Information Architecture** | Cart → address → pay → confirm; one decision per step; **honesty badge on the pay step.** | UX-R4, UX-R19 |
| **Visual hierarchy** | Money is the hero; totals/taxes/fees unambiguous; CTA unmistakable. | UX-R21 |

**Governing rule (binding):** the checkout origin **MUST consume `@letbuyy/ui` + `--lb-*` from its first commit**; the honesty badge and money-surface AA apply here in full; this is the one surface where the DS plan defers *timing* to the checkout-build plan but not *standards*.

---

### 3.D — OPERATIONS CLUSTER (`platform-operations-portal` 7.0, `admin-web` 6.8 — the clean twins + the staff OS)

The platform's top scorers on CSS discipline (37/38-line stylesheets) and the **only two apps that adopted `AppNavigation`** — the proof that the canonical shell works.

| Category | Current state (evidence) | 10/10 target | Governing rule |
|---|---|---|---|
| **Typography** | 9/10 — consume type tokens; near-zero raw CSS. | Hold; tabular numerals on ops data tables. | UX-R20 |
| **Spacing** | 9/10 — near-zero raw px. | Hold at the token scale. | UX-R6 |
| **Component consistency** | 6/10 — `_local-ui` workspace twins (`console-workspace.tsx` ≈ `ops-workspace.tsx`, `[CONSOLIDATE]`-tagged, refactored just under the gate's regex; validator reports `localWorkspaceImplementations:0` as a regex artifact). | One consolidated workspace grammar; StatusBadge via `Badge`. | UX-R9 |
| **Navigation** | **7/10 — canonical `AppNavigation` adopted** (`(dashboard)/layout.tsx:1`) → route-computed active state, `aria-current`, canonical width for free. The reference implementation. | Hold; this is the template the other 7 apps copy. | UX-R10 |
| **Dark Mode** | 6–7/10 — provider wired, **no toggle** (system-only). | Toggle added → dark reachable. | UX-R13 |
| **Light Mode** | Clean on `--lb-*`. | Hold. | UX-R12 |
| **Accessibility** | **The weak spot: console 4/10, ops 5/10.** Nav a11y now good (shell supplies `aria-current`), but **non-nav surfaces are bare** — `admin-web` = **1 `aria-*`, 0 `role`** in the whole app outside the shell (`UIUX-006`). | Roles/labels on every data table + panel + form, reusing DS `Table`/`Badge`. | UX-R15, UX-R16 |
| **Responsiveness** | 6/10 Tailwind-first. | Breakpoint preset. | UX-R18 |
| **Information Architecture** | 6–7/10; staff-ops IA via `NAV_SECTIONS`. | Operator-first staff IA; clear separation of console (platform) vs ops (operations). | UX-R19 |
| **Visual hierarchy** | 6/10. | Data-dense, Polaris-density tables; clear scan order. | UX-R20 |

**Color-in-className caveat (binding):** the clean twins push *color* drift into `className` (console 134, ops 44 Tailwind-palette classes); className color does not theme. These count against the ratchet (`tailwindPaletteClasses:606`) and must burn down with a Tailwind `blocklist` (UX-R8).

---

### 3.E — MOBILE MERCHANT APP (`apps/merchant_app`, avg 4.4 — Flutter, 71k lines, a de-facto separate DS)

The most-built surface in the repo with the strongest *rendered* dark mode — but effectively a **separate, un-tokenized design system**: the generated, in-sync bridge feeds screen code but **not the `ThemeData` that actually colors the app.**

| Category | Current state (evidence) | 10/10 target | Governing rule |
|---|---|---|---|
| **Typography** | **1/10 — catastrophic.** 712 raw `fontSize:`, 44 inline `GoogleFonts.inter()`, **0 type-token references**; the generated bridge carries no typography. | Type flows from the **extended** bridge (`TextTheme`); zero inline `GoogleFonts`; raw `fontSize:` → 0. | UX-R2, UX-R7 |
| **Spacing** | **2/10** — 2,040 raw `EdgeInsets`/`SizedBox`, **0 density-token refs**. | Spacing + density from the extended bridge; raw `EdgeInsets` ratcheted down. | UX-R2, UX-R6 |
| **Component consistency** | 4/10 — **four competing color classes / three token sources**: `ui_kit` `LetbuyyColorTokens` + `AppColors`; generated `LetbuyyColorTokens` (name collision!); per-screen `StoreAdminColors`/`Light|DarkThemeColors`. (`UIUX-004`, `MOB-004`.) | `ui_kit` is the one Dart library; one `LetbuyyColorTokens` (collision resolved); per-screen palettes deleted. | UX-R2 |
| **Navigation** | 6/10; named-route table; deep-links mapped but inert (`AndroidManifest.xml` LAUNCHER-only); dead `go_router` dep. | Converges on the same operator-first IA contract; OS intent filters wired; dead deps removed. | UX-R19, UX-R25 |
| **Dark Mode** | **7/10 — the most complete *rendered* dark UX** (symmetric light/dark `ThemeData`, default dark) **but on the wrong palette** — teal body text (`app_colors.dart` `#D3E4E3/#AED9D8/#89CBCB`), not the canonical slate ramp (`UIUX-025`). | Dark renders the canonical slate ramp via the re-pointed `ThemeData`. | UX-R12, UX-R2 |
| **Light Mode** | Off-spec semantics: `success #A4E500`, `error #B02525` diverge from web (`app_colors.dart`). | Semantic colors match the canonical web ramp via the bridge. | UX-R2 |
| **Accessibility** | 5/10; **touch targets UNVERIFIED** — density tokens would guarantee ≥44px but are 0% adopted. | AA; ≥44px targets guaranteed by adopted density tokens; labeled controls. | UX-R17, UX-R15 |
| **Responsiveness** | 6/10 (native adaptive). | Adaptive layout from token breakpoints/density. | UX-R18 |
| **Information Architecture** | 6/10 — but ships the **TD-5 parity catalog** that V1 §10 ordered deleted: `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` (~974 lines) routed, with **2 screens rendering `[SKIP - NEEDS BACKEND]`** reachable from Settings (`settings_screen.dart:411`) (`UIUX-007`). | Parity catalog deleted; Settings routes to real screens; **no placeholder/`SKIP` screen user-reachable**; Orders/Money/Customers primary. | UX-R14, UX-R19, UX-R4 |
| **Visual hierarchy** | 6/10; theme-editor screens strong. | Token-driven hierarchy; honest money surfaces. | UX-R21, UX-R4 |

**The mobile honesty defect (binding, go-live):** the only money-mode signal is a raw `'${payout['status']} · ${payout['provider_mode'] ?? 'sandbox'}'` text echo (`money_screen.dart:256`) that **defaults to "sandbox" and conflates "no data" with sandbox** — a trust/financial-integrity defect. It is replaced by the shared honesty badge (UX-R4).

---

### 3.K — CROSS-APP SUPPLEMENT (the remaining web apps: `theme-marketplace`, `developer-portal`, `app-marketplace`, `identity-platform`, `marketing-site`)

Covered to close the "every surface" mandate; each inherits the same ten-category law.

- **theme-marketplace (6.3):** token-disciplined (293-line CSS), real toggle, but two nav surfaces (`navbar.tsx` + dashboard `layout.tsx`, `pathname===href`) and glassy `bg-white/[0.06]` chrome (123 Tailwind-palette classes) that won't theme. **Target:** dashboard adopts `AppNavigation`; marketing navbar tokenized. *(UX-R10, UX-R8)*
- **developer-portal (5.6 — weakest a11y, 3/10):** **0 `role`, 22 `aria-*`, 2 `focus-visible`**; `developer-docs.tsx` (554 lines) hand-rolls 15+ bespoke table renderers vs the imported `Table`. **Target:** landmarks/roles added; DS `Table`/`Tabs` adopted; shell adopted. *(UX-R15, UX-R9, UX-R10)*
- **app-marketplace (5.0):** good a11y (262 `aria-*`, full 18/18 alt) but **2nd-largest `globals.css` (7,475 lines, 1,608 raw px, 252 `rgb()`)** + marketing mega-menu `Header.tsx` (`rgba(5,7,12,0.98)`) that won't theme. **Target:** app surfaces adopt the shell; a shared marketing kit replaces forked chrome; CSS burned down. *(UX-R8, UX-R9, UX-R27)*
- **identity-platform (4.8 — highest-stakes a11y):** security-critical auth forms with thin aria (41 `aria-*`), **43 inline `style={`**, and **11 `!important`** (the most of any app). **Target:** labeled, announced, focus-managed auth forms on DS controls; zero `!important`/inline-style specificity wars; AA is a launch gate (auth + money are the two AA-gated surface classes). *(UX-R15, UX-R16, UX-R5)*
- **marketing-site (3.9 — governance-exiled):** owns **all 25 platform hex literals**, 355 `rgb()`, 1,245 px, a 5,319-line `globals.css`, 76 hand-`@media`, and **0 `focus-visible`** → keyboard focus effectively absent on a public surface (`UIUX-014`). **Target:** `:focus-visible` token styles added; hex/rgb/px migrated; breakpoint preset adopted; **un-exiled as the LAST step** (exile is a temporary quarantine, not a destination). *(UX-R15, UX-R18, UX-R26, UX-R8)*

---

## 4. The canonical design-system law

> The constitution of the design system. Everything in §3 and §13 derives from this. Stated in three lines, then specified.

**(1) ONE token source → generated platforms.** `packages/typescript/ui/src/tokens.ts` is the SOLE authoring source of truth; it projects to DTCG `tokens.json` (interchange), to web `var(--lb-*)` (via `letbuyyTokenCss` → `LetbuyyThemeProvider` → `DesignSystemRoot`), and to a generated Dart bridge that the Flutter `ThemeData` MUST consume. No second token system, no app-local `--lb-*` redefinition, no hardcoded hex/px/inline-color.
**(2) ONE shell + ONE theme controller.** `AppNavigation` is the only primary-navigation shell (9/9 target); `LetbuyyThemeProvider`+`ThemeScript` is the only theme controller (already 9/9 — protected).
**(3) Complete, honest, governed.** Every component ships every required state; light+dark are both complete and reachable; AA is the floor; the honesty badge renders money-mode truth; CI blocks new drift and ratchets old drift to zero.

### 4.1 Token taxonomy (the six axes, primitive vs semantic, light+dark complete)

The canonical engine (`tokens.ts`) already implements the full taxonomy — this is law, not aspiration. Every token MUST exist as primitive (raw value) → semantic (role) → optionally component (per-component role), with **complete `light` AND `dark` role sets**.

| Axis | Primitive tier | Semantic / component tier | CSS vocabulary | Evidence |
|---|---|---|---|---|
| **Color** | `letbuyyPrimitiveTokens` (purple/gray/slate/green/amber/red/blue ramps, brand `#8B5CF6`/`#7C3AED`) | `letbuyySemanticTokens.{light,dark}` (background/button/text/border/accent/status/statusText/statusSoft/focusRing/overlay) + `letbuyyComponentTokens.{light,dark}` (button/card/sidebar/emptyState/input/table/pageHeader/badge/banner) | `--lb-color-*` | `tokens.ts:47-121`, `:186-488` |
| **Space** | 12-step scale `0`–`7xl` | (used directly as role) | `--lb-space-*` | `tokens.ts:672-800` |
| **Type** | font families, weights, fluid `clamp()` display/h1/h2, caption→display sizes, line-heights | (used as role) | `--lb-font-size-*`, `--lb-font-*`, `--lb-line-height-*` | `tokens.ts:672-800` |
| **Radius** | 5-step radii | — | `--lb-radius-*` | `tokens.ts:672-800` |
| **Elevation** | 5-step shadows | — | `--lb-shadow-*` | `tokens.ts:672-800` |
| **Motion** | durations + easings; `prefers-reduced-motion` zeroes all motion | — | `--lb-motion-*` | `tokens.ts:672-800`, `:1360-1372` |
| *(axis: density)* | `letbuyyDensityTokens` compact/comfortable/spacious (heights, paddings, gaps, icon + illustration sizing) | `DensityToggle` + `--lb` density selector | density-scoped `--lb-*` | `tokens.ts:500-585` |
| *(axis: breakpoints)* | `letbuyyBreakpointTokens` xs360/mobile480/sm640/md768/lg1024/xl1280 | Tailwind preset | `--lb-bp-*` | `tokens.ts:125-147` |

**Rare extras that are now protected law (do not regress):** per-tenant brand injection (`createLetbuyyBrandVariables`) and runtime WCAG contrast validation (`validateLetbuyyBrandContrast`, `tokens.ts:1154-1185`, AA 4.5 / focus 3.0, real luminance at `:1135-1152`). Per-store dynamic theming in the storefront is a **separate, blessed axis** — not drift.

**Two naming traps (preserved from the audit — do not regress):** (1) `packages/token-core` is the **auth/JWT envelope** (`TokenKind`, `src/index.ts:4`), NOT design tokens — rename to `@letbuyy/auth-token-core` or document the distinction (`UIUX-030`, UX-R28). (2) There is no `packages/design-system`/`packages/ui`; the one web library is `@letbuyy/ui` at `packages/typescript/ui`, the one mobile library is `packages/dart/ui_kit`.

### 4.2 Generated-platforms pipeline (the parity contract)

```
                 packages/typescript/ui/src/tokens.ts   ← THE ONE AUTHORING SOURCE
                 primitive → semantic → component + density/surface/motion + WCAG validator
                                    │
      ┌─────────────────────────────┼─────────────────────────────────────┐
      ▼ (CI-gated parity)           ▼ (CI-gated, 9/9 injected)             ▼ (CI-gated, EXTENDED to type+density)
  tokens.json (W3C-DTCG)     letbuyyTokenCss → --lb-*              mobile-tokens.ts → generator →
  generate-design-tokens.mjs  via LetbuyyThemeProvider             letbuyy_color_tokens.dart
  --check (gate)              (DesignSystemRoot)                    validate:mobile-tokens (gate)
                                    │                                      │
                                    ▼                                      ▼  ← TARGET: ThemeData consumes this
                       9 web apps consume var(--lb-*)        store_theme.dart light/dark bound to the
                       via @letbuyy/ui components            GENERATED bridge (not ui_kit AppColors)
```

**Binding parity facts (verified 2026-06-10):** `tokens.ts` = 1,388 lines; `tokens.json` present (8,345 bytes), CI-gated by `generate-design-tokens.mjs --check`; mobile bridge CI-gated by `validate:mobile-tokens` but covers **colors+spacing only (no type)** and **the live `ThemeData` does not consume it** (token relevance ~6%) — the mandated fix is to extend the bridge to type+density and re-point `ThemeData` (UX-R2).

### 4.3 ONE shell

`packages/typescript/ui/src/navigation/app-navigation.tsx` (88 lines) composes `AppFrame`+`Sidebar`+`Navigation`; reads `usePathname`; computes `isNavItemActive` per item (`:45-49`); emits `aria-current`; defaults to canonical `width='md'`. **Adopted 2/9** (console + ops, verified). All primary-nav surfaces adopt it (§6). Marketing uses a shared marketing kit (public chrome, not the admin shell); identity is auth-flow-only (no primary nav).

### 4.4 ONE theme controller (protected — do not rebuild)

`LetbuyyThemeProvider`+`ThemeScript` (`theme-provider.tsx`): one key `localStorage["letbuyy-theme"]`, vocabulary `light|dark|system`, resolved-theme feed into `DesignSystemRoot`, **adopted 9/9**. The `theme="auto"` cascade bug is FIXED and HARD-invariant-banned (`validate-design-system.mjs:115-116`). The only remaining dark-mode work is **reachability** (toggle in 7/9 missing) — not wiring.

### 4.5 Component governance

Every UI element is one of: a `@letbuyy/ui` export (web) / `ui_kit` export (Dart); or a documented app-local composition built *from* those primitives. **Forking an exported primitive is forbidden.** Current violations to eliminate: StatusBadge re-derived 5×; `developer-docs.tsx` 15+ bespoke tables vs imported `Table`; `_local-ui` workspace twins; `{Header,Footer}` duplicated across app-marketplace + marketing-site (UX-R9, UX-R27).

### 4.6 Required component states (the completeness contract)

Every interactive component and every data surface MUST define and ship **all nine states**, token-driven, in both themes:

| State | Requirement |
|---|---|
| **Light** | Renders the `--lb-*` light ramp. |
| **Dark** | Renders the `--lb-*` dark ramp (not an ad-hoc palette). |
| **Skeleton** | A token-driven loading placeholder for any async surface (no layout shift on load). |
| **Empty** | The `EmptyState`/`EmptyStateIllustration` primitive (token-driven, density-aware; the platform ships 36 SVG motifs + manifest + gallery — above-market polish, protect it). |
| **Error-with-retry** | Every fetch/mutation failure renders an error state **with a retry affordance** — never a silent blank or a stub that reads as success. |
| **Focus** | Visible `:focus-visible` ring from `--lb-color-focus-ring` (AA 3.0 against adjacent) — mandatory on every interactive element. |
| **Hover** | Token-driven hover treatment. |
| **Active** | Token-driven active/pressed treatment. |
| **Disabled** | Token-driven, AA-legible, with the correct `aria-disabled`/semantics. |

### 4.7 Accessibility floor — WCAG 2.1 AA (non-negotiable, not a wave item)

| AA requirement | Bar | Enforcement |
|---|---|---|
| **Contrast** | Text ≥ 4.5:1, large text/UI ≥ 3.0:1; focus ring ≥ 3.0:1 | `validateLetbuyyBrandContrast` (`tokens.ts:1154-1185`) + per-screen review |
| **Visible focus** | `:focus-visible` on every interactive element | UX-R15 (marketing's 0 focus-visible is a floor violation) |
| **Keyboard** | Every action keyboard-operable; logical focus order; no traps; command palette + modals keyboard-complete | UX-R16 |
| **Touch targets** | ≥ 44×44px (density tokens guarantee this *if adopted* — mobile is 0% today) | UX-R17 |
| **Labels** | Every control labeled; errors via `aria-describedby`; status announced | UX-R15 |
| **Semantic HTML / roles** | Landmarks + roles present (developer-portal's 0 `role` is a violation); DS controls over raw elements | UX-R15, ESLint `no-raw-elements` (error) |

**Hard floor:** no migration in any wave may *regress* accessibility. AA is a launch gate for the **money** and **auth** surface classes specifically; a constant constraint everywhere else.

### 4.8 Responsive breakpoints

One scale: `letbuyyBreakpointTokens` (xs360/mobile480/sm640/md768/lg1024/xl1280) exported as the `letbuyyTailwindPreset`. Two incompatible strategies exist today — Tailwind breakpoints (ops/merchant/storefront/theme) vs hand-`@media` literal-px (marketing 76, app-mktpl 8, identity 5, developer 3); literal-px `@media` can drift from `--lb-bp-*`. Target: all apps on the preset (UX-R18).

### 4.9 Operator-first IA with a first-class Money node

The merchant OS IA is **operator-first** (verified): Orders/Products/Customers are top-level `primary`, Settings is `bottom`; real operator affordances (keyboard shortcuts, command palette). **The one gap:** no top-level Money/Finance/Payouts node (V1 §10 "Orders/Money/Customers primary" only 2/3 met). Law: a first-class **`Finance`** primary item (payouts, balances, settlement statements) on web + mobile (UX-R19). Mobile converges on the same Orders/Money/Customers-primary contract once the parity catalog is deleted.

### 4.10 Provider-mode honesty badge (a governed component, money-truth)

A money-surface **truth** requirement, not polish (V1 §1 Principle 4 / §10; FREEZE §4; R2). **Verified absent** from `@letbuyy/ui` (grep empty); mobile has only the misleading `provider_mode ?? 'sandbox'` echo (`money_screen.dart:256`). Law: ONE shared `ProviderModeBadge` in `@letbuyy/ui` + a mirrored Flutter badge in `ui_kit`, bound to the backend `provider_mode`, with variants **live / sandbox / scaffold**, a **text label + role (never color-only)**, rendered on **every** payouts/COD/wallet/commission/settlement/fulfillment surface, **validator-enforced** (a money/fulfillment screen lacking it fails CI). A stub MUST never read as `success`; absent `provider_mode` renders "scaffold/unknown," never "sandbox-as-success." This is the **one go-live-relevant DS item** (UX-R4).

---

## 5. The governance-enforcement model — the ratchet that BLOCKS, not baselines

> The decisive upgrade. Today's gate is real but freezes drift; it must *block new drift AND repay old drift on a clock.*

### 5.1 Current posture (3.0/5, verified)

- **Gate 1 — `validate:design-system` (REAL, CI-enforced):** runs in `ci.yml:87` + `architecture-governance.yml:58`. HARD invariants (must be ZERO: no direct `<DesignSystemRoot>`, no `theme="auto"`, no legacy keys, no bespoke `theme-provider`, no `_local-ui` shells) — **passing**. RATCHET invariants (11 drift metrics, may only decrease) — **passing at a frozen baseline.** Weakness: the baseline was seeded from *today's* counts, so 573 `rgb()` + 1,382 px + 638 inline styles are permanently "OK." `ratchetPerWavePercent:10` exists but is **advisory** (`design-system-baseline.json`).
- **Gate 2 — `validate:design-tokens` (REAL):** `generate-design-tokens.mjs --check` guards `tokens.json`↔`tokens.ts` parity (`architecture-governance.yml:61`).
- **Gate 3 — stylelint (WIRED BUT UNARMED):** `lint:css` exists (`package.json:27`), `.stylelintrc.cjs` is well-designed (bans hex, named colors, raw `rgb()/hsl()` outside the token layer), **but stylelint is NOT installed** (verified: `grep -c stylelint pnpm-lock.yaml` → 0) and **CI never calls `lint:css`** (verified: 0 hits in `.github/workflows/`).
- **ESLint — partially armed:** `no-raw-elements` + `no-hardcoded-hex` = **error** (effective — TSX hex is 0). `no-raw-form-controls` / `no-raw-color-functions` / `no-tailwind-default-color` = **warn** in all 9 apps; `turbo lint` runs **changed-only** (`ci.yml:84`); warnings don't fail. So 606 Tailwind-palette + 573 `rgb()` survive visibly-but-unblocked.

### 5.2 The three enforcement upgrades (target posture 4.5/5)

**G1 — Make the ratchet repay (the debt-freeze → debt-paydown fix).** Add a scheduled `--update` that auto-lowers each ratchet metric by `ratchetPerWavePercent:10` per release. The budget must **ratchet down on a clock**, not merely "never up." This is the difference between freezing 573 `rgb()` forever and driving it to zero. (UX-R29.)

**G2 — Arm stylelint (the cheapest high-value fix).** `pnpm add -D stylelint stylelint-config-standard`; add `lint:css` to `turbo lint` + a CI step that **fails on error**. The CSS channel then *blocks*, not just gets caught incidentally by the ratchet regex. (UX-R30.)

**G3 — Promote warn→error after burn-down.** Burn each channel down under the ratchet, then promote `no-tailwind-default-color` / `no-raw-color-functions` / `no-raw-form-controls` to `error`; add a Tailwind `blocklist` of default color classes; run lint repo-wide in a nightly fail-on-warn. (UX-R8, UX-R31.)

### 5.3 The "no hardcoded hex / px / inline-style" rule and its validators

| Banned construct | Channel | Validator that enforces it | Today |
|---|---|---|---|
| Raw hex (`#rgb`/`#rrggbb`) in CSS | CSS | stylelint `.stylelintrc.cjs` (G2) + ratchet `appCssRawHex:0` (HARD) | **0 (solved)** |
| Raw hex in TSX | TSX | ESLint `no-hardcoded-hex` (**error**) + ratchet `tsxRawHex:0` | **0 (solved)** |
| Naked `rgb()/hsl()` outside the token layer | CSS | stylelint (G2) + ratchet `appCssNakedRgbHsl` (ratchet-to-0 via G1) | 573 → 0 |
| Raw `font-size:Npx` | CSS | ratchet `rawPxFontSize` (G1) | 536 → 0 |
| Raw `Npx` spacing | CSS | ratchet `rawPxSpacing` (G1) | 1,382 → 0 |
| Inline `style={}` (TSX), except blessed per-store dynamic theming | TSX | ratchet `tsxInlineStyles` (G1) + lint pattern-exemption for storefront dynamic color | 638 → near-0 |
| Tailwind default-palette classes | className | ESLint `no-tailwind-default-color` (warn→**error**, G3) + Tailwind `blocklist` | 606 → 0 |
| App-local `--lb-*` redefinition outside `@letbuyy/ui` | CSS | **NEW HARD invariant** in `validate-design-system.mjs` (UX-R3) | 112 → 0 |
| Raw `Color(0x…)` / `fontSize:` / `EdgeInsets(` outside the Flutter theme layer | Dart | **NEW Dart lint** (`dart_code_metrics`/custom), CI-wired (UX-R2) | 334/712/2,040 → ratchet-to-0 |
| Inline `<aside>`/`<nav>` primary navigation in app layouts | TSX | **NEW HARD invariant** (locks shell adoption, added after merchant lands) (UX-R11) | added |
| A money/fulfillment screen without the honesty badge | TSX/Dart | **NEW validator** enumerating money/fulfillment routes (UX-R4) | added |

**Net rule:** the only color/space/type/radius/elevation/motion vocabulary permitted in product code is `var(--lb-*)` (web) / the generated bridge (Dart). Every other channel is a validator-enforced violation that ratchets to zero.

---

## 6. Shell consolidation plan (2/9 → 9/9)

**Verified:** canonical `AppNavigation` consumers = **2** (console + ops); **8 hand-rolled implementations across 7 apps; 4 sidebar widths** (`w-72` console/ops, `w-56` theme, `w-64` storefront account, `260px` canonical default). The fix path is **proven** (console/ops did it); the remaining work is rollout, not invention.

| App | Today | Target | Order | Note |
|---|---|---|---|---|
| admin-web | **AppNavigation** ✓ | keep | done | reference impl |
| platform-operations-portal | **AppNavigation** ✓ | keep | done | reference impl |
| merchant-web | `AdminShell`/`Sidebar`/`HeaderBar`+`merchantNavigation.ts` | **AppNavigation** | **1st (highest value)** | preserves operator-first IA + palette + shortcuts; folds in the Money node; gains active-state/`aria-current`/canonical width free |
| theme-marketplace | `navbar.tsx` + dashboard `layout.tsx` | AppNavigation (dashboard) + keep marketing navbar | 2nd | token the glassy chrome |
| developer-portal | `_local-ui/PortalChrome.tsx` | AppNavigation | 3rd | also fixes its 0-role a11y |
| app-marketplace | `Header.tsx` mega-menu | AppNavigation for app surfaces + shared marketing kit | 4th | extract `MarketingHeader`/`Footer` |
| customer-web | `dynamic-header.tsx` + `account/layout.tsx` | AppNavigation for **account** shell; buyer chrome stays per-store | 5th | token the nav chrome |
| marketing-site | `Header.tsx` mega-menu | shared marketing kit (not the admin shell) | special | un-exile after token migration |
| identity-platform | — (auth flow) | n/a | n/a | a11y pass on auth forms instead |

**Enforcement:** after merchant adopts the shell, add the HARD invariant forbidding new inline `<aside>`/`<nav>` primary navigation (UX-R11). No hand-rolled nav is deleted until its layout renders `AppNavigation` and a screenshot-diff passes.

---

## 7. Benchmark principles — what LetBuyy ADOPTS vs IGNORES (per reference)

> Benchmark **principles, not scale** (`_GOVERNANCE_SPINE.md` S8). For each reference: the principle LetBuyy adopts as law, and the implementation LetBuyy deliberately ignores (because it serves a scale/scope LetBuyy has frozen out). Polaris current principles re-verified 2026-06-10; Stripe/Linear/Vercel principles are durable and well-published but specific framework internals could have shifted since the January-2026 boundary (flagged UNVERIFIED where relevant).

### 7.1 Shopify Polaris — *operator density, data tables, admin IA, motion restraint*

- **ADOPT:** (a) **Operator-first admin IA** — Orders/Products/Customers (+Money) as top-level primary, Settings demoted; the merchant OS already does this and the Money node completes it. (b) **"Typography defines hierarchy"** — hierarchy via weight + size + position + color, **never color alone** (verified on `polaris-react.shopify.com/design/typography`). (c) **"Typography defines purpose"** — **tabular numerals for currency/quantity** on every money column (a money-legibility law inherited into UX-R21). (d) **Density as a first-class axis** for data-dense operator tables (`letbuyyDensityTokens` already exists; expose it). (e) **Motion restraint** + `prefers-reduced-motion` (already implemented at `tokens.ts:1360-1372`). (f) **Interaction-states discipline** (the nine required states, §4.6).
- **IGNORE:** the **full Polaris component surface area and the Polaris Web Components / app-bridge distribution model** (App Home, embedded-app framework). LetBuyy is not an embedded-app platform at 100→10k merchants; a ~60-component `@letbuyy/ui` is right-sized. Adopting Polaris's breadth would import scope the company has frozen.

### 7.2 Stripe — *form clarity, money legibility, docs-grade microcopy*

- **ADOPT:** (a) **Form clarity** — labeled fields, inline `aria-describedby` errors, focus management, generous field rhythm; the law for checkout (born-canonical) and identity auth forms (UX-R23). (b) **Money legibility** — amounts are unambiguous, tabular, with currency/tax/fee breakdowns never collapsed; the hero of checkout and the Finance node (UX-R21). (c) **Docs-grade, honest microcopy** — error states say what happened and what to do (error-with-retry, §4.6); a stub never reads as success (the honesty badge, UX-R4).
- **IGNORE:** Stripe's **multi-product, globally-themable Elements/Connect-embedded UI runtime and its payment-method breadth**. LetBuyy is India-only, PA-split-never-custody, 0% fee — it does not need a global payment-element framework; its checkout is one canonical hosted origin, not an embeddable widget toolkit.

### 7.3 Linear — *speed, keyboard-first, command palette, restraint*

- **ADOPT:** (a) **Keyboard-first operation** — shortcuts (`g o`/`g p`/`g c`) and a **command palette** already exist in the merchant OS; they are protected through the shell migration and extended to the Finance node (UX-R16, UX-R19). (b) **Restraint / opinionated minimalism** — one shell, one type scale, one motion budget; no per-app chrome invention. (c) **Perceived speed** — skeleton states with no layout shift, instant active-state feedback from route-computed nav (§4.6).
- **IGNORE:** Linear's **local-first sync engine and its bespoke rendering/animation stack**. LetBuyy is server-authoritative over one Postgres (`_GOVERNANCE_SPINE.md` S4); a client-side sync engine and a custom renderer are out of scope by constitutional rule.

### 7.4 Vercel — *whitespace, type hierarchy, dark-mode discipline*

- **ADOPT:** (a) **Whitespace as structure** — the 12-step `--lb-space-*` scale used consistently; generous, rhythmic spacing (the burn-down of 1,382 raw px serves exactly this). (b) **Typographic hierarchy** — fluid `clamp()` display/h1/h2 already in `tokens.ts`; a disciplined, few-step scale. (c) **Dark-mode discipline** — one controller, one resolved theme, no FOUC (`ThemeScript`), complete dark role sets; LetBuyy's `LetbuyyThemeProvider` already matches this — the gap is only *reachability* (toggle 7/9), which the law closes (UX-R13).
- **IGNORE:** Vercel's **marketing-grade motion/3D/visual-flourish layer**. LetBuyy's surfaces are operator and commerce tools; heavy decorative motion would fight operator density and the motion-restraint principle. Whitespace and type discipline are adopted; the flourish is not.

---

## 8. Scoring rubric (how every surface is scored, 0–10 per category)

A surface is scored per category on this rubric; the surface average is the mean of its ten category scores. The platform target is **every surface ≥ 9.0**.

| Score | Meaning | Typical evidence |
|:--:|---|---|
| **0–2** | Absent / broken / actively misleading | no token use; raw values dominate; 0 focus-visible; a stub reads as success |
| **3–4** | Present but largely un-tokenized / un-governed | bespoke chrome; hand-CSS; thin a11y; shell forked |
| **5–6** | Functional with material gaps | partial token adoption; some states missing; reachability or label gaps |
| **7–8** | Strong; small, named gaps | shell adopted; most states; AA mostly met; one IA/a11y gap |
| **9** | Reference-grade with one trivial residual | full token adoption; all states; AA met; honest |
| **10** | Polaris/Stripe/Linear/Vercel reference | indistinguishable from best-in-class on that category |

**Category-specific 10 definitions (the bar):** *Typography* — 100% `--lb-font-*`, Polaris hierarchy, tabular money. *Spacing* — 100% `--lb-space-*`. *Component* — 0 forks; all states. *Navigation* — `AppNavigation`, `aria-current`, one width. *Dark/Light* — complete ramps, reachable, AA. *A11y* — full WCAG 2.1 AA. *Responsive* — preset breakpoints, verified reflow. *IA* — operator-first, Money node, one decision/step. *Hierarchy* — weight/size/position (not color-alone), money legible, honest.

---

## 9. Current → target scorecard (per surface × 10 categories, with the path to 10/10)

> Current scores from the forensic matrix (`UI_UX_GOVERNANCE_AUDIT.md` §3; checkout is born-canonical so it has no current debt). Target = 10 for all on full ratification. The "path" column names the binding rules.

| Surface | Type | Space | Comp | Nav | Dark | Light | A11y | Resp | IA | Hier | **Cur avg** | **Target** | Path to 10/10 (rules) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **Merchant Control Plane** | 6 | 5 | 6 | 8 | 6 | 7 | 8 | 7 | 7 | 7 | **6.6** | **10** | UX-R6/7/9 (burn `globals.css`), R10/11 (shell), R19 (Money node), R3 (kill redefs) |
| **Storefront** | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 6 | 6 | 6 | **4.3** | **10** | UX-R22 (storefront kit + separate dynamic from static), R8/R6/R7 (burn down), R13 (toggle) |
| **Checkout** (born-canonical) | — | — | — | — | — | — | — | — | — | — | **n/a** | **10** | UX-R23 (Stripe forms), R21 (money legibility), R4 (badge), R5 (states), R15-17 (AA launch gate) |
| **Operations** (console+ops) | 9 | 9 | 6 | 7 | 6 | 7 | 4.5 | 6 | 6.5 | 6 | **6.9** | **10** | UX-R15/16 (non-nav a11y — the gap), R13 (toggle), R9 (workspace twins), R8 (className color) |
| **Mobile Merchant App** | 1 | 2 | 4 | 6 | 7 | 5 | 5 | 6 | 6 | 6 | **4.4** | **10** | UX-R2 (re-point `ThemeData`+extend bridge), R7 (type), R4 (badge), R14 (kill parity catalog), R17 (touch targets) |
| **— supplement: theme-marketplace** | 7 | 7 | 6 | 5 | 6 | 7 | 6 | 7 | 6 | 6 | **6.3** | **10** | R10 (shell), R8 (glassy chrome) |
| **— supplement: developer-portal** | 6 | 8 | 5 | 5 | 5 | 6 | 3 | 5 | 6 | 6 | **5.6** | **10** | R15 (roles/landmarks — weakest a11y), R9 (`Table`), R10 (shell) |
| **— supplement: app-marketplace** | 4 | 4 | 5 | 4 | 5 | 6 | 7 | 5 | 6 | 6 | **5.0** | **10** | R8 (burn 7,475-line CSS), R27 (marketing kit), R10 (shell) |
| **— supplement: identity-platform** | 4 | 4 | 5 | — | 4 | 5 | 5 | 5 | 6 | 6 | **4.8** | **10** | R5/R15/R16 (auth-form AA, launch gate), R3 (kill `!important`/inline) |
| **— supplement: marketing-site** | 2 | 2 | 4 | 4 | 2 | 4 | 4 | 7 | 6 | 6 | **3.9** | **10** | R15 (focus-visible floor), R26 (un-exile last), R18 (breakpoint preset), R8 (25 hex) |
| **PLATFORM** | 5.1 | 4.8 | 5.0 | 5.3 | 5.2 | — | 4.8 | 6.0 | 6.1 | 6.1 | **5.4** | **10** | the full §13 rule set, sequenced Phase 7 / Waves 4–5 |

**Reading it:** the operator-ops cluster is closest (CSS-disciplined; the gap is non-nav a11y + reachability); the merchant OS is the highest-value single burn-down; storefront/mobile/marketing carry the deep debt; checkout and the honesty badge are the born-canonical / go-live items.

---

## 10. Sequencing (where UI/UX sits — honesty over polish)

Per `_GOVERNANCE_SPINE.md` S7 (Phase 7 = UI/UX governance) and the master Phase/Wave model: **design unification is debt-paydown, sequenced AFTER security/money/tenancy.** S0 data-leaks + the deploy meta-blocker first (Phase 1–2 / Waves 0–1); money-correctness (Phase 3 / Waves 2–3); architecture/constitution true-up so the ratchet enforces V1 (Phase 5 / Wave 4); product-complete for beta (Phase 9 / Wave 4); **then the DS burn-down + shell adoption + dark reachability + mobile convergence + governance upgrade (Phase 7 / Wave 5)**; ecosystem (Liquid marketplace, density UX, deep-links) at Waves 6–8.

**The two exceptions that move earlier:**
1. **Provider-mode honesty badge (UX-R4)** — money-surface *honesty*, not polish. Ships Waves 2–3 with real payouts, validator-enforced. The ONE DS line item that is a go-live concern.
2. **The accessibility floor** — no migration in any wave may regress AA (contrast, focus, keyboard, touch targets). Not a wave item; a constant constraint. AA is a *launch gate* for the money and auth surface classes.

Everything else explicitly does **not** block go-live. DS polish must never compete with S0/money/tenancy for the critical path.

---

## 11. Liquid renderer alignment (deferred — FROZEN per the canonicalization)

The theme editor can compose sections the storefront renders as **fallbacks** — Liquid rendering defaults OFF (`theme-governance-validator.mjs:56` `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`), renderer governance WARN (`:53`), `UnknownSectionFallback` placeholder. Liquid is the **strategic winner but DEFERRED** (Waves 6–8, gated on theme-marketplace / 3rd-party-author demand at ~5k merchants). Until then: **FREEZE the React/Liquid duplication, keep ONE seam**, do not chase Liquid parity for completeness (it unlocks a *marketplace*, the ecosystem trigger, not a beta blocker). The editor↔renderer mismatch is **capped, not closed**, until the demand-gated product decision flips Liquid on (UX-R26).

---

## 12. Scorecard summary (per-surface averages, current → target)

| Surface | Current avg | Target avg | Gap |
|---|:--:|:--:|:--:|
| Merchant Control Plane | **6.6** | 10 | 3.4 |
| Operations (console+ops) | **6.9** | 10 | 3.1 |
| theme-marketplace | **6.3** | 10 | 3.7 |
| developer-portal | **5.6** | 10 | 4.4 |
| app-marketplace | **5.0** | 10 | 5.0 |
| identity-platform | **4.8** | 10 | 5.2 |
| Mobile Merchant App | **4.4** | 10 | 5.6 |
| Storefront | **4.3** | 10 | 5.7 |
| marketing-site | **3.9** | 10 | 6.1 |
| Checkout (to-be-built) | **n/a** | 10 | born-canonical |
| **PLATFORM** | **5.4 / 10 (2.8/5)** | **10 / 10 (≈4.75/5)** | **the §13 rule set** |

---

## 13. UI/UX Governance Rules

> The enforceable law. Each rule is **MUST / MUST-NOT**, testable, and names the validator that enforces it. "Sev" mirrors the forensic register (S0 ships-broken / S1 serious / S2 debt / S3 polish). "Wave" is the canonicalization sequencing. These rules are binding on Claude, Codex, humans, and all automation. New drift that violates a MUST/MUST-NOT is a CI failure, not a review comment.

| # | Rule (MUST / MUST-NOT) | Testable assertion | Validator / enforcement | Sev | Wave | Evidence (path:line) |
|---|---|---|---|:--:|:--:|---|
| **UX-R1** | There MUST be exactly ONE token authoring source: `packages/typescript/ui/src/tokens.ts`. No second token system MAY define color/space/type/radius/elevation/motion. | `tokens.json`↔`tokens.ts` parity holds; no other file exports a token scale consumed by product code | `generate-design-tokens.mjs --check` (`architecture-governance.yml:61`); token snapshot unit test | S1 | 5 | `tokens.ts:1-1388`; `tokens.json` (8,345 B) |
| **UX-R2** | The Flutter `ThemeData` MUST consume the generated Dart bridge (extended to color+spacing+type+density); raw `Color(0x…)`/`fontSize:`/`EdgeInsets(` outside the theme layer is MUST-NOT. The duplicate `LetbuyyColorTokens` MUST be deleted. | `store_theme.dart` imports only the generated bridge; one `LetbuyyColorTokens`; Dart lint fails on raw color/size outside theme | `validate:mobile-tokens` (extended) + NEW Dart lint (CI) | S1 | 5 | `store_theme.dart` (imports ui_kit only); `letbuyy_color_tokens.dart`; 334/712/2,040 raw |
| **UX-R3** | No app MAY redefine any `--lb-*` outside `@letbuyy/ui`. App-local token aliases MUST be `color-mix()`/derivation, not raw redefinition. | `appLocalLbTokenRedefs` ratchets to 0; no `--lb-*:` assignment in app CSS | NEW HARD invariant in `validate-design-system.mjs` | S2 | 5 | baseline `appLocalLbTokenRedefs:112`; `globals.css:50-59` |
| **UX-R4** | Every money/fulfillment surface (web + mobile) MUST render the shared `ProviderModeBadge` (live/sandbox/scaffold, text-label + role, never color-only), bound to backend `provider_mode`. A stub MUST-NOT read as `success`; absent mode renders "scaffold/unknown," never "sandbox-as-success." **(GO-LIVE.)** | validator enumerates money/fulfillment routes and asserts badge presence; sandbox build shows "Sandbox", never success | NEW validator (route enumeration) | **S1** | **2–3** | none in `@letbuyy/ui` (grep ∅); `money_screen.dart:256` |
| **UX-R5** | Every async surface MUST ship all nine states (light/dark/skeleton/empty/error-with-retry/focus/hover/active/disabled). Every fetch/mutation failure MUST render error-with-retry — MUST-NOT silently blank. | each component has the nine states; no fetch path lacks an error+retry branch | component-state lint + review checklist; `EmptyState` primitive required | S2 | 5 | §4.6; `EmptyState`/`EmptyStateIllustration` exports |
| **UX-R6** | All spacing MUST use `var(--lb-space-*)`; raw `Npx` padding/margin/gap in app CSS is MUST-NOT. | `rawPxSpacing` strictly decreasing → 0 | ratchet `rawPxSpacing` (G1) + stylelint (G2) | S2 | 5 | baseline `rawPxSpacing:1382`; merchant 2,210 |
| **UX-R7** | All type MUST use `--lb-font-size-*`/`--lb-font-*`; raw `font-size:Npx` (CSS) and inline `GoogleFonts.inter()` (Dart) are MUST-NOT. Money/quantity columns MUST use tabular numerals. | `rawPxFontSize`→0; 0 inline `GoogleFonts`; tabular nums on money columns | ratchet `rawPxFontSize` + stylelint + Dart lint | S2 | 5 | baseline `rawPxFontSize:536`; mobile 712 `fontSize:`, 44 `GoogleFonts.inter()` |
| **UX-R8** | Default Tailwind palette classes (`bg-gray-*`, `text-slate-*`, …) are MUST-NOT; color MUST flow through `--lb-color-*`. | `tailwindPaletteClasses`→0; Tailwind `blocklist` active; rule at `error` | ESLint `no-tailwind-default-color` (warn→error, G3) + `blocklist` | S2 | 5 | baseline `tailwindPaletteClasses:606`; `*/eslint.config.mjs:20` |
| **UX-R9** | An exported `@letbuyy/ui`/`ui_kit` primitive MUST-NOT be forked. StatusBadge MUST use `Badge`/`StatusVariant`; tables MUST use `Table`. | 0 local StatusBadge re-derivation; `developer-docs` on `Table`; one workspace grammar | ESLint composite-duplication check + review | S2 | 5 | StatusBadge ×5; `developer-docs.tsx` (554); `_local-ui/{console,ops}-workspace.tsx` |
| **UX-R10** | Every primary-navigation surface MUST adopt `AppNavigation` (merchant 1st → 9/9). Marketing uses the shared marketing kit; identity is auth-only. | shell-adoption count → 9/9 | NEW validator metric (shell adoption) + screenshot-diff | S1 | 5 | `app-navigation.tsx:51-88`; consumers ×2 |
| **UX-R11** | After merchant adopts the shell, new inline `<aside>`/`<nav>` primary navigation in app layouts is MUST-NOT. One sidebar width (`md`). | no inline primary `<nav>`/`<aside>` in app layouts; one width | NEW HARD invariant in `validate-design-system.mjs` | S1 | 5 | 4 widths today; `UIUX-027` |
| **UX-R12** | Light AND dark role sets MUST both be complete; surfaces MUST render the `--lb-*` ramp (not ad-hoc palettes), except blessed per-store storefront theming. | semantic `light`+`dark` complete; no off-ramp literals in static chrome | `validate:design-system` HARD invariants + stylelint | S2 | 5 | `tokens.ts:186-315`; mobile `#D3E4E3` teal |
| **UX-R13** | Dark mode MUST be user-*reachable* in 9/9 apps — a labeled, keyboard-operable theme toggle in every app's header/account menu. | toggle present + persists to `letbuyy-theme` in 9/9 | integration test (toggle presence) | S2 | 5 | toggles in merchant(3)+theme-mktpl(5) only |
| **UX-R14** | No placeholder / `[SKIP - NEEDS BACKEND]` / parity-grid screen MAY be user-reachable. The mobile TD-5 parity catalog MUST be deleted; Settings MUST route to real screens. | no `/features/*` resolves to the generic viewer; no SKIP surface in nav | integration test + deletion-validation gate | S1 | 4 | `parity/merchant_feature_{screen,definitions}.dart`; `settings_screen.dart:411` |
| **UX-R15** | WCAG 2.1 AA labels/roles/landmarks/semantic-HTML MUST be present on every surface; raw form controls and `0 role`/`0 focus-visible` surfaces are MUST-NOT. | every control labeled; landmarks/roles present; `:focus-visible` on every interactive element | ESLint `no-raw-elements`/`no-raw-form-controls` + a11y review; contrast validator | S1 | 5 | developer-portal 0 `role`; marketing 0 focus-visible; identity 41 aria |
| **UX-R16** | Every action MUST be keyboard-operable with logical focus order and no traps; command palette + modals MUST be keyboard-complete. | keyboard nav + focus order pass; no focus traps | a11y/E2E keyboard test | S1 | 5 | merchant palette `merchantNavigation.ts:294-341` |
| **UX-R17** | Touch targets MUST be ≥44×44px (mobile MUST adopt density tokens to guarantee this). | density-token adoption > 0; targets ≥44px | Dart lint + density-adoption metric | S2 | 5 | mobile 0 density refs; `letbuyyDensityTokens` |
| **UX-R18** | All responsive breakpoints MUST come from `letbuyyTailwindPreset`; literal-px `@media` in app CSS is MUST-NOT. | 0 literal-px `@media`; preset adopted 9/9 | stylelint media-query rule + review | S2 | 5 | marketing 76 `@media`; app-mktpl 8; identity 5 |
| **UX-R19** | The merchant OS IA MUST be operator-first with Orders/**Money**/Customers as top-level primary; a first-class `Finance` node MUST exist (web + mobile). | nav renders `Finance` primary; Orders/Money/Customers primary | integration test (nav render) | S2 | 4 | `merchantNavigation.ts:63-123` (no Finance node) |
| **UX-R20** | Visual hierarchy MUST be conveyed by weight/size/position (Polaris) — MUST-NOT rely on color alone. | hierarchy review passes; not color-dependent | design review checklist | S2 | 5 | Polaris `design/typography` (re-verified) |
| **UX-R21** | Money MUST be legible (Stripe): tabular amounts, never-collapsed currency/tax/fee breakdowns, money as the hero on checkout + Finance. | money columns tabular; breakdowns present; review passes | review checklist + UX-R7 | S2 | 4 | Stripe money-legibility principle |
| **UX-R22** | Storefront per-store dynamic theming MUST be preserved as a blessed axis; genuine static hardcodes MUST be tokenized. A storefront kit of themable primitives MUST be the static-chrome source. | dynamic-color inline styles lint-exempted by pattern; static `rgb()` → tokens | lint pattern-exemption + ratchet | S2 | 5 | `product-details-client.tsx:125` (keep); `coming-soon/page.tsx:95,129` (tokenize) |
| **UX-R23** | Checkout + identity auth forms MUST follow Stripe form clarity: labeled fields, `aria-describedby` errors, focus management, generous rhythm, DS primitives only. | forms pass a11y + form-clarity review | a11y/E2E + ESLint `no-raw-form-controls` (error) | S1 | 4–5 | checkout (born-canonical); identity 43 inline / 11 `!important` |
| **UX-R24** | The theme editor (the differentiator) MUST stay canonical and MUST-NOT regress undo/redo or device-preview; its chrome MUST use `var(--lb-*)`, not raw `letbuyyPrimitiveTokens`. | editor chrome on `var(--lb-*)`; undo/redo + preview intact | E2E (editor) + review | S3 | 5 | `editor/page.tsx:38` |
| **UX-R25** | Mobile deep-links MUST be deliverable (OS intent filters → resolver); dead `go_router` MUST be removed. | deep-link opens the right screen; `go_router` gone | integration test + dep check | S3 | 6 | `deep_link_router.dart:53-78`; `AndroidManifest.xml` (LAUNCHER only) |
| **UX-R26** | marketing-site exile is temporary: focus-visible + token migration MUST complete, then it MUST be un-exiled (un-exile is the LAST step). | `:focus-visible` present; 0 hex; removed from `exiledApps` | stylelint (post-migration) + a11y test | S2 | 5 | baseline `exiledApps:["apps/marketing-site"]` |
| **UX-R27** | Marketing chrome MUST-NOT be forked across public surfaces; one shared `MarketingHeader`/`MarketingFooter`. | one marketing chrome source; duplicates deleted | composite-duplication check | S2 | 5 | app-marketplace vs marketing-site `{Header,Footer}` |
| **UX-R28** | `packages/token-core` MUST be renamed (`@letbuyy/auth-token-core`) or documented as the auth/JWT envelope; `tokens.ts` MUST be documented as the design-token home. | no ambiguity in docs/code between auth-token-core and design tokens | doc check + importer resolve | S3 | 4 | `token-core/src/index.ts:4` (`TokenKind`) |
| **UX-R29** | The ratchet MUST repay on a clock: every metric strictly decreasing ≥10%/release until 0 — MUST-NOT merely freeze. | each ratchet metric strictly decreasing each release | `validate:design-system --update` (scheduled, G1) | S1 | 4–5 | `design-system-baseline.json` `ratchetPerWavePercent:10` (advisory today) |
| **UX-R30** | stylelint MUST be installed and `lint:css` MUST run in CI fail-on-error. | stylelint in `pnpm-lock.yaml`; `lint:css` in a CI step; fails on injected raw `rgb()` | `pnpm add -D stylelint` + CI step (G2) | S1 | 4 | `pnpm-lock.yaml` (0 hits); `.github/workflows/*` (no `lint:css`) |
| **UX-R31** | After burn-down, `no-tailwind-default-color`/`no-raw-color-functions`/`no-raw-form-controls` MUST be promoted warn→`error`; lint MUST run repo-wide (not changed-only) in a nightly fail-on-warn. | the three rules at `error`; nightly repo-wide lint green | ESLint severities + nightly CI (G3) | S2 | 5 | `*/eslint.config.mjs:18-20`; `ci.yml:84` (`--filter`) |
| **UX-R32** | No token source or shell MAY be deleted while a consumer still references it. | deletion PRs grep-gated; no live consumer at delete time | deletion-validation CI gate (grep) | S1 | 4–5 | §6; risk RR-8 |
| **UX-R33** | The honesty principle is supreme over polish: a stub/sandbox/no-op MUST-NOT render as `success` on any money/fulfillment surface, in any wave, ahead of the badge. | no money path renders a stubbed action as success | payments-path review + UX-R4 validator | **S1** | **2–3** | V1 §1 Principle 4; FREEZE §4 R2 |

---

## 14. UNVERIFIED (rendering-dependent / out-of-repo)

This is a source-level governance document. The following cannot be confirmed without running the apps or out-of-repo systems, and are marked UNVERIFIED:

- **On-screen color contrast** per screen (the library ships an AA validator and AA-capable ramps, but nothing was rendered). Highest risk: marketing-site (0 focus-visible), storefront/mobile (per-store / off-spec palettes).
- **Real responsive reflow/overflow** at each breakpoint, especially the hand-`@media` desktop-first apps (marketing, app-marketplace) on mobile web.
- **Dark-mode visual correctness** in the 7 system-only apps and the customer apps that re-author colors (storefront/marketing render their own palettes, not the `--lb-*` dark ramp).
- **Touch-target sizes** in Flutter (density tokens would guarantee ≥44px but are 0% adopted; sizing is per-widget).
- **Focus-trap / keyboard-nav behavior** of modals / command palette / theme editor at runtime (source shows the wiring; behavior unverified).
- **Whether `validate:design-system` runs to completion in the real GitHub Actions runner** (passes locally; the CI environment was not exercised).
- **Mobile golden-test stability after the `ThemeData` re-point** (UX-R2) — must be re-baselined and visually reviewed.
- **Server-side `provider_mode` truthfulness** feeding the honesty badge (UX-R4) — the badge is only as honest as that field; the field's correctness is a payments-plan concern, not verifiable in the DS layer.
- **Benchmark-framework currency:** Polaris current principles (typography, motion, Pro design language) re-verified 2026-06-10; specific Stripe Elements / Linear sync-engine / Vercel internals are cited as durable published principles and could have shifted since the January-2026 knowledge boundary.

---

*End of LETBUYY_UI_UX_GOVERNANCE.md (DOC 06). This document encodes the already-decided UI/UX winners (UI_UX_UNIFICATION_MASTER_PLAN, UX-001…027) as enforceable governance, grounded in the forensic audit (UIUX-001…033) and re-verified against the working tree 2026-06-10. The single go-live-relevant UI item is the provider-mode honesty badge (UX-R4/UX-R33); everything else is Phase 7 / Waves 4–5 debt-paydown that must never regress accessibility. Subordinate to the Constitution, AGENTS_V2, and Canonical Systems; supreme on all UI/UX matters below them.*
