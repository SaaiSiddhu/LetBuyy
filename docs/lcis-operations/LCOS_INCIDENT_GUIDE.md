# LCOS Incident Guide — "What is broken?"

**Phase:** 6 — LCOS (LetBuyy Central Operations System)
**Service:** `IncidentOperationsService` (`packages/lcis-operations/src/incident/IncidentOperationsService.ts`)
**Honesty contract:** structural runbook coverage and blast radius CONNECTED; live incident values (open incidents, worker errors, queue depth, ledger health) NOT_CONNECTED (value=null, confidence=0) + exact env var.

---

## 1. What This Service Does

`IncidentOperationsService` answers "What is broken?" by observing the structural incident model (runbook coverage, blast radius, SPOF patterns, money-domain outage protocols) and emitting an `IncidentReport`. It NEVER triggers alerts, creates incidents, or mutates state.

Data sources:
- `store.runbooks()` → `graphify-out/runbooks.json`
- `store.incidents()` → `graphify-out/incident-intelligence-v5.json`
- `store.queueGraph()` → `graphify-out/runtime-intel.json:queueGraph`
- `store.productionReadiness()` → `graphify-out/production-readiness-v2.json`
- `SignalCorrelator` → delegates to `lcis-core` `BlastRadiusService` (no reimplementation)

---

## 2. The 4 Incident Detectors

### 2.1 `detectIncidents()`

**What it reads:** `store.incidents()`, `store.runbooks()`

Three findings:
1. **Live open incidents** → `open-incidents` (info, NOT_CONNECTED; requires `SUPABASE_SERVICE_ROLE_KEY` if using a `site_incidents` table, or an external incident API)
2. **Structural incident model** → `incident-model` (info, CONNECTED) — reads the payments model from `incident-intelligence-v5.json`, reporting blast radius numbers directly from that artifact
3. **22-domain runbook schema** → `incident-schema` (info, CONNECTED) — reports `runbooks.json:summary.domains` count and generation timestamp

### 2.2 `detectOutages()`

**What it reads:** `store.queueGraph()`, `store.runbooks()`, `store.productionReadiness()`

Four findings:
1. Live worker health → `live-outage-status` (info, NOT_CONNECTED; requires `CF_ANALYTICS_API_TOKEN` + `CF_ACCOUNT_ID`)
2. Live queue depth → `live-queue-depth` (info, NOT_CONNECTED; requires `CLOUDFLARE_API_TOKEN` + `CF_ACCOUNT_ID`)
3. **Queue-workers SPOF** → `spof-outage-pattern` (critical when `uniqueConsumers.size === 1`, CONNECTED) — emits the human-readable detail that `letbuyy-queue-workers` is the single consumer for all 5 queues, impacting all 22 domains
4. **Money-domain outage Protocol A** → `outage-pattern` (critical, CONNECTED) — documents the 8 money domains that share the "DO NOT retry money mutations until reconciled" recovery rule: payments, refunds, payouts, gift-cards, shipping, inventory, orders, operations

Additional finding from `production-readiness-v2.json`: single deploy pipeline SPOF → `infrastructure-spof` (high, CONNECTED) — mitigated by gates; rollback is `production-rollback.mjs --worker letbuyy-api` with `verify-health-gates.mjs` required before rollback.

### 2.3 `detectBlastRadius()`

**What it reads:** `SignalCorrelator.correlateDomain(domainKey)` for 4 critical domains: `payments`, `orders`, `authentication`, `identity`

**Key design:** LCOS does NOT reimplement blast radius traversal. It delegates entirely to `SignalCorrelator` which wraps `lcis-core`'s `BlastRadiusService`. The result (`correlation.impactedDomains`, `.tables[]`, `.workers[]`, `.queues[]`, `.affected[]`, `.money`) comes from the lcis-core graph traversal over `graphify-out/domain-intel.json`.

| Domain | When not in graph | When found |
|--------|--------------------|-----------|
| Any | `BLAST-RADIUS-{DOMAIN}-NOT-IN-GRAPH` (info, UNKNOWN) | `BLAST-RADIUS-{DOMAIN}` (CONNECTED) |

Severity assignment:
- Money domain → critical
- Non-money AND `impactedDomains >= 5` → high
- Otherwise → medium

Additional hard-coded authoritative blast for payments from `incident-intelligence-v5.json`:
```
BLAST-RADIUS-PAYMENTS-AUTHORITATIVE
  severity: critical, CONNECTED
  blast: 11 domains, 49 routes, 103 RPCs, 205 tables
  source: graphify-out/incident-intelligence-v5.json
```
These numbers are pre-computed from a full graph traversal at `pnpm graph:reports` time.

#### How `SignalCorrelator` → `BlastRadiusService` works

`SignalCorrelator` is a thin wrapper (`packages/lcis-operations/src/shared/signal-correlator.ts`) that takes the `LcisEngine` core and exposes `correlateDomain(key)`. Internally it asks the lcis-core engine for the domain node, then asks `BlastRadiusService.computeForDomain(node)`. The blast result is a graph traversal over typed edges in `domain-intel.json` — not a reimplementation in LCOS.

