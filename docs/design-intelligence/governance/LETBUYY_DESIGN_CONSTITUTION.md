# LetBuyy Design Constitution v1.0

**Document type:** Design governance law for the LetBuyy platform ecosystem.
**Document ID:** DESIGN-CONST-01
**Date ratified:** 2026-06-19
**Authority chain:** Subordinate to LETBUYY_CONSTITUTION.md (supreme law) and root AGENTS.md. Supersedes any ad-hoc design decisions not previously codified.
**Status:** RATIFIED.

---

## Preamble

### Why this constitution exists

LetBuyy is not a product. It is a **platform ecosystem** built on a shared technical foundation. Within it live five distinct product surfaces — each serving radically different users with different needs, different mental models, and different relationships with the brand:

- A **merchant control plane** where a small Indian business owner manages their entire livelihood.
- A **storefront runtime** where a shopper discovers and purchases from a merchant's brand — an experience that must feel like *that merchant's brand*, not LetBuyy's.
- An **identity platform** that must radiate trust and security above all else.
- A **marketing site** that must convert skeptical merchants who have never heard of LetBuyy.
- A **platform console and developer portal** where operators and developers who already understand the system get dense, efficient tooling.

A global unified style guide would be the wrong answer for this ecosystem. It would make the merchant storefront feel institutional, make the marketing site feel like a dashboard, and make the developer tools feel like a consumer product. It would harm user experience in the name of consistency.

This constitution exists to define the correct level of consistency: **one set of foundational constraints that guarantee the ecosystem holds together technically, with design freedom at every layer above those constraints.** It answers: what must be the same, what may differ, and who decides.

### What this constitution governs

- The token architecture and ownership model for all LetBuyy web surfaces.
- The shared interaction library: which components are shared across products and which are product-specific.
- The per-product design system boundaries: what each product surface may define independently.
- The tenant customization boundary: what merchants can change in their storefronts and what is locked.
- The review, enforcement, and change-control processes for design decisions.
- The deprecation protocol for tokens and components.

### What this constitution does NOT govern

- Aesthetic decisions within a permitted product design system. The marketing site's hero typography is not governed here.
- Merchant storefront themes. The theme engine is governed by the theme platform architecture (`packages/theme-engine`) and the Liquid theme model. The LetBuyy design system tokens do not reach into tenant-authored themes.
- Mobile apps (merchant-app, shopper-app). These inherit the token philosophy but have their own platform-appropriate implementation.
- Content, copy, and voice decisions. These belong to product and marketing teams.
- Third-party app and theme marketplace submissions. These are governed by the marketplace developer policy, not this constitution.

---

## Article I: Platform Design Philosophy

### I.1 — LetBuyy is a platform ecosystem, not a single product

The platform hosts five first-class product surfaces (see Preamble). Each surface serves a different primary user with a different primary task. The design system's job is to make each surface **excellent for its users** while guaranteeing that the ecosystem **holds together technically and contractually**.

This means:

- Consistency **within** a product surface is mandatory. A merchant should never encounter an inconsistent interaction pattern within the control plane.
- Consistency **across** product surfaces at the aesthetic layer is not a goal. A merchant storefront should not look like the merchant control plane. The marketing site should not look like the platform console.
- Technical consistency **across** all surfaces is mandatory. Token naming, accessibility contracts, theming model, and interaction primitives must be the same foundation across every surface.

### I.2 — The design system is infrastructure, not a style guide

The `@letbuyy/ui` package and the `--lb-*` token system are **infrastructure**. They are load-bearing in the same way the API gateway is load-bearing:

- They enforce accessibility contracts (focus management, ARIA defaults, contrast minimums) that no single product team can be trusted to get right independently.
- They enforce the theming model (dark mode, density, tenant brand overrides) that must work identically across all surfaces.
- They enforce the India-first constraints (INR formatting, `en-IN` dates, mobile-first tap targets) that are constitutional product requirements.
- They prevent the token proliferation and CSS drift that, unchecked, make a codebase unmaintainable within two years.

Like infrastructure, the shared design system should be as small as possible while remaining sufficient. Its boundary is the interaction primitive and the token, not the page layout or the visual aesthetic.

### I.3 — Different users, different design languages

The five product surfaces have explicitly different user relationships:

