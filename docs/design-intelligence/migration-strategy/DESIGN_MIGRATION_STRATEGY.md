# LetBuyy Design Migration Strategy

Date: 2026-06-19
Scope: Platform-wide design system adoption and governance

---

## Migration Philosophy

### Why Migration, Not Rewrite

LetBuyy is a live commerce platform with real merchants. A rewrite means weeks of frozen feature delivery, a guaranteed regression window, and a big-bang merge that is nearly impossible to test exhaustively. The right approach is the opposite: continuous, ship-as-you-go migration where each change is independently testable, independently reversible, and immediately valuable.

The `@letbuyy/ui` token and component system already exists. It is not being introduced — it is being *adopted more completely*. The goal is to raise the adoption rate, not to rebuild what is already working.

### The "Ship and Improve" Principle

Every migration change must ship working code. That means:

- Never migrate a page without testing it in both light and dark mode
- Never change a color utility without verifying the output is visually identical or intentionally improved
- Never rename a token reference in a CSS file without checking every selector that consumed it
- When in doubt, leave it alone and document it for a later phase

The validator gate (`node scripts/validators/validate-design-system.mjs`) is the authoritative ratchet. It tracks drift metrics: `tsxArbitraryRadius`, `rawPxSpacing`, `rawPxFontSize`, `tsxInlineStyles`, `tsxRawHex`, `tailwindPaletteClasses`, `appCssNakedRgbHsl`. These counts may never increase on a PR. Migration means reducing them — but each reduction must be tested before merge.

### Risk Management in a Live Platform

The platform is India-first, mobile-first, and handles real money. Any visual regression on checkout, payment confirmation, or auth flows is a trust failure. Three rules govern this migration:

1. **Payment and auth flows are the last to touch.** The `select-plan`, `checkout`, `onboarding`, and login pages handle merchant money and account creation. They get migrated only after all other pages in their app are clean and the patterns are proven.
2. **ESLint gates catch new debt, not old.** The rules are already configured in all app `eslint.config.mjs` files. They flag new violations immediately. Migration is the act of resolving existing ones — never bypassing the gate.
3. **The codemods do mechanical work; humans do intent review.** `tailwind-default-color-to-token.cjs` can safely replace the high-confidence gray/white neutral utilities. Colored palette classes (slate, indigo, violet, etc.) require manual review because the intent may be deliberate.

---

## Current State Baseline

### Token Adoption Rate Across Apps

Based on direct code analysis:

| App | TSX Files | Files Using @letbuyy/ui | Adoption Rate |
|-----|-----------|------------------------|---------------|
| merchant-control-plane | 100 | 39 | ~39% |
| identity-platform | 15 | 10 | ~67% |
| marketing-site | 48 | 7 | ~15% |

The adoption numbers count files that import from `@letbuyy/ui` at all. Files that use `@letbuyy/ui` components but still mix in raw Tailwind palette colors are counted as adopters but are only partially compliant.

**CSS token adoption:**
- `identity-platform/src/app/globals.css` imports `letbuyy-tokens.css` and references 6 `--lb-*` variables, but defines 10+ parallel local variables (`--bg`, `--text-primary`, `--border`, etc.) with raw `rgb()` values that duplicate what `--lb-*` already provides. This is the worst single-file token fragmentation in the platform.
- `marketing-site/src/app/globals.css` has approximately 725 raw `rgb()`/`rgba()` color function usages not going through `--lb-*` variables. This is a deliberate decision for the marketing site's custom visual identity, but it means the marketing site has zero dark-mode token support.
- `config/tailwind/letbuyy-tokens.css` is correctly structured and imported. The token-backed utilities (`bg-surface`, `text-default`, `border-line`) are available in every app that imports this file.

### Where @letbuyy/ui Is Being Used Correctly

**merchant-control-plane is the most compliant app.** The core list/detail pages (`products/page.tsx`, `DashboardClient.tsx`) correctly use:
- `Page`, `PageHeader`, `Section`, `Card` for layout
- `Table` with typed columns
- `Badge`, `Banner`, `EmptyState`, `Skeleton` for feedback
- `Button`, `Input` for interaction
- `formatInrCurrency` from `@letbuyy/ui/formatting`
- `useToast` for success/failure notifications

