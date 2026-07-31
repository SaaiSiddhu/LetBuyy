# EINS Discovery C — Governance (the lcis-governance reuse contract)

EINS **composes** `@letbuyy/lcis-governance` (GDIS) as the engineering GATES a feature must pass.
Source: `packages/lcis-governance/src/{index.ts,engine.ts,shared/types.ts,*/}`.

## Entry point
- `getGovernanceEngine(opts?)` / `createGovernanceEngine(opts?)` → `GovernanceEngine` (`opts.now` for determinism).
- Sub-services exposed: `.drift`, `.compliance`, `.ownership`, `.security`, `.readiness`.

## Methods EINS reuses (as feature gates)
| EINS gate | Reuse | Returns |
|---|---|---|
| **Compliance gates** (R001-R008 the feature must satisfy) | `gov.compliance.generateComplianceReport()` · `evaluateArchitectureCompliance()` (R001 money→canonical SECURITY DEFINER RPC + idempotency + FOR UPDATE) · `evaluateSecurityCompliance()` (R002 tenant→RLS) · `evaluateOwnershipCompliance()` (R005) · `evaluateTestingCompliance()` (R004) · `evaluateOperationalCompliance()` (R003/R006/R008) · `evaluateGovernanceCompliance()` (R007) | `ComplianceReport` {evaluations:RuleEvaluation[]{rule,status:'COMPLIANT'\|'VIOLATED'\|'PARTIAL'\|'UNKNOWN',violations:Finding[],checked,passed},score,violations,summary} |
| **Ownership** (who must own the new code) | `gov.ownership.generateOwnershipReport()` · `findUnowned{Domains,Services,Workers,Queues,RPCs,Tables,Runbooks}()` · `generateOwnershipCoverage()` | `OwnershipReport` {gaps:OwnershipGap[],coverage,summary} |
| **Security drift** (what the feature must not introduce) | `gov.security.findMissingRLS()` · `findDangerousPolicies()` · `findPublicMutations()` · `findCrossTenantRisks()` · `findMissingValidation()` · `findMissingSecurityTests()` · `generateSecurityDriftReport()` | `SecurityDriftReport` {findings:Finding[],byKind,summary} |
| **Readiness** (10-factor) | `gov.readiness.generateReadinessReport()` · `evaluateDomainReadiness(key)` (**async**) | `ReadinessReport` {scores:ReadinessScore[]{subject,score,band,unknowns},overall,summary} |
| **Drift** (does the feature add orphans?) | `gov.drift.generateDriftReport(scope?)` | `DriftReport` {scope,findings,byKind,summary} |
| Composite + per-area health | `await gov.generateGovernanceReport()` · `generateArchitectureHealth()` · `generateSecurityHealth()` · `generateOwnershipHealth()` · `await generateReadinessHealth()` · `await generateDomainHealth()` | `GovernanceReport` / `HealthView` |

## Notes for EINS
- `Finding` shape: `{id,category,kind,severity,subject,title,detail,rule?,confidence,evidence}`.
- `GovernanceVerdict` (PR-V3) shape exists for PR framing; EINS PR-V5 mirrors it.
- Honesty: R006/R008 are `PARTIAL`; UNKNOWN readiness factors (rollback/monitoring/alerts/healthcheck) are surfaced, never counted as pass. EINS preserves this honesty when framing feature gates.
- async: `generateGovernanceReport`, `evaluateDomainReadiness`, `generateReadinessHealth`, `generateDomainHealth`. Rest sync.
- EINS uses these to answer: *who must own it · what compliance rules it must satisfy · what security it must not break · is the touched surface ready.* It reuses; never reimplements.
