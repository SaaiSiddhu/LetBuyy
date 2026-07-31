# LRAS Completion Report — Phase 12 (Root Cause Analysis System)

**Date:** 2026-07-04 · **Verdict: PHASE 12 GREEN — PROMOTED.** All numbers from executed runs.

## What was built — new package `packages/lcis-rootcause`

- **Frozen contract:** `Symptom` (6 mandated kinds + honest `unknown`), `CauseHypothesis` (evidence-mandatory), `HypothesisInput`, `AffectedSummary`, `RecentChangeSummary`, `Diagnosis` (verdict DIAGNOSED/PARTIAL/UNKNOWN + missingSignals), `rootcause()` envelope.
- **Fixed symptom taxonomy** (`SYMPTOM_TAXONOMY`): deterministic lowercase-substring keyword table → kinds/domains/twin-anchors; no match → `unknown` (drives verdict UNKNOWN — never a guess).
- **Rules RC01–RC08** with calibrated base confidences; the ONLY confidence formula is `base + 0.05·min(3, extraEvidence)` capped at 0.85.
- **Six services:** SymptomService (pure classifier), HypothesisService (rule engine — every hypothesis carries ≥1 evidence or is never emitted), AffectedService (twin impact radius + structural signals: intersecting cycles/SPOFs/consumerless queues), ChangeCorrelationService (LCTS timeline ∩ affected), AttributionService (governance owners, never-throw), RemediationService (EINS rollback/verification with honest null/[] degradation).
- **Facade** `RootCauseEngine.diagnose(text)`: the full pipeline with fixed KIND_SIGNALS/KIND_PROVIDERS maps naming the exact live signals that would sharpen each diagnosis.

## Verification (executed)

| Gate | Result |
|---|---|
| Typecheck | ✅ turbo 20/20 tasks |
| Tests | ✅ **482/482 on first gate pass** (target 350+) — symptom/hypothesis/affected/correlation/attribution/remediation/foundation/security/engine suites |
| Determinism | ✅ same symptom + fixtures → byte-identical diagnosis (asserted) |
| Anti-hallucination | ✅ asserted: every emitted hypothesis has evidence; gibberish → UNKNOWN with `symptom-taxonomy-match` named; summaries state "nothing is guessed" |
| Security / read-only | ✅ recursive scan (twin-refined rules) + dependency allowlist (core/governance/engineering/operations/tracking/twin/zod) |
| Back-compat | ✅ zero modifications to existing packages |

## Honest limitations

- The taxonomy is a fixed English keyword table — paraphrases outside it are honestly UNKNOWN rather than fuzzily matched; extending it is a reviewed, deterministic change.
- Hypotheses are structural: live telemetry (queue depth, error rates, provider status) would sharpen or eliminate them; each diagnosis names those exact signals and their adapters/env vars in `missingSignals`.
- Rollback recommendations inherit EINS's honest NOT_READY degradation when structural artifacts are absent.

Docs: LRAS_DISCOVERY.md · LRAS_ARCHITECTURE.md · LRAS_SECURITY_REVIEW.md · this report.
