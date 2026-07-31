# Operations Audit

**Date:** 2026-06-19  
**LCIS Domain:** `operations` (12 routes, 20 RPCs, 34 tables, 45 policies)  
**Evidence:** `services/api-gateway/src/routes/operations/`, `apps/platform-console/`, LCIS operations score 100%

---

## Completion Score: **83%**

---

## Sub-System Audit

### Admin (Platform Console)
**Score: 88%**

**What exists:**
- `apps/platform-console/` — dedicated operator admin app
- Internal console routes: `services/api-gateway/src/routes/internal-console.ts`
- Money reconciliation console: `routes/internal-console/money-reconciliation.ts`
- Compliance tools: `routes/internal-console/compliance.ts`
- Developer tools: `routes/internal-console/developers.ts`
- RBAC for platform operations: `routes/operations/rbac.ts`
- Trust & Safety tools: `routes/operations/trust-safety.ts`
- Operations `incident-command.ts`: incident management
- LCIS Intelligence Layer embedded in platform console (OMEGA, v11, Infinity modes)
- Money reconciliation page: `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx`
- Operations domain: 34 tables including `production_incidents`, `production_readiness_gate_runs`

**What is missing:**
- Internal route mTLS protection (SKIP-W4-MTLS — human seam)
- CF-Access for platform console (H-level, not code)

**Evidence:** LCIS operations domain score 100%, `internal-console/` routes, `platform-console/` app

---

### Support
**Score: 85%**

**What exists:**
- Support ticket system: `support_tickets` table
- Ticket messages: `ticket_messages` table
- Ticket macros: `ticket_macros` table (canned responses)
- SLA clocks: `ticket_sla_clocks` table
- CSAT tracking: `ticket_csat` table
- Operations support route: `routes/operations/support.ts`
- Notification suppression lists: `notification_suppressions`, `email_suppressions` tables

**What is missing:**
- Public-facing support portal (tickets likely submitted via internal tools, not merchant UI)
- Third-party helpdesk integration (Intercom, Freshdesk) — not in V1

**Evidence:** LCIS notifications domain — `support_tickets`, `ticket_messages`, `ticket_macros`, `ticket_sla_clocks`

---

### Moderation
**Score: 82%**

**What exists:**
- Review moderation: `sync_product_review_moderation_status` RPC
- `review_check_runs` table
- Marketplace review moderation: `routes/operations/marketplace-reviews.ts`
- Trust & Safety tools: `routes/operations/trust-safety.ts`
- `ts_case_events` table for trust & safety cases
- Content compliance: `routes/app-store/compliance-routes.ts`
- `risk_action_events` table

**What is missing:**
- Automated content moderation (AI-based) — not in V1
- Merchant content review workflow (merchant submits content, operator reviews)

**Evidence:** LCIS operations domain (`ts_case_events`, `risk_action_events` tables), `trust-safety.ts`

---

### Fraud
**Score: 78%**

**What exists:**
- Order risk assessment: `order_risk_assessments` table
- Order risk route: `services/api-gateway/src/routes/order-risk.ts`
- Risk operations: `routes/operations/risk.ts`
- `chargeback_events` table for chargeback tracking
- `risk_action_events` for risk-triggered actions
- Fraud signals collection (IP, device, behavior)
- Razorpay risk data integration (payment-level fraud signals)

**What is missing:**
- Machine learning fraud scoring (V2)
- Automated order holding on high risk score
- Chargeback dispute management workflow

**Evidence:** LCIS operations domain — `order_risk_assessments`, `chargeback_events` tables; `order-risk.ts`, `risk.ts`

---

### Internal Tools
**Score: 87%**

**What exists:**
- LCIS Intelligence System (the entire AI operations layer):
  - Launch Command Center (`/launch`)
  - AI Operations Center (`/ai-ops`)
  - Merchant OS (`/api/merchant-ops`)
  - Customer OS (`/api/customer-ops`)
  - Live Operations Center (INFINITY)
  - Detection (8 autonomous detectors)
  - Prediction (6 predictors)
  - Runbooks with escalation chains
- Money reconciliation with dual-control resolve/recheck
- KYC review console: `apps/platform-console/` KYC review
- Founding program management: `routes/founding.ts`, migration 176-177
- Employee management: `routes/employee.ts`
- Export tools: `routes/export.ts`

**What is missing:**
- Automated KYC provider (CAP-C15 — manual review only for V1)
- Real-time live data in LCIS (NOT CONNECTED until env wired)

**Evidence:** CLAUDE.md LCIS section, OMEGA/INFINITY/v11 architecture docs

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| CAP-C15 | KYC automated provider not live | Capability gap | Manual KYC review required for all merchants |
| H2 | Production secrets | Human seam | Operations tools fail without proper auth |
| SKIP-W4-MTLS | Internal route protection | Human seam | Internal routes need CF-Access or mTLS |

---

## Launch Readiness

**Operations is 83% ready.** The platform console, support ticket system, fraud tooling, and moderation infrastructure are in place. The LCIS intelligence layer provides the most advanced operational tooling of any feature in the platform.

V1 launch can proceed with manual KYC review and operators on standby for the first merchant cohort.

**Recommended V1.0.0 scope:** Platform console + support tickets + review moderation + order risk + money reconciliation + KYC manual review.

**Delay to V1.1:** Automated KYC (CAP-C15), CF-Access for internal routes, chargeback dispute workflow.

**Delay to V2:** ML-powered fraud scoring, automated moderation, third-party helpdesk integration.
