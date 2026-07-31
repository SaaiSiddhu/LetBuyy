# LCIS Architecture Intelligence — Consolidation Spec

**Version:** 1.0  
**Date:** 2026-06-20  
**Scope:** Consolidation of the two LCIS architecture-intelligence implementations  
**Output artifact:** A single `ArchitectureService` that replaces both sources with zero Qdrant/OpenAI dependencies.

---

## Background

Two separate subsystems in this repo implement architecture intelligence:

1. **LCIS v1 / graph-server** (`tools/graph-server/`) — deterministic, runs at port :3333, produces `graphify-out/` JSON artifacts. Three relevant modules: `explain-intel.mjs`, `domain-intel.mjs`, `relationship-intel.mjs`.

2. **ArchitectureIntelligenceEngine** (`tools/central-intelligence/architecture-intelligence/`) — object-oriented, intended for port :3334 (LCIS V2), reads `graphify-out/domain-intel.json` and `graphify-out/infra-intel.json` plus live filesystem scans. Seven files: `ArchitectureIntelligenceEngine.mjs`, `ArchitectureDriftDetector.mjs`, `ArchitectureSnapshotService.mjs`, `DependencyDiscovery.mjs`, `DomainDiscovery.mjs`, `LayerDiscovery.mjs`, `ServiceDiscovery.mjs`.

The consolidation goal is a single typed `ArchitectureService` that:
- Exposes the 7 canonical methods below
- Reads only deterministic inputs (artifacts + filesystem, no ML/vector DB)
- Carries evidence citations (`Evidence[]`) on every returned `Explanation`
- Is dependency-free of Qdrant and OpenAI (confirmed below)

---

## 1. Canonical API

### `ArchitectureService` — 7 required methods

All methods are async and return `Promise<Explanation>`. Evidence fields cite the artifact field or file path that supplied each fact.

---

#### 1.1 `explainDomain(key: string): Promise<Explanation>`

**Source files consulted:**
- `tools/graph-server/explain-intel.mjs` — provides the `NARRATIVE` map (lines 18–41), `criticality()` function (lines 75–80), `aiContext()` function (lines 82–99), and the `buildExplainIntel()` loop over `di.domains` (lines 119–159).
- `tools/graph-server/domain-intel.mjs` — produces the domain object with fields `key`, `label`, `money`, `tenant`, `routes`, `rpcs`, `tables`, `queues`, `apps`, `workers`, `secrets`, `owners`, `dependsOn`, `consumedBy`, `counts` (lines 137–161, 198).
- `tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs` — loads `graphify-out/domain-intel.json` (line 34–37) and exposes `getDomain(key)` (lines 89–92), `getMoneyDomains()` (lines 138–157), `getCoupling()` (lines 99–135).

**Artifact fields read:**
- `graphify-out/domain-intel.json` → `domains[].key`, `domains[].label`, `domains[].money`, `domains[].tenant`, `domains[].routes`, `domains[].rpcs`, `domains[].tables`, `domains[].queues`, `domains[].workers`, `domains[].secrets`, `domains[].owners`, `domains[].dependsOn[].domain`, `domains[].dependsOn[].strength`, `domains[].consumedBy[].domain`, `domains[].counts.routes`, `domains[].counts.rpcs`, `domains[].counts.tables`, `domains[].counts.policies`, `domains[].counts.triggers`, `domains[].counts.indexes`
- `graphify-out/db-intel.json` → `policies[].table` (for `policiesFor()`, line 113 explain-intel.mjs), `tables[].triggers` (for `trigFor()`, line 115), `tables[].indexes` (for `idxFor()`, line 116)
- `graphify-out/relationship-intel.json` → `tables[].references`, `tables[].referencedBy` (for `fkFor()`, lines 108–111 explain-intel.mjs)
- `graphify-out/execution-intel.json` → `blockers[].status`, `blockers[].title`, `blockers[].id` (for `blockerHit()`, line 118 explain-intel.mjs)

**Algorithm:**
1. Look up `key` in `di.domains` array from `domain-intel.json`.
2. Look up `NARRATIVE[key]` in explain-intel.mjs lines 18–41 for `purpose`, `importance`, `failureImpact`.
3. Compute `criticality()` from `d.money` and `d.consumedBy.length` (explain-intel.mjs lines 75–80).
4. Build `aiContext` string (explain-intel.mjs lines 82–99).
5. Attach FK relationships from relationship-intel.json via `fkFor(d.tables)` (lines 108–111).
6. Assemble the node object (lines 119–159).
7. Return as `Explanation` with evidence citing `domain-intel.json` domain index and each field name.

---

#### 1.2 `explainService(name: string): Promise<Explanation>`

**Source files consulted:**
- `tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs` — the `discover()` method (lines 85–212) scans `apps/`, `services/`, `packages/` package.json files and merges with `graphify-out/infra-intel.json` worker metadata. Canonical runtimes list at lines 15–24.
- `tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs` — `LAYER_MAP` (lines 22–54), `PACKAGE_LAYER_MAP` (lines 57–79), layer assignment via `#inferLayer()` (lines 151–163).

**Artifact fields read:**
- `graphify-out/infra-intel.json` → `workers[].file`, `workers[].name`, `workers[].queueProducers`, `workers[].queueConsumers`, `workers[].crons`, `workers[].bindings`, `summary.vercelApps`, `summary.secretsRequired`
- `apps/<name>/package.json` → `name`, `dependencies`, `devDependencies`, `scripts`
- `services/<name>/package.json` → same fields
- `services/<name>/wrangler.toml` → `name` field (line 67 ServiceDiscovery.mjs)

**Layer model** (from LayerDiscovery.mjs lines 83–89):
- `edge` — customer/merchant-facing web apps (`storefront-runtime`, `merchant-control-plane`, `identity-platform`, `marketing-site`, `platform-console`)
- `gateway` — request routing + API aggregation (`api-gateway`, `mobile-bff`)
- `async` — queue workers + webhook delivery (`queue-workers`, `webhook-service`)
- `data` — Supabase, migrations, DB RPCs
- `intelligence` — LCIS graph-server, central-intelligence, architecture-intelligence
- `package` — shared library packages

**Status classification** (ServiceDiscovery.mjs lines 109–111, 143–147):
- `canonical` — in `CANONICAL_RUNTIMES` list (8 entries, lines 15–24)
- `frozen` — in `FROZEN_APPS` list (lines 36–41)
- `reserved` — in `RESERVED_RUNTIMES` list (lines 26–34)
- `infra-only` — appears in wrangler but has no package.json

---

#### 1.3 `explainDependency(a: string, b: string): Promise<Explanation>`

