# 10. Operational Gap Analysis

LetBuyy compared against the internal operational capability set of Shopify, Stripe, Atlassian, and HubSpot. Benchmark capabilities are the publicly known internal/admin functions these companies operate; LetBuyy column reflects repository evidence.

## Capability Comparison

| Capability (benchmark exemplar) | Shopify-class expectation | LetBuyy today |
|---|---|---|
| Internal admin with full account actions (Shopify internal admin) | Suspend, adjust plan, credit, impersonate-with-guardrails, annotate | Read-only console; suspend via raw API only; no impersonation, credits, notes |
| Support ticketing + agent workspace (Shopify Support, Zendesk-class) | Queues, SLAs, macros, merchant 360, internal notes | **None** (501 endpoint) |
| Risk & fraud review queues (Stripe Radar) | Scored queues, claim/assign, related-entity links, terminal actions feeding rules | **None** |
| Disputes/chargebacks ops (Stripe) | Dispute lifecycle, evidence submission, deadlines | **None** (no dispute tables) |
| Marketplace app review (Shopify App Store review) | Queue + detail + automated static/security analysis + comms thread + appeal | Queue + one-step decision; contract-shape checks only |
| Theme review (Shopify Theme Store) | Preview env, perf/a11y budgets enforced, visual diff, takedown | Decision-only; budgets defined but unenforced; no takedown |
| Partner/developer operations (Shopify Partners, Atlassian Marketplace) | Partner verification, payout release, comms, policy strikes | Ledger schema only; no verification queue, no release workflow |
| Billing & revenue ops (Stripe billing ops, HubSpot) | Dunning, invoice ops, refunds console, revenue recognition, reconciliation | Schema (plans/subscriptions/billing_history); no dunning job, no finance UI |
| Trust & Safety case management (Shopify T&S) | Cases, evidence, graduated enforcement, appeals, regulator reporting | UI shell, all actions disabled, no case tables |
| Compliance/DSR automation (Shopify/Stripe GDPR tooling) | Data export/delete pipelines, retention enforcement, compliance dashboards | Webhook contract strings only; no DSR pipeline |
| Internal analytics/BI (all four) | GMV, cohorts, churn, funnel, per-team dashboards | MRR/ARR cards; churn "needs backend"; analytics-pipeline service reserved/empty |
| Feature flag operations (all four) | Flag console, env-scoped approvals, scheduled rollouts | Table with approval states; no API, no UI |
| Incident management (Atlassian/Opsgenie-class) | On-call, paging, status pages, postmortems | Incident API + tables; no UI, no paging (notification-service reserved), runbooks partial |
| Employee IAM & teams (Atlassian Admin) | Org directory, teams, SCIM/SSO, granular roles, approvals | employees table + unenforced roles; no teams, no SSO/SCIM, invite email TODO |
| Global entity search (all four) | Cross-entity admin search | Per-page partial search (stores/users) only |
| Audit & access governance (Atlassian audit log, Stripe) | Immutable audit + retention tiers + export + reason capture | Good audit schema + viewer; no export/retention/reason |
| Customer success platform (HubSpot CS workspace) | Health scores + playbooks + tasks + comms log | Health scores computed in-page; zero actions |
| Internal communication on entities (all) | Notes/threads on accounts, cases, reviews | None anywhere |

## Scale of the Gap (counts)

- **Missing internal systems (10):** support/ticketing, fraud/risk, disputes, T&S cases, compliance/DSR, finance ops console, developer-relations ops, internal comms/tasks, feature-flag ops, global search.
- **Missing employee tools (8):** agent workspace, reviewer detail tooling, payout release console, flag console, incident console, impersonation, merchant 360, employee directory management UI.
- **Missing operational workflows (12+):** trial expiry enforcement, dunning, suspension-with-case+appeal, reactivation, payout release, dispute response, DSR fulfillment, app kill-switch (UI), theme takedown, employee onboarding email, escalation, reviewer assignment.
- **Missing review systems:** static/security analysis (apps), preview + budget enforcement (themes), developer verification.
- **Missing moderation systems:** abuse reports, content scanning, takedown/DMCA, strikes.
- **Missing support systems:** intake, queueing, SLA, KB, CSAT, email-delivery lookup.

## What LetBuyy Has That Peers Would Recognize

Credit where due — foundations a Shopify engineer would recognize as the *right substrate*:
- Event-sourced ops plumbing: outbox + dead letters + replay-with-authorization, queue lease recovery, control-command journal.
- Marketplace review records with automated-check JSON and decision audit fields.
- `audit_logs` with actor typing, old/new values.
- State machines in CHECK constraints across every operational entity.
- Governance-as-code: ~115 governance docs + 131 validators + evidence-recording contracts (`docs/governance/operational-evidence-governance.md`).

The gap is consistently the same shape: **data model and (often) API exist; the human-operable system above them does not.**

## Conclusion
Against the four benchmarks, LetBuyy fields roughly the bottom 20% of each capability (schema/eventing) and almost none of the top 80% (queues, consoles, workflows, communication, enforcement). The platform is built for machines to operate and audited for compliance documents — not yet built for employees to run.
