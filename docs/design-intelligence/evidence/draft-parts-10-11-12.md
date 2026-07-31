# LetBuyy Design Intelligence Master Document
## Parts 10, 11, and 12
### Design Governance · Migration Strategy · Authoritative Decisions

**Document status:** Publication draft  
**Date:** 2026-06-19  
**Authority chain:** Subordinate to `LETBUYY_CONSTITUTION.md` (supreme law) → `LETBUYY_DESIGN_CONSTITUTION.md` → `DESIGN_GOVERNANCE_MODEL.md`  
**These parts synthesize:** LETBUYY_DESIGN_CONSTITUTION.md, DESIGN_GOVERNANCE_MODEL.md, DESIGN_MIGRATION_STRATEGY.md, IMPLEMENTATION_ROADMAP.md, DESIGN_SYSTEM_INVENTORY.md, TOKEN_INVENTORY.md

---

# PART 10: DESIGN GOVERNANCE

---

## 10.1 The LetBuyy Design Constitution (Condensed)

### The Governing Principle

The LetBuyy design system governs the technical foundation that makes a five-surface platform ecosystem hold together: the `--lb-*` token architecture, the shared interaction library, the per-surface design language boundaries, the tenant customization contract, and the enforcement and change-control processes for all of the above. It does not govern aesthetic decisions made within a permitted product design system, merchant storefront themes and their Liquid theme engine, mobile app implementations beyond token philosophy, content or copy decisions, or third-party marketplace submissions. The design system's mandate is precisely as large as needed to guarantee technical coherence and accessibility contracts across every surface — no larger.

---

### The Four-Layer Architecture (Binding)

#### Layer 0: Global Foundation

**Scope:** Every CSS custom property that any LetBuyy surface must share to remain technically coherent. This includes: the primitive color palette (`letbuyyPrimitiveTokens`); semantic color role tokens (`--lb-color-*`); the 12-step spacing scale (`--lb-space-0` through `--lb-space-11` plus named aliases); the radius scale (`--lb-radius-sm/md/lg/xl/full`); the typography scale (all `--lb-font-size-*`, `--lb-line-height-*`, and `--lb-font-weight-*` tokens); font family tokens (`--lb-font-family-body/display/mono`); motion tokens (`--lb-motion-*`, `--lb-ease-*`); breakpoints (`--lb-bp-xs` through `--lb-bp-xl`); z-index scale (`--lb-z-*`); shadow scale (`--lb-shadow-*`); density tokens (`--lb-density-*`); and size tokens (`--lb-size-*`). The DTCG interchange file `tokens.json` and the generated Dart file `letbuyy_tokens.dart` must remain in parity with the TypeScript source.

**Owner:** Platform team. Write access to `packages/typescript/ui/src/tokens.ts` and the Tailwind token layer.

**Change process:** All changes require Architecture Review Board (ARB) sign-off. Non-breaking additions (new tokens that pass the "every surface test") use async ARB review. Modifications to semantic role values or the primitive palette require synchronous ARB review plus a cross-app visual audit.

**Enforcement:** The `validate:design-tokens` gate (CI, required) enforces parity between `tokens.ts` and `tokens.json`. The `validate:mobile-tokens` gate enforces Dart parity. The `validate:design-system` ratchet catches downstream drift in consuming apps. The ESLint `no-hardcoded-hex` rule (error level) and `no-raw-color-functions` rule (warning, ratcheting) prevent bypassing the token layer at the application code level.

**Permitted exceptions:** None. Layer 0 has no exceptions. A token needed by only one product belongs in that product's Layer 2 namespace.

---

#### Layer 1: Shared Interaction Library