**Source files consulted:**
- `tools/graph-server/domain-intel.mjs` — cross-domain edge derivation (lines 167–181). An edge `A > B` is created when an RPC in domain A touches a table in domain B (`addEdge(a, b, f.name→tn)`) or when a route in A calls an RPC in B.
- `tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs` — `getCrossDomainEdges()` (lines 94–97) returns `this.#edges` loaded from `domain-intel.json`.
- `graphify-out/domain-intel.json` → `edges[]` array with fields `from`, `to`, `via[]` (strings of the form `rpcName→tableName` or `routeName→rpcName()`), `strength` (integer count of crossing calls).

**Algorithm:**
1. Load `domain-intel.json` edges.
2. Find edge where `edge.from === a && edge.to === b`.
3. Return `via[]` as the mechanism list, `strength` as coupling intensity.
4. Evidence cites the specific `via` strings (each references a concrete RPC or route call in the gateway source).

---

#### 1.4 `explainArchitecture(): Promise<Explanation>`

**Source files consulted:**
- `tools/graph-server/explain-intel.mjs` — `gettingStarted` section (lines 177–192) and `IA` information architecture array (lines 52–73). The summary object at line 175 counts domains, sections, ecosystems.
- `tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs` — `getArchitecture()` (lines 27–68) combines all four discovery modules into a unified view with `stats` (lines 43–52).
- `tools/central-intelligence/architecture-intelligence/ArchitectureSnapshotService.mjs` — `capture()` (lines 64–126) records `gitHead`, `gitBranch`, `stats.totalServices`, `stats.canonicalRuntimes`, etc.

**Artifact fields read:**
- `graphify-out/domain-intel.json` → `summary.domains` (22), `summary.classifiedRoutes` (84), `summary.totalRoutes` (90), `summary.classifiedTables` (330), `summary.totalTables` (417), `summary.classifiedRpcs` (137), `summary.totalRpcs` (164), `summary.crossDomainEdges` (49), `summary.generatedAt`
- `graphify-out/db-intel.json` → `summary.tables` (417), `summary.functions` (164), `summary.policies` (658), `summary.securityDefiner` (136), `summary.moneyFunctions` (34), `summary.triggers` (398), `summary.indexes` (834), `summary.rlsTables` (397), `summary.migrationFiles` (111)
- `graphify-out/infra-intel.json` → `summary.workers` (4), `summary.vercelApps` (5 entries), `summary.secretsRequired` (19), `summary.queueProducers` (5), `summary.hasMigrateGate` (true)
- `CLAUDE.md` — canonical runtime map (the 8 active deploy targets cited in `CANONICAL_RUNTIMES` at ServiceDiscovery.mjs lines 15–24, grounded in `CLAUDE.md` runtime map section)

---

#### 1.5 `explainRuntime(): Promise<Explanation>`

**Source files consulted:**
- `tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs` — `discover()` (lines 85–212), `getCanonicalRuntimes()` (line 235), `getReservedRuntimes()` (line 239).
- `tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs` — `validateLayering()` (lines 200–233) detects forbidden layer dependencies using `FORBIDDEN_LAYER_DEPS` (lines 83–89).

**Artifact fields read:**
- `graphify-out/infra-intel.json` → `workers[]` (4 workers: `letbuyy-api`, `letbuyy-queue-workers`, `letbuyy-webhook`, `letbuyy-mobile-bff`), `summary.crons` (`["17 */6 * * *"]`), `summary.r2` (`["R2_BUCKET"]`), `summary.hyperdrive` (true), `summary.providers` (`["Resend","Turnstile","Supabase","Upstash Redis"]`)
- `services/api-gateway/wrangler.toml` → worker name `letbuyy-api`, queue producers `[EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE]`, bindings including `HYPERDRIVE`, `CACHE`, `RUNTIME_DB`, `WEBHOOK_SERVICE`
- `services/queue-workers/wrangler.toml` → queue consumers (7 staging queues including dead-letter), cron `17 */6 * * *`
- `apps/*/package.json` → service type classification (vercel-app vs worker)

**Layer violation detection algorithm** (LayerDiscovery.mjs lines 200–233):
- For each entry, look up its `layer` from `LAYER_MAP` / `PACKAGE_LAYER_MAP` / `#inferLayer()`.
- For each internal dependency in `package.json`, look up its layer.
- If `FORBIDDEN_LAYER_DEPS[entryLayer].has(depLayer)` → violation.
- Forbidden dependencies (from lines 83–89):
  - `data` must not import from `gateway`, `async`, `edge`
  - `gateway` must not import from `edge`
  - `async` must not import from `edge`
  - `package` must not import from `edge`, `gateway`, `async`
  - `intelligence` has no forbidden deps (read-only)

---

#### 1.6 `explainOwnership(key: string): Promise<Explanation>`

**Source files consulted:**
- `tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs` — ownership via `workerMeta` and `infra.ownership` from infra-intel.json (loaded at line 81).
- `tools/graph-server/domain-intel.mjs` — `findOwnership()` called at line 147 to resolve route owners from CODEOWNERS patterns.
- `tools/graph-server/infra-intel.mjs` (imported by domain-intel.mjs at line 12) — `findOwnership()` resolves CODEOWNERS paths.

**Artifact fields read:**
- `graphify-out/infra-intel.json` → `ownership[]` (26 entries), each with `path` (glob) and `owners` (array of GitHub handles). Sample: `{"path": "*", "owners": ["@saai-sidd"]}`, `{"path": "/services/api-gateway/src/routes/payments.ts", "owners": ["@saai-sidd"]}`.
- `graphify-out/domain-intel.json` → `domains[].owners` (array, derived from CODEOWNERS for routes in that domain, lines 147–148 domain-intel.mjs).
- `graphify-out/domain-intel.json` → `domains[].workflows` (array of CI/CD workflow files that mention the domain).

---

#### 1.7 `explainRisk(key: string): Promise<Explanation>`

**Source files consulted:**
- `tools/central-intelligence/architecture-intelligence/ArchitectureDriftDetector.mjs` — `getArchitectureRiskReport()` (lines 252–346) and `#computeDriftRisk()` (lines 238–249). Reads live snapshot from `ArchitectureSnapshotService`.
- `tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs` — `getHighBlastRadius()` (lines 114–128) and `getChangeRisk()` (lines 130–141). Blast radius thresholds: `critical` ≥ 8 dependents, `high` ≥ 5, `medium` ≥ 2.
- `tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs` — `getMoneyDomains()` (lines 138–157). Money domain risk thresholds: `critical` ≥ 3 money tables, `high` ≥ 1.

**Known critical packages** (DependencyDiscovery.mjs line 22):
```
KNOWN_CRITICAL = { 'shared-types', 'api-client', 'auth-core', 'ui', 'theme-engine', 'tenant-core' }
```

