# Phase E — Rate Limit Audit

**HEAD `ae383bb8`. Two global baselines + per-endpoint limiters in only 5 of 87 route files.**

## Global baselines (`services/api-gateway/src/index.ts`)
- **Per-IP query-cost leaky bucket** on all `/v1/*` (`:644–648`, 20 pts/s, cap 200; POST cost 5, GET cost 1). **Per-IP only** — no per-identity/account dimension → does not stop distributed credential-stuffing or OTP/email bombing from rotating IPs.
- **`authRateLimit` 20 / 5 min** on `/auth/*` (`:665–672`).

## Properly limited
- Customer login `customer-engagement-routes.ts:698` — `enforceCustomerAuthRateLimit` (5/identity + 30/IP per 15 min) + `sensitiveRateLimit` 5/min + Turnstile. **Strong.**
- Password reset request/confirm `:446/:522`; register `customer-registration.ts:41`; order-contact `:1042`. Covered.
- Auth signup/signin/otp `auth.ts:1337+` under `/auth/*` 20/5min.

## Gaps
| Sev | Endpoint | file:line | Impact |
|---|---|---|---|
| High | `POST /contacts` | `contacts.ts:56` | no limiter **and no Turnstile**, sends owner email → email-bomb + quota burn |
| High | `POST /storefront/:sub/contact` | `public-routes.ts:1308` | Turnstile but no limiter → form-submission flood |
| High | checkout steps | `checkout.ts:487/513/567/598` | no dedicated limiter (HMAC handoff mitigates) → cart/intent flooding |
| Med | coupon validate | `public-routes.ts:373,858` | no limiter → discount-code enumeration |
| Med | `order-credential/login` | `customer-engagement-routes.ts:866` | bcrypt compare, no inline limiter (internal-gated) |
| Med | `find-or-create` | `customer-engagement-routes.ts:328` | internal-gated, enumerates `store_customers` |
| Low | 2FA TOTP verify | `two-factor.ts:224` | no per-route brute-force limiter on 6-digit code |
| Low | money mutations | `payments.ts:462/252` | merchant-authed; no per-endpoint limiter beyond bucket |

## Observability on sensitive paths
Signature-verify failures (`payments.ts:1116–1121` Razorpay, `:884` subscription) return generic 400 with **no dedicated security metric** → tamper/replay indistinguishable from ordinary 400s in telemetry.

**Recommendation:** add `enforceCustomerAuthRateLimit`/`sensitiveRateLimit` + Turnstile to `/contacts` and the storefront contact route (High), and a per-cart limiter on checkout confirm/intent. These are small, localized additions.
