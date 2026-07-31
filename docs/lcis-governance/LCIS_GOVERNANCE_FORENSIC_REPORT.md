# LCIS Governance Forensic Report
## GDIS Phase 5 — Agent 01 (Forensics)

> Status: READ-ONLY discovery. No code was written or modified.  
> Ground truth: `graphify-out/*.json` artifacts verified directly via `node -e`.  
> Generated: 2026-06-20

---

## 1. Database Layer Inventory

Source: `graphify-out/db-intel.json`

### Tables (417 total)

| Property | Count | Notes |
|----------|-------|-------|
| Total tables | 417 | |
| `rls = true` | 397 | RLS enabled |
| `rls = false` | 20 | CANDIDATE missing RLS (confirmed by A-RLS audit finding; validator-authoritative) |
| `rls = null` | 0 | No nulls; field always set |
| `force = true` | 47 | `FORCE ROW LEVEL SECURITY` applied (not the same as rls=true — these are strict) |
| `hasSiteId = true` | 184 | Has a `site_id` FK column |
| `hasStoreId = true` | 84 | Has a `store_id` FK column |
| `money = true` | 18 | Marked as money-handling tables |
| `tenant = true` | 256 | Marked as tenant-scoped tables |

**Key observation:** 20 tables have `rls = false` — these appear in the security drift signal (`discovery-v2.drift.rls: count=20`, detail: "candidates — service-role/ledger tables"). The 107-validator gate is authoritative; zero hard violations confirmed.

**Top-level fields available per table:** `name`, `createdIn`, `columns`, `hasSiteId`, `hasStoreId`, `rls`, `force`, `policies[]`, `triggers[]`, `indexes`, `money`, `tenant`

### Functions / RPCs (164 total)

| Property | Count | Notes |
|----------|-------|-------|
| Total functions | 164 | |
| `securityDefiner = true` | 136 | SECURITY DEFINER (83%) |
| `money = true` | 34 | Money-touching RPCs |
| `hasIdempotency = true` | 40 | Have idempotency key patterns |
| `forUpdate = true` | 42 | Use `FOR UPDATE` locking |

**Money RPCs (34):** `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`, `post_ledger_transaction`, `enforce_ledger_transaction_balance`, `ledger_account_balance_minor`, `refresh_money_ledger_site_reconciliation`, `claim_payout_statement_release`, `reconcile_cod_remittance_with_ledger`, `gift_card_available_balance`, `gift_card_transactions`, plus 20 more (full list in artifact).

**Structural gap — dead RPCs:** Audit finding A-DEAD-RPC counts 75 security-definer RPCs with zero detected callers via the gateway. These are CANDIDATES (mostly trigger/internal functions); the validator gate is authoritative.

**Top-level fields available per function:** `name`, `definedIn`, `securityDefiner`, `args`, `touches[]`, `hasIdempotency`, `forUpdate`, `money`, `callers[]`

**Additional maps in db-intel:** `routeRpc` (23 routes → RPCs), `rpcCallers` (59 RPC → caller entries), `routeTables` (23 route → table mappings)

### Policies (658 total)

| Property | Count | Notes |
|----------|-------|-------|
| Total policies | 658 | |
| `public = true` | 34 | Public `USING (true)` policies — security drift signal; all are service-role-scoped per discovery |
| `serviceRole = true` | 279 | Service-role policies |
| `usesSiteId = true` | 149 | Tenant-scoped via `site_id` |
| Not usesSiteId | 509 | May be service-role, trigger, or function-scoped |

**Top-level fields available per policy:** `name`, `table`, `public`, `usesSiteId`, `serviceRole`

**NOT present per policy:** policy command (SELECT/INSERT/UPDATE/DELETE), check expression, permissive/restrictive flag — these are not in the artifact.

### Triggers (398 total)

Available fields per trigger: implied by table-level `triggers[]` array in db-intel. Full per-trigger detail (function called, timing, events) NOT enumerated in db-intel top-level — only accessible via table.triggers[].

### FK Relationships

