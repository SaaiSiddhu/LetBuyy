# 3. Merchant Lifecycle Investigation

Lifecycle traced stage-by-stage through code. For each: mechanism, owning internal team (as it would be), internal tool available, gaps.

## Stage Map

### 1. Signup — REAL, unmanaged internally
- Entry: `apps/marketing-site/src/app/create/page.tsx` (site type, name, subdomain) → redirect to identity platform.
- `apps/identity-platform/src/app/api/auth/signup/route.ts`: rate-limited, Turnstile bot check, 6-digit email OTP.
- Tracking: `onboarding_attempts` table (requested name/subdomain, status, failure_reason) — **no internal UI reads it**.
- Internal team/tool: none. Failed signups invisible to staff.

### 2. Store Creation — REAL
- `apps/identity-platform/src/app/api/auth/create-store/route.ts` → inserts `sites` row: `status='draft'`, `trial_started_at=now()`, `trial_ends_at=now()+14d`, `trial_status='active'`.
- `sites.status` enum: `draft | published | unpublished | frozen | suspended`; `trial_status`: `active | grace | frozen | cancelled | paid` (`000_baseline.sql:12007-12008`).
- Emails: store-creation success/failure routes exist; logged to `email_logs`.
- Internal visibility: console `/stores` lists stores (paginated, status filter) — read-only; plan/revenue columns flagged "backend needed".
- **Gap:** No trial-expiry enforcement job found; `frozen` state exists in schema but nothing transitions stores into it automatically.

### 3. Theme Installation — REAL (single first-party theme)
- `POST /themes/:slug/install`, purchase via Razorpay (`services/api-gateway/src/routes/themes.ts`).
- Catalog contains exactly one theme, "Urban Kicks", LetBuyy-authored, free, seeded by `database/supabase/seeds/urban-kicks-theme.sql`; `verification/055_only_urban_kicks_theme_catalog.sql` asserts this.
- Internal team: theme reviewer queue exists for future submissions (report 5). No theme-ops dashboards (installs/actives by version).

### 4. App Installation — REAL pipeline, thin oversight
- Install flow validates scopes (`normalizeAppInstallScopes`, `app-store.ts`); `app_installations` status `active | paused | uninstalled`; install-count triggers.
- Mandatory compliance webhooks per app: `customers/data_request`, `customers/redact`, `shop/redact` — contractual only; no platform tooling verifies developers honor them.
- Internal tool: none for installation oversight (no per-app health, error rates, or merchant complaint linkage).

### 5. Orders — REAL
- Merchant side complete: `merchant-control-plane /orders` (filters, search, pagination), fulfillment orders, returns/refunds schema (`refunds`, `return_requests`, `complete_order_refund()`).
- Internal visibility: **none.** No platform-side order search, no cross-store order lookup. A support agent could not find a shopper's order without SQL.

### 6. Payments — REAL rails, no platform ops
- Providers: Cashfree (`075_cashfree_payment_provider.sql`), Razorpay, COD (`sites.cod_enabled`). `payment_transactions`, `payment_webhook_events` (signature validity, processing status), `refund_attempts/refund_transactions`.
- Internal team/tool: no payment-ops console — no failed-webhook triage UI, no stuck-payment queue, no refund oversight, no chargeback/dispute handling at all.

### 7. Support — MISSING
- Merchant→LetBuyy channel does not exist (report 6). `contact_submissions` is shopper→merchant.

### 8. Suspension — API EXISTS, UI DISABLED
- Super-admin endpoint: `PATCH /admin/stores/:id/status` accepting `draft|published|suspended|frozen`, writes `audit_logs` with `action: store_status_<status>` (`admin.ts:104-138`). Hard delete: `DELETE /admin/stores/:id`.
- Storefront enforces: suspended sites excluded from public queries (`storefront.ts:2010,2031,2077`).
- Merchant self-deletion soft-deletes by setting `status='suspended'` + `deleted_at` (`stores.ts:627-647`) — **conflates voluntary closure with punitive suspension** in the same status value.
- Console `/trust-safety` "Suspend merchant" button: disabled, "Backend needed".
- **Gaps:** No suspension reason capture, no case record, no merchant notification on suspension, no appeal flow.

### 9. Reactivation — MISSING as a workflow
- Technically possible by PATCHing status back to `published`. No reinstatement checklist, no review, no audit trail beyond the status flip, no communication to merchant.

## Internal Team Coverage Matrix

| Stage | Expected owner | Tool today | Verdict |
|---|---|---|---|
| Signup funnel | Growth/Onboarding ops | none (`onboarding_attempts` unread) | MISSING |
| Store creation/trial | Billing ops | console read-only; no trial enforcement | PARTIAL |
| Theme install | Theme ops | none | MISSING |
| App install | App ops | none | MISSING |
| Orders | Support | none (no order search) | MISSING |
| Payments | Finance/Payments ops | none | MISSING |
| Support | Support | none (501) | MISSING |
| Suspension | Trust & Safety | raw API only | PARTIAL |
| Reactivation | Trust & Safety | raw API only | MISSING |

## Conclusion

The merchant-facing lifecycle is largely real (signup → store → theme → orders → payments all function). The platform-facing lifecycle is hollow: after a merchant signs up, **no internal team has tooling to observe, assist, bill-enforce, investigate, suspend-with-due-process, or win back that merchant.** The only lifecycle interventions possible today are super-admin raw API calls with no case context.
