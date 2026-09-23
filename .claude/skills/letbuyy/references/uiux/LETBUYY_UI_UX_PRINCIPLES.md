# LetBuyy UI/UX Principles — the canonical design-system law, in one place

Derived from `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md` (DOC 06, 2026-06-10; the
constitution, rules UX-R1…R33) and re-measured against the tree on 2026-09-04 at `a751a2ff`. DOC 06
binds; where its dated counts disagree with this file, the counts here are newer (`EVIDENCE_LEDGER.md`).
Subordinate to the Constitution, `AGENTS.md`, `LETBUYY_CANONICAL_SYSTEMS.md`; supreme on UI/UX below them.

---

## 1. Direction — "operator density and merchant trust at 10k"

LetBuyy is a **merchant operating system** for Indian micro and small merchants, plus a buyer
storefront and a hosted checkout. The design register is Polaris-grade operator density
(Shopify), Stripe-grade money legibility, Linear-grade speed and keyboard restraint, Vercel-grade
whitespace and dark-mode discipline (DOC 06 §7). Not a marketing template, not a consumer toy.

- Light **and** dark are both complete and both reachable (UX-R12, UX-R13). One exception: `identity-platform` is light-only by OWNER_DECISION D-AUTH-LIGHT (2026-09-23).
- Structure comes from tokens: borders, spacing, type hierarchy — not decoration.
- The brand purple (`letbuyyPrimitiveTokens` brand ramp) is used for meaning: primary action,
  active state, focus, key emphasis. Per-tenant brand injection (`createLetbuyyBrandVariables`) and
  per-store storefront theming are **blessed axes**, not drift.
- Money is the hero on checkout and Finance surfaces; amounts are tabular, breakdowns never
  collapsed, INR with `formatInrCurrency`.
- Honesty over polish: a stub/sandbox/no-op never renders as `success` (UX-R33).

---

## 2. The three-line law (DOC 06 §4)

1. **ONE token source → generated platforms.** `packages/typescript/ui/src/tokens.ts` is the sole
   authoring source; it projects to DTCG `tokens.json`, to web `var(--lb-*)` via `letbuyyTokenCss` →
   `DesignSystemRoot`, and to the Dart bridge `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`
   that the Flutter `ThemeData` consumes. No second token system, no app-local `--lb-*` redefinition,
   no hardcoded hex/px/inline colour.
2. **ONE shell + ONE theme controller.** `AppNavigation` (`src/navigation/app-navigation.tsx`) is the
   only primary-navigation shell; the theme provider (`localStorage["letbuyy-theme"]`,
   `light|dark|system`) feeding `DesignSystemRoot` is the only theme controller — protected, never rebuilt.
3. **Complete, honest, governed.** Every component ships every required state; AA is the floor;
   `ProviderModeBadge` renders money-mode truth; CI blocks new drift and ratchets old drift to zero.

---

## 3. Token taxonomy (six axes + density + breakpoints) — measured

| Axis | Source (`tokens.ts`) | CSS vocabulary | Dart bridge class |
|---|---|---|---|
| Color | `letbuyyPrimitiveTokens` (purple/gray/slate/green/amber/red/blue ramps) → `letbuyySemanticTokens.{light,dark}` (background · button · text · border · accent · status · statusText · statusSoft · focusRing · overlay) → `letbuyyComponentTokens.{light,dark}` | `--lb-color-*` | `LetbuyyPrimitiveTokens`, `LetbuyyColorTokens` |
| Space | 12-step scale | `--lb-space-*` | `LetbuyySpacingTokens` |
| Type | families (`--font-letbuyy-sans/display/mono`), weights, fluid `clamp()` display/h1/h2, caption→display sizes, line-heights | `--lb-font-size-*`, `--lb-font-*`, `--lb-line-height-*` | `LetbuyyTypographyTokens` |
| Radius | 5-step | `--lb-radius-*` | `LetbuyyRadiusTokens` |
| Elevation | 5-step shadows (`letbuyyShadowTokens`) | `--lb-shadow-*` | `LetbuyyShadowTokens` |
| Motion | durations + easings; `prefers-reduced-motion` zeroes motion | `--lb-motion-*` | — |
| Density | `letbuyyDensityTokens` compact/comfortable/spacious (heights, paddings, gaps, icon + illustration sizes); `DensityToggle`; `letbuyyDensityCssVariables` | density-scoped `--lb-*` | `LetbuyyDensityTokens` |
| Breakpoints | `letbuyyBreakpointTokens` xs360 · mobile480 · sm640 · md768 · lg1024 · xl1280 → `letbuyyTailwindPreset` | `--lb-bp-*` | — |
| Z-index | `letbuyyZIndexTokens` | `--lb-z-*` | — |
| Surface | `LetbuyySurface` = admin · marketplace · storefront · identity · operations (`letbuyySurfaceTokens`) | per-surface overrides | — |

