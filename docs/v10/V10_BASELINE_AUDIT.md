# LCIS V10 Baseline Audit (Phase 0)

Repository-truth snapshot of LCIS **before** the V10 Navigation & Intelligence Foundation. Directly verified by reading `tools/graph-server/` (no fabrication). V10 extends this — it does not rebuild it.

## Current pages & modes (`index.html`, 1807 lines, single `<script>`, vanilla JS — no framework)
- **Modes:** Explain (default, three-pane `#explain` grid), Technical (`#tabs` + `main`), Atlas (Technical → atlas tab). `setMode('explain'|'technical')`.
- **Explain pages** (`xSelect` targets): `getting-started`, `infrastructure`, `database`, `ops-center`, `mission-control`, `launch`, `connections`, `ecosystem`, `live-integrations`, `readiness`, `ai-context`, `merchant-journey`, `customer-journey`, plus every domain node from `/api/explain`.
- **Workspace perspectives** (17, `WSPERSP`): overview · explain · technical · database · api · infrastructure · security · operations · incidents · dependencies · impact · live · graphs · trace · related · ai · atlas. Dispatched by `xPersp(key, p)`; tab bar by `wsBar`.

## Current APIs (~105 `/api/*` endpoints in `server.mjs`)
Graph/navigation-relevant endpoints:
- `/api/search?q=&limit=` — degree-ranked node search.
- `/api/node?id=` — node view + 1-hop neighbor graph (`relation` on links).
- `/api/neighbors?id=&depth=&limit=` — N-depth neighborhood; **links carry `relation`**.
- `/api/path?a=&b=` — BFS shortest path; links currently tagged `relation:'path'` (not the real edge relation).
- `/api/atlas?limit=&domain=` — backbone layout (density 1k/1.5k/2.5k).
- `/api/community?id=` , `/api/graph-domain?key=`.
- `/api/graph?kind=` — knowledge-graph **layers**: business · journey · technical · database · infrastructure · security · ownership · dependency · revenue · ai.
- Intelligence (reused by workspace perspectives): `/api/explain`, `/api/impact-score`, `/api/related`, `/api/lineage`, `/api/trace`, `/api/incident-control`, `/api/runbook`, `/api/search-v2`, `/api/ops-copilot`, `/api/live-health`, `/api/federation` … (full set from V1→LCIS X).

## Current graph layers, levels & edge types
- **Data:** `graph.json` = 52,246 nodes · 66,761 links. **Links carry a real `relation` field** — 15 types: `contains` 40,877 · `imports` 7,791 · `defines` 7,031 · `calls` 5,222 · `references` 2,287 · `imports_from` 1,673 · `re_exports` 773 · `inherits` 704 · `method` 250 · `exports` 71 · `implements` 33 · `navigates` 30 · `mixes_in` 14 · `extends` 4.
- **Rendering:** `runSim()` (force-directed neighbor graph) and `renderAtlas()` (backbone) both draw **plain gray edges** — edge types are in the data but **not surfaced** in the UI today. No legend, no edge filter.
- **Levels:** `/api/neighbors?depth=` supports depth, and Atlas has a density selector — but there is **no progressive Level 1–6 control**.
- **Knowledge layers:** 10 kinds (above) via `/api/graph?kind=`, surfaced in the Graphs perspective as edge lists.

## Current workspace, navigation & URL handling
- **Selection:** `xSelect(key)` (left tree / pills) → renders page or domain article; `xPersp(key,p)` switches perspective; `xCtxPanel(n)` right-rail dependency context; cross-domain pills already call `xSelect`.
- **URL state: ABSENT.** No `history.pushState`/`replaceState`, no `popstate`, no `hashchange`. `xCopyLink(key)` writes `location.origin + '/#' + key` to the clipboard, but **nothing reads the hash on load** — a refresh always resets to `getting-started`. The server serves `index.html` only for `/` and `/index.html`; any deep path 404s.
- **Restoration: ABSENT.** Only `localStorage['lcis-nav']` (sidebar collapsed on/off) is persisted. No last-workspace, no recent-workspaces, no pinning.

## Current search & command palette
- **Header search** `#q` (Technical mode) → `/api/search`; Explain has the `⌘K` button.
- **Command palette: EXISTS** (`cmdk`, opened by `⌘K`/`Ctrl-K` or the header button). `cmdkSearch` lists Domains (from `XDATA`), a small fixed Pages list, and Code & data (`/api/search`); Enter/“Ask LCIS” routes to `runCopilot` → `/api/search-v2`. **No command actions** (open-perspective, show-dependencies, what-breaks-if), **no recent list**, **no NL navigation grammar**.
- `search-v2` returns `{domain, intent, answer:{summary,flow}, sourceEngines}`.

## Current mobile & performance
- **Breakpoints:** a primary `@media (max-width:880px)` (header wrap + horizontal-scroll chips) plus narrower rules; FAB (`#xfab-nav`) + overlay (`#xmob-overlay`) + collapsible nav. Needs explicit validation at 320/375/390/430/768/1024/1440.
- **Performance: NO instrumentation** — no `performance.now`, no timing log, no budget. Engines load once at server startup; workspace/perspective renders are pure composition but unmeasured.

## V10 gap map (what each phase must add vs what exists)
| Phase | Exists? | V10 work |
|------:|---------|----------|
| 1 URL State Engine | ❌ absent | new router: parse path/query/hash → restore domain·perspective·level·search |
| 2 Deep Linking | ❌ | `/domain/<key>/<perspective>` paths + server SPA fallback |
| 3 Browser History | ❌ | pushState on nav + `popstate` restore (no reset to Overview) |
| 4 Workspace Restoration | ❌ | `localStorage` last workspace → “continue where you left off” |
| 5 Recent Workspaces | ❌ | last-20 list + pinning (in palette + tree) |
| 6 Command Palette V2 | ⚠ basic | command actions + recent + NL navigation grammar |
| 7 Typed Edges | ⚠ data-only | color + label edges by `relation` + legend + filter |
| 8 Graph Levels | ⚠ depth-only | Level 1–6 progressive control |
| 9 Path Explanations | ⚠ hops-only | human step explanations (server `steps` + UI) |
| 10 Dependency Explorer | ✅ Deps persp | keep + enrich (cross-clickable) |
| 11 Change Impact Explorer | ✅ Impact persp | keep (`/api/impact-score`) |
| 12 What Breaks If | ✅ impact+copilot | surface explicitly in palette |
| 13 Workspace Generator | ✅ search→workspace | keep |
| 14 Cross-Domain Nav | ✅ clickable pills | keep + history-aware |
| 15 Shareable URLs | ⚠ hash only | full-state canonical URL copy |
| 16 Mobile Navigation | ⚠ partial | validate 320–1440 + new controls responsive |
| 17 Performance Budget | ❌ | instrument search/workspace/perspective + HUD |
| 18 E2E Verification | — | browser + mobile + perf + gate |

**Conclusion:** the *intelligence* phases (10–14) already exist from V8/V9/LCIS X. V10's genuinely-new work is the **navigation foundation** (URL state, deep linking, history, restoration, recent, palette V2, shareable URLs) plus **graph enrichment** (typed edges, graph levels, path explanations) and **performance instrumentation** — all client-side over the existing engines, with the one server change being an SPA route fallback + real path-step relations.
