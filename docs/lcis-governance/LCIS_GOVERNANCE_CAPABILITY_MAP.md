# LCIS Governance Capability Map
## GDIS Phase 5 — Agent 01 (Forensics)

> Status: READ-ONLY discovery. Maps each GDIS capability to its exact artifact field(s), detection rule, reuse point, and honest gaps.  
> Ground truth: verified directly from `graphify-out/*.json` artifact shapes.  
> Generated: 2026-06-20

---

## How to Read This Document

Each capability section states:
- **Artifact field(s):** the exact JSON path(s) in `graphify-out/*.json` that enable detection
- **Detection rule:** the precise structural logic GDIS applies
- **Reuse point:** which existing lcis-core/lcis-execution/lcis-live service already covers overlapping logic (avoid duplication)
- **Honest gap:** what structural data CANNOT answer (must be labelled NOT COMPUTABLE or NOT CONNECTED in any GDIS output)

---

## Part 1: Architecture Drift

### 1.1 Architecture Drift (deprecated aliases in active topology)

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `summary.vercelApps[]`, `workers[].file`, `workers[].name`
- `graphify-out/domain-intel.json` → `domains[].apps[]`, `domains[].workers[]`
- `graphify-out/discovery-v2.json` → `drift.architecture.count`, `drift.architecture.detail`

