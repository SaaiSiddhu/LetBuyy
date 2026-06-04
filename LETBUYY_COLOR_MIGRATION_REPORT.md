# LetBuyy Color Migration Report

## Official Brand

LetBuyy Brand Purple is now the canonical brand direction for this migration:

- Primary: `#8B5CF6`
- Hover: `#7C3AED`
- Active: `#6D28D9`
- Subtle: `rgba(139, 92, 246, 0.12)`

## Changed Files

### Wave 1-2: Shared UI

- `packages/typescript/ui/src/tokens.ts`
- `packages/typescript/ui/src/button.tsx`
- `packages/typescript/ui/src/feedback.tsx`
- `packages/typescript/ui/src/layout.tsx`

### Wave 3: Merchant Control Plane

- `apps/merchant-control-plane/src/app/globals.css`
- `apps/merchant-control-plane/src/app/[store]/login/page.tsx`
- `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx`

### Wave 4: Flutter Full Migration

- `packages/dart/ui_kit/lib/src/themes/app_colors.dart`
- `apps/mobile/merchant-app/lib/screens/auth/login_screen.dart`
- `apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart`
- `apps/mobile/merchant-app/lib/theme/app_theme_colors.dart`
- `apps/mobile/merchant-app/lib/theme/store_admin_colors.dart`
- `apps/mobile/merchant-app/lib/theme/light_theme_colors.dart`
- `apps/mobile/merchant-app/lib/theme/dark_theme_colors.dart`
- `apps/mobile/merchant-app/lib/screens/landing/**`
- `apps/mobile/merchant-app/lib/widgets/editor/**`
- `apps/mobile/merchant-app/lib/widgets/dashboard/hero_store_card.dart`
- `apps/mobile/merchant-app/lib/screens/products/**`
- `apps/mobile/merchant-app/lib/widgets/wizard/wizard_container.dart`

### Wave 5: Platform Console

- `apps/platform-console/src/app/globals.css`
- `apps/platform-console/src/app/(auth)/login/page.tsx`
- `apps/platform-console/src/app/(auth)/mfa/page.tsx`
- `apps/platform-console/src/app/(dashboard)/layout.tsx`
- `apps/platform-console/src/app/(dashboard)/audit-logs/page.tsx`
- `apps/platform-console/src/app/(dashboard)/employees/page.tsx`
- `apps/platform-console/src/app/(dashboard)/stores/page.tsx`
- `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx`
- `apps/platform-console/src/components/ConsoleDataTable.tsx`

### Wave 6: Platform Operations Portal

- `apps/platform-operations-portal/src/app/globals.css`
- `apps/platform-operations-portal/src/app/(auth)/login/page.tsx`
- `apps/platform-operations-portal/src/app/(auth)/invite/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/stores/page.tsx`
- `apps/platform-operations-portal/src/app/(dashboard)/users/page.tsx`

### Wave 7: Developer Portal / App Marketplace

- `apps/app-marketplace/src/app/globals.css`
- `apps/app-marketplace/src/app/(auth)/developers/page.tsx`
- `apps/app-marketplace/src/app/(auth)/my-apps/page.tsx`

### Continuation: Marketing Brand Gradient

- `apps/marketing-site/src/app/globals.css`

## Validation Results

| Wave | Validation | Result |
|---|---|---|
| Phase 0 | Brand preview screenshot capture | Passed |
| Wave 1 | `pnpm turbo typecheck` | Passed |
| Wave 1 | `pnpm turbo build` | Passed escalated after sandbox Turbopack failure |
| Wave 2 | `pnpm --filter @letbuyy/ui typecheck` | Passed |
| Wave 2 | `pnpm --filter @letbuyy/ui build` | Passed |
| Wave 3 | `pnpm --filter @letbuyy/merchant-control-plane build` | Passed escalated after sandbox Turbopack failure |
| Wave 4 pilot | `flutter analyze` in `apps/mobile/merchant-app` | Passed |
| Wave 4 full continuation | `flutter analyze` in `apps/mobile/merchant-app` | Passed |
| Wave 4 full continuation | Targeted scan for old Flutter cyan/teal/indigo brand values | Passed except merchant preset/palette exceptions |
| Wave 5 | `pnpm --filter @letbuyy/platform-console build` | Passed escalated after sandbox Turbopack hang |
| Wave 6 | `pnpm --filter @letbuyy/platform-operations-portal build` | Passed escalated after sandbox Turbopack hang |
| Wave 7 | `pnpm --filter @letbuyy/app-marketplace build` | Passed escalated after sandbox Turbopack hang |
| Continuation | Repository color drift scan | Passed with protected storefront/theme/payment/semantic exceptions |
| Continuation | `pnpm --filter @letbuyy/marketing-site build` | Passed escalated after sandbox Turbopack hang |
| Continuation | `pnpm --filter @letbuyy/merchant-control-plane build` | Passed escalated after final CSS fallback update |
| Continuation | Marketing screenshot capture | Passed escalated after sandbox Chromium launch failure |

