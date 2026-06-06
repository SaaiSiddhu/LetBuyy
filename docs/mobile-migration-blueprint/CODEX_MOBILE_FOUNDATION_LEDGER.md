# Codex Mobile Foundation Ledger

| ID | Phase | Item | Why deferred | Placeholder used | Unblock action | Owner |
|----|-------|------|--------------|------------------|----------------|-------|
| S-001 | P0 | `INTERNAL_API_SECRET` for Mobile BFF | Real HMAC secret value cannot be committed | `SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET` in `services/mobile-bff/wrangler.toml` | Set Cloudflare Worker secret to the same value the gateway verifies, remove placeholder var from live env, redeploy BFF | human |
| S-002 | P0 | Mobile Turnstile provider config | The mobile challenge UI is built, but the real Cloudflare public site key/provider setup must come from the identity owner | `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY` and optional `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN` in dart defines / `AppConfig` | Configure `TURNSTILE_SITE_KEY` for staging/production; optionally remove the token override placeholder after challenge-only flow is the standard | human |
| S-004 | P0 | Razorpay publishable key and provider smoke | Real provider key/dashboard access is not available in this environment | `SKIP_NEEDS_HUMAN_*_RAZORPAY_KEY_ID` and `SKIP_NEEDS_HUMAN_MOBILE_RAZORPAY_KEY_ID` | Configure public key in mobile release defines; verify order/subscription checkout and callback against Razorpay test dashboard | human |
| S-005 | P0 | Staging authenticated merchant integration test | No staging test merchant credentials or live `lb_session` are available here | `SKIP_NEEDS_HUMAN_STAGING_MERCHANT_SESSION` | Provide staging merchant credentials/session and run `GET /v1/products?store_id=...` through BFF | human |
| S-006 | P0 | Production BFF deployment/DNS activation | Live Cloudflare deploy and DNS activation require provider credentials and approval | `// [SKIP-NEEDS-HUMAN: prod deploy — config ready]` | Run governed Cloudflare deployment after secrets are configured | human |
| S-007 | P0 | iOS app signing/distribution | App-store signing identities are not available in this environment | ledger entry | Configure signing certificates/profiles in CI and release lanes | human |

## Resolved Skips

- S-003 `Mobile sign-up OTP completion`: resolved by `apps/mobile/merchant-app/lib/screens/auth/otp_screen.dart` and `StoreAuthService.verifySignUpOtp` / `signUp(..., otp: ...)`.
- S-008 `Mobile Razorpay one-time checkout return`: resolved by `apps/mobile/merchant-app/lib/screens/subscription/razorpay_checkout_screen.dart`, which renders Checkout.js for gateway order/subscription IDs and calls `/payments/subscription/verify`.
