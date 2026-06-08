# LetBuyy Platform Design System — Discovery (Phase 1)

**Audit date:** 2026-06-08
**Auditor lens:** Polaris architect · Stripe/Atlassian design-systems engineering · staff frontend · principal UX/platform architect · accessibility lead
**Scope:** `@letbuyy/ui` (`packages/typescript/ui`, v0.0.2) and its consumption across all runtime apps. Every token, component, provider, hook, util, ESLint rule, codemod, and validator was read from source; usage was traced with ripgrep across `apps/`.
**Method note:** All counts below are from direct source reads and `grep`. Where an earlier in-repo audit (`docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md`, dated 2026-06-06, against v0.0.1) is referenced, it is to show *trajectory* — several of its findings have since been remediated and re-verified here.

---

## 0. Executive answer (read this first)

**Does LetBuyy have a scalable platform-level design system today?**

**Architecturally: yes — and a genuinely good one.** `@letbuyy/ui` is a single, real, modern design system: a clean three-tier token model (primitive → semantic → component), light/dark theming with `prefers-color-scheme`, three density modes, five per-product "surfaces", a brand-override seam with **runtime WCAG contrast validation**, ~60 components, ~450 icons, Polaris-shaped layout primitives, and a real governance toolchain (ESLint plugin, 6 codemods, 3 snapshot validators, 334 visual-regression baselines). It is mounted (`DesignSystemRoot`) in **all 9 web apps** and consumed by **~290 files**. This is at or above the *architecture* of Shopify Polaris and Stripe Sail.

**Operationally and at the edges: not yet.** The consistency guarantee holds inside `.tsx` component code, but it leaks in three places the current enforcement does not reach: (1) **~613 raw Tailwind default color utilities** (`bg-white`, `text-gray-500`) that bypass tokens and silently break dark mode; (2) a **parallel, hand-"synced" `rgb()` token namespace in every app's `globals.css`** (e.g. 382 raw colors in the merchant app); (3) a **separate, already-drifted Dart token copy** powering the mobile app. Add the operational gaps — no `dist` build, no `changesets`, pinned at `0.0.2`, ~1 unit test, no portals, no Figma/DTCG pipeline — and the verdict is:

> **A strong v1 architecture sitting on a v0.x operational base, with three un-fenced divergence channels that will become design debt as the platform grows. Keep the architecture; do not rebuild. Close the edges and harden the operations.**

**Headline grade: B / B+ architecture, C operational maturity, C+ cross-platform consistency.** The spread between architecture and operations *is* the finding — and it is exactly the spread Polaris, Atlassian, Stripe, and Cloudflare each closed on their way to "world-class".

---

## 1. What physically exists

`@letbuyy/ui` — `packages/typescript/ui`, **v0.0.2**, private workspace package.

| Dimension | Value | Evidence |
|---|---|---|
| Source size | ~9,800 LOC across 33 files in `src/` | `wc -l src/**` |
| Token source | `src/tokens.ts` — **1,374 LOC** | direct read |
| Components (value exports) | ~60 across 12 modules | `src/index.ts` |
| Icons | ~450 (lucide-based) | `src/icons.tsx` |
| Public subpath exports | 6 (`.`, `./formatting`, `./logging`, `./marketplace`, `./preview`, `./tokens`) | `package.json` |
| Storybook stories | 7 story files (catalog-style) | `*.stories.tsx` |
| Visual-regression baselines | **334** screenshots | `storybook-screenshots/baseline` |
| Unit/component tests | **1** component test, **2** `jest-axe` files | `tests/` |
| Codemods | **6** | `codemods/` |
| ESLint rules | **2** (`no-raw-elements`, `no-hardcoded-hex`) | `eslint/index.cjs` |
| Snapshot validators | **3** (public-API, token-variable, no-new-alias) | `tests/validators/` |
| `CHANGELOG.md` | present | repo |
| `dist` build | **none** — `main` points to `./src/index.ts` (ships raw TS) | `package.json` |
| Versioning automation | **`changesets` not configured** | repo |
| Stack | React 19, Tailwind v4, Storybook 10, Vitest 4, TypeScript 5.7 | `package.json` |

### Component vocabulary (the public API)

