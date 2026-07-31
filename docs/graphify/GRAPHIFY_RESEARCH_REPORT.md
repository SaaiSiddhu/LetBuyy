# Phase 0 — Graphify Research Report

**What Graphify is, how it works here, and how to operate it as LetBuyy's architecture-intelligence layer. Sourced from the tool's PyPI/GitHub + this repo's empirical graph behavior.**

## What it is
`graphifyy` (PyPI, v0.8.39 in this repo, MIT, © 2026 Safi Shamsi; GitHub `safishamsi/graphify`). An open-source, **LLM-free, deterministic** knowledge-graph builder for AI coding assistants. It ingests code, SQL schemas, infra, docs, papers, images, and video transcripts into one queryable graph. Dependencies are benign parsing libs: `networkx`, `numpy`, `rapidfuzz`, `tree-sitter` + language grammars.

## Architecture
- **Extraction:** tree-sitter ASTs per file → nodes (symbols, files, concepts) + edges (`contains`, `imports`, `defines`, `calls`, `references`, `re_exports`, `inherits`, `implements`). All nodes here are `_origin: ast`.
- **Community detection:** every node carries a `community` id (3,279 here) — graph clustering over the edge structure.
- **Confidence:** edges are `EXTRACTED` (direct, 99.3% here) or `INFERRED` (455).
- **Output:** `graphify-out/graph.json` (45 MB node-link JSON), `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`, `cache/`. All gitignored.

## Interfaces
- CLI: `graphify update .` (re-extract; **incremental** — only changed files; ~10s+ on a monorepo, too slow for a per-turn hook), `graphify explain "<symbol>"` (node + neighbors), `graphify path "A" "B"` (shortest path), `graphify diagnose multigraph`.
- **MCP server** (`graphify-mcp`): `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`. This is the path to "architecture intelligence" — wire the MCP so agents query the graph instead of grepping.
- Queries log to `~/.cache/graphify-queries.log` (JSONL).

## Best practices (for a governance-strict monorepo)
1. **Isolated install** via `uv tool install graphifyy` (own venv) — done here.
2. **Do NOT install the git commit hook** (`graphify hook install`) — it runs the unaudited binary on every commit; an unacceptable supply-chain surface in a production repo. Recorded as a deliberate skip (`docs/ai-infrastructure/graphify-report.md:11`).
3. **Keep output gitignored** (`graphify-out/`, `.graphify/`) — generated, 45 MB, regenerate on demand.
4. **Re-index on a schedule or in CI** (not per-turn) since `update` is ~10s+; treat the graph as eventually-consistent (it is 6 commits stale right now).
5. **Enable SQL/schema extraction** — Graphify *can* index database schema (its tagline is "app code + database schema + infrastructure in one graph"), but this run captured only 2 DB nodes. Configure the SQL grammar / include `database/**.sql` so RPC/table/policy nodes appear (the single biggest quality win — see Phase 9/13).

## Known limitations (observed here)
- **SQL bodies not deeply indexed** → Postgres RPCs (`create_checkout_order`, `issue_gift_card`) are not distinct nodes; schema truth must come from `database/supabase/migrations/` (authoritative) not the graph.
- **Docs dominate** — 24,015 of 52,246 nodes are markdown; useful for knowledge recall, noisy for pure-code centrality (filter `file_type == 'code'`).
- **Staleness** — the graph reflects whatever commit `update` last ran at (`built_at_commit`), not live HEAD.
- **Not a semantic/type checker** — it maps structure and references, not runtime behavior or type correctness (that is the governance gate + `tsc`).

## Recommended architecture for LetBuyy
Graph-as-CI-artifact: re-run `graphify update .` in a scheduled job, publish `graph.json`, and expose `graphify-mcp` to agents. Use it for impact analysis (`get_pr_impact`), dependency tracing (`path`), and the domain query packs in Phase 15 — while keeping the governance gate + migrations as the authority for money/identity/tenancy/schema.

**Sources:** [graphifyy · PyPI](https://pypi.org/project/graphifyy/) · [GitHub safishamsi/graphify](https://github.com/safishamsi/graphify) · this repo's `docs/ai-infrastructure/graphify-report.md` + empirical `graph.json`.
