<!-- CODEX MISSION PROMPT. Paste this entire file to Codex as the task brief, or point Codex at this path. Single-go, autonomous, FULL-STACK execution. Scope: build LetBuyy's Internal Operating System — the human-judgment layer (Risk, Trust & Safety, fine-grained RBAC, Support, Merchant 360, Reviewer consoles, Executive analytics, Incident command, Developer 360, Compliance) on top of the existing control plane. Source of truth: docs/LETBUYY_INTERNAL_OPERATING_SYSTEM_MASTER_REPORT.md + the nine docs in docs/internal-operating-system-audit/. -->

# CODEX MISSION — LetBuyy Internal Operating System Foundation (single-go · full-stack · autonomous)

> **You are Codex.** Your job is to take LetBuyy's internal operating system from "a real machine half wearing the costume of a complete company" to a **fundamentally strong, end-to-end-real internal OS** — in a **single autonomous run**, across the **whole stack** (the two operator web apps, the gateway control plane, queue workers, shared packages, and the database). Build the **human-judgment layer** the audit proved is missing — Risk, Trust & Safety, fine-grained RBAC enforcement, Support, Merchant 360, Reviewer consoles, Executive analytics, Incident command UI, Developer 360, and Compliance — in **strict priority order**, commit as you go, keep the governance validators green, and **never stop for a human**: when a step needs a business decision, a secret/key, a legal sign-off, production infra, or a production migration apply, do every part you *can* do in code, then log it `SKIPPED (NEEDS-HUMAN)` with a precise unblock note and continue. **Read this entire file before writing any code.**

This is **the foundation step-up phase**. It is the phase that makes LetBuyy fundamentally strong. Depth and correctness beat breadth-of-the-moment. No theater, no fake data, no dead controls. The repo's dominant disease is **document/governance theater** (≈177 validators, ~8 of which do real analysis) — do **not** add to it. Ship working software and honest empty states, not more green checks over nothing.

---

## 0. Non-negotiables (read first)

1. **FULL-STACK OWNERSHIP, ONE OWNER, ONE LANE.** You own the entire internal-OS vertical and may create/modify/delete across:
   - `apps/platform-console/**` (super-admin / leadership modules) and `apps/platform-operations-portal/**` (employee execution modules) — **these two apps only** for internal UI.
   - `services/api-gateway/src/routes/operations.ts`, `services/api-gateway/src/routes/internal-console.ts`, `services/api-gateway/src/routes/employee.ts`, and **new** route groups under `/v1/operations/*` and `/v1/internal/console/*`, plus the internal-OS middleware (`middleware/rbac.ts`, `middleware/auth.ts`, `middleware/permission.ts`, `index.ts` wiring).
   - `services/queue-workers/**` (rollup jobs, theme/app automated-check runners, risk scoring jobs, audit-export sink).
   - `packages/**` — only the internal-OS-used contracts (`@letbuyy/shared-types`, `@letbuyy/api-client` internal/operations namespaces, `@letbuyy/ui` operator primitives, `@letbuyy/auth-core` RBAC helpers). **Additive, backwards-compatible only.**
   - `database/supabase/migrations/**` — **add new forward migrations only, starting at `113_*`** (never edit `000_baseline.sql` or any applied migration in place).
   - `docs/internal-operating-system-audit/**`, `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM_MASTER_REPORT.md`, and the mission ledger/status files you own (§6).
2. **NO NEW APP ROOTS. THIS IS LAW.** `apps/admin`, `apps/internal`, `apps/risk`, `apps/support`, `apps/trust` are **forbidden runtime aliases** (root `AGENTS.md`, `docs/governance/topology-purification.md`). Every internal team is a **module inside `platform-console` or `platform-operations-portal`**. Adding any new runtime root, package root, or service root is `SKIPPED (NEEDS-HUMAN)`. Do **not** activate the reserved `apps/mobile/operator-app` or any reserved service (`search-service`, `analytics-pipeline`, etc.) — design notes only.
3. **GOVERNANCE IS LAW.** Run `node scripts/validate-governance.mjs` (= `pnpm run validate:governance`) after every wave; **it must pass** (ignore only the pre-existing `node_modules` "stale artifact" line). Obey root `AGENTS.md`, each touched local `AGENTS.md`, and `docs/governance/`. Specifically honored throughout: single-writer table ownership, fail-closed internal routes, single-source helpers (INR/date/crypto/logger), route files ≤1500 lines, `site_id` tenancy (never add a `stores` table), `update_updated_at()` trigger only, and **real RLS** on every new table (service-role + owner/tenant predicate — match `076_app_extension_registry.sql`, **not** the blanket `USING(true)` legacy pattern that caused the 2026-06-07 credential leak).
4. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs a human/business/legal decision, a secret/key, production data, infra provisioning, or applying a migration to a real environment, mark it `SKIPPED (NEEDS-HUMAN)` in the ledger with an exact unblock note, implement every in-code part anyway, and continue. See §5 for the pre-identified skip catalog.
5. **TRUTH OVER THEATER — the prime directive.** Zero fake data, fake risk scores, fake cases, fake metrics, or copy that leaks internal state to operators-as-users. If a feature isn't ready, show an honest, generic empty/loading/error state — never a `SkipBackendPanel`-style internal narration in a shipped surface. Every dashboard number must be backed by a real query; every action button must do a real, audited thing or not exist. **Do not write a new validator whose only job is to assert a markdown/JSON file exists** — that is the exact anti-pattern this repo is drowning in.
6. **EXPLAINABILITY & AUDIT ARE NON-OPTIONAL.** Every risk auto-action, every T&S enforcement, every privileged operator action records *who, when, why, what evidence* to `audit_logs` (+ the domain event table) — immutably. No irreversible action without a logged reason and, where specified, an appeal path. Audit sensitive **reads** (PII views), not just writes.
7. **GREEN BEFORE DONE.** Every wave ends with `typecheck`, `lint`, `build`, and `test` passing for every workspace you touched plus `validate-governance.mjs` (§9). Migrations apply cleanly to a local Supabase and are reversible. Don't mark an issue `DONE` if anything you touched is red.
8. **EVIDENCE OR IT DIDN'T HAPPEN.** Every closed item gets a ledger row: files changed, how you verified it, validator/test result (§6).
9. **DECIDE THE DEFAULT, FLAG THE SIGN-OFF.** Where a policy number/threshold is needed (risk bands, SLA targets, appeal windows, retention periods), implement a documented sensible default from a single source of truth **now** and log the business/legal confirmation as `SKIPPED (NEEDS-HUMAN)` — never leave a control non-functional waiting on a decision.