The ESLint plugin is configured and active with the correct severity (`no-raw-elements: error`, `no-hardcoded-hex: error`). The component layer is solid.

**identity-platform** correctly uses `Button` and `Input` from `@letbuyy/ui` in the onboarding and auth flows. The component usage is correct; the CSS layer is the problem.

### Where the Worst Violations Are

**Worst 1: merchant-control-plane arbitrary border-radius (127 instances)**
The largest single debt item is 127 uses of `rounded-[...]` arbitrary values in merchant-control-plane. The ratchet forbids new instances, but the existing ones accumulate from pages that predate the validator. Every `rounded-[8px]` or `rounded-[12px]` should be `rounded-md` or `rounded-lg` using the token scale.

**Worst 2: identity-platform parallel CSS custom property system**
`globals.css` defines a completely parallel set of CSS custom properties (`--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--input-bg`) with raw `rgb()` values. These shadow or ignore `--lb-*` equivalents. Every time the token layer is updated, the auth/onboarding pages do not benefit because they're reading from the local variables, not the token variables. This doubles the maintenance surface.

**Worst 3: marketing-site has its own color system**
The marketing site uses ~725 raw color function calls in its globals.css and component files. It has a deliberately custom visual identity (not the merchant admin look). This is the lowest priority for token adoption because the marketing site intentionally looks different — but it must not pull in `@letbuyy/ui` component tokens and then override them with raw values.

**Worst 4: 38 files in merchant-control-plane use Tailwind default palette colors**
Files including `settings/checkout/page.tsx`, `settings/payments/page.tsx`, `products/page.tsx`, and `gallery/page.tsx` use `bg-gray-*`, `text-gray-*`, and `border-gray-*` utilities that bypass the token system. These do not switch correctly in dark mode. The codemod can handle the high-confidence neutral cases automatically.

---

## Quick Wins (1-2 days each, near zero risk)

### Win 1: Run the tailwind-default-color-to-token codemod across merchant-control-plane

**Where:** All 38 files in `apps/merchant-control-plane/src` flagged by `bg-gray-*`, `text-gray-*`, `border-gray-*`, `bg-white`

**Impact:** Converts neutral gray utilities to token-backed equivalents (`bg-[var(--lb-color-surface-subdued)]`, `text-[color:var(--lb-color-text)]`, `border-[var(--lb-color-border)]`). These switch correctly in dark mode. Reduces the `tailwindPaletteClasses` ratchet count significantly.

**Risk:** Very Low. The codemod is conservative by design — it only handles high-confidence neutral cases. Non-neutral colored utilities (status colors, brand purple) are left for manual review.

**How:**
```
node packages/typescript/ui/codemods/cli.mjs tailwind-default-color-to-token apps/merchant-control-plane/src --dry
# Review diff, then:
node packages/typescript/ui/codemods/cli.mjs tailwind-default-color-to-token apps/merchant-control-plane/src
```
Test each page in both light and dark mode in the browser before committing.

---

### Win 2: Replace arbitrary border-radius with token scale in settings pages

**Where:** `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx`, `settings/payments/page.tsx`, `settings/policies/page.tsx`, `settings/shipping/page.tsx`, `settings/taxes/page.tsx`, `settings/notifications/page.tsx`

**Impact:** Reduces `tsxArbitraryRadius` ratchet count. Ensures radius tokens are used consistently. These settings pages are low-traffic, low-risk targets.

**Risk:** Very Low. Visual change is minor (8px → `rounded-md`; 12px → `rounded-lg`; 16px → `rounded-xl`).

**How:** Search and replace `rounded-[8px]` → `rounded-md`, `rounded-[12px]` → `rounded-lg`, `rounded-[16px]` → `rounded-xl`, `rounded-[4px]` → `rounded-sm`. Confirm the token maps in `config/tailwind/letbuyy-tokens.css`.

