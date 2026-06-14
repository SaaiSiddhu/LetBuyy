# LCIS — Graph Quality Audit (Phase 1)

## Code graph (Graphify)
| Metric | Value |
|--------|------:|
| Nodes | 52,246 |
| Edges | 66,761 |
| Communities | 3,279 |
| Files parsed | 3,677 |
| Avg degree | ~2.6 |

### Coverage by language (nodes)
TypeScript 9,319 · Dart 7,413 · TSX 3,170 · MJS 2,762 · JSON 4,820 · Markdown 24,015 · Swift 80 · Kotlin 27.

### Coverage by domain (from `/api/domain`)
apps 10,386 · packages 6,913 · payments 6,393 · identity 5,586 · themes 5,163 · services 4,757 · security 3,805 · tenancy 1,802 · database 1,656 · marketplace 1,349 · developer 755.

### Quality notes
- **Node quality:** good for TS/TSX/Dart symbols (functions, components, routes). Markdown-heavy (24k) because governance docs are extensive — these are real nodes but inflate counts.
- **Edge quality:** import/contains/defines edges are reliable; dynamic/DI edges are not captured.
- **Communities:** 3,279 detected; names derived from dominant workspace (LCIS adds this — Graphify left placeholders).
- **Orphans / dead areas:** isolated single-degree nodes exist (mostly doc headings); not material.
- **Disconnected systems:** the mobile (Dart) tree is structurally present but loosely connected to the TS services tree (expected — they communicate over HTTP, not imports).

## The database gap — measured and closed
Graphify reported **~2% database coverage** because tree-sitter does not parse SQL function bodies. LCIS measured the true data surface and built the missing layer:

| DB object | Count (now indexed) |
|-----------|------:|
| Tables | 414 |
| Functions / RPCs | 156 (128 SECURITY DEFINER) |
| Policies | 651 |
| Triggers | 395 |
| Indexes | 826 |
| RLS tables | 394 (FORCE 44) |
| Tenant tables | 255 |

DB coverage went from ~2% to **the full schema** via `db-intel.mjs`, with RPC→route→table chains the code graph alone could never produce.

## Verdict
Code graph: **high quality** for static structure. Database: **was the critical blind spot, now closed.** Combined, the platform covers apps, services, packages, routes, RPCs, tables, policies, triggers, and flows.
