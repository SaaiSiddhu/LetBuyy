# `uiux` lane — canonical design-system compliance (donor apps and marketing are HOLD)

**Scope (OWNER_DECISION 2026-09-04, D-UIUX):** review and build only against the **canonical design
system** — `@letbuyy/ui` (`packages/typescript/ui`), its `--lb-*` token engine, the generated Dart
bridge in `packages/dart/ui_kit`, and the constitution in `references/uiux/*.md` — for
`apps/customer_web`, `apps/merchant_web`, `apps/admin_web`, `apps/identity-platform` and
`apps/merchant_app`. **`apps/customer_app`, `apps/admin_app`, `apps/phase_2/*`, `apps/marketing-site`
and the FROZEN apps are ON HOLD**: donor UI is preserved by design until D-0/D-4; the lane reviews
them only for accessibility and safety regressions and never re-skins. If a request is donor or
marketing UI work, say so, cite this file, and stop.

**Canonical-first rule (owner, 2026-09-04):** where no proper canonical system exists for a surface,
the lane's first job is to make it canonical — reference + gate — and only then roll it out across the
codebase. `uiux/CANONICALIZATION_PROGRAMME.md` is that rollout, phase by phase; it is planned, not
executed, by GOV-3.

## 1. Hard rules

- **All UI from the canonical exports only.** Web: `@letbuyy/ui` (`.`, `./formatting`, `./tokens`,
  `./preview`, `./marketplace`, `./logging`). Flutter: `package:letbuyy_ui_kit`. A missing primitive =
  stop and report, never hand-roll; forking an exported primitive is forbidden (DOC 06 UX-R9).
- **Tokens, not values.** `var(--lb-*)` on the web; the generated `letbuyy_tokens.dart` classes in
  Flutter. No raw hex, `px`, inline `style={}` (except blessed per-store dynamic theming), Tailwind
  default-palette classes, app-local `--lb-*` redefinitions, literal-px `@media`, `Color(0x…)`,
  `fontSize:` or `GoogleFonts.inter()` outside the theme layer (UX-R3, R6–R8, R12, R18, R2, R7).
- **The ratchet blocks and repays.** `scripts/validators/validate-design-system.mjs` never goes
  `--update` to clear a red; every metric only decreases (UX-R29). Its HARD invariants (dark-mode
  reachability targets, `theme="auto"` ban, app-local workspace twins) are S1 defects, not debt.
- **Nine states, both themes** (UX-R5, §4.6): light · dark · skeleton · empty · error-with-retry ·
  focus · hover · active · disabled — token-driven, on every interactive component and data surface.
- **WCAG 2.1 AA is the floor, a launch gate for money and auth surfaces** (UX-R15–R17;
  `uiux/ACCESSIBILITY_RELEASE_GATES.md`). No migration may regress accessibility.
- **India-first** (`docs/ui-standards/india-localization.md`): INR via `formatInrCurrency`, `en-IN`
  dates, GSTIN capture, pincode serviceability, `+91`, Razorpay + COD, mid-range Android on patchy
  networks. Money columns are tabular (UX-R21).
- **Honesty is supreme over polish** (UX-R33): `ProviderModeBadge` on every money/fulfilment surface,
  bound to backend `provider_mode`; a stub never renders `success`.
- Single agent. No design "explorations" that fan out.

## 2. The canonical inventory (measured 2026-09-04 at `823aa5ee`; re-verify paths)

```
Tokens       packages/typescript/ui/src/tokens.ts (1,749 lines; 307 --lb-* variables) → tokens.json (DTCG, 8,867 B)
             → letbuyyTokenCss / DesignSystemRoot (web) · packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart (183 consts,
             7 classes: Primitive/Color/Typography/Spacing/Radius/Shadow/Density) via scripts/generators/generate-mobile-tokens.mjs
             Axes: theme light|dark · density compact|comfortable|spacious · surface admin|marketplace|storefront|identity|operations
             Brand injection createLetbuyyBrandVariables + WCAG validateLetbuyyBrandContrast · breakpoints letbuyyBreakpointTokens → letbuyyTailwindPreset
Shell        AppFrame · Sidebar · Navigation · AppNavigation (src/navigation/app-navigation.tsx) · isNavItemActive · ScrollThumb
Layout       Page · PageHeader(+Actions) · PageContent · Card · Section · Box · BlockStack · InlineStack · Grid · Columns · Container · Text
Controls     Button · Input · Textarea · NumberField · InlineError · Checkbox · Radio · Switch · Select · Combobox · ChoiceList · Tabs
             SegmentedControl · DensityToggle · FilterChips · DatePicker · DateRangePicker
Data         Table · MetricCard · Chart · DescriptionList · ProgressBar · Pagination · FilterBar · CommandPalette · Avatar
Feedback     Badge · StatusBadge · StatusPresentationBadge · ProviderModeBadge · Banner · ToastProvider/useToast · Skeleton
             EmptyState(+EmptyStateIllustration, 36 motifs) · SaveBar · Spinner · Disclosure · Accordion · Divider
Overlays     Modal · Drawer · Dropdown/DropdownMenu · Popover · Tooltip · ConfirmDialog
Theme        DesignSystemRoot · ThemeToggleButton · theme provider (localStorage "letbuyy-theme": light|dark|system)
Fonts/icons  fonts.ts (--font-letbuyy-sans/display/mono stacks → system-ui fallback) · icons.tsx (lucide-react re-exports)
Flutter kit  packages/dart/ui_kit/lib/src/{tokens,themes,widgets}: badge · confirmation_dialog · custom_app_bar/bottom_nav/button/
             drawer/text_field · empty_state (+ a duplicate empty_state_widget) · error_view (+ a duplicate error_widget) · loading_indicator
             · loading_overlay · shimmer_loading · network_image · rating · search_bar · glass_container
Docs         GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md (DOC 06, the constitution; rules UX-R1…R33)
             docs/ui-standards/*.md (10) · docs/design-system/*.md + tokens.reference.css · packages/typescript/ui storybook (:9009)
Gates        validate-design-system.mjs (ratchet + HARD) · generate-design-tokens.mjs --check · generate-mobile-tokens.mjs --check
             pnpm --filter @letbuyy/ui run validate:ui (vitest + eslint rules + codemods + api/token/alias snapshots) · jest-axe in ui
             stylelint installed; `pnpm run lint:css` runs in ci.yml's lint job (:98) · token-source-single-validator · shell-single-validator · provider-mode-badge-validator
```

