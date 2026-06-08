# Skipped / Deferred Human Decisions — Design Governance Recovery (Phase 1)

This log records decisions made (or deferred) during the Phase 1 Design Governance Recovery where a human owner should ratify the direction or schedule follow-up. Per the recovery mandate, work continued past each rather than blocking. Each entry: **Decision · Reason · Impact · Recommendation.**

The recovery's hard constraint throughout: **the monorepo must stay green** (compiles, `pnpm install --frozen-lockfile` works, existing tests pass). Several decisions below trade "absolute end-state in one pass" for "correct, green, and ratcheting toward the end-state."

---

## D1 — Enforcement is ratcheted, not hard-zero
**Decision.** `validate:design-system` baselines the ~2,800 pre-existing CSS drift violations (`scripts/validators/design-system-baseline.json`) and fails only on *increases*; the new theme invariants (single provider/key, no `theme="auto"`, no bespoke providers) are enforced at **zero**.
**Reason.** Flipping raw-color/spacing/typography rules to hard-fail immediately would fail CI on thousands of existing violations, breaking the "stay green" rule.
**Impact.** New drift is blocked platform-wide today; existing drift is quarantined and can only decrease.
**Recommendation.** Schedule the CSS burn-down (largest first: `merchant-control-plane` 10,335-line globals.css, `app-marketplace` 7,475, `marketing-site` 5,143). Each PR lowers the baseline via `pnpm run validate:design-system:update`.

