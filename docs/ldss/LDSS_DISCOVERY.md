# LDSS Discovery — Decision Support System (Phase 17)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LDSS composes ALL prior systems — never re-decides, never executes)

LDSS is the capstone: it composes **every** LCIS system into structured decisions. It NEVER becomes an execution engine — every output is a recommendation with evidence, confidence, alternatives, tradeoffs, and an explicit affected-surface.

| Prior system | What LDSS consumes |
|---|---|
| `lcis-engineering` (EINS) | blueprint / launch decision (GO/CONDITIONAL_GO/NO_GO) / rollback plan / verification — for deploy/migration/rollback decisions |
| `lcis-orchestration` (EAOS) | execution graph / rollout / blockers — for execution-readiness decisions |
| `lcis-twin` (LDTS) | affected systems/tables/apis/workers/domains via impact radius + shortest path — the **affected-surface** of every decision |
| `lcis-rootcause` (LRAS) | diagnosis → remediation decisions |
| `lcis-performance` (LPAS) | capacity/cost forecasts — for scaling decisions |
| `lcis-security` (LSAS) | risk score — the security tradeoff axis |
| `lcis-business` (LBIS) | business health / KPIs — for business decisions |
| `lcis-tracking` (LCTS) | change impact / risk — for change decisions |
| `lcis-governance` (GDIS) | compliance / readiness — the compliance tradeoff axis |
| `lcis-core` | blast radius — affected symbols/files |

**Net-new in LDSS (verified absent):** a `Decision` primitive that, for a decision request (deploy / migrate / rollback / scale / business / architecture), composes the relevant prior systems into **alternatives**, scores each on **tradeoff axes** (risk / cost / readiness / blast radius), and returns a ranked recommendation with the full affected surface (systems / services / tables / apis / workers / domains). No existing package produces decisions with alternatives + tradeoffs; each prior system answers one dimension — LDSS composes them into a choice. It recommends only; it never acts.

## 2. Phase 17 scope — new package `packages/lcis-decision`

Foundation: `DecisionRequest` (kind: deploy/migration/rollback/scaling/business/architecture + subject), `Alternative` (strategy + per-axis scores), `Tradeoff` (axis + comparison), `AffectedSurface` (systems/services/tables/apis/workers/domains — from the twin + blast radius), `RiskComparison`/`CostComparison`, `Decision` (recommended alternative + alternatives + tradeoffs + affected + evidence + confidence), flagship `DecisionReport`; rules DEC01–DEC08; `decision()` envelope.

Services (6): DecisionGraphService (decision → relevant prior-system composition), AlternativeService (generate strategy alternatives per decision kind), TradeoffService (score alternatives on risk/cost/readiness/blast axes), AffectedSurfaceService (twin + blast → the affected sets), ComparisonService (risk/cost comparison across alternatives), DecisionEngineService (rank + recommend, pure).

Facade: `DecisionSupportEngine` → `decide(request)` + `generateDecisionReport(request)`.

Honesty + safety: every decision is a recommendation with evidence + confidence; no autonomous action; no execution; UNKNOWN when prior systems cannot inform a decision. Advisory-only, read-only, deterministic.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-decision`. Target ≥700 tests.
