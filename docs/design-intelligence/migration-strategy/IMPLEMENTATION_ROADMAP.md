# LetBuyy Design System Implementation Roadmap

Date: 2026-06-19
Horizon: 6 months post-Phase 0 baseline

This roadmap sequences the migrations defined in `DESIGN_MIGRATION_STRATEGY.md` into calendar phases. Each phase has defined success criteria. No phase begins until the previous phase's success criteria are met.

---

## Phase 0: Foundation Audit (Week 1)

**Objective:** Establish baselines, complete design intelligence documentation, make zero code changes.

### Activities

1. Run `node scripts/validators/validate-design-system.mjs` and record the current ratchet values as the official baseline. Store in `scripts/validators/design-ratchet-baseline.json`.

2. Run `pnpm --filter merchant-control-plane lint 2>&1 | grep "@letbuyy/ui" | wc -l` and record the total count of ESLint violations by rule.

3. Complete the design intelligence repository (this directory). Ensure all 12 subdirectories have their primary documents:
   - `application-intelligence/` — per-app adoption analysis
   - `component-intelligence/` — component usage map
   - `design-debt/` — debt inventory by file
   - `governance/` — rule configuration audit
   - `migration-strategy/` — this document

4. Document the current component adoption rate per app:
   - merchant-control-plane: 39% (39/100 TSX files)
   - identity-platform: 67% (10/15 TSX files)
   - marketing-site: 15% (7/48 TSX files)

5. Take informal visual snapshots (browser screenshots) of the following pages in both light and dark mode at 360px and 1280px — these are the regression baseline for Phase 1:
   - merchant-control-plane: Products, Dashboard, Customers, Orders, Coupons, Settings/Billing
   - identity-platform: Login, Signup, Onboarding (all 3 steps)

### Success Criteria

- [ ] Ratchet baseline values recorded in a tracked file
- [ ] ESLint violation counts recorded per rule per app
- [ ] Visual snapshots taken for all baseline pages
- [ ] Zero code changes merged during Phase 0

---

## Phase 1: Quick Wins (Weeks 2-4)

**Objective:** Reduce debt counts, establish migration patterns, zero functional changes.

### Week 2: Codemod execution and low-risk radius fixes

Execute the following Quick Wins from the strategy document in order. Each win is a separate PR.

**PR 1-A:** `badge-danger-to-critical` codemod across all apps (Win 7)
- Run dry, review, run live
- Success: zero deprecation warnings for `Badge danger` in console

**PR 1-B:** `page-aliases-to-canonical` codemod across all apps (Win 8)
- Run dry, review, run live
- Success: zero deprecation warnings for page layout aliases in console

**PR 1-C:** `tailwind-default-color-to-token` on merchant-control-plane (Win 1)
- Target: all 38 flagged files in `apps/merchant-control-plane/src`
- Run dry, review diff visually in browser, run live
- Success: `tailwindPaletteClasses` ratchet count reduced by at least 60%

**PR 1-D:** Arbitrary radius fixes for settings pages (Win 2)
- Target: 6 settings page files
- Success: `tsxArbitraryRadius` count reduced, settings pages pass visual comparison against baseline screenshots

### Week 3: More radius fixes and identity-platform CSS wins

**PR 1-E:** Arbitrary radius fixes for contact/comments/posts/gallery/testimonials (Win 3)
- Target: 5 content page files
- Success: same as 1-D

**PR 1-F:** Wire identity-platform local CSS vars to `--lb-*` equivalents (Win 4)
- Target: `apps/identity-platform/src/app/globals.css` lines 5-33
- Success: auth and onboarding pages pass visual comparison against baseline screenshots in both light and dark mode

**PR 1-G:** Remove `.dark {}` overrides block in identity-platform (Win 5)
- Dependent on 1-F being merged and deployed
- Success: dark mode still works correctly for all auth pages

### Week 4: ESLint severity promotion and inline style audit

**PR 1-H:** Promote `no-tailwind-default-color` to `error` in merchant-control-plane (Win 10)
- Dependent on 1-C being merged
- Success: `pnpm --filter merchant-control-plane lint` exits clean

**PR 1-I:** Resolve the 7 files with inline `style={{}}` in merchant-control-plane (Win 9)
- Static inline styles converted to Tailwind utilities with `var(--lb-*)` references
- Dynamic inline styles documented with comments explaining why they must remain
- Success: `tsxInlineStyles` ratchet count reduced

### Phase 1 Success Criteria

