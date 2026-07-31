# Phase E — Rate Limit Matrix

**HEAD `587dc988`. ✅ limited · ⚠️ bucket-only · ❌ gap.**

| Endpoint | Dedicated limiter | Turnstile | Status |
|---|---|---|---|
| Customer login | ✅ 5/id+30/IP/15m | ✅ | ✅ |
| Customer register | ✅ enforceCustomerAuthRateLimit | ✅ | ✅ |
| Password reset (req/confirm) | ✅ | — | ✅ |
| Auth signup/signin (identity) | ✅ /auth/* 20/5m | ✅ | ✅ |
| OTP send/verify | ✅ /auth/* 20/5m | — | ⚠️ loose for 6-digit |
| Order contact form | ✅ | — | ✅ |
| **Contact form `/contacts`** | ❌ | ❌ | ❌ High (emails owner) |
| **Storefront contact** | ❌ | ✅ | ❌ High |
| **Checkout contact/delivery/intent/confirm** | ❌ | — (HMAC handoff) | ❌ High |
| **Coupon validate** | ❌ | — | ❌ Med (enumeration) |
| order-credential/login | ❌ (internal-gated) | — | ⚠️ Med |
| 2FA TOTP verify | ❌ | — | ⚠️ Low |
| Payments refund/capture/verify | ❌ (merchant-authed) | — | ⚠️ Low |
| Webhooks (Razorpay/Stripe/PayPal/Cashfree) | n/a — HMAC sig + dedupe | n/a | ✅ |
| All other `/v1/*` | ⚠️ per-IP query-cost bucket | — | ⚠️ |

**Highlighted (program-requested):** login ✅ · registration ✅ · checkout ❌ · payments ⚠️ · gift cards (issue=merchant-authed ✅; redeem=in checkout ❌) · coupons ❌ · webhooks ✅ · password reset ✅ · search ⚠️ (bucket only).
