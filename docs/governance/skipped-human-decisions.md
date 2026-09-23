# Skipped / Deferred Human Decisions — Design Governance Recovery (Phase 1)

This log records decisions made (or deferred) during the Phase 1 Design Governance Recovery where a human owner should ratify the direction or schedule follow-up. Per the recovery mandate, work continued past each rather than blocking. Each entry: **Decision · Reason · Impact · Recommendation.**

The recovery's hard constraint throughout: **the monorepo must stay green** (compiles, `pnpm install --frozen-lockfile` works, existing tests pass). Several decisions below trade "absolute end-state in one pass" for "correct, green, and ratcheting toward the end-state."

---

## D1 — Enforcement is ratcheted, not hard-zero
**Decision.** `validate:design-system` baselines the ~2,800 pre-existing CSS drift violations (`scripts/validators/design-system-baseline.json`) and fails only on *increases*; the new theme invariants (single provider/key, no `theme="auto"`, no bespoke providers) are enforced at **zero**.
**Reason.** Flipping raw-color/spacing/typography rules to hard-fail immediately would fail CI on thousands of existing violations, breaking the "stay green" rule.
**Impact.** New drift is blocked platform-wide today; existing drift is quarantined and can only decrease.
**Recommendation.** Schedule the CSS burn-down (largest first: `merchant-web` 10,335-line globals.css, `app-marketplace` 7,475, `marketing-site` 5,143). Each PR lowers the baseline via `pnpm run validate:design-system:update`.

## D2 — Stylelint config and binary ✅ RESOLVED (2026-06-10)
**Status.** Closed. `stylelint@17.13.0` and `stylelint-config-standard@40.0.0` are installed at the workspace root, `pnpm-lock.yaml` is updated, `.stylelintrc.cjs` is the active config, and both CI governance workflows run `pnpm run lint:css`.
**Why it mattered.** The CSS channel is now a real blocking gate instead of a dormant local script. The broad design-token debt remains governed by `validate:design-system`'s ratchet so the first stylelint activation does not rebaseline or mass-fail pre-existing CSS drift.
**Verified.** `pnpm run lint:css` passes.

## D3 — ESLint color rules left at `warn`
**Decision.** Did not promote `no-tailwind-default-color` / `no-raw-color-functions` / `no-raw-form-controls` from `warn` to `error` in `packages/typescript/ui/eslint/index.cjs`.
**Reason.** ~680 Tailwind-palette + raw-rgb hits exist; promoting to `error` fails `turbo lint` immediately.
**Impact.** ESLint still surfaces them; the design-system ratchet is the hard gate that blocks new ones.
**Recommendation.** After the D1 burn-down, promote these to `error` (a one-line change per rule).

## D4 — Identity auth-page toggles → `useTheme()` ✅ RESOLVED (2026-06-09)
**Status.** Closed. All 9 identity auth pages (login, signup, check-email, lookup, forgot-password, reset-password, set-password, select, onboarding) now route their theme toggle through the canonical provider via a shared `useAuthTheme()` hook (`apps/identity-platform/src/lib/useAuthTheme.ts`, backed by `@letbuyy/ui` `useTheme()`). The local `isDark` state, mount-effect `.dark` application, and per-page `toggleTheme` functions were removed. The provider's `resolvedTheme` now updates live on toggle, so `@letbuyy/ui` components (e.g. `Banner`) flip with the page.
**Why it mattered.** Surfaced live: the onboarding `<Banner variant="info">` rendered light-theme tokens on a dark page (light-on-light washout) because the page toggle flipped `<html>.dark` without updating `LetbuyyThemeProvider`, leaving `DesignSystemRoot` on the stale theme.
**Also.** `colorScheme` is now set centrally by the provider (`applyDomSignals` + `ThemeScript`), replacing the per-page `document.documentElement.style.colorScheme` writes the pages used to do — native scrollbars/inputs match the theme for every app.
**Verified.** `@letbuyy/ui` + `identity-platform` `tsc --noEmit` clean; `validate:design-system` passes.
**Superseded for identity-platform (2026-09-23).** The owner decided that the auth surface is light-only, with no toggle: OWNER_DECISION D-AUTH-LIGHT, recorded in `.claude/skills/letbuyy/references/decisions.md` §2e. `useAuthTheme.ts` is deleted and the layout forces light (F-IDUI-1). D4's mechanism — theme changes flow only through the canonical provider — still binds every other app.