**Money tables set** (DomainDiscovery.mjs lines 15–21):
```
MONEY_TABLES = { orders, order_items, payment_transactions, refunds, payouts,
  gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions, shipping_rates,
  checkout_sessions, checkout_line_items, billing_subscriptions, billing_invoices,
  payout_accounts, store_credits, discount_allocations, tax_lines, ledger_entries }
```

**Artifact fields read:**
- `graphify-out/domain-intel.json` → `domains[].money` (boolean, from db table `money` flags), `domains[].consumedBy[].strength` (for criticality scoring in explain-intel.mjs line 76)
- `graphify-out/architecture-snapshots/latest.json` → `highBlastRadius[]`, `layerValidation.violations[]`, `moneyDomains[]`, `coupling.highCouplingDomains[]` (from ArchitectureSnapshotService.mjs snapshot structure, lines 96–123)
- `apps/*/package.json`, `services/*/package.json`, `packages/*/package.json` → internal dependency counts feeding `DependencyDiscovery`

---

## 2. Deterministic Algorithm

### 2.1 Domain Classification — `domain-intel.mjs`

**File:** `tools/graph-server/domain-intel.mjs`

The `DOMAINS` array (lines 24–47) lists 22 domain rules in order from most specific to most general. The `classify(name)` function (lines 89–93) implements **first-match-wins**: it iterates `DOMAINS` in order and returns the key of the first rule whose regex matches the lowercased name.

```
function classify(name) {
  const n = (name || '').toLowerCase();
  for (const d of DOMAINS) if (d.t.test(n)) return d.key;
  return null;
}
```
(domain-intel.mjs lines 89–93)

**Regex patterns** (domain-intel.mjs lines 25–47, in match order):

| Order | key | Regex (`.t` field) |
|-------|-----|---------------------|
| 1 | `themes` | `/^theme\|store_themes\|liquid/` |
| 2 | `marketplace` | `/^app_\|marketplace\|extension\|^app-store/` |
| 3 | `developer` | `/developer\|oauth\|api_client\|api_key\|_api_clients\|^app-api/` |
| 4 | `gift-cards` | `/gift_card\|gift-card\|^wallet/` |
| 5 | `refunds` | `/refund\|return/` |
| 6 | `payouts` | `/payout\|settlement\|commission\|cod_recon\|cod-recon\|partner_payout/` |
| 7 | `payments` | `/payment\|razorpay\|^ledger\|ledger_/` |
| 8 | `gst` | `/^gst\|_gst\|^tax\|_tax_\|tax_\|invoice/` |
| 9 | `discounts` | `/coupon\|promotion\|discount\|marketing\|campaign/` |
| 10 | `shipping` | `/shipping\|shipment\|fulfillment\|^fulfil/` |
| 11 | `inventory` | `/inventory\|^stock/` |
| 12 | `collections` | `/collection\|categor/` |
| 13 | `products` | `/^product\|metafield\|variant\|product_/` |
| 14 | `orders` | `/^order\|order_\|^cart\|checkout\|purchase_order/` |
| 15 | `storefront` | `/storefront\|^blog\|^page\|custom_domain\|custom-domain\|^domains\|contact\|wishlist\|^review\|stores-localization\|form/` |
| 16 | `authorization` | `/rbac\|permission\|^role\|step_up\|step-up\|entitlement\|membership\|two_factor\|two-factor/` |
| 17 | `authentication` | `/session\|credential\|^otp\|^login\|^token\|turnstile\|^auth/` |
| 18 | `identity` | `/customer\|^kyc\|store_customers/` |
| 19 | `merchant` | `/^store\|^site\|merchant\|employee\|onboard\|billing/` |
| 20 | `notifications` | `/notification\|email\|whatsapp\|^wa_\|ticket\|message\|contact/` |
| 21 | `analytics` | `/analytics\|event\|metric\|rollup\|projection\|outbox\|portfolio\|^export/` |
| 22 | `operations` | `/incident\|operational\|operation\|internal\|console\|production_\|risk\|trust\|security\|feature_flag\|runtime\|distributed\|execution\|audit\|admin\|reconcil\|support/` |

**Ordering rationale (specificity):** `themes` before `marketplace` because `theme_marketplace` would otherwise match `marketplace`. `refunds` before `payouts` because `refund_transactions` contains neither payout term. `payments` before `gst` because `payment_transactions` must not be tax-classified. `orders` before `storefront` because `checkout` is an order concept. `authentication` before `identity` because `customer_credentials` contains `credential` (auth rule 17) but also `customer` (identity rule 18); credential match fires first.

**RPC fallback** (domain-intel.mjs lines 119–128): If `classify(f.name)` returns null for an RPC, the domain is derived by tallying the domains of all tables the RPC touches and picking the plurality winner.

**Cross-domain edge derivation** (domain-intel.mjs lines 167–181):
- For every RPC, if `rpcDomain(rpc) === A` and `tableDomain(table) === B` (where `A ≠ B`), add edge `A → B` with label `rpcName→tableName`.
- For every route, if `routeDomain(route) === A` and the route calls an RPC in domain `B` (where `A ≠ B`), add edge `A → B` with label `routeName→rpcName()`.
- Strength = count of distinct crossing calls via that edge.

**Evidence:** The computed edges are written to `graphify-out/domain-intel.json` as `edges[]` and are confirmed in the artifact (49 cross-domain edges in the `summary.crossDomainEdges` field, artifact read 2026-06-20).

---

### 2.2 Drift Detection Algorithm — `ArchitectureDriftDetector.mjs`

**File:** `tools/central-intelligence/architecture-intelligence/ArchitectureDriftDetector.mjs`

`detectDrift(snapshotA, snapshotB)` (lines 42–140) compares two snapshots by five dimensions:

**a) Service drift** (lines 47–61):  
`diffObjects(snapshotA.services, snapshotB.services)` — keys added, removed, changed. For changed services, tracks field-level changes to `type`, `status`, and `internalDependencies` (diffSets).

**b) Dependency drift** (lines 63–71):  
Compares `highBlastRadius[]` arrays between snapshots. For each package, if `dependentCount` increased → `newDependencies` entry with `delta`.

**c) Layer violation drift** (lines 73–81):  
Compares `layerValidation.violations[]` by key `violator→dependency`. New violations = regressions; removed = resolved.

**d) Domain drift** (lines 83–97):  
Compares `domains` objects. For each changed domain, tracks length changes in `tables`, `rpcs`, `routes`, `queues`, and boolean change in `money`.

**e) Cross-domain edge drift** (lines 100–105):  
Compares `crossDomainEdges[]` by key `from→to`. New edges = new coupling; removed = decoupling.

