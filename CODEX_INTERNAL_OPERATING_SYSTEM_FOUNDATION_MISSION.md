# CODEX MISSION — LetBuyy Internal Operating System Foundation (single-pass, full-vertical, scope-locked)

> Paste everything below into Codex as **one task**. It is self-contained, scope-fenced for safe parallel execution, and instructs Codex to implement — in a **single pass** — every Internal-OS-owned issue end-to-end (UI → gateway → DB → workers), and to **SKIP + log** (never silently drop) anything outside its ownership or needing human approval, then keep going.
>
> This is the **foundation phase**. The goal is to make the internal operating system *fundamentally strong*: every operator surface wired end-to-end to real, governed, audited backend contracts — not placeholders.

---

## 0) ROLE & PRIME DIRECTIVE

You are a senior platform engineer building **LetBuyy's Internal Operating System** to a billion-dollar-platform standard. You own the full vertical for the internal/operator domain: the two operator web apps, their gateway route groups, their database tables, and their async workers.

**Definition of success:** an operator can log into the Platform Console or Operations Portal and run the business end-to-end — find any merchant, work a support ticket, triage a risk signal, decide a Trust & Safety case, review an app or theme, manage a developer/payout, command an incident, and read real leadership metrics — with **every action authorized (RBAC), audited (immutable), and backed by a real gateway contract**, never a `SkipBackendPanel` placeholder.

**Operate in a single pass.** Walk the entire issue ledger (§9, ~132 issues). For each: implement it (if owned) or **SKIP-and-log** it (if it needs another owner or human approval), then continue. **Never block. Never silently skip.** Prefer correctness, coherence, audit, and trust over new features. Keep the build, type-checker, lint, and governance validation green at every commit.

**Ground truth — read before writing code (these are the source of truth for *what* and *why*):**

- `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM.md` (master: verdict, topology, current→target, scaling, roadmap)
- `docs/internal-operating-system-audit/MERCHANT_OPERATIONS_CONSOLE.md`
- `docs/internal-operating-system-audit/SUPPORT_OPERATIONS_PLATFORM.md`
- `docs/internal-operating-system-audit/RISK_DETECTION_PLATFORM.md`
- `docs/internal-operating-system-audit/TRUST_AND_SAFETY_PLATFORM.md`
- `docs/internal-operating-system-audit/APP_REVIEW_PLATFORM.md`
- `docs/internal-operating-system-audit/THEME_REVIEW_PLATFORM.md`
- `docs/internal-operating-system-audit/DEVELOPER_OPERATIONS_PLATFORM.md`
- `docs/internal-operating-system-audit/INCIDENT_RESPONSE_PLATFORM.md`
- `docs/internal-operating-system-audit/EXECUTIVE_ANALYTICS_PLATFORM.md`

**Also read and obey:** root `AGENTS.md`; `apps/platform-console/AGENTS.md`, `apps/platform-operations-portal/AGENTS.md`, and `services/api-gateway/AGENTS.md`; the runtime manifests of those three roots; and `docs/governance/{platform-operations-governance,actor-governance,observability-governance,security-operations-governance,incident-response-governance,operational-dashboard-governance,repository-topology,topology-purification,runtime-boundaries,migration-governance,domain-governance}.md`.

---

## 1) OPERATING CONTRACT (the laws — obey always)

1. **Single pass, all issues.** Walk §9 IDs end-to-end. Implement or SKIP-and-log each; never stop at the first blocker.
2. **Governance is law.** Do not break `node scripts/validate-governance.mjs`. After any routing/schema/topology change, regenerate intelligence with `node scripts/generate-repository-intelligence.mjs` **as the final step** (see §1.12 for the parallel-safe rule).
3. **No new app roots.** The Internal OS is built as **modules inside `apps/platform-console` and `apps/platform-operations-portal`** plus **new route groups inside the existing gateway routers**. Do **not** create `apps/internal`, `apps/admin`, `apps/risk`, `apps/support`, or any new `apps/*`/`services/*` root. Those require human-approved topology governance → see §8 (Stage B = SKIPPED).
4. **Tenant isolation & audit are non-negotiable.** Every operator read/write resolves through RBAC; every merchant/PII/payment access and every mutation writes an immutable audit record (`audit_logs` / `execution_audit_trail`). Sensitive actions require **reason capture**; irreversible actions require **dual-control**.
5. **Honesty over fakery.** Never ship a placebo. If a capability can't be real in this pass, render an explicit, dated **`Beta`/`Planned`** state and log it — never a fake "working" control. Replace `SkipBackendPanel` only with **real data** or an honest Beta state.
6. **Schemas first.** All inbound gateway payloads use **Zod** schemas in `services/api-gateway/src/schemas/*.schema.ts`. Mirror the existing `operations.schema.ts` / `internal-console.ts` patterns. Use `AppError`/`ValidationError` + `formatAppError`; never leak raw DB errors.
7. **Reuse shared contracts.** Use `@letbuyy/shared-types`, `@letbuyy/api-client`, `@letbuyy/ui`, `@letbuyy/auth-core`. Do **not** hand-roll app-local `Product`/`Order`/`Customer`/`Payment`/`Theme` DTOs. You may **import** packages; you may **not edit** `packages/**` (SKIP + handoff if a package change is needed).
8. **Money is INR/paise, server-side.** Reuse `formatMoneyFromPaise`; never trust client totals; payouts/refunds recompute server-side and require idempotency.
9. **Migrations are additive & banded.** New tables go in **migrations `090`–`099` only** (next free after `089`). Sequential, unique, reversible; never edit `000_baseline.sql`. Every new table gets `id`, `created_at`, `updated_at`, `deleted_at`, audit columns, indexes, and **RLS policies** (per `AGENTS.md`). T&S/Risk enforcement records are retention-exempt (soft-delete only, never purged).
10. **Keep gates green.** After changes: `pnpm -w typecheck`, `pnpm -w lint`, the affected app/service `test`, and `node scripts/validate-governance.mjs` must pass.
11. **Small, labeled commits per wave** (`WS-1`, `WS-2`, …) so the parallel task rebases cleanly.
12. **Parallel-safe coordination.** A second Codex task runs in parallel on the merchant/shopper/partner vertical (§2). Avoid the three collision hot-spots: **(a) `services/api-gateway/src/index.ts`** — do **not** edit it; mount every new internal route group as a **sub-router inside the already-mounted `/operations` and `/internal/console` routers** instead. **(b) migrations** — stay inside band `090–099`. **(c) `AGENTS.md` regeneration** — regenerate only at the very end and note it in the handoff so the parallel task reconciles last.
13. **No secrets in repo.** Server secrets live in Cloudflare/Vercel/CI secret stores. Dev auth bypasses (`PLATFORM_CONSOLE_DEV_MFA_CODE`, etc.) must fail closed in production.

