# LDSS Architecture — Decision Support System (Phase 17, the capstone)

**Package:** `@letbuyy/lcis-decision` · Read-only, deterministic, **recommend-only**. Composes ALL prior LCIS systems into structured decisions.

## The safety law (defining property)

LDSS is **not an execution engine**. Every output is a recommendation. There is no `apply`/`execute`/`deploy`/`performAction` path anywhere in `src/` — enforced by `test/security.test.ts`, which fails the build on any such token. LDSS models the choice; a human or an authorized system acts.

## The decision pipeline (`decide(request)`)

For a `DecisionRequest { kind, subject, context? }` across 6 kinds (deploy / migration / rollback / scaling / business / architecture):

1. **AlternativeService** — generates the fixed strategy alternatives for the kind from the frozen `STRATEGY_TABLE` (e.g. deploy → canary / blue-green / full-rollout), each scored on 4 axes and given a weighted `compositeScore`.
2. **TradeoffService** — the per-axis winner (risk / cost / readiness / blast-radius).
3. **ComparisonService** — ranked risk and cost comparison tables.
4. **AffectedSurfaceService** — composes the dependency twin (LDTS): anchors the subject, runs impact radius, classifies reached nodes into systems / services / tables / apis / workers / domains. Structural topology is CONNECTED; runtime blast weights stay NOT_CONNECTED.
5. **DecisionGraphService** — the composition graph: which prior systems inform this decision kind.
6. **DecisionEngineService** — ranks and selects: `RECOMMENDED` (clear leader), `CONDITIONAL` (top two within `CONDITIONAL_MARGIN` = 0.05 — a genuine tradeoff for a human), `UNKNOWN` (no alternatives).

The facade stamps the `Decision` with evidence, confidence, alternatives, tradeoffs, affected surface, comparisons, composition edges, and an advisory rationale.

## Scoring (deterministic calibration)

Axis weights (`AXIS_WEIGHTS`, sum = 1): risk 0.35, cost 0.20, readiness 0.30, blast-radius 0.15. `compositeScore = Σ score[axis]·weight[axis]`, rounded to 3 dp. Scores are 0..1 (higher = better). The tables encode standard engineering tradeoffs (a canary is lower-risk, higher-cost than a full rollout) — so a money-path deploy decision surfaces canary above full-rollout on the risk-weighted composite, deterministically.

## Honesty & determinism

Recommendation-only; runtime weights NOT_CONNECTED; UNKNOWN when no alternatives apply; unresolvable subjects yield an empty NOT_CONNECTED affected surface (never a throw, never a guess). Same request + same artifacts → byte-identical decision (asserted). `create/get/resetDecisionSupportEngine`.