Source: `graphify-out/relationship-intel.json`

- FK edges: **705**
- Tables with FK data: **367**
- Tenant root: `sites` table (FK target for `site_id`)
- Field per edge: `from`, `to`, `columns[]`

---

## 2. Domain Layer Inventory

Source: `graphify-out/domain-intel.json`

### Domains (22 total)

All 22 domains have `owners: ["@saai-sidd"]` — **0 ownerless domains** (confirmed by A-OWN finding count=0).

All 22 domains have `tenant = true`.

**Money domains (8):** `payments`, `orders`, `inventory`, `shipping`, `gift-cards`, `refunds`, `payouts`, `operations`

**Domain summary table:**

| Domain | Routes | RPCs | Tables | Queues | Money | Workers |
|--------|--------|------|--------|--------|-------|---------|
| themes | 1 | 4 | 32 | 2 | false | 2 |
| marketplace | 14 | 4 | 46 | 1 | false | 2 |
| developer | 3 | 0 | 4 | 1 | false | 2 |
| gift-cards | 2 | 7 | 5 | 1 | true | 2 |
| refunds | 1 | 2 | 7 | 1 | true | 2 |
| payouts | 4 | 5 | 10 | 1 | true | 2 |
| payments | 3 | 18 | 11 | 1 | true | 3 |
| gst | 1 | 1 | 6 | 1 | false | 2 |
| discounts | 2 | 2 | 11 | 1 | false | 2 |
| shipping | 3 | 1 | 10 | 1 | true | 2 |
| inventory | 1 | 18 | 9 | 1 | true | 2 |
| collections | 1 | 0 | 4 | 2 | false | 2 |
| products | 2 | 5 | 10 | 2 | false | 2 |
| orders | 3 | 12 | 10 | 2 | true | 2 |
| storefront | 14 | 4 | 21 | 3 | false | 2 |
| authorization | 2 | 2 | 9 | 1 | false | 2 |
| authentication | 1 | 2 | 10 | 1 | false | 2 |
| identity | 2 | 1 | 8 | 1 | false | 2 |
| merchant | 5 | 9 | 22 | 1 | false | 2 |
| notifications | 3 | 6 | 15 | 2 | false | 2 |
| analytics | 4 | 14 | 36 | 2 | false | 2 |
| operations | 12 | 20 | 34 | 1 | true | 2 |

**Cross-domain edges:** 49

**Orphaned domains (0 cross-domain edges, per discovery-v2):** `developer`, `gst`, `collections`, `discounts` — 4 domains

**Fields available per domain:** `key`, `label`, `money`, `tenant`, `routes[]`, `rpcs[]`, `tables[]`, `queues[]`, `apps[]`, `workers[]`, `secrets[]`, `owners[]`, `workflows[]`, `counts{routes,rpcs,tables,policies,triggers,indexes}`, `dependsOn[]`, `consumedBy[]`

**NOT present per domain in this artifact:** test file list, runbook presence flag, rollback script presence, docs coverage, monitoring/alert config, health-check endpoint.

---

## 3. Infrastructure Inventory

Source: `graphify-out/infra-intel.json`

### Workers (4)

| Worker | Crons | Queue Producers | Queue Consumers | R2 | Key Bindings |
|--------|-------|-----------------|-----------------|-----|-------------|
| `letbuyy-api` | 0 | 5 | 0 | 1 | EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE, R2_BUCKET, CACHE, HYPERDRIVE, RUNTIME_DB, WEBHOOK_SERVICE, RUNTIME_TELEMETRY |
| `letbuyy-queue-workers` | 1 | 0 | 7 | 0 | API_GATEWAY_SERVICE, RUNTIME_TELEMETRY |
| `letbuyy-webhook` | 0 | 0 | 0 | 0 | API_GATEWAY_SERVICE, RUNTIME_TELEMETRY |
| `letbuyy-mobile-bff` | 0 | 0 | 0 | 0 | API_GATEWAY_SERVICE, RUNTIME_TELEMETRY |