307 `--lb-*` variables at `a751a2ff`. Runtime WCAG validation: `validateLetbuyyBrandContrast`
(AA 4.5 text / 3.0 focus, real luminance). **Naming trap:** `packages/token-core` is the **auth/JWT**
envelope, not design tokens (UX-R28).

**Rules:** UX-R1 one source · UX-R2 Flutter `ThemeData` consumes the bridge, raw `Color(0x…)`/
`fontSize:`/`EdgeInsets(` outside the theme layer forbidden · UX-R3 no app-local `--lb-*` redefinition
(alias by `color-mix()`/derivation only) · UX-R6/R7/R8 no raw px spacing, raw px font-size, Tailwind
default palette · UX-R12 both role sets complete · UX-R18 breakpoints from the preset only.

---

## 4. Components and composition

- Every UI element is a `@letbuyy/ui` export (web) / `letbuyy_ui_kit` export (Dart), or a documented
  app-local composition **built from** those. Forking an exported primitive is forbidden (UX-R9):
  no local `StatusBadge`, no bespoke `<table>`, no `_local-ui` workspace twins
  (`localWorkspaceImplementations` is a HARD metric at 0).
- Composition grammar: `Page` → `PageHeader` (title, description, breadcrumbs, `primaryAction`,
  `secondaryActions`) → `Card`/`Section` → primitives. Lists are `Table` with typed columns; INR via
  `formatInrCurrency`; dates via `en-IN`; status via `Badge`/`StatusPresentationBadge`; row actions
  with per-row busy state; detail in a `Drawer`; destructive via `ConfirmDialog`; unsaved changes via
  `SaveBar` (`docs/ui-standards/dashboard-patterns.md`, `merchant-ux.md`, `forms-patterns.md`).
- **One primary action per screen**, top-right and/or pinned. Progressive disclosure. Plain language.
- Reveal-once secrets (gift-card codes, API keys) with a copy button, then masked.
- Flutter mirrors the same grammar through `ui_kit`; the duplicates `empty_state_widget.dart`/
  `error_widget.dart` are canonicalization debt (`CANONICALIZATION_PROGRAMME.md` UX-7), not a licence
  to pick either.

---

## 5. Required component states — the completeness contract (UX-R5, DOC 06 §4.6)

| State | Requirement |
|---|---|
| Light / Dark | renders the `--lb-*` ramp, never an ad-hoc palette |
| Skeleton | `Skeleton` mirrors the loaded layout; no layout shift (`docs/ui-standards/loading-states.md`) |
| Empty | `EmptyState` + `EmptyStateIllustration`; first-run vs filtered-empty distinguished; teaches the next step |
| Error-with-retry | every fetch/mutation failure renders `Banner variant="critical"`/inline `error` + a retry; input preserved; never a silent blank; never a stub reading as success |
| Focus | visible `:focus-visible` ring from `--lb-color-focus-ring`, AA 3.0 against adjacent |
| Hover / Active / Disabled | token-driven; disabled stays AA-legible with correct semantics |

Async surfaces render `Page`/`PageHeader` immediately and skeleton the body; optimistic updates only
where safe, reconciled on response, rolled back with a `Banner` on error.

---

## 6. Shell, IA and theme

- **Shell adoption target 9/9** on `AppNavigation`; measured `a751a2ff`: merchant_web 2 files,
  admin_web 1, customer_web/identity/marketing 0. Order (DOC 06 §6): merchant_web first (folds in the
  Finance node, keeps the command palette and shortcuts), then customer_web **account** shell (buyer
  chrome stays per-store), then admin_web check; identity is auth-flow only; marketing uses a shared
  marketing kit, never the admin shell. After merchant adopts, new inline `<aside>`/`<nav>` primary
  navigation is forbidden (UX-R11); one sidebar width (`md`).
