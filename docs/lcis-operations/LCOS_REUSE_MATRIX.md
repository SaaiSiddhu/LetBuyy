# LCOS Reuse Matrix
**Phase-6 Discovery — LetBuyy Central Operations System**
_Generated: 2026-06-21_

LCOS is the READ-ONLY operations layer ("what is happening right now?"). It composes prior packages
and operational artifacts; it never reimplements graph/blast/readiness/verification/governance logic.

---

## 1. Package reuse table

| LCOS need | Prior package + exact symbol(s) to reuse | What LCOS adds NET-NEW |
|---|---|---|
| **Artifact reading** | `@letbuyy/lcis-core` — `ArtifactStore.tryRead(name)` / `ArtifactStore.read(name)` / `ArtifactStore.default()` | Typed read-shapes for each operational artifact (`RuntimeIntel`, `OperationsCenter`, `TelemetryIntel`, `IncidentIntel`, `DeploymentIntel`, `SecurityIntel`, `CostIntel`, `MerchantIntel`, `CustomerIntel`, `RevenueIntel`); thin accessor layer that validates artifact presence and surfaces `ArtifactMissingError` gracefully |
| **Blast radius / correlation** | `@letbuyy/lcis-core` — `BlastRadiusService.blast()`, `.impact()`, `.crossDomain()`, `.relationships()` | Operational context overlay: maps a live signal (worker name, queue binding, domain key) onto `blast()` subjects, so "ANALYTICS_QUEUE backed up → what domains are at risk?" returns evidence-cited blast results without duplicating graph logic |
| **Live signals + NOT_CONNECTED honesty** | `@letbuyy/lcis-adapters` — `LiveAdapter` contract, `AdapterSnapshot`, `AdapterStatus`, `HealthResult`, `LiveFact`, `notConnected()` evidence builder; `@letbuyy/lcis-live` — `LivePlatform.health()`, `.status()`, `.investigate(subject)`, `.observability()` | Operational signal registry: maps each LCOS metric (worker error-rate, queue backlog, GMV, refund-spike, auth-anomaly, deploy-fail) to its exact binding/env-var/adapter (the registry that the Detectability Matrix encodes); normalises raw adapter payloads into typed `OperationalFact` shape |
| **Readiness** | `@letbuyy/lcis-governance` — `ReadinessService.generateReadinessReport()`, `GovernanceEngine.generateReadinessHealth()` | Operational readiness projection: surfaces *current* structural readiness score alongside the live connection state ("5 blockers still open / ANALYTICS_QUEUE NOT_CONNECTED") without re-running governance computation |
| **Security posture** | `@letbuyy/lcis-core` — `VerificationService.verifyProductionReadiness()`, `VerificationService.verifyRls()`, `VerificationService.verifyPayments()`; `@letbuyy/lcis-governance` — `SecurityDriftService.generateSecurityDriftReport()`, `GovernanceEngine.generateSecurityHealth()` | Operational security framing: cross-references the structural posture (651 policies, 11 controls, 20 cross-tenant candidates) with live adapter signals (Supabase auth anomalies, rate-limit breach events if adapter CONNECTED) and emits a plain-language "what is exposed right now" summary |
| **Recovery / rollback** | `@letbuyy/lcis-execution` — `RollbackIntelligenceService.generateRollbackPlan(req)`, `FullPlan.rollback`, `LaunchIntelligenceService.evaluateLaunch()` | Recovery shortcut: for a named domain or worker surfaces the pre-computed rollback plan without requiring a full `ChangeRequest`; maps operational incident → rollback subject automatically |
| **Evidence / envelope / confidence** | `@letbuyy/lcis-core` — `envelope<T>(opts)`, `LcisEnvelope<T>`, `Evidence`, `EvidenceKind`, `notConnected(ref, requiresEnvVar)`, `confidenceFor(data)`, `Timer`, `newRequestId()`, `createLogger()` | None — LCOS uses the canonical envelope verbatim. Every LCOS response is an `LcisEnvelope<OperationalView>` with `evidence[]` citing artifact fields and `notConnected` entries for every live signal not yet wired. Confidence cap: 0.9 structural; 0 for any NOT_CONNECTED metric |

