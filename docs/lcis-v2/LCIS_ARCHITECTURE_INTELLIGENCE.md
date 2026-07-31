# LCIS Architecture Intelligence

> **LCIS V2**  
> Module: `tools/central-intelligence/architecture-intelligence/`  
> Artifacts: `graphify-out/architecture-snapshots/`, `graphify-out/infra-intel.json`, `graphify-out/domain-intel.json`

---

## Purpose

Architecture Intelligence answers three classes of questions that the file-level graph cannot answer alone:

1. **What does the system look like right now?** — Discovery of every service, domain, dependency, and layer from live filesystem state.
2. **How has it changed?** — Snapshot diffing to detect drift: new services, removed services, new layer violations, growing blast-radius packages, new cross-domain couplings.
3. **What is the risk?** — Ranked risk reports that combine blast radius, layer architecture, money-domain coupling, and domain coupling density into actionable findings.

The subsystem is entirely read-only. It consumes `graphify-out/infra-intel.json`, `graphify-out/domain-intel.json`, and the live filesystem — it never writes to source, never calls external APIs, and never fabricates live metrics.

---

## Module Layout

```
tools/central-intelligence/architecture-intelligence/
├── ArchitectureIntelligenceEngine.mjs   — facade; single entry point for all queries
├── ArchitectureSnapshotService.mjs      — capture + persist + retrieve snapshots
├── ArchitectureDriftDetector.mjs        — snapshot diffing + risk report generation
├── ServiceDiscovery.mjs                 — discover all services from FS + infra-intel
├── DependencyDiscovery.mjs              — @letbuyy/* package dependency graph + blast radius
├── LayerDiscovery.mjs                   — layer classification + violation detection
└── DomainDiscovery.mjs                  — 22 business domains + cross-domain edges
```

---

## Service Discovery

`ServiceDiscovery` discovers every service by scanning three root directories (`apps/`, `services/`, `packages/`) and merging with `graphify-out/infra-intel.json` for Cloudflare Worker details.

### Classification Rules

| Condition | Service type |
|-----------|-------------|
| Has `wrangler.toml` | `worker` |
| In `apps/` without `wrangler.toml` | `vercel-app` |
| In `services/` without `wrangler.toml` | `service` |
| In `packages/` | `package` |
| In `infra-intel.json` but not on filesystem | `infra-only` |

### Canonical Runtimes (8)

These are the only active deploy targets. Every other app or service root is either frozen, reserved, or a shared package.

| Runtime | Type | Platform |
|---------|------|----------|
| `storefront-runtime` | vercel-app | Vercel / Next.js |
| `merchant-control-plane` | vercel-app | Vercel / Next.js |
| `identity-platform` | vercel-app | Vercel / Next.js |
| `marketing-site` | vercel-app | Vercel / Next.js |
| `platform-console` | vercel-app | Vercel / Next.js |
| `api-gateway` | worker | Cloudflare Workers |
| `queue-workers` | worker | Cloudflare Workers |
| `webhook-service` | worker | Cloudflare Workers |

### Reserved Runtimes (7) — Manifest-Only

These roots exist in the monorepo as placeholders. No source, no tests, no deployment config. Current active capability owners are the web/service runtimes above.

`mobile-bff`, `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`

### Frozen Apps (4)

Not deploy targets. Pending consolidation. Do not reference as active topology.

`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`

### Service Manifest

`getServiceManifest(name)` returns structured deploy configuration:

- For Workers: queue bindings produced and consumed, cron triggers, R2 buckets, Hyperdrive flag
- For Vercel apps: Next.js flag, entry point
- For packages: workspace package name, cross-references

---

## Dependency Discovery

`DependencyDiscovery` builds the internal `@letbuyy/*` package dependency graph and computes blast-radius risk for every package.

### Data Sources

1. **Declared dependencies** — `package.json` files across all three roots (all three dependency fields)
2. **Observed imports** — Augmented from `graphify-out/graph.json` import edges when available

