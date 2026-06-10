# LetBuyy Internal Operating System — Master Report

**The source-of-truth document for building LetBuyy's internal operating system from startup scale to Shopify scale.**

**Date:** 2026-06-08 · **Status:** consolidated master · **Supersedes as the entry point:** [`LETBUYY_INTERNAL_OPERATING_SYSTEM.md`](LETBUYY_INTERNAL_OPERATING_SYSTEM.md) (2026-06-06) and the nine platform docs in [`internal-operating-system-audit/`](internal-operating-system-audit/), which remain the detailed per-platform references.

---

## How to read this document

This master report consolidates a 16-phase internal-operations audit. Rather than duplicate the nine code-grounded platform audits that already exist in this repo, it **reuses and links them**, adds the phases they did not cover (internal persona map, RBAC-at-scale verdict, P0–P3 gap analysis, scale-tiered roadmap, world-class benchmark scorecard, and a brutal review), and — critically — **folds in the security reality discovered on 2026-06-07**, two days after the original internal-OS audit was written. An internal operating system is only as trustworthy as the data plane beneath it, and that data plane changed materially after the original audit.

**Method (unchanged discipline).** Every capability claim is grounded in a real file, endpoint, or table. The original 2026-06-06 absence claims ("greenfield") were proven by `grep` against `database/supabase/migrations/000_baseline.sql` (237 tables) and the gateway route tree, not assumed; this 2026-06-08 version overlays the shipped internal-OS foundation migrations, routes, workers, and UI. Benchmarks are sourced to current (2025–2026) Shopify, Stripe, and Cloudflare/SRE documentation, cited at the end.

**Provenance of the nine companion audits.** I re-verified their key claims against the pre-foundation live schema before consolidating: 0 risk/fraud/chargeback tables ✔, 0 ticket tables ✔, 0 abuse/appeal/takedown/case tables ✔, `production_incidents` real ✔, `marketplace_review_records` real ✔, 47 endpoints in `operations.ts` ✔ (the audit said "~45"), employee RBAC tables real ✔. Those absence claims were accurate when written; migrations `113` and `124`-`135` plus the matching gateway/UI/worker work now supersede them for current-state scoring. The companion audits remain trustworthy as historical gap evidence.

---

## 0. Headline verdict

> **LetBuyy now has the foundation of a real internal operating system: two governed operator apps, a Cloudflare-flavoured `/v1/operations/*` control plane, immutable audit logging, scope-enforced employee RBAC, operator MFA, and shipped human-judgment workflows for Risk, Trust & Safety, Support, review queues, executive analytics, incident command, Developer 360, Merchant 360, and Compliance. The remaining danger is not missing code so much as unclosed production authority: protected migrations, secrets, vendors, payout/paging/audit-export go-live, and legal/policy sign-off. And until 2026-06-07, the whole thing sat on a payments/identity base with two now-fixed critical exploits — a reminder that the internal OS cannot be declared "safe to operate" on governance theater or source code alone.**

### Two halves, very different maturity

- **The machine half** (runtime ops, queues, incidents, SRE/error budgets, security-enforcement projections, certification) is **real** and now has interactive incident command surfaces.
- **The human half** (risk decisions, abuse cases, appeals, takedowns, support tickets, reviewer queues, finance ops, exec analytics) has moved from mostly absent to **foundation-real**: deterministic rules and workflows exist, but production policy/vendor activation is still human-owned.

### Updated maturity scorecard (folds in the 2026-06-07 security reality and 2026-06-08 foundation build)

| Internal platform | LetBuyy today | Benchmark | Score /5 | Δ vs 06-06 audit |
|---|---|---|---|---|
| Governance / RBAC | Fine-grained scopes enforced on internal routes; SoD, reason capture, break-glass, access reviews, and sensitive-read audit shipped; SSO/SCIM still pending | Atlassian / enterprise | 3.4 | +0.9 |
| Merchant Operations Console | Merchant 360 search/detail aggregate, audited views/actions, read-only time-boxed impersonation, and dual-control moderation shipped | Shopify | 3.0 | +1.0 |
| Support Operations | Persistent tickets, messages, macros, SLA clocks, CSAT, Merchant-360 inline context, and escalations shipped; external inbox/chat still pending | Stripe / Intercom | 2.5 | +1.5 |
| Risk Detection | Rules-based scoring, signals, velocity counters, chargeback events, explainable action events, review queue, and auto T&S handoff shipped | Stripe Radar | 2.5 | +2.0 |
| Trust & Safety | Case/evidence/policy/appeal/takedown lifecycle, SoD appeals, dual-control reinstatement, notifications, and forever-audit shipped; legal wording pending | Shopify T&S | 2.5 | +1.5 |
| App Review | Reviewer console, claim/assign/comments/decisions, automated app checks, check-run persistence, and fail-closed approvals shipped | Shopify App Review | 3.0 | +1.0 |
| Theme Review | Theme reviewer console and deterministic perf/a11y/security/compat/code-quality checks shipped; paid security vendor pending | Shopify Theme Store | 2.5 | +1.0 |
| Developer Operations | Developer 360, payout reconciliation, disputes, suspend/freeze controls, and dual-control payout release approval shipped; live transfer credentials pending | Stripe / Shopify Partners | 3.0 | +0.5 |
| Incident Response | Interactive command UI, on-call schedules, dry-run paging, runtime control actions, and SEV-1/2 postmortem close gate shipped | Cloudflare / PagerDuty | 3.5 | +0.5 |
| Executive Analytics | Versioned metric definitions, MRR/ARR/churn/cohort/funnel rollups, staleness handling, and PII drill-through audit shipped | Stripe Sigma / Notion | 3.0 | +1.5 |
| Audit & Compliance | Data-subject request workflow, retention-policy view, T&S erasure exception, and dry-run audit-export sink shipped; SIEM/WORM and EU legal activation pending | SOC2 / GDPR norms | 3.0 | +1.0 |
| Operations / SRE control plane | **Real**, 47 endpoints | Cloudflare | 3.5 | — |
| **Identity / payments trust base** *(new axis)* | **Two CRITICAL exploits fixed in code 06-07; operator deploy steps still manual** | Stripe / Shopify platform security | **2.5** | **new** |

**Overall internal-OS maturity: ~3.0 / 5** against a billion-dollar benchmark, on the strength of shipped code through Wave 11. This is still conditional: protected migrations `107` and `113`–`135`, production secrets, paid vendors, legal approvals, and live paging/audit export/payout transfer activation remain human-owned deploy or policy steps.

