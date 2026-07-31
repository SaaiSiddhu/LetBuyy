# LCOS Test Report — LCIS Phase 6

**Date:** 2026-06-21  
**Status:** 2,098 tests pass / 0 fail across 10 LCIS packages, typecheck clean (authoritative `node --test` runner count).

---

## Per-Package Summary

Counts below are the authoritative `node --test` runtime counts (each package's `# tests` total), summed across all 10 LCIS packages.

| Package | Tests | Test files |
|---|---|---|
| `@letbuyy/lcis-core` | 140 | 7 |
| `@letbuyy/lcis-adapters` | 172 | 6 |
| `@letbuyy/lcis-live` | 67 | 3 |
| `@letbuyy/lcis-execution` | 265 | 7 |
| `@letbuyy/lcis-governance` | 302 | 7 |
| `@letbuyy/lcis-operations` | **512** | 10 |
| `@letbuyy/lcis-cli` | 140 | 1 |
| `@letbuyy/lcis-api` | 165 | 1 |
| `@letbuyy/lcis-mcp` | 146 | 1 |
| `@letbuyy/lcis-pr-check` | 189 | 4 |
| **TOTAL** | **2,098** | **47** |

Note: `@letbuyy/lcis-api` (services/lcis-api) IS a separate package with its own 165-test suite — Phase 6 added 9 `POST` operations endpoints to it. The per-suite tables further below count `test()`/`it()` declarations and may total slightly below the runtime count where a single parameterized declaration (e.g. `for (const a of AREAS) test(...)`) expands into several runs.

---

## lcis-operations Test Suite Breakdown (512 tests across 10 files)

### `foundation.test.ts` — 11 tests

Asserts the shared layer (the LCOS foundation) against real `graphify-out` artifacts. No fixtures or stubs — all tests use the live artifact store.

| What is asserted | Description |
|---|---|
| `OperationsArtifactStore` reads real topology | `workers()`, `queueGraph()`, `opsCenterStatuses()`, `telemetryAdapters()` all return non-empty arrays from real artifacts |
| Raw intelligence artifact access | `deploymentState()` non-null; `security-intelligence-v5` artifact present |
| `LiveSignalRegistry` counts + env-var honesty | `list()` returns ≥ 20 signals; every `NOT_CONNECTED` signal names at least one `requiresEnvVar` entry |
| `OperationalSeverityScorer` rules | `money: true` → `critical`; `spof: true` → `critical`; `tenant: true` → `high`; `deadLetter: true` → `high` |
| `OperationalConfidenceCalculator` NOT_CONNECTED = 0 | `notConnected()` returns 0; `forStatus('NOT_CONNECTED', ...)` returns 0; structural capped at ≤ 0.9 |
| `OperationalFindingBuilder` deterministic ID | `id` is deterministic from kind + subject; NOT_CONNECTED finding has `confidence === 0` |
| `OperationalEvidenceBuilder.notConnected` cites env var | Evidence `detail` contains the env var name |
| `OperationalHealthCalculator` band derivation | No findings → `unknown`; critical finding → `failing`; NOT_CONNECTED finding → `degraded` |
| `TelemetryNormalizer` null-safety | Null input returns a safe zero-state object |
| `SignalCorrelator.correlate` reuses lcis-core blast | Returns structured correlation result; does not throw on empty signal list |
| `operations()` envelope | Returns `OperationsEnvelope` with all required fields; `liveConnected` is boolean |

### `runtime.test.ts` — 54 tests

Asserts `RuntimeOperationsService` using the real artifact store.

| Category | Tests | Key assertions |
|---|---|---|
| Worker topology detection | 8 | `queue-workers` identified as a single-worker SPOF; 5 queues detected from `runtime-intel.json` |
| SPOF finding severity | 4 | Single-worker-all-queues pattern → `critical` severity, `CONNECTED` status |
| Cron detection | 5 | Cron schedules extracted from worker definitions |
| Dead-letter queue detection | 5 | `runtime-observability.json` DLQ entries parsed correctly |
| NOT_CONNECTED signal honesty | 12 | `worker-errors`, `queue-backlog`, `dead-letter-depth`, `cron-last-run` all have `confidence: 0`; `requiresEnvVar` populated |
| Health band | 5 | `failing` or `degraded` when SPOF finding present |
| Evidence chain | 8 | Each finding's `evidence` array non-empty; evidence references real artifact fields |
| Determinism | 7 | Two calls with same store → identical findings and IDs |

### `commerce.test.ts` — 68 tests

Asserts `CommerceOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Ledger topology | 10 | `commerce.ledger-topology` is `CONNECTED`; 4 non-SECURITY-DEFINER money functions surfaced as findings |
| NOT_CONNECTED commerce signals | 18 | GMV, order rate, refund rate, payment failure rate all have `confidence: 0` |
| Payment blast radius | 8 | Payments domain blast radius (11 domains, 103 RPCs, 205 tables) read from `domain-intel.json` |
| Finding severity | 12 | Non-SECURITY-DEFINER money function → `high`; missing live GMV → `info` or `medium` |
| Evidence | 10 | `ledger-topology` evidence cites `db-intel.json`; NOT_CONNECTED evidence cites Supabase |
| Health + summary | 10 | `summary` non-empty string; `health.area === 'commerce'` |

### `merchant.test.ts` — 55 tests

Asserts `MerchantOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Topology CONNECTED | 8 | `merchant.topology` signal is `CONNECTED`; merchant lifecycle model present |
| NOT_CONNECTED live counts | 15 | Active merchant count, churn rate, activation rate all `confidence: 0` |
| 256-tenant SPOF finding | 10 | Single-schema multi-tenant topology surfaces a `critical` or `high` SPOF finding |
| Evidence chain | 12 | Each NOT_CONNECTED finding evidence cites the exact env var |
| Health band | 10 | SPOF finding → `failing` or `degraded` |

### `customer.test.ts` — 51 tests

Asserts `CustomerOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Journey topology CONNECTED | 7 | `customer.journey-topology` is `CONNECTED` |
| NOT_CONNECTED funnel signals | 16 | Conversion rate, traffic, abandonment rate all `confidence: 0` |
| mobile-bff 0-coverage finding | 8 | `mobile-bff` identified as having 0 test coverage; severity `high` |
| Finding determinism | 10 | Same inputs → same finding IDs |
| Evidence | 10 | NOT_CONNECTED evidence names CF Analytics or Supabase as `liveSource` |

### `deployment.test.ts` — 79 tests

Asserts `DeploymentOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Git state CONNECTED | 10 | `deployment.git-state` is `CONNECTED`; `deployment-state.json` readable |
| Rollback scripts CONNECTED | 8 | `deployment.rollback-scripts` is `CONNECTED` |
| NOT_CONNECTED live version | 12 | Deployed version has `confidence: 0`; requires `VERCEL_TOKEN` and `CF_ACCOUNT_ID` |
| Migration status | 15 | Migration count and last migration read from `deployment-state.json` |
| Finding severity | 14 | Missing live version → `info`; stale deployment → `medium` |
| Health derivation | 10 | No critical findings → `healthy` or `degraded` (depending on NOT_CONNECTED count) |
| Determinism | 10 | Two calls → identical output |

### `incident.test.ts` — 48 tests

Asserts `IncidentOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Runbook coverage CONNECTED | 8 | `incident.runbook-coverage` is `CONNECTED`; runbooks present in `runbooks.json` |
| Blast radius CONNECTED | 8 | `incident.blast-radius` is `CONNECTED`; domain edges read from `domain-intel.json` |
| Open incidents NOT_CONNECTED | 10 | `open-incidents` has `confidence: 0`; requires Supabase |
| 6h DLQ drain gap finding | 10 | Dead-letter queue 6-hour drain gap surfaces as a finding |
| Evidence | 12 | Each structural finding cites an artifact; NOT_CONNECTED cites env var |

### `security.test.ts` — 50 tests

Asserts `SecurityOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| Controls CONNECTED | 8 | `security.controls` is `CONNECTED`; reuses `lcis-governance` `SecurityDriftDetector` |
| Cross-tenant surface CONNECTED | 8 | `security.cross-tenant-surface` is `CONNECTED`; RLS policy count non-zero |
| NOT_CONNECTED live auth signals | 12 | Auth failure rate, abuse/bot signals have `confidence: 0` |
| SecurityDrift reuse | 8 | `SecurityOperationsService` calls governance `SecurityDriftDetector`; does not re-implement |
| Finding severity | 8 | Auth signal blind spot → `high`; controls present → `info` |
| Read-only scan | 6 | Source scan confirms no write/mutate/deploy calls in `SecurityOperationsService.ts` |

### `forecast.test.ts` — 81 tests

Asserts `ForecastOperationsService`.

| Category | Tests | Key assertions |
|---|---|---|
| NOT_CONNECTED all series | 16 | All 4 forecast series (order-trend, merchant-growth, traffic-trend, queue-growth) are `NOT_CONNECTED` with `confidence: 0` |
| Deterministic math | 20 | When given a synthetic number series, linear regression output is reproducible across calls |
| Empty series honesty | 15 | No historical data → finding with `status: 'NOT_CONNECTED'`; no fabricated projections |
| Env var citation | 15 | Each NOT_CONNECTED series finding cites the correct env var group |
| Confidence 0 for NOT_CONNECTED | 10 | `confidence === 0` asserted for every NOT_CONNECTED forecast finding |
| Health band | 5 | All NOT_CONNECTED → `unknown` health band |

### `engine.test.ts` — 8 tests

Asserts the `OperationsEngine` facade (singleton lifecycle and composite report).

| What is asserted |
|---|
| `getOperationsEngine()` returns the same instance on repeated calls |
| `resetOperationsEngine()` clears the singleton |
| `operationsReport()` returns all 8 sub-reports |
| `answers` object present with all 6 keys |
| `answers.investigate` is non-empty (at least one NOT_CONNECTED blind spot) |
| `summary` string is non-empty and contains counts |
| `liveConnected` is `false` (no live adapters wired) |
| `timestamp` is a valid ISO 8601 string |

---

## Test Layering Architecture

```
foundation.test.ts        — shared layer (store, registry, builders, correlator, envelope)
       ↓ used by
runtime / commerce / merchant / customer / deployment / incident / security / forecast
       ↓ used by
engine.test.ts            — OperationsEngine facade (composition + singleton)
       ↓ consumed by
lcis-cli/test/cli.test.ts            — CLI command integration (140 it() tests)
lcis-mcp/test/tools.test.ts          — MCP tool registration + output shape (146 tests)
lcis-pr-check/test/operations.test.ts — PR V4 operational verdict (26 it() tests)
lcis-pr-check/test/analyze.test.ts   — full analyzePr/analyzeWithOperations (87 it() tests)
lcis-pr-check/test/governance.test.ts — governance integration (35 it() tests)
lcis-pr-check/test/verdicts.test.ts  — all 4 verdict dimensions (41 it() tests)
```

**Design principle:** Each layer only tests the contracts it owns. The foundation layer tests the shared primitives against real artifacts. The service tests use the real store (no stubs) — they fail if `graphify-out/` is absent or stale. The access-layer tests (CLI, MCP, PR-check) use stub engines so they are always green in CI regardless of artifact presence.

---

## NOT_CONNECTED Honesty — Cross-Suite Assertions

The following invariants are asserted in multiple test suites:

1. `confidence === 0` when `status === 'NOT_CONNECTED'` (tested in foundation, every service suite, and forecast)
2. `requiresEnvVar.length >= 1` for every NOT_CONNECTED signal in `LiveSignalRegistry` (foundation)
3. Forecast series are never fabricated — empty input → `NOT_CONNECTED` finding, no projected values (forecast)
4. `liveConnected === false` at the engine level (engine.test.ts)
5. `OperationalConfidenceCalculator` caps structural confidence at 0.9 (foundation)

---

## Read-Only Enforcement

The `security.test.ts` and each service test includes a source-scan assertion verifying that the service implementation file contains no calls to any mutating operation. Specifically, the following patterns are asserted absent from each `*OperationsService.ts` source file:

- `deploy(`, `execute(`, `mutate(`, `write(`, `insert(`, `update(`, `delete(`
- `push(`, `merge(`, `remediate(`, `fix(`

This is enforced at test time, not only at code review.