| Surface | Primary user | User relationship | Design language priority |
|---------|-------------|-------------------|--------------------------|
| Merchant control plane | Small Indian business owner | High-stakes tool; their livelihood | Clarity, confidence, density, INR-first |
| Storefront runtime | Shopper | Brand-first discovery and purchase | Merchant's brand identity; LetBuyy invisible |
| Identity platform | Merchant (authenticating) | Trust-critical moment | Security cues, minimal, trustworthy |
| Marketing site | Prospective merchant | Persuasion and conversion | LetBuyy brand expression, narrative |
| Platform console / developer portal | Operator / developer | Expert tool; high cognitive load | Dense, information-rich, efficient |

Each of these calls for a different typography scale, a different color expression, a different information density, and a different emotional tone. The design constitution's job is to enable — not prohibit — these differences.

### I.4 — The ratchet principle

The design system enforces a **ratchet**: the number of violations of its core rules may never increase; it may only decrease or hold. New code must not introduce new instances of: hardcoded hex colors, raw HTML interactive elements, Tailwind default palette classes, raw pixel spacing/sizing, or arbitrary border-radius.

The ratchet is enforced by the `validate:design-system` gate. This is constitutional; the ratchet never loosens without an ARB decision.

---

## Article II: Layer Architecture

The LetBuyy design system is organized in four layers. Each layer has a defined scope, ownership, and governance tier. Higher-numbered layers may extend but never override lower-numbered layers.

```
Layer 0: Global Foundation         (--lb-* tokens, shared by all surfaces)
Layer 1: Shared Interaction Library (interaction primitives, behavioral contracts)
Layer 2: Product Design Systems    (per-product visual language and extensions)
Layer 3: Tenant Customization      (merchant-configurable storefront overrides)
```

### II.A — Layer 0: Global Foundation

**Scope:** The atomic token layer. All values that any LetBuyy surface must share to remain technically coherent.

**What belongs here:**
- The primitive color palette (`letbuyyPrimitiveTokens`) — raw palette values, private to the system.
- The semantic color roles (`letbuyySemanticTokens`) — light/dark scheme aliases like `bg`, `surface`, `text`, `border`, `primary`, `critical`, `success`, `warning`, `info`.
- The spacing scale (`letbuyyTokens.space`) — the 12-step numeric scale (`--lb-space-0` through `--lb-space-11`) and named aliases.
- The radius scale (`--lb-radius-sm/md/lg/xl/full`).
- The typography scale — the role-based font size and line height tokens (`--lb-font-size-*`, `--lb-line-height-*`) and font weight tokens.
- The font family tokens — body, display, mono (`--lb-font-family-*`).
- The motion tokens — duration and easing (`--lb-motion-*`, `--lb-ease-*`).
- The breakpoint scale — the six canonical breakpoints (`xs: 360px` through `xl: 1280px`) used as Tailwind `--breakpoint-*` variables.
- The z-index scale (`--lb-z-*`).
- The shadow scale (`--lb-shadow-*`).
- The density tokens (`--lb-density-*`) — the three-tier `compact/comfortable/spacious` system controlling control heights, paddings, and gaps.
- The size tokens (`--lb-size-*`) — canonical sizes for controls, page max-width, component constraints.

