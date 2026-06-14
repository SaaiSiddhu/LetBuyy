# LCIS V9 Baseline

Starting point for the V9 (integration + intelligence expansion) program. V9 is **not** a rebuild — it expands the V8 workspace into a Commerce-OS intelligence layer where every search auto-assembles a complete multi-perspective workspace.

## Present at V9 start (reused, not rebuilt)
- V8 Domain Workspace with 6 perspectives (Explain/Technical/Graphs/Trace/Related/AI).
- Three-pane shell — left NAVIGATION (collapsible), center workspace, **right Domain Context panel** (dependency explorer + quick actions), mobile FAB drawer.
- search-v2, `/api/workspace`, `/api/related`, knowledge graphs (7 layers), change-impact, runbook/incident/diagnosis engines, AI packs, lineage, all Control Centers.
- 76 engines, ~90 API endpoints, mobile-responsive (V8 validated 320–1440px).

## V9 gaps closed
| Gap | Closed by |
|-----|-----------|
| Workspace had 6 perspectives | expanded to **16**: Overview · Explain · Technical · Database · API · Infra · Security · Ops · Incidents · Deps · Impact · Graphs · Trace · Related · AI · Atlas |
| No impact/risk/recovery scores | `/api/impact-score?domain=X` — impact + risk + recovery + What-Breaks-If (Phases 6/7) |
| Dependency explorer only in right panel | full **Dependencies** perspective (upstream/downstream/DB/API/infra) |
| Right/left sidebar + mobile drawer | present (Domain Context panel, nav collapse, FAB) — verified + retained |

See `LCIS_V9_TEST_REPORT.md`, `LCIS_V9_WORKSPACE_CERTIFICATION.md`, `LCIS_V9_FINAL_CERTIFICATION.md`.