---

## 1. Mission context — what you are building

LetBuyy's internal OS today is **two governed operator apps + one gateway control plane** (`/v1/operations/*`, 47 endpoints, ~25 projection tables) over Supabase Postgres (237 baseline tables, now at migration `112`). The **machine half** (incidents, SRE/error budgets, certification, the marketplace review state machine, the 80/20 partner payout ledger, immutable audit, operator MFA) is **real**. The **human-judgment half** is **greenfield or stubbed**: 0 risk/fraud/chargeback tables, 0 support-ticket tables, 0 T&S case/appeal/takedown tables; trust-safety and marketplace-governance pages are read-only/placeholder; analytics is 5 counters; RBAC is role-coarse (the `employee_permissions` jsonb is stored but **not enforced** at the route).

**The verdict you are fixing (from the master report): internal-OS maturity ~2.0/5.** ~70% of the *plumbing* already exists and is governance-approved. Your job is to **build the judgment workflows on top of it as modules in the two existing apps** — not to invent a platform. Most of the "missing" internal OS is un-built business logic + un-wired UI over a real control plane.

**Authoritative sources you MUST read before writing code (your issue source of truth):**
- `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM_MASTER_REPORT.md` — the consolidated verdict, capability matrix, persona map, RBAC-at-scale verdict, **P0–P3 gap table (Phase 13)**, **scale roadmap (Phase 14)**, benchmark scorecard, and brutal review. **Wave numbers in this mission map to that gap table.**
- `docs/internal-operating-system-audit/` — the nine per-platform docs (Merchant Ops, Support, Risk, Trust & Safety, App Review, Theme Review, Developer Ops, Incident Response, Executive Analytics). Each holds the proposed schema, workflows, permissions, dashboards, automations, audit rules, escalation, and benchmark for its domain. **Build toward these.**
- `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM.md` — the master design doc (surface map, ownership split, data foundation table).
- Security context: `SECURITY_FIXES_APPLIED_2026-06-07.md`, `PRODUCTION_READINESS_DEEP_AUDIT_2026-06-07.md`, `CODEX_FOUNDATION_STEPUP_STATUS.md` (the still-open `SKIPPED - NEEDS HUMAN` deploy catalog you must not duplicate).
- Root `AGENTS.md` + each touched workspace's `AGENTS.md` + `docs/governance/` (esp. `platform-operations-governance.md`, `topology-purification.md`, `incident-response-governance.md`, `observability-governance.md`, `actor-governance.md`).

---

## 2. The insight that makes this finishable in one run

**The control plane is real; the company layer is not.** The audit confirms the hard, get-them-wrong-and-rebuild primitives already exist (audit spine, RBAC tables, MFA, incident model, review state machine, payout ledger, `/v1/operations/*`). Three buckets:

- **Bucket A — wire / surface what exists (cheap, do where it unblocks judgment work):** the incident endpoints into an interactive command UI; the marketplace-review queue/decision endpoints into a reviewer console; the merchant directory into a Merchant 360; the analytics counters into real rollups.
- **Bucket B — build the missing judgment systems (the spine):** Risk (rules engine + scoring + velocity + chargebacks), Trust & Safety (cases/evidence/appeals/takedowns + SoD), Support (tickets/SLA/CSAT/macros), and **fine-grained RBAC enforcement** (wire `employee_permissions` into the guards + SoD + break-glass + reason capture).
- **Bucket C — operationalize trust:** explainability on every auto-action, forever-retention on enforcement records, audit-on-read for PII, GDPR data-subject console, audit export sink.

Always prefer wiring an existing capability over inventing one. When you add a gateway endpoint, add the matching `@letbuyy/api-client` method **and** the console/ops-portal module in the same wave so nothing is half-wired.

---

## 3. Ownership discipline & guardrails (do not break governance)

