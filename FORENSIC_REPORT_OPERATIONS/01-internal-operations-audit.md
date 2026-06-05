# 1. Internal Operations Audit

Verdict per platform capability. **EXISTS** = implemented and usable. **PARTIAL** = schema/API/UI exists but incomplete or not wired end-to-end. **MISSING** = no meaningful implementation.

## Platform-by-Platform Verdict

| Platform | Verdict | What exists | What's absent |
|---|---|---|---|
| **Internal Admin Platform** | PARTIAL | `apps/platform-console` (magic link + TOTP + email allowlist; users/stores/subscriptions/employees/audit-logs/analytics/settings/operations pages wired read-only). `services/api-gateway/src/routes/admin.ts` with super-admin store status mutation + hard delete. | No write actions in UI; no global search; no impersonation; no emergency controls surfaced. |
| **Merchant Success Platform** | PARTIAL | `platform-operations-portal /merchant-health` (computed health scores: products/orders/theme/payments/shipping), `/crm` (derived contacts), `/operations/onboarding` (6-signal readiness checklist). | All action buttons disabled ("backend needed"); no notes, tasks, follow-ups, owner assignment, churn signals, or platform-wide health API. |
| **Support Platform** | MISSING | Support UI shell at `platform-operations-portal /support`; employee verification in `employee.ts`. | `GET /employees/tickets` returns **501 SUPPORT_TICKETS_UNAVAILABLE** (`services/api-gateway/src/routes/employee.ts:313-316`). No ticket tables, no chat, no helpdesk. |
| **Finance Operations Platform** | PARTIAL | Tables: `billing_history`, `app_billing_charges`, `partner_payout_ledger_entries` (rails: razorpay_route/razorpayx/upi/manual; 80% rev-share bps), `refunds` + `complete_order_refund()`. Console `/subscriptions` + `/analytics` (MRR/ARR wired). | No payout approval/release UI, no reconciliation workflows, no invoice ops, no dispute handling, no finance role surface. |
| **Theme Review Platform** | PARTIAL | `marketplace_review_records` (pending/in_review/approved/rejected/changes_requested), wired queue UI at `platform-operations-portal /operations`, decision API cascades to `theme_packages.status`. | No code inspection, no preview, no a11y/perf checks, no delist after approval, no reviewer assignment. See report 5. |
| **App Review Platform** | PARTIAL | Same review-record pipeline; submission via `POST /app-store/developers/apps` auto-creates review record with automated checks (schema, developer profile, quality gate, extension lifecycle). | No version diff, no static analysis, no communication thread, no appeal. See report 4. |
| **Fraud Platform** | MISSING | Only `gift_card_ledger_entries.fraud_hold_reason` + seeded permission string `operations → disputes.manage`. | No fraud tables, scoring, velocity checks, blocklists, chargeback/dispute ledger, review queue. |
| **Risk Platform** | MISSING | Console `/trust-safety` derives "risk rows" from store status + audit logs. | No risk scores, cases, KYC, evidence, appeals — page banner states endpoints required; all buttons disabled. |
| **Moderation Platform** | PARTIAL | `product_reviews` moderation status (`database/supabase/verification/037_product_reviews_moderation_status.sql`); blog `comments` moderation in merchant control plane; marketplace review queue. | No platform-level content moderation queue, abuse reports, takedown/DMCA flow, or storefront content scanning. |
| **Trust & Safety Platform** | MISSING (UI shell) | `platform-console /trust-safety` page exists with flagged-merchant table. | Banner: "require dedicated trust-and-safety endpoints before actions can be enabled". "Open case", "Suspend merchant", "Request review" all disabled. No case tables. |
| **Compliance Platform** | MISSING | `audit_logs`, `retention_policies` table, mandatory app compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) defined in app contracts. | No DSR (export/delete) workflow, no compliance dashboard, no GDPR tooling, no regulator reporting. |
| **Internal Analytics Platform** | PARTIAL | `internal-console.ts /summary` + `/analytics` (MRR, ARR, ARPU, activation); `operations.ts /runtime/overview` aggregates 17 snapshot tables; `operational_dashboard_snapshots`. | Churn/trends marked "needs backend"; `services/analytics-pipeline` is reserved (manifest-only); no BI layer, cohort, GMV reporting. |
| **Customer (shopper) Support Platform** | MISSING | `contact_submissions` flows shopper→merchant only. | Platform has no surface for shopper complaints about merchants (fraud shops, non-delivery). |
| **Employee Management Platform** | PARTIAL | `employees`, `employee_roles`, `employee_permissions`, `employee_invites` tables; `admin.ts` invite/deactivate/delete; console `/employees` roster (read-only). | Invite email is a TODO (never sent); permissions never enforced; no departments management; no onboarding/offboarding workflow. |
| **Teams Platform** | MISSING | `employees.department` text column. | No teams, no approvals, no internal comms, no task management, no employee activity tracking. See report 7. |
| **Partner Operations Platform** | PARTIAL | `app_developers` lifecycle (pending/approved/suspended/rejected), developer dashboard (`apps/app-marketplace /developers/dashboard`) with earnings/payout ledger view; `apps/developer-portal`. | No partner-ops internal UI: no developer verification queue, no payout release tooling, no partner communication system. |

## Backend Operations API (largely headless)

`services/api-gateway/src/routes/operations.ts` (all gated `requireRoleCategory('ops')` + `requireSuperAdmin`) exposes a substantial SRE/runtime control plane with **no corresponding UI for mutations**:

- Marketplace: `GET /marketplace-reviews`, `POST /marketplace-reviews/:id/decision` (only one with a UI)
- Eventing: outbox dispatch/list/dead-letters/replay; webhook deliveries + subscriptions CRUD
- Queues: `GET /jobs`, `POST /jobs/consume`, queue lease recovery, dead-letter redrive
- Incidents: `GET/POST /runtime/incidents`, `PATCH /runtime/incidents/:id/status`
- Replays: create + **authorize** (`POST /runtime/replays/:replayId/authorize`)
- Control: `POST /runtime/control-commands`; deployments, readiness gates, health gates
- Resilience: failover drills, chaos experiments, load tests, event-store integrity/archive, SRE error budgets
- Billing/usage: `GET /entitlements/:siteId`, `GET /usage`, `POST /usage/record`

Operating these today requires raw API calls with a super-admin session — effectively curl/Postman as the internal admin tool.

## Services Layer Reality

| Service | State |
|---|---|
| `services/api-gateway` | REAL — 35 routers, the entire platform backend |
| `services/webhook-service` | REAL — payment provider callbacks, idempotent dispatch |
| `services/queue-workers` | REAL — CF queue consumer, dead-letter + circuit breaker |
| `services/analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service` | RESERVED — `AGENTS.md` + `runtime.manifest.json` only, no source |

## Conclusion

LetBuyy today is operable only by a super-admin founder making raw API calls. Of 16 expected internal platforms, **0 are complete, 8 are partial, 8 are missing**. The single fully-functional internal workflow is marketplace review decisions. Everything else is read-only dashboards, disabled buttons, schema-without-API, or API-without-UI.