```
Actions/forms     Button · Input · Textarea · NumberField · InlineError ·
                  Checkbox · Radio · ChoiceList · Combobox · Select · Switch · Tabs
Data display      Table · DescriptionList · Badge · MetricCard · Chart · ProgressBar
Layout primitives Box · BlockStack · InlineStack · Columns · Grid · Container ·
                  Page · PageContent · PageHeader · PageHeaderActions · Section · Text · Divider
App shell         AppFrame · Navigation · Sidebar
Overlays          Modal · Drawer · Dropdown/DropdownMenu · Popover · Tooltip · ConfirmDialog
Feedback          Banner · Toast(Provider/useToast) · EmptyState · Skeleton · SaveBar
Productivity      CommandPalette · FilterBar · Avatar · Pagination
Primitives        Accordion · Disclosure · SegmentedControl · DensityToggle ·
                  DatePicker · DateRangePicker · FilterChips · Breadcrumbs · Spinner
Theming runtime   DesignSystemRoot · createLetbuyyBrandVariables · validateLetbuyyBrandContrast
Formatting        formatInrCurrency · formatIndiaDate(+variants) · formatCurrency/Date/Number
```

This is a **faithfully Polaris-shaped vocabulary** (Page/Section/Card/Stack/Grid layout primitives, resource Table, EmptyState, Banner, SaveBar). The presence of `SaveBar`, `CommandPalette`, `DensityToggle`, `MetricCard`, and a `FilterBar` shows an admin-product (not generic web) design intent — the right instinct for a "Shopify-like" merchant platform.

---

## 2. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          @letbuyy/ui  (single package)                     │
│                                                                            │
│  TOKENS (tokens.ts)                 RUNTIME                                 │
│  ┌───────────────────────────┐     ┌────────────────────────────────────┐ │
│  │ primitive  (raw palette)  │     │ DesignSystemRoot                     │ │
│  │      ▼ references          │     │  ├─ surface (admin|marketplace|...)  │ │
│  │ semantic   (light/dark)   │ ──▶ │  ├─ theme  (light|dark|auto)         │ │
│  │      ▼ references          │     │  ├─ density (compact|comf|spacious)  │ │
│  │ component  (per-component)│     │  ├─ brand   (override + contrast chk) │ │
│  └───────────────────────────┘     │  └─ TokenStyleBoundary → <style>     │ │
│           │  emit                   │        injects letbuyyTokenCss        │ │
│           ▼                         └────────────────────────────────────┘ │
│  letbuyyTokenCss  →  `--lb-*` CSS custom properties                         │
│  (light/dark/auto + 5 surfaces + 3 densities + reduced-motion + keyframes)  │
│           │ consumed via Tailwind arbitrary values  bg-[var(--lb-...)]      │
│           ▼                                                                 │
│  COMPONENTS (button, input, table, overlays, layout, controls, feedback,   │
│  productivity, primitives, app-shell, icons)                               │
│           │                                                                 │
│  GOVERNANCE  eslint(no-raw-elements,no-hardcoded-hex) · 6 codemods ·        │
│              3 snapshot validators · 334 visual baselines · deprecations.ts │
└──────────────────────────────────────────────────────────────────────────┘
              │ workspace import (raw src, no dist)
   ┌──────────┼───────────────────────────────────────────────┐
   ▼          ▼                                                 ▼
 9 Next.js web apps (all mount DesignSystemRoot)        mobile (Flutter/Dart)
 admin · marketplaces · portals · storefront · identity   ⚠ SEPARATE Dart token copy
   │                                                          (letbuyy_color_tokens.dart)
   ▼                                                          — already drifted, no link
 each app ALSO ships globals.css with a parallel --primary/--text/--border
 namespace in raw rgb() ("synced with accounts" by hand)  ⚠ un-fenced divergence
```

The single most important structural fact: **there is exactly one design-system package, and every web app actually mounts it.** That is the hard part of platform consistency, and LetBuyy has it. The risks are all in the *un-fenced channels around* the package (CSS, Tailwind defaults, mobile), not in a fragmented component layer.

---

## 3. Token hierarchy (verified 3-tier)

`tokens.ts` implements the textbook layering modern design systems converge on (EightShapes/Nathan Curtis; W3C DTCG):

```
PRIMITIVE  letbuyyPrimitiveTokens
           color.{purple,gray,slate,green,amber,red,blue,white,black} + opacity
           ⚠ irregular/incomplete scale: gray {50,100,125,150,175,200,400,500,900}
              (missing 300/600/700/800); purple only {300,500,600,700}
     │ references
     ▼
