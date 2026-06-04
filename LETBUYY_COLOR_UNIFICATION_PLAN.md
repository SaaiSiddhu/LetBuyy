# LetBuyy Color Unification Plan

Generated: 2026-06-03
Decision: **Purple `#8B5CF6` is the official LetBuyy brand color.**

This is a color-only migration plan. It does not redesign components, change typography, alter spacing, or restructure layouts.

## Global Migration Rules

1. Flutter and web must resolve to the same Purple V1 color system.
2. `#8B5CF6`, `#7C3AED`, and `#6D28D9` are canonical brand values.
3. Red remains only for danger, destructive, critical, failed, or security states.
4. Blue remains only for info, provider colors, charts, or documented exceptions.
5. Cyan remains only for merchant/storefront theme presets, charts, or legacy references until explicitly migrated.
6. Indigo is support-only and must not be used as the primary LetBuyy brand.
7. Do not change merchant theme palettes unless the palette is being used as LetBuyy's own runtime UI chrome.
8. Do not change provider/payment brand colors.
9. Do not ship a wave without validation and screenshots for affected runtimes.

## Wave 1: Design Tokens

### Objectives

- Make Purple V1 the canonical shared web token source.
- Update `packages/typescript/ui/src/tokens.ts` from blue to Purple V1.
- Add or update token docs and CSS variable mapping.
- Establish the same token names used by Flutter and web.

### Files

- `packages/typescript/ui/src/tokens.ts`
- `packages/typescript/ui/src/design-system-root.tsx`
- `LETBUYY_BRAND_SYSTEM_V1.md`
- Any generated token snapshot or test fixture if one already exists

### Dependencies

- Brand decision report approved.
- No runtime code should migrate before shared tokens are corrected.

### Validation

- Run shared UI typecheck/build script if available.
- Inspect emitted `--lb-*` CSS variables.
- Verify light and dark token values match `LETBUYY_BRAND_SYSTEM_V1.md`.

### Rollback

- Revert `packages/typescript/ui/src/tokens.ts`.
- Revert any token snapshot generated in this wave.

## Wave 2: Shared UI Package

### Objectives

- Ensure shared UI controls consume Purple V1 tokens.
- Remove blue primary defaults.
- Keep semantic success, warning, danger, and info colors intact.

### Files

- `packages/typescript/ui/src/Button.tsx`
- `packages/typescript/ui/src/Input.tsx`
- `packages/typescript/ui/src/DataTable.tsx`
- `packages/typescript/ui/src/PageHeader.tsx`, `Banner.tsx`, `EmptyState.tsx`, or equivalents if present
- `packages/typescript/ui/src/tokens.ts`
- `packages/typescript/ui/src/index.ts`

### Dependencies

- Wave 1 complete.
- Shared UI token names stable.

### Validation

- Run package typecheck/build.
- Capture representative screenshots of primary button, secondary button, inputs, tables, banners, empty states, and focus rings.
- Confirm no shared UI primary emits `#2563eb` or `#60a5fa`.

### Rollback

- Restore previous shared UI token exports and component token references.

## Wave 3: Merchant Control Plane

### Objectives

- Keep the existing purple direction.
- Remove local/shared token conflicts.
- Align `apps/merchant-control-plane/src/app/globals.css` with Purple V1 and shared `--lb-*` tokens.
- Replace any hardcoded blue fallback such as `#2563eb`.

### Files

- `apps/merchant-control-plane/src/app/globals.css`
- `apps/merchant-control-plane/src/app/layout.tsx`
- `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx`
- Merchant dashboard, products, orders, settings, checkout, and theme editor files only if they contain direct brand drift

### Dependencies

- Wave 1 and Wave 2 complete.
- Shared UI package published or workspace-linked.

### Validation

- Run Merchant Control Plane typecheck/build.
- Start local app if required.
- Capture screenshots for dashboard, products, orders, settings, checkout, and theme editor.
- Confirm CSS variables resolve to Purple V1 in light and dark modes.

### Rollback

- Restore app globals and any local fallback edits.

## Wave 4: Merchant Flutter App

### Objectives

- Replace cyan `AppColors.primary` runtime source with Purple V1.
- Align `StoreTheme`, `AppThemeColors`, `StoreAdminColors`, `LightThemeColors`, and `DarkThemeColors`.
- Preserve merchant theme presets as exceptions.
- Preserve storefront/template palette data unless used as app chrome.

### Files

- `packages/dart/ui_kit/lib/src/themes/app_colors.dart`
- `apps/mobile/merchant-app/lib/theme/store_theme.dart`
- `apps/mobile/merchant-app/lib/services/theme_provider.dart` only if token usage requires it
- `apps/mobile/merchant-app/lib/screens/products/products_screen.dart`
- `apps/mobile/merchant-app/lib/screens/products/import_products_screen.dart`
- `apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart`
- `apps/mobile/merchant-app/lib/widgets/editor/**`
- `apps/mobile/merchant-app/lib/widgets/theme/color_picker_row.dart` only to classify swatches correctly

