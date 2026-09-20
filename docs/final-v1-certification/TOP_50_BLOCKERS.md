# Top 50 Blockers

**HEAD `ae383bb8`. Prioritized; severity in brackets. LB-1 is NOT here (Next 16 `proxy.ts` satisfies it).**

## S0 — launch-stopping (3)
1. [S0] Never pushed — `origin/main` 217 behind HEAD; zero deploys.
2. [S0] Never provisioned — ~40 prod secrets unset; `release-preflight` hard-fails.
3. [S0] First prod deploy self-blocks — branch-lag guard needs `HR-B1A` push.

## S1 — visible defects / deploy gates (9)
4. [S1] LB-8 broken announcement bar — `renderer-registry.tsx:56–203`.
5. [S1] Shipping-rate drop — `app/api/orders/route.ts:48–57` (revenue leak).
6. [S1] No external alerting — `incident-command.ts:94–128` dry-run; money/auth 5xx pages nobody.
7. [S1] DNS + wildcard `*.letbuyy.com`.
8. [S1] Production Supabase + apply 103 migrations (gated).
9. [S1] Razorpay live keys + webhook secret (`HR-MERCHANT-PSP-LIVE`).
10. [S1] Razorpay Route onboarding — payouts (`HR-PA-SPLIT-LIVE`).
11. [S1] Resend domain auth (SPF/DKIM/DMARC) — all email no-ops until set.
12. [S1] Identity ES256 keypair (`identity-issued-session.ts:42–44` throws without it).

## S2 — pre-pilot (15)
13. [S2] LB-11 hide gift-card nav (`merchantNavigation.ts:93`).
14. [S2] Gift-card storefront redemption UI.
15. [S2] Turnstile live keys (signup fail-closed).
16. [S2] STEP_UP_SIGNING_SECRET + CUSTOMER_SESSION_SECRET + PAYMENT_CONFIG_ENCRYPTION_KEY.
17. [S2] Payouts not KYC-gated (`payouts.ts:553–619`).
18. [S2] No staff KYC review surface in platform-console.
19. [S2] Marketing `/terms` `/privacy` `/legal` 404 (`Footer.tsx:64–66`).
20. [S2] Real ToS / Privacy / DPDP content.
21. [S2] COD orders get no confirmation email.
22. [S2] GST invoice persisted to mutable `orders.gst_invoice` not immutable `gst_invoices`.
23. [S2] `/contacts:56` no rate-limit + no Turnstile → email-bomb.
24. [S2] Storefront contact `public-routes.ts:1308` no limiter.
25. [S2] Checkout steps `checkout.ts:487–598` no dedicated limiter.
26. [S2] Per-caller `INTERNAL_API_KEYRING` → flip `INTERNAL_AUTH_LEGACY_ACCEPT=false`.
27. [S2] Merchant teams acceptance page (invited staff inert).

## S3 — hardening (13)
28. [S3] Coupon-validate enumeration (`public-routes.ts:373,858`).
29. [S3] mig `100:133–155` four marketplace tables `USING(true)` no-`TO` (frozen).
30. [S3] order-credential/login no inline limiter.
31. [S3] 2FA TOTP-verify no brute-force limiter.
32. [S3] webhook-service plain `!==` internal compare (`index.ts:568,658`).
33. [S3] Signature-verify failures not separately alertable (`payments.ts:1116`).
34. [S3] No customer "shipped" email in live queue path.
35. [S3] notification-core `planEmailNotificationForEvent` dead code (misleading coverage).
36. [S3] `site_memberships` RBAC computed but unenforced.
37. [S3] Storefront search is client-side filter only.
38. [S3] Analytics `revenueByMonth` hardcoded in places.
39. [S3] Stripe/PayPal non-V1 payment routes live (secret-gated).
40. [S3] Hyperdrive→prod Supabase binding; R2/KV/queue prod provisioning.

## Deploy/verify choreography (10)
41. First gated staging deploy. 42. Staging E2E (browse→cart→checkout→refund). 43. G4 probes (takeover-deny, anon-order-deny, `commission_bps=0`). 44. First gated production deploy + smoke. 45. Rollback drill. 46. Observability dashboards (Workers + Supabase). 47. Onboard 5 pilot merchants. 48. COD + Razorpay test→live. 49. First real order/refund/payout ceremony (verify I1/I5). 50. GO/NO-GO + tag v1.0.0.

*Items 1–27 are the real gate to a pilot; 28–40 are hardening; 41–50 are choreography.*
