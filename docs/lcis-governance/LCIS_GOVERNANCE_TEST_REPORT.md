# LCIS GDIS Phase 5 — Test Report

> Generated: 2026-06-20
> All test counts are from an authoritative run of `pnpm -r test` across all 9 LCIS packages.

---

## 1. Overall result

```
1459 tests pass / 0 fail / 0 skip
Typecheck: clean (tsc --noEmit, all 9 packages)
```

---

## 2. Per-package breakdown

| Package | Tests | Notes |
|---|---|---|
| `@letbuyy/lcis-core` | 140 | Graph, blast, verification, artifact store, evidence |
| `@letbuyy/lcis-adapters` | 172 | Supabase, GitHub, Cloudflare, Vercel live adapters |
| `@letbuyy/lcis-live` | 67 | Live platform, NOT_CONNECTED honesty |
| `@letbuyy/lcis-execution` | 265 | Plan engine, safety guard, audit chain |
| `@letbuyy/lcis-governance` | **301** | Phase-5 new package (see Section 3) |
| `@letbuyy/lcis-cli` | 109 | CLI commands, governance commands tested here |
| `services/lcis-api` | 127 | HTTP routes including governance endpoints |
| `@letbuyy/lcis-mcp` | 115 | MCP tools including governance tools |
| `@letbuyy/lcis-pr-check` | 163 | PR analysis including governance verdicts |
| **Total** | **1459** | **0 fail** |

Phase-5 added approximately 407 new tests: 301 in the new `lcis-governance` package plus governance extensions exercised in `lcis-cli`, `lcis-api` / `services/lcis-api`, `lcis-mcp`, and `lcis-pr-check`.

---

## 3. `lcis-governance` suite breakdown (301 tests)

Tests live in `packages/lcis-governance/test/`. All run against REAL `graphify-out/` artifacts — no fixtures, no mocks, no TODOs.

### 3.1 Foundation (`foundation.test.ts`) — 93 lines, ~8 tests

What it asserts:
- `GovernanceArtifactStore` reads the real db-intel slices: >100 tables, >50 functions, >100 policies; at least one money table and one tenant table exist.
- Domains, workers, CODEOWNERS, and migrations are all readable from the store.
- The RLS field (`boolean`) is present on every table row — the R002 detection signal is structurally present.
- `GovernanceRuleRegistry` exposes exactly 8 rules (R001–R008); R002 severity is `critical`; `byCategory('security')` returns at least 1 rule.
- `SeverityScorer`: money entity → `critical`; tenant or public → `high`; `max()` order is correct.
- `ConfidenceCalculator`: 0 evidence → confidence=0; large evidence set is capped at 0.95.
- `FindingBuilder`: `stableId('table-drift', 'orders')` → `TABLE-DRIFT-orders` (deterministic uppercased format); finding carries confidence derived from evidence length.
- `governance()` envelope stamps evidence, confidence, deduplicated sources, and ISO-8601 timestamp.

### 3.2 Drift (`drift.test.ts`) — 439 lines, largest suite

What it asserts:

**detectTableDrift**: returns `Finding[]` with valid id/kind/subject/title/detail/evidence/confidence/severity/category; money orphan tables get `critical` severity; tables claimed by a domain do not appear in findings; IDs start with `TABLE-DRIFT-`.

**detectRPCDrift**: same structural assertions; money orphan RPCs get `critical`; IDs start with `RPC-DRIFT-`; determinism confirmed (two runs produce identical finding arrays).

**detectDomainDrift**: orphaned domains (no tables and no rpcs) appear as findings; claimed domains do not.

**detectWorkerDrift, detectQueueDrift, detectEventDrift**: each returns typed findings with correct `kind`; no IO/mutation in source.

**detectRunbookDrift, detectTestDrift, detectDocumentationDrift, detectMigrationDrift, detectValidatorDrift, detectOwnershipDrift, detectSecurityDrift**: each asserts finding shape and category.

**detectMigrationDrift UNKNOWN rollback**: explicitly asserts that the rollback finding has `severity: 'info'`, `confidence ≤ 0.35`, and `detail` containing the string `'UNKNOWN'`. This is the honesty contract for facts that cannot be determined from artifacts.

**generateDriftReport**: composite report carries `scope`, `findings`, `byKind`, `evidence`, `confidence`, `sources`, `timestamp`; is fully deterministic under a fixed clock (deep-equal across two calls with same `now`).