### Blast-Radius Classification

| Dependent count | Blast radius | Change risk |
|-----------------|-------------|-------------|
| ≥ 8 dependents | — | `CRITICAL` |
| ≥ 5 dependents | `high` | `HIGH` |
| ≥ 2 dependents | `medium` | `MEDIUM` |
| < 2 dependents | `low` | `LOW` |

### Hardcoded Critical Packages

Six packages are unconditionally flagged as critical regardless of computed dependent count:

`shared-types`, `api-client`, `auth-core`, `ui`, `theme-engine`, `tenant-core`

### High-Blast-Radius Packages (from real graph)

From `LCIS_DEPENDENCY_GRAPH.json` (34 modules, 112 edges):

| Package | In-degree (direct dependents) | Risk |
|---------|-------------------------------|------|
| `@letbuyy/shared-types` | 27 | CRITICAL |
| `@letbuyy/auth-core` | 16 | CRITICAL |
| `packages/typescript` | 9 | HIGH |
| `@letbuyy/api-gateway` | 7 | HIGH |
| `@letbuyy/theme-engine` | 6 | HIGH |

**Known hotspot:** `getSupabaseAdmin` is imported by 115 files — the highest blast-radius symbol in the entire codebase. Any change to it affects roughly 1 in 30 source files.

---

## Layer Discovery

`LayerDiscovery` classifies every service and module into an architectural layer and enforces directional dependency rules.

### Layer Model

```mermaid
graph TD
    E[edge<br/>storefront-runtime, merchant-control-plane,<br/>identity-platform, marketing-site, platform-console]
    G[gateway<br/>api-gateway, mobile-bff, checkout-runtime, search-service]
    A[async<br/>queue-workers, webhook-service, media-service,<br/>notification-service, event-bus, analytics-pipeline]
    D[data<br/>22 business domains · Supabase · migrations]
    I[intelligence<br/>LCIS graph-server, central-intelligence,<br/>architecture-intelligence, graph-engine]
    P[package<br/>@letbuyy/* shared libraries]

    E --> G
    G --> A
    G --> D
    A --> D
    P --> D
    I -.->|read-only observer| E
    I -.->|read-only observer| G
    I -.->|read-only observer| A
    I -.->|read-only observer| D
```

### Forbidden Layer Dependencies

| Violating direction | Severity |
|---------------------|---------|
| `data` imports from `gateway` | `high` |
| `data` imports from `async` | `high` |
| `data` imports from `edge` | `high` |
| `gateway` imports from `edge` | `high` |
| `async` imports from `edge` | `high` |
| `package` imports from `edge` | `high` |
| `package` imports from `gateway` | `high` |
| `package` imports from `async` | `high` |

`intelligence` has no restrictions — it is a read-only observer of all other layers.

`validateLayering()` scans all internal dependencies and returns violations with the violating module, dependency, and severity.

---

## Domain Discovery

`DomainDiscovery` loads the 22 LetBuyy business domains from `graphify-out/domain-intel.json` and exposes coupling analysis and money-domain identification.

### All 22 Business Domains

| Domain key | Label | Money | Tenant |
|-----------|-------|-------|--------|
| `payments` | Payments | ✓ | ✓ |
| `orders` | Orders | ✓ | ✓ |
| `refunds` | Refunds | ✓ | ✓ |
| `payouts` | Payouts | ✓ | ✓ |
| `gift-cards` | Gift Cards | ✓ | ✓ |
| `inventory` | Inventory | ✓ | ✓ |
| `shipping` | Shipping | ✓ | ✓ |
| `gst` | GST & Tax | — | ✓ |
| `discounts` | Discounts | — | ✓ |
| `products` | Products | — | ✓ |
| `collections` | Collections | — | ✓ |
| `storefront` | Storefront | — | ✓ |
| `identity` | Identity | — | ✓ |
| `authentication` | Authentication | — | ✓ |
| `authorization` | Authorization | — | ✓ |
| `merchant` | Merchant | — | ✓ |
| `notifications` | Notifications | — | ✓ |
| `analytics` | Analytics | — | ✓ |
| `operations` | Internal Operations | ✓ | ✓ |
| `themes` | Themes | — | ✓ |
| `marketplace` | Marketplace | — | ✓ |
| `developer` | Developer Platform | — | ✓ |