## D5 — `_local-ui` workspace twins not deleted
**Decision.** `admin-web/.../_local-ui/console-workspace.tsx` and `platform-operations-portal/.../_local-ui/ops-workspace.tsx` (the 63-line-diff twins) were **not** deleted. The canonical `StatusBadge` + `statusToBadgeVariant` were promoted to `@letbuyy/ui` as the replacement for the 5× status-pill fork, and `AppNavigation` now covers the sidebar duplication.
**Reason.** The twins are imported by **18 pages**; deleting them requires migrating all 18, exceeding a safe single-pass blast radius.
**Impact.** The two sidebars are de-duplicated (via `AppNavigation`); the workspace grammar (MetricGrid/Panel/ModuleCard) duplication remains.
**Recommendation.** Promote the workspace grammar into `@letbuyy/ui` (it overlaps existing `MetricCard`/`Card`/`EmptyState`) and migrate the 18 importers (mechanical import-path change), then delete both `_local-ui` files.

## D6 — Navigation migration scoped to console + ops
**Decision.** Migrated `admin-web` and `platform-operations-portal` to `AppNavigation`. `merchant-web` and the marketing/storefront headers were not migrated.
**Reason.** Console/ops were the clearest, bounded wins (byte-identical twins, server layouts). Merchant's shell is a larger system (`Sidebar.tsx` + `merchantNavigation.ts` + `HeaderBar` + `CommandPalette`); marketing/storefront are a legitimately different "marketing nav" pattern.
**Impact.** 2 of 10 hand-rolled navs eliminated; active-state correctness added to both; one canonical width.
**Recommendation.** Migrate `merchant-web` next onto `AppNavigation`; define a separate shared `MarketingHeader` for marketing/app-marketplace/storefront.

## D6A — Merchant shell migrated to `AppNavigation` ✅ RESOLVED (2026-06-10)
**Status.** Closed for merchant. `apps/merchant_web/src/components/AdminShell.tsx` now composes `@letbuyy/ui` `AppNavigation`, the local `Sidebar.tsx` fork is deleted, and the `shell-single` validator fails if the fork returns or the merchant shell drops `AppNavigation`.
**Also.** Merchant IA now exposes a first-class Money node routing to `settings/billing`.
**Verified.** `node scripts/validators/shell-single-validator.mjs` passes.

## D7 — Mobile reconciled by value, full token inversion deferred
**Decision.** Reconciled `ui_kit/AppColors` status colors (success/error/warning) to the canonical token values, removing the rendered drift (lime success, brick error). Did **not** repoint the live `store_theme.dart`/screens to the generated `letbuyy_color_tokens.dart`, nor resolve the duplicate `LetbuyyColorTokens` class name collision.
**Reason.** The live theme + ~343 screen references to `AppColors` make full inversion a large, separate refactor; the value reconciliation removes the actual divergence now. The `generate-mobile-tokens --check` gate is wired into CI.
**Impact.** Mobile status/brand colors now match web. Two color-source classes still coexist in Dart.
**Recommendation.** Invert `store_theme.dart` to consume the generated tokens, delete the `AppColors` duplication, and rename one `LetbuyyColorTokens` to remove the collision.

## D7A — Mobile token inversion ✅ RESOLVED (2026-06-10)
**Status.** Closed. `packages/typescript/ui/tokens.json` now feeds the generated Dart bridge at `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`; Flutter `AppTheme`/`AppColors` consume the generated bridge, and the app-local mobile token/color authorities were deleted.
**Verified.** `node scripts/validators/token-source-single-validator.mjs`, `node scripts/generators/generate-mobile-tokens.mjs --check`, and `node scripts/generators/generate-design-tokens.mjs --check` pass.

## D8 — Operations apps default theme changed
**Decision.** `admin-web` changed from **hardcoded** `theme="dark"` to `defaultTheme="dark"` (still dark, now user-toggleable). `platform-operations-portal` default set to `dark` (was OS/`auto`) for sibling consistency.
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

## D10 WhatsApp — BSP/WABA/HSM approval remains human-gated
**Decision.** Scoped WhatsApp order lifecycle and COD confirmation flows stay on the `letbuyy_sandbox` provider until a platform operator completes BSP/Meta WABA onboarding and template approval.
**Reason.** Live WhatsApp sender approval, HSM/template review, business verification, webhook secret provisioning, and provider credentials are external-provider actions that cannot be fabricated in source.
**Impact.** The repository can plan, consent-gate, persist, mirror, and audit WhatsApp lifecycle/COD sends, but the default send is sandbox-badged and does not reach real shoppers.
**Recommendation.** Complete `SKIP-D10-WHATSAPP-BSP-WABA-HSM` in `SKIPPED_HUMAN_DECISIONS.md`, then run live smoke evidence for `order_paid`, `order_shipped`, `order_delivered`, and `cod_confirmation`.