**Source-scan (read-only enforcement)**: `readFileSync` reads the compiled `src/drift/*.ts` source files and asserts that neither `fetch`, `writeFile`, `execSync`, `spawnSync`, nor any HTTP import appears. This is a per-suite static check that the service cannot perform IO or mutations.

### 3.3 Compliance (`compliance.test.ts`) — 452 lines

What it asserts:

**R001 (money RPCs must use canonical RPC)**: money RPCs that are `securityDefiner=true`, `hasIdempotency=true`, `forUpdate=true` pass; those missing any of these flags are violations; count consistency (checked = passed + violations).

**R002 (tenant tables must have RLS)**: tenant tables with `rls=true` pass; `rls=false` tenant tables are violations; each violation carries evidence pointing to `graphify-out/db-intel.json`; status reflects actual data (COMPLIANT when all pass).

**R003 (critical domains must have runbooks)**: money/tenant-critical domains without a matching runbook subject produce violations; domains with runbooks pass.

**R004 (public APIs must have tests)**: evaluated against real domain test-file patterns; UNKNOWN when no domains can be checked.

**R005 (critical services must have owners)**: money/tenant domains with `owners.length > 0` pass; ownerless critical domains produce high-severity violations.

**R006 PARTIAL contract**: status is always `'PARTIAL'`; evidence includes a `notConnected` item with ref `'migration.rollback'` and source `'graphify-out/memory-intel.json'`; violations array is empty (PARTIAL is not a violation, it is an honest gap).

**R008 PARTIAL contract**: status is always `'PARTIAL'`; evidence includes a `notConnected` item with ref `'worker.healthcheck.liveProbe'` and a NOT CONNECTED message citing `OTEL_EXPORTER_OTLP_ENDPOINT or CLOUDFLARE_ANALYTICS_DATASET`; violations array is empty.

**Score formula**: UNKNOWN rules excluded from denominator; PARTIAL rules are included; score is `round(COMPLIANT / (COMPLIANT + VIOLATED + PARTIAL) × 100)` and is always 0–100.

**generateComplianceReport composite**: carries all 8 evaluations; summary string contains counts; deterministic under fixed clock.

**Source-scan**: same pattern as drift — `src/compliance/*.ts` contains no fetch/writeFile/execSync.

### 3.4 Ownership (`ownership.test.ts`) — 429 lines

What it asserts:

**Domain coverage**: 22 domains are evaluated; all are owned per real CODEOWNERS + domain-intel data (`coverage.domain.coverage === 1.0`); no domain gaps emitted when all are owned.

**Worker/queue/rpc/table/runbook coverage**: per-entity-type coverage objects carry `total`, `owned`, `coverage` (0–1).

**Gap severity mapping**: `OwnedEntityType` maps to correct severity (domain → high, worker → medium, etc.).

**`gapsToFindings` in engine**: ownership gaps convert to `Finding[]` with category `'ownership'` and valid evidence.

**OwnershipReport provenance**: `evidence`, `confidence`, `sources`, `timestamp` all present; deterministic.

**Source-scan**: `src/ownership/*.ts` has no IO/mutation.

### 3.5 Security drift (`security.test.ts`) — 580 lines

What it asserts:

**Missing-RLS detection**: tenant tables with `rls=false` produce findings with `kind: 'missing-rls'` and `severity: 'critical'`; tables with `rls=true` do not appear.

**Public-USING detection**: policies with `public=true` produce findings with `kind: 'public-using-policy'`; evidence cites policy name and `db-intel.json`.

**JWT-drift detection**: functions that are money-touching and not `securityDefiner` produce JWT-drift candidates.

**Webhook-auth, step-up, cross-tenant candidates**: each detector returns typed findings with correct kind, category `'security'`, and evidence.

**Finding invariants**: every finding has `id`, `kind`, `severity`, `subject`, `title`, `detail`, `evidence` (length ≥ 0), `confidence` in [0,1], and category `'security'`.

**generateSecurityDriftReport**: `byKind` sums match `findings.length`; deterministic under fixed clock.

**Source-scan**: `src/security/*.ts` has no fetch/writeFile/execSync.

### 3.6 Readiness (`readiness.test.ts`) — 582 lines

What it asserts:

**Score range**: domain readiness score is always 0–100, always a whole integer.

**UNKNOWN factors — explicit assertions for each**:
- `monitoring` factor: `present === 'UNKNOWN'`, appears in `unknowns[]`
- `alerts` factor: `present === 'UNKNOWN'`, appears in `unknowns[]`
- `rollback` factor: `present === 'UNKNOWN'`, appears in `unknowns[]`
- `healthcheck` factor: `present === 'UNKNOWN'`, appears in `unknowns[]`

**UNKNOWN factors never pass**: score computed over KNOWN factors only; denominator = sum of KNOWN-factor weights; a domain with only UNKNOWN factors scores 0.

**Band thresholds**: ≥80 → `ready`; 50–79 → `conditional`; <50 → `not-ready`; fewer than 4 KNOWN → `unknown`.

**Money domain security factor**: domain with `money=true` tables has `security` factor evaluated against actual RLS + securityDefiner posture in artifacts.

**Owned domain owner factor**: domain with `owners.length > 0` in domain-intel has `owner` factor `present === true`.

**evaluateLaunchReadiness**: reuses `core.verification.verifyProductionReadiness()` (no reimplementation); result is a Verification object (async).

**generateReadinessReport composite**: `scores[]` covers all real domains; `overall` is mean of domain scores; deterministic under fixed clock.

**Source-scan**: `src/readiness/*.ts` has no IO/mutation.

### 3.7 Engine facade (`engine.test.ts`) — 97 lines

What it asserts:

**generateGovernanceReport**: all five sub-reports (`drift`, `compliance`, `ownership`, `security`, `readiness`) present with full provenance (evidence array, confidence number, sources array, timestamp string); composite timestamp matches the injected fixed clock.

**healthScore**: always finite, always in [0, 100].

**compliance.score and readiness.overall**: both in [0, 100]; violations is an array.

**Five HealthViews** (`architecture`, `security`, `ownership`, `readiness`, `domain`): each has correct `area` string, `score` in [0, 100], `findings` array, full provenance, and matching fixed timestamp.

**Determinism**: two calls to `generateGovernanceReport()` with the same fixed `now` are deep-equal.

**Finding invariants across composite**: every finding in drift + security + violations carries evidence, valid severity, and numeric confidence.

**Singleton**: `getGovernanceEngine()` returns the same object on repeated calls; `resetGovernanceEngine()` clears it; the five services are directly accessible on the engine instance.

---

## 4. Test layering

```
Foundation tests
  ↓ (store + builders verified)
Service tests (drift, compliance, ownership, security, readiness)
  ↓ (each service independently verified against real artifacts)
Engine facade tests
  ↓ (composition of all five services verified)
Access-layer tests (lcis-cli, services/lcis-api, lcis-mcp, lcis-pr-check)
  ↓ (CLI commands, API routes, MCP tools, PR governance verdicts verified)
```

Each layer can only trust what the layer below it has verified. The foundation tests establish that the artifact store reads real data. The service tests establish each detector's honesty contract (especially UNKNOWN/PARTIAL). The facade tests establish correct composition and score math. The access-layer tests establish the external interfaces surface these results faithfully.

---

## 5. Key honesty contracts tested

| Contract | Asserted in | How |
|---|---|---|
| UNKNOWN rollback finding has confidence ≤ 0.35 | `drift.test.ts` | `assert.ok(f.confidence <= 0.35)` |
| R006 status is always PARTIAL, not VIOLATED | `compliance.test.ts` | `assert.equal(r006.status, 'PARTIAL')` |
| R008 status is always PARTIAL, NOT CONNECTED evidence present | `compliance.test.ts` | `notConnected` evidence ref asserted |
| monitoring/alerts/rollback/healthcheck are UNKNOWN, not false | `readiness.test.ts` | per-factor `present === 'UNKNOWN'` + `unknowns` inclusion |
| UNKNOWN factors excluded from score denominator | `readiness.test.ts` | score computed correctly when all UNKNOWN |
| No service source file contains fetch/writeFile/execSync | all service tests | `readFileSync` source scan at end of each suite |
| Confidence is always ≤ 0.95 | `foundation.test.ts` | `ConfidenceCalculator` cap test |
| Findings are deterministic under a fixed clock | `drift.test.ts`, `engine.test.ts` | `assert.deepEqual(a, b)` on two runs |