## Screenshot Evidence

### Phase 0

- `.tmp/screenshots/phase0-brand-preview-light.png`
- `.tmp/screenshots/phase0-brand-preview-dark.png`

### Wave 1-4

- `.tmp/screenshots/wave1-token-preview.png`
- `.tmp/screenshots/wave2-shared-ui-preview.png`
- `.tmp/screenshots/wave3-merchant-launching-soon.png`
- `.tmp/screenshots/wave3-merchant-dashboard-attempt.png`
- `.tmp/screenshots/wave3-merchant-products-attempt.png`
- `.tmp/screenshots/wave3-merchant-orders-attempt.png`
- `.tmp/screenshots/wave3-merchant-settings-attempt.png`
- `.tmp/screenshots/wave3-merchant-checkout-attempt.png`
- `.tmp/screenshots/wave3-merchant-theme-editor-attempt.png`
- `.tmp/screenshots/wave4-flutter-login-dark.png`
- `.tmp/screenshots/wave4-flutter-login-light.png`
- `.tmp/screenshots/wave4-full-flutter-login-dark.png`
- `.tmp/screenshots/wave4-full-flutter-login-light.png`

### Wave 5-7

- `.tmp/screenshots/wave5-console-login.png`
- `.tmp/screenshots/wave5-console-mfa.png`
- `.tmp/screenshots/wave5-console-dashboard.png`
- `.tmp/screenshots/wave5-console-stores.png`
- `.tmp/screenshots/wave5-console-subscriptions.png`
- `.tmp/screenshots/wave5-console-audit-logs.png`
- `.tmp/screenshots/wave6-operations-login.png`
- `.tmp/screenshots/wave6-operations-invite.png`
- `.tmp/screenshots/wave6-operations-dashboard.png`
- `.tmp/screenshots/wave6-operations-support.png`
- `.tmp/screenshots/wave6-operations-stores.png`
- `.tmp/screenshots/wave6-operations-users.png`
- `.tmp/screenshots/wave7-marketplace-marketplace.png`
- `.tmp/screenshots/wave7-marketplace-developers.png`
- `.tmp/screenshots/wave7-marketplace-app-submission.png`
- `.tmp/screenshots/wave7-marketplace-dashboard.png`

### Continuation

- `.tmp/screenshots/continuation-marketing-home.png`

## Remaining Exceptions

- Semantic danger red remains for errors, failures, critical states, and reject actions.
- Semantic warning amber, success green, and info blue remain.
- Provider colors remain untouched.
- Storefront palettes and merchant theme presets remain untouched.
- Flutter merchant theme presets and theme color picker palettes remain as explicit merchant customization exceptions.
- App marketplace category/status gradients remain where they are not acting as LetBuyy brand gradients.
- Storefront runtime, theme engine, and shared theme settings retain tenant/storefront palette defaults as protected storefront palette exceptions.
- Dart payment package checkout color remains untouched under the explicit no-payment-code rule.
- Final migrated-surface scan for old cyan/teal/indigo brand values only found Flutter merchant preset and color-picker palette entries.

## Blockers

- Merchant control-plane protected routes redirected to identity lookup without a valid merchant session, so Wave 3 protected screenshots are route-attempt evidence.
- Platform console protected routes redirected to identity lookup without a valid console session, so Wave 5 protected screenshots are route-attempt evidence.
- Platform operations protected routes redirected to identity lookup without a valid employee session, so Wave 6 protected screenshots are route-attempt evidence.
- App marketplace developer app submission and dashboard routes redirected to identity lookup without a valid session, so those screenshots are route-attempt evidence.
- Turbopack builds consistently hung or failed in sandbox for several Next apps; rerunning the same commands escalated completed successfully.

## Dirty Worktree Note

The repository had unrelated dirty changes outside this color migration, including identity platform auth/lookup flow files, merchant shell files, API gateway auth/rate-limit files, and other untracked docs/assets. Those were not reverted.

## Reports Produced

- `LETBUYY_BRAND_PREVIEW.md`
- `WAVE1_REPORT.md`
- `WAVE2_REPORT.md`
- `WAVE3_REPORT.md`
- `WAVE4_PILOT_REPORT.md`
- `WAVE4_FULL_FLUTTER_REPORT.md`
- `WAVE5_REPORT.md`
- `WAVE6_REPORT.md`
- `WAVE7_REPORT.md`
- `LETBUYY_COLOR_MIGRATION_REPORT.md`
