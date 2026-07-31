# LCIS Phase 4 Runbook — EIS Planning Intelligence

How to operate the Execution Intelligence System (EIS) added in Phase 4.

The EIS is **read-only**. It produces plans, analyses, and recommendations. It never migrates, deploys, writes files, or executes anything. The word "execution" refers to execution _planning_, not execution of code.

---

## Prerequisites

The EIS reads pre-computed `graphify-out/*.json` artifacts at startup. If the artifacts are stale or missing, run:

```bash
pnpm graph:update   # re-run graphify to regenerate artifacts
```

The critical files consumed are:
- `graphify-out/graph.json` — code graph (nodes + edges)
- `graphify-out/db-intel.json` — tables, RPCs, policies, triggers
- `graphify-out/domain-intel.json` — 22 business domains + cross-domain edges
- `graphify-out/relationship-intel.json` — FK fan-in/fan-out per table

The `@letbuyy/lcis-live` dependency is declared but the EIS does not require live adapter credentials. All plan derivation is structural.

---

## CLI — `plan` Command Group

All plan subcommands are under `pnpm lcis plan <subcommand>`.

### Shared seed options

Every plan subcommand accepts optional seeds to increase precision beyond NL token matching:

```
--domain <d...>        Seed domains (repeatable, e.g. --domain payments --domain orders)
--seed-table <t...>    Seed tables (repeatable; note: --table is taken by other commands)
--symbol <s...>        Seed symbols/function names (repeatable)
```

Output format flags (shared with all other LCIS commands):
```
--json       Emit a machine-readable LcisEnvelope
--compact    Short text summary
--evidence   Include evidence array in output
--export <f> Write output to file
```

---

### `plan change` — Change Analysis

Resolves affected domains/tables/symbols, scores complexity + risk, derives blast radius.

```bash
pnpm lcis plan change "Add GST Filing"
pnpm lcis plan change "Add GST Filing" --domain payments --json
pnpm lcis plan change "Migrate Checkout" --seed-table orders --json
```

Example `--json` envelope (illustrative shape — actual values vary with your graph):

```json
{
  "source": "plan/change",
  "executionTime": 42,
  "confidence": 0.7,
  "data": {
    "request": { "text": "Add GST Filing" },
    "seeds": [
      { "kind": "table", "ref": "gst_invoices", "score": 0.7, "reason": "token \"gst\" ~ table \"gst_invoices\"" }
    ],
    "affected": {
      "domains": ["orders", "payments"],
      "tables": ["gst_invoices", "orders"],
      "rpcs": ["create_checkout_order"],
      "workers": [],
      "queues": []
    },
    "complexity": { "band": "moderate", "score": 14 },
    "risk": { "level": "high", "money": false, "tenant": true },
    "unresolved": false,
    "suggestedSequence": ["orders", "payments"],
    "rollbackStrategy": "standard revert + migration-down where reversible...",
    "launchImpact": "tenant-facing — affects all merchants on the shared schema...",
    "evidence": [...],
    "confidence": 0.7,
    "sources": ["graphify-out/db-intel.json", "graphify-out/domain-intel.json"],
    "timestamp": "2026-06-20T10:00:00.000Z"
  }
}
```

**Unresolved case** — when no seed resolves:

```bash
pnpm lcis plan change "zzqqx wibble frobnicate xyzzy" --json
```

Exits 0. The plan is honestly empty (`unresolved: true`, `affected.domains: []`). Evidence cites `'unresolved'` and explains why no entity matched. No error, no fabrication.

---

### `plan execution` — Execution Plan

Work breakdown, milestones, dependency graph, critical path, checklist.

```bash
pnpm lcis plan execution "Implement Shipping Zones" --json
pnpm lcis plan execution "Add Discount Coupons" --domain orders --domain coupons --json
```

The plan always includes items of category `schema`, `rpc`, `api`, `worker`, `migration`, `test`, `docs`, and `verification`. The `implementationOrder` field is a topologically sorted list — schema before rpc, rpc before api, test before verification.

---

### `plan migration` — Migration Plan

Database/schema/worker migration analysis: targets, ordered steps, data-loss risks, reversibility, simulated impact.

```bash
pnpm lcis plan migration "orders schema change" --seed-table orders --json
pnpm lcis plan migration "Add shipping_rates table" --json
```

The `simulatedImpact` field always includes "NOT executed by LCIS" to prevent confusion about what the plan does vs what running the migration would do.

---

### `plan tests` — Test Plan

Required tests, missing coverage gaps, regression/smoke/load/security/acceptance plans, coverage confidence.

```bash
pnpm lcis plan tests "payment flow change" --domain payments --json
pnpm lcis plan tests "Add GST Filing" --json
```

---

### `plan security` — Security Test Targets

Security test targets derived from the change's blast radius.

