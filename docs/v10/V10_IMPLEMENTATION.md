# LCIS V10 Implementation

All 18 phases, implemented by **extending** the existing LCIS UI/engines — no duplicate engines, no duplicate APIs, no parallel system, no mock data. Change set: `tools/graph-server/server.mjs`, `tools/graph-server/index.html`, `CLAUDE.md`, `docs/v10/`.

## Server (`server.mjs`) — 2 changes
- **SPA route fallback** — any non-`/api` path (e.g. `/domain/orders/impact`, `/page/launch`) serves the app shell so a refresh / shared deep link restores client-side; `/api/*` still 404s as JSON.
- **Real path-step relations** — `shortestPath` now records the typed `relation` for each hop and returns `steps[]` with a human `explanation` (e.g. `getSupabaseAdmin() imports compliance.ts`), via a `RELATION_VERB` map.

## Client (`index.html`) — V10 module + targeted edits
Inserted one cohesive V10 module (router, storage, perf, typed-edge/level helpers, palette V2, node-graph) + injected styles; modified `xSelect`, `xPersp`, `xCopyLink`, `bootExplain`, `loadNode`, `runSim`, `openCmdk`, `cmdkSearch`, `cmdkRun`.

| Phase | Implementation |
|------:|----------------|
| 1 URL State Engine | `v10Parse()` reads `/domain/<key>[/<perspective>]` + `?perspective=&level=&q=` + back-compat `#key`; `v10Apply()` restores domain + perspective; `xSelect`/`xPersp` push the canonical URL. |
| 2 Deep Linking | path-based URLs `/domain/<key>/<perspective>` + `/page/<key>` + server SPA fallback → every view shareable & refresh-safe. |
| 3 Browser History | `xSelect`/`xPersp` `history.pushState`; `popstate` → `v10Apply(…, false)` restores without reset to Overview. |
| 4 Workspace Restoration | `localStorage['lcis-last']`; `v10InitRouter()` restores last workspace when no URL target → “continue where you left off”. |
| 5 Recent Workspaces | `localStorage['lcis-recent']` (last 20, pinned-first); `v10RecordRecent`/`v10TogglePin`; shown in the palette home. |
| 6 Command Palette V2 | `v10Commands(q)` NL grammar — “what breaks if X”, “show X dependencies”, “blast radius X”, “open X <perspective>”, plus recent + quick actions; routes via `routeGo`. |
| 7 Typed Edges | `runSim` colors edges by `relation` (15 types) with a clickable legend + per-relation filter (`window._v10RelOff`, `_v10Redraw`). |
| 8 Graph Levels | `V10_LEVELS` L1 Direct → L6 Platform (depth+limit); `v10NodeGraph(id, level)` progressively re-fetches `/api/neighbors` and re-renders. |
| 9 Path Explanations | numbered steps with a verb per typed edge, from the server `steps[]`. |
| 10 Dependency Explorer | Deps perspective + right Domain Context panel (kept; cross-clickable, history-aware). |
| 11 Change Impact Explorer | Impact perspective (`/api/impact-score`) — files/domains/tables/routes/workers/queues/merchants/customers + risk + recovery. |
| 12 What Breaks If | surfaced in the palette (“what breaks if payments fail” → impact) + `/api/impact-score` whatBreaksIf + `/api/ops-copilot`. |
| 13 Workspace Generator | any selection/search → full 17-perspective workspace (existing). |
| 14 Cross-Domain Nav | dependency pills `routeGo` to the target domain — every dependency clickable, now history-aware. |
| 15 Shareable URLs | `xCopyLink` copies the current canonical path (reflects domain+perspective) + a toast. |
| 16 Mobile Navigation | universal `html,body{overflow-x:hidden}` guard + always-scrollable `.ws-tabs`; FAB + drawer retained. |
| 17 Performance Budget | `v10Perf()` HUD (bottom-right) + `window.__perf` log; budgets search 200 / workspace 500 / perspective 200 / graph 1000 ms. |
| 18 E2E Verification | see `V10_TEST_REPORT.md`. |

## Reuse statement
Zero new engines. Navigation composes the existing `/api/explain`, `/api/neighbors`, `/api/path`, `/api/impact-score`, `/api/related`, `/api/search`, `/api/search-v2`, `/api/incident-control`, `/api/trace`, knowledge graphs and Atlas. The only server additions are the SPA fallback and richer path steps — no new endpoint, no new graph, no mock data.