**9 money domains** (domains touching canonical money tables).

### Canonical Money Tables (18)

```
orders, order_items, payment_transactions, refunds, payouts,
gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions,
shipping_rates, checkout_sessions, checkout_line_items,
billing_subscriptions, billing_invoices, payout_accounts,
store_credits, discount_allocations, tax_lines, ledger_entries
```

### Cross-Domain Edges

49 cross-domain edges are extracted from `domain-intel.json`. If the data layer does not supply an explicit edge array, edges are synthesized from `dependsOn`/`consumedBy` fields on each domain (deduplicated by `from+to` pair).

### Coupling Analysis

`getCoupling()` computes:
- **Graph density**: `edgeCount / (domainCount × (domainCount - 1))`
- **Per-domain in-degree and out-degree**
- **Average coupling** (mean total edges per domain)
- **High-coupling domains**: domains with total edges ≥ 4

### Money Domain Risk

`getMoneyDomains()` classifies risk by money-table count:

| Money tables touched | Risk level |
|---------------------|-----------|
| ≥ 3 | `critical` |
| ≥ 1 | `high` |
| 0 | `medium` |

---

## Architecture Snapshots

`ArchitectureSnapshotService` captures and persists point-in-time snapshots of the full architecture state.

### Snapshot Contents

A snapshot captures the output of all four discovery modules plus git context:

```json
{
  "capturedAt": "2026-06-19T17:52:31.531Z",
  "gitHead": "742192cf",
  "gitBranch": "stepup/main",
  "services": { /* ServiceDiscovery output */ },
  "dependencies": { /* DependencyDiscovery output */ },
  "layers": { /* LayerDiscovery output */ },
  "domains": { /* DomainDiscovery output */ },
  "stats": {
    "totalServices": 31,
    "canonicalRuntimes": 8,
    "workerCount": 3,
    "vercelAppCount": 5,
    "packageCount": 20,
    "domainCount": 22,
    "crossDomainEdgeCount": 49,
    "moneyDomainCount": 9,
    "layerViolationCount": 0,
    "highBlastRadiusCount": 5,
    "dependencyCount": 112
  }
}
```

### Persistence

| Operation | File written |
|-----------|-------------|
| `save(snapshot)` | `graphify-out/architecture-snapshots/<ISO-timestamp>.json` |
| `save(snapshot)` also | `graphify-out/architecture-snapshots/latest.json` (overwritten) |
| `getLatest()` | Reads `latest.json`; returns `null` if absent |
| `list()` | All timestamped snapshots, sorted newest-first |
| `get(timestamp)` | Loads specific snapshot by filename or timestamp string |

---

## Drift Detection

`ArchitectureDriftDetector` diffs two snapshots and produces a structured drift object and a Markdown risk report.

### What Is Compared

| Category | What is diffed |
|----------|---------------|
| Services | Added / removed services; status changes (canonical → frozen, etc.) |
| Dependencies | High-blast-radius packages added/removed; blast-radius growth ≥ 3 |
| Layers | New layer violations added |
| Domains | Added / removed domains; new cross-domain edges |

### Risk Level Escalation Rules

| Condition | Risk level |
|-----------|-----------|
| Service removed | `critical` |
| New layer violation | `high` |
| Blast-radius growth ≥ 3 dependents | `high` |
| New cross-domain edge added | `medium` |
| Service added | `medium` |
| Minor dependency delta | `low` |

### `detectDriftFromLatest()`

Loads `latest.json`, captures a fresh snapshot from the current filesystem state, and diffs them. This is the standard way to detect what has changed since the last snapshot was recorded.