**The good news, stated precisely:** ~70% of the *plumbing* for the internal OS already exists and is governance-approved — the two operator apps, the employee RBAC tables, the immutable `audit_logs` trail, and the `/v1/operations/*` plane. The remaining work is to build judgment workflows **on top of** it as modules in the two existing apps. It is not a platform-invention problem.

---

## Phase 1 — Internal system discovery

### 1.1 The surfaces that exist today

LetBuyy's internal OS is **two governed web apps + one gateway control plane** — not the 12-subdomain fleet the original vision imagines. This is deliberate: `AGENTS.md` and `docs/governance/topology-purification.md` forbid casually adding app roots, and split operator work into two surfaces.

| Surface | Root | Actor | Auth | Backs onto |
|---|---|---|---|---|
| **Platform Console** | `apps/platform-console` | Super-admin / leadership | Magic-link + MFA/TOTP (`LETBUYY_PLATFORM_SESSION_COOKIE`) | `/v1/internal/console/*`, `/v1/operations/*` |
| **Platform Operations Portal** | `apps/platform-operations-portal` | Employees (support/ops/marketing) | Employee session + invite (`/v1/employees/auth`) | `/v1/employees/*`, `/v1/operations/*` |
| **Operations control plane** | `services/api-gateway` `/v1/operations/*` | Operators via token / employee auth | `requireRoleCategory` / `requireSuperAdmin` | ~25 projection tables, 47 endpoints |
| **Reserved operator mobile** | `apps/mobile/operator-app` | Operators (future) | — | Manifest-only; **not active** |

Console modules that exist: `dashboard`, `stores`, `merchants`, `risk`, `revenue`, `subscriptions`, `users`, `employees`, `analytics`, `audit-logs`, `trust-safety`, `operations`, `marketplace-governance`, `compliance`, `settings`.
Ops-portal modules that exist: `support`, `tickets`, `risk`, `trust-safety`, `developers`, `crm`, `merchant-health`, `retention`, `onboarding`, `communications`, `campaigns`, `marketing`, `users`.

### 1.2 What exists / partially exists / is missing (verified capability matrix)

| Capability | State | Evidence |
|---|---|---|
| Immutable audit trail | ✅ Exists | `audit_logs` (+ `audit_activity_events`, `execution_audit_trail`); actor_type ∈ {user, employee, super_admin, system}, old/new values, ip, user_agent |
| Employee RBAC | ✅ Exists | `employees`, `employee_roles`, `employee_permissions`, `employee_invites`; 10 roles; route guards `requireRoleCategory`/`requireSuperAdmin` in `rbac.ts` |
| Operator MFA / TOTP | ✅ Exists | `platform-console` `(auth)/mfa`, `console-session.ts`; dev-bypass fails closed in prod |
| Incident records + lifecycle | ✅ Exists | `production_incidents` (sev1–4), `production_incident_events`, `/operations/runtime/incidents` GET/POST/PATCH |
| SRE / error budgets / certification | ✅ Exists | `sre_error_budget_snapshots`, `runtime_slo_definitions`, `operational_certification_reports` |
| Marketplace review queue + decision | ✅ Exists | `marketplace_review_records` (app/theme, 5 statuses, `automated_checks` jsonb), `/operations/marketplace-reviews[/:id/decision]` |
| Partner economy (accounts/keys/OAuth/payouts) | ✅ Exists | `app_developers`, `partner_payout_ledger_entries` (80/20, INR rails), OAuth+PKCE in `billing-oauth-routes.ts` |
| Merchant directory | ✅ Foundation shipped | Merchant 360 aggregate + audited reads/actions + read-only impersonation via `impersonation_sessions` |
| Trust & Safety surface | ✅ Foundation shipped | `ts_cases`, `ts_case_events`, `ts_evidence`, `ts_appeals`, `ts_takedowns`, policy versions, SoD appeals |
| Executive analytics | ✅ Foundation shipped | Versioned MRR/ARR/churn/cohort/funnel rollups with staleness states and audited drill-through |
| Reviewer workflow UI | ✅ Foundation shipped | Operations reviewer console, claim/assign/comments/decisions, `review_check_runs`, populated `automated_checks` |
| Risk scoring / fraud / chargeback | ✅ Foundation shipped | `risk_signals`, `risk_scores`, `risk_rules`, `velocity_counters`, `chargeback_events`, explainable action events |
| T&S case management / appeals / takedowns | ✅ Foundation shipped | Case/evidence/appeal/takedown lifecycle with forever-audit and subject notification hooks |
| Support tickets | ✅ Foundation shipped | `support_tickets`, messages, macros, SLA clocks, CSAT, Merchant-360 inline context, escalation |
| On-call / paging | ✅ Dry-run foundation shipped | `oncall_schedules`, incident postmortems, current on-call resolver, dry-run paging adapter; live provider pending |
| Data warehouse / cohorts / MRR-ARR | ✅ Internal rollups shipped | `metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps`; external warehouse still future |

### 1.3 Duplicate systems & technical debt (the honest part)

- **Merchant context is split across two apps.** Console (`stores`, super-admin) and ops-portal (`merchant-health`, `crm`, employee-scoped) each hold half a merchant's picture. There is no single "open one merchant, see everything" pane. This is duplication that will harden into a permanent seam if a Merchant-360 aggregate is not built before more modules attach.
- **`theme_reviews` vs `marketplace_review_records` name collision.** `theme_reviews` is **merchant star-ratings** (shopper feedback); platform theme review rides on `marketplace_review_records` with `submission_type='theme'`. Easy to conflate; the schema does not help you.
- **Document bloat is itself the dominant technical debt of this repo.** Root holds ~15 `CODEX_*` ledger/status files (100KB+ each in places), two `FORENSIC_REPORT*` directories, multiple overlapping production-readiness audits, a CTO war-room report, and `docs/` has ~116 subdirectories. Of ~167 governance validators, roughly **8 do real analysis**; the rest string-match markdown/JSON "evidence" files (one convergence manifest literally declares `mode: "governance-contract-not-live-evidence"`). **All 167 passing does not mean production-ready.** This matters for the internal OS because it is easy to mistake the *description* of an operating system for the operating system.
- **RBAC is now scope-enforced, but identity lifecycle is not enterprise-complete.** `employee_permissions` scopes, SoD, reason capture, read audit, break-glass, and access-review records are wired; SSO/SCIM, production recertification cadence, and joiner-mover-leaver automation remain future work.
- **Engineering-reality debt carried from the production-readiness audits:** ~89 real circular import cycles in `api-gateway` while the circular-import validator reports "0"; the ~7 genuinely behavioral api-gateway tests are orphaned (wired to no CI command); CI uses `--filter=...[HEAD^1]` so untouched-package regressions can ship.

---

## Phase 2 — Internal persona map