**Detection rule:** Any of the 9 deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/internal`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) appearing in the infra-intel worker file paths, domain apps lists, or vercel apps. Canonical reference: `LETBUYY_CONSTITUTION.md §CLAUDE.md Deprecated Runtime Policy`.

**Reuse point:** `VerificationService.verifyServices()` already checks this using infra-intel + `DEPRECATED_ALIASES` set. GDIS should delegate to or reference this method rather than re-implementing.

**Honest gap:** Does not detect deprecated aliases in prose documentation or AGENTS.md — only in structural artifacts.

---

### 1.2 Single-System-Per-Domain Drift

**Artifact field(s):**
- `graphify-out/domain-intel.json` → `domains[].apps[]` (must be a subset of canonical apps per domain)
- `graphify-out/infra-intel.json` → `workers[]` (canonical workers list)
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (prose, not JSON)

**Detection rule:** If a domain references more than one "canonical system" for the same capability (e.g., two renderers, two ledgers), it is drift. Currently detectable only if domain-intel lists multiple apps for the same logical capability. `one-system-per-domain-validator.mjs` enforces this.

**Reuse point:** `VerificationService.verifyDomains()` + `one-system-per-domain-validator.mjs` output in `audit-engine-v2.json` findings.

**Honest gap:** True single-system enforcement requires human review of `LETBUYY_CANONICAL_SYSTEMS.md` prose vs code; artifact alone cannot detect "two ledgers" if both are in the same tables list.

---

## Part 2: Table Drift

### 2.1 Table RLS Drift

**Artifact field(s):**
- `graphify-out/db-intel.json` → `tables[].rls` (boolean), `tables[].force` (boolean), `tables[].tenant` (boolean), `tables[].hasSiteId` (boolean)
- `graphify-out/discovery-v2.json` → `drift.rls.count` (20), `drift.rls.detail`
- `graphify-out/audit-engine-v2.json` → `findings[id="A-RLS"].count` (20)

**Detection rule:** `tenant = true AND rls = false` → candidate missing RLS. Severity escalates if `money = true` and `rls = false`. `rls-force-coverage-validator.mjs` and `no-public-using-true-validator.mjs` are authoritative.

**Reuse point:** `lcis-live/SupabaseAdapter` performs live RLS detection when CONNECTED. GDIS performs the STATIC equivalent from `db-intel.json` — different data source, no duplication. lcis-core `VerificationService` reads the A-RLS finding from audit-engine-v2.

**Honest gap:** Policy SQL expressions (the actual `USING (...)` clause) are NOT in `db-intel.json` — only `public`, `usesSiteId`, `serviceRole` flags. Cannot determine whether a policy is correctly scoped beyond these three boolean flags without live DB access.

---

### 2.2 Table Tenant-Scope Drift (missing site_id)

**Artifact field(s):**
- `graphify-out/db-intel.json` → `tables[].hasSiteId`, `tables[].hasStoreId`, `tables[].tenant`

**Detection rule:** `tenant = true AND hasSiteId = false AND hasStoreId = false` → candidate missing tenant FK column. Also: `tenant = false AND tables[].policies[].usesSiteId = true` → contradictory classification.

**Reuse point:** `tenant-isolation-validator.mjs` enforces this in CI.

**Honest gap:** `hasSiteId`/`hasStoreId` indicates column presence only, not whether the column is a FK or whether RLS policies use it.

---

### 2.3 Dead Table Drift

**Artifact field(s):**
- `graphify-out/autonomous-discovery-v5.json` → `deadTables` (count: 44)
- `graphify-out/discovery-v2.json` → `drift.domain.detail` (mentions 86 unclassified tables)

**Detection rule:** Tables not referenced in any domain's `tables[]` array in `domain-intel.json` AND not appearing in any `routeTables` or `rpcCallers` map in `db-intel.json`. Count: 44 candidates.

**Reuse point:** `dart-dead-source-validator.mjs`, `typescript-dead-source-validator.mjs`. GDIS surface delegates count from autonomous-discovery-v5.

**Honest gap:** Many dead table candidates are trigger/internal/projection tables that are called by triggers rather than by the gateway. Full verification requires live query analysis or cross-reference with all trigger bodies.

---

## Part 3: RPC / Function Drift

### 3.1 RPC Security Drift (non-SECURITY DEFINER money RPCs)

**Artifact field(s):**
- `graphify-out/db-intel.json` → `functions[].securityDefiner`, `functions[].money`

**Detection rule:** `money = true AND securityDefiner = false` → canonical-ledger violation candidate. Constitution §Commerce: money mutations must go through SECURITY DEFINER RPCs. `canonical-ledger-only-validator.mjs` enforces in CI.

**Reuse point:** `canonical-ledger-only-validator.mjs` is the authoritative gate. GDIS surfaces the count from db-intel.

**Honest gap:** `securityDefiner` and `money` flags are set by the graph builder heuristic — false positives possible if a function touches a money-adjacent table but is not a ledger mutation.

---

### 3.2 RPC Idempotency Drift

**Artifact field(s):**
- `graphify-out/db-intel.json` → `functions[].hasIdempotency`, `functions[].money`, `functions[].forUpdate`

**Detection rule:** `money = true AND hasIdempotency = false` → idempotency gap candidate. Constitution: every money RPC requires `idempotency_key` and `ON CONFLICT`. 40 functions have idempotency; 34 are money — overlap analysis needed.

**Reuse point:** No existing LCIS service computes this exact ratio. GDIS can compute it directly from db-intel.

**Honest gap:** `hasIdempotency` is detected by pattern matching in the function definition; false negatives possible if idempotency is implemented via a different naming convention.

---

### 3.3 Dead RPC Drift

**Artifact field(s):**
- `graphify-out/autonomous-discovery-v5.json` → `deadRpcs` (count: 75)
- `graphify-out/discovery-v2.json` → `drift.rpc.count` (75), `drift.rpc.detail`
- `graphify-out/db-intel.json` → `functions[].callers[]` (empty = no gateway caller)

**Detection rule:** `securityDefiner = true AND callers = []` (or callers not containing a gateway route). 75 candidates. Most are trigger/internal functions called by DB triggers, not by the gateway.

**Reuse point:** `autonomous-discovery-v5.json` already provides this count. `db-intel.rpcCallers` has 59 entries showing which routes call which RPCs.

**Honest gap:** Cannot distinguish "dead" from "called only by triggers" from the current artifact shape. Trigger-called functions appear dead in the `callers[]` field because triggers are not represented in the rpcCallers map.

---

## Part 4: Worker / Queue Drift

### 4.1 Worker Binding Drift

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `workers[].bindings[]`, `workers[].queueProducers[]`, `workers[].queueConsumers[]`, `workers[].kv[]`, `workers[].r2[]`
- `cloudflare-binding-validator.mjs` (CI gate)

**Detection rule:** A binding declared in a worker's manifest but not appearing in the domain's `secrets[]` or infra summary → undeclared binding. Conversely, a queue consumer with no matching producer → orphaned consumer.

**Reuse point:** `queue-topology-validator.mjs`, `cloudflare-binding-validator.mjs`. `runtime-intel.queueGraph` provides the producer→consumer topology.

**Honest gap:** Worker binding drift from actual Wrangler deployment vs manifest is NOT computable from static artifacts — requires live Cloudflare API call (NOT CONNECTED).

---

### 4.2 Queue Drift (unused queues)

**Artifact field(s):**
- `graphify-out/runtime-intel.json` → `queueGraph[]` (5 edges)
- `graphify-out/autonomous-discovery-v5.json` → `unusedQueues` (count: 1)

**Detection rule:** A queue appearing in a worker's `bindings[]` but not in `queueGraph` as a producer or consumer → unused candidate.

**Reuse point:** `queue-topology-validator.mjs` enforces queue ownership.

**Honest gap:** Queue depth / DLQ counts NOT CONNECTED — requires Cloudflare API.

---

## Part 5: Test Drift

### 5.1 Missing Test Coverage (per-domain)

**Artifact field(s):**
- Filesystem: `tests/**/*.{mjs,ts}` (238 files across 27 directories)
- `graphify-out/graph.json` → `nodes[]` with `source_file` (52,246 nodes); regex `/\.(test|spec)\.[tj]sx?$|\/tests?\//i`