### Drift Report Output (Markdown)

```markdown
## Architecture Drift Report

**Risk Level: HIGH**
**Generated:** 2026-06-19T17:52:31Z

### New Layer Violations
- `@letbuyy/new-package` (package) imports from `api-gateway` (gateway)

### Changed Blast Radius
- `@letbuyy/shared-types` grew from 24 → 27 dependents (+3)

### New Cross-Domain Edges
- `inventory` → `payments` (new dependency detected)
```

---

## Risk Reports

`getArchitectureRiskReport()` captures a fresh snapshot and produces a ranked risk list across four categories:

| Category | Criteria | Example finding |
|----------|---------|----------------|
| Blast radius | Packages with ≥ 5 dependents | `@letbuyy/shared-types` (27 dependents) — CRITICAL |
| Layer violations | Any forbidden layer edge | `package` → `gateway` — severity HIGH |
| Money-domain coupling | Domains with ≥ 3 money tables | `payments` domain — CRITICAL |
| High-coupling domains | Domains with ≥ 4 cross-domain edges | `orders` → multiple domains — HIGH |

Additionally checks for new cross-domain edges since the last persisted snapshot.

---

## Architecture Intelligence Engine — Facade API

`ArchitectureIntelligenceEngine` is the single entry point. It lazy-imports the four discovery modules on first use and exposes a unified query surface.

### Health Scoring

`getHealth()` computes a 0–100 health score and returns `HEALTHY` / `DEGRADED` / `AT_RISK`:

| Condition | Points deducted |
|-----------|----------------|
| Missing canonical runtime (per runtime) | −15 |
| Layer violation (per violation) | −10 |
| Critical-blast package (per package) | −5 |
| High-coupling domain (per domain) | −3 |

---

## Services Reference

### ArchitectureIntelligenceEngine (`ArchitectureIntelligenceEngine.mjs`)

| Method | Returns |
|--------|---------|
| `getArchitecture()` | Full unified architecture model (all 4 discovery outputs) |
| `whatChanged(sinceSnapshot?)` | `{ drift, report, currentSnapshot }` |
| `whatDependsOn(component)` | `{ direct, transitive, changeImpact }` |
| `getRisks()` | Risk report from `ArchitectureDriftDetector.getArchitectureRiskReport()` |
| `getDependencyMap()` | Full adjacency list + top-10 high-blast packages |
| `getEvolution()` | Earliest vs. latest snapshot diff + per-domain evolution |
| `getHealth()` | `{ score, status, findings }` |

### ArchitectureSnapshotService (`ArchitectureSnapshotService.mjs`)

| Method | Returns |
|--------|---------|
| `capture()` | `Snapshot` — current state (not saved) |
| `save(snapshot)` | `void` — persists to `graphify-out/architecture-snapshots/` |
| `getLatest()` | `Snapshot | null` |
| `list()` | `SnapshotMeta[]` — sorted newest-first |
| `get(timestamp)` | `Snapshot` — by filename or timestamp string |

### ArchitectureDriftDetector (`ArchitectureDriftDetector.mjs`)

| Method | Returns |
|--------|---------|
| `detectDrift(snapshotA, snapshotB)` | `DriftResult` — structured diff |
| `detectDriftFromLatest()` | `DriftResult` — vs. persisted `latest.json` |
| `generateDriftReport(drift)` | `{ markdown, riskLevel }` |
| `getArchitectureRiskReport()` | `RiskReport[]` — ranked findings |

### ServiceDiscovery (`ServiceDiscovery.mjs`)

| Method | Returns |
|--------|---------|
| `discover()` | `Record<name, Service>` — all services |
| `getService(name)` | `Service` — by bare name or `pkg:` prefix |
| `getServiceManifest(name)` | `ServiceManifest` — deploy config |
| `getCanonicalRuntimes()` | `string[]` — the 8 active runtimes |
| `getReservedRuntimes()` | `string[]` — the 7 placeholder runtimes |