### Dependencies

- Wave 1 token names finalized.
- Flutter source authority mapping finalized.

### Validation

- Run `flutter analyze` for `apps/mobile/merchant-app`.
- Capture key screen screenshots in light and dark mode when feasible.
- Verify `AppColors.primary` no longer resolves to `#00B3B3`.
- Confirm merchant theme preset swatches remain available.

### Rollback

- Restore Dart UI kit color file and affected Flutter local references.

## Wave 5: Platform Console

### Objectives

- Remove red-as-brand from login, MFA, dashboard shell, and action/focus states.
- Keep red only for danger, critical operations, destructive actions, failed status, and security risk.
- Apply Purple V1 to primary actions and focus states.

### Files

- `apps/platform-console/src/app/(auth)/login/page.tsx`
- `apps/platform-console/src/app/(auth)/mfa/page.tsx`
- `apps/platform-console/src/app/(dashboard)/layout.tsx`
- `apps/platform-console/src/app/(dashboard)/audit-logs/page.tsx`
- `apps/platform-console/src/app/(dashboard)/employees/page.tsx`
- `apps/platform-console/src/app/(dashboard)/operations/page.tsx`
- `apps/platform-console/src/app/(dashboard)/stores/page.tsx`
- `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx`
- `apps/platform-console/src/components/ConsoleDataTable.tsx`

### Dependencies

- Wave 1 and Wave 2 complete.
- Console semantic danger usage reviewed before replacement.

### Validation

- Run Platform Console typecheck/build.
- Capture screenshots for login, MFA, dashboard, operations, users/employees, stores, subscriptions, and audit logs.
- Confirm red remains only in actual danger/critical/failure states.

### Rollback

- Restore Platform Console changed files.

## Wave 6: Platform Operations Portal

### Objectives

- Replace indigo-as-brand with Purple V1.
- Keep red only for failure, danger, and critical states.
- Align auth, invite, dashboard, support, users, stores, and operations pages.

### Files

- `apps/platform-operations-portal/src/app/(auth)/login/page.tsx`
- `apps/platform-operations-portal/src/app/(auth)/invite/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/stores/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/users/page.tsx`
- Support page files if present

### Dependencies

- Wave 1 and Wave 2 complete.
- Semantic state review complete.

### Validation

- Run Operations Portal typecheck/build.
- Capture screenshots for login, invite, dashboard, support, users, stores, and operations pages.
- Confirm no `bg-indigo-600` remains as a brand/action color.

### Rollback

- Restore Operations Portal changed files.

## Wave 7: Developer Portal

### Objectives

- Treat `apps/app-marketplace` developer routes as the Developer Portal.
- Keep the existing purple-first direction.
- Align variables and shared UI token consumption.
- Remove any shared-token drift introduced by the old blue package defaults.

### Files

- `apps/app-marketplace/src/app/globals.css`
- `apps/app-marketplace/src/app/layout.tsx`
- `apps/app-marketplace/src/app/(auth)/developers/page.tsx`
- `apps/app-marketplace/src/app/(auth)/my-apps/page.tsx`
- Developer register/dashboard/app submission pages if present

### Dependencies

- Wave 1 and Wave 2 complete.
- App Marketplace shared token bridge reviewed.

### Validation

- Run App Marketplace typecheck/build.
- Capture screenshots for marketplace home, developer register, developer dashboard/my-apps, and app submission flows.
- Confirm `#8B5CF6` remains the visible primary brand direction.

### Rollback

- Restore App Marketplace globals and developer route files.

## Final Acceptance Criteria

- `packages/typescript/ui/src/tokens.ts` emits Purple V1.
- `packages/dart/ui_kit/lib/src/themes/app_colors.dart` emits Purple V1.
- Merchant Control Plane, App Marketplace/Developer Portal, Platform Console, Platform Operations Portal, and Merchant Flutter App resolve to the same primary brand.
- No active runtime uses cyan, blue, indigo, or red as LetBuyy's primary brand.
- Semantic and provider exceptions are documented.
- Screenshots exist for before/after comparisons per runtime.
- Typecheck/build/analyze validations are green or documented with unrelated blockers.

## Estimated Effort

Estimated implementation effort is **8-12 engineer-days** for color-only migration with screenshots and validation.

Primary risks:

- Contrast regressions on small white-text buttons.
- Accidentally replacing semantic red or info blue.
- Accidentally changing merchant storefront/theme preset palettes.
- Token bridge conflicts between app-level CSS variables and shared `--lb-*` variables.

Recommended execution order:

1. Design Tokens
2. Shared UI Package
3. Merchant Control Plane
4. Merchant Flutter App
5. Platform Console
6. Platform Operations Portal
7. Developer/App Marketplace