1. **One writer per table.** Each new table gets a single declared writer module (the route group or queue worker that owns it). Risk tables are written by `/v1/operations/risk/*` + the risk scoring worker; T&S tables by `/v1/operations/trust-safety/*`; support tables by `/v1/operations/support/*`; rollups by the analytics worker. Document ownership where the route-ownership validator expects it and run the validator.
2. **Migrations are forward-only, sequential, reversible, start at `113_*`.** Never edit `000_baseline.sql` or any prior migration. Every new table: `id` (uuid), `created_at`, `updated_at`, `deleted_at`, audit columns, FKs, indexes, an `update_updated_at()` trigger, and **real RLS** (`TO service_role` for the service predicate + an owner/tenant predicate where applicable). T&S enforcement tables are **retention-exempt** (soft-delete only, never hard-purged). Provide a paired down/reverse where the convention exists.
3. **Tenant isolation via `site_id`.** Tenant-scoped tables reference `public.sites`. Never add a `stores` table; never bypass `verifySiteOwnership` patterns for tenant data.
4. **Employee RBAC is the spine — enforce it server-side.** All new internal routes guard with `requireRoleCategory`/`requireSuperAdmin` (existing) **plus** the new fine-grained scope check from Wave 1. Never trust client-supplied role/permission. Reason capture and audit on every sensitive mutation.
5. **Shared-package changes are additive & backwards-compatible.** Add fields/methods to `@letbuyy/api-client`, `@letbuyy/shared-types`, `@letbuyy/ui`; never break existing signatures. A breaking change is `SKIPPED (NEEDS-HUMAN)` (cross-domain blast radius).
6. **Single-source helpers.** Reuse `@letbuyy/ui/formatting` (INR/date), gateway `lib/crypto.ts`, the structured logger, `@letbuyy/api-client` base-URL helpers, `notification-core` for operator/subject notifications, and the existing `audit_logs` writer. The validator fails on duplicated implementations.
7. **Ownership split must not collapse** (`platform-operations-governance.md`): the **console** owns governance + privileged administration (risk *detection* view, T&S case oversight, exec analytics, audit center); the **ops-portal** owns employee *execution* with narrower permissions + stronger per-action audit (risk *decisions*, T&S enforcement, support, reviewer queues). Put each surface on the correct side.
8. **Generated files.** Never hand-edit any `AGENTS.md` or generated topology/intelligence file; regenerate via `node scripts/generate-repository-intelligence.mjs` and commit only the diff (§9).

---

## 4. Execution model (single-go, wave-based, strict priority order)

Work top-to-bottom through **Waves 0→11**. Each wave: implement every item across all needed layers (db → package → gateway → api-client → console/ops-portal UI → queue-worker), run §9 gates, commit per item, update the ledger/status. **Do not reorder priorities and do not stop between waves.**

The order fuses the master report's **P0–P3 gap table** with the consolidated build roadmap (the "deploy security → Risk → T&S → Merchant 360 → Support → Reviewer → Exec analytics → fine-grained RBAC → on-call → Developer 360" sequence), with one deliberate change: **the RBAC enforcement spine (Wave 1) is pulled ahead of Risk/T&S** because every judgment action those systems perform (suspend, take down, refund, release payout) must run through scope checks + segregation-of-duty + reason capture + audit-on-read. Building the spine first means Risk and T&S are born safe instead of retrofitted.

| Wave | Workstream | Gap-table # / Priority | Phase(s) | Why here |
|---|---|---|---|---|
| **0** | Guardrails, truth-base verification, baseline green | #1 / **P0** | 11 + security overlay | Confirm the 06-07 fixes are code-present; nothing is trustworthy until verified |
| **1** | Fine-grained RBAC enforcement + SoD + reason capture + audit-on-read | #4 / **P0** | 12 | The safety spine every later action depends on |
| **2** | Risk Detection (rules-based) | #2 / **P0** | 5 | First machine line of defense for a payments marketplace |
| **3** | Trust & Safety case management | #3 / **P0** | 6 | The first bad merchant *will* arrive; need cases/appeals/takedowns before public launch |
| **4** | Merchant 360 | #6 / **P1** | 3 | The pane every other team links into; built before more modules calcify the seam |
| **5** | Support ticketing | #5 / **P1** | 4 | Highest-frequency tool; becomes the largest team |
| **6** | App + Theme reviewer console & automated checks | #7 / **P1** | 7 + 8 | Gate apps/themes before they reach merchants |
| **7** | Executive analytics (MRR/ARR/churn/cohorts) | #9 / **P1** | 11 | Leadership truth; highest value-to-cost |
| **8** | Incident command UI + on-call + paging | #8 / **P1** | 10 | Cheapest high-value win — backend already real |
| **9** | Developer 360 + payout reconciliation | #11 / **P2** | 9 | Operator view over the strong partner backend |
| **10** | Compliance: GDPR data-subject console + retention + audit export sink | #10 / **P2** | 11 | Turn the existing erasure webhooks into an operator workflow |
| **11** | Ops, docs, governance reconcile, final full validation + status rollup | — | all | Update the scorecard; prove green |

**Explicitly NOT in scope this run (design notes only, or `SKIPPED (NEEDS-HUMAN)`):** ML risk models (Wave 2 is **rules-based** by design — deterministic, explainable; ML is a >10k-merchant concern), dedicated `risk.`/`reviews.`/`trust.` consoles (Stage B, governed migration — only at ~10k), activating `apps/mobile/operator-app` (Stage C) or any reserved service, SSO/SCIM (P3), and the entire `.com` cutover + secret/migration **deploys** (owned by the still-open `CODEX_FOUNDATION_STEPUP` skip catalog — do not duplicate or re-run).

**Commit discipline:** one commit per item or tight group; message `feat(internal-os): <wave> <short>` / `fix(internal-os): …` / `feat(db): 1NN_<migration> <short>`. After route/page/export/topology changes, regenerate repository intelligence and commit only the regenerated diffs (§9) — never hand-edit them.

---

## 5. Skip protocol & the pre-identified human-approval catalog

When a step needs a human, log this and continue:

```
- <wave/item> <title> — SKIPPED (NEEDS-HUMAN)
  Reason: <business decision / secret / legal sign-off / infra / prod migration>
  Unblock: <exactly what a human must provide or decide>
  Done anyway: <every in-code part you implemented + how it degrades honestly>
```