---

## 2) OWNERSHIP & PARALLELISM CONTRACT (read first, obey always)

### ✅ YOU OWN (write freely)

**Apps (operator surfaces):**
- `apps/platform-console/**` — super-admin console (all modules, nav, lib, components).
- `apps/platform-operations-portal/**` — employee operations portal (all modules, nav, lib, components).

**Gateway (internal-ops domain only):**
- `services/api-gateway/src/routes/operations.ts` — extend; mount new sub-routers here.
- `services/api-gateway/src/routes/internal-console.ts` — extend; mount new sub-routers here.
- `services/api-gateway/src/routes/employee.ts` — extend.
- **New** route modules under `services/api-gateway/src/routes/operations/` and `.../internal-console/` (e.g. `risk.ts`, `trust-safety.ts`, `support.ts`, `internal-analytics.ts`, `internal-finance.ts`, `oncall.ts`, `review-checks.ts`) mounted as sub-routers from the two files above.
- **New** schemas: `services/api-gateway/src/schemas/{risk,trust-safety,support,internal-analytics,internal-finance,review-checks,oncall}.schema.ts`.
- **New** domain libs: `services/api-gateway/src/lib/{risk,trust-safety,support,...}-*.ts` (column maps, mappers) following `marketplace-review-records.ts`.
- `services/api-gateway/src/middleware/rbac.ts` — **extend additively only** (add new role categories/permission scopes; do not change existing exports' signatures).

**Workers (internal-ops async jobs only):**
- **New** consumer files under `services/queue-workers/src/**` for internal-ops jobs (risk scoring, metric rollups, review-check runs, SLA clocks). Register them following existing consumer patterns. If a new queue binding in `wrangler.toml` is required → that is infra → **SKIP:HUMAN-APPROVAL** + handoff.

**Database (band 090–099):**
- `database/supabase/migrations/090_*.sql` … `099_*.sql` (+ matching RLS, seeds under `database/supabase/seeds/`, verification under `database/supabase/verification/`).

**Docs/ledgers:**
- The 10 docs above (read-only reference; do not rewrite).
- **New** `CODEX_INTERNAL_OPERATING_SYSTEM_FOUNDATION_LEDGER.md` (repo root) — the 132-row status ledger (§4).
- **New** `HANDOFF_PARALLEL_AND_HUMAN.md` (repo root) — cross-boundary + human-approval register (§7, §8).

### ⛔ FORBIDDEN (do NOT modify — SKIP + hand off if needed)

- **Other apps:** `apps/storefront-runtime/**`, `apps/merchant-control-plane/**`, `apps/identity-platform/**`, `apps/marketing-site/**`, `apps/app-marketplace/**`, `apps/developer-portal/**`, `apps/theme-marketplace/**`, `apps/mobile/**`. (You may read them for reference and you may **link** to them via env-configured URLs, never imports.)
- **`services/api-gateway/src/index.ts`** — shared route-mount file. Do **not** edit; mount via sub-routers (§1.12). The only exception, if a top-level mount is truly unavoidable, is **SKIP:PARALLEL** + handoff so it's done in one coordinated change.
- **Other gateway route groups** (storefront, products, orders, payments, themes, app-store, customers, etc.) — owned by the parallel task.
- **`packages/**`** (incl. `@letbuyy/ui`, `@letbuyy/shared-types`, `@letbuyy/auth-core`) — import only, never edit. Package change needed → **SKIP:PACKAGES** + handoff.
- **`database/supabase/migrations/000_baseline.sql`** and any migration number **outside `090–099`**.
- **`infrastructure/**`, `config/**`, `legacy/**`, `.github/**`**, root build config, runtime manifests/topology, `docs/governance/**` (governance memory).
- **Never recreate** deprecated aliases: `apps/{admin,auth,checkout,internal,merchant,storefront,analytics}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`.

### 🔗 PARALLEL TASK B CHARTER (paste as the sibling task's scope fence)

> *Task B owns the **merchant/shopper/partner vertical**: `apps/{storefront-runtime,merchant-control-plane,identity-platform,marketing-site,app-marketplace,developer-portal,theme-marketplace}/**`, `apps/mobile/**`, all gateway route groups **except** `operations*`, `internal-console*`, `employee*`, and **migrations `110+`**. Task B must NOT touch `apps/platform-console`, `apps/platform-operations-portal`, the `operations/internal-console/employee` gateway routes, migrations `090–099`, or regenerate `AGENTS.md` until Task A signals done in `HANDOFF_PARALLEL_AND_HUMAN.md`. Shared file `services/api-gateway/src/index.ts`: Task B adds only its own top-level mounts; coordinate via the handoff file.*

Run `git diff --name-only` before finishing and confirm **every** path is inside the ✅ allowlist.

---

## 3) ARCHITECTURE INVARIANTS (never violate)

- **App → gateway → DB.** Operator apps call the gateway through `@letbuyy/api-client` (`fetchConsoleApi` in console; `createPlatformOperationsApiClient` in ops-portal). No app-local DB clients, no business logic in pages.
- **Console auth:** magic-link + MFA/TOTP; server calls carry `PLATFORM_CONSOLE_API_TOKEN`. **Ops-portal auth:** employee session + invite (`/v1/employees/auth/*`). Never weaken these.
- **Gateway guard pattern (mirror exactly):** internal routers use `requireRoleCategory(<cat>)` (+ `requireSuperAdmin` where privileged) from `src/middleware/rbac.ts`, or the `PLATFORM_CONSOLE_API_TOKEN` bearer middleware (as in `internal-console.ts`). `actorId(c) = c.get('auth').user.id`.
- **Every mutation:** Zod-validate → authorize (RBAC) → require reason for sensitive ops → execute (idempotent) → **write audit** → return sanitized response.
- **API versioning:** worker surfaces use `/v1`; new internal endpoints live under `/v1/operations/*` and `/v1/internal/console/*`.
- **Observability:** every request carries `X-Request-ID`; logs structured + redacted; never log secrets/PII/tokens. Dashboards must show **unavailable/empty** on missing data — never fake green (per `operational-dashboard-governance.md`).
- **Actor model (`actor-governance.md`):** operators use console + ops-portal only; console = privileged governance, ops-portal = employee execution with narrower scopes + stronger per-action audit. Do not collapse them.

---

## 4) LEDGER & STATUS (create and maintain)

Create `CODEX_INTERNAL_OPERATING_SYSTEM_FOUNDATION_LEDGER.md` at repo root, pre-filled with **all** §9 rows. Update continuously.

```
| ID | Platform | Title | Status | Layers done (DB/API/UI/Worker/Test) | Owner | Notes / approval gate / handoff |
```

`Status` ∈ `DONE` · `PARTIAL (shell+handoff)` · `SKIPPED:PACKAGES` · `SKIPPED:PARALLEL` · `SKIPPED:HUMAN-APPROVAL` · `SKIPPED:INFRA` · `N/A`.

- `SKIPPED:HUMAN-APPROVAL` → also add to the **Human Register** in `HANDOFF_PARALLEL_AND_HUMAN.md` with the exact decision needed; ship a clearly-labeled placeholder/Beta and continue.
- `SKIPPED:PACKAGES` / `SKIPPED:PARALLEL` / `SKIPPED:INFRA` → also add to the **Cross-Boundary Register** with the precise contract/owner.
- `PARTIAL` → built the real layer(s) you own (e.g., DB+API+UI) and logged the one you can't (e.g., a queue binding) — never a fake control.

---

## 5) THE WORK — Waves WS0 → WS10 (do in order; each maps to §9 issue IDs)

> Per-item tag: **[DO]** implement end-to-end now · **[SHELL]** real UI shell + honest Beta + handoff the missing layer · **[SKIP→X]** log + continue.

### WS-0 — Boundary, baseline & foundation (do first) — `INF-01…INF-06`
- **[DO]** Read §0 docs + governance. Create the ledger (§4) pre-filled with all §9 rows and `HANDOFF_PARALLEL_AND_HUMAN.md`. Record baseline green: `pnpm -w typecheck && pnpm -w lint && node scripts/validate-governance.mjs`.
- **[DO]** Establish the **shared internal-ops kit** you'll reuse everywhere (no behavior change yet):
  - Extend `src/middleware/rbac.ts` (additively) with internal role categories/permission scopes: `risk`, `trust-safety`, `support`, `reviewer`, `finance`, `devrel`, plus tiers `viewer/operator/lead/admin` mapped onto `employee_roles`/`employees.role`.
  - Add a reusable **audit helper** in the gateway (`src/lib/internal-audit.ts`) that writes `audit_logs` (+`execution_audit_trail` for privileged) with actor, action, resource, old/new, reason, ip, request-id. Every owned mutation calls it.
  - Add a reusable **reason-capture + dual-control** guard utility.
- **Acceptance:** baseline recorded; rbac + audit helpers exist and are unit-tested; nothing else changed.

### WS-1 — Surface the real Operations/Incident plane (highest ROI; data already exists) — `INC-01…INC-12`, `INF-07`
- **[DO]** Make `apps/platform-console/(dashboard)/operations` **interactive**, not read-only cards. Wire the *existing* endpoints: `GET /v1/operations/runtime/overview`, `GET/POST /runtime/incidents`, `PATCH /runtime/incidents/:id/status`, `runtime/control-commands`, queue recover/redrive, replays/authorize, error-budgets, certification-reports.
- **[DO]** Build an **Incident Command** module: open incident (sev1–4, affected runtimes/regions, customer impact, commander), timeline (`production_incident_events`), mitigation actions via `control-commands` (RBAC lead + dual-control + audit), status transitions, postmortem-link close-gate for sev1/sev2 (per `incident-response-governance.md`).
- **[DO]** Reliability panels: error budgets (burn/freeze), SLO status, firing alerts, DLQ depth, deployment gates, event-store integrity, certification score — all from live projections; **unavailable** states on missing data.
- **[SHELL]** On-call schedule + paging: build the schedule UI; **[SKIP→INFRA]** paging integration (PagerDuty/Opsgenie account) + **[DO]** add `oncall_schedules` table (migration) so the schedule persists. Postmortem tracker → `incident_postmortems` table **[DO]**.
- **Acceptance:** an operator can open, command, and close an incident end-to-end with audit; reliability panels render live; on-call persists (paging handed off).

### WS-2 — Merchant Operations Console (Merchant 360) — `MOPS-01…MOPS-12`
- **[DO]** New gateway aggregate `GET /v1/internal/console/merchants/:id/overview` (joins `sites` + `subscriptions` + orders count + installs + active theme + open tickets + risk score) — sub-router in `internal-console.ts`. RBAC + audit on PII view.
- **[DO]** New console module `(dashboard)/merchants/[id]/page.tsx` — Merchant 360: identity, plan, lifetime+30d revenue, health, risk badge, installed apps, active theme, open tickets, recent audit. Add unified multi-key search to `(dashboard)/stores`. Add nav link.
- **[DO]** Audited operator actions: impersonate (read-only, time-boxed, reason), adjust plan/credit (lead), suspend/restore (lead + dual-control). **[SHELL]** impersonation token mint if it needs `@letbuyy/auth-core` change → **[SKIP→PACKAGES]** the token primitive, ship the UI + audited request.
- **Acceptance:** one search → Merchant 360 → audited action; no fragmented context.

### WS-3 — Risk Detection Platform (greenfield, rules-first) — `RISK-01…RISK-16`
- **[DO]** Migrations: `risk_signals`, `risk_scores`, `risk_rules`, `velocity_counters`, `chargeback_events`, `risk_action_events` (RLS, audit cols, indexes).
- **[DO]** Gateway `/v1/operations/risk/*` sub-router: ingest signals, compute score (0–100, banded low/med/high), list/queue, entity detail (score breakdown + linked accounts), rule CRUD (lead, sandbox→activate dual-control), manual action (lead + reason). **Explainability mandatory**: every score/action stores the contributing signals/rule.
- **[DO]** Worker job `queue-workers` risk-scoring consumer (velocity windows + payment/identity rules) writing `risk_scores`. If a new queue binding is needed → **[SKIP→INFRA]** binding, run inline/cron-style where possible.
- **[DO]** Console **Risk** module (overview + entity detail) and ops-portal **Risk review queue** (medium-band triage → confirm/dismiss → escalate to T&S). Add nav links.
- **[DO]** Auto-restrict (soft) on high band → opens a linked T&S case (WS-4) + audit.
- **Acceptance:** signup/publish/first-payment/app-submit produce a score; high-risk auto-restricts + opens a T&S case; analysts triage the queue; every action explainable + audited.

### WS-4 — Trust & Safety Platform (case lifecycle, forever-audit) — `TS-01…TS-16`
- **[DO]** Migrations: `ts_cases`, `ts_case_events`, `ts_appeals`, `ts_takedowns`, `ts_evidence` (retention-exempt; soft-delete only; RLS; audit).
- **[DO]** Gateway `/v1/operations/trust-safety/*`: open case (from Risk/report/proactive/legal), attach evidence, tiered review, decision, enforce (suspend/takedown/disable — lead + reason + audit), notify subject + appeal path, appeal lifecycle with **segregation of duty** (appeal reviewer ≠ enforcing reviewer), reinstate (lead + dual-control). Implements detect→review→suspend→appeal→reinstate.
- **[DO]** Turn console `(dashboard)/trust-safety` from read-only into the **case console** (queue + case detail + decision history + appeal thread); put **enforcement actions** in the ops-portal. Replace the `marketplace-governance` placeholders' "appeals/takedowns/emergency disable" stubs with real audited flows.
- **[DO]** Forever-audit: every step → `audit_logs` + `ts_case_events`; enforcement records never purged.
- **[SKIP→HUMAN-APPROVAL]** policy text/category definitions, legal-notice handling SLAs, and any auto-suspend threshold that changes platform posture → ship configurable placeholders, log decisions.
- **Acceptance:** a case runs detect→reinstate with SoD on appeals; nothing irreversible without logged reason + appeal path.

### WS-5 — App Review + Theme Review (finish the existing queue) — `APPR-01…APPR-12`, `THMR-01…THMR-12`
- **[DO]** Build the **reviewer console** in ops-portal on top of existing `GET /v1/operations/marketplace-reviews` + `POST /marketplace-reviews/:id/decision` + `marketplace_review_records` (states pending→in_review→changes_requested→approved/rejected). Enforce RBAC (reviewer/lead) + reason on decisions. App review detail: manifest, requested scopes, webhooks, OAuth config, billing model, data-collection declaration, decision history.
- **[DO]** Migration `review_check_runs` (+ `review_appeals`); gateway `/v1/operations/review-checks/*`.
- **[DO]** **Automated checks** populating `automated_checks`: (apps) scope-minimization, webhook-signature config, OAuth/PKCE correctness, redirect-URI allowlist, data-collection-vs-scope, secret handling, rate-limit posture; (themes) performance budget, WCAG 2.1 AA a11y, security scan, theme-engine compatibility (sections/blocks against contracts), code-quality/bundle size. Run as `queue-workers` jobs writing `review_check_runs`; hard-fail blocks; soft-fail flags.
- **[DO]** Post-publish monitoring → opens Risk/T&S case on abuse/regression. Theme detail = live preview + code inspector + QA report + version diff.
- **[SKIP→PARALLEL]** any change to developer-facing submission UI (`app-marketplace`/`theme-marketplace`) → handoff to Task B.
- **Acceptance:** reviewers work a real queue; automated checks populate per submission; decisions audited; post-publish monitoring wired.

### WS-6 — Developer Operations (Developer 360 + payout ops) — `DEVO-01…DEVO-12`
- **[DO]** Gateway aggregate `GET /v1/internal/console/developers/:id/overview` (developer + apps + installs + payouts + open cases) over `app_developers`, `app_installations`, `partner_payout_ledger_entries`, review records.
- **[DO]** Console/ops-portal **Developer 360** module: verify/approve developer (operator), key/secret issuance & revocation (lead + audit; never log secrets), payout review→release (finance lead + dual-control over `partner_payout_ledger_entries`, 80/20 split already encoded), suspend developer (cascade apps + freeze payouts).
- **[DO]** Payout reconciliation view (charges vs subscriptions vs payouts) + dispute workflow; webhook health from `webhook_subscriptions`/`/operations/webhook-deliveries`.
- **[SKIP→PARALLEL]** developer-portal/app-marketplace partner-facing UI; **[SKIP→HUMAN-APPROVAL]** final commission %/payout-rail go-live.
- **Acceptance:** Developer 360 shows apps→revenue→installs→violations; payouts reviewable + releasable with dual-control + audit.

### WS-7 — Support Operations (turn the stub real) — `SUP-01…SUP-14`
- **[DO]** Migrations: `support_tickets`, `ticket_messages`, `ticket_macros`, `ticket_sla_clocks` (RLS, audit).
- **[DO]** Gateway `/v1/operations/support/*` full CRUD + threads + assignment + macros + SLA clocks; replace the `/v1/employees/tickets` stub (which currently returns "not configured") with real persistence.
- **[DO]** Ops-portal **agent workspace**: queue + SLA timers + ticket thread with **Merchant 360 inline** (reuse WS-2 aggregate) + macros; team board (open/pending/solved, SLA at-risk, first-response/resolution, CSAT); auto-triage/routing; auto-create linked Risk/T&S case on keyword/category; post-resolution CSAT.
- **[DO]** Reuse `@letbuyy/notification-core` contracts for replies/email (import only). Internal notes vs customer-visible replies distinguishable + retained.
- **Acceptance:** an agent resolves a ticket with inline merchant context, SLA tracked, escalation creates linked cases; `probeTicketInfrastructure` now reports available.

### WS-8 — Executive Analytics (real metrics, not counters) — `EXEC-01…EXEC-12`
- **[DO]** Migrations: `metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps`.
- **[DO]** `queue-workers` nightly rollup jobs computing MRR/ARR (net-new/expansion/contraction/churn) from `subscriptions` + `app_billing_charges`, activation funnel (signup→store→publish→first-order→paying), cohort retention, theme/app/subscription revenue split, payout liability.
- **[DO]** Gateway `/v1/internal/console/analytics/{mrr,funnels,cohorts}` aggregates; upgrade console `dashboard`/`revenue`/`analytics` pages beyond 30-day counters; drill-through metric→cohort→Merchant 360. Never green on stale rollups.
- **[DO]** Metric **definitions are versioned + audited** (reproducible board numbers).
- **[SKIP→INFRA]** external warehouse / Sigma-style self-serve (post-10k) → log; rollups land now.
- **Acceptance:** leadership home shows MRR/ARR/churn with trend + funnel; numbers reconcile to the ledger; drill-through works.

### WS-9 — Cross-cutting hardening (RBAC · audit · MFA · observability) — `INF-08…INF-14`
- **[DO]** Enforce the operator gate everywhere (per `platform-operations-governance.md`): email allowlist · MFA/TOTP · RBAC scopes · audit on reads+writes · reason capture · sanitized errors/redacted logs. Add a shared client helper so every new module page declares its required permission scope.
- **[DO]** Audit coverage check: a gateway test asserting every owned mutation route writes an audit record.
- **[DO]** Observability: every owned endpoint carries `X-Request-ID`; structured redacted logs; dashboards render unavailable/empty (not fake) on missing data.
- **[DO]** Permission tiers (viewer/operator/lead/admin) wired to `employee_roles`; document the matrix in each app's `AGENTS.md` section (regen via the generator, not hand-edit of generated blocks).
- **Acceptance:** no owned route mutates without RBAC + audit; no dashboard shows green on missing data.

### WS-10 — Tests, governance & finalization — `INF` closeout
- **[DO]** Unit/integration tests per new route group (Zod validation, RBAC denial, audit write, idempotency). App tests for new modules render + empty/error states (light + dark, skeleton, retry — per frontend governance).
- **[DO]** Seeds + verification SQL for new tables under `database/supabase/{seeds,verification}`.
- **[DO]** Run `pnpm -w typecheck && pnpm -w lint && <affected> test && node scripts/validate-governance.mjs`; fix to green. **Last:** `node scripts/generate-repository-intelligence.mjs` to refresh `AGENTS.md` (coordinate per §1.12).
- **[DO]** Complete the ledger (every §9 ID terminal) + both registers. Write the PR description (counts DONE/PARTIAL/SKIPPED-by-category, green-gate evidence, migration list `090–099`, new endpoints, `git diff --name-only` confirming allowlist-only).

---

## 6) DATA & API BUILD PLAN (reference)

**New migrations (band 090–099, one concern each):**

| # | Migration | Tables |
|---|---|---|
| 090 | `090_risk_detection.sql` | `risk_signals`, `risk_scores`, `risk_rules`, `velocity_counters`, `chargeback_events`, `risk_action_events` |
| 091 | `091_trust_safety_cases.sql` | `ts_cases`, `ts_case_events`, `ts_appeals`, `ts_takedowns`, `ts_evidence` |
| 092 | `092_support_ticketing.sql` | `support_tickets`, `ticket_messages`, `ticket_macros`, `ticket_sla_clocks` |
| 093 | `093_review_checks.sql` | `review_check_runs`, `review_appeals` |
| 094 | `094_exec_analytics_rollups.sql` | `metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps` |
| 095 | `095_incident_oncall.sql` | `oncall_schedules`, `incident_postmortems` |
| 096 | `096_internal_case_audit.sql` | `case_audit_events` (cross-links Risk/T&S/review to audit) |
| 097–099 | reserved | follow-on internal-ops needs |

**New gateway route groups (sub-routers; no `index.ts` edit):**

| Mount | File | Guard |
|---|---|---|
| `/v1/operations/risk/*` | `routes/operations/risk.ts` | `requireRoleCategory('risk')` |
| `/v1/operations/trust-safety/*` | `routes/operations/trust-safety.ts` | `requireRoleCategory('trust-safety')` |
| `/v1/operations/support/*` | `routes/operations/support.ts` | `requireRoleCategory('support')` |
| `/v1/operations/review-checks/*` | `routes/operations/review-checks.ts` | `requireRoleCategory('reviewer')` |
| `/v1/operations/oncall/*` | `routes/operations/oncall.ts` | `requireRoleCategory('ops')` |
| `/v1/internal/console/merchants/:id/overview` | `routes/internal-console/merchants.ts` | console token |
| `/v1/internal/console/developers/:id/overview` | `routes/internal-console/developers.ts` | console token |
| `/v1/internal/console/analytics/{mrr,funnels,cohorts}` | `routes/internal-console/analytics.ts` | console token |

---

## 7) CROSS-BOUNDARY REGISTER (hand off to Task B / packages — do NOT build here)

Maintain in `HANDOFF_PARALLEL_AND_HUMAN.md`. Seed entries:
- **Packages:** any `@letbuyy/auth-core` change for time-boxed impersonation tokens; any `@letbuyy/ui` primitive the operator modules need (build with existing `@letbuyy/ui` + local components meanwhile). → `SKIPPED:PACKAGES`.
- **Parallel (Task B):** developer/theme/app submission UIs; merchant-facing surfaces; any top-level `services/api-gateway/src/index.ts` mount that can't be a sub-router. → `SKIPPED:PARALLEL`.
- **Infra:** new queue bindings in `wrangler.toml`; PagerDuty/Opsgenie paging; external warehouse. → `SKIPPED:INFRA`.

## 8) HUMAN REGISTER — decisions only a human makes (SKIP + placeholder + continue)

Ship a clearly-labeled placeholder/Beta for each and log it; do not block.
- **Stage B topology** — promoting any internal module to a dedicated app root (`risk.`/`reviews.`/`trust.`) → requires governance-doc + validator + CI + ownership change. `SKIPPED:HUMAN-APPROVAL`.
- **Stage C** — activating `apps/mobile/operator-app` (reserved). `SKIPPED:HUMAN-APPROVAL`.
- **Production cutover** — real secrets, live certification (execute-mode evidence), live payment keys, DNS/allowlist/VPN production controls. `SKIPPED:HUMAN-APPROVAL`.
- **Policy & money** — T&S policy text + auto-suspend thresholds, final commission %/payout rails go-live, legal ToS/privacy copy, data-deletion/redaction posture. `SKIPPED:HUMAN-APPROVAL`.
- **Irreversible data** — any hard delete or production data migration with loss potential. `SKIPPED:HUMAN-APPROVAL`.

---

## 9) ISSUE LEDGER (the work queue — ~132 issues; flip each to a terminal status)

> Type: **DO** end-to-end · **SHELL** UI+handoff · **GATE** ships behind a SKIP register entry. Seed below; Codex completes the status table in the ledger file.

### Foundation / cross-cutting (INF)
- INF-01 DO — Read docs+governance; create ledger + registers; record green baseline.
- INF-02 DO — Extend `rbac.ts` with internal role categories + viewer/operator/lead/admin tiers.
- INF-03 DO — Shared `internal-audit.ts` audit-write helper (actor/action/resource/old-new/reason/ip/request-id).
- INF-04 DO — Reusable reason-capture + dual-control guard.
- INF-05 DO — Shared console permission-scope client helper (each module declares required scope).
- INF-06 DO — Standardize unavailable/empty/error/loading states across owned modules (light+dark, retry).
- INF-07 DO — Replace remaining `SkipBackendPanel` in owned scope with real data or honest Beta.
- INF-08 DO — Email allowlist + MFA/TOTP enforcement audit across both apps.
- INF-09 DO — Audit-coverage test: every owned mutation writes an audit record.
- INF-10 DO — `X-Request-ID` + structured redacted logging on every owned endpoint.
- INF-11 DO — Permission-tier matrix wired to `employee_roles`; documented per app.
- INF-12 DO — Seeds + verification SQL for all new tables.
- INF-13 DO — Per-route-group tests (Zod, RBAC denial, audit, idempotency).
- INF-14 DO — Final gates green + regenerate `AGENTS.md`; complete ledger + registers + PR description.

### Merchant Operations (MOPS)
- MOPS-01 DO — `/internal/console/merchants/:id/overview` aggregate.
- MOPS-02 DO — Merchant 360 page `(dashboard)/merchants/[id]`.
- MOPS-03 DO — Unified multi-key search (id/email/phone/domain/name) on stores.
- MOPS-04 DO — Cross-links: orders/subs/apps/theme/tickets/risk from Merchant 360.
- MOPS-05 DO — Health score nightly rollup + at-risk tagging.
- MOPS-06 DO — Fleet health (by site_type/plan/cohort/churn band).
- MOPS-07 DO — Impersonate (read-only, time-boxed, reason, audit) [token primitive may SHELL→PACKAGES].
- MOPS-08 DO — Adjust plan/credit (lead + audit).
- MOPS-09 DO — Suspend/restore store (lead + dual-control + audit).
- MOPS-10 DO — Merchant Success board in ops-portal (assignment, last-touch, renewal).
- MOPS-11 DO — Alerts: unexpected suspension, revenue drop, churn threshold, domain-verify fail.
- MOPS-12 DO — Nav links + RBAC scopes for the module.

### Support (SUP)
- SUP-01 DO — Migration `support_tickets`/`ticket_messages`/`ticket_macros`/`ticket_sla_clocks`.
- SUP-02 DO — `/v1/operations/support/*` CRUD + threads.
- SUP-03 DO — Replace `/employees/tickets` stub with real persistence; `probeTicketInfrastructure` → available.
- SUP-04 DO — Agent workspace (queue + thread + Merchant 360 inline).
- SUP-05 DO — SLA clocks (pause on pending-customer) + breach alerts.
- SUP-06 DO — Macros / canned replies.
- SUP-07 DO — Auto-triage + topic/plan routing.
- SUP-08 DO — Escalation matrix (billing→finance, abuse→Risk/T&S auto-case, bug→Incident).
- SUP-09 DO — CSAT survey post-resolution + team board metrics.
- SUP-10 DO — Internal notes vs customer-visible replies (distinct + retained).
- SUP-11 DO — Reuse `notification-core` for replies/email.
- SUP-12 DO — VIP/high-value ticket alerting.
- SUP-13 DO — Reopen-rate + negative-CSAT cluster alerts.
- SUP-14 DO — RBAC + audit (PII view reason capture) + nav.

### Risk (RISK)
- RISK-01 DO — Migration risk tables (signals/scores/rules/velocity/chargeback/action-events).
- RISK-02 DO — Signal ingest endpoint + sources (audit/payment/tenant).
- RISK-03 DO — Scoring (0–100 banded) with stored explainability.
- RISK-04 DO — Velocity counters (sliding windows).
- RISK-05 DO — Rule CRUD (sandbox→activate, dual-control).
- RISK-06 DO — Risk review queue (ops-portal) confirm/dismiss/escalate.
- RISK-07 DO — Entity risk detail (breakdown + linked accounts/graph seed).
- RISK-08 DO — Worker scoring consumer on signup/publish/first-payment/app-submit [binding may SKIP→INFRA].
- RISK-09 DO — Auto-restrict (soft) on high band + open linked T&S case.
- RISK-10 DO — Chargeback tracking + rate alerts.
- RISK-11 DO — Console Risk overview dashboard.
- RISK-12 DO — Rule performance (precision/FP rate) view.
- RISK-13 DO — Manual block (lead + reason + audit, pre-T&S).
- RISK-14 DO — Risk badge feed into App/Theme review + Merchant 360.
- RISK-15 GATE — Auto-action thresholds that change posture → SKIP:HUMAN.
- RISK-16 DO — RBAC + audit + nav.

### Trust & Safety (TS)
- TS-01 DO — Migration case tables (cases/events/appeals/takedowns/evidence; retention-exempt).
- TS-02 DO — `/v1/operations/trust-safety/*` case lifecycle.
- TS-03 DO — Open case from Risk/report/proactive/legal + evidence attach.
- TS-04 DO — Tiered review (analyst recommend → lead enforce).
- TS-05 DO — Enforce: suspend/takedown/disable (lead + reason + audit).
- TS-06 DO — Subject notification + appeal path (notification-core).
- TS-07 DO — Appeal lifecycle with segregation of duty (appeal reviewer ≠ enforcer).
- TS-08 DO — Reinstate (lead + dual-control).
- TS-09 DO — Console T&S case console (queue + detail + history + appeal thread).
- TS-10 DO — Ops-portal enforcement actions surface.
- TS-11 DO — Replace marketplace-governance appeals/takedown/emergency-disable stubs with real flows.
- TS-12 DO — Forever-audit; enforcement records never purged.
- TS-13 DO — Enforcement board (active suspensions/takedowns/overturn rate).
- TS-14 DO — High-severity + appeal-SLA + repeat-offender alerts.
- TS-15 GATE — Policy text/category defs + legal SLAs → SKIP:HUMAN.
- TS-16 DO — RBAC + audit + nav.

### App Review (APPR)
- APPR-01 DO — Reviewer console (ops-portal) over existing queue/decision endpoints.
- APPR-02 DO — Enforce RBAC (reviewer/lead) + reason on decisions.
- APPR-03 DO — App review detail (manifest/scopes/webhooks/OAuth/billing/data-collection/history).
- APPR-04 DO — Migration `review_check_runs`/`review_appeals` + `/operations/review-checks/*`.
- APPR-05 DO — Automated checks: scope-min, webhook-sig, OAuth/PKCE, redirect allowlist.
- APPR-06 DO — Automated checks: data-collection-vs-scope, secret handling, rate-limit posture.
- APPR-07 DO — Worker check-runner; hard-fail blocks, soft-fail flags.
- APPR-08 DO — Post-publish monitoring → auto Risk/T&S case.
- APPR-09 DO — Appeal workflow for rejected apps.
- APPR-10 DO — Ecosystem health (approval rate/time-to-review/post-publish incidents).
- APPR-11 SHELL — Developer-facing submission tweaks → SKIP:PARALLEL handoff.
- APPR-12 DO — Emergency unpublish (lead/admin + dual-control + audit).

### Theme Review (THMR)
- THMR-01 DO — Theme-specific reviewer view on shared queue (submission_type=theme).
- THMR-02 DO — Theme detail: live preview + code inspector + version diff.
- THMR-03 DO — QA: performance budget (LCP/CLS/TBT).
- THMR-04 DO — QA: WCAG 2.1 AA accessibility.
- THMR-05 DO — QA: security scan (unsafe scripts/exfil/injection).
- THMR-06 DO — QA: theme-engine compatibility (sections/blocks vs contracts).
- THMR-07 DO — QA: code quality / bundle size / unused CSS.
- THMR-08 DO — Worker theme-QA runner → `review_check_runs`; hard-fail blocks release.
- THMR-09 DO — Tie decisions to `theme_releases`.
- THMR-10 DO — Post-publish real-store perf regression monitoring → alert.
- THMR-11 DO — Catalog quality dashboard (avg perf/a11y, regressions, flagged).
- THMR-12 SHELL — Theme submission UI changes → SKIP:PARALLEL handoff.

### Developer Operations (DEVO)
- DEVO-01 DO — `/internal/console/developers/:id/overview` aggregate.
- DEVO-02 DO — Developer 360 module (apps/installs/revenue/violations/review history).
- DEVO-03 DO — Verify/approve developer (operator).
- DEVO-04 DO — API key issue/revoke (lead + audit; never log secrets).
- DEVO-05 DO — OAuth client secret reset (lead + audit).
- DEVO-06 DO — Payout review→release (finance lead + dual-control) over payout ledger.
- DEVO-07 DO — Payout reconciliation (charges vs subs vs payouts).
- DEVO-08 DO — Payout dispute workflow.
- DEVO-09 DO — Suspend developer (cascade apps + freeze payouts).
- DEVO-10 DO — Webhook health view (subscriptions + deliveries).
- DEVO-11 SHELL — Partner-facing UI → SKIP:PARALLEL.
- DEVO-12 GATE — Commission %/payout-rail go-live → SKIP:HUMAN.

### Incident Response (INC)
- INC-01 DO — Interactive operations module (wire existing overview/incidents/control-commands).
- INC-02 DO — Open incident (sev1–4, affected runtimes/regions, customer impact, commander).
- INC-03 DO — Timeline (`production_incident_events`) + status transitions.
- INC-04 DO — Mitigations via control-commands (lead + dual-control + audit).
- INC-05 DO — Reliability panels (error budgets/SLO/alerts/DLQ/gates/integrity/certification), live.
- INC-06 DO — Migration `oncall_schedules` + schedule UI.
- INC-07 SHELL — Paging integration → SKIP:INFRA.
- INC-08 DO — Migration `incident_postmortems` + postmortem tracker.
- INC-09 DO — Close-gate: sev1/sev2 require postmortem link.
- INC-10 DO — Auto-open incident from alert correlation (de-dupe).
- INC-11 DO — Alert wiring per observability live-telemetry contract (unavailable on missing data).
- INC-12 DO — Internal status surface (public status → SKIP:HUMAN later).

### Executive Analytics (EXEC)
- EXEC-01 DO — Migration rollup tables (metric/mrr_arr/cohort/funnel).
- EXEC-02 DO — Nightly MRR/ARR rollup worker (net-new/expansion/contraction/churn).
- EXEC-03 DO — Activation funnel rollup (signup→store→publish→first-order→paying).
- EXEC-04 DO — Cohort retention rollup.
- EXEC-05 DO — Revenue split (subscription/app/theme) + payout liability.
- EXEC-06 DO — `/internal/console/analytics/{mrr,funnels,cohorts}` aggregates.
- EXEC-07 DO — Upgrade dashboard/revenue/analytics pages beyond counters.
- EXEC-08 DO — Drill-through metric→cohort→Merchant 360.
- EXEC-09 DO — Versioned + audited metric definitions.
- EXEC-10 DO — Stale-rollup detection (never fake green) + pipeline-failure alert.
- EXEC-11 DO — Scheduled leadership digest (daily/weekly).
- EXEC-12 GATE — External warehouse / self-serve BI → SKIP:INFRA (post-10k).

---

## 10) DEFINITION OF DONE (all must hold)

1. `pnpm -w typecheck` ✅ · `pnpm -w lint` ✅ · affected app/service `test` ✅ · `node scripts/validate-governance.mjs` ✅.
2. Every §9 ID has a **terminal** ledger row; both registers (cross-boundary + human) complete.
3. **End-to-end for every owned platform:** UI module → gateway route group (RBAC + Zod + audit + idempotency) → DB (migration `090–099` with RLS) → worker where specified → tests. No owned `SkipBackendPanel` left except honest, dated Beta states tied to a register entry.
4. **No owned mutation without RBAC + audit;** no dashboard green on missing data; sensitive actions capture reason; irreversible actions use dual-control.
5. **No edits outside §2 allowlist** (`git diff --name-only` proves it); no `apps/*`↔`apps/*`, no package edits, no `index.ts` edit, migrations only in `090–099`.
6. `AGENTS.md` regenerated **last** and committed; PR description includes DONE/PARTIAL/SKIPPED counts, green-gate evidence, migration + endpoint list, and the allowlist diff proof.

## 11) DELIVERABLES
- Scoped code changes (apps + gateway internal route groups + migrations + workers + tests).
- `CODEX_INTERNAL_OPERATING_SYSTEM_FOUNDATION_LEDGER.md` (132-row status table).
- `HANDOFF_PARALLEL_AND_HUMAN.md` (cross-boundary + human registers, with exact contracts/decisions).
- PR description per §10.6.

## 12) EXECUTION DISCIPLINE
Work WS-0 → WS-10 in order, committing per wave. If any step would force you outside §2 ownership or need human approval, **log it (ledger + register), ship an honest placeholder, and continue** — never block the pass. Optimize the whole internal operating system to be *fundamentally strong*, not any single feature.

— END OF CODEX MISSION —