Adoption at `823aa5ee` (files importing, per app): `@letbuyy/ui` customer_web 44/114 tsx ·
merchant_web 122/141 · admin_web 21/33 · identity 10/15 · marketing 33/69. `AppNavigation`
merchant_web 2 · admin_web 1 · others 0. `ThemeToggleButton` customer_web 1 · admin_web 1 ·
marketing 1 · merchant_web 0 · identity 0. `DesignSystemRoot` merchant_web 1, others 0. Ratchet at
`823aa5ee`: 8 of 11 metrics **below** the 2026-08-14 baseline, 3 level, **1 HARD violation**:
`identity-platform: dark-mode reachability target file is missing` (`uiux/EVIDENCE_LEDGER.md`).

## 3. Workflow for any UI change

1. **Locate** the live files: which app, which surface token (`LetbuyySurface`), what exists
   (`git grep -n "<Component"` in `packages/typescript/ui/src`).
2. **Classify** the ask: canonical-app change · donor/marketing (HOLD) · new primitive (STOP) ·
   canonicalization phase (`uiux/CANONICALIZATION_PROGRAMME.md`).
3. **Compose** from the inventory; open the relevant `uiux/*.md` before designing.
4. **Prove**: keyboard pass, accessible names, contrast measured per
   `uiux/ACCESSIBILITY_RELEASE_GATES.md` §5, 400% zoom / 320 px reflow, reduced motion, forced
   colours, the 768–1023 tablet band, tabular money.
5. **Anti-template checklist** (`uiux/ANTI_AI_TEMPLATE_CHECKLIST.md`): every failed item is a defect.
6. **Browser evidence**: boot the runtime **after** gates (`pnpm run dev:store` or the app's `dev`),
   open the screen in the preview at 360 / 414 / 768 / 1024 / 1280, light and dark, and record what
   was seen. `next dev` findings are not defects until `next build && next start` reproduces them.
7. **Report** exact paths, commands, exit codes, and what you did not do.

## 4. Validation commands

```bash
pnpm run typecheck && pnpm run lint
node scripts/validators/validate-design-system.mjs          # ratchet + HARD; never --update to clear a red
node scripts/generators/generate-design-tokens.mjs --check && node scripts/generators/generate-mobile-tokens.mjs --check
pnpm --filter @letbuyy/ui run validate:ui                    # vitest + eslint rules + codemods + snapshots
pnpm run lint:css                                            # stylelint on apps/**/src/**/*.css and packages/**/src/**/*.css
node scripts/validators/provider-mode-badge-validator.mjs && node scripts/validators/token-source-single-validator.mjs && node scripts/validators/shell-single-validator.mjs
( cd apps/merchant_app && flutter analyze && flutter test )  # the Flutter canary (172 tests)
```

## 5. Lane report

```
UIUX LANE — <phase>
Verdict: PASS | PASS_WITH_FINDINGS | BLOCKING | HOLD (donor/marketing)
Components used (path) · raw-element grep result · new components: 0 (or STOP)
Tokens: hardcoded values found (path:line) · ratchet metrics before/after (validator output, SHA, tree clean?)
a11y: names/contrast/keyboard/reflow/motion/forced-colors results · money surfaces: ProviderModeBadge present?
Viewports checked: 360/414/768/1024/1280 × light/dark — evidence paths
Gates run: names + exit codes
Findings: severity · path:line · rule (UX-R#) · fix
```

`BLOCKING` = a new component, a forked primitive, a hardcoded token value, a ratchet regression in a
committed tree, a HARD invariant violation, a failed a11y gate on a money/auth surface, a missing
`ProviderModeBadge` on a money surface, or a design that requires data the app must not have.

## 6. Reference router (`references/uiux/`)

| Question | File |
|---|---|
| Colour, type, spacing, tokens, components, states, shell, motion | `LETBUYY_UI_UX_PRINCIPLES.md` |
| Breakpoints, touch, mobile nav, reflow, India-first devices | `MOBILE_FIRST_RESPONSIVE_RULES.md` |
| Any a11y question or release gate | `ACCESSIBILITY_RELEASE_GATES.md` |
| Budgets, animation, images, fonts, third parties | `PERFORMANCE_AND_MOTION_BUDGETS.md` |
| Icons, fonts, licences, adding a dependency | `ICONOGRAPHY_AND_LICENSING.md` |
| Before calling any UI done | `ANTI_AI_TEMPLATE_CHECKLIST.md` |
| The rollout: what is canonical, what is not, phase order | `CANONICALIZATION_PROGRAMME.md` |
| What was measured, when, at which commit | `EVIDENCE_LEDGER.md` |