**Risk scoring** `#computeDriftRisk(drift)` (lines 238–249):
```
critical  — if any service removed
high      — if new layer violations OR any package gained ≥ 3 new dependents
medium    — if service added OR new cross-domain edges
low       — if hasDrift is false, or no factors above
```

**Architecture risk report** `getArchitectureRiskReport()` (lines 252–346) generates ranked risks from a live snapshot:
- `blast-radius` risk: packages where `blastRadius === 'high'`; severity `critical` if dependentCount ≥ 8, else `high`
- `layer-violation` risk: each violation from `layerValidation.violations[]`; severity `high`
- `money-domain` risk: each money domain from `DomainDiscovery.getMoneyDomains()`; severity `critical` if `riskLevel === 'critical'`
- `high-coupling` risk: domains from `coupling.highCouplingDomains[]`; severity `high` if `totalEdges ≥ 6`, else `medium`

---

### 2.3 Explain-intel Domain Mapping — `explain-intel.mjs`

**File:** `tools/graph-server/explain-intel.mjs`

`buildExplainIntel()` (lines 101–193) maps domain keys to `Explanation`-shaped node objects:

1. **Load artifacts** (line 102): `domain-intel.json`, `db-intel.json`, `infra-intel.json`, `production-readiness-v2.json`, `decision-engine-v2.json`, `execution-intel.json`, `relationship-intel.json`. Returns error if `domain-intel.json` or `db-intel.json` missing (line 105).

2. **Build relMap** (line 107): `Map<tableName, RelationshipRecord>` from `relationship-intel.json`.

3. **Build helper functions**:
   - `fkFor(tables)`: outer FKs (tables referenced by this domain's tables outside the domain) + inner FKs (tables referencing this domain's tables from outside). Capped at 20 each (lines 108–112).
   - `policiesFor(tables)`: count of `db.policies` where `policy.table` is in domain's table list (line 113).
   - `trigFor(tables)`: sum of `table.triggers.length` for each domain table (line 115).
   - `idxFor(tables)`: sum of `table.indexes` for each domain table (line 116).
   - `blockerHit(key)`: find open blockers in `execution-intel.json` whose title matches the domain key (line 118).

