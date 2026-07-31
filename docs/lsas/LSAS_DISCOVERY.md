# LSAS Discovery — Security Analytics System (Phase 14)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LSAS composes — never duplicates)

| Capability | Where (verified) | LSAS reuse |
|---|---|---|
| Structural security findings | `lcis-governance` `SecurityDriftService`: findMissingRLS / findDangerousPolicies / findPublicMutations / findCrossTenantRisks / findMissingValidation / findMissingAuth / findMissingSecurityTests / findSensitiveDomainViolations / generateSecurityDriftReport | Threat + vulnerability intelligence substrate (delegate 100%) |
| Compliance evaluation | `lcis-governance` `ComplianceService` (evaluateSecurityCompliance + 5 more) | Compliance analytics |
| Live security ops signals | `lcis-operations` `SecurityOperationsService`: detectAuthAnomalies / detectAbuseSignals / detectCredentialEvents / detectSecuritySpikes (all NOT_CONNECTED without SUPABASE/TURNSTILE creds) | Abuse detection + identity analytics (live signals stay NOT_CONNECTED) |
| Policy/RLS structure | `graphify-out/db-intel.json` policies: `{name, table, public, usesSiteId, serviceRole}` | Attack-graph sensitivity + secret posture |
| Attack paths | **Phase 11 `lcis-twin`** shortestPath/impactRadius over api/route → table nodes | Attack graph (public entry → sensitive table) |
| Security-typed change history | **Phase 10 `lcis-tracking`** timeline (decision types security/governance) | Security timeline |
| Secret/webhook posture | **Phase 9 `lcis-adapters`** SIGNAL_CATALOG requiredEnv + WEBHOOK_CATALOG (HMAC schemes) + CredentialProvider presence | Secret + token intelligence |

**Net-new in LSAS (verified absent):** a UNIFIED security-analytics report — threat intelligence, an attack graph, secret/token/identity intelligence, abuse detection, compliance analytics, vulnerability intelligence, a security timeline, weighted risk scoring, health bands, and advisory recommendations — in one deterministic composition. No existing package produces a security risk score or an attack graph; governance finds structural drift, operations detects live signals, but neither aggregates or scores.

## 2. Phase 14 scope — new package `packages/lcis-security` (LSAS)

Foundation: `SecurityFinding`, `Threat`, `AttackPath`, `SecretPosture`, `TokenPosture` (the two issuers: customer HS256 / merchant ES256, per the constitution), `IdentitySurface`, `AbuseSignal`, `ComplianceItem`, `Vulnerability`, `SecurityTimelineEntry`, `SecurityRiskScore`, `SecurityHealth`, `SecurityRecommendation`, flagship `SecurityReport`; rules SEC01–SEC08; `security()` envelope.

Services (6, composing — never re-modeling):
1. **ThreatIntelligenceService** — governance SecurityDriftService findings → Threats + Vulnerabilities.
2. **AttackGraphService** — twin paths from public-policy entities to sensitive (money/tenant) tables.
3. **IdentitySecretService** — secret posture (adapter signal requiredEnv presence) + token posture (two JWT issuers) + identity surfaces.
4. **AbuseComplianceService** — ops abuse/auth/credential/spike signals (NOT_CONNECTED) + governance compliance analytics.
5. **SecurityTimelineService** — LCTS security-typed change records.
6. **RiskScoringService** — deterministic weighted aggregate → risk score (0–100) + health band + advisory recommendations.

Facade: `SecurityAnalyticsEngine` (`create/get/resetSecurityAnalyticsEngine`) → `generateSecurityReport` (flagship) + per-service getters.

Honesty: structural findings CONNECTED; every live signal (auth failure rate, abuse rate, credential events) NOT_CONNECTED + exact source. Read-only, deterministic, no AI, advisory-only recommendations.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-security`. Target ≥500 tests: threat ~90, attack-graph ~80, identity-secret ~80, abuse-compliance ~80, timeline ~50, risk-scoring ~70, foundation ~40, security-scan ~30, facade ~40.