- [ ] `tsxArbitraryRadius` count in merchant-control-plane reduced by at least 30 instances
- [ ] `tailwindPaletteClasses` count in merchant-control-plane reduced by at least 60%
- [ ] `tsxInlineStyles` count in merchant-control-plane at 0 for static values
- [ ] identity-platform CSS no longer defines raw `rgb()` values for semantically-named custom properties
- [ ] Zero console deprecation warnings from `@letbuyy/ui` in any app
- [ ] No regressions detected against baseline visual snapshots
- [ ] All quick win PRs reviewed and merged within 3 weeks

---

## Phase 2: Token Adoption (Month 2)

**Objective:** Drive token compliance to 80%+ in merchant-control-plane. Complete the identity-platform CSS consolidation. Begin structured marketing-site integration.

### Week 5-6: merchant-control-plane medium complexity migrations

**PR 2-A:** Products page and products/new page arbitrary radius elimination (Task 1)
- The two most complex pages; execute carefully
- Visual review at 360px, 768px, 1280px in both themes
- Success: `tsxArbitraryRadius` count reduced below 50 total in merchant-control-plane

**PR 2-B:** Replace raw `<select>` and `<textarea>` elements in settings pages (Task 4 — settings only)
- Target: `settings/domains/page.tsx`, `settings/plan/page.tsx`
- Success: all flagged raw form controls in settings replaced, `no-raw-form-controls` warnings eliminated for settings files

**PR 2-C:** Replace raw `<select>` and `<textarea>` in domain management components (Task 4 — continued)
- Target: `ConnectDomainWizard.tsx`, `DomainDetailView.tsx`
- Success: domain flow passes keyboard navigation testing

### Week 7-8: identity-platform CSS architecture consolidation

**PR 2-D:** identity-platform remaining local custom property consolidation (Task 2)
- Map `--accent-cyan`, `--text-tertiary`, `--text-hint`, `--primary-light` to `--lb-*` primitives or document as intentional identity-surface overrides
- Success: identity-platform globals.css has zero raw `rgb()` values not going through a `--lb-*` variable or an explicitly documented identity-surface override

**PR 2-E:** If Task 2 identifies identity-platform color values that diverge from `--lb-*` primitives, create an `identity` surface override file in the token layer
- This is a new surface variant, not a change to existing surfaces
- Success: `[data-letbuyy-surface="identity"]` selector applies the lavender/violet palette consistently across the auth app

### Week 7-8 (parallel): marketing-site structural token adoption

**PR 2-F:** Wire marketing-site typography to `--lb-font-family-*` tokens (Task 3 — typography only)
- Replace hard-coded font stack declarations with `var(--lb-font-family-body)`, `var(--lb-font-family-display)`, `var(--lb-font-family-mono)`
- Success: font changes propagate to marketing site automatically with token updates

**PR 2-G:** Wire marketing-site breakpoints to `--lb-bp-*` tokens
- Replace hard-coded breakpoint values with `var(--lb-bp-sm)`, `var(--lb-bp-md)`, etc.
- Success: breakpoint-responsive behavior uses the same scale as the rest of the platform

### Phase 2 Success Criteria

- [ ] `tsxArbitraryRadius` count in merchant-control-plane below 50
- [ ] `no-raw-form-controls` warnings in merchant-control-plane settings files: 0
- [ ] identity-platform globals.css: zero raw rgb() values not through `--lb-*` or documented identity overrides
- [ ] marketing-site typography and breakpoints wired to token layer
- [ ] merchant-control-plane component adoption rate: from 39% to 50%+

---

## Phase 3: Governance Infrastructure (Month 3)

**Objective:** Make governance automatic, not manual. Make it impossible to introduce new debt without an immediate CI signal.

### Week 9-10: ESLint severity promotion across all apps

**PR 3-A:** Promote `no-raw-color-functions` to `error` in merchant-control-plane (Task 5 — MCP only)
- Prerequisite: complete enumeration and resolution of all existing `no-raw-color-functions` warnings in MCP
- Success: `pnpm --filter merchant-control-plane lint` exits clean with no raw color function warnings

**PR 3-B:** Promote `no-raw-color-functions` to `error` in identity-platform (Task 5 — identity)
- Prerequisite: Phase 2 identity CSS consolidation complete
- Success: identity-platform lint exits clean

**PR 3-C:** Promote `no-tailwind-default-color` to `error` in identity-platform and storefront-runtime
- Success: both apps lint clean with no palette class warnings