**What does NOT belong here:**
- Product-specific colors (marketing hero gradients, storefront accent palettes).
- Component-specific visual decisions beyond the semantic layer.
- Aesthetic choices (a specific font for the marketing site's display heading).

**Token prefix:** `--lb-*` (mandatory for all Layer 0 tokens).

**Source of truth:** `packages/typescript/ui/src/tokens.ts`. The DTCG interchange file `packages/typescript/ui/tokens.json` is kept in parity by `scripts/generators/generate-design-tokens.mjs`.

**Governance:** Owned by the Platform team. Changes to Layer 0 require Architecture Review Board (ARB) sign-off.

**Rules:**
1. Primitive tokens (`letbuyyPrimitiveTokens`) are private. They must never be referenced in product code; only in Layer 0 semantic mapping.
2. Every product surface must consume semantic role tokens (`--lb-color-*`) and never hardcode hex, `rgb()`, `hsl()`, or Tailwind default palette classes.
3. The deprecated token aliases listed in `tokens.ts:deprecatedTokenAliasVariables` are removed from the emitted CSS and must not be used. The `token-alias-rename` codemod handles migration.
4. Font family is declared once at the design-system root. No product code re-declares `font-family`.
5. No new token may be added to Layer 0 without an ARB review. The bar is: "would every LetBuyy surface need this?"

**Exception process:** None. Layer 0 has no exceptions. Product-specific values belong in Layer 2.

### II.B — Layer 1: Shared Interaction Library

**Scope:** The behavioral contract layer. Interactive patterns and component primitives whose accessibility, focus management, theming, and behavioral contracts must be identical across all product surfaces.

**What belongs here:**

*Actions and inputs:* `Button`, `Input`, `Textarea`, `NumberField`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `ChoiceList`, `Tabs`, `SegmentedControl`, `DatePicker`, `DateRangePicker`, `FilterChips`.

*Layout:* `Page`, `PageHeader`, `Section`, `Card`, `Box`, `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Text`, `Divider`.

*Data:* `Table`, `DescriptionList`, `Pagination`, `MetricCard`, `Chart`, `ProgressBar`.

*Feedback:* `Badge`, `Banner`, `EmptyState`, `Skeleton`, `Spinner`, `ToastProvider` / `useToast`, `SaveBar`, `StatusBadge`.

*Overlays:* `Modal`, `Drawer`, `Dropdown`, `DropdownMenu`, `Popover`, `Tooltip`, `ConfirmDialog`.

*Shell and nav:* `AppFrame`, `Sidebar`, `Navigation`, `AppNavigation`, `Breadcrumbs`, `CommandPalette`, `Avatar`.

*Theme infrastructure:* `LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `DensityToggle`, `DesignSystemRoot`.

**The critical behavioral contracts this layer enforces:**
- Focus management: all overlays (`Modal`, `Drawer`, `Popover`, `Dropdown`, `Tooltip`, `CommandPalette`) share the same focus-trap, escape-key dismiss, and z-index stack. No product builds its own overlay.
- Accessibility defaults: `Checkbox` requires a label prop. Interactive elements carry ARIA defaults. Focus rings use `--lb-color-focus-ring`.
- Status vocabulary: `Badge`/`StatusBadge` are the canonical status mappers. No product re-derives `tone→color` locally.
- INR formatting: `formatInrCurrency` from `@letbuyy/ui/formatting` is the only way to format money. Dates use `en-IN` locale.
- Deprecation tracing: `warnDeprecated` fires in non-production environments for any deprecated symbol. Consumer apps never silence these.

**Governance:** Owned by `@letbuyy/ui` maintainers. Changes require a pull request review from at least one maintainer outside the proposing team.

**Rules:**
1. Raw HTML interactive elements (`<button>`, `<input>`, `<table>`, `<select>`, `<textarea>`, `<dialog>`) are **errors** in product code. Use the library equivalents. This is enforced by `@letbuyy/ui/no-raw-elements` (error) and `no-raw-form-controls` (warn).
2. Products may extend primitives via props. They may not fork primitives by copying and modifying the source.
3. Admin and operations sidebars must use `AppNavigation` or `Sidebar + Navigation`. Active state comes from the navigation primitive, not per-app `pathname ===` comparisons.
4. The theming model has exactly one provider per app: `LetbuyyThemeProvider`. No second `ThemeProvider` with its own `createContext`.
5. The flash-prevention script is `ThemeScript` in `<head>`. Apps must not hand-roll flash prevention scripts.

**Graduation path:** A component that starts in a single product's local UI directory may be proposed for graduation to Layer 1. Graduation criteria: used in two or more products, has accessibility tests, has no product-specific assumptions baked in. Proposed via pull request with the `design:graduate` label; reviewed by UI maintainers.

**Deprecation path:** A deprecated Layer 1 component is marked with `warnDeprecated`, retains its export for one major version, and is removed after a cross-app migration confirmed by the `validate:design-system` gate. A codemod is provided before deprecation is announced.

### II.C — Layer 2: Product Design Systems

Layer 2 is where each product surface may define its own visual language, typography expression, color palette extensions, component extensions, and layout conventions — within the bounds set by Layers 0 and 1.

Products may:
- Define additional color tokens (outside the `--lb-*` prefix, scoped to the product).
- Choose their typography expression within the type scale (e.g., using the display fluid scale for marketing page heroes).
- Define product-specific layout patterns and page templates.
- Choose component compositions and page structures (e.g., the merchant dashboard's multi-column layout is a Layer 2 decision).
- Define density defaults per surface (`compact` is the global default; a product may set a different default).

Products may NOT:
- Redefine Layer 0 tokens.
- Fork Layer 1 components.
- Bypass the theming model.
- Hardcode colors, spacing, or font sizes outside the token system.

Each product's Layer 2 definition is owned by the team responsible for that surface.

---

#### II.C.1 — Merchant Experience Design System

**Purpose:** The primary tool through which small Indian merchants manage their businesses. Every interaction must project confidence and clarity. Merchants are not power users; they did not choose commerce software as a hobby — it is their livelihood.

**Primary users:** Small Indian business owners, typically on mobile, often managing their business between customer interactions.

**Design language:** Functional clarity. High information density is appropriate (merchants learn the tool and return daily). Color is used sparingly for status and primary actions, not decoration. Every screen has one obvious primary action.

**Permitted token extensions:**
- Surface tokens for `admin` surface type (already defined in `letbuyySurfaceTokens`).
- Product-specific merchant dashboard layout tokens if needed (under a `--mcp-*` prefix).

**Typography:** Use the role-based scale as defined. Page titles at `--lb-font-size-page-title` (24px). Body at `--lb-font-size-body` (14px). Do not introduce display-scale typography in operational UI.

**Color palette:** The platform's purple primary. Status colors for order states (pending/confirmed/shipped/delivered/cancelled). No decorative color.

**Component extensions permitted:**
- Merchant-specific data visualization components for the dashboard (order trend charts, revenue metrics).
- India-specific form components (GSTIN input with validation, pincode serviceability checker, UPI ID input).
- Merchant-specific empty states and first-run experiences.

**Density default:** `compact`. The DensityToggle is available to merchants who prefer more breathing room.

**Critical constraints:**
- One primary action per screen.
- All monetary amounts via `formatInrCurrency`. All dates via `toLocaleDateString('en-IN')`.
- Destructive actions always require `ConfirmDialog` explaining the consequence.
- The `SaveBar` must be visible whenever unsaved changes exist.
- Empty states are never blank — they teach the next step with a primary action.
- Loading states use `Skeleton` mirroring the layout. Never a blank flash.

---

#### II.C.2 — Operator and Admin Design System

**Purpose:** Dense, information-rich tooling for LetBuyy operators and platform administrators managing the multi-tenant environment.

**Primary users:** LetBuyy internal operators, platform team members.

**Design language:** High density, high information richness. Dark mode as default (`platform-console` and `platform-operations-portal` default to `dark`). No consumer-style whitespace or marketing aesthetics.

**Permitted token extensions:**
- Additional surface tokens for operations-specific status states (system health, deployment state).
- Under `--ops-*` prefix.

**Typography:** Compact. Table density preferred. Use `--lb-font-size-table` (13px) for data-heavy views.

**Density default:** `compact`. The `spacious` preset is not appropriate for operator tooling.

**Component extensions permitted:**
- Operator-specific monitoring dashboards.
- Multi-tenant management views.
- Deployment and infrastructure status panels.

---

#### II.C.3 — Marketing Design System

**Purpose:** Persuade prospective Indian merchants that LetBuyy is the right platform for their business. Convert skeptics into trial users.

**Primary users:** Prospective merchants who have never used LetBuyy. May be encountering the brand for the first time.

**Design language:** Expressive, narrative, brand-forward. This is the one surface where LetBuyy's own brand identity is the foreground. Bold typography, gradient accents, motion, and India-first messaging are appropriate here.

**Permitted token extensions:**
- Fluid display typography (`--lb-font-size-display-fluid`, `--lb-font-size-h1-fluid`, `--lb-font-size-h2-fluid`) are the primary heading scale for marketing pages.
- Marketing-specific gradient definitions (under `--marketing-*` prefix).
- Hero and feature illustration palettes.

**Typography:** Display-scale headings. The fluid type scale (`clamp()`) is the intended tool. Body copy at `--lb-font-size-body` or `--lb-font-size-body-large`.

**Density:** Not applicable. Marketing pages do not use the density system.

**Component extensions permitted:**
- Pricing tables and plan comparison components.
- Feature cards, testimonials, and social proof components.
- Marketing-specific hero and CTA components.
- FAQ and accordion components.

**Constraint:** Even marketing pages must use `--lb-*` tokens for all Layer 0 values. No hardcoded hex. The ESLint rules apply.

---

#### II.C.4 — Storefront Design System

**Purpose:** Present each merchant's brand and products to shoppers. The storefront must feel like the **merchant's brand**, not LetBuyy's brand. LetBuyy is the infrastructure; it should be invisible to shoppers.

**Primary users:** Shoppers browsing and purchasing from a specific merchant's store.

**Design language:** This is intentionally undefined at the platform level. The merchant defines the design language through their theme. A fashion merchant's storefront should feel like a fashion brand. A food merchant's storefront should feel like their restaurant.

**Architecture:**
- The storefront runtime hosts Liquid themes (the canonical renderer). The theme engine (`packages/theme-engine`) is the correct place for storefront design system decisions, governed by the theme platform architecture.
- React-rendered storefront routes (canary, non-default) inherit `--lb-*` Layer 0 tokens for structural consistency but may define their own visual language.

**Permitted token extensions:**
- Tenant brand variables injected by `createLetbuyyBrandVariables` (primary color, hover, active, focus ring, subtle background). These override `--lb-color-primary-*` within the storefront context.
- All tenant brand overrides are validated for WCAG contrast by `validateLetbuyyBrandContrast` before application.

**What is locked (not customizable by merchants):**
- Focus ring must maintain a minimum contrast ratio of 3:1 (WCAG 2.1 §1.4.11).
- Interactive element minimum tap target size of 44px height.
- Payment method logos and trust indicators (cannot be styled away).
- Error and success states in checkout (must maintain legibility).

**What Layer 1 governs in the storefront:**
- The checkout flow's interaction primitives (forms, buttons, error states) use Layer 1 components. Checkout is too trust-critical to allow per-merchant reimplementation.
- The `formatInrCurrency` function is used for all monetary display in checkout.

---

#### II.C.5 — Developer Platform Design System

**Purpose:** Developer portal and API documentation surfaces. These are frozen or pending consolidation per the platform constitution and are not active deploy targets. This section documents the intended design system for when they become active.

**Primary users:** Third-party developers building on the LetBuyy platform.

**Design language:** Documentation-optimized. Code-heavy. Monospace prominence. Dark mode appropriate.

**When active:** Governed by the `@letbuyy/ui` Layer 1 primitives with a developer-specific Layer 2 extension. Pending ARB approval for the active topology.

---

### II.D — Layer 3: Tenant Customization

**Scope:** The values that merchants may configure to make their storefront feel like their brand.

**What merchants can change:**
- Primary brand color (validated against WCAG AA contrast before application via `validateLetbuyyBrandContrast`).
- The derived brand token set: `primary`, `primaryText`, `primaryHover`, `primaryActive`, `primarySubtle`, `primaryCta`, `primaryCtaHover`, `primaryCtaActive`, `primaryCtaText`, `focusRing`.
- Font selection (from a curated set; not arbitrary web fonts — a performance and safety constraint).
- Through the theme engine: layout structure, section ordering, color scheme, typography within permitted bounds.

**What merchants cannot change:**
- Structural accessibility requirements (focus ring minimum contrast, tap target sizes).
- Payment and trust indicator presentation.
- Error and success state semantics in checkout.
- `--lb-*` Layer 0 tokens outside the brand override set.

**Token exposure API:** The `createLetbuyyBrandVariables(brand: LetbuyyBrandInput)` function is the only public API for injecting tenant customization. It takes a primary color (string) or a full `LetbuyyBrandOverrides` object and returns a `CssVariableMap`. This map is applied scoped to the tenant's storefront context.

---

## Article III: Token Ownership and Change Control

### III.1 — Token tiers and ownership

| Token tier | Prefix | Owner | Change control |
|------------|--------|-------|----------------|
| Primitive | `--lb-primitive-*` | Platform team | ARB required |
| Semantic | `--lb-color-*`, `--lb-semantic-*` | Platform team | ARB required |
| Component | `--lb-component-*` | `@letbuyy/ui` maintainers | PR review required |
| Density | `--lb-density-*` | `@letbuyy/ui` maintainers | PR review required |
| Scale (space, radius, type, motion) | `--lb-space-*`, `--lb-radius-*`, `--lb-font-*`, `--lb-motion-*`, etc. | Platform team | ARB required |
| Product-specific | `--mcp-*`, `--ops-*`, `--marketing-*` | Respective product team | Standard PR review |
| Tenant brand | `--lb-color-primary*`, `--lb-color-focus-ring` (overridable set only) | Tenant (runtime) | Validated via `validateLetbuyyBrandContrast` |

### III.2 — Adding tokens

A new `--lb-*` token may be added to Layer 0 only if it passes the "every surface test": every LetBuyy web surface would plausibly use this token. If only one product needs it, it belongs in that product's Layer 2 with a product-scoped prefix.

Process for adding a Layer 0 token:
1. Open an issue with the `design:token-proposal` label describing the use case and the surfaces that need it.
2. ARB review (async for non-breaking additions; synchronous for changes to semantic roles or primitives).
3. Add to `tokens.ts`, add to `tokens.json` (the DTCG interchange file), and run `generate-design-tokens.mjs --check`.
4. Add the CSS variable to the appropriate emitter in `letbuyyTokenCssVariables`.
5. Update the reference CSS (`docs/design-system/tokens.reference.css`) by re-running the generator.

### III.3 — Modifying tokens

Modifying the value of a Layer 0 semantic or primitive token is a breaking change. It affects every surface that consumes it. It requires:
1. ARB sign-off.
2. A cross-app visual review (Storybook screenshots before/after).
3. A version bump in `@letbuyy/ui`.
4. A migration note in the package changelog.

### III.4 — Deprecating tokens

The deprecation process is structured:
1. Add the token name to `deprecatedTokenAliasVariables` in `tokens.ts`. This removes it from the emitted CSS.
2. Add a replacement mapping to `codemods/token-alias-rename.cjs`.
3. Announce the deprecation in the package changelog with the replacement token name and the version it ships.
4. Run the codemod across all apps in the monorepo.
5. The deprecated token alias is permanently deleted one major version after the migration is confirmed complete.

Current deprecated aliases (pending migration completion):
- `--lb-color-text-primary` → `--lb-color-text`
- `--lb-color-text-secondary` → `--lb-color-text-subdued`
- `--lb-color-border-default` → `--lb-color-border`
- `--lb-color-border-subtle` → `--lb-color-border`
- `--lb-color-danger` → `--lb-color-critical`
- `--lb-semantic-focus-ring` → `--lb-color-focus-ring`
- `--lb-semantic-accent-brand` → `--lb-color-primary`
- `--lb-semantic-accent-text` → `--lb-color-primary-text`
- `--lb-semantic-text-primary` → `--lb-color-text`
- `--lb-semantic-text-secondary` → `--lb-color-text-subdued`
- `--lb-semantic-text-muted` → `--lb-color-text-muted`

---

## Article IV: Component Ownership

### IV.1 — Ownership tiers

| Component tier | Location | Owner | Changes require |
|---------------|----------|-------|-----------------|
| Layer 1 shared | `packages/typescript/ui/src/` | `@letbuyy/ui` maintainers | PR + maintainer review |
| Product-specific | `apps/<app>/src/_local-ui/` or `apps/<app>/src/components/` | Product team | Standard PR review |
| Graduating (proposed for Layer 1) | Staging in product; PR open | Shared review | Maintainer review + tests |

### IV.2 — Proposing new shared components

New components in Layer 1 are proposed via pull request with the label `design:new-component`. The proposal must include:
- The use case and which products need this component.
- The component's public API (props interface).
- Accessibility behavior: focus management, ARIA roles, keyboard navigation.
- Story in Storybook covering all states.
- No product-specific logic baked in (the component must be genuinely portable).

### IV.3 — Graduating app-local components

An app-local component may be proposed for graduation when:
- It has been stable for at least one month in the originating product.
- At least one other product team has expressed interest in using it.
- The proposing team is willing to own the migration of any product-specific assumptions out of the component.

Graduation process:
1. Open a PR moving the component to `packages/typescript/ui/src/` with the `design:graduate` label.
2. Ensure the component has no app-specific imports.
3. Add to the Storybook catalog and to `packages/typescript/ui/src/index.ts`.
4. Both the originating team and at least one `@letbuyy/ui` maintainer review.

### IV.4 — Deprecating shared components

Deprecating a Layer 1 component:
1. Add `warnDeprecated(symbolName, replacementName, sinceVersion)` to the component's export.
2. Keep the export for one major `@letbuyy/ui` version.
3. Provide a codemod in `packages/typescript/ui/codemods/` before announcing the deprecation.
4. Run the codemod across all apps.
5. Remove the component in the next major version after migration is confirmed by the `validate:design-system` gate.

Available codemods to model new ones after:
- `badge-danger-to-critical.cjs` — variant string rename.
- `data-table-to-table.cjs`, `index-table-to-table.cjs` — component name change.
- `page-aliases-to-canonical.cjs` — canonical name enforcement.
- `text-style-to-text.cjs` — API change migration.
- `token-alias-rename.cjs` — CSS variable rename.
- `tailwind-default-color-to-token.cjs` — class migration.

---

## Article V: Design Review Process

### V.1 — When design review is required

| Change type | Review required |
|-------------|----------------|
| New Layer 0 token | ARB async review |
| Modification of Layer 0 semantic token value | ARB synchronous review + visual audit |
| New Layer 1 component | `@letbuyy/ui` maintainer review |
| Breaking change to Layer 1 component API | `@letbuyy/ui` maintainer review + cross-app impact check |
| Graduation of app-local component | `@letbuyy/ui` maintainer review |
| New product-specific (Layer 2) pattern for a surface | Product team internal review |
| Changes to the tenant customization API | ARB review (security and accessibility implications) |
| New codemod | `@letbuyy/ui` maintainer review |

### V.2 — Required artifacts

For Layer 0 and Layer 1 changes, a pull request must include:
- Description of the change and why it belongs at this layer.
- Storybook stories demonstrating all states (including light and dark, compact and comfortable density where applicable).
- Accessibility notes: focus management, keyboard navigation, screen reader behavior.
- Migration notes if the change is breaking.

For Layer 2 product-specific changes, teams are encouraged to document patterns in the product's own design documentation but are not required to produce cross-team artifacts.

### V.3 — Auto-approved categories

The following changes are pre-approved and require only a standard code review:
- Fixing a bug in a Layer 1 component that does not change its public API.
- Adding a new story to Storybook for an existing component.
- Running and applying a codemod.
- Adding a new product-specific (Layer 2) component within the product's own directory.
- Updating documentation.

### V.4 — Who reviews

- **Layer 0 (token architecture):** Architecture Review Board (ARB). Async review for additions; synchronous for modifications.
- **Layer 1 (shared components):** At least one `@letbuyy/ui` maintainer outside the proposing team.
- **Layer 2 (product-specific):** Product team standard code review.
- **Tenant customization API:** ARB (accessibility and security implications).

---

## Article VI: Enforcement

### VI.1 — Automated enforcement gates

| Gate | What it catches | Severity | Where |
|------|----------------|----------|-------|
| `@letbuyy/ui/no-raw-elements` | Raw `<button>`, `<input>`, `<table>` in JSX | **Error** (blocks CI) | ESLint, per-app config |
| `@letbuyy/ui/no-hardcoded-hex` | Hardcoded `#RRGGBB` colors | **Error** (blocks CI) | ESLint, per-app config |
| `@letbuyy/ui/no-raw-form-controls` | Raw `<select>`, `<textarea>`, `<dialog>` in JSX | **Warning** (ratcheting) | ESLint, per-app config |
| `@letbuyy/ui/no-raw-color-functions` | Raw `rgb()` / `hsl()` | **Warning** (ratcheting) | ESLint, per-app config |
| `@letbuyy/ui/no-tailwind-default-color` | Tailwind default palette classes | **Warning** (ratcheting) | ESLint, per-app config |
| `validate:design-system` | `tsxArbitraryRadius`, `rawPxSpacing`, `rawPxFontSize`, `tsxInlineStyles`, `tsxRawHex`, `tailwindPaletteClasses`, `appCssNakedRgbHsl`, `DesignSystemRoot` in layouts, `theme="auto"`, legacy keys | **Ratchet** (counts may not increase) | CI + pre-commit |
| `validate:design-tokens` | `tokens.json` drift from `tokens.ts` | **Error** (blocks CI) | CI + pre-commit |
| `validate:mobile-tokens` | Flutter token drift | **Error** (blocks CI) | CI + pre-commit |
| `.stylelintrc.cjs` | Raw color in CSS files | Warn (when stylelint installed) | `pnpm lint:css` |

### VI.2 — The ratchet mechanism

The ratchet ensures that design system compliance is a one-way journey. The `validate:design-system` gate counts instances of each violation category. The counts are stored. On each CI run:
- If any count is **higher** than the stored count, the gate fails.
- If counts are equal or lower, the gate passes.
- Counts that reach zero are locked at zero.

This means teams can never "borrow" from the technical debt budget. A PR that adds three new `rawPxSpacing` instances while fixing two others still fails the gate (net increase of one).

### VI.3 — Penalty tiers

| Violation | Tier | Consequence |
|-----------|------|-------------|
| Error-level ESLint rule violated | Tier 1 | CI fails. PR cannot merge. |
| Ratchet count increases | Tier 2 | CI fails. PR cannot merge. Must fix or get an explicit exception. |
| Warning-level rule violated | Tier 3 | CI warns. PR can merge with documented justification in the PR description. The warning count is tracked; if a file's warning count grows across PRs, it is escalated to Tier 2. |
| `validate:design-tokens` drift | Tier 1 | CI fails. Run `generate-design-tokens.mjs` to fix. |

### VI.4 — Exception process

An exception to an error-level rule requires:
1. A comment in the code explaining why the exception is necessary (not "because it's hard").
2. An ESLint disable comment scoped to the minimum possible code range (line-level, not file-level).
3. A tracking issue with the label `design:exception` documenting the exception and the migration plan.
4. ARB acknowledgment for any exception that spans more than 10 instances.

Exceptions to the ratchet (i.e., deliberately increasing a count) are not permitted. The only path is forward.

---

## Article VII: Living Document

### VII.1 — How this constitution is updated

This document is living law but is not casually editable. Updates follow a tiered process:

| Amendment type | Process |
|---------------|---------|
| Clarification or editorial fix | PR with `design-constitution:editorial` label; standard review |
| New product surface added (new Layer 2 section) | PR with `design-constitution:new-surface` label; product team + ARB review |
| Layer 0 token architecture change | Constitutional amendment; full ARB review; requires documenting the rationale |
| Layer 1 ownership or governance change | Constitutional amendment; ARB review |
| Changes to the enforcement model | Constitutional amendment; ARB review |

### VII.2 — Versioning policy

This document follows semantic versioning:
- **Patch (1.0.x):** Editorial corrections, clarifications that do not change behavior.
- **Minor (1.x.0):** New sections (new surfaces, new token categories) that are additive and non-breaking.
- **Major (x.0.0):** Changes to the enforcement model, Layer 0 token architecture, or ownership model.

The version is in the document title. The changelog is maintained in a `DESIGN_CONSTITUTION_CHANGELOG.md` file in this directory.

### VII.3 — Conflict resolution

If this constitution conflicts with another document:
- The LETBUYY_CONSTITUTION.md (the supreme law) governs over this document. Where they conflict, the supreme law wins and this document must be amended.
- This document governs over all product team design decisions, ESLint config files, and informal style guides.
- This document governs over previously undocumented practice. Practice that predates this document is now governed by it.

If two teams have a genuine design system conflict that is not resolved by this document, it escalates to ARB. ARB's decision is recorded here as an amendment.

---

*This constitution was authored by the Design Governance Agent based on analysis of: `packages/typescript/ui/src/tokens.ts`, `packages/typescript/ui/src/deprecations.ts`, `packages/typescript/ui/eslint/index.cjs`, `packages/typescript/ui/codemods/`, `docs/ui-standards/`, `docs/design-system/`, `config/tailwind/letbuyy-tokens.css`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`. It codifies what exists and extends it into a coherent governance model.*
