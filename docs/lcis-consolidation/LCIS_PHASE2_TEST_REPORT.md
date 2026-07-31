# LCIS Phase 2 Test Report

Total: **356 tests, 0 failures** across 5 packages. All 5 packages typecheck clean.

---

## Per-Package Breakdown

| Package | Test file | Tests | Failures |
|---------|-----------|-------|----------|
| `@letbuyy/lcis-core` | multiple (`architecture/`, `blast-radius/`, `decision/`, `graph/`, `memory/`, `verification/`, `runtime/`) | 140 | 0 |
| `@letbuyy/lcis-cli` | `test/cli.test.ts` | 49 | 0 |
| `@letbuyy/lcis-mcp` | `test/tools.test.ts` | 42 | 0 |
| `@letbuyy/lcis-api` | `test/app.test.ts` | 46 | 0 |
| `@letbuyy/lcis-pr-check` | `test/analyze.test.ts` | 79 | 0 |
| **Total** | | **356** | **0** |

Test runner: `tsx --test` (Node.js built-in test runner).

---

## `@letbuyy/lcis-core` — 140 Tests

The core test suite covers the 7 services that the access layer consumes. Key assertions per service:

### ArtifactStore
- `read()` returns parsed JSON from `graphify-out/`
- `tryRead()` returns `null` on missing (does not throw)
- `has()` returns correct presence boolean
- `ArtifactMissingError` is thrown with the artifact path in the message

### GraphService
- Lazy adjacency index is built once
- `node(id)` returns null for unknown ids
- `nodes()` returns all 52k+ nodes from the fixture
- `outgoing()` / `incoming()` traverse directed edges correctly
- `degree()` sums in + out edges
- `nodeCount()` / `edgeCount()` match fixture counts
- `commit` is extracted from graph metadata
- `resolve(name)` matches by exact id, then `name` field, then label
- `traverse(start, depth)` produces correct BFS layers
- `search(term)` returns nodes with matching name/label/type

### BlastRadiusService
- `blast(symbol)` returns `DomainError` for unknown symbols
- `blast('getSupabaseAdmin')` → 197 nodes, 115 files, layers `[169,26,2]`, criticality `critical`
- `dependencies()` / `consumers()` are correct subsets of blast
- `critical()` returns only nodes above criticality threshold
- `crossDomain()` groups results by domain
- `impact()` returns severity + affected-area breakdown
- `relationships()` returns the edge type breakdown

### MemoryService
- BM25 index is built without Qdrant/OpenAI (offline)
- High-score queries return `confidence` > 0.8
- Unknown query returns empty `hits[]` not an error
- `staleness` flag is set when artifacts are newer than index build
- `limit` parameter is respected

### DecisionService
- `launchVerdict()` returns `GO | NO-GO | CONDITIONAL-GO`
- `rankRisks()` returns descending severity order
- `rankFixes()` returns descending impact-vs-effort order
- `scaleTiers()` returns blockers per tier (100 / 10k / 100k)
- `trace(id)` returns a single decision or `DomainError`
- `dimensionReadiness()` returns one entry per readiness dimension

### ArchitectureService
- `explainDomain(key)` returns NARRATIVE for all 22 domain keys
- `explainDomain('unknown')` returns a `DomainError`
- `explainService(name)` reads `package.json` from the filesystem
- `explainRisk(entity)` flags entities in `MONEY_TABLES` correctly
- `explainOwnership(entity)` reads CODEOWNERS

### VerificationService
- `verifyArchitecture()` → `VERIFIED` when structure is sound
- `verifyProductionReadiness()` → `GO / NO-GO / CONDITIONAL-GO` with evidence
- `verifyRuntime()` → always `PARTIAL` (13 NOT CONNECTED sources × −0.08 each)
- `verifySecurity()` → `VERIFIED | UNVERIFIED` based on RLS/auth scan
- REFUTED rules are tested: uncorroborated claims do not return VERIFIED

---

## `@letbuyy/lcis-cli` — 49 Tests (`test/cli.test.ts`, 19.7 KB)

| Category | What is tested |
|----------|---------------|
| Command routing | Each of 7 commands dispatches to the correct engine method |
| Output format — JSON | `--json` flag produces valid parseable JSON; envelope shape matches `LcisEnvelope` |
| Output format — YAML | `--yaml` flag produces valid YAML |
| Output format — table | `--table` flag produces ASCII with correct column headers |
| Output format — CSV | `--format csv` produces correct header + value rows |
| Output format — markdown | `--format markdown` produces correct headers and table cells |
| Evidence flag | `--evidence` includes evidence array in output |
| Export flag | `--export /tmp/test-out.json` writes file + stdout |
| Depth flag | `--depth 2` is passed to `engine.blast.blast()` |
| Domain flag | `--domain payments` is passed to relevant commands |
| Error paths | Invalid command names exit with code 1; missing required args exit with code 1 |
| `run(argv, io)` | Programmatic invocation with mock io works |
| Exit codes | 0 on success; 1 on bad args; 2 on engine error |

