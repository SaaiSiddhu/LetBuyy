# tools/graph-server — LetBuyy Graph Intelligence Platform

Zero-dependency local viewer + query API over the Graphify code graph (`graphify-out/graph.json`). No npm install, no build step — plain Node `http`.

## Commands (from repo root)
| Command | Does |
|---------|------|
| `pnpm graph:ui` | start the explorer → **http://localhost:3333** |
| `pnpm graph:update` | rebuild the graph (`graphify update .`) |
| `pnpm graph:validate` | sanity-check the graph file |
| `pnpm graph:stats` | print statistics |

Override the port with `GRAPH_UI_PORT=4000 pnpm graph:ui`.

## Files
- `server.mjs` — HTTP server + query API (`/api/stats|search|node|neighbors|path|domain`).
- `index.html` — single-page UI (search, force-directed neighborhood canvas, path tracer, 12 domain dashboards).
- `refresh-graph.mjs` / `validate-graph.mjs` / `graph-stats.mjs` — the `graph:*` scripts.

## Notes
- Reads `graphify-out/graph.json` (gitignored, ~44 MB). If missing, run `pnpm graph:update` first.
- The graph indexes code symbols (tree-sitter); SQL function bodies are shallow — use `database/supabase/migrations/` for DB truth.
- Docs: `docs/graph/`. Claude commands: `.claude/commands/graph-*.md`.
