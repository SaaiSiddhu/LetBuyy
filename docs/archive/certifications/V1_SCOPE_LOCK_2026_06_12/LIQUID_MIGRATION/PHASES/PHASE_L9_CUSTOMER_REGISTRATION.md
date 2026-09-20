# PHASE L9 — CUSTOMER REGISTRATION

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only. **Auth surface — highest care; depends on LB-12.**

1. **Purpose.** Render login + an explicit register flow through Liquid, over the existing customer-session model.
2. **Repository Reality.** `store_customers` = identity row, `customer_credentials` = password store; `hasPassword` driven by `customer_credentials` (`customer-engagement-routes.ts:681-686`). Login is public (`:695-788`), mints HS256 session via `issueCustomerSession` (`auth-core/customer-session.ts:28-59`). **Registration dead-ends** (`account-bottom-sheet.tsx:372-413`) and the `set_password` "Create Account" button is broken (no resetToken → rejected `customer-auth-context.tsx:145`, `set-password/route.ts:35`) — this is the pending **LB-12**. The storefront proxy must re-mint locally via `createSession()` (gateway IDs-only token fails `isCustomerSessionPayload`).
3. **Current State.** Login works (React sheet); register absent/broken; no Liquid auth templates.
4. **Target State.** Liquid `customers/login` + `customers/register` templates over `/api/customer/*`; LB-12's register endpoint live (Turnstile + rate-limit + not-exists precondition → safe token-less first password → customer session).
5. **Files To Modify.** `theme-bundle.ts` (auth templates); (LB-12) `customer-engagement-routes.ts` (new `POST /storefront/customer/register`), `api-client`, storefront `/api/customer/register` proxy, `customer-auth-context.tsx`.
6. **Files To Create.** (LB-12) storefront `app/api/customer/register/route.ts`.
7. **Files To Delete.** None — React account sheet KEEP-TEMP until L17.
8. **Dependencies.** L4; **LB-12** (the V1 registration blocker) must land first.
9. **Validator Impact.** `domain-boundary-validator.mjs:209` route count 127→128 (LB-12 adds a route — lockstep update + federation test + ownership doc); customer-engagement contract tests (`storefront-customer-engagement-routes.test.ts` band order).
10. **Migration Impact.** None (tables exist).
11. **Testing Requirements.** Register: not-exists precondition, missing-fields → VALIDATION, public-but-Turnstile/rate-limit-gated; login: bcrypt + session mint; both render in Liquid and set the cookie; abuse-control ordering (rate-limit→Turnstile→DB→bcrypt).
12. **Performance Requirements.** Auth pages are not cached (dynamic); bcrypt cost bounded; rate-limit before DB work.
13. **Security Requirements.** **Critical.** Turnstile (`requireValidTurnstile`, fails closed in prod) + per-IP rate-limit + the not-exists precondition make the token-less first password safe; enumeration-safe uniform responses; CSRF on the cookie; no password in logs.
14. **Tenancy Requirements.** `store_customers`/`customer_credentials` RLS ENABLE, scoped by `site_id`; register writes only these two tables, `store_id`-scoped.
15. **Identity Requirements.** **Critical — preserve the issuer model.** Customer session stays HS256 via `CUSTOMER_SESSION_SECRET`; **no identity-platform touch, no new issuer**; merchant ES256 untouched; the storefront proxy re-mints locally (mirrors login). Cookie `lb_customer_session`.
16. **Money Requirements.** N/A (registration is pre-purchase).
17. **Rollback Plan.** Remove the auth templates → React account sheet; (LB-12) revert the register route incl. the 127 route-count.
18. **Success Criteria.** A never-ordered shopper registers and is logged-in on a Liquid page; issuer model unchanged.
19. **Exit Criteria.** Register/login render + security tests green; route-count lockstep applied; issuer invariant proven (no ES256/identity-platform call).
20. **Evidence Requirements.** Register→logged-in trace; the security test results; proof the customer token is HS256 and merchant sessions are untouched.