**Detection rule:** For domain D, collect `domain-intel.domains[D].{routes,rpcs,tables}`. Search `graph.json` nodes for test files referencing these strings. If none found → coverage gap. Severity: money/tenant entity → critical; other → medium.

**Reuse point:** `TestingIntelligenceService.detectMissingCoverage()` implements this exact logic for a change request. GDIS can extend this to all 22 domains at-rest by iterating over each domain's route/rpc/table lists as the "change request" input.

**Honest gap:** Whether a test PASSES (only detects file existence + naming). Static domain → test matrix at rest requires calling TestingIntelligenceService for each domain — it does not produce a pre-computed matrix.

---

### 5.2 Test Coverage Governance (no-noop test scripts)

**Artifact field(s):**
- `package.json` `scripts.test` fields across all apps (checked by `no-noop-test-script-validator.mjs`)
- `audit-engine-v2.json` → `summary.routesAudited`, `summary.authCoverage` (55/87), `summary.validationCoverage` (71/87)

**Detection rule:** Any package with `test: "echo no tests"` or equivalent → noop test drift. Route auth coverage < 100% → auth drift.

**Reuse point:** `test-coverage-governance-validator.mjs` and `no-noop-test-script-validator.mjs` enforce in CI. Audit finding A-AUTH (32 routes missing auth guard) and A-VALID (16 routes missing validation) are pre-computed.

---

## Part 6: Runbook Drift

### 6.1 Missing Domain Runbook

**Artifact field(s):**
- `graphify-out/runbooks.json` → `runbooks` (object keyed by domain, 22 entries)
- `graphify-out/domain-intel.json` → `domains[].key` (22 keys)

**Detection rule:** Set of `domain-intel.domains[].key` minus `Object.keys(runbooks.runbooks)` → domains missing a runbook. Currently: 0 missing (22/22 present).

**Reuse point:** None existing in LCIS — GDIS is the first to define this check.

**Honest gap:** Runbook quality (does it have steps, escalation chain, recovery procedure?) requires parsing runbook content per domain. `runbooks.json` has `detection`, `diagnosis`, `recovery`, `rollback`, `verification` fields per domain — quality can be checked by verifying each field is non-empty.

---

### 6.2 Runbook Signal Disconnection Drift

**Artifact field(s):**
- `graphify-out/runbooks.json` → `runbooks[domain].detection.source` (contains "NOT CONNECTED" for all live signals)
- `graphify-out/connections-intel.json` (adapter connection status)

**Detection rule:** If `detection.signals` contains "NOT CONNECTED" for a money domain → elevated risk flag. All 22 runbooks currently have NOT CONNECTED live signals.

**Reuse point:** `connections-intel.json` tracks CONNECTED/NOT CONNECTED per adapter.

**Honest gap:** Runbook rehearsal history / last-executed date NOT COMPUTABLE from any artifact.

---

## Part 7: Documentation Drift

### 7.1 Domain Documentation Presence

**Artifact field(s):**
- Filesystem: `docs/architecture/` (auth-map.md, developer-platform-map.md, gateway-map.md visible in memory-intel sources)
- `graphify-out/memory-intel.json` → `sources[]` (41 source files indexed)

**Detection rule:** For domain D, check if any of the 41 memory sources references domain D by key. If not → documentation gap candidate. Cross-reference with `docs/governance/`, `docs/architecture/`, `docs/ui-standards/`.

