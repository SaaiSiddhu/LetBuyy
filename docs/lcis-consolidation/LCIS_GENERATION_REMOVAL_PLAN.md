# LCIS Generation Removal Plan

**Phase 10 deliverable.** Every LCIS generation name (`V1…V11, X, OMEGA, Genesis, INFINITY`) is retired and replaced by a **capability name**. No generation naming survives in `packages/lcis-core`.

> The disease (per the discovery: `docs/lcis-master/LCIS_DOMAIN_INTELLIGENCE.md` — *"layer-naming proliferation makes LCIS itself a discovery problem"*) was naming by lineage instead of by function. The cure is a single rule, enforced structurally.

## The rule

1. **No identifier in `lcis-core`** — file, directory, class, type, field, or export — may contain `V1/V2/.../V11/X/OMEGA/GENESIS/INFINITY` or "vN".
2. Capabilities are named for **what they do** (`graph`, `blast-radius`, `memory`, `decision`, `architecture`, `verification`, `lineage`, `ownership`, `execution`).
3. The version-named legacy `.mjs` files are **consolidated** (canonical logic kept under a capability name, suffix dropped) or **archived** — never carried forward with their version suffix (see `LCIS_MIGRATION_PLAN.md` for the per-file disposition).
4. Enforcement: a contract test in `lcis-core` (`test/no-generations.test.ts`) asserts no source file path or exported identifier matches `/v\d+|omega|infinity|genesis/i`. (To be added in the test phase.)

## Generation → capability mapping

| Generation | What it claimed to add | Becomes (capability / disposition) |
|---|---|---|
| **V1** | db-intel, 108 validators, CLI | `graph` + `runtime` (KEEP; validators stay the authoritative gate, separate) |
| **V2 (:3333)** | infra-intel, FK relationships, ownership | `graph` + `lineage` + `ownership` (KEEP) |
| **V2 (:3334 runtime)** | Qdrant/GraphRAG autonomous platform | **ARCHIVE the runtime**; migrate 7 dep-free modules (architecture-intelligence, verification-engine, execution SafetyGuard, context-compression) into capability modules |
| **V3** | 22 domains, cross-domain blast | `architecture` (domain classify) + `blast-radius` (crossDomain) (KEEP) |
| **V4** | runtime topology, governance memory | `memory` + `runtime` (KEEP) |
| **V5** | merchant/revenue/security/readiness | `decision` + `verification` (KEEP — canonical; `*-v5` suffix dropped) |
| **V6** | explain mode, AI context packs | `architecture` (explain) + `memory` (context packs) (KEEP) |
| **V7 / V8 / V9** | operating-system baselines/certifications | docs **ARCHIVE**; no distinct engine (folded into the above) |
| **V10** | URL-addressable deep links | a **surface** concern (future `apps/lcis`), NOT engine; docs ARCHIVE |
| **V11** | journeys + Founder/Ops/Support/Investor modes | journeys → `architecture`/`domain`; the **"modes" are rejected** (discovery); docs ARCHIVE |
| **X** | live provider federation (7 providers) | `runtime` live-adapter status (NOT CONNECTED + source); docs ARCHIVE |
| **OMEGA** | unified brain, cost/telemetry/fix | `decision` (fix engine) + cost model (query-bound); `gen-omega-reports` → ARCHIVE |
| **Genesis** | control centers, lineage/trace | `lineage` + `blast-radius` (trace); docs ARCHIVE |
| **INFINITY** | 8 detectors / 6 predictors | relabeled **structural risk heuristics** (honesty); the engine → a future `detection` module or `decision` input; docs ARCHIVE |

## Version-suffixed file resolution (the `*-vN.mjs` families)

Per `LCIS_MIGRATION_PLAN.md`, each version-suffixed legacy file resolves as:

| Legacy file family | Resolution |
|---|---|
| `decision-engine-v2.mjs` / `-v5.mjs` | canonical ranking logic → `decision/` (suffix dropped); the wrapper dropped |
| `production-readiness-intel.mjs` / `-v2.mjs` | → `verification/` (one consolidated readiness check) |
| `memory-intel.mjs` / `memory-v2.mjs` | extraction logic → `memory/` (BM25, deterministic) |
| `revenue-intelligence.mjs` / `-v2.mjs` | KEEP in `:3333` (commerce capability) until a later phase; suffix retired on migration |
| `incident-*` (3 layers) / `incident-intelligence-v5.mjs` | KEEP Genesis as canonical `:3333`; suffix retired |
| `audit-engine-v2.mjs`, `security-intelligence-v5.mjs`, `deployment-intelligence-v5.mjs`, `customer-intelligence-v2.mjs`, `discovery-v2.mjs` | KEEP in `:3333` (suffix retired on eventual migration) or fold into `verification`/`architecture` |

## Documentation

The per-version "certification quintet" doc sets (`docs/v10`, `docs/v11`, `docs/omega-production`, `docs/infinity`, `docs/operating-system` V7–X, and the 67 self-issued certifications) are **archived** (moved to `docs/archive/`, not deleted) per the migration plan, *after* the decisions + confessed gaps they contain are promoted to queryable data (`governance/decisions/*.json` — Knowledge-panel recommendation). The discovery deliverables in `docs/lcis-master/` and this program's deliverables in `docs/lcis-consolidation/` are the surviving, plainly-named record.

## Execution gate

This is a **plan**. Archival/removal of the version-named files + docs executes only behind the **verify-before-destroy** gate (`LCIS_MIGRATION_PLAN.md`): run `:3334` live with `:3333` up + regression-test before moving any file. `lcis-core` is built additively; the legacy version-named engines keep running until a proven, gated cutover.