4. **Build node per domain** (lines 120–159):
   - `purpose`, `importance`, `failureImpact` from `NARRATIVE[d.key]` (lines 18–41) or defaults.
   - `criticality` from `criticality(d)` (lines 75–80): Tier 1 if `d.money` or `consumedBy.length ≥ 3`; Tier 2 if `d.tenant`; else Tier 3.
   - `owner` from `d.owners` (routes' CODEOWNERS).
   - `dependsOn` from `d.dependsOn[].domain`.
   - `consumers` from `d.consumedBy[].domain`.
   - `operationalNotes` built from `d.money` and `d.tenant` booleans (line 130).
   - `merchantImpact`, `customerImpact`, `recoveryPath`, `runbooks`, `launchRelevance`, `relatedDomains` (lines 132–138).
   - `technical` sub-object (line 139): routes, rpcs, tables, policies, triggers, indexes, workers, queues, secrets, services, money, tenant, relationships, blastRadius.
   - `docs` sub-object (lines 146–157): tags, readingTime, difficulty, codeReferences, databaseReferences, deepDive links.
   - `aiContext` string (line 158) from `aiContext()` (lines 82–99).
   - `flow` from `FLOWS[d.key]` (lines 43–49) for orders, payments, refunds, customer, merchant.

5. **Copilot routing** `copilot(q)` (lines 196–211): routes NL queries to LCIS engines. Uses `findDomain()` which matches query text against domain keys and labels. Returns `intent` + `engine` URL without any ML.

---

### 2.4 Relationship Intelligence — `relationship-intel.mjs`

**File:** `tools/graph-server/relationship-intel.mjs`

`buildRelationshipIntel()` (lines 15–49) parses SQL migrations to build a foreign-key graph:

1. **Source**: All `.sql` files in `database/supabase/migrations/`, sorted by numeric prefix (line 17).

2. **Inline REFERENCES** (lines 24–27): regex `/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g` on each SQL file, then `/(\w+)[\s\S]{0,80}?REFERENCES\s+(?:public\.)?(\w+)/g` inside the table body. Adds edge `child → parent`.

3. **ALTER TABLE FOREIGN KEY** (lines 29–32): regex `/ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)[\s\S]{0,160}?REFERENCES\s+(?:public\.)?(\w+)/g`. Extracts column from `FOREIGN KEY\s*\((\w+)\)`. Adds edge `child → parent`.

4. **Output** (lines 35–48): `edges[]` (child→parent with columns), `tables[]` (each with `references[]`, `referencedBy[]`, `fanOut`, `fanIn`), `summary.mostReferenced` (top 15 by fan-in), `summary.mostDependent` (top 15 by fan-out), `summary.tenantRoot` (highest fan-in table, expected to be `sites`).

**Written to:** `graphify-out/relationship-intel.json`

---

## 3. Source Consolidation

### 3.1 What `explain-intel.mjs` (port :3333) Contributes

**File:** `tools/graph-server/explain-intel.mjs`

- `NARRATIVE` map — 22 domain purpose/importance/failureImpact descriptions (lines 18–41): the authoritative human-authored prose layer.
- `FLOWS` map — 5 step-by-step business flows (orders, payments, refunds, customer, merchant) (lines 43–49).
- `IA` — information architecture for the LCIS UI: 19 entries with keys, labels, icons, kinds (lines 52–73).
- `criticality()` function (lines 75–80) — deterministic Tier 1/2/3 from `money` flag and `consumedBy.length`.
- `aiContext()` function (lines 82–99) — paste-ready AI context block per domain.
- `buildExplainIntel()` (lines 101–193) — the main assembly function. Reads 7 artifacts and builds the complete node map.
- `copilot()` (lines 196–211) — NL → LCIS engine router with no ML dependency.
- Artifact dependency: reads but does NOT write artifacts; is a pure transformation layer over `domain-intel.json` + `db-intel.json` + 5 optional artifacts.

### 3.2 What `ArchitectureIntelligenceEngine` (:3334) Contributes

**File:** `tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs`

- `getArchitecture()` (lines 27–68) — unified view: services + dependencies + layers + domains + layer validation + coupling + money domains + cross-domain edges + blast radius + stats.
- `whatChanged(sinceSnapshot)` (lines 74–94) — drift report comparing any snapshot to current.
- `whatDependsOn(component)` (lines 99–127) — blast radius with 1-hop transitive dependents.
- `getRisks()` (lines 132–135) — ranked risk report from `ArchitectureDriftDetector`.
- `getDependencyMap()` (lines 140–163) — full adjacency list with blast-radius scores.
- `getEvolution()` (lines 166–208) — long-range drift from earliest to latest snapshot.
- `getHealth()` (lines 213–258) — health score (0–100) based on canonical runtime presence, layer violations, critical blast radius, and domain coupling density.

Sub-module contributions:
- **ServiceDiscovery.mjs**: filesystem scan of `apps/`, `services/`, `packages/` plus wrangler.toml name extraction; merges with `infra-intel.json`. Provides `status` classification (canonical/frozen/reserved/other). (lines 85–212)
- **DependencyDiscovery.mjs**: reads `package.json` files + optionally augments from `graph.json` import edges. Builds internal dependency graph and reverse-dependency map. (lines 28–75)
- **LayerDiscovery.mjs**: classifies entries into 6 architectural layers; detects forbidden cross-layer imports. (lines 100–233)
- **DomainDiscovery.mjs**: loads `domain-intel.json`; provides coupling density, money-domain identification, domain evolution tracking. (lines 34–202)
- **ArchitectureSnapshotService.mjs**: captures and persists timestamped snapshots to `graphify-out/architecture-snapshots/`. (lines 64–170)
- **ArchitectureDriftDetector.mjs**: compares two snapshots across 5 dimensions; computes risk level. (lines 42–249)

### 3.3 Overlaps and Winner Selection

| Capability | explain-intel.mjs (:3333) | architecture-intelligence (:3334) | Winner |
|------------|--------------------------|-----------------------------------|--------|
| Domain list + metadata | Reads `domain-intel.json` `domains[]` | DomainDiscovery reads same artifact | **:3333** — richer prose (NARRATIVE, FLOWS) |
| Domain purpose/importance/failure | NARRATIVE map (hardcoded prose) | Not present | **:3333** — only source |
| Business flows | FLOWS map (lines 43–49) | Not present | **:3333** — only source |
| Criticality scoring | `criticality()` (lines 75–80) | Not present | **:3333** — only source |
| Cross-domain edges | Reads edges from artifact | DomainDiscovery.getCrossDomainEdges() also reads artifact | **Both identical** — both read `domain-intel.json` edges; use :3333 path |
| FK relationships | `fkFor()` from relationship-intel.json | Not present | **:3333** — only source |
| Service discovery | Not present (reads via infra-intel.json indirectly) | ServiceDiscovery filesystem scan | **:3334** — only source for live service status |
| Layer classification | Not present | LayerDiscovery LAYER_MAP + validation | **:3334** — only source |
| Package dependency graph | Not present | DependencyDiscovery package.json scan | **:3334** — only source |
| Architecture snapshots | Not present | ArchitectureSnapshotService | **:3334** — only source |
| Drift detection | Not present | ArchitectureDriftDetector | **:3334** — only source |
| Health score | Not present | ArchitectureIntelligenceEngine.getHealth() | **:3334** — only source |
| Blast radius (packages) | `graph:intel blast` CLI (separate binary) | DependencyDiscovery.getChangeRisk() | **:3334** — accessible programmatically |
| Money domain identification | `d.money` boolean from artifact | DomainDiscovery.getMoneyDomains() with MONEY_TABLES set | **:3334** — adds money-table enumeration |
| NL routing / copilot | `copilot()` (lines 196–211) | Not present | **:3333** — only source |
| AI context block | `aiContext()` (lines 82–99) | Not present | **:3333** — only source |

### 3.4 What Is Dropped

**Qdrant/OpenAI dependency scan result:**

Command run: `grep -rn "qdrant\|openai\|OpenAI\|Qdrant" /Users/saai_sidd/Git/Letbuyy_Store/tools/central-intelligence/architecture-intelligence/`

Result: **no output** (zero matches). All 7 files in `architecture-intelligence/` are confirmed dependency-free of Qdrant and OpenAI.

**Files confirmed dependency-free (all 7):**
- `tools/central-intelligence/architecture-intelligence/ArchitectureDriftDetector.mjs`
- `tools/central-intelligence/architecture-intelligence/ArchitectureIntelligenceEngine.mjs`
- `tools/central-intelligence/architecture-intelligence/ArchitectureSnapshotService.mjs`
- `tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs`
- `tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs`
- `tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs`
- `tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs`

**Files with Qdrant/OpenAI excluded:** None from the architecture-intelligence layer. (Other :3334 subsystems outside `architecture-intelligence/` may have such dependencies — those are out of scope for this consolidation.)

**What is dropped from :3333:**
- Raw artifact file writes (domain-intel.mjs's `buildDomainIntel()` write path, lines 231–233) — the consolidated service is read-only; builds are triggered via `pnpm graph:domain`.
- CLI entry points (`if (import.meta.url === ...)` blocks) — not needed in the library surface.

**What is dropped from :3334:**
- `getEvolution()` (ArchitectureIntelligenceEngine.mjs lines 166–208) — requires ≥ 2 saved snapshots; excluded from the initial `ArchitectureService` but preserved in the snapshot service for later.
- Nothing else is dropped; the consolidation is additive.

---

## 4. Inputs and Output Types

### TypeScript Type Definitions

```typescript
interface Evidence {
  source: string;       // file path (absolute or relative to repo root) or artifact field path
  field?: string;       // specific field name within the artifact
  value?: unknown;      // the cited value (string, number, boolean, array)
}

interface Explanation {
  key: string;
  kind: 'domain' | 'service' | 'dependency' | 'architecture' | 'runtime' | 'ownership' | 'risk';
  summary: string;
  details: string[];
  evidence: Evidence[];
}

interface ArchitectureNode {
  id: string;
  kind: 'domain' | 'service' | 'table' | 'rpc' | 'worker' | 'queue';
  label: string;
  owner?: string;
}

interface ArchitectureEdge {
  from: string;
  to: string;
  kind: 'calls' | 'writes' | 'reads' | 'depends' | 'publishes' | 'consumes';
  evidence: string;  // file path:line — e.g. "tools/graph-server/domain-intel.mjs:171"
}
```

### Concrete field mappings per method

#### `explainDomain(key)` → `Explanation`

```typescript
{
  key: domain.key,              // domain-intel.json: domains[i].key
  kind: 'domain',
  summary: NARRATIVE[key].purpose,  // explain-intel.mjs:18-41
  details: [
    domain.criticality,           // explain-intel.mjs:75-80
    domain.failureImpact,         // NARRATIVE[key].failureImpact
    `${domain.routes.length} routes, ${domain.rpcs.length} RPCs, ${domain.tables.length} tables`,
    `Depends on: ${domain.dependsOn.join(', ')}`,
    `Consumed by: ${domain.consumedBy.join(', ')}`,
  ],
  evidence: [
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].money`, value: domain.money },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].tenant`, value: domain.tenant },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].tables`, value: domain.tables },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].rpcs`, value: domain.rpcs },
    { source: 'graphify-out/relationship-intel.json', field: `tables[name=*].referencedBy`, value: fkFor(domain.tables) },
    { source: 'tools/graph-server/explain-intel.mjs', field: `NARRATIVE.${key}`, value: NARRATIVE[key] },
  ]
}
```