**Reuse point:** `repository-intelligence-validator.mjs` enforces doc generation/freshness gates. `memory-intel.json` provides the indexed sources list.

**Honest gap:** Doc FRESHNESS (last modified vs. last code change for same domain) NOT COMPUTABLE — no artifact tracks file modification timestamps vs domain change timestamps. This requires git log analysis per file.

---

### 7.2 Governance Document Completeness Drift

**Artifact field(s):**
- Filesystem: `GOVERNANCE_REWRITE_2026_06_10/` (8 files)
- `graphify-out/memory-intel.json` → `sources[]`

**Detection rule:** Required governance files (`LETBUYY_CONSTITUTION.md`, `LETBUYY_AGENTS_V2.md`, `LETBUYY_CANONICAL_SYSTEMS.md`) exist and are indexed in memory-intel sources.

**Reuse point:** `generated-artifact-validator.mjs`, `meta-no-theater-validator.mjs`.

**Honest gap:** Document content compliance with constitution (e.g., does AGENTS.md reference all 22 domains?) requires NLP or manual audit — NOT COMPUTABLE from JSON artifacts.

---

## Part 8: Migration Drift

### 8.1 Sequential Migration Drift

**Artifact field(s):**
- `graphify-out/memory-intel.json` → `migrations[]` with `n` (sequence number) and `file`

**Detection rule:** Any gap in the `n` sequence → sequential drift candidate. `sequential-migration-validator.mjs` enforces this. Currently 103 migrations; highest number seen is 174 (gaps confirmed in numbering).

**Reuse point:** `sequential-migration-validator.mjs`. `memory-intel.migrations[]` provides the sequence for GDIS to surface.

**Honest gap:** Whether gaps are intentional (reserved slots) or accidental NOT COMPUTABLE from artifact alone — requires cross-referencing with the migration safety validator output.

---

### 8.2 Migration Rollback Presence Drift

**Artifact field(s):**
- `graphify-out/memory-intel.json` → `migrations[].type`, `migrations[].name`
- `scripts/validators/rollback-integrity-validator.mjs` (CI gate — checks rollback script presence)

**Detection rule:** Migration of type `payment` or `security` with no corresponding rollback script in `database/supabase/rollbacks/` (or wherever rollback scripts are stored) → rollback gap.

**Reuse point:** `rollback-integrity-validator.mjs` enforces. Its output is NOT in any `graphify-out/*.json` artifact.

**HONEST GAP: NOT COMPUTABLE from current artifacts.** No `graphify-out/*.json` artifact exposes per-migration rollback script presence. GDIS can only surface the validator name as the enforcement gate; it cannot independently compute rollback coverage without filesystem access or an additional artifact.

---

### 8.3 Migration Safety Drift (destructive DDL)

**Artifact field(s):**
- `graphify-out/memory-intel.json` → `migrations[].type`, `migrations[].name`
- `scripts/validators/migration-safety-validator.mjs` (CI gate)

**Detection rule:** Migration names containing "drop", "delete", "truncate" in a payment or security migration type → high-risk candidate requiring ARB review.

**Reuse point:** `migration-safety-validator.mjs`.

**Honest gap:** Actual SQL content of migrations is NOT in `memory-intel.json` — only `n`, `file`, `name`, `type` fields. Cannot detect destructive DDL patterns without reading migration files directly.

---

## Part 9: Validator Drift

### 9.1 Validator Count / Stale Gate Drift

**Artifact field(s):**
- Filesystem: `scripts/validators/*.mjs` (112 files, 100 confirmed + 12 non-validator)
- `graphify-out/audit-engine-v2.json` → `summary.note` ("107-validator gate")
- `graphify-out/production-readiness-v2.json` → `systems[key="infra:arch"].evidence[0]` ("107/107 governance validators green")

**Detection rule:** `ls scripts/validators/*.mjs | wc -l` != count claimed in audit-engine-v2 summary → validator drift (new validators added but reference count not updated). Current actual count is 112; audit reference says 107 → 5 net additions since reference was written.

**Reuse point:** `tooling-governance-validator.mjs`, `stale-artifact-validator.mjs`.

**Honest gap:** Which of the 112 files are actual validators vs helpers (governance-common.mjs, phase-b-common.mjs, design-system-baseline.json) cannot be determined from filenames alone — requires reading each file for the validator export pattern.

---

