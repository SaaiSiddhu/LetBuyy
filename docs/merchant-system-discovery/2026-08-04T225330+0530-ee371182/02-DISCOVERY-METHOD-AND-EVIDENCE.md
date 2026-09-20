# 02 — Discovery Method and Evidence Standard

**Run ID:** `2026-08-04T225330+0530-bf35062e`
**Repository:** `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`
**Branch:** `stepup/main` · **HEAD:** `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (short `bf35062e`) · **HEAD attached**
**Run window:** 2026-08-04 22:53:30 +0530 → 2026-08-05 (local), UTC start `2026-08-04T17:23:30Z`
**Scope of this document:** how the discovery was performed, what was and was not verified, and the evidence rules every other document in this dossier obeys.

> **No secrets or PII appear in this document.** Environment variables are referenced by **name only**; no value was read from any `.env*` file, printed, or stored.

---

## 1. Recommendation / verdict on the method itself

The dossier rests on **static source and schema reading by 13 parallel domain auditors**, plus **one agent that actually executed builds, tests, validators, and a limited runtime probe**. Roughly **95% of the dossier is static evidence**; the empirical layer is real but narrow (builds, test suites, the governance gate, and a handful of runtime observations against an already-running dev stack).

**Therefore: almost nothing in this dossier is `VERIFIED_E2E`, and that is a deliberate, honest ceiling — not an oversight.** No merchant journey was executed end-to-end, because doing so would have required logging in with credentials (prohibited) and a provisioned database and provider credentials (absent). Any reader who needs "this works in production" certainty must run the acceptance tests in document `27` on a provisioned staging environment.

---

## 2. Governance read before any delegation

The commander read the full authority chain **before** appointing agents, as required by `AUTH-R1`:

| # | Document | Path | Read |
|---|---|---|---|
| 1 | Constitution (DOC 01, supreme) | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (471 lines) | in full |
| 2 | Agent operating rulebook (DOC 02) | `AGENTS.md` (405 lines) | in full |
| 3 | AI operating context | `CLAUDE.md` (264 lines) | in full |
| 4 | Local subtree rules | every relevant `apps/*/AGENTS.md`, `services/*/AGENTS.md`, `packages/*/AGENTS.md` | by each agent before inspecting its subtree |
| 5 | Prior-truth corpus | `docs/final-v1-certification/`, `docs/v1-execution/`, `EXECUTABLE_HUMAN_REQUIRED.md`, `SKIPPED_HUMAN_DECISIONS.md`, `MERGE_RUNBOOK.md` | by the commander and agent A |

Every subagent was issued the binding constitutional constraints (topology, money, identity, tenancy, theme, never-build) **inside its prompt**, and was instructed that on conflict the Constitution wins and this mission's prompt yields.

### 2.1 Conflicts between the mission brief and repository governance (recorded, as required)

Two statements in the mission brief did not match repository law. **Governance won in both cases**, and both are carried into `31-DOCUMENTATION-DRIFT-AND-UPDATE-PLAN.md`.

| # | Mission brief said | Repository law / reality | Resolution |
|---|---|---|---|
| 1 | `confirm_order_payment_with_ledger` is a canonical money RPC (implying it ledgers) | Root `AGENTS.md:246` (`PAY-R2`) asserts it "posts **zero** ledger entries despite its name". **Both are partly wrong at HEAD:** migration `168_b1_b2_capture_refund_ledgering.sql:133+` redefines it to post a balanced `pa_clearing` Dr / `merchant_payable` Cr transaction under `FOR UPDATE` with an idempotency key and `ON CONFLICT DO NOTHING`. | The **RPC does ledger**; `AGENTS.md PAY-R2` is **stale**. Verified independently by the commander and by agent G. See `12-MONEY-LEDGER-REFUNDS-RECONCILIATION.md`. |
| 2 | Customer sessions are HS256 via `CUSTOMER_SESSION_SECRET`, merchant sessions ES256 — presented as the design | Constitution `ART-05` / `R-14` (`LETBUYY_CONSTITUTION.md:411`) requires `identity-platform` to be the **sole asymmetric issuer for all three realms** and forbids a shared symmetric signing secret | Treated as a **live-state deviation from constitutional law**, not as correct design. Recorded as an unresolved **Class-A** contradiction requiring an ARB decision either way. See `22-SECURITY-TENANCY-AND-INVARIANT-AUDIT.md`. |

---

## 3. The multi-agent operating model actually used

Claude Code's native subagent mechanism was used. **13 bounded, non-overlapping domain auditors ran in parallel** under a commander who read governance, assigned scope, enforced the taxonomy, reconciled contradictions, and authored the cross-cutting documents.

| Agent | Workstream | Notes file | Outcome |
|---|---|---|---|
| A | Governance, topology, prior-truth | `_agent-notes/A-governance-topology.md` | completed |
| B | Merchant control-plane UI & navigation | `_agent-notes/B-merchant-ui-routes.md` | completed |
| C | Catalog / products / collections | `_agent-notes/C-catalog.md` | completed |
| D | Inventory, suppliers, POs, input-GST data | `_agent-notes/D-inventory-purchase-orders-input-gst.md` | completed |
| E | Orders, fulfillment, shipping, COD, returns | `_agent-notes/E-orders-fulfillment-cod.md` | completed |
| F | Customers, privacy, staff, RBAC | `_agent-notes/F-customers-staff-rbac.md` | completed |
| G | Payments, Razorpay (BYOG + managed), refunds, payouts | `_agent-notes/G-payments-refunds-payouts.md` | completed |
| H | GST, invoices, output/input tax, reporting | `_agent-notes/H-gst-invoices-reports.md` | completed |
| I | Discounts, coupons, gift cards | `_agent-notes/I-discounts-gift-cards.md` | completed |
| J | CMS, blog, policies, navigation, domains, themes | `_agent-notes/J-cms-blog-policies-themes.md` | completed |
| K | API, data model, RLS, webhooks, jobs, integrations | `_agent-notes/K-api-data-security-integrations.md` | **failed on first attempt** (transport error mid-response), **re-run to completion** |
| L | Runtime, build, test, user-journey verification | `_agent-notes/L-runtime-build-test.md` | completed — the only agent that executed anything |
| M | QA, accessibility, observability, operations | `_agent-notes/M-quality-observability-operations.md` | completed |

**Concurrency limit encountered:** the harness capped simultaneous agents at 10 (CPU-derived), so three agents queued and started as slots freed. This affected wall-clock time only, not coverage.

**Agent K failure and recovery — recorded because it affects evidence provenance.** Agent K's first execution terminated with a transport-level error (`Connection closed mid-response`) after substantial work, and **wrote no notes file**. It was re-run from the same prompt via workflow resume; the other 12 agents replayed from cache and were not re-executed. Document `18`, `19` and `20` derive from the **re-run**.

### 3.1 Rules every subagent operated under

1. Read applicable governance before inspecting its subtree.
2. **Read-only outside one assigned notes file.** No application, service, package, migration, test, deployment, or governance file was modified by any agent.
3. Cite `path:line` for every material claim.
4. Never quote or record a secret value or PII.
5. Separate `DOC_CLAIM` from code proof from runtime proof.
6. Use the shared status taxonomy verbatim.
7. Record contradictions and unknowns rather than guessing.

---

## 4. Exclusions — what was deliberately not treated as production truth

| Excluded | Reason |
|---|---|
| `.claude/worktrees/agent-a1bd13d85c3105715/**` | A stale **full copy of the repository** left by an earlier session. Citing it would double-count and could report fixed code as broken. Never used as evidence. |
| `node_modules/`, `.next/`, `dist/`, `.turbo/`, `.wrangler/`, `build/` | Generated output; `ARCH-R16` forbids treating it as source authority. |
| `graphify-out/**` | Generated LCIS output (gitignored). Read for hints only; never cited as product truth. |
| `docs/archive/**` | Historical record per `AUTH-R2`. Cited **only** to prove that a document is stale. |
| `legacy/**` | DEAD per governance. |
| Frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) | `ART-22`. Inventoried for topology conformance only; **not** audited as merchant capability. |

---

## 5. The worktree state — and why it is less alarming than the raw number

At run start `git status --porcelain` reported **6,805 entries: 6,784 modified + 21 untracked**. That number is misleading and is characterised precisely here so no downstream reader misreads it.

| Measure | Value |
|---|---|
| Files reported modified | 6,784 |
| Aggregate diff | **+3,687 / −743** (commander), **+3,817 / −796** (agent L, ~45 min later) |
| Files with **any real content change** | **721** (commander) → **725** (agent L) |
| Files whose only change is the **file mode** `100644 → 100755` | **6,781** |

**Conclusion: ~99.96% of the "dirty" tree is a mass `chmod` sweep, not content.** Only ~721–725 files carry real edits.

This is itself a finding worth acting on (it turns every future diff and PR into noise and can alter deployed artifact permissions), and it is recorded in the gap register.

**Handling:** every pre-existing change was **preserved**. No `git reset`, `stash`, `checkout`, `restore`, or reformat was run by the commander or any agent. Dirty paths were characterised by directory and by mode-vs-content only — **no sensitive diff content was read, displayed, or written into any dossier document**.

Top-level distribution of the modified set: `docs` 2,345 · `packages` 1,464 · `apps` 1,261 · `services` 366 · `tests` 245 · `tools` 222 · `database` 185 · `scripts` 176 · `artifacts` 176, remainder spread across governance directories.

### 5.1 The observation window was not static — recorded as a caveat on every count

Agent A detected that a **concurrent actor** (not this mission) wrote into the repository **during** the run:

- `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` — created 23:05:18
- `database/supabase/rollback/196_…`, `180_…`, `181_…`, `188_…`, `189_…`, `190_…`, `191_…` — 23:05:40 → 23:07:49

Agent A's migration census returned **124 migrations / 40 rollbacks** before 23:05 and **125 / 47** at 23:21.

**Consequence, stated plainly:** every count in this dossier is a **timestamped snapshot, not a stable fact**. Two agents sampling minutes apart can legitimately disagree without either being wrong. Where counts differ between documents, the later census governs, and re-running any census may produce different numbers again. Nothing in this dossier depends on a count being exact; the findings depend on structure and code paths, which did not change during the window.

---

## 6. What was executed (the empirical layer) — agent L only

Full detail, with exit codes and durations, is in `21-BUILD-TEST-RUNTIME-RESULTS.md`. Summary of the **method**:

**Environment:** Node v26.5.1 local (CI pins Node 20 — a caveat on every local result), pnpm 10.6.2, turbo 2.8.9, Flutter 3.44.8 / Dart 3.12.2, Docker running with `postgres:15`/`15-alpine` present but `postgres:16-alpine` **absent**.

**Executed:** 14 workspace builds sequentially (so failures are attributable); root `pnpm build`, `pnpm typecheck`, `pnpm lint`, `lint:css`; ~24 test suites across `tests/*`, workspace packages, and Flutter; the 108 gate-lane validators individually; and a limited runtime probe.

**Deliberately NOT executed, and why — these are the honest limits of the empirical layer:**

| Not done | Reason |
|---|---|
| `pnpm validate:governance` **to completion** | `scripts/validate-governance.mjs:154-188` calls `removeGeneratedArtifactDirectories()`, which `fs.rmSync`-deletes `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `Pods` under `apps/`, `packages/`, `services/` **before** validating. Running the canonical gate would have destroyed the user's installed dependencies. The 108 validators were instead invoked **individually** through a read-only harness. This is a genuine operational hazard, filed as a gap. |
| `node scripts/dev/setup-local-env.mjs` | It **writes** `apps/*/.env.local` and `services/*/.dev.vars` (`:211-219`). All 13 target files already existed, so it would have been a no-op — but the mandate permits writing exactly one file, so it was not risked. |
| `pnpm install` / `pnpm add` / any dependency install | Forbidden by mandate; a missing or stale dependency is a blocker to **report**, not to fix. |
| Pulling `postgres:16-alpine` | A network download of executable content. The locally present `postgres:15-alpine` was used via the harness's own `LETBUYY_EXECUTABLE_PG_IMAGE` override, and every affected result says so. |
| **Logging into the merchant application** | Entering credentials is prohibited. **This is the single biggest limit on this dossier** and is why no merchant journey reaches `VERIFIED_E2E`. |
| Killing the pre-existing dev stack | Ports 9001/9002/9006/9007/9009–9013/54321 were already occupied by **another session**. Agent L started only its own storefront process on :9000 and killed only that, verifying every other port still up afterwards. |
| Any production connection, real payment, refund, payout, email, SMS, webhook, KYC, or migration apply | Prohibited by mandate and by `R-21`. |

---

## 7. Evidence standard enforced across the dossier

### 7.1 Status taxonomy (exact strings; no others are permitted)

`VERIFIED_E2E` · `IMPLEMENTED_NOT_RUNTIME_VERIFIED` · `BACKEND_ONLY` · `UI_ONLY` · `PARTIAL` · `STUB_OR_MOCK` · `BROKEN` · `NOT_IMPLEMENTED` · `DORMANT_FLAGGED` · `BLOCKED_EXTERNAL` · `UNVERIFIED_RUNTIME` · `OUT_OF_SCOPE_OR_DEFERRED` · `CONTRADICTORY_EVIDENCE`

**Ceiling rule:** static reading caps at `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. `VERIFIED_E2E` requires runtime execution **plus** persistence/downstream proof. Passing unit tests is explicitly **not** end-to-end proof — a point sharpened by agent L's structural finding that much of the suite is source-text pattern matching (§8).

`BROKEN` was permitted from static evidence **only** where a deterministic code/schema contradiction makes the runtime outcome provable by inspection — a query filtering on a column that does not exist, a route behind a middleware that must reject it, a consumer reading a field the producer never emits. Each such case names the contradiction.

### 7.2 Evidence types

`DOC_CLAIM` · `UI_CODE` · `PROXY_CODE` · `API_CLIENT_CODE` · `GATEWAY_CODE` · `SERVICE_CODE` · `DB_SCHEMA` · `RLS_POLICY` · `RPC_FUNCTION` · `WEBHOOK_OR_JOB` · `UNIT_TEST` · `INTEGRATION_TEST` · `E2E_TEST` · `BUILD_RESULT` · `RUNTIME_OBSERVATION` · `PROVIDER_OR_CONFIG_EVIDENCE` · `LCIS_GRAPH`

A `DOC_CLAIM` alone proves nothing. Where a repository document and the source disagree, the **source governs** and the document is recorded as drift.

### 7.3 Prohibitions on the output

No calendar estimates, team capacity, budgets, merchant counts, production volumes, or live telemetry were invented. Relative sizing (`S/M/L/XL`) appears only in the roadmap, is grounded in discovered dependency/blast-radius evidence, and is explicitly **not** a schedule. No readiness percentage is asserted except where a transparent scored matrix supports it. No legal or tax conclusion is asserted anywhere; GST statements carry one of four labels (`CODE_IMPLEMENTED` / `ACCOUNTING_POLICY_DEFINED` / `LEGALLY_VALIDATED` / `INFERRED-FROM-PRACTICE-NOT-REPO`) and `LEGALLY_VALIDATED` is **NONE**.

---

## 8. Why "the tests pass" is weak evidence in this repository

Agent L established, and this dossier adopts, that a large share of the repository's test suite **asserts on source text rather than executing behaviour** — regex/pattern matches over files. Independently, agent C found that *every* catalog "end-to-end" test is a source-text match that never runs catalog code.

**Consequences the reader must internalise:**

1. A green suite can coexist with a broken runtime path.
2. Suites that would prove behaviour (`tests/executable`, the money-ledger Postgres proof) require a Docker Postgres fixture that CI never starts — 20 executable tests report "No such container" by default.
3. Therefore, throughout this dossier, `UNIT_TEST` evidence is treated as **weak** unless the test demonstrably executes the production code path.

---

## 9. Adversarial reconciliation performed by the commander

High-impact claims were cross-checked against at least two independent evidence types, and the commander independently re-derived several headline findings rather than accepting an agent's word:

| Claim | Independent corroboration |
|---|---|
| `confirm_order_payment_with_ledger` posts balanced double-entry rows | Commander read `168_b1_b2_capture_refund_ledgering.sql` directly **before** agent G reported; agent G reached the same conclusion independently. Two-source `RPC_FUNCTION` proof. |
| Prior certification's "shipping-rate drop" S1 defect | Commander traced the whole chain at HEAD: `checkout-client.tsx:363` → `apps/storefront-runtime/src/app/api/orders/route.ts:56` → `checkout-payment-routes.ts:293` → `shipping-rate-resolver.ts:61-71` (tenant-validated) → `order-execution.adapter.ts:174`. **Defect is fixed** — the prior document is stale. |
| Refund step-up bypass + cross-tenant `refund_id` | Reported independently by agents **E, F and G**. Three-source convergence. |
| Money represented as rupee `numeric`, not `bigint` paise | Reported independently by agents **C** (catalog `numeric(10,2)`) and **E** (orders `numeric(12,2)`). |
| Governance gate is RED | Agent A (83 pass / 25 fail) and agent L (25 of 108 fail) ran the validators **separately** and agree. |
| Worktree is cosmetically, not substantively, dirty | Commander (721 content-changed files) and agent L (725, ~45 min later) agree. |

Contradictions that could not be safely resolved are marked `CONTRADICTORY_EVIDENCE` with the exact conflict stated, never silently reconciled.

---

## 10. Repository writes made by this mission

Exactly three locations, all additive, all inside the sanctioned discovery output:

1. `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e/` — the dossier and `_agent-notes/`
2. `artifacts/merchant-system-discovery/` — the ZIP and its checksum
3. Nothing else.

**No application, service, package, migration, schema, RLS policy, test, deployment, governance, or feature-flag file was created, modified, or deleted.** No commit, push, merge, PR, or deploy occurred. No external provider resource was created or mutated.

---

## 11. Open questions about the method itself

1. **The empirical layer cannot close a merchant journey.** Without an authenticated session against a provisioned database, "the merchant can do X" remains `IMPLEMENTED_NOT_RUNTIME_VERIFIED` at best. Document `27` specifies exactly what to run once staging exists.
2. **Local Node 26.5.1 vs CI Node 20.** Build and test results could in principle differ. Agent L flagged the one finding it judged version-sensitive.
3. **The concurrent actor.** Someone or something was writing migrations and rollbacks during the run. If that work continues, several counts and a few unpaired-rollback findings will move.
4. **`postgres:15-alpine` substituted for `postgres:16-alpine`.** Behavioural Postgres results were obtained on a different major version than the fixture specifies.

---

## 12. Confidence in the method

**HIGH** for structural, code-path, and schema findings — they are multiply-sourced, `path:line`-cited, and several were independently re-derived.
**MEDIUM** for build/test/validator results — genuinely executed, but on a dirty worktree, a different Node major than CI, and a substituted Postgres image.
**LOW** for anything requiring a live merchant session, a provisioned database, or a real provider — that is the un-closed part of the mission, and it is stated as such everywhere rather than papered over.

**Largest single uncertainty:** no merchant journey was executed end-to-end, so every "works" claim in this dossier is a claim about **code paths**, not about **observed behaviour**.