**Pre-identified skips (implement everything except the human bit):**

| Area | Implement now | SKIP (needs human) |
|---|---|---|
| **Prod migration apply** | Write migrations `113+`; apply to **local** Supabase; verify reversible | Applying `113+` (and the still-pending `107`) to staging/prod (`supabase db push`) |
| **Risk thresholds** | Single-source the bands (default **Low 0–39 / Medium 40–74 / High 75–100**, ≥75 auto-restrict) from one constant; ship working rules | Final business sign-off of bands, auto-action thresholds, and loss tolerance |
| **T&S policy & appeal windows** | Build case/appeal lifecycle + an `ts_policies` source + default appeal window (**7 business days**) + severe-violation ineligibility | Final legal/policy wording, retention durations, regulator workflow specifics |
| **SLA / CSAT targets** | Build SLA clocks + CSAT survey with default targets (first-response 8h, resolution 3 business days) from one constant | Final SLA contract values per plan tier |
| **On-call paging** | Build `oncall_schedules` + a paging-adapter interface + a dry-run/log path | PagerDuty/Opsgenie account + API keys + go-live |
| **Audit export sink** | Build the export adapter interface + a local/dry-run sink | SIEM/WORM vendor selection + keys |
| **App/theme security scan** | Build the check-runner + in-house static/manifest + Lighthouse-style perf/a11y checks (theme) that gate the queue | Paid security-vendor selection & keys |
| **Impersonation** | Build read-only, time-boxed, reason-required, fully-audited impersonation **token issuance + UI** | Final policy sign-off on operator impersonation + consent model |
| **Exec PII drill-through** | Build the drill with reason capture + audit | Leadership allowlist membership decisions |
| **Branch/PR isolation** | Do all code on the current branch | Creating the isolated branch + PR if the worktree is dirty (mirror the `CODEX_FOUNDATION_STEPUP` pattern) |
| **GDPR EU controls** | Build export/erasure operator console wired to existing webhooks | EU legal sign-off + EU-only control activation |

Anything that would (a) break a shared package's existing API, (b) apply a migration to a real environment, (c) touch secrets, (d) add a runtime/app/service root, or (e) edit root `AGENTS.md` → **SKIPPED (NEEDS-HUMAN)**, with the in-code part done.

---

## 6. Ledger & status (you create and maintain at repo root)

- `CODEX_INTERNAL_OS_FOUNDATION_LEDGER.md` — one row per item:
  `| wave | item | layers (db/pkg/gw/api/ui/worker) | status (DONE/PARTIAL/SKIPPED) | files changed | verification (tests/validator) |`
- `CODEX_INTERNAL_OS_FOUNDATION_STATUS.md` — rollup after every wave: Mission Parameters (locked), Current Phase, counts by status, % DONE, open SKIPPED items with unblock notes, new tables/migrations added, and the exact gate commands last run + result. Mirror the structure of `CODEX_FOUNDATION_STEPUP_STATUS.md` (Mission Parameters / Current Phase / Gate State / SKIPPED - NEEDS HUMAN).

---

## 7. The waves in detail

Each wave lists: **Objective · Tables (migrations `113+`) · Gateway routes · API-client · UI (which app) · Workers/automation · Audit · Acceptance · Benchmark target · Skips.** Reuse existing tables/endpoints where named; only add what's listed. Every new table follows §3.2 (RLS, audit cols, `update_updated_at()` trigger, indexes).