---

### Win 3: Replace arbitrary border-radius in contact, comments, posts, gallery, testimonials pages

**Where:** `apps/merchant-control-plane/src/app/[store]/contact/page.tsx`, `comments/page.tsx`, `posts/page.tsx`, `gallery/page.tsx`, `testimonials/page.tsx`

**Impact:** Same as Win 2 — reduces ratchet count, no functional change.

**Risk:** Very Low.

**How:** Same radius substitution. These pages are not in critical flows.

---

### Win 4: Wire identity-platform CSS variables to --lb-* equivalents

**Where:** `apps/identity-platform/src/app/globals.css` — the 10+ local custom property definitions at lines 5-33

**Impact:** Removes the parallel property system. `--bg`, `--text-primary`, `--border` etc. become aliases for `--lb-*` equivalents instead of raw `rgb()` values. Any future token update flows through to auth/onboarding pages automatically.

**Risk:** Low. The values are equivalent — the `--lb-*` tokens produce the same colors. Test login, signup, and onboarding flows in light and dark mode.

**How:** Replace raw rgb() values with `var(--lb-*)` references:
- `--bg: rgb(250 249 255)` → `--bg: var(--lb-color-bg)`
- `--text-primary: rgb(10 8 22)` → `--text-primary: var(--lb-color-text)`
- `--text-secondary: rgb(55 46 88)` → `--text-secondary: var(--lb-color-text-subdued)`
- `--border: rgb(224 216 248)` → `--border: var(--lb-color-border)`
- `--input-bg: rgb(255 255 255)` → `--input-bg: var(--lb-color-surface)`
- Repeat for `.dark` overrides (they can be deleted once the root variables point to theme-aware tokens)

---

### Win 5: Remove the .dark overrides from identity-platform globals.css

**Where:** `apps/identity-platform/src/app/globals.css` lines 35-44 (the `.dark {}` block that redefines the same local variables)

**Impact:** Once Win 4 is done, the `.dark {}` overrides become redundant because `--lb-*` tokens already switch via `[data-letbuyy-theme="dark"]` or `.dark` selectors in the token CSS. Deleting the block reduces maintenance surface.

**Risk:** Very Low (dependent on Win 4 being complete first).

**How:** Delete the `.dark {}` block. Verify dark mode appearance by toggling the theme on the auth/onboarding pages.

---

### Win 6: Add @letbuyy/ui imports to merchant-control-plane pages not yet using the library

**Where:** The ~61 TSX files in merchant-control-plane that do not currently import from `@letbuyy/ui`

**Impact:** Incremental. Even adding `Skeleton`, `EmptyState`, or `Badge` to one page at a time improves consistency and reduces custom code.

**Risk:** Very Low. Adding imports and replacing one component at a time is the safest migration unit.

**How:** Identify pages that render their own loading spinners, empty messages, or status text. Replace with `<Skeleton>`, `<EmptyState>`, and `<Badge>` from `@letbuyy/ui`. The ESLint plugin will flag remaining raw elements at error level, providing an automatic checklist.

---

### Win 7: Run the badge-danger-to-critical codemod

**Where:** All apps. The codemod `badge-danger-to-critical.cjs` renames the deprecated `danger` variant to `critical`.

**Impact:** Clears deprecation warnings in the console. Aligns with the current `Badge` API.

**Risk:** Very Low. Mechanical rename — the codemod has a test fixture confirming the transform.

**How:**
```
node packages/typescript/ui/codemods/cli.mjs badge-danger-to-critical apps/ --dry
# Review, then run without --dry
```

---

### Win 8: Run the page-aliases-to-canonical codemod

**Where:** All apps. The codemod `page-aliases-to-canonical.cjs` converts deprecated page layout alias components to their canonical names.

**Impact:** Removes deprecated import paths, clears the `warnDeprecated()` console warnings. Reduces future maintenance when aliases are eventually removed.

**Risk:** Very Low. Mechanical rename with a test fixture.

