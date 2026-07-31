# Phase 1 — Graph Coverage Audit

**Graph @ `0db025a6` (6 commits behind HEAD `fa1fcc76`). All counts from `graph.json`.**

## Totals
| Metric | Value |
|---|---|
| Nodes | 52,246 |
| Edges (links) | 66,761 |
| Communities | 3,279 |
| Distinct source files indexed | 3,403 (install report: 3,677 parsed) |
| Orphan nodes (degree 0) | 127 (0.24%) |
| Hyperedges | 0 |

Node `file_type`: code **28,208** · document **24,015** · concept 22 · rationale 1.
Edge `relation`: contains 40,877 · imports 7,791 · defines 7,031 · calls 5,222 · references 2,287 · imports_from 1,673 · re_exports 773 · inherits 704 · method 250 · exports 71 · implements 33 · navigates 30.

## Coverage vs repository
`git ls-files` = **4,593** files (3,357 code-ish: ts/tsx/js/mjs/sql/dart/json/md). Graph indexes **3,403** distinct source files. **Code coverage is essentially complete** for TS/TSX/Dart/MJS/JSON/MD; the delta is non-parsed assets (images, lockfiles, binaries) + the SQL gap below.

Languages (install report, consistent with `file_type`): Markdown 24,015 · TS 9,319 · Dart 7,413 · JSON 4,820 · TSX 3,170 · MJS 2,762 · Swift/Kotlin/Python/Shell 80/27/6/10.

## Per-runtime node coverage (apps / services / packages)
apps: mobile **5,134** (merchant-app 4,980) · merchant-control-plane 1,293 · storefront-runtime 910 · app-marketplace 679 · theme-marketplace 576 · identity-platform 443 · platform-console 443 · platform-operations-portal 348 · marketing-site 283 · developer-portal 277.
services: **api-gateway 3,623** · queue-workers 393 · webhook-service 175 · mobile-bff 128 · analytics-pipeline/checkout-runtime/event-bus/media-service/notification-service/search-service **73 each**.
packages: dart 1,865 · typescript 1,282 · shared-types 1,086 · theme-engine 464 · infrastructure 415 · checkout-core 259 · auth-core 254 · commerce-core 179 · billing-core 160 · cms-core 133 · tenant-core 123 · payments 101 · notification-core 94 · (+ smaller cores).

## Missing / under-indexed (the gaps)
- **Database — CRITICAL.** Only **2 nodes** under `database/` for **103 migrations**. Tables, views, RPCs, triggers, policies, indexes are **not** in the graph. SQL extraction was not active this run. → Phase 9 uses migrations directly.
- **Reserved services are stubs.** analytics-pipeline, checkout-runtime, event-bus, media-service, notification-service, search-service each show exactly **73 nodes** — identical manifest/AGENTS.md boilerplate, **no real implementation** (matches CLAUDE.md "reserved, manifest-only"). Not missing — confirmed empty.
- **Reserved mobile roots** (`apps/mobile/shopper-app`, `operator-app`) — not present as implemented trees.
- **Staleness:** graph misses the last 6 commits (HEAD moved `0db025a6`→`fa1fcc76`). Re-run `graphify update .`.

## Verdict
**Code-graph coverage ≈ 95%** (TS/Dart/JS/docs) and well-connected (0.24% orphans). **Schema-graph coverage ≈ 2%.** The graph is a high-fidelity application-code map with a database-shaped hole; close it by enabling SQL indexing and re-running.
