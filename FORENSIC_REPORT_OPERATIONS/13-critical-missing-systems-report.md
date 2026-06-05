# 13. Critical Missing Systems Report

The systems whose absence blocks LetBuyy from operating as a company (not a codebase). Ordered by criticality. "Foundation present" notes what already exists to build on — documented as fact, not as a design proposal.

## Tier 1 — Existential (blocks operating at all beyond founder-scale)

### 1. Support Platform (intake → queue → agent workspace)
- **Absent:** ticket tables, intake surface, queueing, SLA, notes, history, KB, CSAT.
- **Foundation present:** UI shell (`/support` page), employee verification, seeded support permissions, `contact_submissions` pattern to generalize, `email_logs` for delivery lookups.
- **Blocked roles:** Support Agent (entirely); every other role that escalates.

### 2. Employee Access Control (enforced)
- **Absent:** employee auth guard on ops portal; enforcement of `employee_permissions`; role tiers below super-admin; invite email delivery.
- **Foundation present:** full schema (`employees`, `employee_roles`, `employee_permissions`, `employee_invites`), login/accept-invite endpoints, console's working allowlist+MFA implementation as the reference, `requireRoleCategory` middleware extensible beyond `ops`.
- **Blocked:** hiring anyone safely.

### 3. Fraud & Risk Platform
- **Absent:** everything — scoring, queues, blocklists, velocity, disputes/chargebacks, KYC.
- **Foundation present:** `payment_transactions`/`payment_webhook_events` data, `audit_logs`, event bus (outbox), Radar-style review-queue pattern already proven in marketplace reviews.
- **Blocked roles:** Fraud Analyst; Finance (dispute response); existential payment-partner exposure.

### 4. Trust & Safety Case Management
- **Absent:** case tables, evidence, graduated enforcement, appeals, merchant notification on enforcement.
- **Foundation present:** suspension API with audit logging (`admin.ts:104`), storefront suspension enforcement, T&S UI shell listing derived signals, `audit_logs.actor_type` taxonomy.
- **Blocked roles:** T&S Analyst, Content Moderator.

## Tier 2 — Blocking growth and money handling

### 5. Finance Operations Console
- **Absent:** payout release workflow (ledger entries never transition), reconciliation, invoice ops, refund oversight, revenue reporting beyond MRR cards.
- **Foundation present:** complete ledger schemas (`partner_payout_ledger_entries` with rails + GST fields, `billing_history`, `app_billing_charges`), `complete_order_refund()`.

### 6. Billing Lifecycle Enforcement
- **Absent:** trial-expiry job (`frozen` never set), dunning, plan-limit enforcement (`plan_entitlements` defined, unenforced).
- **Foundation present:** all states in schema (`trial_status`, `sites.status='frozen'`), `plans`/`plan_entitlements`/`subscriptions`, queue-workers service for jobs.

### 7. Merchant Communication System
- **Absent:** any platform→merchant messaging: announcements, enforcement notices, review decisions, dunning notices.
- **Foundation present:** `notifications`/`notification_preferences` tables, `email_logs`, notification-core package contracts, hardcoded template stubs in ops portal.

### 8. Review Tooling Depth (apps + themes)
- **Absent:** detail/diff views, static & security analysis, theme preview, budget enforcement, assignment, SLA, appeal, takedown/kill-switch UI.
- **Foundation present:** the entire review-record pipeline, automated-check JSON envelope, performance budgets already declared in renderer manifests, extension revocation states.

## Tier 3 — Required for institutional operation

### 9. Compliance / DSR Platform
- **Absent:** data export/delete pipelines, request tracking with deadlines, retention enforcement (`retention_policies` table unused), compliance reporting.
- **Foundation present:** app compliance webhook contract (`customers/data_request`, `customers/redact`, `shop/redact`), audit infrastructure.

### 10. Internal Analytics / BI
- **Absent:** GMV, cohorts, churn, funnels, per-team dashboards; `services/analytics-pipeline` is an empty reserved root.
- **Foundation present:** `analytics_events`/rollups tables, `operational_dashboard_snapshots`, console summary endpoints.

### 11. Incident & Alerting Operations
- **Absent:** UI for the existing incident API, paging/alerting (notification-service reserved), on-call, postmortem workflow.
- **Foundation present:** `production_incidents` schema + CRUD API, runtime overview aggregation, runbook governance docs.

### 12. Teams Layer (departments, tasks, approvals, comms)
- **Absent:** all of it (report 7).
- **Foundation present:** `department` column, approval-state vocabulary scattered in schemas (flags, replay authorize).

### 13. Internal Admin Action Layer + Global Search + Impersonation
- **Absent:** UI mutations across console, unified search, guardrailed impersonation.
- **Foundation present:** admin API endpoints (status/employees), search_documents table + search-core package, audit plumbing for dual-identity logging.

## Cross-Cutting Observation
Every missing system shares one root cause: **the platform was built API-first and governance-first, but operator-last.** Schemas anticipate the workflows (seeded permissions for ticketing, approval states for flags, fraud-hold fields, T&S UI shells) — the human-facing halves were deferred across the board. The Evidence Appendix (report 15) maps each anticipatory artifact to its missing counterpart.