```bash
pnpm lcis plan security "auth identity change" --json
pnpm lcis plan security "checkout payment" --domain payments --json
```

Note: this subcommand wraps `generateSecurityPlan()` which returns `TestTarget[]` (not a full `TestPlan`). The envelope shape is consistent with other plan subcommands but the `data.targets` field holds the targets array directly.

---

### `plan rollback` — Rollback Plan

Readiness verdict, ordered rollback steps, irreversible changes, estimated recovery.

```bash
pnpm lcis plan rollback "checkout payment change" --json
pnpm lcis plan rollback "orders migration" --seed-table orders --json
```

The `readiness` field is one of `'READY' | 'CONDITIONAL' | 'NOT_READY'`. A money-touching change will always produce `NOT_READY` with irreversible findings.

---

### `plan launch` — Launch Plan

GO / CONDITIONAL_GO / NO_GO decision, blockers, checklist, unknowns. This subcommand calls `evaluateLaunch`, which is async.

```bash
pnpm lcis plan launch "Add GST Filing" --json
pnpm lcis plan launch "touch ledger" --seed-table payment_transactions --json
```

The `decision.decision` field is one of `GO | CONDITIONAL_GO | NO_GO`. A KNOWN critical blocker always produces `NO_GO`. An UNKNOWN forces at most `CONDITIONAL_GO` — it is never silently promoted to `GO`.

---

### `plan release` — Full Release Plan (All 8 Plans)

Runs `planAll`: change analysis + execution + migration + tests + rollback + launch + verification, analysed once and derived as a single response.

```bash
pnpm lcis plan release "Implement Razorpay Route" --domain payments --json
pnpm lcis plan release "Add GST Filing" --json
```

The envelope contains all 8 plan artifacts under their keys (`change`, `execution`, `executionGraph`, `migration`, `tests`, `rollback`, `launch`, `verification`). The top-level `confidence` is the arithmetic average of all 7 plan confidences (excludes `executionGraph` which is a structural projection of `execution`).

---

## MCP Tools (Model Context Protocol)

Seven plan tools are registered in the LCIS MCP server (19 total tools as of Phase 4: 7 core + 5 live + 7 plan).

| Tool name | Description |
|-----------|-------------|
| `lcis_plan_change` | Resolve affected entities, assess complexity + risk, blast radius |
| `lcis_plan_execution` | Work breakdown, milestones, dependency graph, checklist |
| `lcis_plan_migration` | Migration targets, steps, data-loss risks, reversibility |
| `lcis_plan_tests` | Required tests, missing coverage, regression/smoke/load/security/acceptance |
| `lcis_plan_rollback` | Rollback steps, irreversible changes, readiness verdict |
| `lcis_plan_launch` | GO/CONDITIONAL_GO/NO_GO decision, blockers, checklist |
| `lcis_plan_release` | Full 8-plan set in a single response |

All tools share the same input schema:

```json
{
  "request": "Natural-language description of the change",
  "domains": ["optional", "domain", "seeds"],
  "tables": ["optional", "table", "seeds"],
  "symbols": ["optional", "symbol", "seeds"]
}
```

`request` is required (min length 1). All other fields are optional.

---

## HTTP API — `POST /plan/*`

Seven plan routes registered in `services/lcis-api`. All use `POST` with a JSON body.

| Endpoint | Body shape | Returns |
|----------|-----------|---------|
| `POST /plan/change` | `{ text, domains?, tables?, symbols? }` | `LcisEnvelope<ChangeAnalysis>` |
| `POST /plan/execution` | same | `LcisEnvelope<ExecutionPlan>` |
| `POST /plan/migration` | same | `LcisEnvelope<MigrationPlan>` |
| `POST /plan/tests` | same | `LcisEnvelope<TestPlan>` |
| `POST /plan/rollback` | same | `LcisEnvelope<RollbackPlan>` |
| `POST /plan/launch` | same | `LcisEnvelope<LaunchPlan>` |
| `POST /plan/release` | same | `LcisEnvelope<FullPlan>` |

Example:

```bash
curl -X POST http://localhost:3001/plan/change \
  -H 'Content-Type: application/json' \
  -d '{"text":"Add GST Filing","domains":["orders"]}'
```

A 422 is returned when `text` is missing or empty. All plan routes return 200 even for unresolved requests (the plan is honestly empty, not an error).

---

## Reading a Plan Output

Every EIS plan output — regardless of type — carries four provenance fields:

| Field | Type | Meaning |
|-------|------|---------|
| `evidence` | `Evidence[]` | Cited graph nodes, tables, domains, docs that ground this plan. Each item has `kind`, `ref`, `note`, `source`. |
| `confidence` | `number` (0–0.95) | Structural confidence. Scales with evidence breadth. 0 = no evidence. 0.95 = maximum (LCIS never claims certainty). |
| `sources` | `string[]` | Artifact file paths that contributed (e.g. `"graphify-out/domain-intel.json"`). |
| `timestamp` | `string` | ISO-8601 generation time. |