**How:**
```
node packages/typescript/ui/codemods/cli.mjs page-aliases-to-canonical apps/ --dry
```

---

### Win 9: Audit and remove inline style={{ }} usages in merchant-control-plane

**Where:** The 7 files in `apps/merchant-control-plane/src` that use inline `style={{}}` props.

**Impact:** Reduces `tsxInlineStyles` ratchet count. Inline styles bypass the token system and cannot be overridden by theme switches or density changes.

**Risk:** Low. Each inline style must be reviewed individually — some may be dynamic (e.g. computed widths from data) and should be kept. Others are static values that should move to Tailwind utilities using `var(--lb-*)` references.

**How:** Search for `style={{` in the 7 flagged files. For each occurrence: if the value is static, convert to a Tailwind arbitrary property using a `--lb-*` CSS variable. If the value is dynamic (computed from state/data), leave it and add a comment explaining why.

---

### Win 10: Extend ESLint no-tailwind-default-color from warn to error in merchant-control-plane

**Where:** `apps/merchant-control-plane/eslint.config.mjs` — the `@letbuyy/ui/no-tailwind-default-color` rule

**Impact:** After the codemod runs (Win 1), the remaining palette class violations are the ambiguous or intentional ones. Promoting the rule to `error` ensures no new palette violations can be merged.

**Risk:** Very Low. Do this after Win 1 is merged. If there are remaining violations, they must be reviewed and resolved before the severity change lands.

**How:** Change `"@letbuyy/ui/no-tailwind-default-color": "warn"` to `"@letbuyy/ui/no-tailwind-default-color": "error"` in the ESLint config. Run `pnpm --filter merchant-control-plane lint` to see what remains.

---

## Medium Complexity (3-5 days each, low-medium risk)

### Task 1: Systematic arbitrary-radius elimination in products and new-product pages

