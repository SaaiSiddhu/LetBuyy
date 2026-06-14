# LCIS INFINITY — Implementation

Honors anti-bloat: one new engine (Autonomous Detection + Predictive Intelligence), 5 endpoints, one consolidated **Live Operations Center** (the real-time answer board — not a duplicate workspace), and a predictive answer added to the existing AI Ops. The other phases are **verified existing**. Change set: `tools/graph-server/{detection-prediction-intel.mjs, server.mjs, index.html}`, `CLAUDE.md`, `docs/infinity/`.

## New engine — `detection-prediction-intel.mjs`
- **8 detectors** (Phase 3): checkout/payment/refund failures, worker crashes, queue backlogs, database failures, webhook failures, deployment failures. Each = `{ liveSignal (source + NOT CONNECTED), structuralRisk (repository truth), severity, affectedDomains, runbook, diagnose }`.
- **6 predictors + what-will-fail-next** (Phase 6): approaching-limits / storage-growth / queue-saturation / traffic-spikes / cost-spikes / operational-risk — each names the structural indicator present *now* and the live trend that would confirm (NOT CONNECTED). `whatFailsNext` ranks domains by structural predisposition (money path + degraded deps + open blockers + blast radius).
- **Live-metrics map** (Phase 2): 11 metrics (API/worker latency, queue depth/failures, DB latency/errors, deployments, storage, bandwidth, email, payment status) → real source → NOT CONNECTED.
- **Incident timeline** (Phase 4): Detection→Diagnosis→Impact→Recovery→Verification→Resolution; diagnosis/impact/recovery/verification are repository-truth procedures, detection/resolution timestamps NOT CONNECTED.

## Server
- Endpoints: `/api/detection`, `/api/live-metrics`, `/api/predict`, `/api/incident-timeline?domain=`, `/api/detection-prediction`.
- `aiOps()` gained a **"What will break next?"** question sourcing `whatFailsNext`.

## UI
- **Live Operations Center** (`xLiveOps`, nav + `/page/live-ops`) — a single board answering the 7 stop-condition questions from federation + live-metrics + detection + predict + launch-status + ai-ops. Honest "LIVE: NOT CONNECTED (dev)" header.
- `omegaFmt` extended to render the predict shape (`domain · predisposition · why`).
- Copilot V2: "what is happening now / what will fail next / live ops" → Live Operations Center.

## Verified existing (not rebuilt)
Federation (1), cost (7), revenue (8), merchant/customer intelligence + OS (9/10), ai-ops commander (11), launch-status V2 (12), executive modes (13), ai-context packs (14), runbooks + escalation/recovery/rollback/validation (15).

## Reuse & honesty
1 engine, 5 endpoints, 1 consolidated board, 1 enhanced page. No new graph layers, no duplicate workspaces. Every live value is CONNECTED or NOT CONNECTED + source; "what will fail next" is structural predisposition, never a fabricated live trend.