### 9.2 Validator Gate Coverage (what the gate does NOT cover)

**Artifact field(s):**
- `graphify-out/audit-engine-v2.json` → `summary.note` ("the gate does NOT cover app next build")
- `graphify-out/production-readiness-v2.json` (explicitly notes "structural" data only)

**Detection rule:** Any GDIS report must replicate the canonical caveat: validators are structural; live behavior, app build correctness, and runtime behavior are NOT covered by the 112-validator gate.

**Honest gap:** The gate covers static structural rules. It does NOT cover: runtime correctness, E2E flows, payment processor integration, live DB query behavior, next build success per app.

---

## Part 10: Ownership Drift

### 10.1 Domain Ownership Drift

**Artifact field(s):**
- `graphify-out/domain-intel.json` → `domains[].owners[]`
- `graphify-out/infra-intel.json` → `ownership[]` with `path` and `owners[]`
- `.github/CODEOWNERS` (35 lines, 26 non-comment entries)
- `graphify-out/audit-engine-v2.json` → `findings[id="A-OWN"].count` (0)

**Detection rule:** `domain.owners = []` OR `domain.owners.length = 0` → ownerless domain. Count: 0 (all 22 owned). CODEOWNERS wildcard `* @saai-sidd` ensures 100% structural coverage.

**Reuse point:** `package-ownership-validator.mjs`, `route-ownership-validator.mjs`. `VerificationService.verifyDomains()` checks A-OWN.

**Honest gap:** Single-owner risk (bus factor = 1) is structurally detectable (all 22 domains owned by exactly one person) but is a POLICY concern, not a hard drift violation. No GitHub team-level CODEOWNERS entries exist — only individual.

---

### 10.2 Path Ownership Drift

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `ownership[].path`, `ownership[].owners[]` (26 paths, all owned)
- `.github/CODEOWNERS` (wildcard `*` covers all)

**Detection rule:** New top-level directory not matching any specific CODEOWNERS pattern (falls through to wildcard only, no specific owner) → ownership specificity drift.

**Reuse point:** `single-writer-ownership-validator.mjs`.

**Honest gap:** CODEOWNERS wildcard means structural 100% coverage but semantic "who reviews what" is opaque — cannot distinguish intentional broad ownership from missing specific ownership without ARB-defined granularity rules.

---

## Part 11: Security Drift

### 11.1 Public Policy Drift

**Artifact field(s):**
- `graphify-out/db-intel.json` → `policies[].public` (34 = true)
- `graphify-out/discovery-v2.json` → `drift.security.count` (34), `drift.security.detail` ("service-role-scoped; no-public-using-true validator is authoritative")

**Detection rule:** `policy.public = true` → candidate violation of `no-public-using-true-validator.mjs`. All 34 are asserted to be service-role-scoped per discovery-v2 detail.

**Reuse point:** `no-public-using-true-validator.mjs` (CI authoritative). `VerificationService` reads from audit-engine-v2.

**Honest gap:** GDIS cannot read actual policy SQL (`USING (true)`) from db-intel — only the boolean `public` flag. Whether "service-role-scoped" means the flag is a false positive cannot be determined without reading the actual policy SQL (requires live DB or migration file analysis).

---

### 11.2 Auth Guard Drift

**Artifact field(s):**
- `graphify-out/audit-engine-v2.json` → `findings[id="A-AUTH"].count` (32 routes missing auth guard)
- `summary.authCoverage` ("55/87")

**Detection rule:** 87 routes audited; 32 have no detected auth guard → auth drift candidates.

**Reuse point:** `dev-auth-bypass-validator.mjs`, `identity-sole-issuer-validator.mjs`. Audit finding A-AUTH pre-computed.

**Honest gap:** Auth guard detection is heuristic (pattern matching on route code) — the 32 are CANDIDATES. Some may have auth at middleware level not detectable at route level.

---

### 11.3 Tenant Isolation Drift

**Artifact field(s):**
- `graphify-out/db-intel.json` → `policies[].usesSiteId`, `tables[].hasSiteId`, `tables[].tenant`
- `graphify-out/audit-engine-v2.json` → `findings[id="A-RLS"].count` (20)

**Detection rule:** `tenant = true AND (rls = false OR policies[].usesSiteId = false for all policies)` → tenant isolation gap. `tenant-isolation-validator.mjs` enforces.