**Scope:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx` and `products/new/page.tsx` — these are high-traffic pages with complex UIs.

**Impact:** These two pages account for a significant portion of the 127 arbitrary-radius instances (they have complex UI with many interactive elements). Fixing them has the highest visibility.

**Risk:** Medium. Products page has a full-featured `Table`, filter bar, bulk actions, image thumbnails, and status badges. Any visual regression here is immediately visible to merchants.

**Dependencies:** Quick Wins 1-3 should be complete first so that the pattern is established and the approach is validated on simpler pages.

**Approach:**
1. Do a dry-run pass: list every `rounded-[...]` in these files and classify each as `rounded-sm` (4px), `rounded-md` (8px), `rounded-lg` (12px), or `rounded-xl` (16px).
2. Apply substitutions in a single commit.
3. Do a visual review in both light and dark mode at 360px, 768px, and 1280px.
4. Verify the `Table` row hover states, image thumbnail corners, and badge shapes all look correct.

---

### Task 2: identity-platform CSS architecture consolidation

**Scope:** `apps/identity-platform/src/app/globals.css` — the full auth design system

**Impact:** After Wins 4 and 5, this consolidation eliminates the residual local custom properties that still use raw rgb() values (the auth-specific ones like `--primary-light`, `--accent-cyan`, `--text-tertiary`, `--text-hint`). These need to either map to `--lb-*` primitives or be documented as intentional identity-platform-specific tokens.

**Risk:** Medium. The auth flow handles account creation and login. A broken color breaks merchant trust immediately. Requires careful visual testing across all auth states: login, signup, onboarding step 1/2/3, forgot password, reset password.

**Dependencies:** Wins 4 and 5 must be complete.

**Approach:**
1. Map `--accent-cyan` → `--lb-color-info` (or keep as a local override if the auth design intentionally differs from the info status color)
2. Map `--text-tertiary` → `var(--lb-color-text-muted)` 
3. Map `--text-hint` → `var(--lb-color-text-muted)` with reduced opacity
4. Map `--primary-light` → `var(--lb-primitive-color-purple-300)` for the dark-mode tint
5. Each change: commit individually, test auth flow, merge.

---

### Task 3: marketing-site token adoption for structural properties

**Scope:** `apps/marketing-site/src/app/globals.css` — approximately 725 raw rgb() calls

**Impact:** The marketing site is intentionally custom-designed. The goal is NOT to make it look like the merchant admin. The goal is to wire its structural properties (spacing, typography scale, breakpoints) to `--lb-*` tokens while keeping its visual identity independent. This gives the marketing site benefit of token updates (font family changes, spacing changes) without imposing the admin color system.

**Risk:** Medium. The marketing site is the first thing prospective merchants see. Any regression in visual quality is a brand failure.

**Dependencies:** No code dependencies. Requires design sign-off on which properties belong to the shared token layer vs. the marketing site's own identity.

**Approach:**
1. Identify the structural properties in globals.css: font families, spacing scale, breakpoints.
2. Replace those with `var(--lb-font-family-body)`, `var(--lb-space-*)`, `var(--lb-bp-*)` references.
3. Leave the visual identity properties (background colors, gradient definitions, hero colors) as-is — they are intentional.
4. Document the boundary clearly in a comment in globals.css.

---

### Task 4: Replace raw <select> and <textarea> elements with @letbuyy/ui equivalents in merchant-control-plane

**Scope:** Multiple files including `products/new/page.tsx`, `settings/domains/page.tsx`, `ConnectDomainWizard.tsx`, `DomainDetailView.tsx`

**Impact:** Raw `<select>` and `<textarea>` elements are flagged at `warn` level by the ESLint plugin. Replacing them with `Select` and `Textarea` from `@letbuyy/ui` ensures consistent focus states, keyboard navigation, accessibility attributes, and dark mode support.

**Risk:** Medium. Form elements on the product creation and domain settings pages are high-value flows. A broken `<select>` on the new product page means merchants cannot categorize products.

**Dependencies:** None technical. Requires understanding the existing props/handlers to wire the `@letbuyy/ui` versions correctly.

**Approach:**
1. Start with `settings/` pages (lower risk than `products/new/`)
2. For each `<select>`, replace with `<Select options={[...]} value={...} onChange={...} />` from `@letbuyy/ui`
3. For each `<textarea>`, replace with `<Textarea value={...} onChange={...} />` from `@letbuyy/ui`
4. Verify that all existing handlers still fire correctly
5. Test keyboard navigation and screen reader behavior

---

### Task 5: Promote no-raw-color-functions to error in all apps

**Scope:** All app `eslint.config.mjs` files — change `@letbuyy/ui/no-raw-color-functions` from `warn` to `error`

**Impact:** Prevents any new `rgb()`, `rgba()`, `hsl()` literal from being introduced in TSX files. Existing violations must be resolved before this change can land.

**Risk:** Medium. There may be legitimate uses in canvas/SVG drawing code, or in dynamic color computations. Each existing violation must be reviewed before the rule is promoted.

**Dependencies:** Requires a full pass through all existing violations to confirm they can be resolved.

**Approach:**
1. Run `pnpm --filter <app> lint` on each app to enumerate all `no-raw-color-functions` warnings
2. For each violation: if it is a static color, replace with a `var(--lb-*)` reference; if it is dynamic (computed), document why it cannot use a token
3. After all static violations are resolved, promote to `error`
4. Exempt dynamic color computations with `// eslint-disable-next-line @letbuyy/ui/no-raw-color-functions -- dynamic computation`

---

### Task 6: Establish a component graduation checklist and process

**Scope:** `packages/typescript/ui/` — process documentation and a lightweight test for new components before they are exported from `index.ts`

**Impact:** Currently any component added to `index.ts` becomes platform API. There is no explicit graduation gate. A graduation checklist prevents under-tested components from becoming frozen API surface.

**Risk:** Medium process risk — the checklist must be lightweight enough that it does not slow down iteration.

**Dependencies:** None.