---

## 2. Operational artifacts LCOS reads (via ArtifactStore.tryRead)

| Artifact file | Key data for LCOS |
|---|---|
| `runtime-intel.json` | 4 workers, 5 queues, 2 DLQs, 2 crons, `RUNTIME_TELEMETRY` binding; telemetry source map |
| `runtime-observability.json` | Worker→Queue→Cron→RPC→Table chain; 10 runtime metrics; DLQ names |
| `operations-center.json` | 7 area statuses, `launchVerdict`, `openBlockers` count |
| `telemetry-intelligence.json` | 12 adapter → metric → binding table |
| `incident-intelligence-v5.json` | blast-radius + rollback per domain example shape |
| `deployment-intelligence-v5.json` | 4 workers, 5 Vercel apps, 19 secrets, 6 subdomains, 3 SPOFs, rollback presence |
| `security-intelligence-v5.json` | 11 controls, 651 policies, 20 cross-tenant candidates, 5 deterministic validators |
| `cost-intelligence.json` | 10 services, 4 hotspots; usage/totals `live-query-required` |
| `merchant-intelligence.json` | 10 operating stages, 8 lifecycle states, 5 detectors, `singlePointOfDependency:true` |
| `customer-intelligence.json` | 8 funnel graphs; rates live-only |
| `revenue-intelligence-v2.json` | 8 models, 34 money RPCs, gift-card liability modeled; amounts live-only |

---

## 3. What LCOS must NOT duplicate

- **Graph traversal** — never re-implement blast-radius, cross-domain, or FK walks; always delegate to `BlastRadiusService`.
- **Readiness scoring** — never re-compute the 5-dimension readiness score; always call `ReadinessService` or read `GovernanceEngine.generateReadinessHealth()`.
- **Compliance / drift detection** — never re-scan CODEOWNERS or R001-R008 rules; always call `ComplianceService` / `DriftDetectionService`.
- **Change planning** — never produce migration or rollback plans inline; always delegate to `EisEngine.planAll()` / `RollbackIntelligenceService`.
- **Live adapter collection** — never open an HTTP connection to Supabase/Cloudflare/GitHub/Vercel outside the four `LiveAdapter` implementations in `@letbuyy/lcis-adapters`.
- **Envelope / evidence fabrication** — never set `confidence > 0.9`; never emit a metric value when the adapter is `NOT_CONNECTED`; always use `notConnected(ref, requiresEnvVar)` from `lcis-core`.
- **Telemetry storage** — LCOS never stores or caches live metric values; it reports their source and connection state.

---

## 4. LCOS net-new responsibilities (the gap the prior stack does not fill)

1. **Operational read-shapes** — typed TypeScript interfaces for each operational artifact so consumers do not parse raw JSON.
2. **Live-signal registry** — the authoritative mapping of every operational metric to its exact env-var / Cloudflare binding / Supabase RPC / Vercel API endpoint and its current `CONNECTED | NOT_CONNECTED` state.
3. **Telemetry normalisation** — accepts raw `AdapterSnapshot` payloads from the Cloudflare adapter and normalises them into domain-scoped `OperationalFact[]` (worker error-rate, queue depth, etc.) for cross-area correlation.
4. **Deterministic forecasting** — structural capacity projections ("at current merchant-growth rate, ANALYTICS_QUEUE will saturate in X days") derived from declared topology, never from live telemetry values (those are NOT_CONNECTED until credentials are set).
5. **Operations answer layer** — the 8-area API surface (`/runtime`, `/commerce`, `/merchant`, `/customer`, `/deployment`, `/incident`, `/security`, `/forecast`) that synthesises all prior packages into a plain-language "what is happening now" answer per area.
