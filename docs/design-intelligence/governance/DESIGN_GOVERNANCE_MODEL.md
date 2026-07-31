# LetBuyy Design Governance Model

**Document type:** Operational model for design system governance.
**Date:** 2026-06-19
**Subordinate to:** LETBUYY_DESIGN_CONSTITUTION.md (design law), LETBUYY_CONSTITUTION.md (supreme law).

---

## Current State Assessment

### What governance exists today

The existing governance infrastructure is more substantial than a typical early-stage platform. The following elements are in place and working:

**Token architecture (strong):**
- A four-tier token model is fully implemented in `packages/typescript/ui/src/tokens.ts`: primitive, semantic, component, and density tiers.
- All tokens are emitted as `--lb-*` CSS variables via `letbuyyTokenCss` and injected by `DesignSystemRoot` / `LetbuyyThemeProvider`.
- The DTCG interchange file (`tokens.json`) is generated from `tokens.ts` and validated by `generate-design-tokens.mjs --check`.
- A Tailwind v4 token layer (`config/tailwind/letbuyy-tokens.css`) maps semantic `--lb-color-*` tokens to Tailwind utility aliases (`bg-surface`, `text-default`, `border-line`).
- A tenant brand override API (`createLetbuyyBrandVariables`) exists with WCAG contrast validation (`validateLetbuyyBrandContrast`).

**ESLint enforcement (strong):**
- Five ESLint rules exist in `packages/typescript/ui/eslint/index.cjs`:
  - `no-raw-elements` (error): catches raw `<button>`, `<input>`, `<table>`.
  - `no-hardcoded-hex` (error): catches `#RRGGBB` colors.
  - `no-raw-form-controls` (warn): catches raw `<select>`, `<textarea>`, `<dialog>`.
  - `no-raw-color-functions` (warn): catches `rgb()` / `hsl()`.
  - `no-tailwind-default-color` (warn): catches Tailwind default palette classes like `bg-gray-500`.
- All five rules are covered by automated tests in `eslint/rules.test.mjs`.
- A recommended config is exported and consumed by apps via `@letbuyy/ui`.

**Ratchet validator (strong):**
- `scripts/validators/validate-design-system.mjs` enforces a ratchet on multiple violation categories: `tsxArbitraryRadius`, `rawPxSpacing`, `rawPxFontSize`, `tsxInlineStyles`, `tsxRawHex`, `tailwindPaletteClasses`, `appCssNakedRgbHsl`.
- `validate:design-tokens` checks drift between `tokens.json` and `tokens.ts`.
- `validate:mobile-tokens` checks Flutter token drift.

**Codemod infrastructure (strong):**
- Seven codemods exist in `packages/typescript/ui/codemods/` with a CLI runner (`codemods/cli.mjs`):
  - `data-table-to-table`, `index-table-to-table` — component rename.
  - `badge-danger-to-critical` — variant string rename.
  - `page-aliases-to-canonical` — canonical name enforcement.
  - `text-style-to-text` — API change migration.
  - `token-alias-rename` — CSS variable rename (11 deprecated aliases mapped).
  - `tailwind-default-color-to-token` — Tailwind default class to token utility class.

**Deprecation system (exists, partially applied):**
- `warnDeprecated` in `deprecations.ts` fires non-production console warnings for deprecated symbols.
- 11 deprecated token aliases are tracked in `deprecatedTokenAliasVariables` and excluded from the emitted CSS.
- The token-alias-rename codemod covers all 11 aliases.

**Shared component library (strong and growing):**
- `packages/typescript/ui/src/` contains a full primitive set: actions, inputs, layout, data, feedback, overlays, shell/nav, and theme infrastructure.
- The `LetbuyyThemeProvider` owns theme state, dark mode, density, and flash prevention across all apps.
- Surface types (`admin`, `marketplace`, `storefront`, `identity`, `operations`) are defined and available.
- Five `LetbuyySurface` types are recognized: each gets its own surface variable set.

**Documentation (moderate):**
- `docs/design-system/`: foundations, colors, typography, spacing, density, dark mode, components, navigation.
- `docs/ui-standards/`: merchant UX, mobile-first guidelines, India localization, forms, checkout, dashboard, empty states, error states, loading states.
- Governance stories in `packages/typescript/ui/src/governance.stories.tsx` document do/don't usage.

---

### What is working

1. **The ratchet is real.** The combination of ESLint errors for the most critical violations (hardcoded hex, raw interactive elements) and the ratchet validator for subtler drift means the codebase cannot silently degrade.
2. **The token system is well-structured.** The tier hierarchy (primitive → semantic → component → density) is sound. The CSS variable naming is consistent. The Tailwind bridge is clean.
3. **The codemod infrastructure is mature.** Having a CLI runner with dry-run support and a set of existing codemods means future migrations have a template to follow.
4. **The theming model is clean.** One provider, one flash-prevention script, no conflicting state. The dark mode implementation is correct.
5. **The surface concept exists.** Five surface types are defined. The `data-letbuyy-surface` attribute system is in place. This is the architectural hook needed for per-product design system differentiation.