**Approach:**
A graduation checklist for a component to be exported from `index.ts`:
- [ ] Supports both light and dark themes via `--lb-*` tokens (no hardcoded colors)
- [ ] Has a Storybook story in `*.stories.tsx`
- [ ] Has TypeScript props with JSDoc for all required props
- [ ] Handles loading, empty, and error states if applicable
- [ ] Uses `--lb-density-*` variables for size-sensitive dimensions
- [ ] Passes `no-raw-elements` and `no-hardcoded-hex` ESLint rules internally
- [ ] Tested at 360px viewport

---

### Task 7: Audit and normalize inline style usages across all apps

**Scope:** All apps — find all `style={{...}}` usages and classify each as (a) legitimate dynamic, (b) static that should be a utility class, or (c) token value that should use a `var(--lb-*)` reference

**Impact:** Reduces `tsxInlineStyles` ratchet count across the platform. Makes it easier to apply density and theme changes platform-wide.

**Risk:** Medium. Some inline styles are intentionally dynamic (progress bars, chart dimensions, carousel positions). Incorrectly converting these breaks functionality.

**Dependencies:** None.

**Approach:** Build a classification pass first (read-only, no changes) to identify which of the three categories each inline style falls into. Then execute changes category by category: static first, then token-mappable, never touch legitimate dynamic styles.

---

## High Complexity (1-4 weeks, higher risk)

### Initiative 1: Complete merchant-control-plane arbitrary-radius elimination

**Scope:** All 127 remaining `rounded-[...]` instances across the full 100-file TSX tree in merchant-control-plane.

**Impact:** Makes merchant-control-plane fully ratchet-compliant for border-radius. Establishes the platform's radius vocabulary (`rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-full`). Every future merchant session uses the correct token-backed radius scale.

**Risk:** High. This touches every page in the merchant admin. The products, orders, customers, coupons, reviews, billing, and settings pages all have complex, data-driven UIs. A regression in any page is visible to live merchants.

**Why the risk is high:**
- 127 instances across 38+ files means high change surface
- Some `rounded-[...]` values may be intentionally different from the token scale (e.g. `rounded-[20px]` for a pill badge that predates `rounded-full`)
- Complex pages like the theme editor and checkout flow have unique visual requirements

**Prerequisites:**
- Wins 2 and 3 must be complete (validates the approach on simpler pages)
- Task 1 must be complete (validates it on the complex products page)
- A visual regression snapshot baseline must exist (even informal screenshots at 360/1280px for key pages)

**Mitigation:**
- Execute in batches by section: settings pages first, then list pages, then detail/form pages, then the checkout and theme editor last
- Each batch is a separate PR with a visual review checklist
- Keep the `rounded-[...]` value mapping spreadsheet visible in every PR description

**Rollback Plan:** Any PR in this initiative can be reverted independently. The ratchet count will increase on revert, but the validator allows temporary increases when the revert PR is linked to a tracking issue. Restore from the previous commit.

---

### Initiative 2: identity-platform design system alignment

**Scope:** Full redesign of `apps/identity-platform/src/app/globals.css` to use `@letbuyy/ui` component layer properly, replacing the parallel local custom property system with the canonical `--lb-*` token system. Scoped to the CSS; component code does not need to change.

**Impact:** Auth and onboarding pages become first-class design system citizens. Theme updates flow through automatically. The auth experience can adopt density changes (compact/comfortable/spacious) without a CSS rewrite.

**Risk:** High. Auth is the first screen every merchant touches. A broken login page is a blocked merchant.

**Why the risk is high:**
- The identity platform has a custom visual identity (lavender/violet ink theme) that is deliberately different from the admin purple-on-white
- Blindly replacing local variables with `--lb-*` equivalents may collapse this identity if the primitives don't match
- The auth pages have complex animated states (transitions between onboarding steps, success animations, loading states) that depend on specific CSS variable values

**Prerequisites:**
- Wins 4 and 5 must be complete and stable in production
- Task 2 must be complete
- A complete visual walkthrough of all auth states documented with screenshots

**Mitigation:**
- Treat the identity platform's lavender/violet palette as a legitimate surface variant (similar to how `LetbuyySurface = 'identity'` already exists in the token system)
- Create `surfaceVariables('light')` / `surfaceVariables('dark')` overrides for the `identity` surface that map the lavender palette values to the `--lb-*` names
- This means identity platform uses `[data-letbuyy-surface="identity"]` on its root, getting both the token system AND its custom visual identity

