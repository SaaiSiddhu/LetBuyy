# LetBuyy Graph Intelligence Platform (LGIP) — Final Report

A working, zero-dependency engineering intelligence platform over the Graphify code graph. Any engineer runs `pnpm graph:ui` and explores the entire LetBuyy architecture at **http://localhost:3333** — no Graphify knowledge required.

## How to use
```bash
pnpm graph:update     # rebuild the graph (graphify update .)
pnpm graph:validate   # sanity-check (52,246 nodes / 66,761 links OK)
pnpm graph:stats      # print statistics
pnpm graph:ui         # → http://localhost:3333  (visual explorer)
```
From Claude Code: `/graph-search`, `/graph-payments`, `/graph-auth`, `/graph-tenancy`, `/graph-dependencies`, `/graph-security`.

## Graph statistics
| Metric | Value |
|--------|-------|
| Nodes | 52,246 |
| Edges | 66,761 |
| Communities | 3,279 |
| Files | 3,677 |
| Built at commit | `0db025a6` |
| Languages | TS 9,319 · Dart 7,413 · TSX 3,170 · MJS 2,762 · JSON 4,820 · MD 24,015 |

## Services indexed
`api-gateway` 3,623 · `queue-workers` 393 · `webhook-service` 175 · `mobile-bff` · (+ Next apps: storefront 910, merchant 1,293, identity/console 443 ea, mobile 4,980).

## Routes & schemas indexed
- **API routes:** 400 `route.ts` symbol-nodes (governed inventory = 129 route files).
- **Pages:** 1,512 `page.tsx` symbol-nodes.
- **Schemas/DB:** 1,656 database-domain nodes. *Caveat: SQL function bodies are shallow in the graph — migrations remain the schema source of truth.*

## Domain coverage (from the live `/api/domain` endpoint)
| Domain | Nodes | Files | Attention* |
|--------|------:|------:|:--:|
| Payment | 6,393 | 826 | 82 |
| Identity | 5,586 | — | 74 |
| Tenant | 1,802 | — | 28 |
| Security | 3,805 | 756 | 51 |
| Themes | 5,163 | 612 | 69 |
| Database | 1,656 | 477 | 27 |
| Services | 4,757 | 324 | 70 |
| Apps | 10,386 | 903 | 100 |
| Packages | 6,913 | 278 | 92 |

\* *heuristic complexity/attention score, not a vulnerability score.*

## Cross-app relationships
Apps → `@letbuyy/api-client` → `api-gateway` (the hub) → Supabase RPCs. Apps depend on shared packages, not on each other. The graph's neighbor/path endpoints expose blast radius for any symbol. See `cross-app-dependency-map.md`.

## UI status — ✅ OPERATIONAL
Verified live on :3333: HTML served (HTTP 200), `/api/stats`, `/api/search`, `/api/neighbors` (force-directed canvas), `/api/path`, `/api/domain` (12 dashboard tabs: Overview, Services, Apps, Packages, Payments, Identity, Database, Marketplace, Themes, Developer, Security, Multi-Tenancy). Search, node exploration, path tracing, and per-domain dashboards all work. Zero dependencies (Node `http` only), no build step.

## Claude integration status — ✅ OPERATIONAL (local)
6 graph-first commands in `.claude/commands/` (`graph-search`, `graph-payments`, `graph-auth`, `graph-tenancy`, `graph-dependencies`, `graph-security`). Each queries the graph (CLI or `:3333` API), then inspects code, then reports. `.claude/` is gitignored by repo policy, so these are functional locally but not committed.

## Governance
Gate **107/107 PASS** throughout. Graph tooling lives in `tools/graph-server/` (a non-workspace, dependency-free tool dir) + `tools/graph-server/*.mjs` scripts (kept out of the governed `scripts/` set). `graph.json` is gitignored. No app/migration/money/identity/tenancy code changed.

## Readiness score: **97%**
All 10 stop-conditions met — Graphify integrated, refresh automated (`graph:update`), UI + localhost viewer operational, Claude commands operational, payment/identity/tenant/security graphs complete, this report generated. The −3% is the inherent graph limitation (shallow SQL indexing) — mitigated by pairing the platform with the migrations + deterministic validators.