### Week 11-12: CI integration

**PR 3-D:** Add the design validator as a non-blocking reporting check in CI
- Runs `node scripts/validators/validate-design-system.mjs` on every PR
- Reports results as a PR comment showing before/after ratchet counts
- Does NOT fail the build (yet)
- Success: every merged PR has a design validator report attached

**PR 3-E:** Component graduation checklist (Task 6)
- Add a `COMPONENT_GRADUATION.md` to `packages/typescript/ui/`
- Wire the checklist as a PR template item for any PR that modifies `index.ts`
- Success: every PR adding a new export includes the graduation checklist

**PR 3-F:** After 2 weeks of clean CI reports, promote the design validator to a blocking required check
- Add to `/.github/workflows/` as a required status check
- Store ratchet baseline in `scripts/validators/design-ratchet.json`
- Success: a PR that introduces a new `rounded-[...]` instance fails CI

### Phase 3 Success Criteria

- [ ] Design validator is a required CI check on all PRs
- [ ] `no-raw-color-functions` at `error` in merchant-control-plane and identity-platform
- [ ] `no-tailwind-default-color` at `error` in merchant-control-plane, identity-platform, storefront-runtime
- [ ] Component graduation checklist in place and referenced in PR template
- [ ] Zero new design violations merged in the last 2 weeks of the phase

---

## Phase 4: Product Design Systems (Months 4-6)

**Objective:** Define the distinct, documented design identity for each product surface. Make the design system genuinely useful for new feature development — not just a constraint, but a productivity tool.

### Month 4: Merchant admin identity solidification

**Initiative 4-A:** Complete merchant-control-plane arbitrary-radius elimination (Initiative 1)
- Execute in 5 batches: settings, list pages, detail/drawer pages, form pages, checkout/theme-editor pages
- Each batch is a separate PR with visual review checklist
- Success: `tsxArbitraryRadius` count in merchant-control-plane reaches 0

**Initiative 4-B:** Complete raw form control replacement in merchant-control-plane (Task 4 continuation)
- Target: `products/new/page.tsx`, `access_account/checkout/CheckoutClient.tsx` (last — highest risk)
- Success: `no-raw-form-controls` in merchant-control-plane reaches 0 warnings

**Initiative 4-C:** Raise merchant-control-plane component adoption to 70%+
- Classify all remaining non-importing TSX files: UI vs. non-UI
- For UI files: identify the cheapest `@letbuyy/ui` component to introduce that adds value
- Success: 70+ of the 100 TSX files import from `@letbuyy/ui`

### Month 5: Identity platform surface variant and marketing site visual system

**Initiative 5-A:** Publish the identity surface variant to `@letbuyy/ui/tokens`
- If Phase 2 identified divergent identity-platform color values, formalize them as a `LetbuyySurface = 'identity'` override in `tokens.ts`
- Success: identity-platform uses `[data-letbuyy-surface="identity"]` and gets both the token system and its own visual palette with zero custom property duplication

**Initiative 5-B:** Design sign-off on marketing-site visual system scope
- Define which marketing-site visual properties are "platform structural" (adopt tokens) vs. "marketing identity" (stay custom)
- Document the boundary in `apps/marketing-site/DESIGN_SCOPE.md`
- Success: a written, design-approved boundary document exists

**Initiative 5-C:** Marketing-site visual properties migration within the approved scope (Initiative 3)
- Execute the in-scope migrations: structural spacing, typography, breakpoints
- Leave out-of-scope properties (gradients, custom colors, hero effects) alone
- Success: marketing-site globals.css raw rgb() count reduced by at least 20%

### Month 6: Platform governance maturity

**Initiative 6-A:** Platform-wide component adoption audit and gap closure (Initiative 4)
- Complete the classification of all remaining non-adopting files
- Migrate the in-scope UI files to `@letbuyy/ui` components
- Success: platform-wide UI file component adoption rate above 75%

**Initiative 6-B:** CI blocking enforcement for all apps (Initiative 5)
- Design validator is a required check with a maintained baseline
- Baseline can only be updated via a labelled "design-cleanup" PR with explicit review
- Success: no new design violations in any app for 4 consecutive weeks

**Initiative 6-C:** Publish the LetBuyy Design Governance Handbook
- Consolidate all `docs/ui-standards/` documents into a navigable, versioned handbook
- Include: component graduation process, token naming conventions, migration patterns, app-specific identity guidance
- Success: any new engineer can onboard to the design system without reading source code