The vision lists ~12 internal teams; each needs a home. LetBuyy's governance forbids `apps/internal`, `apps/admin`, `apps/risk`, `apps/support` as roots — so every persona below is a **module inside `platform-console` or `platform-operations-portal`**, gated by an employee role. "Permissions" maps to the real role set (`support, sales, marketing, operations, manager, admin, editor, viewer, fulfillment, staff`) plus the proposed Viewer/Operator/Lead/Admin tiers in Phase 12.

| Persona | Core responsibility | Permission tier | Required tools / dashboards | Primary home (today) | Status |
|---|---|---|---|---|---|
| **Founder / CEO** | Run the company; top-line truth | Admin (allowlist) | MRR/ARR, churn, activation funnel, company-health row | Console → Dashboard, Revenue, Analytics | ✅ rollups shipped |
| **Platform Admin / Super-admin** | Privileged administration, config, RBAC | Admin + dual-control | Everything; employee mgmt; audit center | Console (all modules) | ✅ real spine |
| **Merchant Success** | Health, retention, expansion | Operator (operations) | Merchant-health board, CRM, churn tags, renewal dates | Ops-portal → merchant-health, crm, retention | 🟡 partial |
| **Support Agent (L1)** | Resolve merchant problems with context | Operator (support) + reason for PII | Ticket + Merchant-360 inline, macros, SLA timers | Ops-portal → support, tickets | ✅ foundation shipped |
| **Support Lead (L2)** | Escalations, SLA breaches, QA | Lead | Team board, breach view, escalation funnel, CSAT | Ops-portal → support | ✅ foundation shipped |
| **Risk Analyst** | Triage flagged entities, tune rules | Operator (risk) | Risk overview, entity-risk detail, rule performance | Console + Ops-portal → Risk | ✅ rules foundation shipped |
| **Risk Lead** | Approve auto-action thresholds | Lead + dual-control | Threshold console, loss/chargeback rate | Console + Ops-portal → Risk | ✅ defaults shipped; policy sign-off pending |
| **Trust & Safety Analyst** | Work case queue, gather evidence | Operator (trust-safety) | Case queue, case detail, evidence, linked risk | Console + Ops-portal → Trust & Safety | ✅ foundation shipped |
| **Trust & Safety Lead** | Takedowns, appeals (SoD), policy | Lead + segregation of duty | Enforcement board, appeals, overturn rate | Console + Ops-portal → Trust & Safety | ✅ foundation shipped; legal sign-off pending |
| **App Reviewer** | Gate apps: data/scope/security | Operator (reviewer) | Reviewer queue, app detail, automated-check results | Ops-portal reviewer console | ✅ foundation shipped |
| **Theme Reviewer** | Gate themes: perf/a11y/security/compat | Operator (theme reviewer) | Theme queue, preview + code + QA report | Ops-portal reviewer console | ✅ foundation shipped |
| **Developer Relations / Partner Ops** | Verify, support, communicate with devs | Operator (devrel) | Developer-360, verification backlog, payouts | Ops-portal → Developer 360 | ✅ foundation shipped |
| **Finance / Revenue Ops** | Revenue recognition, payouts, dunning | Lead (finance) + dual-control on payouts | Revenue, subscriptions, payout ledger, reconciliation | Console Revenue + Ops Developer 360 | ✅ reconciliation shipped; live transfer pending |
| **Operations / Platform Eng** | Runtime, queues, deployments | Lead (platform-operator) + audit | Runtime overview, queues, deployments, SRE | Console → Operations | ✅ interactive command shipped |
| **Incident Commander** | Command SEV-1/2, coordinate, postmortem | Lead + dual-control on mitigations | Incident command, timers, mitigations, comms | Console → Operations (incidents) | ✅ backend-real |
| **Legal / Compliance** | Copyright/trademark, regulator, GDPR | Lead + legal allowlist | T&S case detail, takedown records, data-request flows | Console → Compliance | ✅ foundation shipped; legal activation pending |
| **Marketplace Governance** | Policy, appeals oversight | Admin | Governance dashboards, policy versions | Console → marketplace-governance / Trust & Safety | ✅ foundation shipped |

**Governance fact that shapes every persona:** the console owns *governance and privileged administration*; the operations portal owns *employee execution with narrower permissions and stronger per-action audit*. Risk **detection** (machine) belongs to the console/leadership view; Risk **decisions** (human) belong to the operations portal. App/Theme review queues are shared; the *decision* is an employee action. This ownership split is a hard rule in `platform-operations-governance.md` and must not collapse.

---

## Phases 3–11 — Per-domain audit (synthesis)

Each domain below maps to a numbered audit phase and links to its full companion doc. Format: **maturity · what's real (cited) · the gap · the build · the benchmark.**

### 3 · Merchant Operations Console — 2.0/5 → [full doc](internal-operating-system-audit/MERCHANT_OPERATIONS_CONSOLE.md)

**Real:** a governed merchant directory — `apps/platform-console/.../stores/page.tsx` lists tenant `sites` via `/v1/internal/console/stores` (search, status filter, pagination); ops-portal `merchant-health` + `crm` + `retention` give Merchant Success an employee-scoped view. **Gap:** no unified "Merchant 360" — no single pane joining a store to its orders, subscription, installed apps, active theme, tickets, and risk; **no operator actions** (impersonate, adjust plan, suspend); context is fragmented across two apps. **Build:** one aggregate endpoint `/v1/internal/console/merchants/:id/overview` + one `merchants/[id]/page.tsx`; no new tables required initially. **Benchmark (Shopify):** one search box → one merchant → full context + heavily audited staff actions, including consented, audited impersonation. LetBuyy has the directory and the audit spine; it lacks the 360 view and the action layer — mostly an assembly problem because the data already lives in governed tables.

### 4 · Support Operations — 1.0/5 → [full doc](internal-operating-system-audit/SUPPORT_OPERATIONS_PLATFORM.md)

**Foundation shipped:** the operations portal support workspace now persists `support_tickets`, `ticket_messages`, `ticket_macros`, `ticket_sla_clocks`, and `ticket_csat`; `/v1/operations/support/*` handles create/assign/reply/internal-note/escalate/resolve/CSAT paths; `/employees/tickets` reads real tickets instead of a hardcoded unavailable probe; Merchant-360 context is inline; SLA breaches and dry-run CSAT dispatch are surfaced. **Remaining gap:** external inbox/chat provider, plan-tier SLA/CSAT sign-off, and AI deflection policy. **Benchmark (Stripe/Intercom/Zendesk):** omnichannel intake, SLA tiers, macros, inline customer context, CSAT, AI deflection.