**Low confidence / unresolved:** when `confidence` is near 0 or `unresolved: true`, it means no graph entity matched the request — not a system error. Provide explicit seeds (`--domain`, `--seed-table`, `--symbol`) to increase match precision.

**NOT_CONNECTED:** the EIS does not consume live adapter credentials. All plans derive from the structural graph. When the graph artifacts are stale, re-run `pnpm graph:update`.

---

## `planAll` Flow

```
ChangeRequest (text + optional seeds)
        │
        ▼
  SeedResolver.resolve()
  ├─ explicit seeds at score 1.0
  └─ NL token match against domain keys + table names (deterministic, no LLM)
        │
        ▼
  ChangeAnalyzer.analyze()
  ├─ blast.impact() per domain seed
  ├─ blast.relationships() per table seed
  ├─ blast.blast() per symbol seed
  ├─ assessComplexity() + assessRisk()
  └─ discoverTests() + discoverDocs()
        │
        ▼ ChangeAnalysis (the shared backbone)
        │
  ┌─────┴──────────────────────────────┐
  │                                    │
  ▼                                    ▼
ExecutionIntelligenceService     MigrationIntelligenceService
ExecutionGraphService            TestingIntelligenceService
LaunchIntelligenceService        RollbackIntelligenceService
VerificationPlanner
  │
  ▼
FullPlan { change, execution, executionGraph,
           migration, tests, rollback, launch, verification }
```

The change is analysed **once**. All 8 downstream plans are pure derivations of that single `ChangeAnalysis`.

---

## PR Review Verdicts (`analyzeWithVerdicts`)

The PR check package was extended in Phase 4 with `analyzeWithVerdicts()`. This async function runs the standard `analyzePr()` and then builds 6 EIS-derived verdicts.

The rendered PR comment gains a `## LCIS VERDICTS` section when verdicts are present.

| Dimension | Source | Verdict logic |
|-----------|--------|---------------|
| `architecture` | `eis.analyze()` | `FAIL` if frozen app or deprecated alias touched; `WARN` if cross-domain or blast > 100 nodes; `PASS` otherwise |
| `security` | `eis.testing.generateSecurityPlan()` | `FAIL` if payment/RLS touched; `WARN` if auth/HMAC/Turnstile/site_id touched; `PASS` otherwise |
| `migration` | `eis.migration.analyzeMigration()` | `FAIL` if migration `readiness.ready = false`; `WARN` if irreversible steps or data-loss risk; `PASS` otherwise |
| `coverage` | `eis.testing.generateTestPlan()` | `FAIL` if `coverageConfidence < 0.4`; `WARN` if `< 0.7` or critical gaps; `PASS` otherwise |
| `launch` | `eis.launch.evaluateLaunch()` | `FAIL` if `NO_GO`; `WARN` if `CONDITIONAL_GO`; `PASS` if `GO` |
| `rollback` | `eis.rollback.generateRollbackPlan()` | `FAIL` if `readiness = NOT_READY` or irreversible changes; `WARN` if `CONDITIONAL`; `PASS` if `READY` |

`UNKNOWN` is returned whenever the underlying engine call throws. It is never fabricated as `PASS`.

The synchronous `analyzePr()` function returns `verdicts: []` for backward compatibility — existing CI callers are unaffected.

---

## Troubleshooting

**"Plan returns unresolved: true for a request I know is real"**  
The NL token matcher uses a stopword list and requires tokens of 3+ characters. Provide explicit seeds: `--domain payments` or `--seed-table orders`. The token `"gst"` must appear verbatim; e.g. `"Add GST Filing"` → tokens `['gst', 'filing']`.

**"confidence is very low (e.g. 0.55)"**  
Low confidence is honest, not a bug. It means few evidence items were collected. Use `--evidence` to inspect what was found. Add seeds to increase match precision.

**"plan migration says readiness.ready = false for my change"**  
A money table is in the blast radius. LCIS flags all money-table migrations as NOT READY because they require the canonical-ledger-only-validator + step-up gate pattern. Review the `blockers` array in the plan.

**"plan launch returns NO_GO"**  
Inspect `decision.blockers` for items with `state: 'KNOWN'`. A KNOWN critical blocker always produces `NO_GO`. The `unknowns` array lists items that could not be determined; they force at most `CONDITIONAL_GO`.

**"graphify-out files not found"**  
Run `pnpm graph:update` from the repo root. The EIS will throw on startup if `db-intel.json` or `domain-intel.json` are absent.

**Running tests**

```bash
# EIS package only
pnpm --filter "@letbuyy/lcis-execution" test

# All LCIS packages
pnpm --filter "@letbuyy/lcis-*" test
```

Expected: 1046 pass, 0 fail.