**Reuse point:** `tenant-isolation-validator.mjs`, `rls-force-coverage-validator.mjs`.

**Honest gap:** 149 policies have `usesSiteId = true`; 509 do not — but many of the 509 are service-role/trigger/function policies for which `site_id` scoping is not applicable. Cannot distinguish from artifact alone.

---

### 11.4 Cross-Tenant Data Leakage Drift

**Artifact field(s):**
- `graphify-out/relationship-intel.json` → `edges[]` (705 FK edges, `from`, `to`, `columns[]`)
- `graphify-out/db-intel.json` → `tables[].hasSiteId`, `tables[].tenant`

**Detection rule:** A FK edge where `from.tenant = true` and `to.hasSiteId = false` AND `to.tenant = false` → potential cross-tenant join without tenant scope. Requires graph traversal over FK edges.

**Reuse point:** `BlastRadiusService` uses relationship-intel for FK traversal. GDIS computes the tenant-scope check.

**Honest gap:** Cross-tenant JOIN leakage requires both static (FK shape) AND runtime (query analysis) — static alone gives candidates only.

---

### 11.5 Issuer Separation Drift

**Artifact field(s):**
- `graphify-out/domain-intel.json` → `domains[key="authentication"].secrets[]`, `domains[key="identity"].secrets[]`
- `graphify-out/infra-intel.json` → `secrets[]` (`CUSTOMER_SESSION_SECRET`, `LETBUYY_IDENTITY_PUBLIC_JWKS`)

**Detection rule:** Both `CUSTOMER_SESSION_SECRET` (HS256, customer issuer) and `LETBUYY_IDENTITY_PUBLIC_JWKS` (ES256, merchant issuer) must be present and must NOT appear together in the same domain's worker bindings. `identity-sole-issuer-validator.mjs`, `token-source-single-validator.mjs`, `cookie-realm-validator.mjs` enforce this.

**Reuse point:** Named validators enforce. GDIS surfaces presence/absence from infra-intel.secrets.

**Honest gap:** Whether the actual JWT verification code uses the correct key per issuer NOT COMPUTABLE from artifacts — requires code analysis or live test.

---

### 11.6 Step-Up Auth Drift

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `secrets[]` (`STEP_UP_SIGNING_SECRET`)
- `graphify-out/domain-intel.json` → `domains[key="payments"].secrets[]`, `domains[key="refunds"].secrets[]`

**Detection rule:** Refund/payout routes must have `STEP_UP_SIGNING_SECRET` in scope. `stepup-crypto-validator.mjs` enforces.

**Reuse point:** `stepup-crypto-validator.mjs`. GDIS surfaces presence from domain secrets lists.

**Honest gap:** Whether step-up enforcement is actually applied at the route handler level NOT COMPUTABLE from artifact shape alone.

---

## Part 12: Compliance Rules R001–R008

R001–R008 are GDIS-defined rule identifiers. They do not currently exist in the codebase. Based on the constitutional principles and existing validators, GDIS assigns them as follows:

### R001 — Canonical Ledger Integrity

**Semantic:** Money mutations MUST go through SECURITY DEFINER Postgres RPCs. No `.from(money_table).insert/update` in TypeScript.

**Artifact field(s):**
- `graphify-out/db-intel.json` → `functions[].money`, `functions[].securityDefiner`
- `graphify-out/audit-engine-v2.json` → hardViolations count (must = 0)

**Detection rule:** Any function with `money = true AND securityDefiner = false` is an R001 candidate violation. `canonical-ledger-only-validator.mjs` is the authoritative enforcement gate.

**Reuse point:** `canonical-ledger-only-validator.mjs` (CI gate). GDIS reads result from audit-engine-v2 `hardViolations`.

**Detectable:** YES (partially — heuristic on db-intel; validator is authoritative)

---

### R002 — RLS Non-Negotiable on Tenant Tables

**Semantic:** Every tenant-scoped table MUST have RLS enabled. Public `USING (true)` policies on tenant tables are forbidden.

**Artifact field(s):**
- `graphify-out/db-intel.json` → `tables[].rls`, `tables[].tenant`, `policies[].public`, `policies[].usesSiteId`

**Detection rule:** `tenant = true AND rls = false` → R002 candidate. `no-public-using-true-validator.mjs`, `rls-force-coverage-validator.mjs` are authoritative.

**Reuse point:** Same validators. Audit finding A-RLS count provides the pre-computed number.