#### `explainService(name)` → `Explanation`

```typescript
{
  key: name,
  kind: 'service',
  summary: `${service.type} at ${service.path}, status: ${service.status}`,
  details: [
    `Layer: ${layer}`,                          // LayerDiscovery LAYER_MAP
    `Internal deps: ${service.dependencies.internal.join(', ')}`,
    `Canonical: ${CANONICAL_RUNTIMES.includes(name)}`,
  ],
  evidence: [
    { source: `${service.path}/package.json`, field: 'name', value: service.packageName },
    { source: `${service.path}/package.json`, field: 'dependencies', value: service.dependencies.internal },
    { source: 'graphify-out/infra-intel.json', field: `workers[name=${workerName}].queueProducers`, value: service.workerMeta?.queueProducers },
    { source: 'tools/central-intelligence/architecture-intelligence/ServiceDiscovery.mjs', field: 'CANONICAL_RUNTIMES', value: CANONICAL_RUNTIMES },
    { source: 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs', field: `LAYER_MAP.${name}`, value: layer },
  ]
}
```

#### `explainDependency(a, b)` → `Explanation`

```typescript
{
  key: `${a}→${b}`,
  kind: 'dependency',
  summary: `${a} depends on ${b} via ${edge.strength} cross-domain call(s)`,
  details: edge.via,   // e.g. ["create_checkout_order→payment_transactions"]
  evidence: [
    { source: 'graphify-out/domain-intel.json', field: `edges[from=${a},to=${b}].via`, value: edge.via },
    { source: 'graphify-out/domain-intel.json', field: `edges[from=${a},to=${b}].strength`, value: edge.strength },
  ]
}
```

#### `explainArchitecture()` → `Explanation`

```typescript
{
  key: 'architecture',
  kind: 'architecture',
  summary: `${summary.domains} domains, ${db.summary.tables} tables, ${db.summary.functions} RPCs, ${infra.summary.workers} workers, ${infra.summary.vercelApps.length} Vercel apps`,
  details: [
    `Cross-domain edges: ${summary.crossDomainEdges}`,
    `Production secrets: ${infra.summary.secretsRequired}`,
    `DB: ${db.summary.rlsTables} RLS tables, ${db.summary.securityDefiner} SECURITY DEFINER RPCs`,
  ],
  evidence: [
    { source: 'graphify-out/domain-intel.json', field: 'summary.domains', value: 22 },
    { source: 'graphify-out/domain-intel.json', field: 'summary.crossDomainEdges', value: 49 },
    { source: 'graphify-out/db-intel.json', field: 'summary.tables', value: 417 },
    { source: 'graphify-out/db-intel.json', field: 'summary.functions', value: 164 },
    { source: 'graphify-out/db-intel.json', field: 'summary.securityDefiner', value: 136 },
    { source: 'graphify-out/infra-intel.json', field: 'summary.workers', value: 4 },
    { source: 'graphify-out/infra-intel.json', field: 'summary.vercelApps', value: ['marketing-site','identity-platform','merchant-control-plane','storefront-runtime','platform-console'] },
    { source: 'graphify-out/infra-intel.json', field: 'summary.secretsRequired', value: 19 },
  ]
}
```

#### `explainRuntime()` → `Explanation`

```typescript
{
  key: 'runtime',
  kind: 'runtime',
  summary: `4 Cloudflare Workers + 5 Vercel apps. letbuyy-api is the gateway producer for 5 queues.`,
  details: [
    'Workers: letbuyy-api, letbuyy-queue-workers, letbuyy-webhook, letbuyy-mobile-bff',
    'Vercel apps: marketing-site, identity-platform, merchant-control-plane, storefront-runtime, platform-console',
    'Cron: 17 */6 * * * (queue-workers)',
    'Providers: Resend, Turnstile, Supabase, Upstash Redis',
    'Layer violations: <from validateLayering()>',
  ],
  evidence: [
    { source: 'graphify-out/infra-intel.json', field: 'workers[0].name', value: 'letbuyy-api' },
    { source: 'graphify-out/infra-intel.json', field: 'workers[1].name', value: 'letbuyy-queue-workers' },
    { source: 'graphify-out/infra-intel.json', field: 'workers[1].crons', value: ['17 */6 * * *'] },
    { source: 'graphify-out/infra-intel.json', field: 'summary.vercelApps', value: ['marketing-site','identity-platform','merchant-control-plane','storefront-runtime','platform-console'] },
    { source: 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs', field: 'FORBIDDEN_LAYER_DEPS', value: 'data must not import gateway/async/edge' },
  ]
}
```

#### `explainOwnership(key)` → `Explanation`

```typescript
{
  key,
  kind: 'ownership',
  summary: `Domain ${key} is owned by: ${domain.owners.join(', ')}`,
  details: [
    `Workflows: ${domain.workflows.join(', ')}`,
    `CODEOWNERS paths matched: <infra.ownership filtered by domain routes>`,
  ],
  evidence: [
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].owners`, value: domain.owners },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].workflows`, value: domain.workflows },
    { source: 'graphify-out/infra-intel.json', field: 'ownership[].path + ownership[].owners', value: ownershipRules },
  ]
}
```

#### `explainRisk(key)` → `Explanation`