---

### What is missing or incomplete

**1. Per-product design system definition (Layer 2) is undocumented:**
The token system has `LetbuyySurface` types but there is no codified definition of what each surface's design language is, what it may extend, or who owns it. The storefront, marketing site, and platform console all consume the same tokens without any documented per-product design language contract.

**2. Navigation migration is incomplete:**
The `docs/design-system/navigation.md` explicitly notes that `merchant-control-plane` has not yet migrated to `AppNavigation`. This is a known governance gap. The old pattern (`_local-ui/` sidebars with manual active-state logic) continues to exist alongside the canonical pattern.

**3. Component graduation process is informal:**
There is no formal process for moving a component from an app-local directory to the shared library. Components are promoted ad-hoc. The criteria and review process are not defined.

**4. Team ownership is implicit:**
There is no documented mapping of who owns which component or token tier. `@letbuyy/ui` is listed as a package but there is no explicit maintainer set or code-owner declaration for the design system package.

**5. Exception tracking is absent:**
ESLint disable comments exist in the codebase (this is inevitable) but there is no formal process for tracking, reviewing, or resolving them. Design exceptions are invisible.

**6. Design review is informal:**
There is no documented process for when a design change requires review, who reviews it, or what artifacts are required. Currently, changes are reviewed informally through the standard PR process.

**7. Layer 2 per-product color and typographic extensions are not defined:**
The marketing site, platform console, and storefront all have different visual needs but there are no documented per-product extension tokens or a defined space for them. This creates pressure to either: (a) fight to keep everything in the shared tokens or (b) add product-specific hacks without governance.