**Detectable:** YES (partially — public flag is heuristic; validator authoritative)

---

### R003 — Idempotency on Money RPCs

**Semantic:** Every money RPC MUST have `idempotency_key` + `ON CONFLICT` + `FOR UPDATE`.

**Artifact field(s):**
- `graphify-out/db-intel.json` → `functions[].money`, `functions[].hasIdempotency`, `functions[].forUpdate`

**Detection rule:** `money = true AND (hasIdempotency = false OR forUpdate = false)` → R003 candidate.

**Reuse point:** No dedicated validator; `canonical-ledger-only-validator.mjs` covers some of this. GDIS is the first to formalize R003 as a named rule.

**Detectable:** YES (structural from db-intel fields)

---

### R004 — Two-Issuer Separation

**Semantic:** Customer tokens MUST be HS256 (`CUSTOMER_SESSION_SECRET`); merchant tokens MUST be ES256 (`LETBUYY_IDENTITY_PUBLIC_JWKS`). These must never be confused.

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `secrets[]` (both secrets present)
- `graphify-out/domain-intel.json` → `domains[].secrets[]` per domain

**Detection rule:** Both secrets present in infra-intel. Neither secret must appear in a domain where the other issuer is the expected identity context. `identity-sole-issuer-validator.mjs`, `session-security-validator.mjs` enforce.

**Reuse point:** Named validators.

**Detectable:** PARTIAL (presence is detectable; correct usage at code level is NOT COMPUTABLE from artifacts)

---

### R005 — No-Custody Money Rail

**Semantic:** LetBuyy must never implement a self-custody disbursement rail. All money-out must go through Razorpay Route / Cashfree as a licensed PA.

**Artifact field(s):**
- `graphify-out/infra-intel.json` → `secrets[]` (no self-custody keys present)
- `graphify-out/domain-intel.json` → `domains[key="payouts"].rpcs[]`
- `scripts/validators/no-self-custody-rail-validator.mjs` (CI gate)

**Detection rule:** Absence of any self-custody payment processing code (detected by `no-self-custody-rail-validator.mjs`). GDIS surfaces: validator green = compliant.

**Reuse point:** `no-self-custody-rail-validator.mjs`.

**Detectable:** YES (validator authoritative; artifact provides supporting evidence via absence of self-custody secrets)

---

### R006 — Fail-Closed Tenancy

**Semantic:** Tenant context failure must yield zero rows, not all rows. An unset or wrong tenant context is a hard fail.

**Artifact field(s):**
- `graphify-out/db-intel.json` → `tables[].force`, `tables[].tenant`, `policies[].usesSiteId`
- `graphify-out/infra-intel.json` → `ownership[]`

**Detection rule:** Tables with `tenant = true AND force = false` are candidates for non-forced RLS — lower isolation guarantee. 47 tables have `force = true`; remaining tenant tables rely on RLS alone. `tenant-isolation-validator.mjs`, `fail-closed-internal-routes-validator.mjs` enforce.

**Reuse point:** `tenant-isolation-validator.mjs`.

**Detectable:** PARTIAL (force=true vs false is detectable; whether FORCE actually prevents all cross-tenant access requires live query testing)

---

### R007 — Single Source of Truth per Domain

**Semantic:** For every domain there is exactly one canonical system. No parallel systems (two ledgers, two renderers, two auth stacks).