- **Operator-first IA with a first-class Finance node** (UX-R19): Orders / Finance / Customers are
  top-level primary; Settings at the bottom; keyboard shortcuts and `CommandPalette` are real.
- **Dark mode must be user-reachable in every canonical app** (UX-R13): a labelled, keyboard-operable
  `ThemeToggleButton` persisting to `letbuyy-theme`. Measured: merchant_web has none. **Exception:**
  `identity-platform` is light-only by OWNER_DECISION D-AUTH-LIGHT (2026-09-23). The ratchet holds it
  there with a HARD forced-light invariant: both theme entry points forced light, and no theme control.
- `theme="auto"` is banned (HARD invariant); the vocabulary is `light|dark|system`.

---

## 7. Money, checkout and the honesty badge

- `ProviderModeBadge` (`feedback.tsx:220`) renders `live | sandbox | scaffold` as **text + role,
  never colour alone**, bound to backend `provider_mode`, on every payouts/COD/wallet/commission/
  settlement/fulfilment surface, web and Flutter (UX-R4; `provider-mode-badge-validator` enforces
  four money-surface consumers at `a751a2ff`). Absent mode renders scaffold/unknown, never
  sandbox-as-success.
- Checkout (`docs/ui-standards/checkout-patterns.md`): server-authoritative totals only; itemised
  subtotal / shipping / GST / discount / gift card / **amount payable**; COD + Razorpay explicit; one-step
  clarity; failure keeps the cart with a retry; confirmation shows the order number.
- Money legibility (UX-R21): tabular numerals, never-collapsed breakdowns, money as the hero.

---

## 8. Motion

Durations and easings from `--lb-motion-*`; `prefers-reduced-motion` zeroes all motion (kill switch in
`tokens.ts`). Micro 120–180 ms, standard 180–260 ms, 300 ms maximum, `transform`/`opacity` only, ≤ 2
concurrent animations in view. No scroll hijacking, parallax, counting numbers, auto-advancing
carousels, ambient loops, preloaders. Budgets: `PERFORMANCE_AND_MOTION_BUDGETS.md`.

---

## 9. Enforcement — the ratchet that blocks (DOC 06 §5)

| Banned construct | Validator / gate | At `a751a2ff` |
|---|---|---|
| Raw hex in CSS / TSX | ratchet `appCssRawHex` / `tsxRawHex`; ESLint `no-hardcoded-hex` | 142 / 2 (both falling) |
| Naked `rgb()/hsl()` in app CSS | ratchet `appCssNakedRgbHsl`; stylelint | 786 |
| Raw `font-size:Npx` / raw `Npx` spacing | ratchet `rawPxFontSize` / `rawPxSpacing` | 592 / 1,556 |
| Inline `style={}` (except blessed dynamic theming) | ratchet `tsxInlineStyles` (cap 673) | 673 |
| Tailwind default palette classes | ratchet `tailwindPaletteClasses`; ESLint `no-tailwind-default-color` | 524 |
| App-local `--lb-*` redefinition | ratchet `appLocalLbTokenRedefs` (target HARD 0, UX-R3) | 275 |
| Arbitrary radius / shadow | ratchet `tsxArbitraryRadius` / `tsxArbitraryShadow` | 386 / 9 |
| Local workspace implementations | HARD `localWorkspaceImplementations` = 0 | 0 |
| Dark-mode reachability targets missing | HARD | 0 on the committed tree; 1 in the dirty primary (another session deleted `identity-platform/src/lib/useAuthTheme.ts`, uncommitted) |
| Theme control or unforced layout on a light-only surface (`identity-platform`, D-AUTH-LIGHT) | HARD `forcedLightSurfaces` | added 2026-09-23 by F-IDUI-1, which removed identity from the reachability list; 0 at its merge |
| Second token source / second shell | `token-source-single-validator`, `shell-single-validator` | pass |
| Money surface without the badge | `provider-mode-badge-validator` | pass |
| Token parity (tokens.ts ↔ tokens.json ↔ Dart) | `generate-design-tokens.mjs --check`, `generate-mobile-tokens.mjs --check` | pass |

Every metric only decreases; a rise is a CI failure; `--update` records genuine reductions only
(UX-R29). The ratchet walks the **filesystem**: measure committed content before blaming a commit.
