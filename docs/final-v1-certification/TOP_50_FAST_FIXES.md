# Top 50 Fast Fixes

**HEAD `587dc988`. Small, localized, low-risk. Each names the exact edit point. (None applied — this is a read-only certification; all require build + gate validation before commit, and the repo cannot be committed from this sandbox.)**

## ≤1 line / ≤15 min (1–15)
1. **Shipping-drop** `app/api/orders/route.ts:~48` — add `shippingRateId: body.shippingRateId ?? body.shipping_rate_id ?? null` to the `createOrder` payload. *(Verify gateway `storefront.createOrder` forwards `p_shipping_rate_id`.)*
2. **LB-11 nav** `merchantNavigation.ts:93` — remove the `products/gift-cards` entry (or feature-flag it off for V1).
3. **Webhook timing** `webhook-service/src/index.ts:568,658` — replace `!==` with `timingSafeEqual`.
4. **mig-100 policies** — new migration: `ALTER POLICY ... TO service_role` on the 4 `app_*` tables.
5. **`/storefront/directory`** `public-routes.ts:284` — drop `'draft'` from the status filter.
6. **Legacy-accept default** `internal-auth.ts:40` — default `INTERNAL_AUTH_LEGACY_ACCEPT` to false once keyring provisioned.
7. **Coupon limiter** `public-routes.ts:373,858` — wrap with existing `sensitiveRateLimit`.
8. **Contacts limiter** `contacts.ts:56` — add `sensitiveRateLimit` + `requireValidTurnstile`.
9. **Storefront contact limiter** `public-routes.ts:1308` — add `sensitiveRateLimit`.
10. **2FA limiter** `two-factor.ts:224` — add per-actor attempt limiter.
11. **Sig-verify metric** `payments.ts:1116` — emit a `payment.signature_failed` runtime metric.
12. **Footer links** `Footer.tsx:64–66` — point to real pages or remove until built.
13. **Analytics banner** — mark `revenueByMonth` "estimated" where hardcoded.
14. **notifications actor** `notifications.ts:368` — validate `actor_id ∈ store`.
15. **proxy invariant** — add a test asserting `proxy.ts` exists + exports `proxy`+`config` (the LB-1 test already does this — keep it).

## ~1 file / ≤2 hr (16–32)
16. **LB-8 renderer** `renderer-registry.tsx` — add an `announcementBar` renderer mapping to the existing announcement section component.
17. **COD email** — enqueue `email.order_confirmation` on COD order creation (not just `order.paid`).
18. **Shipped email** — add `email.order_shipped` jobType + dispatch on `order.fulfilled`.
19. **GST immutable persist** `order-execution.adapter.ts:337` — also write the invoice into `gst_invoices`.
20. **Gift-card redemption input** — add code field in `checkout-client.tsx` → pass to `/api/orders` (already plumbed to `giftCardCode`).
21. **Flip alerting off dry-run** `incident-command.ts:97` — set a real paging adapter for sev2.
22. **KYC payout gate** `payouts.ts:~560` — read `merchant_kyc_documents` status before settle (if policy = gate).
23. **Per-identity auth limiter** — extend `enforceCustomerAuthRateLimit` to order-credential/find-or-create paths.
24. **DLQ/circuit alerts** — emit metrics on `skipped_reason:circuit_open` + DLQ depth.
25. **CI guard-tamper check** — fail if `tests/launch/*` edited with guarded code sans ARB tag.
26–32. Provisioning config stubs (Hyperdrive prod id, R2 bucket, KV namespace, queue names, secret-matrix population script run) — config edits, not logic.

## Human/ops fast (33–50)
33. HR-B1A push. 34. DNS wildcard. 35–44. Provision the ~40 secrets (Razorpay live+webhook, Route, Resend, Turnstile, identity JWK, step-up, customer-session, payment-config-encryption, CSRF, internal-api). 45. Prod Supabase create. 46. Run gated migrate. 47. Razorpay live onboarding. 48. Razorpay Route onboarding. 49. Resend domain auth. 50. Staging deploy + smoke.

**Fastest revenue-protecting fix:** #1 (shipping-drop) and #8 (contact-form abuse). **Most visible:** #16 (LB-8). **Highest safety leverage:** #21 (real paging) and #22 (KYC gate).
