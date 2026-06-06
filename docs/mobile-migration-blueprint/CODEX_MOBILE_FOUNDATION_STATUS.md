# Codex Mobile Foundation Status

- Branch: `stream/letbuyy-foundation-v2`
- Start HEAD: `62b2915218daa716b075b02d909c08e053bfce25`
- Current HEAD: `62b2915218daa716b075b02d909c08e053bfce25`
- Status timestamp: `2026-06-06T13:05:45+05:30`

## Feature Checklist

| Phase | Feature | Status | Evidence |
|-------|---------|--------|----------|
| P0 | Mobile BFF auth foundation | DONE-WITH-SKIP | `services/mobile-bff/src/index.ts`, `services/mobile-bff/wrangler.toml`, `services/mobile-bff/runtime.manifest.json`; skip S-001 for live HMAC secret and S-005 for staging merchant session |
| P0 | Native Firebase cleanup | DONE | Deleted Android/iOS Google service files, removed Gradle Google Services plugin, removed stale `GoogleService-Info.plist` Xcode project references in `apps/mobile/merchant-app/ios/Runner.xcodeproj/project.pbxproj` |
| P0 | Dev auth bypass removal | DONE | `apps/mobile/merchant-app/lib/services/store_auth_service.dart` no longer accepts dev-bypass/dev OTP fallbacks |
| P0 | Functional Turnstile + OTP auth seam | DONE-WITH-SKIP | `lib/screens/auth/turnstile_challenge_screen.dart`, `lib/screens/auth/otp_screen.dart`, `lib/screens/auth/login_screen.dart`, `lib/services/store_auth_service.dart`; skip S-002 only for real Cloudflare public site key/provider config |
| P0 | Real analytics | DONE | `lib/services/analytics_service.dart`, `lib/screens/analytics/analytics_screen.dart`, `lib/screens/dashboard/home_screen.dart`; gateway analytics contract covered by `test/mobile_services_test.dart` |
| P0 | Product model projection | DONE | `lib/services/product_service.dart`; `ProductContract.toJson()` remains canonical; covered by `test/product_contract_test.dart` and `test/mobile_services_test.dart` |
| P0 | DI cleanup | DONE | `SubscriptionService` registered in `lib/main.dart`; `DomainService` and `PreviewService` are intentionally deferred until P2 features require them |
| P0 | Razorpay checkout | DONE-WITH-SKIP | `lib/screens/subscription/razorpay_checkout_screen.dart`, `lib/screens/subscription/pricing_screen.dart`, `lib/services/subscription_service.dart`; in-app Checkout.js path verifies through `/payments/subscription/verify`; skip S-004 only for real provider key/dashboard smoke |
| P0 | Design-token sweep | DONE | `lib/theme/letbuyy_color_tokens.dart`, `lib/theme/store_admin_colors.dart`, `packages/dart/ui_kit/lib/src/themes/app_text_styles.dart`; `rg` finds no raw `0xFF8B5CF6` outside the canonical token file |
| P0 | Service tests | DONE | `test/mobile_services_test.dart` covers store, product, order, analytics, theme, subscription, and auth services; existing contract tests remain |
| P0 | CI workflow/docs refresh | DONE | `.github/workflows/ci.yml`, `docs/mobile/README.md`, `docs/design-system/README.md` from prior V1 foundation work |
| P1 | Order detail + refunds | TODO | Next resume point |
| P1 | Customers + detail + addresses | TODO | Not started |
| P1 | Inventory adjust | TODO | Not started |
| P1 | Coupons CRUD | TODO | Not started |
| P1 | Notifications settings | TODO | Not started |
| P1 | Push notifications | TODO | Not started |
| P2 | Theme/CMS/media/shipping/taxes/domains/collections/variants/WMS | TODO | Not started |
| P3 | Staff/billing/reviews/leads/gift cards/SEO/apps/AI | TODO | Not started |
| P4 | Multi-store/offline/deep-links/a11y/i18n | TODO | Not started |
| P5 | Platform-blocked seams | TODO | Not started |

## Verification Log

- `flutter analyze` in `apps/mobile/merchant-app`: PASS. Output: `No issues found! (ran in 4.4s)`.
- `flutter test` in `apps/mobile/merchant-app`: PASS. Output: `00:00 +10: All tests passed!`.
- `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json` in `apps/mobile/merchant-app`: PASS. Output: `Built build/app/outputs/flutter-apk/app-debug.apk`.
- `flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json` in `apps/mobile/merchant-app`: PASS. Output: `Built build/ios/iphoneos/Runner.app`.
- `pnpm --filter @letbuyy/mobile-bff typecheck`: PASS.
- `pnpm --filter @letbuyy/mobile-bff test`: PASS. Output: 3 tests passed.
- `rg` app audit for removed Firebase/Supabase/dev auth/raw brand residue: PASS. Only the canonical `lib/theme/letbuyy_color_tokens.dart` definition remains for `0xFF8B5CF6`; no live Firebase/GoogleService/dev-bypass residue remains in mobile app source.
- `node scripts/validate-governance.mjs`: PASS. Output: `Governance validation passed (157 validators)`.

## Notes

- Razorpay no longer throws `SKIP-NEEDS-BACKEND: MOBILE_RAZORPAY_CHECKOUT_URL` for order-mode subscription checkout. If the gateway returns `key_id` plus `razorpay_order_id` or `razorpay_subscription_id`, the mobile app renders Razorpay Checkout.js in a WebView and posts the returned success payload to `/payments/subscription/verify`.
- The mobile Turnstile flow is functional when `TURNSTILE_SITE_KEY` is supplied. The checked-in dart defines retain `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY` because the real Cloudflare public site key/provider setup is human-owned.

## RESUME HINT

Next feature: P1 `Order detail + refunds`.

Start with `apps/mobile/merchant-app/lib/services/order_service.dart`, `apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart`, and add `apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart`. Keep all order/refund traffic through `services/mobile-bff` to gateway `/v1/orders/:id`, `/v1/orders/:id/refund`, and `/v1/orders/:id/refund/complete`.