### Wave 0 — Guardrails & truth-base verification (#1, P0)
- **Objective:** prove the foundation is sound before building on it; establish baseline green; create ledger/status.
- **Do:** verify in source that the 2026-06-07 fixes are present — migration `107_security_rls_hardening_and_payment_uniqueness.sql` exists; payment `payment_id` binding + `fetchRazorpayPayment` capture/amount check live in `payments.ts`; `AUTH_SECRET` fail-closed; rate limiter fail-open; no anon-`USING(true)` policies on credential/session/token tables. If any regressed, **re-fix in code** and log it. Add a real validator only if it does true AST/RLS analysis (not a markdown existence check).
- **Audit:** none (read-only verification).
- **Acceptance:** all gates green at baseline; ledger/status created; a short `Wave 0 truth-base verification` note in the status file enumerating what was confirmed in source vs what remains in the `CODEX_FOUNDATION_STEPUP` human-deploy catalog.
- **Skips:** applying `107`+ to staging/prod; rotating the anon key; setting secrets (all already owned by the stepup skip catalog — reference, don't duplicate).

### Wave 1 — Fine-grained RBAC enforcement + SoD + reason capture + audit-on-read (#4, P0) — THE SPINE
- **Objective:** turn role-coarse RBAC into scope-enforced RBAC with segregation-of-duty, break-glass, reason capture, and read auditing — the safety substrate for Waves 2–10.
- **Tables:** `break_glass_grants` (employee_id, scope, reason, granted_by, expires_at, used_at), `access_review_records` (reviewer_id, period, decisions jsonb, completed_at). Reuse `employees`, `employee_roles`, `employee_permissions`, `audit_logs`.
- **Gateway:** extend `middleware/rbac.ts` (or add `middleware/permission-scope.ts`) with `requirePermission(scope)` that reads the operator's effective `employee_permissions` scopes (DB-authoritative, never client metadata) and a `requireSegregation(actorRole, targetAction)` helper enforcing **appeal-reviewer ≠ enforcing-reviewer** and **dual-control** on suspensions/refunds/payout-release. Add `requireReason()` that fails closed when a sensitive mutation arrives without a reason string. Add a `logSensitiveRead()` helper. New `/v1/operations/rbac/*`: list/grant/expire break-glass; record/list access reviews.
- **Permission tiers (single source, `@letbuyy/shared-types`):** Viewer / Operator / Lead / Admin with explicit scope strings (e.g. `risk:view`, `risk:decide`, `ts:enforce`, `ts:appeal`, `support:reply`, `merchant:suspend`, `payout:release`, `exec:pii`). Map the 10 existing employee roles onto default scope sets.
- **UI:** `platform-console` → `employees` module gains scope assignment, break-glass grant/expiry, and an access-review screen; every sensitive action across the app uses a shared **reason-capture dialog**.
- **Audit:** every grant/elevation/scope-change + every sensitive read → `audit_logs` (`actor_type` employee/super_admin, reason in metadata).
- **Acceptance:** a `manager` without `payout:release` is denied at the route (test); break-glass auto-expires; an appeal cannot be decided by the enforcing reviewer (test); sensitive reads appear in audit. Wire `employee_permissions` into ≥3 existing operations routes as proof.
- **Benchmark:** Atlassian/enterprise — fine-grained scopes, SoD, time-boxed elevation, periodic recertification.
- **Skips:** SSO/SCIM (P3, design note); final tier→scope policy sign-off.

### Wave 2 — Risk Detection platform, rules-based (#2, P0)
- **Objective:** a deterministic, explainable risk engine that scores merchants/stores/payments/signups, banded routing, auto-restrict on High, and auto-opens a T&S case (Wave 3 dependency: emit an event/queue row T&S consumes).
- **Tables:** `risk_signals`, `risk_scores` (entity_type, entity_id, score 0–100, band, breakdown jsonb), `risk_rules` (name, predicate, weight, enabled, sandbox), `velocity_counters` (sliding windows), `chargeback_events`, `risk_action_events` (rule + signal evidence that triggered an auto/manual action — explainability is mandatory).
- **Gateway:** `/v1/operations/risk/*` — signals, scores, rules (CRUD + sandbox/activate with dual-control), review queue, decisions. Score on signup, store publish, first payment, app/theme submit (hook the existing flows; additive, non-blocking).
- **Rules (ship these working, deterministic):** signup/store-creation velocity per IP/device; disposable-email; shared payment-instrument/device with a banned account; failed-auth bursts; chargeback-rate breach; country/IP mismatch; VPN/TOR heuristic. Weights → score; bands Low/Medium/High (single-source constant). High → soft auto-restrict (limit payouts/publishing) + open T&S case. **No ML.**
- **API-client/UI:** `platform-console` → **Risk (detection)** module (overview: entities by band, new-High-today, loss/chargeback rate, top firing rules; entity-risk detail with score breakdown + linked accounts). `platform-operations-portal` → **Risk (decisions)** review queue (confirm/dismiss Medium; manual block Lead+reason).
- **Workers:** risk scoring + velocity recompute job in `services/queue-workers`.
- **Audit:** every score driver, rule activation, threshold change, auto/manual action → `risk_action_events` + `audit_logs` with human-readable reason.
- **Acceptance:** a synthetic velocity burst produces a High score with an explainable breakdown, auto-restricts, and opens a T&S case; rule false-positive rate visible; legitimate India-first patterns not nuked (test a benign case stays Low).
- **Benchmark:** Stripe Radar — 0–99 scoring, rules, route-midrange-to-review, explainable signals.
- **Skips:** ML model; final bands/thresholds business sign-off; any paid reputation/Lookup data source.

### Wave 3 — Trust & Safety case management (#3, P0)
- **Objective:** the detect → review → suspend → appeal → reinstate lifecycle as the system of record, with segregation-of-duty and forever-retention.
- **Tables:** `ts_cases` (subject_type/id, category, severity, status, assignee), `ts_case_events` (timeline), `ts_evidence`, `ts_appeals` (must record original vs appeal reviewer), `ts_takedowns`, `ts_policies` (versioned). T&S enforcement tables are **retention-exempt** (soft-delete only, never purged).
- **Gateway:** `/v1/operations/trust-safety/*` — audited **mutation** endpoints: open case, attach evidence, decide, suspend/takedown/disable, notify subject (+ appeal path), file/decide appeal (SoD enforced via Wave 1), reinstate (dual-control), emergency platform-wide disable (Admin + dual-control).
- **API-client/UI:** `platform-console` → **Trust & Safety** case oversight (replace the read-only placeholder with a real case queue + detail + enforcement board + overturn-rate). `platform-operations-portal` → enforcement actions (employee execution). Turn the `marketplace-governance` `SkipBackendPanel` into a real console.
- **Workers/automation:** auto-open case from Risk auto-action or user report; auto-attach Risk evidence + merchant context; appeal-window timers (default 7 business days) → auto-finalize; templated subject notifications via `notification-core`.
- **Audit — forever:** every detect/open/evidence/decision/enforce/notify/appeal/reinstate → immutable `ts_case_events` + `audit_logs` capturing who/when/why/what-evidence.
- **Acceptance:** a case can be opened, enforced with a logged reason, appealed, and re-reviewed by a *different* operator; reinstatement requires dual-control; enforcement records cannot be hard-deleted; subject receives an honest notification with an appeal link.
- **Benchmark:** Shopify/Stripe T&S + marketplace norms — case mgmt, evidence, SoD appeals, accessible appeal mechanism with stated SLA, immutable forever-audit, policy versioning.
- **Skips:** final policy/legal wording + retention durations; regulator/court-order workflow specifics; CSAM-adjacent escalation contacts.

### Wave 4 — Merchant 360 (#6, P1)
- **Objective:** one search → one merchant → full context + audited actions; kill the two-app context split.
- **Tables:** none required initially; add `impersonation_sessions` (operator_id, site_id, reason, expires_at, read_only=true, started/ended) for time-boxed audited impersonation.
- **Gateway:** `GET /v1/internal/console/merchants/:id/overview` aggregate (joins `sites` + subscription + order count + installed apps + active theme + open tickets + risk score + open T&S cases + recent audit events). Audited actions: impersonate (read-only/time-boxed/reason), adjust plan/credit (Lead), suspend/restore (Lead + dual-control).
- **API-client/UI:** `platform-console` → unified multi-key search (store id, email, phone, custom domain, merchant name) → `merchants/[id]/page.tsx` Merchant 360 with pivots to every linked domain.
- **Audit:** every 360 open by an operator → `audit_logs` (`merchant.view`); impersonation start/stop, plan changes, suspensions → immutable with reason.
- **Acceptance:** open one merchant, see store+plan+revenue+orders+apps+theme+tickets+risk+T&S on one page; impersonation issues a read-only time-boxed token and auto-expires; suspend requires dual-control + reason.
- **Benchmark:** Shopify internal merchant view.
- **Skips:** impersonation policy/consent sign-off (build the mechanism; flag the policy).

### Wave 5 — Support ticketing (#5, P1)
- **Objective:** turn the `/employees/tickets` stub into a real agent workspace with persistence, SLA, CSAT, macros, escalation.
- **Tables:** `support_tickets` (site_id, requester, subject, status, priority, assignee), `ticket_messages` (internal-note vs customer-visible flag), `ticket_macros`, `ticket_sla_clocks` (pause on "pending customer"), `ticket_csat`.
- **Gateway:** `/v1/operations/support/*` — full CRUD + threads + assign/merge/escalate + SLA + CSAT. Replace the "not configured" probe path with the real backend.
- **API-client/UI:** `platform-operations-portal` → agent workspace (my queue, SLA timers, thread + **Merchant 360 inline** from Wave 4, macros), team board, lead view. One-click escalate → Risk/T&S (auto-linked case) or Incident.
- **Workers/automation:** SLA clocks; auto-triage/routing by topic/plan; CSAT survey on resolve; auto-link Risk/T&S case on keyword/category match.
- **Audit:** ticket lifecycle + PII views + merchant actions from a ticket → `audit_logs` (`actor_type` employee); internal notes distinguishable from customer replies.
- **Acceptance:** create→assign→reply→escalate→resolve persists; SLA breach surfaces; CSAT recorded; PII view audited; "mentions fraud/chargeback" routes to Risk/T&S.
- **Benchmark:** Stripe/Intercom/Zendesk — SLA tiers, macros, inline context, CSAT, escalation.
- **Skips:** final SLA/CSAT targets per plan tier; AI draft-reply/deflection (design note).

### Wave 6 — App + Theme reviewer console & automated checks (#7, P1)
- **Objective:** finish the review system — reviewer UI + automated checks feeding the existing `marketplace_review_records.automated_checks`, + post-publish monitoring.
- **Tables:** `review_check_runs` (submission_id, check_type, result, detail jsonb). Reuse `marketplace_review_records`, `app_developers`, theme tables.
- **Gateway:** extend `/v1/operations/marketplace-reviews/*` — claim/assign, run checks, reviewer comments; keep the existing queue/decision endpoints (add RBAC + reason via Wave 1). Post-publish monitoring hook → auto-open Risk/T&S case on abuse/regression.
- **Automated checks (ship working):** **App** — scope minimization, webhook-signature config, OAuth/PKCE correctness, redirect-URI allowlist, data-collection vs requested scopes, secret handling, rate-limit posture (benchmark: Shopify's <500ms / Lighthouse-drop<10% / protected-data / compliance-webhook requirements). **Theme** — Lighthouse-style performance budget (target **perf ≥60**) + accessibility (**a11y ≥90**, ARIA/keyboard/focus/44×44 touch) + security scan + compatibility against the contract-governed theme-engine manifests + code-quality. Run async in `services/queue-workers`; hard-fail blocks the queue, soft-fail flags the reviewer.
- **API-client/UI:** `platform-operations-portal` → reviewer console (queue by status/age/type/risk; app detail = manifest/scopes/webhooks/OAuth/billing/data-collection/check results; theme detail = live preview + code inspector + QA report + version diff).
- **Audit:** submission, check runs, status transitions, decisions → `audit_logs` + `marketplace_review_records` history (reviewer + reason).
- **Acceptance:** a submitted app runs automated checks that populate `automated_checks`; a theme failing the perf/a11y floor is auto-flagged; a reviewer can claim→check→decide with reason; a published app spiking abuse auto-opens a case.
- **Benchmark:** Shopify App Review + Theme Store rubric.
- **Skips:** paid security-vendor scan; final published review rubric wording.

### Wave 7 — Executive analytics (#9, P1)
- **Objective:** replace 5 live counters with trustworthy, drill-able, versioned metrics.
- **Tables:** `metric_rollups`, `mrr_arr_rollups`, `cohort_snapshots`, `funnel_steps`. Reuse `subscriptions`, `app_billing_charges`, `partner_payout_ledger_entries`, `sites`, `orders`.
- **Gateway:** `/v1/internal/console/analytics/{mrr,cohorts,funnels}` aggregates over the rollups. Metric **definitions** are versioned/governed artifacts (changes audited so board numbers are reproducible).
- **API-client/UI:** `platform-console` → upgrade dashboard/revenue/analytics: MRR/ARR with trend, net-new/expansion/contraction/churned MRR, logo churn, activation funnel (signup→store→publish→first-order→paying), theme vs app vs subscription revenue, a single company-health row (support load + risk/T&S rate + incident count + error budget). Drill: metric → cohort → Merchant 360.
- **Workers:** nightly rollup jobs in `services/queue-workers`. **Never show green on stale data** (`operational-dashboard-governance.md`).
- **Audit:** exec dashboard access + PII drill-through + exports → `audit_logs` (`actor_type` super_admin); metric-definition changes versioned.
- **Acceptance:** MRR/ARR/churn computed from real billing data and reconcilable to the ledger; a stale rollup shows a staleness state, not a green number; PII drill is reason-captured + audited.
- **Benchmark:** Stripe Sigma / Notion — trustworthy, drill-able, versioned definitions.
- **Skips:** external data warehouse (10k+ concern, design note); leadership allowlist membership.

### Wave 8 — Incident command UI + on-call + paging (#8, P1)
- **Objective:** make the real incident control plane interactive; add on-call + paging + postmortem tracking.
- **Tables:** `oncall_schedules` (rotation, escalation tiers), `incident_postmortems` (incident_id, timeline, contributing factors, action items, status). Reuse `production_incidents`, `production_incident_events`, `runtime_control_commands`.
- **Gateway:** wire existing `/v1/operations/runtime/incidents` GET/POST/PATCH + control-commands into interactive use (mitigations require Lead + audit; replay/redrive/failover/rollback require dual-control). New `/v1/operations/oncall/*` and `/v1/operations/postmortems/*`. Add a paging-adapter interface (dry-run/log path now).
- **API-client/UI:** `platform-console` → **Incident Command** (active incidents by severity, commander, TTM/TTR timers, affected runtimes/regions, live mitigations) replacing the read-only cards; on-call schedule view; postmortem tracker with a **close-gate for SEV-1/2** (no close without a linked blameless postmortem).
- **Audit:** incident lifecycle + every mitigation command → `production_incident_events` + `execution_audit_trail` + `runtime_control_commands`.
- **Acceptance:** open→assign commander→mitigate→resolve interactively; SEV-1/2 cannot close without a postmortem; on-call rotation resolves the current on-call; paging fires on the dry-run path with a logged payload.
- **Benchmark:** Cloudflare/SRE — severity taxonomy, commander, audited mitigations, error budgets, **blameless SEV-1/2 postmortems**.
- **Skips:** PagerDuty/Opsgenie keys + go-live; public status page; operator-mobile activation (Stage C).

### Wave 9 — Developer 360 + payout reconciliation (#11, P2)
- **Objective:** the operator view over the strong partner backend; payout reconciliation + disputes.
- **Tables:** `payout_reconciliation_records`, `payout_disputes`. Reuse `app_developers`, `partner_payout_ledger_entries`, `app_billing_charges`, `webhook_subscriptions`.
- **Gateway:** `GET /v1/internal/console/developers/:id/overview` (developer + apps + installs + payouts + webhook health + open cases + review history). Payout release = Finance lead + dual-control; suspend developer cascades to apps + freezes payouts.
- **API-client/UI:** `platform-operations-portal` → **Developer 360** (profile/verification/apps/installs/revenue/payouts/violations/review history); partner-revenue board (ledger by status, rail breakdown, disputes); reconciliation view.
- **Audit:** verification, key/secret issuance & revocation (never log secrets), payout releases (dual-control + immutable), suspensions → `audit_logs` + ledger status history.
- **Acceptance:** open one developer, see apps→installs→revenue→payouts→violations; payout release requires dual-control; suspending a developer freezes payouts and disables apps; reconciliation flags a charges-vs-payout mismatch.
- **Benchmark:** Stripe Connect / Shopify Partners.
- **Skips:** live RazorpayX/Route transfer credentials; KYC/identity policy.

### Wave 10 — Compliance: GDPR data-subject console + retention + audit export sink (#10, P2)
- **Objective:** turn the existing erasure webhooks into an operator workflow; document retention; add a tamper-evident audit export.
- **Tables:** `data_subject_requests` (type access/erasure, subject, status, due_at), `audit_export_cursors`. Reuse the compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) already wired in `app-store/compliance-routes.ts` + `install-lifecycle-routes.ts`.
- **Gateway:** `/v1/internal/console/compliance/data-requests` (intake from webhooks + manual), fulfillment workflow, due-date clocks. Audit-export adapter (interface + local/dry-run sink) so "immutable" stops depending only on DB discipline.
- **API-client/UI:** `platform-console` → **Compliance** module (data-subject request queue, retention-policy view distinguishing T&S retention-exempt records from purgeable PII, audit export status).
- **Audit:** every data-subject action → `audit_logs`; export cursor advances are recorded.
- **Acceptance:** a `customers/redact` webhook creates a data-subject request with a due clock; fulfillment is audited; T&S enforcement records are excluded from erasure; audit rows export to the dry-run sink.
- **Benchmark:** SOC2/GDPR norms — data-subject workflow, retention policy, tamper-evident audit.
- **Skips:** SIEM/WORM vendor + keys; EU legal sign-off + EU-only controls.

### Wave 11 — Ops, docs, governance reconcile, final validation
- **Objective:** prove the whole thing green and update the record honestly.
- **Do:** regenerate repository intelligence; reconcile governance docs/ownership manifests for the new route groups + tables; run the **full** gate set (§9); update `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM_MASTER_REPORT.md` scorecard with the new, evidence-backed maturity scores (only where code actually shipped — no inflation); write the final `STATUS` rollup with counts, SKIPPED catalog, and the exact commands+results.
- **Acceptance:** all gates green; scorecard deltas justified by real files/tests; no theater added.

---

## 8. Cross-cutting requirements (apply to every wave)

1. **Every privileged surface enforces the full chain:** email allowlist → MFA → RBAC scope (Wave 1) → reason capture on sensitive actions → dual-control/SoD where specified → audit (reads + writes). No exceptions, no "TODO later."
2. **Explainability everywhere a machine acts.** Risk auto-actions, automated review-check failures, and auto-opened cases must carry a human-readable reason + the evidence that triggered them. This is what protects legitimate India-first merchants and makes appeals fair.
3. **Honest states only.** Loading → skeleton; empty → honest empty; error → retry. Never surface internal flags, contract names, `SKIPPED` strings, or "pending approval" to an operator as if it were a feature. If a SKIP makes a control non-functional, hide the control.
4. **Reuse, don't reinvent:** `audit_logs` writer, `notification-core`, `@letbuyy/ui` + `/formatting` (INR paise + dates), `lib/crypto.ts`, `@letbuyy/api-client` namespaces. Adding a duplicate helper fails the validator.
5. **Console vs ops-portal split** (§3.7) — detection/oversight/governance/analytics in console; execution/decisions/queues in ops-portal. Never put an enforcement mutation only in the console.
6. **Tests are part of "done":** each wave adds gateway unit tests (`services/api-gateway/src/__tests__/*`) for new routes (authz denial, SoD denial, reason-required, happy path) and behavioral/contract coverage where the harness expects it. Don't ship a route group with zero real test execution.
7. **Performance & pagination:** all new list endpoints paginate; all mutations validate (Zod, package-owned) + are idempotent where side effects can duplicate; sanitized `AppError` responses only.

---

## 9. Gates — run after every wave; all must pass before the wave is DONE

```bash
pnpm turbo typecheck
cd services/api-gateway && npx tsc --noEmit && cd ../..
pnpm lint
pnpm run test:unit:gateway          # services/api-gateway/src/__tests__/*.test.ts
pnpm run test:behavioral
pnpm run test:contracts
pnpm turbo test
pnpm run validate:governance        # = node scripts/validate-governance.mjs ; must PASS (ignore only the node_modules stale-artifact line)
# regenerate intelligence after route/page/export/topology changes, commit only the diff:
node scripts/generate-repository-intelligence.mjs
```

(`flutter analyze`/`flutter test apps/mobile/merchant-app` only if you touch mobile — you should not in this mission.)

**Definition of DONE for an item:** code complete across all needed layers · migrations apply locally + reversible · new routes have real authz/SoD/reason/happy-path tests that execute · gates green · ledger row written with files + verification · no theater added · honest degradation for any SKIP.

**Migration-apply reality:** you apply migrations to a **local** Supabase only. Applying `107`+ and your new `113`+ to staging/prod is `SKIPPED (NEEDS-HUMAN)` and already catalogued in `CODEX_FOUNDATION_STEPUP_STATUS.md` — extend that catalog, don't duplicate the deploy runbook.

---

## 10. Final acceptance — the scorecard you are moving

This run is successful when the internal-OS scorecard moves on the strength of **shipped, tested code** (update `docs/LETBUYY_INTERNAL_OPERATING_SYSTEM_MASTER_REPORT.md` only with deltas you can prove):

| Platform | Today | Target this run | Proof required |
|---|---|---|---|
| Governance / RBAC | 2.5 | **3.5** | `employee_permissions` enforced at routes; SoD + break-glass + reason + read-audit with tests |
| Risk Detection | 0.5 | **2.5** | rules engine + scoring + queue + explainable auto-restrict, wired into signup/payment/publish |
| Trust & Safety | 1.0 | **2.5** | case lifecycle + appeals (SoD) + takedowns + forever-audit, real console |
| Merchant Operations | 2.0 | **3.0** | Merchant 360 aggregate + audited actions + time-boxed impersonation |
| Support | 1.0 | **2.5** | tickets + SLA + CSAT + macros + Merchant-360 inline + escalation |
| App Review | 2.0 | **3.0** | reviewer console + automated checks populating `automated_checks` |
| Theme Review | 1.5 | **2.5** | theme QA runner (perf/a11y/security/compat) + reviewer preview/code console |
| Executive Analytics | 1.5 | **3.0** | MRR/ARR/churn/cohorts/funnels from rollups, reconcilable, staleness-honest |
| Incident Response | 3.0 | **3.5** | interactive command UI + on-call + postmortem close-gate |
| Developer Operations | 2.5 | **3.0** | Developer 360 + payout reconciliation + freeze-on-suspend |
| Audit & Compliance | (spine real) | **+data-subject console + export sink** | GDPR request workflow + retention policy + dry-run audit export |
| **Overall internal-OS** | **~2.0** | **~3.0** | every delta above backed by real files + tests; **zero new theater** |

> **The bar:** at the end of this run, LetBuyy must be able to **detect a risky merchant, open and decide a Trust & Safety case with an appeal path, resolve a support ticket with full context, review an app/theme against real checks, see trustworthy MRR/ARR, command an incident, and do all of it through scope-enforced, reason-captured, fully-audited operator actions** — as modules inside the two apps it already owns, with every human-only step (deploys, secrets, legal sign-off, paid vendors) honestly catalogued under `SKIPPED (NEEDS-HUMAN)` and everything else actually built.

Now read the source-of-truth docs in §1, create the ledger/status files, and begin at Wave 0. Build the company layer. No theater.



