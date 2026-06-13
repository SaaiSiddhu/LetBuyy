# LetBuyy Graph — Overview

The LetBuyy Graph Intelligence Platform (LGIP) turns the Graphify code graph into a queryable, browsable engineering tool. **No Graphify knowledge required** — use `pnpm graph:*` and the UI.

## Quick start
```bash
pnpm graph:update     # rebuild the graph (graphify update .)
pnpm graph:validate   # sanity-check it
pnpm graph:stats      # print statistics
pnpm graph:ui         # → http://localhost:3333  (visual explorer)
```

## Graph size (current build)
| Metric | Value |
|--------|-------|
| Nodes | **52,246** |
| Edges | **66,761** |
| Communities | **3,279** |
| Files | 3,677 |
| Built at commit | `0db025a6` |
| graph.json | 43.7 MB (**gitignored** — rebuild locally) |

## Languages
TypeScript `.ts` 9,319 · Dart 7,413 · TSX 3,170 · MJS 2,762 · JSON 4,820 · Markdown 24,015 · Swift 80 · Kotlin 27.

## Services / workspaces (by node count)
`apps/mobile/merchant-app` 4,980 · `services/api-gateway` 3,623 · `apps/merchant-control-plane` 1,293 · `packages/shared-types` 1,049 · `apps/storefront-runtime` 910 · `apps/app-marketplace` 679 · `packages/typescript/ui` 664 · `apps/theme-marketplace` 576.

## Domain coverage (from `/api/domain`)
| Domain | Nodes | Files | Attention score* |
|--------|------:|------:|:---:|
| apps | 10,386 | 903 | 100 |
| packages | 6,913 | 278 | 92 |
| payments | 6,393 | 826 | 82 |
| identity | 5,586 | — | 74 |
| services | 4,757 | 324 | 70 |
| themes | 5,163 | 612 | 69 |
| security | 3,805 | 756 | 51 |
| marketplace | 1,349 | 190 | 28 |
| database | 1,656 | 477 | 27 |
| tenancy | 1,802 | — | 28 |
| developer | 755 | 81 | 20 |

\* *Attention score is a heuristic of size × edge-density per domain — a "where is the complexity" signal, NOT a vulnerability score.*

## What you can do
Search any symbol/file/route · explore a node's neighborhood (visual force graph) · trace shortest paths · browse per-domain dashboards · drive audits from Claude (`/graph-search`, `/graph-payments`, `/graph-auth`, `/graph-tenancy`, `/graph-dependencies`, `/graph-security`).

## Known limitation
Graphify indexes **code symbols** (tree-sitter); SQL function bodies are shallow, so individual Postgres RPCs are not distinct nodes. For DB/money truth use `database/supabase/migrations/` + the `canonical-ledger-only` validator.