### 5 · Risk Detection Platform — 0.5/5 → [full doc](internal-operating-system-audit/RISK_DETECTION_PLATFORM.md)

**Real:** nothing risk-specific. `grep` for `risk_*`/`fraud`/`chargeback` → **0 tables**; the only risk-adjacent data is `security_enforcement_events`, which is *infrastructure* control-checks, not *merchant/transaction* risk. **This is the single biggest exposure gap for a payments-handling platform.** **Gap:** no scoring, no rules engine, no velocity counters, no chargeback tracking, no review queue. **Build (Phase-1 priority):** `risk_signals`, `risk_scores`, `risk_rules`, `velocity_counters`, `chargeback_events`, `risk_action_events`; start **rules-based** (velocity + payment + identity — deterministic, explainable), layer ML at 10k; reuse the rich raw signals already in `audit_logs` (ip, user_agent, action velocity) and the payment tables. **Benchmark (Stripe Radar):** scores every payment 0–99 (≥65 elevated, ≥75 high), combining hundreds of network signals with custom rules, **routing midrange scores to human review** rather than blocking outright. The non-negotiable to copy: **explainability** — every auto-action needs a human-readable reason, both for appeals and to avoid silently nuking legitimate India-first merchants.

### 6 · Trust & Safety Platform — 1.0/5 → [full doc](internal-operating-system-audit/TRUST_AND_SAFETY_PLATFORM.md)

**Foundation shipped:** T&S now has `ts_cases`, `ts_case_events`, `ts_appeals`, `ts_takedowns`, `ts_evidence`, versioned policies, audited `/v1/operations/trust-safety/*` mutation endpoints, SoD appeals (appeal reviewer ≠ enforcing reviewer), dual-control reinstatement, and forever-retention semantics for enforcement records. **Remaining gap:** final legal/policy wording, regulator/court-order workflow specifics, severe-violation contacts, and production notification copy require human sign-off. **Benchmark (Shopify/Stripe T&S + marketplace norms):** case management, evidence, tiered review, SoD on appeals, immutable forever-audit, policy versioning, regulator workflows, and an **accessible appeal mechanism with stated timelines**. The discipline to preserve: **never an irreversible action without a logged reason and an appeal path.**

### 7 · Theme Review Platform — 1.5/5 → [full doc](internal-operating-system-audit/THEME_REVIEW_PLATFORM.md)

**Foundation shipped:** themes ride the working marketplace review queue (`marketplace_review_records.submission_type='theme'`) and now have deterministic theme QA runs in `services/queue-workers`, persisted `review_check_runs`, populated `automated_checks`, and an ops-portal reviewer console for queue/detail/decision work. The theme **data model is rich** (`theme_packages`, `theme_package_versions`, `theme_releases`, schema/section/block manifests), so compatibility checks are tractable. **Remaining gap:** paid scan vendor, deeper manual QA program, and final public rubric wording. **Benchmark (Shopify Theme Store):** minimum **Lighthouse performance ≥60** and **accessibility ≥90**, ARIA labels, keyboard nav, visible focus, **44×44px touch targets**, and critical-path testing.

### 8 · App Review Platform — 2.0/5 → [full doc](internal-operating-system-audit/APP_REVIEW_PLATFORM.md)

**Foundation shipped:** the backend is genuinely there — guarded marketplace-review operations routes, `marketplace_review_records` with a 5-state machine (`pending → in_review → changes_requested → approved/rejected`), developer submission via `/v1/app-store/developers/apps` + manifest validation, API-key issuance, OAuth+PKCE — and now the missing reviewer console plus `review_check_runs` table and deterministic automated app checks are wired. **Remaining gap:** paid security scan vendor, annual penetration-test evidence, final published rubric wording, and broader post-publish monitoring. **Benchmark (Shopify App Review, 2025–26):** mandatory **automated checks that must pass before submission**, **<500ms response for 95% of requests**, **Lighthouse drop <10%**, **annual penetration test**, **protected-customer-data** rules, and mandatory **compliance webhooks** (`customers/data_request`, `customers/redact`, `shop/redact`) — which now also create compliance workflow rows.

### 9 · Developer Operations — 2.5/5 → [full doc](internal-operating-system-audit/DEVELOPER_OPERATIONS_PLATFORM.md)

**Real — the strongest "human" platform:** `app_developers` (verification states), self-serve registration, app + API-key + OAuth-client issuance, `webhook_subscriptions`, and `partner_payout_ledger_entries` encoding an **80/20 revenue share (8000 bps) over India-first rails (UPI/RazorpayX/razorpay_route)** — ahead of where most platforms start. **Gap:** no consolidated internal "Developer-360 + violations" operator view; payout reconciliation/dispute tooling thin. **Build:** `/v1/internal/console/developers/:id/overview` aggregate (developer + apps + installs + payouts + open cases) + a Developer-360 page + reconciliation tooling for Finance. **Benchmark (Stripe Connect / Shopify Partners):** developer accounts, key/OAuth management, granular payouts with reconciliation, violation enforcement, partner analytics. The gap is the **operator console, not the partner economy.**

### 10 · Incident Response — 3.0/5 → [full doc](internal-operating-system-audit/INCIDENT_RESPONSE_PLATFORM.md)

**Foundation shipped:** `production_incidents` (sev1–4, commander, affected runtimes/regions, customer impact, postmortem_url) + `production_incident_events` timeline; interactive incident command actions; dry-run paging; `oncall_schedules`; `incident_postmortems`; runtime control command submission; SEV-1/2 close-gate; queue lease recovery, dead-letter redrive, replays, failover drills, chaos experiments, deployment health gates; reliability evidence (`sre_error_budget_snapshots`, `runtime_slo_definitions`, `operational_certification_reports`); plus `incident-response-governance.md` and a SEV-1 runbook. **Remaining gap:** PagerDuty/Opsgenie go-live, public status page, and operator-mobile activation remain human-owned. **Benchmark (Cloudflare/SRE):** a 4-level severity taxonomy, an incident commander, audited mitigations, error budgets, and a **blameless postmortem for every SEV-1/SEV-2**.

### 11 · Audit & Compliance — audit spine real, compliance workflow foundation shipped → [exec analytics doc](internal-operating-system-audit/EXECUTIVE_ANALYTICS_PLATFORM.md)

**Foundation shipped:** an immutable audit spine — `audit_logs` + `audit_activity_events` + `execution_audit_trail` capture actor, action, resource, old/new values, ip, user_agent across user/employee/super_admin/system actors; runtime mutations also log to `runtime_control_commands`. Compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) now create or update `data_subject_requests`; the Platform Console has a Compliance module, retention-policy view, T&S retention-exempt handling, and `audit_export_cursors` with a dry-run checksum sink. Executive analytics now has nightly rollups in `queue-workers` (`metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps`) and versioned metric definitions. **Remaining gap:** external SIEM/WORM export, EU legal activation, and finance/founder metric-definition sign-off. **Benchmark (Stripe Sigma / Notion / SOC2 norms):** trustworthy, drill-able, versioned metric definitions and exportable, tamper-evident audit.

