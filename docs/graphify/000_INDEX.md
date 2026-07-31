# LetBuyy Graphify Master Program

**Evidence source:** `graphify-out/graph.json` (real graph, queried directly with Python). **Graph built at commit `0db025a6`; repo HEAD now `fa1fcc76` → graph is 6 commits stale** (re-run `graphify update .` to refresh). Every quantitative claim below traces to a graph query or a cited file; nothing is assumed.

## Headline graph facts
- **52,246 nodes · 66,761 edges · 3,279 communities · 3,403 source files indexed.**
- Node mix: **code 28,208 · document 24,015 · concept 22 · rationale 1** — ~46% of the graph is the `docs/` tree, so the *code* intelligence layer is the 28k code-node subgraph.
- Edge mix: contains 40,877 · imports 7,791 · defines 7,031 · calls 5,222 · references 2,287 · imports_from 1,673 · re_exports 773 · inherits 704. Confidence: **66,306 EXTRACTED (99.3%) / 455 INFERRED**.
- Connectivity: only **127 orphan nodes (0.24%)** — a well-formed graph.

## The one limitation that shapes everything
**The SQL/database layer is essentially unindexed — only 2 nodes under `database/` for 103 migrations.** Graphify's tree-sitter extraction is code-symbol oriented and did not parse the Postgres schema/RPC bodies in this run (independently recorded in `docs/ai-infrastructure/graphify-report.md:44`). So Phase 9 (Database) is grounded in the migrations directly, not the graph. This is the #1 graph-quality gap and the top remediation (re-index with SQL grammar enabled).

## Documents (Phases 0–17)
0 `GRAPHIFY_RESEARCH_REPORT.md` · 1 `GRAPH_COVERAGE_AUDIT.md` · 2 `DOMAIN_GRAPH.md` · 3 `CROSS_APP_DEPENDENCIES.md` · 4 `DATA_FLOW_GRAPH.md` · 5 `SECURITY_GRAPH.md` · 6 `TENANCY_GRAPH.md` · 7 `PAYMENT_GRAPH.md` · 8 `API_GRAPH.md` · 9 `DATABASE_GRAPH.md` · 10 `THEME_GRAPH.md` · 11 `MARKETPLACE_GRAPH.md` · 12 `CRITICAL_SYSTEMS.md` · 13 `TECHNICAL_DEBT_REPORT.md` · 14 `PRODUCTION_READINESS_REPORT.md` · 15 `QUERY_PACKS.md` · 16 `AUTONOMOUS_AUDITS.md` · 17 `FINAL_GRAPHIFY_MASTER_REPORT.md`.

## Scores (detailed in Phase 17)
Graph coverage (code) **95%** · graph coverage (SQL) **~2%** · Graphify maturity **6.5/10** · LetBuyy architecture-intelligence **7.5/10**. The graph is an excellent TS/Dart/JS code-intelligence layer with a database-shaped blind spot.

## Reproducibility
All metrics come from `python3` queries over `graphify-out/graph.json` (node/link lists with `id, label, file_type, source_file, community` and `source, target, relation, confidence` fields). Re-runnable; deterministic; LLM-free.