SEMANTIC   letbuyySemanticTokens.{light,dark}
           background.* · button.* · text.* · border.* · accent.* ·
           status.* · statusText.* · statusSoft.* · focusRing · overlay
           ⚠ raw hex leaks here (#5B21B6,#4C1D95,#CBD5E1,#FCA5A5,#7DD3FC)
              because the primitive scale can't express them
     │ references
     ▼
COMPONENT  letbuyyComponentTokens.{light,dark}
           button · card · sidebar · emptyState · input · table · pageHeader · badge · banner
     │
     ├── density   letbuyyDensityTokens  (compact|comfortable|spacious) → CSS vars
     ├── zIndex    base→tooltip (7 layers)
     ├── breakpoint xs360 mobile480 sm640 md768 lg1024 xl1280
     ├── typography fontFamily/size/lineHeight/weight (+ fluid clamp() display/h1/h2)
     ├── space     numeric scale 0..96px  (aliased to xs/sm/md/lg/xl)
     ├── radius    sm4 md8 lg12 xl16 full999
     ├── shadow    sm/md/lg + cardLight/cardDark
     └── motion    duration/easing/transform (+ prefers-reduced-motion → 0ms)
```

**Strengths:** correct three layers; density and per-surface scoping are *more* than Polaris/Stripe expose publicly; brand override + `validateLetbuyyBrandContrast()` bakes accessibility into theming the way Stripe Sail and Cloudflare do; reduced-motion and `box-sizing` reset are handled at the root.

**Weaknesses (detailed in the Token Audit):** incomplete primitive scale forces raw hex into the semantic layer (breaks "no raw values above primitive"); heavy **alias sprawl** (`bg`+`background`, `border`+`borderDefault`, `h1–h4`+`page-title/section-title`, numeric+named space) now policed by a *"no NEW alias"* validator — i.e. debt is being *contained*, not *eliminated*; format is a bespoke TS object emitted by a custom kebab-case generator, **not** W3C DTCG / Style Dictionary, so there is no path to Figma/Tokens-Studio parity or cross-platform (Dart/iOS) codegen.

---

## 4. Theme hierarchy

```
DesignSystemRoot  data-letbuyy-* attributes
 ├─ theme   light | dark | auto(prefers-color-scheme) ............ ✅ works (v0.0.2)
 ├─ surface admin | marketplace | storefront | identity | operations
 │           → [data-letbuyy-surface][data-letbuyy-theme] scoped vars ✅ generated
 ├─ density compact | comfortable | spacious → [data-density] vars .. ✅
 └─ brand   string | {primary, primaryHover, cta…, focusRing}
            → createLetbuyyBrandVariables() (color-mix subtle, contrast check) ✅
```

The CSS emitter (`letbuyyTokenCss`) produces, in one stylesheet: `:root`/`[data-theme=light]`, a `@media (prefers-color-scheme: dark)` block for `auto`, an explicit `[data-theme=dark]/.dark` block, all 5 surfaces × 2 themes, 3 density blocks, a reduced-motion block, and the empty-state float keyframes. `TokenStyleBoundary` uses React context so nested roots don't double-inject. This is a **complete theming runtime** — and it is the asset that makes "white-label like Shopify" technically feasible. The gap is not the engine; it's that apps **also** define theme values by hand in `globals.css` (Section 6), so two theme systems coexist.

---

## 5. Component hierarchy & quality

```
DesignSystemRoot (provider)
 └─ AppFrame ─ Sidebar/Navigation ─ topBar
     └─ Page ─ PageHeader(+identity icons) ─ Section ─ Card
         ├─ layout: Box · BlockStack · InlineStack · Grid(responsive sm/md/lg/xl) · Columns · Container · Text
         ├─ inputs: Button · Input · Textarea · Select · Checkbox · Radio · Switch · Combobox · Tabs
         ├─ data:   Table · DescriptionList · Badge · MetricCard · Chart · Pagination
         ├─ overlay:Modal · Drawer · Dropdown · Popover · Tooltip · ConfirmDialog
         └─ feedback:Banner · Toast · EmptyState · Skeleton · SaveBar
```

**Quality is high and was re-verified in source (v0.0.2):**

- **Button** — tokenized variants/sizes, `focus-visible` ring + offset, `aria-disabled`, `asChild` slot, `as="a"`, loading state. Solid.
- **Modal / Drawer** — `useFocusTrap` (uses the platform `inert` property to isolate the background), `useDismiss` (Esc + outside-click), `role="dialog"` `aria-modal` `aria-labelledby/`describedby``, responsive (full-screen on mobile → centered `sm:`). *The prior audit's "Modal has no focus trap" is fixed.*
- **Input / Textarea** — `useId` unique ids, error/helper ids wired into `aria-describedby`, `aria-invalid` on error, `<label htmlFor>`. *The prior audit's "ID collisions / unwired error ARIA" is fixed.*
- **Dropdown** — roving `tabIndex`, Arrow/Home/End/Esc keyboard, `role="menu"/"menuitem"`. **Tooltip** — touch toggle + `focus-within` + `aria-describedby`.
- **Navigation/Sidebar** — `aria-current`, `aria-disabled`, focus-visible, density-driven sizing.

**Two structural component risks (detailed later):**

1. **No portals.** `createPortal` appears in **0** files. `Dropdown`/`Popover` render in-flow as `absolute` elements, so any `overflow:hidden`/transformed ancestor will clip them and stacking contexts can fight the z-index tokens. Polaris, Atlassian, and Cloudflare (Kumo→Base UI) all portal overlays. This *will* surface as "menu cut off" bugs as pages get denser.
2. **Hand-rolled focus/dismiss.** `overlay-hooks.ts` reimplements focus-trap/dismiss/inert by hand instead of building on a headless primitive library (Radix, Base UI, Floating UI). It is competent today, but it is a large a11y surface to maintain by hand across every overlay variant forever.

---

## 6. Platform consumption map (dependency graph)

All counts are corrected `grep` over `.tsx` (excluding `node_modules/.next/dist`). "DS instances" = `<Button|Input|Select|Textarea|Table|Card|Modal|Drawer|Badge|Banner>`.

| App | pages | api routes | files importing `@letbuyy/ui` | DS component instances | raw `<button/input/select/textarea/table>` | `DesignSystemRoot` |
|---|---:|---:|---:|---:|---:|:--:|
| merchant-control-plane | 61 | 62 | 74 | **574** | 1 | ✅ |
| theme-marketplace | 29 | 3 | 45 | 175 | 6 | ✅ |
| storefront-runtime | 23 | 21 | 42 | 128 | 0 | ✅ |
| identity-platform | 10 | 19 | 11 | 101 | 0 | ✅ |
| app-marketplace | 21 | 8 | 59 | 44 | 5 | ✅ |
| platform-operations-portal | 17 | 0 | 12 | 30 | 0 | ✅ |
| platform-console | 16 | 4 | 12 | 19 | 0 | ✅ |
| developer-portal | 9 | 0 | 13 | 58 | 0 | ✅ |
| marketing-site | 4 | 0 | 10 | 13 | 0 | ✅ |
| **mobile/merchant-app** (Flutter) | 136 `.dart` | — | **0 (cannot)** | — | — | ⚠ separate Dart tokens |

**Platform total:** ~190 web pages + ~140 API routes across 9 apps, plus a 136-file Flutter app. This is a **real platform**, not scaffolding.

**Reserved/not-implemented** (manifest-only per `CLAUDE.md`): `mobile/shopper-app`, `mobile/operator-app`, `services/checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`. Design-system planning must assume these surfaces are coming.

### The three un-fenced divergence channels (verified)

1. **Raw Tailwind default colors — ~613 occurrences.** `bg-white`/`text-white`/`bg-black` etc. = 251; palette utilities (`text-gray-500`, `bg-blue-100`, …) = 362. These resolve to Tailwind's built-in palette, **not** `--lb-*` tokens, so they don't theme to dark mode and don't track brand. The `no-hardcoded-hex` rule does not catch them (they aren't hex literals).
2. **Parallel CSS token systems in every `globals.css`.** Each app redeclares `--primary`, `--text-primary`, `--border`, `--accent-cyan`… in raw `rgb()`, commented "synced with accounts app theme" (i.e. by hand). Raw-color counts per `globals.css`: merchant **382**, marketing **304**, app-marketplace **235**, theme-marketplace 69, identity 43, storefront 18, developer-portal/console/ops ~10–11. ESLint never scans `.css`, so this whole channel is ungoverned and drifts by construction.
3. **Mobile Dart token copy.** `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` is a hand-maintained reimplementation that has **already drifted**: it adds `accentPink`, `cyan`, `teal`, `successStrong` (not in the TS tokens), carries a full `slate` 50–950 scale (TS has only 700–950), uses a different spacing scale (adds `space2`/`space6`, drops 96px), and has **no dark / semantic / component layers**. The "consistent UX across Merchant App + Merchant Mobile App" goal is broken at the foundation: there is no shared source and no codegen.

Plus: **breakpoint tokens are not wired into apps.** `letbuyyTailwindPreset`/`letbuyyTailwindScreens` are used by **0** apps; apps use `@theme inline` + Tailwind default breakpoints. So the DS defines `xs/mobile/sm/md/lg/xl` but apps respond on Tailwind defaults — a second breakpoint system.

---

## 7. Governance & operational maturity (inventory)

| Capability | Status | Evidence / gap |
|---|---|---|
| Token source of truth | ✅ single (`tokens.ts`) for web | ⚠ not DTCG; ⚠ mobile + globals.css are parallel SoTs |
| ESLint enforcement | ✅ `@letbuyy/ui` plugin, 2 rules at `error` | ⚠ covers only button/input/table + hex; not select/textarea/`a`, rgb/hsl, Tailwind palette, or `.css` |
| Codemods | ✅ 6 (token-alias-rename, data-table-to-table, badge-danger-to-critical, text-style-to-text, page-aliases-to-canonical…) | strong migration intent |
| API/token stability | ✅ 3 snapshot validators | public-API, token-variable, no-new-alias |
| Visual regression | ✅ 334 baselines | Storybook screenshot diff |
| Unit / a11y tests | ⚠ 1 component test, 2 jest-axe | thin vs ~60 components; no axe-in-CI gate per component |
| Deprecation signal | ✅ `warnDeprecated()` dev console + `deprecations.ts` | no documented lifecycle/phases |
| Distribution | ⚠ ships raw `src` (`main: ./src/index.ts`), no `dist` | OK for internal monorepo; blocks external/independent publish |
| Versioning | ⚠ manual; pinned **0.0.2**; `changesets` not configured | 9 apps + mobile depend on it with no semver contract |
| Docs site / Figma kit | ⚠ Storybook only (7 catalog stories); no Figma kit / DTCG | no design↔code parity mechanism |

**Trajectory is excellent.** Versus the 2026-06-06 (v0.0.1) audit, the team has, in days: shipped the ESLint fence (raw `<button>` 282→~1, hex-in-TSX 417→0), added 6 codemods, added 334 visual baselines, added a CHANGELOG, fixed Modal focus-trap and Input ARIA, wired `DesignSystemRoot` into all 9 apps, and added `prefers-color-scheme`. That is real, fast execution. The remaining work is the *operational base* (dist/semver/tests/Figma/DTCG) and the *three un-fenced channels* above.

---

## 8. What this means for the platform question

> *Can LetBuyy keep one UX across 10+ apps and 1000+ screens without collapsing into design debt?*

**Yes — conditionally.** The thing that usually makes that impossible (no shared system, or a system nobody adopts) is already solved: one package, mounted everywhere, faithfully consumed in component code. What remains is to (a) **close the three un-fenced channels** (Tailwind palette, `globals.css`, mobile) so divergence becomes *impossible*, not just *discouraged*; (b) **harden operations** (dist, semver/changesets, axe-in-CI, expand tests) so 9+ consumers can upgrade safely; and (c) **add the design↔code spine** (DTCG token pipeline + Figma kit) so design and engineering, web and native, render the same decisions. Those three workstreams are the subject of the Token Audit, the Maturity Scorecard, the Top-200 Issues register, and the Implementation Plan.

---

*Companion documents:* `DESIGN_TOKEN_AUDIT.md` · `DESIGN_SYSTEM_MATURITY_SCORECARD.md` · `TOP_200_ISSUES.md` · `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN.md` · `LETBUYY_PLATFORM_DESIGN_SYSTEM_MASTER_REPORT.md`. *Supersedes the v0.0.1 set in `docs/ui-system-audit/` where counts differ.*