---

## Phase 12 — RBAC & permissions audit: can it safely support 10 / 50 / 100 employees?

### 12.1 What's real

- **Identity & roles:** `employees`, `employee_roles` (custom roles via `role_id` FK), `employee_permissions` (jsonb scopes), `employee_invites`. Role enum: `support, sales, marketing, operations, manager, admin, editor, viewer, fulfillment, staff` (10).
- **Route enforcement:** `services/api-gateway/src/middleware/rbac.ts` exposes `requireRole(...)`, `requireRoleCategory(...)`, `requireSuperAdmin`, `requirePermission(...)`, SoD helpers, reason validation, and sensitive-read audit helpers. New internal OS routes enforce granular scopes server-side.
- **Operator MFA/TOTP**, magic-link auth, dev-bypass that fails closed in prod.
- **Immutable audit** on privileged actions plus sensitive reads.
- **Break-glass and access reviews:** `break_glass_grants`, `access_review_records`, RBAC operations endpoints, and Platform Console employee screens for scope assignment, time-boxed break-glass grant/expiry, and access-review recording.
- **Post-2026-06-07 hardening (migration 107):** `employee_permissions` **writes** locked down; credential/session/token tables re-scoped to `service_role` (see Phase 12.3 / security overlay).

### 12.2 What's missing for multi-team safety

- **SSO/SCIM is still missing.** The console is an email allowlist + magic link; joiner-mover-leaver automation remains manual.
- **Periodic access review is recorded, not operationally mature.** The table, API, and screen exist; quarterly cadence, reviewer ownership, and recertification evidence discipline still need production process.
- **`employee_roles` is anon-readable** (`CREATE POLICY anyone_read_roles ... USING (true)`) — low-risk (role *definitions*, no secrets) but symptomatic of the RLS-discipline gap.
- **Read audit is foundation-real but must be broadened continuously.** Merchant 360, analytics drill-through, compliance, RBAC inspection, and other new sensitive reads log audit rows; older surfaces should keep being pulled into the same pattern.

### 12.3 Verdict by headcount

| Headcount | Safe today? | What it takes |
|---|---|---|
| **10 employees** | **Yes, after deploy gates.** | Scope RBAC + MFA + immutable audit + reason capture + SoD + break-glass is adequate at founder-trust scale, **provided** the 2026-06-07 fixes and internal-OS migrations are actually deployed and secrets are rotated/provisioned. |
| **50 employees** | **Conditionally yes.** | Specialized Risk/T&S/Support/Review teams can operate on the shipped scope model if quarterly access reviews, break-glass owner review, and policy approvals are run as a real operating process. Add SSO/SCIM before the team grows further. |
| **100 employees** | **No.** | Add **SSO + SCIM** (joiner-mover-leaver automation), **full read+write audit with SIEM export**, **policy-versioned RBAC recertification**, regional/data-residency scoping, and likely **dedicated operator consoles** (Stage B) so blast radius is partitioned by team. |

**Bottom line:** the *primitives* and enforcement granularity are now correct for the foundation stage. The gap between "50" and "100" is no longer basic RBAC wiring; it is production identity lifecycle, recertification discipline, SIEM export, and human approval of the policy defaults.

---

## Security overlay — the trust base beneath the internal OS (post-2026-06-07)

The original internal-OS audit (2026-06-06) predates a deeper security pass on 2026-06-07 that found **two CRITICAL, internet-facing exploits** in the data plane the internal OS governs. An internal operating system that can suspend stores and release payouts is only as trustworthy as the payments/identity layer under it, so these belong in this report.

| Finding (2026-06-07) | Why it threatens the internal OS | Status |
|---|---|---|
| **Forgeable payments** — `razorpay-adapter verify()` HMAC'd only `orderId\|paymentId`, never amount/capture; order-binding skipped when `order.payment_id` was null (every new order); no global unique on `provider_payment_id`. One ₹1 signature could confirm arbitrary orders cross-store **and self-activate any subscription plan (free Enterprise).** | Finance/Revenue analytics, payout ledger, and subscription state — all surfaced in the internal OS — would be reporting **fabricated truth**. | ✅ **Fixed in code:** fail-closed `payment_id` binding in all verify paths + live `fetchRazorpayPayment` capture/amount check (`payments.ts:547`) + migration 107 global unique on `(gateway, provider_payment_id)`. |
| **Anon-readable credential/session/token tables** — RLS policies named "Service role full access" on `customer_credentials`/`sessions`/`verification_tokens`/`users_custom`/`devices` used `USING(true)` **without** `TO service_role` → password hashes + session/reset tokens readable via the public anon key → account takeover. | Operator and merchant identities the internal OS authenticates against were exposed; audit attribution is meaningless if sessions are forgeable. | ✅ **Fixed in code:** migration 107 re-scopes those policies to `service_role`. |
| `AUTH_SECRET \|\| ''` empty-key fallback; rate limiter fail-closed (503-everything); mobile-bff committed placeholder secret. | Operability and auth integrity of the gateway the internal OS rides on. | ✅ **Fixed:** fail-closed signing key; rate limiter now KV-fallback / fail-open; placeholder removed + CI secret-hygiene gate. |
| **Still manual (operator-only) — NOT done:** `wrangler secret put` real secrets; **apply migration 107** in prod (dedupe duplicate `provider_payment_id` first); rotate creds if the anon key was ever exposed; the `.store → .com` DNS cutover. | The fixes are **code-complete but not deployed.** Until migration 107 is applied and secrets are set, the trust base is still theoretically exposed in any environment running the old schema. | ⚠️ **Pending human action.** |

**Implication for this report's verdict:** the internal-OS maturity score has moved to ~3.0/5 in code, but it still assumes the trust base is deployed. The fixes are real and in the working tree (verified: migration `107_security_rls_hardening_and_payment_uniqueness.sql` present; `fetchRazorpayPayment` binding live) — but **"safe to operate" is contingent on the operator deploy checklist being executed.** Do not let governance-validator green obscure that.

---

## Phase 13 — Gap analysis (P0–P3)

Priority key: **P0** = critical missing / safety exposure · **P1** = high · **P2** = important · **P3** = future. "Complexity" assumes building as modules in the existing two apps (no topology change).