**Rollback Plan:** The identity platform CSS is self-contained. Reverting `globals.css` restores the previous appearance immediately. Auth flows are not dependent on any server-side state from the CSS change.

---

### Initiative 3: marketing-site design system integration

**Scope:** `apps/marketing-site/` — full token audit and structured integration of `--lb-*` structural tokens while preserving the marketing site's distinct visual identity.

**Impact:** Marketing site gains dark mode support (if desired), consistent typography scale, correct breakpoints, and reduced maintenance surface. The marketing site's 48 TSX files currently have 7 importing `@letbuyy/ui` (15% adoption). The goal is structural tokens in all, visual identity tokens where they match.

**Risk:** High. The marketing site is the acquisition funnel. Any visual regression reduces signups. The site also uses Framer Motion, a custom commerce network visualization, and a Lenis smooth scroll implementation — all of which depend on specific CSS variable values.

**Why the risk is high:**
- 48 files with a custom visual system that was built without token constraints
- Many components use raw hex colors for gradients and visual effects that have no `--lb-*` equivalent
- The site's design identity intentionally differs from the merchant admin

**Prerequisites:**
- Platform-level decision on whether the marketing site should adopt dark mode
- Design review of which components should use `@letbuyy/ui` vs. stay custom
- Tasks 3 and 5 complete in identity-platform (to validate the pattern of adopting structural tokens while preserving visual identity)

**Mitigation:**
- Define a clear scope: structural tokens (font family, breakpoints, spacing scale) are in scope; visual identity tokens (colors, gradients, shadows) are out of scope until design signs off
- Migrate one marketing component at a time (Header, Footer, pricing section) with a visual review after each
- Keep the marketing site's globals.css as the source of truth for its visual identity; never let `@letbuyy/ui` token CSS override marketing-site variables

**Rollback Plan:** The marketing site is statically rendered. Any CSS change can be reverted and redeployed in under 5 minutes.

---

### Initiative 4: Platform-wide component adoption audit and gap closure

**Scope:** All active apps — a systematic audit of every page that does not import from `@letbuyy/ui`, followed by targeted component migrations.

**Impact:** Raises the platform-wide adoption rate from ~39% (merchant-control-plane), ~67% (identity-platform), and ~15% (marketing-site) to 80%+ across all active apps. Makes the design system the default, not the exception.

**Risk:** High. This is broad scope. Any component migration on an untested page can introduce regressions.

**Why the risk is high:**
- 100 total TSX files in merchant-control-plane; 61 do not yet import from `@letbuyy/ui`
- Some of those 61 files are non-UI (server components, API routes, type definitions) and never should
- The remaining custom components may have prop interfaces that do not map cleanly to `@letbuyy/ui` equivalents

**Prerequisites:**
- The component graduation checklist (Task 6) must be in place
- ESLint rules must be at `error` level for raw elements in all apps (Win 10 + Task 5 complete)
- A classification of the 61 files: how many are UI, how many are non-UI, how many are UI with blocking component gaps

**Mitigation:**
- Non-UI files (server components, route handlers, utility files) are excluded from the count — adoption rate should be measured only over UI-rendering files
- Execute in page-section batches aligned with feature ownership, not a single massive sweep
- Each batch is a PR no larger than 5-8 files

**Rollback Plan:** Any batch PR can be reverted. The component swap is isolated to the UI layer; no data or API behavior is affected.

---

### Initiative 5: Governance CI integration and ratchet automation

**Scope:** CI pipeline (`/.github/workflows/`) — integrate the design validator as a required check on every PR, with ratchet values read from a tracked baseline file.

**Impact:** The current ratchet is a local tool. If a developer does not run it before pushing, violations can land on the main branch. Making it a required CI check closes this gap permanently. No more manual "did someone run the validator?" in code review.