### DependencyDiscovery (`DependencyDiscovery.mjs`)

| Method | Returns |
|--------|---------|
| `discover()` | `Record<pkg, DepInfo>` — full dep graph |
| `getInternalDependencies(pkg)` | `string[]` — what this package depends on internally |
| `getExternalDependencies(pkg)` | `string[]` — external npm deps |
| `getHighBlastRadius()` | `BlastRadiusEntry[]` — sorted by dependent count |
| `getChangeRisk(pkg)` | `{ risk, dependents, blastRadius }` |

### LayerDiscovery (`LayerDiscovery.mjs`)

| Method | Returns |
|--------|---------|
| `discover()` | `Record<name, LayerEntry>` — all entries with layer and deps |
| `getLayer(name)` | `LayerEntry` — single lookup |
| `getLayerDependencies()` | `LayerDependencyMap` — layer → layers it depends on |
| `validateLayering()` | `Violation[]` — forbidden edges, each with severity `high` |

### DomainDiscovery (`DomainDiscovery.mjs`)

| Method | Returns |
|--------|---------|
| `discover()` | `Record<key, Domain>` — all 22 domains |
| `getDomain(key)` | `Domain` — single domain |
| `getCrossDomainEdges()` | `CrossDomainEdge[]` — 49 deduplicated edges |
| `getCoupling()` | `{ density, perDomain, avgCoupling, highCouplingDomains }` |
| `getMoneyDomains()` | `MoneyDomainEntry[]` — with risk level |
| `getDomainEvolution()` | `{ added, removed, changed }` — vs. previous snapshot |

---

## API Endpoints

Architecture Intelligence endpoints are prefixed `/intelligence/architecture/`:

| Method | Endpoint | Handler |
|--------|----------|---------|
| `GET` | `/intelligence/architecture/snapshot` | `ArchitectureSnapshotService.capture()` + `save()` |
| `GET` | `/intelligence/architecture/latest` | `ArchitectureSnapshotService.getLatest()` |
| `GET` | `/intelligence/architecture/list` | `ArchitectureSnapshotService.list()` |
| `GET` | `/intelligence/architecture/drift` | `ArchitectureDriftDetector.detectDriftFromLatest()` |
| `GET` | `/intelligence/architecture/drift/report` | `ArchitectureDriftDetector.generateDriftReport()` |
| `GET` | `/intelligence/architecture/risks` | `ArchitectureIntelligenceEngine.getRisks()` |
| `GET` | `/intelligence/architecture/health` | `ArchitectureIntelligenceEngine.getHealth()` |
| `GET` | `/intelligence/architecture/services` | `ServiceDiscovery.discover()` |
| `GET` | `/intelligence/architecture/services/:name` | `ServiceDiscovery.getService()` |
| `GET` | `/intelligence/architecture/dependencies` | `DependencyDiscovery.discover()` |
| `GET` | `/intelligence/architecture/dependencies/:pkg/risk` | `DependencyDiscovery.getChangeRisk()` |
| `GET` | `/intelligence/architecture/layers` | `LayerDiscovery.discover()` |
| `GET` | `/intelligence/architecture/layers/violations` | `LayerDiscovery.validateLayering()` |
| `GET` | `/intelligence/architecture/domains` | `DomainDiscovery.discover()` |
| `GET` | `/intelligence/architecture/domains/coupling` | `DomainDiscovery.getCoupling()` |
| `GET` | `/intelligence/architecture/domains/money` | `DomainDiscovery.getMoneyDomains()` |
| `GET` | `/intelligence/architecture/evolution` | `ArchitectureIntelligenceEngine.getEvolution()` |
| `GET` | `/intelligence/architecture/what-depends-on/:component` | `ArchitectureIntelligenceEngine.whatDependsOn()` |
| `GET` | `/intelligence/architecture/what-changed` | `ArchitectureIntelligenceEngine.whatChanged()` |