| # | Gap / status | Pri | Business impact | Operational impact | Complexity | Suggested owner |
|---|---|---|---|---|---|---|
| 1 | **Deploy the 2026-06-07 security fixes** (apply migration 107, set/rotate secrets) | **P0** | Fabricated revenue, account takeover, free Enterprise plans | Every internal metric/payout is untrustworthy until done | Low (ops checklist) | Platform Eng + Founder |
| 2 | **Risk Detection — shipped foundation; thresholds/vendor feeds pending** | **P0** | Fraud loss, chargeback exposure, fake stores | Rules engine exists; paid feeds and final risk policy pending | High | Risk + Payments |
| 3 | **Trust & Safety case management — shipped foundation; legal workflow pending** | **P0** | Legal/regulatory liability; arbitrary or un-appealable action | Cases/appeals/takedowns exist; final policy/legal activation pending | High | Trust & Safety + Legal |
| 4 | **Scope RBAC + SoD + reason capture — shipped foundation; SSO/SCIM pending** | **P0** | Over-privileged operators; one session = platform blast radius | Scope enforcement, break-glass, and access reviews exist; identity lifecycle still manual | Medium | Platform Admin / Security |
| 5 | **Support ticketing — shipped foundation; inbox/chat and SLA sign-off pending** | **P1** | Slow resolution, churn, no support memory | Tickets/SLA/CSAT/macros exist; external channels pending | Medium | Support + Merchant Success |
| 6 | **Merchant 360 — shipped foundation; finance plan/credit actions pending** | **P1** | Slow ops, fragmented context, no impersonation | Aggregate and audited actions exist; unapproved billing mutations hidden | Low–Medium | Merchant Ops |
| 7 | **App/Theme automated checks + reviewer console — shipped foundation; paid scans pending** | **P1** | Malicious apps/bad themes reach merchants; conversion loss | Deterministic checks and reviewer UI exist; security vendor pending | Medium | App/Theme Review |
| 8 | **Incident command UI + on-call + paging — shipped dry-run foundation; live provider pending** | **P1** | Slow MTTR on SEV-1/2; no one gets paged | Interactive UI, on-call, postmortems, dry-run paging exist | Low–Medium | Platform Eng / SRE |
| 9 | **Exec data layer — shipped foundation; finance sign-off/warehouse pending** | **P1** | Leadership flies blind; board numbers unreliable | Versioned rollups exist; external BI and metric sign-off pending | Low–Medium | Finance + Founder |
| 10 | **GDPR data-subject-request console + retention policy + audit export — shipped dry-run foundation; SIEM/EU activation pending** | **P2** | Compliance/regulatory risk | Operator workflow exists; external WORM sink and legal activation pending | Medium | Compliance + Platform Eng |
| 11 | **Developer-360 operator view + payout reconciliation — shipped foundation; live transfers/KYC pending** | **P2** | Partner friction, payout disputes | Operator view and reconciliation exist; live payout rail and KYC policy pending | Low–Medium | Developer Relations + Finance |
| 12 | **Post-publish app/theme monitoring** (auto-open cases on abuse/regression) | **P2** | Bad actors after approval; perf regressions on live stores | Initial abuse handoff exists; deeper continuous monitoring remains future | Medium | Risk + Review |
| 13 | **SSO + SCIM + access-review operating cadence** | **P3** (P1 at 50+ staff) | Insider risk, audit findings | Manual joiner-mover-leaver; access reviews recorded but cadence not automated | Medium | Security / IT |
| 14 | **Promote dedicated consoles (Stage B) + activate operator-mobile (Stage C)** | **P3** | Blast-radius isolation, on-call mobility | Only worth it at ~10k merchants | High (governed migration) | Platform Eng |

---

## Phase 14 — Implementation roadmap (by merchant scale)

LetBuyy's constitution requires new app roots to go through a governance doc + validator + CI + ownership decision. So the build path is **staged**, not a fleet drop: **Stage A** = modules in the two existing apps + new `/v1/operations/*` route groups (zero topology change, passes `validate-governance.mjs` as-is); **Stage B** = dedicated consoles via governed runtime migration (~10k); **Stage C** = activate the reserved `apps/mobile/operator-app`.