**Risk:** High (for velocity, not correctness). Adding a required CI check can block PRs and slow down delivery if the baseline is not carefully maintained or if the check is flaky.

**Why the risk is high:**
- The design validator currently counts violations across the whole codebase; if the baseline is updated incorrectly, every PR can fail
- False positives (validator counting generated files, vendor code, or intentional overrides) would create noise that teams learn to ignore

**Prerequisites:**
- The validator must be deterministic and fast (under 30 seconds on the full tree)
- A clear policy for when the baseline can be updated (only on deliberate "cleanup" PRs, never on feature PRs)
- All active apps must be below the current ratchet threshold before CI enforcement lands

**Mitigation:**
- Start with the validator as a non-blocking `workflow_dispatch` check that reports but does not fail PRs
- After 4 weeks of clean reports (no new violations landing), promote to a blocking required check
- Maintain the ratchet baseline file in the repository (`scripts/validators/design-ratchet.json`) with explicit ownership

**Rollback Plan:** The CI check can be removed from required checks in the GitHub branch protection settings. This is a repository settings change, not a code change — it takes 30 seconds to revert.

---

## Critical Risks

### Do Not Touch Payment and Checkout Flows Until Phase 3

`apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/` and `checkout/CheckoutClient.tsx` handle real money. These files already use some raw HTML elements (`<button>`, `<input>`) flagged by the ESLint plugin. Do not migrate these as part of any broad sweep. Migrate them only in an isolated PR with dedicated payment flow testing.

### Do Not Reorganize @letbuyy/ui Exports Before V1 Launch

The `index.ts` public API surface is stable. Any reorganization (moving exports, renaming types, splitting the package) is a breaking change for every consuming app. This must wait until after V1 launch when migration windows can be planned deliberately. The codemods exist precisely to handle these changes — but running them on 100+ files simultaneously is a V2 activity.

### Do Not Run the CSS Variable Renaming Codemod (token-alias-rename.cjs) Without a Full Test Pass

The `token-alias-rename.cjs` codemod renames CSS custom properties across `.css` files. The deprecated token alias variables in `tokens.ts` (lines 9-21 of `deprecations.ts`) are already removed from the output CSS. Running this codemod against a CSS file that still consumes a deprecated alias will produce correct output — but only if the file has already been updated to import the new `letbuyyTokenCss` output. Never run this codemod on a CSS file that has not first been migrated to the v4 token import path.

### Do Not Change the letbuyy-tokens.css @theme Block Without Token Architecture Review

`config/tailwind/letbuyy-tokens.css` is imported by every app's globals.css. A change to any `@theme {}` variable name breaks the entire platform simultaneously. This file's API surface should be considered frozen. New utilities can be added; existing utilities cannot be renamed or removed without a platform-wide migration plan.

### Marketing-Site @letbuyy/ui Component Imports Are Read-Only Icons

The marketing site imports only icon exports from `@letbuyy/ui` (e.g. `ArrowRight`, `Zap`). Do not add merchant admin component imports (`Card`, `Table`, `PageHeader`) to the marketing site — they carry the admin visual language and density system, which would conflict with the marketing site's intentional design.

### The Deprecated Token Aliases Must Not Be Resurrected

`tokens.ts` lines 9-21 define a `deprecatedTokenAliasVariables` set: `--lb-color-text-primary`, `--lb-color-text-secondary`, `--lb-color-border-default`, `--lb-color-border-subtle`, `--lb-color-danger`, and others. These are explicitly deleted from the CSS variable output. If any code is found consuming these deprecated names, it must be updated to the current names — never re-add the aliases to the token output to "fix" a consumer.

### Wait for V1 Launch Before storefront-runtime Token Migration

`apps/storefront-runtime` is the consumer-facing Liquid/React hybrid storefront. Its theming system is fundamentally different from the merchant admin — it uses brand overrides from the merchant's theme configuration (`createLetbuyyBrandVariables`). Token migration in the storefront layer is a separate initiative from the merchant admin and identity platform migrations. Conflating them risks breaking live storefronts.
