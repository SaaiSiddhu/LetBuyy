# Phase 14 — Production Readiness (graph-informed)

**This reconciles the graph view with the code-verified certification (`docs/final-v1-certification/`). The graph corroborates the architecture; the certification owns the readiness verdict. Where they agree, confidence is high.**

## Readiness by area
| Area | Readiness | Graph corroboration | Authority |
|---|---|---|---|
| Architecture | 88% | clean layered topology, no app→app coupling, gateway hub | cert + graph |
| Security | 82% | ownership/tenant-guard nodes are top-degree, no orphaned guards | cert (code), graph |
| Payments | 90% (code) | densest domain, adapter-isolated, app-free | cert + migrations |
| Orders/Checkout | partial | flow graphed to the SQL boundary; **shipping-drop defect** | cert |
| Refunds | sound | payments subgraph | cert + mig 139 |
| Payouts | sound code, **not KYC-gated** | payouts subgraph | cert + mig 160 |
| Gift Cards | redeemable backend, **no buyer UI** | wrappers graphed, RPCs not | cert + mig 170/173 |
| Notifications | partial | notification-core 94 nodes | cert (COD/shipped email gaps) |
| Marketplace | frozen | 1,532 nodes, not deploy target | CLAUDE.md |
| Developer Platform | frozen | 277 nodes | CLAUDE.md |
| Mobile | client present (4,980 nodes) | merchant-app graphed | cert (V2 seams) |
| Analytics | thin | 73-node stub service + gateway | cert |
| **Database** | **sound (migrations) / invisible (graph)** | **2 DB nodes — graph cannot assess** | migrations + validators |

## Readiness %
- **Code architecture readiness (graph-corroborated): ~85%.**
- **Production readiness (deploy/provision): ~15%** — never pushed (graph built at `0db025a6`; origin far behind), never provisioned (cert).

## Critical blockers (carried from certification, unchanged by the graph)
1. Never pushed / deployed. 2. ~40 secrets unprovisioned. 3. No external alerting. + code defects: LB-8 (a *missing renderer edge* the graph can locate), shipping-drop, LB-11.

## High risks (graph-specific)
- **Graph blind to the database** → any DB-level regression (a dropped policy, an unsafe RPC) is invisible to graph-based monitoring. Mitigate by enabling SQL indexing before relying on graph audits for money/tenancy.
- **Archived firebase-legacy indexed as live** → impact analysis could mislead.
- **Staleness** → graph 6 commits behind; a graph-gated check would miss the latest changes.

## Medium risks
- Non-V1 payment routes + frozen marketplace routes are graph-real and reachable.
- Barrel-export coupling means high-blast-radius edits to shared-types/api-client.

## Recommendations
1. Re-index with SQL → make the database half of every flow visible (unblocks real graph-based readiness checks).
2. Exclude `docs/archive/**` from extraction.
3. Re-run `graphify update .` in CI so the graph tracks HEAD.
4. Wire `graphify-mcp` so the readiness checks (Phase 15 packs) are queryable, not manual.
5. Treat migrations + governance gate as the money/tenancy/schema authority until SQL is indexed — **do not gate production on the graph alone.**