### Phase 1 — 0–100 merchants (now): *make the real plane visible + close the safety gaps*
- **Apps/features:** deploy the security fixes (Gap #1); wire the existing `/v1/operations/*` (incidents, SRE, security, certification) into interactive console UI; stand up **Risk (rules-based) + T&S case management** (Gaps #2, #3); add reason-capture + PII-read auditing (part of #4).
- **Infra:** `risk_*` + `ts_*` tables; `/v1/operations/risk/*` and `/trust-safety/*` route groups; nightly jobs in `queue-workers`.
- **Team:** founders + first ops/support hire; founder is the reviewer and incident commander.
- **KPIs:** 100% of irreversible actions have a logged reason + appeal path; 0 unaudited suspensions; security checklist closed; fraud loss rate baseline established.

### Phase 2 — 100–1,000 merchants: *the daily workhorses*
- **Apps/features:** Support ticketing + SLA + CSAT (#5); Merchant 360 + audited actions (#6); App/Theme reviewer console + first automated checks (#7); interactive incident command + on-call rota + paging (#8); MRR/ARR/churn + activation funnel (#9).
- **Infra:** ticketing tables, review-check-runs, `oncall_schedules`, rollup tables.
- **Team:** first dedicated Support, Merchant Success, and a reviewer; on-call rotation.
- **KPIs:** first-response/resolution SLA + CSAT; time-to-review; MTTR on SEV-1/2; MRR/ARR/churn trustworthy; risk review-queue precision.

### Phase 3 — 1,000–10,000 merchants: *specialization + automation*
- **Apps/features:** mature access reviews into a quarterly recertification operating rhythm; ML risk scoring + graph/link analysis; tiered T&S reviewer pool + policy/legal workflow hardening; full automated theme/app security-vendor suite + post-publish monitoring (#12); live SIEM/WORM audit export (#10); production payout transfer activation; cohort retention + external warehouse.
- **Infra:** consider promoting **Risk** and **Reviews** to dedicated consoles (**Stage B**, governed migration); external data warehouse.
- **Team:** specialized Risk, T&S, Review, Finance-ops teams; review lead, risk lead, T&S lead.
- **KPIs:** chargeback/loss rate; appeal overturn rate (false-positive proxy); reviewer throughput; error-budget adherence; access-review completion.

### Phase 4 — 10,000+ merchants: *follow-the-sun, regional, resilient*
- **Apps/features:** real-time edge risk scoring; automated T&S triage + human review pool + regional legal workflows; continuous app/theme re-validation; multi-region incident command; Sigma-style self-serve BI; SSO/SCIM (#13).
- **Infra:** dedicated operator consoles (full governed fleet) + activate **operator-mobile (Stage C)**; possibly activate the reserved `analytics-pipeline`/`search-service`/`notification-service`.
- **Team:** 24×7 follow-the-sun ops; regional ownership; incident commanders on rotation.
- **KPIs:** regional SLA; automated-triage precision/recall; uptime/error-budget by region; cost-to-serve per merchant.

> **Headline:** LetBuyy can run to **~10,000 merchants inside the two existing apps** if the human-judgment modules are built. Separate consoles are a >10k optimization, not a prerequisite.

---

## Phase 15 — World-class benchmark scorecard

| Internal function | LetBuyy | Best-in-class | LB /5 | Decisive gap |
|---|---|---|---|---|
| Merchant Operations | Merchant 360 aggregate + audited actions | **Shopify** (1 search → 360 + audited actions + impersonation) | 3.0 | Production impersonation policy and finance-approved credit/plan actions |
| Support | Tickets + SLA + macros + CSAT + context | **Stripe/Intercom** (SLA, macros, inline context, CSAT, AI deflect) | 2.5 | External omnichannel ingest, AI policy, and final SLA contracts |
| Risk | Rules engine + explainable scoring + review queue | **Stripe Radar** (0–99 ML score, rules, route-to-review, explainable) | 2.5 | Paid reputation/device feeds, production threshold sign-off, later ML |
| Trust & Safety | Cases + evidence + appeals + takedowns + SoD | **Shopify T&S / marketplace norms** (cases, SoD appeals, forever-audit, stated SLA) | 2.5 | Final legal policy wording, regulator workflow, severe-violation contacts |
| App Review | Reviewer console + automated app checks | **Shopify App Review** (auto-checks gate, <500ms, pentest, protected data, compliance webhooks) | 3.0 | Paid security scan vendor and final public rubric |
| Theme Review | Theme QA runner + reviewer console | **Shopify Theme Store** (Lighthouse perf ≥60 / a11y ≥90, manual+auto, 44×44, critical path) | 2.5 | Paid scan vendor and deeper manual QA program |
| Developer Ops | Developer 360 + payout reconciliation + disputes | **Stripe Connect / Shopify Partners** (payouts + reconciliation + enforcement + analytics) | 3.0 | Live payout-transfer credentials and KYC policy |
| Incident Response | Interactive command UI + on-call + postmortems | **Cloudflare/SRE** (sev taxonomy, commander, audited mitigations, blameless SEV-1/2 PM) | 3.5 | Live paging provider and public status process |
| Exec Analytics | MRR/ARR/churn/cohort/funnel rollups | **Stripe Sigma / Notion** (trustworthy, drill-able, versioned metric defs) | 3.0 | Finance sign-off, warehouse/BI, leadership PII allowlist |
| Governance / RBAC | Scope-enforced + SoD + break-glass + read audit + access-review recording | **Atlassian/enterprise** (fine-grained, SoD, SSO/SCIM, access reviews) | 3.4 | SSO/SCIM and production recertification cadence |
| Audit & Compliance | Data-subject console + retention view + dry-run export | **SOC2/GDPR norms** (DSR workflow, retention policy, tamper-evident audit export) | 3.0 | SIEM/WORM vendor and EU legal activation |
| SRE / Ops control plane | Real (47 endpoints) | **Cloudflare** | 3.5 | UI surfacing + paging |

**Where LetBuyy is now ahead of where platforms usually start:** an incident data model with severity + commander + audited mitigations + error budgets; a marketplace review **state machine plus reviewer console and deterministic checks**; an **80/20 partner payout ledger on India-first rails plus reconciliation**; immutable audit + operator MFA + scope-enforced RBAC; and a governance model that already forbids ungoverned god-mode admin panels. **Where it remains constrained:** production migration apply, live secrets/vendors, legal policy sign-off, and production payout/paging/audit-export activation are still human-owned.

---

## Phase 16 — Brutal review: if Shopify's internal-ops team reviewed LetBuyy today

*Asked to be accurate, not polite.*

**What they would praise.**
- The **incident/SRE control plane** is real and rare for this stage — severity taxonomy, commander, audited mitigations, error budgets, certification, interactive command actions, on-call, and postmortems. Most startups have a Slack channel and a doc; LetBuyy has a working data model and UI.
- The **governance instinct**: refusing ungoverned `apps/admin` god-panels, splitting console (privileged) from ops-portal (execution), immutable audit, operator MFA. This prevents the single most common startup ops disaster.
- The **human-judgment foundation now exists in code**: scope-enforced RBAC, Risk scoring, T&S cases and appeals, Merchant 360, Support ticketing, reviewer consoles, executive rollups, Developer 360, and Compliance workflows are modules inside the two governed apps instead of new runtime aliases.
- The **partner economy** (80/20 ledger, UPI/RazorpayX), marketplace review state machine, deterministic app/theme checks, and payout reconciliation are further along than most pre-scale marketplaces.

**What they would reject.**
- **Calling human-gated integrations production-complete.** Protected migrations `107` and `113`-`135`, production secrets, live payout transfer credentials, paging provider keys, SIEM/WORM credentials, and legal/policy approvals are still human-owned gates. The code is ready; production authority is not.
- **Treating dry-run sinks as final controls.** Audit export, paging, CSAT dispatch, and payout release have honest dry-run/provider-pending paths. They should not be described as live external controls until the vendors and credentials are approved.
- **Calling RBAC enterprise-complete before SSO/SCIM and access-review operations mature.** Scope enforcement, SoD, reason capture, read audit, and break-glass are real; identity lifecycle automation and periodic recertification still need production operating discipline.

**What they would immediately rebuild.**
- The **production activation path**: apply the protected migrations, rotate/provision secrets, and prove the 06-07 trust-base repair in staging and production before relying on revenue, payouts, or audit data operationally.
- The **remaining RBAC operating model**: SSO/SCIM, quarterly recertification cadence, and clear owner review for break-glass use.
- The **external channel/vendor layer**: SIEM/WORM export, PagerDuty/Opsgenie, RazorpayX/Route live transfers, support inbox/chat ingest, paid security scans, and policy-approved notification copy.

**What they would consider dangerous.**
- The **2026-06-07 exploits** (forgeable payments, anon-readable credential/session tables). Even fixed-in-code, the fact that they existed in a payments platform, and that the fixes are **not yet deployed** (migration 107 unapplied in prod, secrets unset), is the most dangerous fact in the repo. An internal OS that reports revenue and releases payouts on top of a forgeable payment layer is reporting fiction with authority.
- **Governance theater as a truth substitute.** The validator set is stronger than it was, but the repository still carries heavy audit/documentation residue. The danger is cultural: a team that ships green checks can convince itself it is production-ready when some checks only prove files exist. **Passing != working.**
- **Audit logs that are "immutable" only by convention** until the external WORM/SIEM sink is live. The dry-run export path is a good adapter; it is not yet tamper-evident production storage.

**Operational risks that could kill LetBuyy as it scales.**
1. **Production migration/secret lag** — account takeover or payment forgery in production because the 06-07 fixes and new internal-OS schema shipped in code but never reached prod.
2. **Policy thresholds without sign-off** — Risk/T&S/SLA/appeal/KYC/retention defaults work, but legal, finance, support, and risk owners must approve the production values and public-facing language.
3. **Live provider gaps** — payout transfer, paging, SIEM/WORM export, support ingest, and paid security scans stay dry-run or provider-pending until credentials and vendors are approved.
4. **Identity lifecycle gaps at 50+ employees** — scope RBAC is real, but SSO/SCIM, access-review cadence, and break-glass recertification become mandatory as headcount grows.
5. **Decision paralysis from document bloat** — the team can still lose track of what is built versus planned if status files are allowed to substitute for production evidence.

---

## The one-paragraph brief for leadership

LetBuyy now has an **end-to-end-real foundation** for the internal operating system's human-judgment layer: scope-enforced RBAC, Risk Detection, Trust & Safety, Merchant 360, Support, App/Theme Review, Executive Analytics, Incident Command, Developer 360, and Compliance are implemented as governed modules inside `platform-console` and `platform-operations-portal`, backed by gateway routes, shared contracts, workers, migrations, audit rows, and tests. The overall maturity has moved from roughly **2.0/5 to ~3.0/5** on shipped code, not new topology. It is not production-complete until humans apply protected migrations `107` and `113`-`135`, rotate/provision secrets, approve Risk/T&S/SLA/KYC/retention policies, and activate live payout, paging, security-scan, support-ingest, and SIEM/WORM vendors. With those deploy and policy gates closed, the two-app internal OS can safely carry LetBuyy toward **~10,000 merchants**; SSO/SCIM, live vendor integrations, and recertified access reviews become mandatory before the team scales beyond early operator headcount.

---

## Appendix A — Phase-to-section map

| Mission phase | Where answered |
|---|---|
| 1 · Internal system discovery | Phase 1 + capability matrix |
| 2 · Internal persona map | Phase 2 |
| 3 · Merchant operations audit | §3 |
| 4 · Support operations audit | §4 |
| 5 · Risk platform audit | §5 |
| 6 · Trust & safety audit | §6 |
| 7 · Theme review audit | §7 |
| 8 · App review audit | §8 |
| 9 · Developer operations audit | §9 |
| 10 · Incident response audit | §10 |
| 11 · Audit & compliance audit | §11 + Security overlay |
| 12 · Permission & RBAC audit | Phase 12 (10/50/100 verdict) |
| 13 · Gap analysis (P0–P3) | Phase 13 |
| 14 · Implementation roadmap | Phase 14 |
| 15 · World-class benchmark | Phase 15 |
| 16 · Brutal review | Phase 16 |

## Appendix B — Companion documents (detailed per-platform references)

The nine platform audits in [`internal-operating-system-audit/`](internal-operating-system-audit/) remain the source of detail (purpose, users, workflows, permissions, dashboards, alerts, automations, audit logging, escalation, current→target schemas, benchmark, scaling) for each domain. The master design doc is [`LETBUYY_INTERNAL_OPERATING_SYSTEM.md`](LETBUYY_INTERNAL_OPERATING_SYSTEM.md). Security context: `PRODUCTION_READINESS_DEEP_AUDIT_2026-06-07.md`, `SECURITY_FIXES_APPLIED_2026-06-07.md`, and `PRODUCTION_READINESS_MASTER_PLAN_2026-06-07.md` (repo root).

## Appendix C — Verification notes

Claims in the original audit were re-checked against the working tree on 2026-06-08: `grep` against `database/supabase/migrations/000_baseline.sql` confirmed the pre-foundation absence of risk/fraud/chargeback, support-ticket, and T&S case tables, plus the presence of `production_incidents`, `marketplace_review_records`, and the `employees`/`employee_roles`/`employee_permissions`/`employee_invites` set. This foundation run then added migrations `113` and `124`-`135`, route groups, queue workers, UI modules, and tests for the human-judgment layer. Migration `107_security_rls_hardening_and_payment_uniqueness.sql` is present and the payment-binding fix (`fetchRazorpayPayment`) is live in source. The "still-manual" deployment items are unverifiable from source (they are operator actions in prod) and are flagged as pending.

## Appendix D — Benchmark sources

- Shopify App Store — [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) · [Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review) · [2026 requirements checklist](https://www.codersy.com/blog/shopify-api-development-best-practices/shopify-app-store-guidelines-key-requirements) · [Protected customer data rules](https://kahunam.com/articles/shopify/shopifys-new-protected-customer-data-rules-what-app-developers-need-to-change/)
- Shopify Theme Store — [Theme store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements) · [Accessibility requirements](https://www.shopify.com/partners/blog/theme-store-accessibility-requirements) · [What it takes to build a quality theme](https://www.shopify.com/partners/blog/theme-review-process) · [Common theme rejections](https://shopify.dev/docs/storefronts/themes/store/review-process/common-theme-rejections)
- Stripe Radar — [Radar overview](https://docs.stripe.com/radar) · [Risk evaluations](https://docs.stripe.com/radar/risk-evaluation) · [Fraud prevention rules](https://docs.stripe.com/radar/rules) · [Fraud scores explained](https://stripe.com/resources/more/fraud-scores-explained)
- Incident management — [Cloudflare Customer Incident Management Policy](https://developers.cloudflare.com/support/customer-incident-management-policy/) · [Google SRE incident management](https://sre.google/resources/practices-and-processes/incident-management-guide/) · [Incident management best practices 2026](https://incident.io/blog/incident-management-best-practices-2026)
- Trust & Safety / appeals — [Unit21 — account suspension & appeals](https://www.unit21.ai/trust-safety-dictionary/account-suspension) · [Persona — marketplace account suspension](https://withpersona.com/identity-glossary/marketplace-account-suspension) · [Walmart Marketplace — Trust & Safety policy](https://marketplacelearn.walmart.com/guides/Policies%20&%20standards/Performance/Trust-and-safety-policy)

---

*End of master report. This document is the entry point; the nine companion audits hold the per-platform build detail. Re-run the verification greps in Appendix C after any schema or route change, and update the scorecard when a judgment platform ships.*