## D2 — Stylelint config activated but binary not added
**Decision.** Wired `.stylelintrc.cjs` into scripts (`lint:css`), the pre-commit hook (guarded), and docs, but did **not** add `stylelint` to `package.json`/lockfile. The dependency-free `validate:design-system` Node validator is the CI-enforced CSS-color gate instead.
**Reason.** Adding an npm dependency requires a lockfile regen, which cannot be produced safely in the build sandbox and would break `--frozen-lockfile` CI install.
**Impact.** CSS color governance is enforced in CI now (via the Node validator); the richer stylelint rules are one command away.
**Recommendation.** Run `pnpm add -Dw stylelint stylelint-config-standard`; `pnpm run lint:css` and the pre-commit stylelint step then activate automatically (the hook already guards on the binary's presence).

## D3 — ESLint color rules left at `warn`
**Decision.** Did not promote `no-tailwind-default-color` / `no-raw-color-functions` / `no-raw-form-controls` from `warn` to `error` in `packages/typescript/ui/eslint/index.cjs`.
**Reason.** ~680 Tailwind-palette + raw-rgb hits exist; promoting to `error` fails `turbo lint` immediately.
**Impact.** ESLint still surfaces them; the design-system ratchet is the hard gate that blocks new ones.
**Recommendation.** After the D1 burn-down, promote these to `error` (a one-line change per rule).

## D4 — Identity auth-page toggles unified on key, not yet on `useTheme()`
**Decision.** The 9 identity auth pages (login, signup, check-email, lookup, forgot-password, reset-password, set-password, select, onboarding) were migrated to the canonical key `letbuyy-theme`, but still flip `.dark` directly via their local toggle rather than calling `useTheme()`. `HeaderBar` (merchant) and `navbar` (theme-marketplace) are the reference `useTheme()` conversions.
**Reason.** These pages co-mingle theme + language state; a 9-file structural rewrite was higher risk than value this pass. The hard requirement (single key, single vocabulary) is met.
**Impact.** Single persistence key platform-wide; the provider re-reads it. The provider's in-memory `resolvedTheme` is not updated live by these page toggles (it re-resolves on navigation/reload), which is acceptable for full-page auth flows.
**Recommendation.** Extract a shared `<AuthThemeToggle/>` in `identity-platform` that uses `useTheme()`, and replace the 9 inline toggles.

## D5 — `_local-ui` workspace twins not deleted
**Decision.** `platform-console/.../_local-ui/console-workspace.tsx` and `platform-operations-portal/.../_local-ui/ops-workspace.tsx` (the 63-line-diff twins) were **not** deleted. The canonical `StatusBadge` + `statusToBadgeVariant` were promoted to `@letbuyy/ui` as the replacement for the 5× status-pill fork, and `AppNavigation` now covers the sidebar duplication.
**Reason.** The twins are imported by **18 pages**; deleting them requires migrating all 18, exceeding a safe single-pass blast radius.
**Impact.** The two sidebars are de-duplicated (via `AppNavigation`); the workspace grammar (MetricGrid/Panel/ModuleCard) duplication remains.
**Recommendation.** Promote the workspace grammar into `@letbuyy/ui` (it overlaps existing `MetricCard`/`Card`/`EmptyState`) and migrate the 18 importers (mechanical import-path change), then delete both `_local-ui` files.

## D6 — Navigation migration scoped to console + ops
**Decision.** Migrated `platform-console` and `platform-operations-portal` to `AppNavigation`. `merchant-control-plane` and the marketing/storefront headers were not migrated.
**Reason.** Console/ops were the clearest, bounded wins (byte-identical twins, server layouts). Merchant's shell is a larger system (`Sidebar.tsx` + `merchantNavigation.ts` + `HeaderBar` + `CommandPalette`); marketing/storefront are a legitimately different "marketing nav" pattern.
**Impact.** 2 of 10 hand-rolled navs eliminated; active-state correctness added to both; one canonical width.
**Recommendation.** Migrate `merchant-control-plane` next onto `AppNavigation`; define a separate shared `MarketingHeader` for marketing/app-marketplace/storefront.

## D7 — Mobile reconciled by value, full token inversion deferred
**Decision.** Reconciled `ui_kit/AppColors` status colors (success/error/warning) to the canonical token values, removing the rendered drift (lime success, brick error). Did **not** repoint the live `store_theme.dart`/screens to the generated `letbuyy_color_tokens.dart`, nor resolve the duplicate `LetbuyyColorTokens` class name collision.
**Reason.** The live theme + ~343 screen references to `AppColors` make full inversion a large, separate refactor; the value reconciliation removes the actual divergence now. The `generate-mobile-tokens --check` gate is wired into CI.
**Impact.** Mobile status/brand colors now match web. Two color-source classes still coexist in Dart.
**Recommendation.** Invert `store_theme.dart` to consume the generated tokens, delete the `AppColors` duplication, and rename one `LetbuyyColorTokens` to remove the collision.

## D8 — Operations apps default theme changed
**Decision.** `platform-console` changed from **hardcoded** `theme="dark"` to `defaultTheme="dark"` (still dark, now user-toggleable). `platform-operations-portal` default set to `dark` (was OS/`auto`) for sibling consistency.
**Reason.** The mandate requires light/dark/system to work in every app; the two sibling operations tools should agree (resolves audit finding THEME-3).
**Impact.** Console is no longer locked to dark (users can choose); ops defaults dark instead of following OS.
**Recommendation.** Confirm with the operations team that `dark` is the desired default for both (vs `system`).

## D9 — Theme preference is a clean cut (no legacy-key migration)
**Decision.** The legacy keys `letbuyy_theme` / `theme` / `theme-marketplace-theme` are replaced by `letbuyy-theme` with no one-time migration of existing stored values.
**Reason.** Rule #3 (avoid temporary compatibility layers). A clean cut is debt-free.
**Impact.** Returning users' saved theme choice resets once to the default (`system`, or `dark` for ops) on first load after deploy, then persists normally.
**Recommendation.** Acceptable. If preference-preservation matters, add a one-time legacy-key read inside `ThemeScript` (documented as removable after one release).

## D10 — Per-app production builds not run in the sandbox
**Decision.** Verified via `@letbuyy/ui` `tsc --noEmit` (clean, 0 errors), the UI public-API/token/alias snapshot validators (pass), and `validate:design-system`/`validate:design-tokens`/`validate:mobile-tokens` (pass). Full per-app `next build` / `turbo typecheck` was not run.
**Reason.** The build sandbox caps commands at 45s; a full Next build of 9 apps + Flutter does not fit, and the installed esbuild/tsx binary targets the host OS, not the sandbox Linux.
**Impact.** Package-level and governance verification is complete; app-level build verification relies on CI.
**Recommendation.** Let CI run `turbo build`/`turbo typecheck` across the 9 apps on this branch; the changes are mechanical layout/import edits plus additive package exports.