---

## `@letbuyy/lcis-mcp` — 42 Tests (`test/tools.test.ts`, 18.9 KB)

| Category | What is tested |
|----------|---------------|
| Tool registration | All 7 tools appear in the `TOOLS` registry |
| Tool schemas | Each tool's input schema is a valid Zod object |
| Tool handler returns | Each handler returns `{ content: [{ type: 'text', text: string }] }` |
| Envelope shape | `JSON.parse(content[0].text)` conforms to `LcisEnvelope` |
| `lcis_blast` | Passes `symbol` and `depth` to `engine.blast.blast()` |
| `lcis_explain` | Routes to correct `engine.architecture.explain*` method |
| `lcis_verify` | Routes to correct `engine.verification.verify*` method for each of the 4 entity types |
| `lcis_memory` | Passes `query` and `limit` to `engine.memory.recall()` |
| `lcis_decision` | Routes `risks/fixes/launch/scale/<id>` correctly |
| `lcis_health` | Returns engine health stats |
| `lcis_graph_stats` | Returns `nodeCount`, `edgeCount`, `commit` |
| **Read-only source scan** | Asserts `tools.ts` contains none of: `write`, `exec`, `spawn`, `eval`, `fetch`, `http.request`, SQL mutations |

---

## `@letbuyy/lcis-api` — 46 Tests (`test/app.test.ts`, 23.9 KB)

| Category | What is tested |
|----------|---------------|
| `GET /health` | 200 + correct envelope shape |
| `GET /graph/stats` | 200 + `nodeCount`, `edgeCount`, `commit` |
| `POST /blast` | 200 with valid body; 400 on missing `symbol`; 400 on wrong type |
| `POST /verify` | 200 for each entity type; 400 for unknown entity |
| `POST /explain` | 200 with valid entity; 400 on missing `entity` |
| `POST /memory` | 200 with `query`; 400 on missing `query`; `limit` respected |
| `POST /decision` | 200 for each subject; 400 on missing `subject` |
| 404 catch-all | Unknown routes return 404 JSON |
| Rate limiting | Token bucket depletes and returns 429 |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control` present |
| Request IDs | `x-request-id` echoed in response; generated when absent |
| Audit log | Structured JSON line emitted to stderr per request |
| Error handler | Engine error → 500 JSON with no stack trace |
| `createApp()` | Factory can be called multiple times independently |

---

## `@letbuyy/lcis-pr-check` — 79 Tests (`test/analyze.test.ts`, 22.8 KB)

| Category | What is tested |
|----------|---------------|
| Domain mapping | All 22 domains matched by representative file paths |
| `PATH_DOMAIN_RULES` ordering | First-match-wins for ambiguous paths |
| `filePathToDomain` | Returns `unknown` for unmatched paths |
| Sensitivity flags — `authRelated` | JWT, session, oauth, turnstile, credentials paths |
| Sensitivity flags — `paymentRelated` | Razorpay, ledger, payment RPC, webhook payment paths |
| Sensitivity flags — `rlsRelated` | Policy, rls, row level, security definer paths |
| Sensitivity flags — `migrationRelated` | `migrations/`, `supabase/migrations/` paths |
| Sensitivity flags — `tenantIsolation` | `site_id`, tenant, `getSupabaseAdmin` paths |
| Sensitivity flags — `validatorImpact` | validate-governance, canonical-ledger paths |
| Sensitivity flags — `securitySensitive` | crypto, hash, signature, hmac, secret paths |
| Sensitivity flags — `crossDomain` | Files spanning 2+ domains |
| Risk derivation — HIGH/CRITICAL | Payment + auth + cross-domain combinations |
| Risk derivation — LOW | Single domain, no sensitive flags |
| `analyzePr` integration | Returns `PrReport` with all required fields |
| `renderComment` | Produces `## LCIS ANALYSIS` markdown header |
| `renderJson` | Produces valid JSON string of `PrReport` |
| `renderSummary` | Single-line summary with risk level + domain count |
| `--files` CLI flag | Parsed correctly |
| `--files-from` CLI flag | Reads one path per line |
| stdin | Reads one path per line from stdin |
| `--out` flag | Writes output file |
| `--format` flag | All 3 formats (`markdown`, `json`, `summary`) |
| `--symbols` flag | Passed to blast-radius computation |
| `PrInputSchema` | Zod validation rejects malformed input |
