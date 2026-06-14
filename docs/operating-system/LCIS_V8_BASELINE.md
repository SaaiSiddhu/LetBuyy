# LCIS V8 Baseline

State of LCIS at the start of the V8 (Unified Search-Centric) program. Counts are repository-derived.

| Asset | Count |
|-------|------:|
| Intelligence engines (`tools/graph-server/*.mjs`) | 76 |
| API endpoints (`/api/*`) | 91 |
| Explain IA pages | 18 |
| Domains with full intelligence | 22 |

## Already present (reused, not rebuilt)
Explain Mode · Technical Mode · Atlas · Search (command palette + search-v2) · AI Context Packs · Mission Control · Ecosystem Intelligence · Environment Registry · Operations Center · Readiness · Knowledge Graphs (7) · FK Relationship Intelligence (705 FKs) · Live Adapter Layer (7 providers, read-only) · Diagnosis Engine · Runbook Engine · Launch Command Center · Control Centers (db/infra/commerce/incident) · full lineage tracer.

## The V8 gap (search → workspace)
Before V8 a search returned a *page*. The V8 mission: every search opens a **Domain Workspace** with multiple intelligence perspectives (Explain / Technical / Graphs / Trace / Related / AI), in a docs-quality, mobile-first UI. No new graph extraction, no duplicate engines, no mock data (only CONNECTED / NOT CONNECTED).

See `LCIS_V8_IMPLEMENTATION.md`, `LCIS_V8_TEST_REPORT.md`, `LCIS_V8_CERTIFICATION.md`.