**8. Governance for the theme engine is separate but unlinked:**
The Liquid theme engine (`packages/theme-engine`) is a separate design system from `@letbuyy/ui`. The boundary between them (what the storefront inherits from `@letbuyy/ui` vs. what is the theme engine's domain) is not documented.

---

## Proposed Governance Structure

### Teams and responsibilities

**Platform Team** owns:
- Layer 0: all `--lb-*` token architecture decisions.
- The `letbuyyTokens` export, the DTCG tokens.json, and the CSS generator.
- The Tailwind token layer (`config/tailwind/letbuyy-tokens.css`).
- The theming model (provider, flash script, dark mode).
- The `validate:design-system` and `validate:design-tokens` gates.
- Architectural decisions about the design system (constitutional-layer changes).

**`@letbuyy/ui` Maintainers** own:
- Layer 1: all shared components in `packages/typescript/ui/src/`.
- The ESLint plugin (`packages/typescript/ui/eslint/`).
- The codemod library (`packages/typescript/ui/codemods/`).
- The deprecation system.
- Component API contracts, accessibility behavior.
- The Storybook catalog.

**Product Teams** own (each their respective surface):
- Layer 2: per-product design language, component extensions, and layout patterns within their app.
- App-local components in `apps/<app>/src/components/` or `apps/<app>/src/_local-ui/`.
- The `LetbuyyThemeProvider` configuration for their app (surface type, density default, default theme).

**Architecture Review Board (ARB)** governs:
- Constitutional amendments to `LETBUYY_DESIGN_CONSTITUTION.md`.
- Layer 0 token additions and modifications.
- Changes to the enforcement model.
- Exception approvals for more than 10 instances of an error-level rule.
- The tenant customization API changes.

---

### Processes and rituals

**Weekly: Design system office hours (async)**
A GitHub Discussion thread opened each week for questions, proposals, and informal design decisions. No synchronous meeting required while the team is small. Thread is closed and summarized each Friday.

**Monthly: Component and token health review**
The `@letbuyy/ui` maintainers review:
- Ratchet counts: are they declining?
- Open exceptions: are they being resolved?
- Graduation candidates: what app-local components are ready?
- Deprecation queue: what deprecated symbols still have consumers?

Output: a brief status comment on the `design:health` issue.

**Per-PR: Automated gate**
Every PR runs the following gates (no humans required):
1. ESLint with the `@letbuyy/ui/recommended` config.
2. `validate:design-system` ratchet.
3. `validate:design-tokens` DTCG drift check.
4. `pnpm --filter @letbuyy/ui test` (ESLint rule self-tests).

**As-needed: Graduation review**
When a product team proposes a component for Layer 1 graduation, a review session is scheduled with the proposing team and at least one `@letbuyy/ui` maintainer. This is a focused ~45-minute session reviewing the component API, accessibility behavior, and portability.

---

## Implementation Phases

### Phase 1: Codify what exists (no new work, just document)

**Goal:** Make the existing governance legible and actionable. Nothing new is built. What exists is documented, named, and assigned owners.

**Tasks:**

1. **Document CODEOWNERS for the design system package.** Add a `packages/typescript/ui` entry to `.github/CODEOWNERS` assigning maintainers. This makes the "who reviews Layer 1 changes" question automatic — GitHub will request reviews from the right people.

2. **Document per-surface defaults.** For each of the five `LetbuyySurface` types, document the intended `density` default and `defaultTheme` in a table in `docs/design-system/surfaces.md`. The code already has these but they are not written down.

3. **Document the tenant brand override contract.** Write `docs/design-system/tenant-customization.md` documenting the `createLetbuyyBrandVariables` API, the WCAG contrast validation, and what is and is not customizable. This is the document a theme developer reads.

4. **Publish the governance stories.** The `governance.stories.tsx` file exists with do/don't guidance. Ensure it is in the Storybook build and visible.

5. **Create a design system exceptions register.** Open a GitHub Issue with the label `design:exceptions-register`. Find all existing ESLint disable comments in the codebase and list them. This is the starting inventory.

6. **Confirm the DTCG parity check is in CI.** Verify that `validate:design-tokens` runs on every PR. If not, add it.

**Effort:** 1 sprint (2 weeks). No new code.

---

### Phase 2: Fill the obvious gaps

**Goal:** Address the three most consequential missing pieces from the current state assessment.

**Tasks:**

1. **Complete the merchant-control-plane navigation migration.** The `navigation.md` doc already names this as pending. Migrate `merchant-control-plane` to `AppNavigation`. This closes the biggest known divergence from the canonical shared nav pattern.

2. **Define Layer 2 per-product extension namespaces.** Define the product-scoped token prefixes (`--mcp-*`, `--ops-*`, `--marketing-*`, `--storefront-*`) and document what each product is permitted to define under its namespace. Write a one-page `docs/design-system/product-extensions.md`.

3. **Formalize the graduation process.** Add a `CONTRIBUTING.md` to `packages/typescript/ui/` documenting: how to propose a new Layer 1 component, the graduation criteria, the review process, and the graduation checklist (accessibility, portability, stories).

4. **Document the theme engine boundary.** Write `docs/design-system/theme-engine-boundary.md` explaining what the storefront inherits from `@letbuyy/ui` (the structural Layer 0 tokens), what the theme engine manages (the merchant's visual language), and how the two systems coexist without conflict.

5. **Resolve the deprecated token alias backlog.** Run `token-alias-rename` across all apps. Verify the 11 deprecated aliases have zero remaining consumers. Lock them at zero in the ratchet.

**Effort:** 2 sprints (4 weeks). Primarily migration and documentation work.

---

### Phase 3: Build governance tooling

**Goal:** Make governance lower-friction. The rules exist; now make them easier to follow than to violate.

**Tasks:**

1. **Add a `design:token-proposal` issue template.** A GitHub issue template that walks a proposer through the "every surface test" for new Layer 0 tokens, the ARB checklist, and the implementation steps. Reduces the barrier for well-formed proposals.

2. **Add a `design:new-component` PR template.** A PR template for Layer 1 component additions covering: use case, API, accessibility behavior, stories checklist, portability checklist.

3. **Extend the ESLint plugin with a `no-product-prefix-in-shared` rule.** A rule that warns if product-scoped tokens (`--mcp-*`, `--ops-*`) are referenced in `packages/typescript/ui/src/`. This prevents product-specific concerns from bleeding into the shared library.

4. **Add visual regression to the Storybook CI.** A snapshot or chromatic-style check that catches visual regressions in the shared component library without requiring manual review. The governance stories and component catalog are the baseline.

5. **Build the exceptions reporter.** A script that reads all ESLint disable comments in app code and produces a report: file, rule disabled, line, date first seen. Run weekly and post to the `design:exceptions-register` issue. This makes exceptions visible and creates accountability for reducing them.

6. **Add a `pnpm lint:css` step to CI.** The `.stylelintrc.cjs` file exists for CSS color rule checking. Ensure it runs on every PR, particularly for the `apps/` directory CSS files.

**Effort:** 2 sprints (4 weeks). Engineering work on tooling.

---

### Phase 4: Mature governance model

**Goal:** The governance model becomes self-sustaining. New surfaces and components enter a defined process without requiring tribal knowledge.

**Tasks:**

1. **Design system changelog automation.** When a PR adds or modifies a token or component, require a `changeset` entry (using Changesets or a similar tool). Generate the `@letbuyy/ui` changelog automatically from these entries.

2. **Token audit report.** A scheduled script (monthly) that checks: are all documented tokens actually used? Are there undocumented `--lb-*` variables being set? Are any product-scoped tokens accidentally in the shared emitter? Report to the design:health issue.

3. **Cross-app component divergence detector.** A script that finds components defined in multiple app local directories with the same or similar names — graduation candidates. Run quarterly. Surfaces patterns that should be in the shared library but aren't yet.

4. **Design system adoption scorecard per app.** For each app, report: ratchet counts per category, open exceptions, percentage of interactive elements using Layer 1 components vs. raw elements. This gives each product team visibility into their own compliance and trend.

5. **Accessibility gate.** Add an automated accessibility check (axe-core or pa11y) to the Storybook build for all Layer 1 components. A component that ships an accessibility violation blocks the `@letbuyy/ui` build.

6. **Onboarding path for new engineers.** A `docs/design-system/getting-started.md` that gets a new engineer productive with the design system in under 30 minutes. Links: the Storybook, the governance stories, the ESLint plugin, the token reference, and the first PR checklist.

**Effort:** 3 sprints (6 weeks). Mix of automation and documentation.

---

## Success Metrics

### How do we know governance is working?

Governance is working when:
1. New code does not introduce new violations.
2. Existing violations trend downward over time.
3. Product teams can extend the system without breaking it.
4. A new engineer can be productive with the design system within one day.
5. The design system does not become a bottleneck — teams can move fast within the rules.

### Metrics to track

**Compliance (monthly trend, from ratchet counters):**

| Metric | Target | Current state |
|--------|--------|--------------|
| `tsxArbitraryRadius` count | 0 | Unknown — run ratchet to establish baseline |
| `rawPxSpacing` count | 0 | Unknown — run ratchet to establish baseline |
| `rawPxFontSize` count | 0 | Unknown — run ratchet to establish baseline |
| `tsxRawHex` count | 0 | Unknown — run ratchet to establish baseline |
| `tailwindPaletteClasses` count | 0 | Unknown — run ratchet to establish baseline |
| Deprecated token alias consumers | 0 | 11 aliases defined; consumers unknown |
| Raw element ESLint errors | 0 (gate blocks) | Gate active |

**Health (quarterly):**

| Metric | Target |
|--------|--------|
| Open design exceptions (ESLint disable comments) | Declining trend; total < 20 |
| Layer 1 components without Storybook stories | 0 |
| App-local components that are graduation candidates | Known list; actively shrinking |
| Navigation pattern divergence (apps not using AppNavigation) | 0 (post Phase 2) |
| Deprecated symbols with remaining consumers | 0 |

**Velocity (quarterly — ensuring governance doesn't slow teams):**

| Metric | Target |
|--------|--------|
| Time from Layer 1 component proposal to merge | < 5 business days for additive, non-breaking changes |
| Time from Layer 0 token proposal to ARB decision | < 10 business days |
| PRs blocked by design gate false positives | < 5% of all PRs |

**Coverage (quarterly):**

| Metric | Target |
|--------|--------|
| Apps with `@letbuyy/ui/recommended` ESLint config | All active apps |
| Apps with `LetbuyyThemeProvider` (not `DesignSystemRoot`) | All active apps |
| Apps using `AppNavigation` or `Sidebar + Navigation` for admin chrome | All apps with admin chrome |
| Layer 2 extension namespaces documented for each active surface | All 5 surfaces |

---

## Governance Anti-Patterns to Avoid

The following governance failure modes are explicitly prohibited, consistent with the LETBUYY_CONSTITUTION.md §5 prohibition on governance theater:

**1. Governance that exists only in documentation.** A rule that is not enforced by a machine gate is not governance; it is a suggestion. Every rule in the design constitution must have either an automated enforcement mechanism or an explicit plan to build one.

**2. "One size fits all" thinking.** The governance model must not converge all surfaces toward a single visual language. The storefront looking like the merchant dashboard is a governance failure, not a governance success. Layer 2 differences are features, not bugs.

**3. The shared library as a dumping ground.** Not every component belongs in `@letbuyy/ui`. A component that is product-specific, experimental, or not yet stable belongs in the product. Premature graduation increases the maintenance burden on maintainers and the API surface that all teams depend on.

**4. Ratchet loosening.** The ratchet counts may never be increased to "accommodate" a new feature or a deadline. If a new feature introduces a violation, the violation must be fixed or the feature must be redesigned. The ratchet is constitutional.

**5. Exceptions without plans.** An ESLint disable comment is acceptable as a temporary measure only if it has an associated issue tracking resolution. "// eslint-disable-next-line @letbuyy/ui/no-raw-elements — tracked in #123" is acceptable. "// eslint-disable-next-line @letbuyy/ui/no-raw-elements" with no context is not.

**6. Tribal knowledge over codified law.** "Everyone knows you don't do X" is not governance. If it matters, it is written here or in the design constitution. If it is not written, it does not exist as a rule.

---

*This model is a living document. Update it as the team and governance needs evolve. The first review point is after Phase 1 is complete.*