**Artifact field(s):**
- `graphify-out/domain-intel.json` → `domains[].apps[]` (should reference only canonical app per domain)
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` (prose registry)

**Detection rule:** If a domain's `apps[]` contains more than one app serving the same function, or if `discovery-v2.drift.architecture.count > 0` → R007 violation. `one-system-per-domain-validator.mjs` enforces.

**Reuse point:** `VerificationService.verifyServices()`, `one-system-per-domain-validator.mjs`.

**Detectable:** PARTIAL (can detect multiple apps per domain; cannot detect semantic duplication within a single app without code analysis)

---

### R008 — Mock-by-Default, Honest-Always

**Semantic:** Every external dependency must have a provider-mode honesty badge (mock/sandbox/live). A stub must never return `success` for a money operation.

**Artifact field(s):**
- `graphify-out/domain-intel.json` → `domains[].secrets[]` (presence of provider keys implies live mode)
- `graphify-out/connections-intel.json` (CONNECTED/NOT CONNECTED per adapter)
- `scripts/validators/provider-mode-badge-validator.mjs`, `provider-evidence-validator.mjs`, `provider-isolation-validator.mjs`

**Detection rule:** Any money domain with `PAYMENT_CONFIG_ENCRYPTION_KEY` in secrets → live provider mode; honesty badge must be present. `provider-mode-badge-validator.mjs` enforces.

**Reuse point:** Named validators. `connections-intel.json` provides current adapter status.

**Detectable:** PARTIAL (secret presence detectable; whether badge is rendered to the UI NOT COMPUTABLE from artifacts alone)

---

## Part 13: Readiness Factors

### 13.1 Owner (per domain)

**Artifact field(s):** `domain-intel.domains[].owners[]`  
**Detection rule:** `owners.length = 0` → missing owner  
**Detectable:** YES  
**Reuse:** `VerificationService.verifyDomains()` (A-OWN finding)

---

### 13.2 Runbook (per domain)

**Artifact field(s):** `runbooks.runbooks[domain]` key presence  
**Detection rule:** domain key absent from runbooks object → missing runbook  
**Detectable:** YES (presence); quality requires content check  
**Reuse:** None existing — GDIS first

---

### 13.3 Tests (per domain/entity)

**Artifact field(s):** `graph.json` nodes (source_file regex) + `domain-intel.domains[].{routes,rpcs,tables}`  
**Detection rule:** TestingIntelligenceService.detectMissingCoverage() per domain  
**Detectable:** PARTIAL (existence of test files referencing domain entities; not pass/fail)  
**Reuse:** `TestingIntelligenceService`

---

### 13.4 Rollback (per domain / migration)

**Artifact field(s):** No artifact exposes per-migration rollback presence  
**Detection rule:** NOT COMPUTABLE from current artifacts  
**Detectable:** NO (structural only from `rollback-integrity-validator.mjs` gate result)  
**Reuse:** Validator gate is authoritative; GDIS must note NOT COMPUTABLE

---

### 13.5 Coverage (validator gate)

**Artifact field(s):** `audit-engine-v2.json` → `summary.hardViolations`, `summary.routesAudited`, `summary.authCoverage`, `summary.validationCoverage`  
**Detection rule:** `hardViolations > 0` → coverage breach; `authCoverage < "87/87"` → auth gap  
**Detectable:** YES  
**Reuse:** `VerificationService.verifyArchitecture()`

---

### 13.6 Docs (per domain)

**Artifact field(s):** `memory-intel.json` → `sources[]` (41 files indexed); filesystem `docs/`  
**Detection rule:** Domain key not appearing in any source file name → docs gap candidate  
**Detectable:** PARTIAL (presence only; freshness NOT COMPUTABLE)  
**Reuse:** `repository-intelligence-validator.mjs`

---

### 13.7 Health-Check (per worker/service)

**Artifact field(s):** `infra-intel.workers[].bindings[]` (RUNTIME_TELEMETRY present on all 4)  
**Detection rule:** `RUNTIME_TELEMETRY` absent from worker bindings → health-check gap  
**Detectable:** PARTIAL (binding presence; actual health endpoint existence NOT COMPUTABLE without live probe)  
**Reuse:** `connections-intel.json` (NOT CONNECTED for all live adapters currently)

---

### 13.8 Monitoring (per domain)

**Artifact field(s):** `runtime-intel.telemetry` (4 adapter entries); `connections-intel.json`  
**Detection rule:** All telemetry sources are NOT CONNECTED currently  
**Detectable:** NO (structural topology mapped; actual metric ingestion NOT CONNECTED)  
**Reuse:** `lcis-live/LivePlatform.health()`; `connections-intel.json`

---

### 13.9 Alerts (per domain)

**Artifact field(s):** None. No alert rule files exist in repo.  
**Detection rule:** NOT COMPUTABLE  
**Detectable:** NO  
**Reuse:** None

---

### 13.10 Security (per domain)

**Artifact field(s):** `audit-engine-v2.json` → A-AUTH, A-RLS, A-RATE, A-VALID findings; `discovery-v2.drift.security`; `db-intel.policies[].public`  
**Detection rule:** Any finding count > 0 for money domain → elevated security risk  
**Detectable:** PARTIAL (heuristic findings; validator gate authoritative)  
**Reuse:** `VerificationService` reads from audit-engine-v2
