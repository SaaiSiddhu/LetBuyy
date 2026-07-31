# Phase H — Merchant Journey Audit

**HEAD `587dc988`. Score: 70/100.**

| Step | Status | Evidence |
|---|---|---|
| Signup (OTP → password) | PASS | `signup/route.ts:35–138` → `verify-otp` mints `password-set-intent` cookie → `set-password:46–115` (single-use intent). Rate-limit+Turnstile+CSRF. **Blocked in prod until Turnstile/Resend/identity-JWK provisioned (fail-closed).** |
| Store creation | PASS | `create-store/route.ts:34–139` proxies to gateway `/stores` (no local DB write) |
| Products | PASS | `products/*` CRUD via `ProductExecutionAdapter` (ownership re-derived) |
| Inventory | PASS | reservation RPCs, sweeper (250/run) |
| Collections | PASS | owner-scoped CRUD |
| Shipping (rate cards) | **PARTIAL** | merchant configures `shipping_rates`, but customer checkout drops the selected rate (`app/api/orders/route.ts:48–57`) → cards don't affect paid shipping |
| GST | PASS | server-side CGST/SGST/IGST; immutable `gst_invoices` table (but checkout writes mutable column — see Money audit) |
| Orders | PASS | list/detail/status PATCH with idempotency (`orders/page.tsx`) |
| Refunds | PASS | step-up gated, ledger-posted |
| Payouts | **PARTIAL** | step-up + Razorpay-Route, ledger-balance checked — but **not KYC-gated** (`payouts.ts:553–619` never reads KYC) and **no staff KYC review surface** in platform-console |
| Analytics | PARTIAL | dashboards present; `revenueByMonth` hardcoded in places |
| Themes | PASS | theme editor; Liquid OFF by default (React urban-kicks is V1) |
| Gift cards | **PARTIAL** | issuable (nav `merchantNavigation.ts:93`) but unredeemable by shoppers (LB-11) |
| Staff / teams | **FAIL** | `employees` invite has **no acceptance page**; `site_memberships` RBAC computed but unenforced → effectively owner-only |

## Summary
**8 PASS · 4 PARTIAL · 1 FAIL.** A single owner can run the full commerce loop end-to-end. Gaps: shipping rate cards don't reach checkout; payouts settle without KYC and there's no operator KYC queue; teams can't add a working second user; gift cards aren't shopper-redeemable. For a *pilot* (owner-operated, COD+Razorpay test-to-live) this is workable once shipping + KYC-decision are addressed; for scaled beta the teams + KYC gaps matter.