### Queues (5 — from runtime-intel queueGraph edges)

| Queue | Producer | Consumers |
|-------|----------|-----------|
| EVENT_QUEUE | letbuyy-api | letbuyy-queue-workers |
| ANALYTICS_QUEUE | letbuyy-api | letbuyy-queue-workers |
| SEARCH_QUEUE | letbuyy-api | letbuyy-queue-workers |
| NOTIFICATION_QUEUE | letbuyy-api | letbuyy-queue-workers |
| RUNTIME_QUEUE | letbuyy-api | letbuyy-queue-workers |

**Unused queues (candidate):** 1 (per autonomous-discovery-v5 summary)

### Secrets (19)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `CSRF_SECRET`, `CUSTOMER_SESSION_SECRET`, `STEP_UP_SIGNING_SECRET`, `LETBUYY_IDENTITY_PUBLIC_JWKS`, `CHECKOUT_SIGNING_SECRET`, `TURNSTILE_SECRET_KEY`, `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `INTERNAL_API_KEYRING`, `QUEUE_TENANT_ENVELOPE_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `PAYMENT_CONFIG_ENCRYPTION_KEY`

**Unused secrets (candidate):** 0 (all flagged as platform-wide, used by every domain)

### Ownership

- CODEOWNERS entries: **35 lines** (26 non-comment entries mapping paths → `@saai-sidd`)
- infra-intel ownership entries: **26** — all paths covered, single owner `@saai-sidd`
- Coverage: **100% structural** (wildcard `* @saai-sidd` catches all paths)
- Gap: single-owner — no team-level CODEOWNERS split exists; no GitHub team (`@letbuyy/payments`, etc.) — only individual owner

---

## 4. Runbooks Inventory

Source: `graphify-out/runbooks.json`

- Runbooks: **22** (one per domain, keyed by domain name)
- Structure per runbook: `domain`, `label`, `detection{signals[], source}`, `diagnosis`, `recovery`, `rollback`, `verification`
- All 22 runbooks present; all have `detection.signals` array + escalation chain
- **Live signal honesty:** detection signals explicitly state `(NOT CONNECTED)` for telemetry (e.g., "error rate / latency on letbuyy-api (RUNTIME_TELEMETRY)") — structural topology is CONNECTED, live values are NOT CONNECTED

**NOT computable from this artifact:** whether a runbook has been executed/rehearsed in production, last-tested date, escalation chain SLAs.

---

## 5. Test Coverage Inventory

Source: filesystem (`find tests/`)

### Test File Counts

| Directory | Files |
|-----------|-------|
| `tests/executable/` | 21 `.mjs` files (postgres integration tests) |
| `tests/migrations/` | 6 `.mjs` files |
| `tests/launch/` | ~20 `lb*.test.mjs` files |
| `tests/contracts/` | 20+ `.ts` files |
| `tests/gst/` | 1 |
| `tests/security/` | 1+ |
| `tests/governance/`, `tests/ci/`, `tests/e2e/`, `tests/identity-foundation/`, `tests/localization/`, `tests/logistics/`, `tests/federation/`, `tests/feature-flags/`, `tests/api-graphql/`, `tests/app-platform/`, `tests/auth/`, `tests/billing/`, `tests/cloudflare/`, `tests/dependency/`, `tests/helpers/` | Additional dirs |
| **Total test files** | **238** |

### Domain → Test Coverage

**NOT directly computable from any graphify artifact.** No artifact maps domain keys to which test files cover them. The `TestingIntelligenceService` (`packages/lcis-execution/src/testing/`) uses `graph.json` node search + regex `/(test|spec)\.[tj]sx?$|\/tests?\//i` to infer coverage gaps, but only for a given change request's blast radius — it does NOT produce a domain → coverage matrix at rest.

**What IS computable:** per-RPC/route/table coverage for a specified change (blast-radius-driven). What is NOT: whole-domain coverage at rest.

---

## 6. Governance Files Inventory

### Validators (112 `.mjs` files)

Source: `scripts/validators/` (README + ls)