### 2.4 `detectRecoveryStatus()`

**What it reads:** `store.runbooks()` → `graphify-out/runbooks.json:runbooks{}` (per-domain entries)

Five finding groups:

1. **Runbook coverage count** → `runbook-coverage` (info, CONNECTED): reports `entries.length` of 22 domains. Rollback command is uniform: `production-rollback.mjs --worker letbuyy-api`; gate: `verify-health-gates.mjs`.

2. **Per-money-domain runbook confirmation** → `money-runbook` (info, CONNECTED per domain): confirms recovery Protocol A steps include a reconciliation step (`reconcil` or `ledger` in recovery text) before DLQ replay.

3. **Live recovery progress** → `live-recovery-progress` (info, NOT_CONNECTED; requires `SUPABASE_SERVICE_ROLE_KEY` or external incident API)

4. **Post-recovery ledger verification** → `live-ledger-health` (info, NOT_CONNECTED): `ledger_balance_breaks()` must return 0 before declaring recovery complete; requires `SUPABASE_SERVICE_ROLE_KEY`.

5. **Runbook gap per missing money domain** → `runbook-gap` (high, CONNECTED): if any of the 8 money domains (`payments`, `refunds`, `payouts`, `gift-cards`, `shipping`, `inventory`, `orders`, `operations`) is absent from `runbooks.json`.

---

## 3. Recovery Protocol A (Money Domains)

Money-domain incident recovery follows a fixed protocol documented in `runbooks.json`:
1. **Stop**: Do NOT retry money mutations until reconciled.
2. **Reconcile**: Run `refresh_money_ledger_site_reconciliation` RPC (via Supabase service role).
3. **Verify**: Confirm `ledger_balance_breaks() = 0`.
4. **Replay**: Replay DLQ messages after verification.
5. **Rollback**: `production-rollback.mjs --worker letbuyy-api`, then `verify-health-gates.mjs`.

Detection signals for money domain incidents are NOT_CONNECTED (require `SUPABASE_SERVICE_ROLE_KEY`).

---

## 4. Connected vs NOT_CONNECTED Summary

| Observation | Status | Source |
|-------------|--------|--------|
| Number of domain runbooks | CONNECTED | `runbooks.json:summary.domains` |
| Which domains have runbooks | CONNECTED | `runbooks.json:runbooks{}` keys |
| Money-domain recovery Protocol A presence | CONNECTED | `runbooks.json:{domain}.recovery[]` |
| Payments blast radius (authoritative) | CONNECTED | `incident-intelligence-v5.json:blastRadius` (11d/49r/103 RPCs/205 tables) |
| Queue-workers SPOF (structural) | CONNECTED | `runtime-intel.json:queueGraph` |
| Deploy pipeline SPOF | CONNECTED | `production-readiness-v2.json:infra.deploy` |
| Dynamic blast radius per domain | CONNECTED (if domain in graph) | lcis-core `BlastRadiusService` via `SignalCorrelator` |
| Open incidents | NOT_CONNECTED | External incident API or `site_incidents` (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| Live worker health | NOT_CONNECTED | Cloudflare Analytics Engine (needs `CF_ANALYTICS_API_TOKEN`) |
| Live queue depth | NOT_CONNECTED | Cloudflare Queues API (needs `CLOUDFLARE_API_TOKEN`) |
| `ledger_balance_breaks()` count | NOT_CONNECTED | Supabase RPC (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| Live recovery progress / on-call | NOT_CONNECTED | External incident tracker |

---

## 5. Key Artifacts Consumed

| Artifact file (gitignored) | Content used |
|---------------------------|-------------|
| `graphify-out/runbooks.json` | `summary.domains`, `runbooks.<domain>.{detection,recovery,owner}` |
| `graphify-out/incident-intelligence-v5.json` | `domain`, `blastRadius.{domains,routes,rpcs,tables,affected}`, `answers.{whichTables,whichRpcs,whatFailed,whichMerchants}` |
| `graphify-out/runtime-intel.json` | `queueGraph[*].{queue,consumers}` |
| `graphify-out/production-readiness-v2.json` | `infra.deploy` evidence |
| `graphify-out/domain-intel.json` | read by lcis-core `BlastRadiusService` for dynamic blast traversal |

Regenerate: `pnpm graph:domain && pnpm graph:reports`.

---

## 6. Cross-References

- Source: `packages/lcis-operations/src/incident/IncidentOperationsService.ts`
- Signal correlator: `packages/lcis-operations/src/shared/signal-correlator.ts`
- Incident discovery: `docs/lcis-operations/LCOS_INCIDENT_DISCOVERY.md`
- Forensics: `docs/lcis-operations/LCOS_FORENSICS_REPORT.md §1.2, §1.4`