**Scope:** The behavioral contract layer. Every interactive pattern whose accessibility guarantees, focus management, keyboard navigation, theming behavior, and ARIA defaults must be identical across all product surfaces. This includes: all form controls (`Button`, `Input`, `Textarea`, `NumberField`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `ChoiceList`, `DatePicker`, `DateRangePicker`, `FilterChips`, `Tabs`, `SegmentedControl`); layout primitives (`Page`, `PageHeader`, `Section`, `Card`, `Box`, `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Text`, `Divider`); data components (`Table`, `DescriptionList`, `Pagination`, `MetricCard`, `Chart`, `ProgressBar`); feedback components (`Badge`, `Banner`, `EmptyState`, `Skeleton`, `Spinner`, `ToastProvider`/`useToast`, `SaveBar`, `StatusBadge`); overlays (`Modal`, `Drawer`, `Dropdown`, `DropdownMenu`, `Popover`, `Tooltip`, `ConfirmDialog`); shell and navigation (`AppFrame`, `Sidebar`, `Navigation`, `AppNavigation`, `Breadcrumbs`, `CommandPalette`, `Avatar`); and theme infrastructure (`LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `DensityToggle`, `DesignSystemRoot`).

**Owner:** `@letbuyy/ui` maintainers. Write access to `packages/typescript/ui/src/`.

**Change process:** Changes to component API, behavioral contracts, or ARIA defaults require a pull request reviewed by at least one `@letbuyy/ui` maintainer outside the proposing team. Breaking API changes additionally require a cross-app impact check. Bug fixes that do not alter public API are pre-approved and require only standard code review.

**Enforcement:** ESLint `no-raw-elements` rule (error level) blocks raw `<button>`, `<input>`, `<table>` in product JSX. ESLint `no-raw-form-controls` rule (warning, ratcheting) flags raw `<select>`, `<textarea>`, `<dialog>`. `warnDeprecated()` fires in non-production environments for any deprecated symbol. The ESLint plugin is self-tested by `packages/typescript/ui/eslint/rules.test.mjs`.

**Permitted exceptions:** A bug fix that changes visible behavior is not an exception — it is a patch. An exception requires an ESLint disable comment scoped to the minimum possible range, a code comment explaining the necessity, a tracking issue with the `design:exception` label, and ARB acknowledgment for any exception spanning more than 10 instances.

**Graduation path:** An app-local component may graduate to Layer 1 when it has been stable for at least one month, is needed by two or more products, has no product-specific assumptions, has accessibility test coverage, and is proposed via pull request with the `design:graduate` label reviewed by at least one `@letbuyy/ui` maintainer.

**Deprecation path:** Mark with `warnDeprecated(symbolName, replacementName, sinceVersion)`, retain the export for one major version, provide a codemod before announcing, run the codemod across all apps, remove in the next major version after the `validate:design-system` gate confirms zero remaining consumers.

---

#### Layer 2: Product Design Systems

**Scope:** Per-product visual language, typography expression, color palette extensions, component extensions, density defaults, and page layout conventions — within the bounds set by Layers 0 and 1.

**Owner:** Each product team owns its respective surface Layer 2.

**Change process:** Standard pull request review within the product team. New Layer 2 extension namespaces must be documented in `docs/design-system/product-extensions.md`.

**Enforcement:** ESLint rules from Layer 0 and Layer 1 apply in full. Layer 2 tokens must use product-scoped prefixes (`--mcp-*`, `--ops-*`, `--marketing-*`, `--storefront-*`). A product-scoped token must never appear in `packages/typescript/ui/src/`.

**What is permitted at Layer 2:** Additional color tokens under a product prefix; typography expression choices within the type scale; product-specific layout patterns and page templates; product-specific component compositions; density default overrides per surface; Layer 1 component extensions via props (never by copying source).

**What is prohibited at Layer 2:** Redefining any `--lb-*` Layer 0 token value; forking a Layer 1 component by copying and modifying its source; bypassing the `LetbuyyThemeProvider` theming model; hardcoding any color, spacing, or font size outside the token system.

**Permitted exceptions:** Same process as Layer 1 exceptions. All exceptions are tracked in the `design:exceptions-register` issue.

---

#### Layer 3: Tenant Customization

**Scope:** The runtime values that merchants may configure to make their storefront feel like their brand. The public API is `createLetbuyyBrandVariables(brand: LetbuyyBrandInput)`, which returns a `CssVariableMap` applied scoped to the tenant's storefront context.

**Owner:** Tenant (runtime). The API surface is owned by the Platform team.

**Change process:** Any change to the tenant customization API (`createLetbuyyBrandVariables`, `validateLetbuyyBrandContrast`, or the `LetbuyyBrandOverrides` type) requires ARB review due to accessibility and security implications.

**Enforcement:** `validateLetbuyyBrandContrast()` enforces WCAG AA contrast (4.5:1 for text, 4.5:1 for CTA text, 3:1 for focus ring) against a white background before any brand color is applied. No raw override of `--lb-*` tokens outside the declared brand override set is permitted at the tenant layer.

**What tenants may configure:** Primary brand color; the derived brand token set (`primary`, `primaryText`, `primaryHover`, `primaryActive`, `primarySubtle`, `primaryCta`, `primaryCtaHover`, `primaryCtaActive`, `primaryCtaText`, `focusRing`); font selection from a curated set; through the theme engine: layout structure, section ordering, color scheme, typography within permitted bounds.

**What tenants may not configure:** Focus ring contrast (minimum 3:1 is enforced); tap target minimum height of 44px; payment and trust indicator presentation; error and success state semantics in checkout.

**Permitted exceptions:** None at this layer. The WCAG minimum is constitutional and non-negotiable.

---

### The Surface System (Binding)

The `LetbuyySurface` type recognizes five values: `admin`, `marketplace`, `storefront`, `identity`, `operations`. Each surface is applied via the `data-letbuyy-surface` attribute on the `DesignSystemRoot` and influences surface-specific token resolution.

#### Admin Surface

**Represents:** The merchant control plane — the primary tool through which Indian small business owners manage their commerce operations.

**Apps:** `apps/merchant-control-plane`

**Permitted token overrides:** Surface tokens for `admin` (already defined in `letbuyySurfaceTokens`). Product-specific layout tokens under the `--mcp-*` prefix.

**Locked:** All Layer 0 semantic tokens. The `LetbuyyThemeProvider` configuration. The `AppNavigation` nav component (no manual active-state logic permitted). INR formatting via `formatInrCurrency`. Date formatting via `toLocaleDateString('en-IN')`.

---

#### Marketplace Surface

**Represents:** The app and theme marketplace for third-party integrations. Currently frozen; not an active deploy target.

**Apps:** `apps/app-marketplace`, `apps/theme-marketplace` (frozen)

**Permitted token overrides:** Marketplace-specific layout tokens. `--lb-size-marketplace-container` (1200px) governs the container width.

**Locked:** All Layer 0 semantic tokens. The `LetbuyyThemeProvider` configuration.

---

#### Storefront Surface

**Represents:** Each merchant's customer-facing storefront. The storefront must feel like the merchant's brand, not LetBuyy's. LetBuyy is infrastructure; it must be invisible to shoppers.

**Apps:** `apps/storefront-runtime`

**Permitted token overrides:** The full brand override set from `createLetbuyyBrandVariables` — `primary`, `primaryText`, `primaryHover`, `primaryActive`, `primarySubtle`, `primaryCta`, `primaryCtaHover`, `primaryCtaActive`, `primaryCtaText`, `focusRing`. Font selection from the curated set via the theme engine.

**Locked:** Focus ring minimum contrast (3:1, WCAG §1.4.11). Interactive element minimum tap target height (44px). Payment method logos and trust indicators. Error and success states in checkout. The `formatInrCurrency` function in checkout.

---

#### Identity Surface

**Represents:** The identity and authentication platform. Every interaction must project trust and security. This is the first and most trust-critical moment in every merchant's relationship with LetBuyy.

**Apps:** `apps/identity-platform`

**Permitted token overrides:** The `identity` surface variant, which applies the lavender/violet ink palette (`--lb-color-primary-*` resolved to violet values) scoped to `[data-letbuyy-surface="identity"]`. Auth-specific UI tokens under this selector.

**Locked:** All structural Layer 0 tokens. The `LetbuyyThemeProvider` configuration. `Button` and `Input` from `@letbuyy/ui` are mandatory in all auth flows; no raw HTML interactive elements.

---

#### Operations Surface

**Represents:** Dense, information-rich tooling for LetBuyy internal operators and platform administrators.

**Apps:** `apps/platform-console` (active), `apps/platform-operations-portal` (pending consolidation)

**Permitted token overrides:** Additional status tokens for system health and deployment state under the `--ops-*` prefix.

**Locked:** All Layer 0 semantic tokens. The surface defaults to `dark` theme; `defaultTheme` must be `dark` in the `LetbuyyThemeProvider` configuration for operations apps. The `spacious` density preset is not appropriate here.

---

### The Ratchet Contract

The ratchet is the constitutional guarantee that design system compliance is a one-way journey. The `validate:design-system` gate counts instances of each violation category across the codebase. On every CI run: if any count exceeds the stored baseline, the gate fails and the PR cannot merge. Counts that reach zero are locked at zero. No PR may increase any ratchet count, regardless of offsetting reductions elsewhere.

**The 7 ratchet categories:**

| Category | What it counts |
|---|---|
| `tsxArbitraryRadius` | Arbitrary `rounded-[...]` values in TSX files (e.g. `rounded-[8px]`, `rounded-[12px]`) |
| `rawPxSpacing` | Raw pixel values in spacing properties in TSX (e.g. `p-[16px]`, `mt-[12px]`) |
| `rawPxFontSize` | Raw pixel font-size values in TSX |
| `tsxInlineStyles` | Inline `style={{...}}` props in TSX files |
| `tsxRawHex` | Hardcoded hex color values in TSX files |
| `tailwindPaletteClasses` | Tailwind default palette utility classes (`bg-gray-*`, `text-gray-*`, `bg-white`, etc.) |
| `appCssNakedRgbHsl` | Raw `rgb()` and `hsl()` color functions in app CSS files not routed through `--lb-*` variables |

**The rule:** If a PR increases any ratchet count, CI blocks the merge. The only path is forward. Ratchet counts may not be increased to accommodate a feature or a deadline. Exceptions to the ratchet are not permitted under any circumstances — this is constitutional.

---

## 10.2 Token Governance

### Token Ownership Matrix

| Category | Prefix | Owner | Change Process | Breaking Change? |
|---|---|---|---|---|
| Primitive colors | `--lb-primitive-*` | Platform team | ARB required (sync for value changes, async for additions) | Yes — value changes affect every surface |
| Semantic colors | `--lb-color-*` | Platform team | ARB required | Yes — value changes affect every surface |
| Semantic aliases | `--lb-semantic-*` | Platform team | ARB required | Yes |
| Component tokens | `--lb-component-*` | `@letbuyy/ui` maintainers | PR review, maintainer approval | Potentially — depends on whether consuming code is explicit |
| Density tokens | `--lb-density-*` | `@letbuyy/ui` maintainers | PR review, maintainer approval | Yes for value changes; No for new density tiers |
| Spacing scale | `--lb-space-*` | Platform team | ARB required | Yes — value changes affect every layout |
| Radius scale | `--lb-radius-*` | Platform team | ARB required | Yes |
| Typography scale | `--lb-font-size-*`, `--lb-line-height-*`, `--lb-font-weight-*`, `--lb-font-family-*` | Platform team | ARB required | Yes |
| Motion tokens | `--lb-motion-*`, `--lb-ease-*` | Platform team | ARB required | No for additions; Yes for value changes |
| Z-index scale | `--lb-z-*` | Platform team | ARB required | Yes |
| Shadow scale | `--lb-shadow-*` | Platform team | ARB required | No for additions |
| Size tokens | `--lb-size-*` | Platform team | ARB required | Potentially |
| Breakpoints | `--lb-bp-*` | Platform team | ARB required | Yes — Tailwind breakpoints affect all responsive layouts |
| Product-specific | `--mcp-*`, `--ops-*`, `--marketing-*`, `--storefront-*` | Respective product team | Standard PR review | No — isolated to one surface |
| Tenant brand overrides | `--lb-color-primary-*`, `--lb-color-focus-ring` (overridable set only) | Tenant (runtime, via API) | Validated by `validateLetbuyyBrandContrast` | N/A — runtime only |

---

### Adding New Tokens: Step-by-Step

A new `--lb-*` token may be added to Layer 0 only if it passes the **every-surface test**: every LetBuyy web surface would plausibly use this token. If only one product needs it, it belongs in that product's Layer 2 namespace.

**Step 1:** Open a GitHub Issue with the label `design:token-proposal`. The issue must describe: the use case, which surfaces need this token, why no existing token meets the need, and the proposed CSS variable name following the `--lb-<category>-<role>` naming convention.

**Step 2:** ARB review. For non-breaking additions (new tokens that do not alter existing values), review is asynchronous and must conclude within 10 business days. For changes to semantic role values or the primitive palette, review is synchronous.

**Step 3:** Once ARB approves, add the token to `packages/typescript/ui/src/tokens.ts` in the appropriate tier object. Use the same value format as neighboring tokens (px integers, not unitless numbers; consistent light/dark pairing for color tokens).

**Step 4:** Run `node scripts/generators/generate-design-tokens.mjs --check` to verify the DTCG JSON is in parity. If the check fails, run without `--check` to regenerate, then commit `tokens.json`.

**Step 5:** Add the CSS variable emission to the appropriate emitter in `letbuyyTokenCssVariables`. Confirm the variable appears in the `letbuyyTokenCss` string output.

**Step 6:** If the token is a color, spacing, or typography token that should have a Tailwind utility alias, add it to `config/tailwind/letbuyy-tokens.css` under the `@theme {}` block.

**Step 7:** Update `docs/design-system/` documentation if a reference document covers that token category.

**Step 8:** Run `node scripts/validators/validate-design-system.mjs` and `node scripts/validators/validate-design-tokens.mjs` to confirm the gate is clean.

---

### Deprecating Tokens: Step-by-Step

Deprecating a Layer 0 token is a multi-step process with a mandatory migration window.

**Required deprecation period:** At least one major version of `@letbuyy/ui` between announcement and deletion.

**Step 1:** Open a tracking issue with the label `design:token-deprecation`. Document the old name, the replacement name, and the migration path. Post to the async design system office hours thread.

**Step 2:** Add the token name to `deprecatedTokenAliasVariables` in `packages/typescript/ui/src/tokens.ts`. This removes it from the emitted CSS on the next release. Consuming code that references the deprecated variable will silently resolve to the browser default (unset) — which is why the codemod must precede this removal in production timing.

**Step 3:** Add a replacement mapping to `packages/typescript/ui/codemods/token-alias-rename.cjs` following the existing pattern: `'--lb-old-name': '--lb-new-name'`.

**Step 4:** Announce the deprecation in the `@letbuyy/ui` package `CHANGELOG.md` entry for the version that removes the variable from CSS output. State: the old token name, the replacement, the version of removal, and the codemod command.

**Step 5:** Run the codemod across all apps in the monorepo:
```
node packages/typescript/ui/codemods/cli.mjs token-alias-rename apps/ --dry
# Review, then:
node packages/typescript/ui/codemods/cli.mjs token-alias-rename apps/
```

**Step 6:** Verify the migration is complete by running `pnpm --filter @letbuyy/ui lint` and confirming no remaining references to the deprecated variable name appear in any app.

**Step 7:** Lock the deprecated token at zero consumers in the ratchet baseline. The variable name is permanently deleted in the next major version.

**Codemod provision requirement:** A codemod mapping must be committed to `codemods/token-alias-rename.cjs` before the deprecation is announced. An announcement without a provided codemod is not compliant with this process.

---

### The Forbidden

The following actions are absolutely prohibited. Each has a specific enforcement mechanism.

| Prohibited action | Enforcement mechanism |
|---|---|
| Using a primitive token (`--lb-primitive-*`) in product code | Not directly enforced by a rule today, but explicitly prohibited. Any primitive reference in app code is a violation flagged during design review. Add a rule to the ESLint plugin if this pattern is detected in practice. |
| Using a deprecated token alias (`--lb-color-text-primary`, `--lb-color-danger`, etc.) | The variable is absent from the CSS output; the browser silently treats it as unset. Visual breakage is the enforcement. Run `token-alias-rename` codemod to fix. |
| Hardcoding a hex color in TSX | ESLint `no-hardcoded-hex` rule, error level. Blocks CI. PR cannot merge. |
| Using a raw `rgb()` or `hsl()` in app CSS without routing through a `--lb-*` variable | `appCssNakedRgbHsl` ratchet counter. If the count increases, CI blocks the PR. |
| Adding a `--lb-*` token without ARB review | No automated gate, but the PR will be rejected in code review. The `design:token-proposal` issue requirement creates a paper trail; PRs without a linked issue are rejected. |
| Resurrecting a deprecated token alias by re-adding it to the CSS output | Requires a change to `deprecatedTokenAliasVariables` in `tokens.ts`. Any such PR must go through ARB review. |
| Setting a `--lb-*` Layer 0 token value from product code (`style` prop or CSS override) | Detected by `tsxInlineStyles` ratchet (for style props) and `appCssNakedRgbHsl` ratchet (for CSS). Blocked if count increases. |
| Referencing a product-scoped token (`--mcp-*`, `--ops-*`) inside `packages/typescript/ui/src/` | Planned: `no-product-prefix-in-shared` ESLint rule. Until that rule exists, blocked in PR review. |

---

## 10.3 Component Governance

### Component Ownership Registry

| Component | Package / Location | Owner | Stable? |
|---|---|---|---|
| `Button` | `packages/typescript/ui/src/button.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Input`, `Textarea`, `NumberField`, `InlineError` | `packages/typescript/ui/src/input.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Table` | `packages/typescript/ui/src/table.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Modal`, `Drawer`, `Popover`, `Dropdown`, `DropdownMenu`, `Tooltip`, `ConfirmDialog` | `packages/typescript/ui/src/overlays.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Box`, `Card`, `Page`, `PageHeader`, `Section`, `Text`, `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Divider` | `packages/typescript/ui/src/layout.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Chart`, `DateRangePicker`, `DatePicker`, `SegmentedControl`, `DensityToggle`, `FilterChips`, `ProgressBar`, `DescriptionList`, `Disclosure`, `Accordion`, `Spinner` | `packages/typescript/ui/src/primitives.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Checkbox`, `ChoiceList`, `Combobox`, `Radio`, `Select`, `Switch`, `Tabs` | `packages/typescript/ui/src/controls.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Badge`, `StatusBadge`, `Banner`, `EmptyState`, `EmptyStateIllustration`, `SaveBar`, `Skeleton`, `ToastProvider`, `useToast` | `packages/typescript/ui/src/feedback.tsx` | `@letbuyy/ui` maintainers | Yes |
| `AppFrame`, `Navigation`, `Sidebar` | `packages/typescript/ui/src/app-shell.tsx` | `@letbuyy/ui` maintainers | Yes |
| `AppNavigation` | `packages/typescript/ui/src/navigation/app-navigation.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Avatar`, `CommandPalette`, `FilterBar`, `MetricCard`, `Pagination` | `packages/typescript/ui/src/productivity.tsx` | `@letbuyy/ui` maintainers | Yes |
| `Breadcrumbs` | `packages/typescript/ui/src/breadcrumbs.tsx` | `@letbuyy/ui` maintainers | Yes |
| `LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `ThemeToggleButton` | `packages/typescript/ui/src/theme-provider.tsx` | `@letbuyy/ui` maintainers (Platform team for architecture) | Yes |
| `InternalWorkspace`, `InternalPanel`, `InternalMetric`, `InternalModuleCard`, `InternalStatusPill`, `InternalEmptyDataState`, `InternalSkipBackendPanel` | `packages/typescript/ui/src/internal-workspace.tsx` | Platform team | Yes |
| `formatInrCurrency`, date formatters | `packages/typescript/ui/src/formatting.ts` | Platform team | Yes |
| All Lucide re-exports + `MaterialIcon` | `packages/typescript/ui/src/icons.tsx` | `@letbuyy/ui` maintainers | Yes |
| App-local UI components | `apps/<app>/src/_local-ui/` or `apps/<app>/src/components/` | Respective product team | Varies |

---

### Adding a New Component: Decision Tree

Before building a new component, answer these questions in order:

**Question 1: Does a component in `packages/typescript/ui/src/` already do this?**
Check `DESIGN_SYSTEM_INVENTORY.md` and the `component-catalog.stories.tsx`. Also query LCIS: `/api/search-v2?q=<component-name>`. If yes, use the existing component — extend it via props if needed, but do not fork it.

**Question 2: Does a component in an app's `_local-ui/` directory already do this?**
Check the app you are working in. If yes, use it. If it is useful in more than one app, that is a graduation candidate (see graduation process below).

**Question 3: Will this component be used in two or more product surfaces?**
If yes, it belongs in `packages/typescript/ui/src/` from the start. Follow the Layer 1 proposal process.
If no, build it in your app's local component directory. It is a Layer 2 component.

**Question 4: Is this component domain-specific to one product?**
If yes — it contains merchant-specific data shapes, India-specific compliance logic, or operations-specific state — it belongs in the product's `_local-ui/` and should not be promoted. Domain specificity is not a flaw; it is correct architecture.

**Proposal process for a new Layer 1 component:**

1. Open a pull request with the label `design:new-component`. The PR description must include: (a) the use case and which products need this component; (b) the component's TypeScript props interface with JSDoc for all required props; (c) accessibility behavior documentation covering focus management, keyboard navigation, and ARIA roles; (d) a Storybook story in `*.stories.tsx` covering all states including loading, empty, and error where applicable; (e) confirmation that the component has no product-specific imports or data shapes.

2. At least one `@letbuyy/ui` maintainer outside the proposing team reviews and approves.

3. The component is added to `packages/typescript/ui/src/` and exported from `index.ts`.

4. Confirm the component passes the graduation checklist (see §10.3 below).

---

### Component Graduation (App-Local to Shared Library): Process

An app-local component is a graduation candidate when all of the following are true:

- It has been stable in the originating app for at least one month without API changes.
- At least one other product team has expressed interest in using it.
- It has no app-specific imports (no imports from `apps/<app>/`, no hardcoded data from a specific API).
- The proposing team is willing to own the migration of any product-specific assumptions out of the component.

**Graduation process:**

1. Open a PR with the `design:graduate` label moving the component to `packages/typescript/ui/src/`. The PR description includes the graduation checklist items.

2. **Graduation checklist (every item must be checked):**
   - [ ] Supports both light and dark themes via `--lb-*` tokens (no hardcoded colors)
   - [ ] Has a Storybook story in `*.stories.tsx` covering all states
   - [ ] Has TypeScript props with JSDoc for all required props
   - [ ] Handles loading, empty, and error states if applicable
   - [ ] Uses `--lb-density-*` variables for size-sensitive dimensions
   - [ ] Passes `no-raw-elements` and `no-hardcoded-hex` ESLint rules internally
   - [ ] Has been tested at 360px viewport (mobile-first requirement)
   - [ ] Has no app-specific imports
   - [ ] Focus management is documented (or is not applicable)
   - [ ] Keyboard navigation is documented (or is not applicable)

3. Both the originating team and at least one `@letbuyy/ui` maintainer review and approve.

4. The component is added to `packages/typescript/ui/src/index.ts`.

5. The app-local version is replaced with the shared import. A codemod may be provided if the API changed during graduation.

**Who reviews:** The originating product team (owns the migration of assumptions) and at least one `@letbuyy/ui` maintainer (owns the shared library quality gate).

**Required tests:** Accessibility behavior. All states (loading, empty, error, populated). Both light and dark mode. Viewport at 360px.

**Migration management:** The originating team is responsible for updating all consumers of the app-local version after graduation. The `validate:design-system` gate confirms no remaining consumers of the old import path.

---

## 10.4 Design Review Process

### When Review IS Required

| Change type | Review type | Who reviews | Timeline |
|---|---|---|---|
| New Layer 0 token | ARB async | ARB | 10 business days max |
| Modification of Layer 0 semantic or primitive token value | ARB synchronous | ARB | Scheduled review session |
| New Layer 1 component | Maintainer PR review | At least one `@letbuyy/ui` maintainer outside proposing team | Standard PR cycle |
| Breaking change to Layer 1 component API | Maintainer PR review + cross-app impact check | At least one `@letbuyy/ui` maintainer | Standard PR cycle + impact audit |
| Graduation of app-local component to Layer 1 | Joint review | Originating team + at least one `@letbuyy/ui` maintainer | ~45 minute session |
| Changes to the tenant customization API (`createLetbuyyBrandVariables`, `validateLetbuyyBrandContrast`) | ARB review | ARB | Standard ARB cycle |
| New codemod | Maintainer PR review | At least one `@letbuyy/ui` maintainer | Standard PR cycle |
| New product-specific (Layer 2) surface definition | Product team + ARB acknowledgment | Product team owns; ARB acknowledges the new namespace | Standard PR + async ARB |
| Constitutional amendment to `LETBUYY_DESIGN_CONSTITUTION.md` | ARB | ARB + affected teams | Full ARB review cycle |

### When Review is NOT Required

The following changes are pre-approved and require only standard code review:

- Fixing a bug in a Layer 1 component that does not change its public API.
- Adding a new story to Storybook for an existing component.
- Running and applying an approved codemod.
- Adding a new product-specific (Layer 2) component within the product's own directory.
- Updating documentation.
- Adding icons to the Lucide re-export list.
- Fixing a ratchet violation (reducing a ratchet count).

### The Review Checklist

For Layer 0 and Layer 1 change PRs, the following artifacts are required:

- [ ] Description of the change and why it belongs at this layer (not a product-specific concern).
- [ ] Storybook stories demonstrating all states: default, loading, empty, error, disabled; light and dark mode; compact and comfortable density where applicable.
- [ ] Accessibility notes: focus management behavior, keyboard navigation, ARIA roles and labels.
- [ ] Migration notes if the change is breaking: list of consuming apps, codemod provided or not, timeline.
- [ ] The `validate:design-system` gate is green (no ratchet count increases).
- [ ] `pnpm --filter @letbuyy/ui test` passes.

For Layer 2 product-specific changes: standard code review. Documentation of the pattern is encouraged but not required as a cross-team artifact.

### What Can Be Auto-Approved

Auto-approval (merge without formal design review, standard code review only):

- All items in "When Review is NOT Required" above.
- Updating token documentation in `docs/design-system/`.
- Storybook additions for existing components.
- Running any of the seven existing codemods.
- Reducing any ratchet count in any app.

---

## 10.5 AI Agent Governance (Claude Code / Codex)

AI coding agents operating in this repository have binding rules identical to human engineers. The rules below are stated explicitly because AI agents cannot infer them from context; they must be stated as enumerated constraints.

### The Eight Binding Rules for AI Agents

**Rule 1: Always check the component catalog before proposing a new component.**

Before proposing to build any UI component, query LCIS: `curl "http://localhost:3333/api/search-v2?q=<component-description>"`. Then check `packages/typescript/ui/src/component-catalog.stories.tsx`. If a component already exists that meets the need (even partially), use it. Do not build a new component to avoid importing from `@letbuyy/ui`.

**Rule 2: Always use `--lb-*` tokens for color, spacing, radius, and shadow.**

Every color reference in TSX or CSS must use a `--lb-color-*` CSS variable or a Tailwind utility class that resolves to one (e.g. `bg-surface`, `text-default`, `border-line`). Every spacing value must use a `--lb-space-*` CSS variable or a Tailwind spacing utility that maps to the scale. Every border-radius must use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, or `rounded-full` — never `rounded-[Xpx]`. Every shadow must use `--lb-shadow-sm/md/lg`. Never hardcode `#hex`, `rgb()`, `hsl()`, or raw pixel values for these properties.

**Rule 3: Never import from `lucide-react` directly — always from `@letbuyy/ui`.**

```typescript
// WRONG
import { ArrowRight } from 'lucide-react'

// CORRECT
import { ArrowRight } from '@letbuyy/ui'
```

The `@letbuyy/ui` icon re-exports apply density-aware sizing and the `letbuyy-icon` class. Importing from `lucide-react` directly bypasses this and produces icons that do not respond to density changes.

**Rule 4: Never use arbitrary Tailwind values.**

```
// WRONG
className="p-[14px] mt-[20px] rounded-[8px] text-[13px]"

// CORRECT
className="p-3 mt-5 rounded-md text-secondary"
```

Arbitrary Tailwind values are caught by the ratchet (`rawPxSpacing`, `rawPxFontSize`, `tsxArbitraryRadius`). A PR that increases any of these counts fails CI.

**Rule 5: Never use raw Tailwind color utilities.**

```
// WRONG
className="bg-gray-100 text-gray-900 border-gray-200 bg-white"

// CORRECT
className="bg-surface text-default border-line bg-surface"
```

Tailwind default palette classes (`bg-gray-*`, `text-gray-*`, `bg-white`, etc.) are caught by the `tailwindPaletteClasses` ratchet. They do not switch in dark mode. Always use the token-backed Tailwind utility aliases from `config/tailwind/letbuyy-tokens.css`.

**Rule 6: Always use `formatInrCurrency` for Indian Rupee formatting.**

```typescript
// WRONG
`₹${amount}`
amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })

// CORRECT
import { formatInrCurrency } from '@letbuyy/ui'
formatInrCurrency(amount)
```

This is a platform requirement, not a style preference. `formatInrCurrency` from `@letbuyy/ui/formatting` is the only sanctioned INR formatter. Similarly, all dates must use `formatDisplayDate` or the `en-IN` locale: `toLocaleDateString('en-IN')`.

**Rule 7: Run `node scripts/validate-governance.mjs` after design system changes.**

After any change that touches `packages/typescript/ui/src/tokens.ts`, `config/tailwind/letbuyy-tokens.css`, any app's `globals.css`, or any TSX file in an active app, run the governance validator to confirm no ratchet counts have increased. A PR that fails the ratchet cannot merge.

```bash
node scripts/validate-governance.mjs
```

**Rule 8: Consult LCIS before scanning the repository.**

Before using `grep`, `find`, or `Read` to scan the repository for architecture questions, query LCIS first:

```
curl "http://localhost:3333/api/search-v2?q=<your-question>"
curl "http://localhost:3333/api/blast?q=<symbol>"
curl "http://localhost:3333/api/domain?key=<domain>"
```

Repository scanning is the final fallback when LCIS cannot answer.

---

### Design Pattern Reference for AI Agents

The gold standard compliant implementation for each pattern:

| Pattern | Gold Standard File |
|---|---|
| Product list page (Table, PageHeader, Badge, EmptyState) | `apps/merchant-control-plane/src/app/[store]/products/page.tsx` |
| Dashboard with MetricCards and charts | `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx` |
| Form page with Input, Select, SaveBar | `apps/merchant-control-plane/src/app/[store]/products/new/page.tsx` |
| INR currency formatting | Any file importing `formatInrCurrency` from `@letbuyy/ui` in merchant-control-plane |
| Auth/onboarding flow with Button and Input | `apps/identity-platform/src/app/onboarding/page.tsx` |
| Token-backed Tailwind usage | `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx` |
| Component deprecation with codemod | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` |
| Surface type with LetbuyyThemeProvider | `apps/merchant-control-plane/src/app/layout.tsx` |

The `governance.stories.tsx` file in `packages/typescript/ui/src/` documents every Do/Don't usage pattern with working code examples. Consult it before writing any design-system-touching code.

---

# PART 11: MIGRATION STRATEGY

---

## 11.1 Migration Philosophy

### Three Inviolable Rules

**Rule 1: Ship working code.**

Every migration change must ship code that builds, passes the ESLint gate, and renders correctly in both light and dark mode at 360px and 1280px. A PR that fixes a token violation but breaks a page layout is not a step forward — it is a regression. The migration is measured by net reduction in ratchet counts, not by PRs opened.

**Rule 2: Never break user flows.**

Payment, checkout, and auth flows are the last to touch in every migration wave — not because they are unimportant, but because they are the most important. The safest approach in a live platform is to prove the migration pattern on lower-risk surfaces first, then apply it where the stakes are highest. Every migration order in this strategy respects this principle: settings pages before list pages before detail pages before form pages before checkout, payment, and auth pages.

**Rule 3: Always have a rollback plan.**

Every migration PR is independently revertable. No PR should be structured so that reverting it breaks a subsequent PR. For CSS changes: reverting restores the previous CSS file (pure text; no database changes, no API changes, no generated output that must be cleaned up). For component swaps: reverting restores the previous TSX file. The dependency chain within each phase is linear for this reason: completing PR N does not make PR N-1 un-revertable.

### Migration Is Ongoing, Not a Project

The migration has no end date. The design system will continue evolving — new components will be added, tokens will be refined, surfaces will gain documented extensions. The migration is the permanent operational mode of a platform that takes its design system seriously. Phases 1 through 4 establish the foundation, CI enforcement, and product surface definitions. After that, maintaining compliance is a continuous engineering practice, not a project with a completion milestone.

---

## 11.2 Quick Wins (Under 1 Week, Near-Zero Risk)

These changes are mechanically safe, independently testable, and produce immediate measurable improvement in ratchet counts. Execute each as a separate PR. All can be executed in parallel by different engineers.

---

**QW-001: Run `tailwind-default-color-to-token` codemod on merchant-control-plane**

File: `apps/merchant-control-plane/src` (all 38 flagged files)

Change: Replace `bg-gray-*`, `text-gray-*`, `border-gray-*`, `bg-white`, and other neutral default palette classes with token-backed Tailwind utility aliases (`bg-surface`, `text-default`, `border-line`, `bg-surface-subdued`, etc.). The codemod handles only high-confidence neutral cases; colored palette classes are left for manual review.

```
node packages/typescript/ui/codemods/cli.mjs tailwind-default-color-to-token apps/merchant-control-plane/src --dry
# Review diff in browser (light and dark mode), then:
node packages/typescript/ui/codemods/cli.mjs tailwind-default-color-to-token apps/merchant-control-plane/src
```

Risk: Very Low. The codemod is conservative by design. The visual output is equivalent in light mode and correct in dark mode (which was previously broken for these classes).

Test: Render each page in both light and dark mode in the browser. Confirm no visual regression against baseline screenshots.

Time: 4 hours (dry run, review, commit, test).

---

**QW-002: Replace arbitrary border-radius in settings pages**

File: `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`, `settings/payments/page.tsx`, `settings/policies/page.tsx`, `settings/shipping/page.tsx`, `settings/taxes/page.tsx`, `settings/notifications/page.tsx`

Change: Search and replace all `rounded-[Xpx]` values with canonical radius tokens:
- `rounded-[4px]` → `rounded-sm`
- `rounded-[8px]` → `rounded-md`
- `rounded-[12px]` → `rounded-lg`
- `rounded-[16px]` → `rounded-xl`
- `rounded-[20px]` or larger pill shapes → `rounded-full`

Risk: Very Low. Visual change is sub-pixel for most users. Settings pages are low-traffic relative to core merchant flows.

Test: Render each settings page in both light and dark mode. Confirm button corners, card corners, and input corners appear correct.

Time: 2 hours.

---

**QW-003: Replace arbitrary border-radius in content pages**

File: `apps/merchant-control-plane/src/app/[store]/contact/page.tsx`, `comments/page.tsx`, `posts/page.tsx`, `gallery/page.tsx`, `testimonials/page.tsx`

Change: Same radius substitution as QW-002.

Risk: Very Low. These pages are not in critical merchant flows.

Test: Render each page in both themes. Same visual confirmation as QW-002.

Time: 1.5 hours.

---

**QW-004: Wire identity-platform CSS variables to `--lb-*` equivalents**

File: `apps/identity-platform/src/app/globals.css` (lines 5–33, the root variable definitions)

Change: Replace raw `rgb()` values in the local custom property definitions with references to `--lb-*` equivalents:
- `--bg: rgb(250 249 255)` → `--bg: var(--lb-color-bg)`
- `--text-primary: rgb(10 8 22)` → `--text-primary: var(--lb-color-text)`
- `--text-secondary: rgb(55 46 88)` → `--text-secondary: var(--lb-color-text-subdued)`
- `--border: rgb(224 216 248)` → `--border: var(--lb-color-border)`
- `--input-bg: rgb(255 255 255)` → `--input-bg: var(--lb-color-surface)`

Risk: Low. The `--lb-*` token values are equivalent in light mode. Test dark mode carefully.

Test: Render login, signup, and all three onboarding steps in both light and dark mode. Confirm visual parity against baseline screenshots.

Time: 3 hours.

---

**QW-005: Remove redundant `.dark {}` override block in identity-platform**

File: `apps/identity-platform/src/app/globals.css` (lines 35–44, the `.dark {}` block)

Change: Delete the `.dark {}` block that redefines the same local variables for dark mode. Once QW-004 is complete, this block is redundant — `--lb-*` tokens already resolve to the correct dark values via `[data-letbuyy-theme="dark"]` selectors in the token CSS.

Risk: Very Low. Dependent on QW-004 being merged and verified first. Do not merge this PR until QW-004 has been tested in production (or in staging) for at least one day.

Test: Toggle dark mode on every auth and onboarding page. Confirm the appearance is identical to before QW-005.

Time: 30 minutes (the change is a deletion).

---

**QW-006: Run the `badge-danger-to-critical` codemod across all apps**

File: All apps. The codemod targets `danger` variant string in `Badge` component usage.

Change: Rename the deprecated `danger` variant to `critical` in all Badge usages.

```
node packages/typescript/ui/codemods/cli.mjs badge-danger-to-critical apps/ --dry
# Review, then:
node packages/typescript/ui/codemods/cli.mjs badge-danger-to-critical apps/
```

Risk: Zero. Mechanical rename with a test fixture confirming the transform. The codemod has been validated.

Test: Confirm zero `badge danger` deprecation warnings in the browser console on any page that uses Badge.

Time: 1 hour.

---

**QW-007: Run the `page-aliases-to-canonical` codemod across all apps**

File: All apps. The codemod targets deprecated page layout alias components.

Change: Convert deprecated page layout alias components to their canonical names.

```
node packages/typescript/ui/codemods/cli.mjs page-aliases-to-canonical apps/ --dry
```

Risk: Zero. Mechanical rename with test fixture.

Test: Confirm zero page layout deprecation warnings in the browser console.

Time: 1 hour.

---

**QW-008: Resolve inline `style={{}}` usages in merchant-control-plane**

File: The 7 files in `apps/merchant-control-plane/src` that use inline `style={{}}` props.

Change: For each inline style occurrence:
- If the value is static (a fixed color, size, or spacing): convert to a Tailwind arbitrary property using `var(--lb-*)` reference (e.g. `style={{ color: '#6B7280' }}` → `className="text-[color:var(--lb-color-text-subdued)]"`).
- If the value is dynamic (computed from state or data — e.g. a progress percentage, a chart dimension): leave it and add an explanatory comment: `{/* dynamic: cannot use token — value computed from data */}`.

Risk: Low. Review each occurrence individually. Static styles are safe to migrate. Dynamic styles must not be changed.

Test: Visual comparison on each affected page. Dynamic elements (progress bars, chart dimensions, carousel positions) must still animate correctly.

Time: 3 hours.

---

**QW-009: Promote `no-tailwind-default-color` to `error` in merchant-control-plane**

File: `apps/merchant-control-plane/eslint.config.mjs`

Change: Change `"@letbuyy/ui/no-tailwind-default-color": "warn"` to `"@letbuyy/ui/no-tailwind-default-color": "error"`.

Risk: Very Low. Execute after QW-001 is merged. If any palette class violations remain after QW-001, they must be reviewed and resolved before this change lands.

Test: `pnpm --filter merchant-control-plane lint` exits clean with zero errors from this rule.

Time: 30 minutes (the change is one line).

---

**QW-010: Add `@letbuyy/ui` imports to merchant-control-plane pages using raw loading/empty/status patterns**

File: Pages in `apps/merchant-control-plane/src` that render custom loading spinners, blank empty states, or raw status text instead of `@letbuyy/ui` equivalents.

Change: For each target page, replace:
- Custom loading spinner → `<Skeleton>` (mirroring the page layout)
- Custom empty state div → `<EmptyState>` from `@letbuyy/ui`
- Hand-rolled status string → `<Badge>` or `<StatusBadge>` from `@letbuyy/ui`

Risk: Very Low when executed one page at a time. One component swap per page, one PR per 2–3 pages.

Test: Each page renders the correct skeleton on load, the correct empty state when data is absent, and the correct badge for status values.

Time: 2–4 hours per page, depending on complexity.

---

**QW-011: Wire marketing-site surface type**

File: `apps/marketing-site/src/app/layout.tsx`

Change: Confirm `LetbuyyThemeProvider` is configured with `surface="marketplace"` or an appropriate surface type. If not set, add it. This ensures the marketing site uses the correct surface token resolution for any shared components it does use.

Risk: Zero. Configuration only.

Test: Inspect the `data-letbuyy-surface` attribute in the browser DevTools. Confirm it matches the intended surface.

Time: 30 minutes.

---

## 11.3 30-Day Plan: Foundation Repair

**Objective:** Reduce the three worst ratchet counts, eliminate the identity-platform parallel CSS system, and establish zero new violations as the standard for incoming PRs.

### Week 1: Baseline establishment and codemods

**Day 1–2:** Run `node scripts/validators/validate-design-system.mjs` and record all current ratchet counts in `scripts/validators/design-ratchet-baseline.json`. Record ESLint violation counts per rule per app. Take visual baseline screenshots of all key pages at 360px and 1280px in light and dark mode.

**Day 3–5:** Execute QW-006 (badge-danger-to-critical) and QW-007 (page-aliases-to-canonical). These are zero-risk mechanical transforms. Merge same day. No visual review needed beyond confirming the console is warning-free.

**Day 6–7:** Execute QW-001 (tailwind-default-color-to-token on merchant-control-plane). Review the diff carefully in a browser before committing. Target: `tailwindPaletteClasses` ratchet count reduced by at least 60%.

**Week 1 success criteria:** Ratchet baseline established and committed. Console deprecation warnings cleared. `tailwindPaletteClasses` count reduced 60%+.

---

### Week 2: Radius repair and identity-platform CSS bridge

**Day 8–10:** Execute QW-002 (settings pages radius) and QW-003 (content pages radius). Confirm `tsxArbitraryRadius` count is below 95 from its 127 baseline.

**Day 11–13:** Execute QW-004 (identity-platform CSS bridge). This requires careful visual testing across all auth and onboarding screens. Test each state: login, signup, forgot password, onboarding step 1, onboarding step 2, onboarding step 3. Test both light and dark mode.

**Day 14:** Execute QW-005 (remove `.dark {}` override) immediately after QW-004 is confirmed clean.

**Week 2 success criteria:** `tsxArbitraryRadius` below 95. Identity-platform globals.css has zero raw `rgb()` values for semantically-named custom properties.

---

### Week 3: Inline style resolution and ESLint severity promotion

**Day 15–17:** Execute QW-008 (inline style resolution in merchant-control-plane). Each of the 7 files is reviewed individually. Static values are converted. Dynamic values are commented.

**Day 18–19:** Execute QW-009 (promote `no-tailwind-default-color` to `error` in merchant-control-plane). Verify the lint passes clean.

**Day 20–21:** Execute QW-010 for the three lowest-risk merchant-control-plane pages (those with clearly broken empty states or loading states that have no custom animation).

**Week 3 success criteria:** `tsxInlineStyles` count at 0 for static values in merchant-control-plane. `no-tailwind-default-color` at error level in merchant-control-plane.

---

### Week 4: Verification, documentation, and Phase 0 close

**Day 22–25:** Verify all ratchet counts against the baseline. Confirm all Phase 1 targets are on track. Resolve any regressions discovered in Weeks 1–3.

**Day 26–28:** Document the per-surface extension namespaces in `docs/design-system/product-extensions.md`. Document the tenant customization contract in `docs/design-system/tenant-customization.md`. Document the identity surface variant boundary.

**Day 29–30:** Open the `design:exceptions-register` GitHub Issue. Enumerate all existing ESLint disable comments in the codebase. This is the starting inventory for the exceptions tracking process.

**30-day success criteria:**
- [ ] `tsxArbitraryRadius` in merchant-control-plane: below 95 (from 127)
- [ ] `tailwindPaletteClasses` in merchant-control-plane: reduced by at least 60%
- [ ] `tsxInlineStyles` in merchant-control-plane: 0 for static values
- [ ] Identity-platform globals.css: zero raw `rgb()` values for semantically-named local custom properties
- [ ] Zero console deprecation warnings from `@letbuyy/ui` in any app
- [ ] No regressions against baseline visual snapshots
- [ ] Per-surface extension namespaces documented
- [ ] Exceptions register established

---

## 11.4 60-Day Plan: Token Adoption Acceleration

**Objective:** Drive merchant-control-plane token adoption from 39% to 50%+. Complete the identity-platform CSS architecture consolidation. Begin structured marketing-site structural token adoption. Target `tsxArbitraryRadius` below 50.

**Starting position:** All 30-day success criteria met.

### Week 5–6: merchant-control-plane complex pages and form control replacement

Execute the products page and products/new page arbitrary radius elimination (the two highest-traffic pages with the most complex UIs). This is medium complexity: the products page has a full-featured Table, filter bar, bulk actions, image thumbnails, and status badges. Execute in two PRs:

- PR A: Products list page (`products/page.tsx`) — classify every `rounded-[...]`, apply substitutions, visual review at 360px / 768px / 1280px in both themes.
- PR B: New product page (`products/new/page.tsx`) — same approach. Additional focus: confirm form submission still works after any component swaps.

In parallel: Begin replacing raw `<select>` and `<textarea>` elements in settings pages with `Select` and `Textarea` from `@letbuyy/ui`. Start with `settings/domains/page.tsx` and `settings/plan/page.tsx`. Test keyboard navigation and screen reader behavior after each replacement.

**Week 5–6 success criteria:** `tsxArbitraryRadius` below 50. `no-raw-form-controls` warnings in settings files: 0.

---

### Week 7–8: identity-platform CSS architecture consolidation and marketing-site structural tokens

Execute the identity-platform remaining local custom property consolidation. Map `--accent-cyan`, `--text-tertiary`, `--text-hint`, and `--primary-light` to `--lb-*` primitives. For any value that genuinely diverges from the existing `--lb-*` primitives (the lavender/violet ink palette), document it as an intentional identity-surface override and create the `[data-letbuyy-surface="identity"]` override selector in the token layer.

In parallel: Wire the marketing site typography to `--lb-font-family-*` tokens and the marketing site breakpoints to `--lb-bp-*` tokens. These are structural properties with no visual impact in most conditions — font family and breakpoints are already set to equivalent values.

**Week 7–8 success criteria:** Identity-platform globals.css has zero raw `rgb()` values not either going through a `--lb-*` variable or explicitly documented as identity-surface overrides. Marketing-site typography and breakpoints are wired to the token layer.

### 60-Day Success Criteria

- [ ] `tsxArbitraryRadius` in merchant-control-plane: below 50
- [ ] `no-raw-form-controls` warnings in settings files: 0
- [ ] Identity-platform globals.css: zero unexplained raw `rgb()` values
- [ ] Identity surface variant: boundary documented, override selector defined if needed
- [ ] Marketing-site typography and breakpoints: wired to token layer
- [ ] Merchant-control-plane component adoption: from 39% to 50%+

**Raising the merchant-control-plane adoption score from 7.5/10 to 9.0/10:** The adoption score reflects not just import presence but quality of usage. To reach 9.0/10 by day 60, the following must be true in addition to the above: (1) all settings pages have replaced raw form controls with `@letbuyy/ui` equivalents; (2) all pages that previously rendered custom loading or empty states now use `Skeleton` and `EmptyState`; (3) the `tailwindPaletteClasses` ratchet count has been eliminated entirely from merchant-control-plane; (4) no new `rounded-[...]` arbitrary values have been introduced since day 1.

---

## 11.5 90-Day Plan: Governance Infrastructure

**Objective:** Make governance automatic. Add the design validator as a required CI check. Formalize component graduation. Lock in the gains from Months 1 and 2 with machine enforcement.

**Starting position:** All 60-day success criteria met.

### Week 9–10: ESLint severity promotion across all apps

Promote `no-raw-color-functions` to `error` in merchant-control-plane. Prerequisite: complete enumeration and resolution of all existing `no-raw-color-functions` warnings. For each warning: if the value is a static color, replace with a `var(--lb-*)` reference; if the value is dynamic (computed color), document it and exempt with a scoped disable comment.

Promote `no-raw-color-functions` to `error` in identity-platform, contingent on the Month 2 identity CSS consolidation being stable.

Promote `no-tailwind-default-color` to `error` in identity-platform and storefront-runtime.

**Week 9–10 success criteria:** `no-raw-color-functions` at `error` in merchant-control-plane and identity-platform. `no-tailwind-default-color` at `error` in merchant-control-plane, identity-platform, and storefront-runtime.

---

### Week 11–12: CI integration and component graduation checklist

Add the design validator as a non-blocking reporting check in CI. On every PR, the validator runs and posts a comment showing before/after ratchet counts. The check does not yet fail the build — it reports only. After 2 weeks of clean reports (no new violations landing), promote to a blocking required check.

Add `COMPONENT_GRADUATION.md` to `packages/typescript/ui/`. Wire the graduation checklist as a PR template item for any PR that modifies `index.ts`.

Identify the first component graduation candidate: any app-local component that appears to be in use by two or more surfaces or that would clearly be useful across surfaces. Propose it for graduation.

Add a new surface type if the identity-platform CSS consolidation work confirms that the existing `identity` surface type requires a formalized override set in `tokens.ts`.

**Week 11–12 success criteria:** Design validator runs on every PR with a comment. Component graduation checklist documented. At least one graduation candidate identified.

### 90-Day Success Criteria

- [ ] Design validator is a required CI check (or is in the 2-week verification period before promotion)
- [ ] `no-raw-color-functions` at `error` in merchant-control-plane and identity-platform
- [ ] `no-tailwind-default-color` at `error` in merchant-control-plane, identity-platform, storefront-runtime
- [ ] Component graduation checklist in place and referenced in PR template
- [ ] Zero new design violations merged in the last 2 weeks of the phase
- [ ] If applicable: identity surface variant formalized in `tokens.ts`

---

## 11.6 6-Month Plan: Product Design System Maturity

**Objective:** Each product surface gets its own documented design language, not just implicit compliance. The design system becomes a productivity tool for new features, not just a constraint on old debt.

**Months 4–6 themes:** Merchant admin identity solidification. Identity platform surface variant formalization. Marketing site visual system boundary definition. Platform-wide component adoption above 75%.

### Month 4: Merchant Admin Identity Solidification

Complete merchant-control-plane arbitrary-radius elimination — all 127 instances across the full 100-file TSX tree, executed in 5 batches by section: settings pages (already done in months 1–2), list pages (orders, customers, coupons, reviews), detail and drawer pages, form pages, checkout and theme editor pages (last, highest risk).

Complete raw form control replacement in merchant-control-plane. The final target: `products/new/page.tsx` and `access_account/checkout/CheckoutClient.tsx` (executed last, with dedicated payment flow testing).

Raise merchant-control-plane component adoption to 70%+. Classify all remaining non-importing TSX files as UI or non-UI. For all UI files, identify the minimum `@letbuyy/ui` import that adds real value.

### Month 5: Identity Surface Variant and Marketing Site Visual System

If the Month 2 and Month 3 identity work identified divergent color values, formalize them as a `LetbuyySurface = 'identity'` override in `tokens.ts`. Identity platform uses `[data-letbuyy-surface="identity"]` and receives both the token system and its custom lavender/violet visual palette with zero custom property duplication. This is the ink-lavender formalization that makes the identity platform a first-class design system citizen.

Conduct a design sign-off session on the marketing site visual system scope. Define which properties are "platform structural" (adopt tokens) vs. "marketing identity" (stay custom). Write a signed `apps/marketing-site/DESIGN_SCOPE.md`. Execute the in-scope migrations: structural spacing, typography (already done), breakpoints (already done), and any additional structural properties approved in the sign-off.

### Month 6: Platform Governance Maturity

Complete platform-wide component adoption: classify all remaining non-adopting files across all active apps, migrate the in-scope UI files to `@letbuyy/ui` components. Target: platform-wide UI file component adoption rate above 75%.

Enforce CI blocking for all apps. The design validator is a required check with a maintained `scripts/validators/design-ratchet.json` baseline. The baseline can only be updated via a PR labeled `design-cleanup` with explicit maintainer review.

Publish the LetBuyy Design Governance Handbook. Consolidate all `docs/ui-standards/` and `docs/design-system/` documents into a navigable, versioned handbook covering: component graduation process, token naming conventions, migration patterns, app-specific identity guidance, and the onboarding path for new engineers.

### 6-Month Success Criteria

- [ ] Merchant-control-plane `tsxArbitraryRadius` count: 0
- [ ] Merchant-control-plane `no-raw-form-controls` warnings: 0
- [ ] Merchant-control-plane component adoption: 70%+
- [ ] Identity-platform surface variant: formalized in token layer
- [ ] Marketing site design boundary: documented and design-approved
- [ ] Platform-wide UI file component adoption: 75%+
- [ ] CI blocking enforcement: 4 consecutive clean weeks
- [ ] Design Governance Handbook: published and linked from the engineering onboarding

---

## 11.7 What NEVER to Rewrite in a Big-Bang Approach

The following must not be migrated in a single large PR or a coordinated freeze-and-rewrite. Each item has a specific reason.

**1. The `@letbuyy/ui` package's `index.ts` public API surface.**
Every active app imports from `@letbuyy/ui`. A reorganization of exports (moving components, renaming types, splitting the package) is a breaking change for every consumer simultaneously. Any such change must go through the codemod infrastructure and be applied incrementally, app by app, with each step verified before the next. Attempting a big-bang reorganization simultaneously with feature delivery will produce merge conflicts and regressions that are impossible to triage.

**2. The checkout and payment flows in merchant-control-plane.**
`apps/merchant-control-plane/src/app/[store]/access_account/checkout/` handles real merchant money. Any visual regression in this flow is a trust failure and a potential revenue loss. Migrate these files only in an isolated PR with dedicated payment flow testing after every other page in the app is clean and the patterns are proven. The ESLint error for raw elements will flag the violations here — acknowledge them, but do not fix them as part of a broader sweep.

**3. The marketing site's visual identity (gradients, hero colors, custom color system).**
The ~725 raw `rgb()` calls in `apps/marketing-site/src/app/globals.css` represent a deliberate visual identity, not careless debt. Replacing them en masse with `--lb-*` tokens without design sign-off would collapse the marketing site's brand expression. Structural tokens (font family, breakpoints, spacing scale) are in scope; visual identity tokens (background colors, gradient definitions, hero effects) are not in scope without an explicit design decision.

**4. The `letbuyy-tokens.css` `@theme` block variable names.**
`config/tailwind/letbuyy-tokens.css` is imported by every app's `globals.css`. A rename of any `@theme {}` variable name breaks the entire platform simultaneously — every `bg-surface`, `text-default`, and `border-line` class across all apps becomes invalid. This file's API surface should be treated as frozen. New utilities can be added; existing utilities cannot be renamed or removed without a platform-wide migration plan executed app by app.

**5. The deprecated token alias variable list in `tokens.ts`.**
The 11 deprecated aliases in `deprecatedTokenAliasVariables` must not be resurrected by re-adding them to the CSS output to "fix" a consumer. Doing so would silently undo the codemod migrations that have already been executed across the codebase and re-introduce ambiguity about which variable name is canonical. The correct fix for any consumer of a deprecated alias is to update the consumer.

**6. The `validate-design-system.mjs` ratchet baseline values.**
Resetting the ratchet baseline counts upward to "start fresh" is constitutionally prohibited. There is no legitimate reason to increase a baseline count. Increasing a baseline would allow new violations to enter the codebase disguised as compliance. Baselines may only decrease.

**7. The Flutter/Dart token generation in a web-only PR.**
`scripts/generators/generate-mobile-tokens.mjs` generates `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` from `tokens.json`. Any PR that modifies `tokens.ts` must also run the generator and commit the Dart output. A PR that changes web tokens without updating the Dart file will fail `validate:mobile-tokens`. However: a PR that modifies only the Dart token values directly (bypassing the generator) corrupts the parity model. Dart tokens are always generated, never hand-edited.

---

## 11.8 Risk Register

### Top 5 Migration Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Visual regression in a payment or auth flow during a migration sweep that includes those pages | Low (migration order explicitly defers these pages) | Critical (trust failure, potential revenue loss, blocked merchant) | Payment and auth flows are always last in every migration wave. Each of these pages gets an isolated PR with a dedicated review checklist and payment flow testing before merging. Any CI signal of a regression in these flows stops the phase immediately and escalates to engineering leadership. |
| The ratchet count for a category increases at the end of a phase due to a parallel feature branch merging between cleanup PRs | Medium (feature development continues during migration) | High (ratchet violation blocks the cleanup merge or requires immediate remediation) | Each cleanup PR must rebase on the latest main before merging to pick up any new violations from feature branches. Feature PRs that introduce new violations must fix them before merging — the `no-raw-elements` error and `no-hardcoded-hex` error gates already catch the worst cases at the PR level. |
| A codemod produces unexpected output on a file that has unusual patterns not covered by the transform's test fixtures | Low-Medium (codemods have test fixtures but real files have edge cases) | Medium (incorrect transform produces a visual regression or a build failure) | Always run codemods with `--dry` first and review the diff in the browser before committing. Never run a codemod on more than 20 files in a single PR without reviewing at least a 10% sample. If a codemod touches a file incorrectly, revert that file and add a test case to the codemod. |
| The marketing-site visual identity migration removes distinctive visual properties that differentiate the brand, reducing conversion | Medium (the boundary between "structural" and "identity" is subjective until documented) | High (acquisition funnel regression; reduced merchant signups) | Do not touch any visual identity property (color, gradient, shadow, typographic hierarchy) without explicit written design sign-off. Structural tokens only until Month 5's design boundary document is produced and approved. A/B test any significant visual change before fully deploying. |
| Adding the design validator as a required CI check creates flakiness that blocks unrelated PRs | Low-Medium (determinism depends on excluding generated/vendor files correctly) | Medium (developer trust in CI degrades; gate is disabled or ignored) | Run the validator in non-blocking reporting mode for 2 full weeks before promoting to required. If the validator produces false positives (counting generated files, vendor code, or intentional patterns), fix the exclusion list before promoting. Maintain the ratchet baseline in `scripts/validators/design-ratchet.json` with explicit change control — only updated via `design-cleanup` PRs. |

---

# PART 12: AUTHORITATIVE DECISIONS

These are platform-level design decisions. They are decisions, not recommendations. They apply to all code written for LetBuyy web surfaces unless an exception process documented in Part 10 has been completed and the exception is tracked.

---

## 12.1 ACCEPTED

Patterns that are correct and must be continued.

**A-01: The `--lb-*` CSS variable naming prefix for all Layer 0 tokens.** The prefix is unambiguous, collision-resistant, and consistent across 330+ custom properties. It must continue for all new tokens.

**A-02: The four-tier token hierarchy (Primitive → Semantic → Component → Density).** The hierarchy is sound. Primitive values are private; semantic roles are the primary consumption layer; component tokens allow component-specific refinement; density tokens allow layout density control without CSS rewriting. This hierarchy must not be flattened.

**A-03: The Tailwind v4 semantic utility alias layer in `config/tailwind/letbuyy-tokens.css`.** The aliases (`bg-surface`, `text-default`, `border-line`) make the token system ergonomic for day-to-day TSX authoring without losing semantic correctness. This layer must continue and expand as new token categories are added.

**A-04: Single `LetbuyyThemeProvider` per app.** One provider, one theme context, one flash-prevention script. The current model is correct and must not be split into multiple providers or contexts within a single app.

**A-05: The `data-letbuyy-theme` / `data-letbuyy-surface` / `data-letbuyy-density` attribute system.** These data attributes are the correct mechanism for cascading theme, surface, and density state through the DOM. `OverlayPortal` correctly mirrors them onto portal containers. This pattern must continue.

**A-06: The `OverlayPortal` pattern for all overlays.** All overlays (Modal, Drawer, Popover, Dropdown, Tooltip) portal to `<body>` via `OverlayPortal`, which mirrors the design system context attributes. This prevents dark-mode cascade mismatch and z-index stack conflicts. No app should build its own overlay mechanism.

**A-07: `formatInrCurrency` from `@letbuyy/ui` as the sole INR formatter.** This is an India-first platform. There is one correct way to format Indian Rupees and it is this function. All monetary display in every LetBuyy surface (not just merchant-control-plane) uses this function.

**A-08: `en-IN` locale for all date formatting.** All dates displayed to merchants and in operational UI use `toLocaleDateString('en-IN')` or the `formatDisplayDate`/`formatIndiaDate` functions from `@letbuyy/ui/formatting`. No dates are formatted in US locale for Indian users.

**A-09: The density system (compact / comfortable / spacious) with `compact` as the platform default.** The three-tier density system with `compact` as the default is the correct choice for an information-dense merchant tool. The `spacious` preset is available via `DensityToggle`; the operator-facing surfaces (platform-console) must not use `spacious` as a default.

**A-10: The codemod infrastructure in `packages/typescript/ui/codemods/`.** Having a CLI runner (`codemods/cli.mjs`) with dry-run support, test fixtures, and a growing library of transforms is the correct approach to token and component migrations. Every breaking change to a shared token or component must have a codemod before deprecation is announced.

**A-11: `warnDeprecated()` for non-production console warnings.** The deprecation system is correct. Consuming apps must not silence `warnDeprecated` warnings — they are the signal that a migration is due.

**A-12: WCAG contrast validation for tenant brand overrides.** The `validateLetbuyyBrandContrast()` function before applying any merchant brand color is non-negotiable. This protects shoppers with visual impairments who are the end users of merchant storefronts.

**A-13: Mobile-first breakpoints starting at `xs: 360px`.** The canonical smallest breakpoint is 360px, not 320px or 375px. This reflects the India-first constraint: 360px Android devices are the target device for both merchants and shoppers.

**A-14: The ratchet enforcement model.** The combination of per-category violation counts with a "may only decrease" rule is the correct mechanism for managing technical debt in a live codebase. It prevents the common failure mode of cleaning up violations in one place while introducing them in another.

**A-15: DTCG `tokens.json` parity checking in CI.** The `tokens.json` interchange file and the Dart `letbuyy_tokens.dart` must always be in sync with the TypeScript source. The parity checks are non-negotiable CI gates.

---

## 12.2 PROHIBITED

Patterns that are forbidden, with specific enforcement for each.

**P-01: Hardcoded hex colors in TSX or app CSS.**  
Enforcement: ESLint `no-hardcoded-hex` (error, CI blocking) for TSX. `appCssNakedRgbHsl` ratchet for CSS. No exceptions without an ARB-approved tracking issue.

**P-02: Raw `<button>`, `<input>`, `<table>`, `<select>`, `<textarea>`, `<dialog>` in product JSX.**  
Enforcement: ESLint `no-raw-elements` (error, CI blocking) for buttons/inputs/tables. ESLint `no-raw-form-controls` (warning, ratcheting) for select/textarea/dialog. The migration plan for existing violations is in Part 11.

**P-03: Importing from `lucide-react` directly in product code.**  
Enforcement: No automated gate today. Enforced in code review. All icon imports must be from `@letbuyy/ui`. The correct import is `import { IconName } from '@letbuyy/ui'`.

**P-04: Arbitrary Tailwind values for spacing, radius, or font size.**  
Enforcement: `tsxArbitraryRadius`, `rawPxSpacing`, `rawPxFontSize` ratchet counters. A PR that increases any of these counts fails CI.

**P-05: Tailwind default palette utility classes.**  
Enforcement: `tailwindPaletteClasses` ratchet counter. ESLint `no-tailwind-default-color` (warning, ratcheting; error in merchant-control-plane after QW-009 lands). Use the semantic utility aliases from `letbuyy-tokens.css` instead.

**P-06: A second `ThemeProvider` or theme context in any app.**  
Enforcement: Code review. There is exactly one `LetbuyyThemeProvider` per app. Any PR that introduces a second theme context is rejected.

**P-07: Hand-rolled flash-prevention scripts.**  
Enforcement: Code review. Flash prevention is `<ThemeScript>` in `<head>`. No app may write its own flash-prevention script.

**P-08: Referencing deprecated token aliases.**  
Enforcement: The deprecated variables are absent from the CSS output. Visual breakage is the hard enforcement. The soft enforcement is the `warnDeprecated()` console warning. Run `token-alias-rename` codemod to fix.

**P-09: Forking a Layer 1 component by copying and modifying its source.**  
Enforcement: Code review. If a product needs a different behavior, it extends via props or proposes a change to the shared component. Source forking doubles the maintenance burden and breaks the behavioral contract.

**P-10: Using `theme="auto"` prop on `LetbuyyThemeProvider`.**  
Enforcement: `validate:design-system` gate checks for this. The prop does not exist in the current API and must not be added.

**P-11: Using legacy localStorage theme keys (`letbuyy_theme`, `theme`, `theme-marketplace-theme`).**  
Enforcement: `validate:design-system` gate checks for these. The correct key is `LETBUYY_THEME_STORAGE_KEY` from `@letbuyy/ui`.

**P-12: Increasing any ratchet count.**  
Enforcement: The ratchet gate. This is constitutional. No exceptions, no exceptions process. If a new feature introduces a violation, the violation must be fixed or the feature must be redesigned.

**P-13: Product-scoped token prefixes (`--mcp-*`, `--ops-*`) in `packages/typescript/ui/src/`.**  
Enforcement: Planned `no-product-prefix-in-shared` ESLint rule. Currently enforced in code review. Product-specific tokens belong in their product's CSS, not in the shared library.

**P-14: Modifying `letbuyy_tokens.dart` directly (bypassing the generator).**  
Enforcement: The file contains a `// GENERATED FILE — DO NOT EDIT` header. Code review. Any PR that hand-edits the Dart file is rejected. Run `node scripts/generators/generate-mobile-tokens.mjs` to regenerate.

**P-15: Resurrecting deprecated token aliases by re-adding them to the CSS output.**  
Enforcement: The `deprecatedTokenAliasVariables` list in `tokens.ts` requires ARB review to modify. Any PR that removes a token from the deprecated list is rejected unless it is part of a formally-approved un-deprecation decision.

---

## 12.3 ENCOURAGED

Patterns that are correct and should spread platform-wide.

**E-01: `DesignSystemRoot` inspection for theming in new layouts.** Before adding `LetbuyyThemeProvider` to a new app or layout, verify the configuration matches the surface type, density default, and `defaultTheme` for that surface. The platform-console defaults to `dark`; all other web surfaces default to `system`.

**E-02: `StatusBadge` as the canonical status-to-badge mapper.** Instead of mapping order status strings to badge variants locally in each page, use `StatusBadge` from `@letbuyy/ui`. It is the platform's canonical status vocabulary. Adding it to a page removes local mapping logic and ensures consistent status presentation across the merchant control plane.

**E-03: The `SaveBar` component for unsaved-changes surfaces.** Any page that has editable form state should display `SaveBar` whenever unsaved changes exist. This is the canonical merchant UX pattern for the admin surface.

**E-04: `EmptyState` with a primary action for every list view.** Every list page (products, orders, customers, coupons) must show `EmptyState` when the list is empty, and the empty state must include a primary action that teaches the merchant the next step. A blank empty list is a merchant experience failure.

**E-05: `Skeleton` mirroring the layout for loading states.** Loading states use `Skeleton` components arranged to mirror the expected layout. Never use a centered spinner for a full-page load. The Skeleton gives merchants context and reduces perceived load time.

**E-06: `ConfirmDialog` for all destructive actions.** Every action with irreversible consequences (deleting a product, canceling an order, removing a team member) must present a `ConfirmDialog` that explains the consequence before executing. Never make destructive actions one-click.

**E-07: One primary action per screen in merchant-control-plane.** Every page in the merchant admin has exactly one visually primary action (`Button` with `variant="primary"` or the `SaveBar` primary button). Multiple primary buttons on one screen dilute the merchant's decision clarity.

**E-08: The token-backed Tailwind utility aliases for all structural properties.** `bg-surface`, `text-default`, `border-line`, and their cousins from `letbuyy-tokens.css` should be the first-choice Tailwind utilities for background, text, and border colors. They are semantic, they switch correctly in dark mode, and they respond to surface type changes.

**E-09: `AppNavigation` for all admin-shell navigation.** As merchant-control-plane migrates to `AppNavigation`, all new navigation items should be added to the data-driven navigation config rather than as new sidebar items in `_local-ui/`. `AppNavigation` handles active state, keyboard navigation, and density automatically.

**E-10: Product-scoped token prefixes for product-specific color and layout extensions.** `--mcp-*` for merchant-control-plane, `--ops-*` for operations, `--marketing-*` for marketing site. When a product needs a value that is not in the Layer 0 vocabulary, use this namespace rather than a raw hex value or an inlined pixel value.

**E-11: Querying LCIS before any repository grep.** For architecture questions about what breaks if X changes, who owns X, what tables touch X, or where X is implemented: query `http://localhost:3333/api/...` first. One API call costs less than a full repository scan and produces a structured answer.

**E-12: Batch-by-section approach for large migration waves.** When migrating many files (the 127 arbitrary-radius instances, the 38 files with palette class violations), execute in batches by product section. Each batch is one PR covering 5–8 files in a single logical section (settings, lists, detail pages). This makes each PR independently reviewable and independently revertable.

---

## 12.4 MUST MIGRATE

Patterns that are present in the codebase and will be migrated — not rewritten from scratch, but incrementally corrected according to the Phase 1–4 roadmap. Each item is categorized by priority (P1/P2/P3) and effort.

**M-01: 127 arbitrary border-radius instances in merchant-control-plane. Priority: P1. Effort: High.**
Migrate over 5 batches (settings → list pages → detail/drawer → form pages → checkout/theme-editor). Each batch is an independent PR. Target: `tsxArbitraryRadius` count to 0 by end of Month 4.

**M-02: Identity-platform parallel CSS custom property system. Priority: P1. Effort: Medium.**
Wire local variables (`--bg`, `--text-primary`, `--border`, etc.) to `--lb-*` equivalents. Remove the redundant `.dark {}` override block. Document any genuinely divergent identity-surface values as intentional `[data-letbuyy-surface="identity"]` overrides. Target: complete by end of Month 2.

**M-03: 38 files in merchant-control-plane using Tailwind default palette classes. Priority: P1. Effort: Low (codemod).**
Run `tailwind-default-color-to-token` codemod. Review manually for any colored (non-neutral) palette classes that require intent review. Target: `tailwindPaletteClasses` count to 0 by end of Month 2.

**M-04: 7 files in merchant-control-plane with inline `style={{}}` props. Priority: P2. Effort: Low.**
Classify each as static (migrate to Tailwind utilities) or dynamic (leave and document). Target: static `tsxInlineStyles` count to 0 by end of Month 1.

**M-05: Raw `<select>` and `<textarea>` elements in merchant-control-plane form pages. Priority: P2. Effort: Medium.**
Replace with `Select` and `Textarea` from `@letbuyy/ui`. Start with settings pages, then domain management components, then the new product page. Save the checkout flow for last. Target: `no-raw-form-controls` warnings to 0 by end of Month 4.

**M-06: Marketing-site structural properties (font family, spacing, breakpoints) not yet using token layer. Priority: P2. Effort: Low.**
Wire `--lb-font-family-*`, `--lb-space-*`, and `--lb-bp-*` to the marketing site's structural property declarations. Do not touch any visual identity property (colors, gradients, hero effects) without design sign-off. Target: structural tokens wired by end of Month 2.

**M-07: Marketing-site visual identity (725 raw rgb() calls in globals.css). Priority: P3. Effort: High.**
This migration is subject to a design sign-off on scope (Month 5). Only the properties approved in the design boundary document (`apps/marketing-site/DESIGN_SCOPE.md`) are in scope for migration. Target: in-scope properties migrated by end of Month 6; out-of-scope properties remain intentionally as-is.

**M-08: Merchant-control-plane navigation from legacy sidebar patterns to `AppNavigation`. Priority: P2. Effort: Medium.**
The `navigation.md` doc identifies this as pending. Migrate merchant-control-plane sidebar navigation to `AppNavigation`. This removes manual `pathname ===` active-state comparisons and aligns with the shared navigation primitive. Target: complete by end of Month 4.

**M-09: Deprecated token aliases (11 total) still potentially referenced in any remaining unconverted files. Priority: P1. Effort: Low (codemod).**
Run `token-alias-rename` codemod across all apps. Verify all 11 deprecated aliases have zero remaining consumers. Lock them at zero in the ratchet baseline. Target: complete by end of Month 1.

**M-10: Dart/Flutter dark palette parity gap (gray/slate vs. ink). Priority: P3. Effort: Low-Medium.**
The Flutter `letbuyy_tokens.dart` uses `gray900`/`slate700` for dark mode backgrounds instead of the violet-tinted `ink` palette used on web. This produces visually different dark modes across platforms. Align the Dart token generator to use the ink palette values. Target: addressed in a future version of the mobile generator; not in the 6-month web migration scope.

---

## 12.5 APP-SPECIFIC

Patterns that differ by app and that is correct. Do not standardize these.

**AS-01: Default theme per app.**
- `platform-console`: `defaultTheme="dark"` — correct. Operations tooling defaults to dark mode.
- All other web apps: `defaultTheme="system"` — correct. Merchant and shopper surfaces follow the OS preference.
This difference is intentional and must not be harmonized to a single value.

**AS-02: Density default per surface.**
- Merchant-control-plane (`admin` surface): `compact` — correct. Information density is appropriate for a tool merchants use daily.
- Marketing site: Density system does not apply — correct. Marketing pages are not governed by the density system.
- Operations surfaces: `compact` — correct. The `spacious` preset is not appropriate for operator tooling.
This difference is intentional.

**AS-03: Marketing site visual identity.**
The marketing site's use of custom colors, gradients, Framer Motion, Lenis smooth scroll, and a fluid display typography scale is intentional brand expression. These are not violations. The marketing site does not and should not look like the merchant admin.

**AS-04: Storefront runtime's React/Liquid hybrid architecture.**
The storefront runtime is not Liquid-only. Liquid canary mode is OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`). React-rendered routes inherit `--lb-*` Layer 0 tokens; Liquid-rendered routes are governed by the theme engine. This dual-mode architecture is intentional and correct.

**AS-05: The identity platform's lavender/violet ink palette.**
The auth and onboarding pages use a lavender/violet-tinted visual identity that is deliberately different from the merchant admin's neutral-purple palette. This is not a violation of the design system — it is an intentional identity-surface visual language. It will be formalized as a `[data-letbuyy-surface="identity"]` override in Month 5. Until then, the local variables that bridge to `--lb-*` tokens are acceptable.

**AS-06: Internal workspace components for platform-console.**
The `InternalWorkspace`, `InternalPanel`, `InternalMetric`, and related components are specific to platform-console's internal dashboards. They have no consumer-facing equivalent and must not be generalized. They are correctly scoped to `apps/platform-console`.

**AS-07: Marketing-site Lucide icon imports (icons only, no component imports).**
The marketing site currently imports only icon re-exports from `@letbuyy/ui` (e.g. `ArrowRight`, `Zap`). This is correct. The marketing site must not import merchant-admin components (`Card`, `Table`, `PageHeader`) — they carry the admin visual language and density system, which conflict with the marketing site's intentional design. Maintain this import boundary.

**AS-08: Storefront runtime's `createLetbuyyBrandVariables` brand override pattern.**
The storefront applies tenant brand colors via `createLetbuyyBrandVariables` scoped to the tenant's storefront context. This is the only surface where `--lb-color-primary-*` tokens are overridden at runtime. This pattern is correct and specific to the storefront surface. It must not be applied in merchant-control-plane or identity-platform.

---

## 12.6 GLOBALLY STANDARDIZED

Patterns that must be identical across every app, with no exceptions.

**GS-01: The `--lb-*` token prefix for all Layer 0 CSS custom properties.**
Every Layer 0 CSS custom property in every LetBuyy surface uses the `--lb-*` prefix. There are no surface-specific Layer 0 token prefixes. The prefix is platform-wide.

**GS-02: Semantic color token consumption (never primitive tokens in product code).**
Every reference to a color in product code (TSX, CSS, inline) must use a semantic `--lb-color-*` token, not a primitive `--lb-primitive-color-*` token, not a raw hex value, not a Tailwind default palette class. This applies to all five surfaces without exception.

**GS-03: `formatInrCurrency` for all monetary display.**
Every monetary value displayed to any user in any LetBuyy surface uses `formatInrCurrency` from `@letbuyy/ui`. There is no surface-specific money formatter.

**GS-04: `en-IN` locale for all date display.**
Every date displayed to any user in any LetBuyy surface uses `en-IN` locale. There is no surface-specific date locale.

**GS-05: The DTCG `tokens.json` parity with `tokens.ts`.**
The DTCG interchange file and the TypeScript source are always in parity. `validate:design-tokens` enforces this on every PR. No surface or team has an exception.

**GS-06: Dart `letbuyy_tokens.dart` generated from `tokens.json`, never hand-edited.**
The Dart token file is always the output of the generator. No surface, team, or individual may hand-edit it.

**GS-07: The ratchet baseline may only decrease.**
This applies to every app, every surface, every team. There is no exception process for increasing ratchet counts. This is constitutional.

**GS-08: The WCAG contrast minimum for tenant brand colors.**
`validateLetbuyyBrandContrast()` runs before applying any merchant brand color. This applies across all surfaces where brand overrides are possible. The WCAG minimums (4.5:1 for text, 3:1 for focus ring) are absolute.

**GS-09: Accessibility minimum tap target size of 44px height for interactive elements.**
Every interactive element in every LetBuyy surface has a minimum tap target height of 44px. This applies to all surfaces including the storefront (where tenant theme styles are applied). This minimum is enforced through the Layer 1 `Button`, `Input`, and control components, which use `--lb-density-button-height` (36px in compact, 40px in comfortable, 44px in spacious — all at or above 36px minimum; comfortable mode meets the 44px target at its default). Density-specific enforcement: comfortable and spacious modes meet 44px; compact mode (36px button height) is permitted for information-dense admin tooling where the user is a trained daily user, not a one-time visitor.

**GS-10: The z-index stack using `--lb-z-*` tokens.**
Overlay stacking order is managed exclusively through the `--lb-z-*` token scale (dropdown: 30, sticky: 40, overlay: 50, modal: 60, toast: 70, tooltip: 80). No surface may introduce a custom z-index value outside this scale for shared UI concerns. Product-specific z-index values within a surface's own layout (not overlapping shared overlay components) may use product-scoped tokens.

**GS-11: The flash-prevention mechanism using `ThemeScript`.**
Every app that uses `LetbuyyThemeProvider` includes `<ThemeScript />` in the `<head>` of its HTML document. No surface hand-rolls a flash-prevention script.

**GS-12: ESLint `@letbuyy/ui/recommended` configuration in all active apps.**
All active apps (`merchant-control-plane`, `identity-platform`, `marketing-site`, `storefront-runtime`, `platform-console`) use the `@letbuyy/ui/recommended` ESLint configuration. The `no-raw-elements` (error) and `no-hardcoded-hex` (error) rules are active in all apps. There are no surfaces that operate without these gates.

---

*End of Parts 10, 11, and 12.*

*These parts are subordinate to: `LETBUYY_CONSTITUTION.md` (supreme law) → `LETBUYY_DESIGN_CONSTITUTION.md` → `DESIGN_GOVERNANCE_MODEL.md`. Conflicts with any superior document are resolved in favor of the superior document. This document supersedes any informal design practice not previously codified.*

*Source documents: LETBUYY_DESIGN_CONSTITUTION.md, DESIGN_GOVERNANCE_MODEL.md, DESIGN_MIGRATION_STRATEGY.md, IMPLEMENTATION_ROADMAP.md, DESIGN_SYSTEM_INVENTORY.md, TOKEN_INVENTORY.md.*