Categories inferred from filenames:

| Category | Count (estimated) | Examples |
|----------|------------------|---------|
| Security | ~14 | `canonical-ledger-only`, `no-public-using-true`, `rls-force-coverage`, `session-security`, `no-blanket-service-role`, `stepup-crypto`, `single-source-crypto`, `no-self-custody-rail`, `cookie-realm`, `committed-secret-placeholder`, `dev-auth-bypass`, `identity-sole-issuer`, `secret-topology`, `fail-closed-internal-routes` |
| Architecture/topology | ~18 | `architecture`, `topology-drift`, `runtime-topology`, `runtime-manifest`, `runtime-validator`, `cloudflare-topology`, `domain-boundary`, `deploy-matrix-topology`, `deployment-lineage`, `one-system-per-domain`, `manifest-lineage`, `deployment-lineage`, `deployment-safety`, `rollback-integrity`, `frozen-path-override-gate`, `reserved-subdomain-single-source`, `marketplace-single-source`, `no-reserved-service-activation` |
| Money/payments | ~6 | `canonical-ledger-only`, `commission-bps-zero`, `no-self-custody-rail`, `source-ledger-residue`, `provider-isolation`, `provider-evidence` |
| Testing/coverage | ~2 | `test-coverage-governance`, `no-noop-test-script` |
| Dead code / drift | ~5 | `dead-residue`, `dart-dead-source`, `typescript-dead-source`, `marketing-dead-twin`, `settings-apps-dead-twin` |
| Dependencies | ~6 | `dependency-graph`, `dependency-manifest`, `circular-import`, `undeclared-import`, `supply-chain`, `no-rejected-package-imports` |
| Tenancy/RLS | ~4 | `tenant-isolation`, `rls-force-coverage`, `no-public-using-true`, `no-blanket-service-role` |
| Migration | ~4 | `sequential-migration`, `migration-safety`, `rollback-integrity`, `stale-artifact` |
| Operational | ~8 | `operational-lifecycle`, `production-readiness`, `production-safety`, `queue-topology`, `environment-validator`, `env-isolation`, `environment-honesty`, `workspace-lifecycle` |
| Theme | ~3 | `theme-governance`, `theme-editor-dead-shell`, `no-new-react-sections` |
| Formatting/standards | ~10 | `inr-currency-format`, `date-format`, `mobile-token`, `design-system`, `route-line-count`, `package-export`, `package-ownership`, `typescript-governance`, `import-validator`, `api-client-runtime-base` |
| Governance meta | ~6 | `whole-repo-end-state`, `generated-artifact`, `repository-intelligence`, `tooling-governance`, `meta-no-theater`, `foundation-antifabrication-gate` |
| Other | remaining | |

**Total confirmed: 112 `.mjs` validators** (README references 107; current filesystem count is 112 — 5 net additions since that reference was written)

### Migrations (103)

Source: `graphify-out/memory-intel.json`

| Type | Count |
|------|-------|
| `migration` (general DDL) | 70 |
| `payment` | 11 |
| `security` | 10 |
| `theme` | 3 |
| `payout` | 3 |
| `storefront` | 4 |
| `refund` | 2 |

Range: `000_baseline.sql` → `174_v1_gift_card_refund_restore.sql` (gaps exist in numbering; sequential-migration-validator governs ordering)

Decisions tracked: **180** (across 41 sources); byType: governance=66, security=34, payment=49, refund=4, payout=3, architecture=4, theme=7, storefront=2, migration=11

### Governance Document Files