### Phase 4 Success Criteria

- [ ] merchant-control-plane `tsxArbitraryRadius` count: 0
- [ ] merchant-control-plane `no-raw-form-controls` warnings: 0
- [ ] merchant-control-plane component adoption: 70%+
- [ ] identity-platform surface variant: formalized in token layer
- [ ] marketing-site design boundary: documented and approved
- [ ] platform-wide component adoption: 75%+
- [ ] CI blocking enforcement: 4 consecutive clean weeks
- [ ] Design Governance Handbook: published

---

## Key Principles for Execution

### Always Ship Working Code

Every PR in this roadmap must ship code that builds, passes the ESLint check, and renders correctly in both light and dark mode. A PR that fixes a token violation but breaks a page layout is not a step forward — it is a regression.

Before merging any migration PR:
1. `pnpm --filter <app> build` must succeed
2. `pnpm --filter <app> lint` must not introduce new errors
3. A visual comparison against the baseline snapshot must show no unintended changes
4. Dark mode toggle must produce a correct dark appearance

### Never Break Existing User Flows

The migration order respects this principle:
- Settings pages before list pages before detail pages before form pages before checkout/payment pages
- Identity platform CSS before identity platform components
- Marketing structural tokens before marketing visual tokens

Checkout, payment, and auth flows are always last in any migration wave.

### Always Have a Rollback Plan

Every PR in this roadmap is independently revertable. No PR should be structured so that reverting it breaks a subsequent PR. The dependency chain in each phase is linear for a reason: completing PR N does not make PR N-1 un-revertable.

For any PR touching CSS: a revert restores the CSS file, which is a pure text file. No database changes, no API changes, no generated output that must be cleaned up.

### Token First, Component Second

The correct migration order within a single file is:
1. First, fix CSS token violations (raw colors, arbitrary values in globals.css)
2. Second, fix Tailwind utility violations (palette classes → token-backed utilities)
3. Third, replace raw HTML elements with `@letbuyy/ui` components
4. Last, replace inline styles with Tailwind utilities using `var(--lb-*)` references

Reversing this order (replacing components first) can create a situation where the component is correct but its surrounding CSS still uses hardcoded values, making the component appear broken in dark mode.

### Governance Before Cleanup

Phase 3 (governance infrastructure) comes before the large Phase 4 cleanup initiatives. This is intentional. Running a massive cleanup before the CI gate exists means new violations can sneak back in immediately after the cleanup lands. The CI gate locks in the gains before more cleanup begins.

### Measure Everything, Assume Nothing

Every ratchet value recorded in Phase 0 is the authoritative before-state. Every phase ends with a measurement against the ratchet. If a phase's PRs did not move the needle, investigate before proceeding — something is either mis-classified or being re-introduced elsewhere.

---

## Tracking and Reporting

### Ratchet Metrics to Track (from the validator)

| Metric | Phase 0 Baseline | Phase 1 Target | Phase 2 Target | Phase 3 Target | Phase 4 Target |
|--------|-----------------|----------------|----------------|----------------|----------------|
| `tsxArbitraryRadius` (merchant-control-plane) | 127 | < 95 | < 50 | < 30 | 0 |
| `tailwindPaletteClasses` (merchant-control-plane) | TBD from Phase 0 | -60% | -80% | -90% | 0 |
| `tsxInlineStyles` (merchant-control-plane) | 7 files | 0 static | 0 | 0 | 0 |
| `appCssNakedRgbHsl` (identity-platform globals.css) | ~10 | 0 | 0 | 0 | 0 |
| Component adoption (merchant-control-plane) | 39% | 42% | 50% | 60% | 70% |
| Component adoption (identity-platform) | 67% | 70% | 75% | 80% | 80% |
| Component adoption (marketing-site) | 15% | 15% | 18% | 22% | 30% |

Note: Fill in `TBD` values during Phase 0 by running the validator and recording actual counts.

### PR Labelling Convention

Every migration PR should carry the label `design-migration` and a phase tag (`phase-1`, `phase-2`, etc.). This makes it trivial to filter the merged PR list and produce a phase completion report.

### Escalation Triggers

Stop the phase and escalate to design + engineering leadership if:
- A visual regression is detected in a payment or auth flow
- The ratchet count for a metric increases (rather than decreases) at the end of a phase
- A CI check that was passing starts failing on unrelated PRs after governance enforcement is added
- A codemod produces unexpected output on more than 5% of the files it touches
