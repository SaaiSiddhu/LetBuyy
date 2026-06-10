# 2. Employee Workflow Report

Simulation of each role attempting to do their job with the current platform. Classification: **Workable / Degraded / Blocked**.

## Role-by-Role Simulation

### Founder / CEO — DEGRADED
- **Can:** Log into `platform-console` (magic link + TOTP, email allowlist via `PLATFORM_CONSOLE_ALLOWED_EMAILS`); view users, stores, subscriptions, employees, audit logs, MRR/ARR analytics, runtime overview. Suspend a store and invite employees **via raw API** (`PATCH /admin/stores/:id/status`, `POST /admin/employees/invite` — `services/api-gateway/src/routes/admin.ts:104,255`).
- **Cannot (in UI):** Take any write action — every mutation button is disabled or absent. No global search. No GMV/revenue truth (console marks plan/revenue columns "backend needed").
- **Reality:** The founder runs the company from the database console and curl.

### Support Agent — BLOCKED
- Portal page exists (`platform-operations-portal /support`) but the API returns 501 (`SUPPORT_TICKETS_UNAVAILABLE`). Assign/priority/reply buttons rendered `disabled`.
- No ticket intake exists anywhere: merchants cannot file tickets; `contact_submissions` is shopper→merchant mail, not merchant→platform.
- **Out-of-system workflow forced:** personal email inboxes + spreadsheets. No merchant history, no internal notes, no escalation.

### Merchant Success Manager — DEGRADED
- **Can:** View computed health scores (healthy ≥80 / watch 55–79 / at_risk <55) at `/merchant-health`; view derived CRM contacts at `/crm`; view onboarding readiness checklist at `/operations/onboarding`.
- **Cannot:** Add notes, log interactions, assign follow-ups, send communications (all disabled; `/operations/communications` templates are hardcoded with no send backend).
- **Excel workflow forced:** exporting/copying health lists to track outreach.

### Theme Reviewer — DEGRADED
- **Can:** See pending submissions and approve/reject/request-changes with a reason at `/operations` (wired server action → `POST /operations/marketplace-reviews/:id/decision`).
- **Cannot:** Preview the theme, inspect code, see performance/a11y results, compare versions, delist after approval. Reviews blind on metadata + 2 automated checks (schema validation, persistence).
- Requires a super-admin session (`operations.ts` middleware) — reviewers must effectively be founders. The seeded `support`/`operations` employee roles cannot reach the queue.

### App Reviewer — DEGRADED (same queue)
- Same single queue UI; automated checks slightly richer (schema, developer profile, quality gate, extension lifecycle).
- **Cannot:** See app code, scopes diff between versions, communicate with developer beyond a one-shot `review_notes` text, track SLA, or kill a misbehaving published app from UI (suspend exists only as DB status + raw API path).

### Fraud Analyst — BLOCKED
- No fraud system. No queue, no scores, no chargeback/dispute records, no blocklists. Only artifact: `gift_card_ledger_entries.fraud_hold_reason` and the seeded permission string `operations → disputes.manage` (`database/supabase/seeds/001_seed.sql`) pointing at a system that doesn't exist.

### Operations Manager / SRE — DEGRADED
- **Can:** Read rich runtime overview in console `/operations` (queues, incidents, deployments, gates, error budgets). Full mutation suite exists in API (queue recovery, dead-letter redrive, replays + authorization, control commands, incident create/update, failover drills).
- **Cannot:** Do any of it from UI. Incident commander workflow is API-only; no paging/alerting integration; `notification-service` reserved.
- CLI tooling partially compensates: `infrastructure/scripts/` (production-deploy/rollback, chaos, load, certify) + 131 validators in `scripts/validators/`.

### Finance Manager — BLOCKED
- Ledgers exist (`partner_payout_ledger_entries`, `billing_history`, `app_billing_charges`) but no UI lists them, no payout approval/release workflow, no reconciliation reports, no invoice tooling, no tax reporting. Subscriptions page is read-only.
- **Out-of-system workflow forced:** SQL queries + bank portal + spreadsheets.

### Content Moderator — BLOCKED (platform level)
- Merchant-level moderation exists (product reviews moderation status, blog comment moderation in merchant control plane). Platform-level: no abuse reports, no flagged content queue, no takedown flow, no DMCA process.

### Developer Relations Manager — DEGRADED
- **Can:** See developer submissions in the review queue; developers self-serve via `apps/developer-portal` and app-marketplace developer dashboard.
- **Cannot:** Verify developers (status `pending/approved/...` has no queue UI), message developers, manage payouts, publish changelogs/announcements.

### Platform Administrator — DEGRADED
- **Can:** Console read surfaces + audit logs with filters; employee roster.
- **Cannot:** Manage feature flags (`operational_feature_flags` table has no toggle API or UI), rotate credentials from UI, manage allowlist (env var only), reset MFA, revoke sessions.

### Trust & Safety Analyst — BLOCKED
- `/trust-safety` page renders derived signals with all actions disabled and an explicit banner that backend endpoints don't exist. No cases, no evidence, no appeals, no KYC.

## Workflow Classification Summary

| Category | Findings |
|---|---|
| **Missing workflows** | Ticketing, fraud review, payout release, DSR/GDPR handling, developer verification, content takedown, incident paging, employee onboarding email, T&S case management, feature flag toggling |
| **Broken workflows** | Employee invite (email never sent — `// TODO: Send invite email` in `admin.ts`/`employee.ts`); ops portal login (no employee guard — TODO in `(auth)/login/page.tsx`); employee permissions (seeded, never checked) |
| **Manual workflows** | Store suspension (raw API), incident lifecycle (raw API), queue recovery (raw API), payout reconciliation (SQL), refund oversight (SQL) |
| **Excel workflows** | Merchant success tracking, finance reconciliation, support log |
| **Out-of-system workflows** | All merchant↔platform communication (personal email), internal team coordination (no tasks/chat), developer comms |

## Bottom Line

Of 13 simulated roles, **0 are fully workable, 7 are degraded, 6 are blocked.** Every role that touches money, risk, or merchant communication is blocked. The only role with a complete in-system loop is "super-admin acting as marketplace reviewer."