| File | Purpose |
|------|---------|
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | Supreme law (DOC 01) |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md` | Operating rulebook (DOC 02) |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` | One-system-per-domain registry |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md` | Architecture scorecard |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md` | Foundation roadmap |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` | Legacy elimination |
| `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md` | UI/UX governance |
| `GOVERNANCE_REWRITE_2026_06_10/000_GOVERNANCE_INDEX.md` | Governance index |
| `AGENTS.md` | Root operating manual |
| `CLAUDE.md` | AI operating context |
| `.github/CODEOWNERS` | 35 lines, single owner |
| `scripts/validate-governance.mjs` | Master gate (runs 112 validators) |

---

## 7. Production Readiness Inventory

Source: `graphify-out/production-readiness-v2.json`

### Dimensions (10)

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Architecture | 100 | 107/107 validators; full code+db+domain graph |
| Infrastructure | 100 | 4 workers, R2/Hyperdrive, queues+DLQ |
| Security | 90 | 651 policies, 5 deterministic validators, 11 controls |
| Merchant | 100 | health/risk/growth/adoption/churn models complete (scores query-bound) |
| Customer | 100 | 8 customer graphs modeled (rates query-bound) |
| Revenue | 100 | 8 revenue models incl gift-card liability (amounts query-bound) |
| Telemetry | 90 | adapter architecture complete; live ingestion NOT CONNECTED |
| Operations | 100 | incident-response + rollback + runbooks |
| Deployment | 100 | migrate gate + rollback; single pipeline SPOF documented |
| Cost | 100 | pricing model + dependency graph (usage query-bound) |

### Systems (18)

All 18 systems present. Notable:
- `infra:security`: score=90, evidence includes "20 tenant tables w/o detected RLS (candidate)"
- `payments`: score=88, evidence includes "4 tenant tables w/o detected RLS (candidate, validator-authoritative)"
- `shipping`: score=92, blockers=1
- `gst`: score=89, blockers=1
- `merchant`: score=88, blockers=0

---

## 8. Drift Signals Inventory

Source: `graphify-out/discovery-v2.json`

| Drift Category | Signal | Count | Authority |
|---------------|--------|-------|-----------|
| architecture | deprecated app aliases in active topology | 0 | validator confirmed (0 violations) |
| security | public USING(true) policies | 34 | candidates (service-role-scoped); no-public-using-true validator is authoritative |
| ownership | domains/files without CODEOWNERS owner | 0 | all owned (@saai-sidd + 26 paths) |
| domain | unclassified routes + tables | 90 | 4 routes (ai/media/resume/upload) + 86 tables |
| route | unclassified gateway routes | 4 | ai, media, resume, upload |
| rpc | SECURITY DEFINER RPCs uncalled via gateway | 75 | candidates (mostly trigger/internal) |
| rls | tenant tables without detected RLS | 20 | candidates — service-role/ledger tables; validator-authoritative |
| deployment | missing rollback / migrate gate off | 0 | rollback present; gate on |
| dependency | orphaned domains (no cross-domain edges) | 4 | developer, gst, collections, discounts |

**Total drift candidates: 227** (per summary). **Hard drift (validator-confirmed): 0.**

Source: `graphify-out/autonomous-discovery-v5.json`

| Candidate Type | Count |
|----------------|-------|
| Dead RPCs | 75 |
| Dead routes | 4 |
| Dead tables | 44 |
| Unused queues | 1 |
| Unused workers | 0 |
| Unused secrets | 0 |
| Orphaned domains | 4 |

---

## 9. LCIS Packages Reuse Inventory

### `packages/lcis-core/src/`

| Service | Location | What it does |
|---------|----------|-------------|
| `ArtifactStore` | `runtime/ArtifactStore.ts` | Loads + caches `graphify-out/*.json`; `read<T>(name)`, `tryRead<T>(name)`, `has(name)` |
| `BlastRadiusService` | `blast-radius/BlastRadiusService.ts` | blast/deps/consumers/cross-domain/impact over code graph + domain/db/FK artifacts |
| `VerificationService` | `verification/VerificationService.ts` | `verifyArchitecture()`, `verifyDomains()`, `verifyServices()`, `verifyProductionReadiness()` — evidence-weighted VERIFIED/PARTIAL/UNVERIFIED/REFUTED |
| `ArchitectureService` | `architecture/ArchitectureService.ts` | Architecture checks over artifacts |
| `GraphService` | `graph/` | 52,246-node code graph search/traversal |
| Evidence/contracts | `contracts/` | `evidence()`, `notConnected()`, `Gap`, `Verification` types |

**verifyArchitecture:** reads audit-engine-v2 + production-readiness-v2; checks `hardViolations === 0`

**verifyDomains:** reads domain-intel + db-intel + audit-engine-v2; checks A-OWN (ownerless domains) + table membership

**verifyServices:** reads infra-intel + domain-intel; checks deprecated alias absence + worker presence

**verifyProductionReadiness:** reads production-readiness-v2; checks per-system scores + blockers

### `packages/lcis-execution/src/`

| Service | Location | What it does |
|---------|----------|-------------|
| `TestingIntelligenceService` | `testing/TestingIntelligenceService.ts` | blast-radius-driven test detection + missing coverage gap detection per change request |
| `LaunchIntelligenceService` | `launch/LaunchIntelligenceService.ts` | Launch readiness synthesis |
| `VerificationPlanner` | `launch/VerificationPlanner.ts` | Verification planning |
| `ChangeAnalyzer` | `shared/` | Change analysis + affected set |

**TestingIntelligenceService gap:** detects missing coverage for a specific change request's blast radius. Does NOT produce a static domain → test coverage matrix.

### `packages/lcis-live/src/`

| Service | Location | What it does |
|---------|----------|-------------|
| `LivePlatform` | `platform.ts` | Health/status aggregation over live adapters |
| Adapters | `factory.ts` | Supabase, GitHub, Cloudflare, Vercel adapters — read-only |

**SupabaseAdapter static equivalent needed by GDIS:** lcis-live does live schema-drift / missing-RLS detection against the actual Supabase instance (when CONNECTED). GDIS performs the STATIC equivalent from `db-intel.json` fields (`rls`, `force`, `policies`, `hasSiteId`, `usesSiteId`) — no duplication needed, different data source.

---

## 10. R001-R008 Status

R001–R008 are **GDIS-defined compliance rule identifiers that do not yet exist** in the codebase. No file in `scripts/validators/`, `GOVERNANCE_REWRITE_2026_06_10/`, `AGENTS.md`, or `packages/lcis-core/` references R001–R008. They are to be defined and implemented by GDIS as part of Phase 5. The existing validators provide the enforcement substrate for what these rules will codify; the GDIS Capability Map document maps each R-rule to its enforcement substrate.

---

## 11. Honest Gaps — What Is NOT Computable from Structural Data

The following properties CANNOT be determined from `graphify-out/*.json` + repo structure alone:

| Gap | Reason |
|-----|--------|
| Migration rollback presence | No artifact field; `rollback-integrity-validator.mjs` enforces contract statically but artifact does not expose per-migration rollback script path |
| Alert/monitoring config existence | RUNTIME_TELEMETRY binding declared but NOT CONNECTED; no alert rule files in repo |
| Health-check endpoint presence | Not modeled in any artifact; requires route-level annotation or live probe |
| Test execution pass/fail results | Only test file existence is detectable; execution requires runtime |
| Domain → test file coverage matrix (static) | TestingIntelligenceService is change-request-driven, not at-rest matrix |
| Policy check expressions / command | `db-intel.json` policies only have: `name`, `table`, `public`, `usesSiteId`, `serviceRole` — no SQL text |
| Trigger function called / timing / events | db-intel triggers are arrays per table but full trigger detail is not in top-level structure |
| Runbook last-rehearsed / executed date | Runbooks are generated from graph; no execution record exists |
| Live metric values (error rates, latency) | NOT CONNECTED — RUNTIME_TELEMETRY adapter not wired |
| Docs freshness / staleness | No docs-last-modified vs code-last-modified mapping in any artifact |
| Per-developer ownership granularity | CODEOWNERS has only `@saai-sidd`; no GitHub team splits |
| Commission/fee configuration live values | `commission-bps-zero-validator.mjs` checks statically but live payment config is encrypted |
| GST invoice immutability enforcement | Enforced by RPC pattern + validator; not exposed as an artifact field |