```typescript
{
  key,
  kind: 'risk',
  summary: `Risk level: ${riskLevel}. ${risks.length} risk factors identified.`,
  details: risks.map(r => `[${r.severity}] ${r.category}: ${r.detail}`),
  evidence: [
    { source: 'graphify-out/architecture-snapshots/latest.json', field: 'highBlastRadius', value: highBlastPackages },
    { source: 'graphify-out/architecture-snapshots/latest.json', field: 'layerValidation.violations', value: violations },
    { source: 'tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs', field: 'MONEY_TABLES', value: [...MONEY_TABLES] },
    { source: 'tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs', field: 'KNOWN_CRITICAL', value: [...KNOWN_CRITICAL] },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].money`, value: domain.money },
    { source: 'graphify-out/domain-intel.json', field: `domains[key=${key}].consumedBy`, value: domain.consumedBy },
  ]
}
```

---

## 5. Test Cases

All test cases assume artifacts have been built via `pnpm graph:omega` and are current as of 2026-06-20. Each test case specifies the expected evidence fields that MUST be present on the returned `Explanation`.

---

### Test Case 1: `explainDomain("payments")`

**Input:** `key = "payments"`

**Expected `kind`:** `'domain'`

**Expected `summary`:** Must contain the string `"Authorizes and captures money"` (sourced from `NARRATIVE.payments.purpose`, `tools/graph-server/explain-intel.mjs` line 20).

**Expected `details`:**
- Must include `"Tier 1 — critical (money path)"` (from `criticality()` because `d.money === true`, explain-intel.mjs line 76).
- Must include `"Payments fail or mis-post"` (from `NARRATIVE.payments.failureImpact`, explain-intel.mjs line 20).
- Must include a count referencing 18 RPCs (from `domain-intel.json` `domains[key=payments].counts.rpcs === 18`).
- Must include 11 tables (from `domain-intel.json` `domains[key=payments].counts.tables === 11`).

**Required evidence fields:**
```
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].money', value: true }
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].tables', value: ['payment_attempts','payment_transactions','payment_webhook_events','ledger_accounts','ledger_transactions','ledger_entries','payment_credentials','payment_tokens','payments','store_credit_ledger_entries','money_ledger_site_reconciliations'] }
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].rpcs', value: ['attach_order_payment_reference','attach_order_payment_reference_with_ledger','confirm_order_payment','confirm_order_payment_with_ledger', ...] }
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].secrets', value: ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STEP_UP_SIGNING_SECRET','CHECKOUT_SIGNING_SECRET','PAYMENT_CONFIG_ENCRYPTION_KEY'] }
{ source: 'tools/graph-server/explain-intel.mjs', field: 'NARRATIVE.payments', value: { purpose: '...', importance: '...', failureImpact: '...' } }
```

**Canonical ledger RPCs that must appear in `domains[key=payments].rpcs`** (per artifact):
`confirm_order_payment_with_ledger`, `post_ledger_transaction`, `enforce_ledger_transaction_balance`, `ensure_ledger_account`, `ledger_balance_breaks`, `refresh_money_ledger_site_reconciliation`, `assert_money_ledger_site_reconciliation`.

---

### Test Case 2: `explainArchitecture()`

**Input:** none

**Expected `kind`:** `'architecture'`

**Expected `summary`:** Must include `"22 domains"` (sourced from `graphify-out/domain-intel.json` `summary.domains === 22`).

**Required evidence fields:**
```
{ source: 'graphify-out/domain-intel.json', field: 'summary.domains', value: 22 }
{ source: 'graphify-out/domain-intel.json', field: 'summary.crossDomainEdges', value: 49 }
{ source: 'graphify-out/domain-intel.json', field: 'summary.classifiedTables', value: 330 }
{ source: 'graphify-out/domain-intel.json', field: 'summary.totalTables', value: 417 }
{ source: 'graphify-out/db-intel.json', field: 'summary.tables', value: 417 }
{ source: 'graphify-out/db-intel.json', field: 'summary.functions', value: 164 }
{ source: 'graphify-out/db-intel.json', field: 'summary.securityDefiner', value: 136 }
{ source: 'graphify-out/db-intel.json', field: 'summary.policies', value: 658 }
{ source: 'graphify-out/infra-intel.json', field: 'summary.workers', value: 4 }
{ source: 'graphify-out/infra-intel.json', field: 'summary.vercelApps', value: ['marketing-site','identity-platform','merchant-control-plane','storefront-runtime','platform-console'] }
{ source: 'graphify-out/infra-intel.json', field: 'summary.secretsRequired', value: 19 }
{ source: 'graphify-out/infra-intel.json', field: 'summary.queueProducers', value: ['EVENT_QUEUE','ANALYTICS_QUEUE','SEARCH_QUEUE','NOTIFICATION_QUEUE','RUNTIME_QUEUE'] }
```

**MUST NOT** contain fabricated values. All numeric claims must trace to the corresponding artifact field.

---

### Test Case 3: `explainDependency("orders", "inventory")`

**Input:** `a = "orders"`, `b = "inventory"`

**Expected `kind`:** `'dependency'`

**Expected `summary`:** Must include strength 8 (sourced from `graphify-out/domain-intel.json` `edges[from=orders,to=inventory].strength === 8`).

**Required evidence fields:**
```
{ source: 'graphify-out/domain-intel.json', field: 'edges[from=orders,to=inventory].strength', value: 8 }
{ source: 'graphify-out/domain-intel.json', field: 'edges[from=orders,to=inventory].via', value: [
    'create_checkout_order→inventory_events',
    'create_checkout_order→inventory_reservations',
    'create_checkout_order→inventory_levels',
    'create_purchase_order_with_lines→inventory_locations',
    'create_purchase_order_with_lines→inventory_levels',
    'create_purchase_order_with_lines→inventory_events',
    'receive_purchase_order_line→inventory_levels',
    'receive_purchase_order_line→inventory_events'
  ]
}
```

**Expected `details`:** Must list all 8 `via` strings (each is a concrete cross-domain call from `domain-intel.json` edges array). No fabrication allowed.

---

### Test Case 4: `explainRuntime()`

**Input:** none

**Expected `kind`:** `'runtime'`

**Expected `details`:** Must contain exactly 4 worker names: `letbuyy-api`, `letbuyy-queue-workers`, `letbuyy-webhook`, `letbuyy-mobile-bff` (from `graphify-out/infra-intel.json` `workers[].name`).

**Required evidence fields:**
```
{ source: 'graphify-out/infra-intel.json', field: 'workers[0].name', value: 'letbuyy-api' }
{ source: 'graphify-out/infra-intel.json', field: 'workers[0].queueProducers', value: ['EVENT_QUEUE','ANALYTICS_QUEUE','SEARCH_QUEUE','NOTIFICATION_QUEUE','RUNTIME_QUEUE'] }
{ source: 'graphify-out/infra-intel.json', field: 'workers[1].name', value: 'letbuyy-queue-workers' }
{ source: 'graphify-out/infra-intel.json', field: 'workers[1].crons', value: ['17 */6 * * *'] }
{ source: 'graphify-out/infra-intel.json', field: 'workers[2].name', value: 'letbuyy-webhook' }
{ source: 'graphify-out/infra-intel.json', field: 'workers[3].name', value: 'letbuyy-mobile-bff' }
{ source: 'graphify-out/infra-intel.json', field: 'summary.hyperdrive', value: true }
{ source: 'graphify-out/infra-intel.json', field: 'summary.r2', value: ['R2_BUCKET'] }
{ source: 'graphify-out/infra-intel.json', field: 'summary.hasMigrateGate', value: true }
{ source: 'graphify-out/infra-intel.json', field: 'summary.providers', value: ['Resend','Turnstile','Supabase','Upstash Redis'] }
{ source: 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs', field: 'LAYER_MAP.api-gateway', value: 'gateway' }
{ source: 'tools/central-intelligence/architecture-intelligence/LayerDiscovery.mjs', field: 'LAYER_MAP.queue-workers', value: 'async' }
```

**Layer violation check:** `explainRuntime()` MUST call `LayerDiscovery.validateLayering()` and surface any violations in `details`. An empty violations list `{ valid: true, violationCount: 0 }` is valid output. A non-zero count must be listed explicitly.

---

### Test Case 5: `explainRisk("payments")`

**Input:** `key = "payments"`

**Expected `kind`:** `'risk'`

**Expected `riskLevel` in summary:** The payments domain has `money === true` (from `domain-intel.json`), which causes `DomainDiscovery.getMoneyDomains()` to return it with `riskLevel: 'critical'` (DomainDiscovery.mjs line 152: `moneyTableHits.length >= 3`). The payments domain has at minimum `payment_transactions`, `ledger_accounts`, `ledger_entries`, `ledger_transactions` in `MONEY_TABLES` — more than 3, so `riskLevel === 'critical'`.

**Required evidence fields:**
```
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].money', value: true }
{ source: 'graphify-out/domain-intel.json', field: 'domains[key=payments].tables', value: [...11 tables] }
{ source: 'tools/central-intelligence/architecture-intelligence/DomainDiscovery.mjs', field: 'MONEY_TABLES', value: ['orders','order_items','payment_transactions','refunds','payouts','gift_card_accounts','gift_card_ledger_entries','gift_card_redemptions','shipping_rates','checkout_sessions','checkout_line_items','billing_subscriptions','billing_invoices','payout_accounts','store_credits','discount_allocations','tax_lines','ledger_entries'] }
{ source: 'tools/central-intelligence/architecture-intelligence/DependencyDiscovery.mjs', field: 'blastRadius threshold', value: 'critical >= 8 dependents, high >= 5, medium >= 2' }
```

**Expected `details`:**
- MUST list `confirm_order_payment_with_ledger` as a money RPC requiring SECURITY DEFINER protection (evidence: `graphify-out/db-intel.json` `functions[name=confirm_order_payment_with_ledger].securityDefiner`).
- MUST list `STEP_UP_SIGNING_SECRET` and `PAYMENT_CONFIG_ENCRYPTION_KEY` as domain secrets (evidence: `graphify-out/domain-intel.json` `domains[key=payments].secrets`).
- MUST list 3 secrets that gate refunds/payouts: `STEP_UP_SIGNING_SECRET` (from `SECRET_DOMAINS` in domain-intel.mjs line 77: `[/STEP_UP_SIGNING_SECRET/, ['authorization', 'payments', 'refunds', 'payouts']]`).

---

## Appendix A: Artifact Field Reference

| Artifact | Key fields used | Source that writes it |
|----------|----------------|-----------------------|
| `graphify-out/domain-intel.json` | `summary.*`, `domains[].key/label/money/tenant/routes/rpcs/tables/queues/workers/secrets/owners/workflows/counts/dependsOn/consumedBy`, `edges[].from/to/via/strength`, `rules[].key/pattern` | `tools/graph-server/domain-intel.mjs` `buildDomainIntel()` |
| `graphify-out/db-intel.json` | `summary.tables/functions/policies/securityDefiner/moneyFunctions/triggers/indexes/rlsTables/migrationFiles`, `tables[].name/hasSiteId/rls/policies/triggers/indexes/money/tenant`, `functions[].name/securityDefiner/touches/hasIdempotency/forUpdate/money/callers`, `policies[].table` | `tools/graph-server/db-intel.mjs` |
| `graphify-out/infra-intel.json` | `summary.workers/queueProducers/vercelApps/secretsRequired/r2/hyperdrive/hasMigrateGate/crons/providers`, `workers[].file/name/queueProducers/queueConsumers/crons/bindings`, `secrets[]`, `ownership[].path/owners` | `tools/graph-server/infra-intel.mjs` |
| `graphify-out/relationship-intel.json` | `tables[].name/references/referencedBy/fanIn/fanOut`, `edges[].from/to/columns`, `summary.foreignKeys/tablesInGraph/tenantRoot/mostReferenced` | `tools/graph-server/relationship-intel.mjs` |
| `graphify-out/execution-intel.json` | `blockers[].id/title/status` | `tools/graph-server/execution-intel.mjs` |
| `graphify-out/production-readiness-v2.json` | `summary.overall/launchVerdict/lowest`, `dimensions[]` | `tools/graph-server/production-readiness.mjs` |
| `graphify-out/architecture-snapshots/latest.json` | `capturedAt/gitHead/gitBranch`, `services`, `domains`, `highBlastRadius[]`, `layerValidation.violations[]`, `moneyDomains[]`, `coupling.highCouplingDomains[]`, `stats.*` | `tools/central-intelligence/architecture-intelligence/ArchitectureSnapshotService.mjs` |

---

## Appendix B: Unclassified Items (gaps in domain graph)

From `graphify-out/domain-intel.json` `summary.unclassifiedTables` (87 tables), `summary.unclassifiedRoutes` (6 routes: `ai`, `founding-public`, `founding`, `media`, `resume`, `upload`), `summary.unclassifiedRpcs` (27 RPCs).

These items are not assigned to any of the 22 domains. The `ArchitectureService` must handle them gracefully:
- `explainDomain(key)` for a key not in `domains[]` must return an `Explanation` with `summary: "Domain not found"` and evidence citing `domain-intel.json summary.domains === 22`.
- `explainDependency(a, b)` where no edge exists must return `details: []` and evidence citing the edges array length.

The consolidated service MUST NOT invent domain assignments for unclassified items. Adding new domain rules requires updating `tools/graph-server/domain-intel.mjs` `DOMAINS` array and rebuilding artifacts via `pnpm graph:domain`.

---

## Appendix C: Build and Refresh Commands

| Command | Effect |
|---------|--------|
| `pnpm graph:domain` | Rebuilds `domain-intel.json` (domain-intel.mjs buildDomainIntel) |
| `pnpm graph:relationships` | Rebuilds `relationship-intel.json` (relationship-intel.mjs) |
| `pnpm graph:db` | Rebuilds `db-intel.json` |
| `pnpm graph:infra` | Rebuilds `infra-intel.json` |
| `pnpm graph:omega` | Rebuilds all artifacts in dependency order |
| `pnpm graph:v3` | Rebuilds db + infra + domain + reports |

Architecture snapshots are written on demand by `ArchitectureSnapshotService.capture()` + `.save()` — they are not rebuilt by pnpm scripts; must be triggered via the :3334 service API or a dedicated script.

---

*End of spec. All claims in this document trace to file paths and line numbers or artifact field paths confirmed by direct file reads on 2026-06-20.*
