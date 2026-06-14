# LCIS V9 Workspace Certification

Every search opens a complete **16-perspective Domain Workspace** in a three-pane shell, composed entirely from existing engines. Verified live across desktop/tablet/mobile.

## The 16 perspectives (each reuses an existing engine)
| Perspective | Source | Phase |
|-------------|--------|:-----:|
| ◆ Overview | explain node summary | 1/12 |
| 📖 Explain | xArticle (blog: breadcrumbs, ToC, reading time, FAQ, prev/next) | 2 |
| ⚙ Technical | explain-intel `.technical` | 12 |
| ▤ Database | `/api/lineage` (policies/triggers/indexes/RPCs/FK) | 12 |
| ⇄ API | routes → RPCs | 12 |
| ◰ Infra | `/api/infrastructure-control` | 12 |
| ⛨ Security | `/api/security-intelligence` | 12 |
| ◍ Ops | `/api/operations` | 12 |
| ⚠ Incidents | `/api/incident-control` | 12 |
| ⚯ Dependencies | `/api/related` (upstream/downstream/DB/API/infra) | 5 |
| 💥 Impact | `/api/impact-score` (impact·risk·recovery + what-breaks-if) | 6/7 |
| ◈ Graphs | `/api/graph?kind=` (7 isolated layers) | 3/4 |
| ⟿ Trace | search-v2 + `/api/trace` (NL) | — |
| ⚯ Related | `/api/related` | 8 |
| ✦ AI | `/api/ai-context-pack` (5 packs, copy + download) | — |
| ★ Atlas | full Atlas (deep) | — |

## Three-pane shell (verified)
- **Left** — collapsible NAVIGATION (toggle), 22-domain tree.
- **Center** — workspace with the perspective switcher + Copy link.
- **Right** — **Domain Context** panel: Criticality · Owner · Depends-on(N) · Consumed-by(N) · quick actions (Technical / Trace / AI pack / Atlas) — the dependency explorer (Phase 5/9).
- **Mobile** — FAB drawer (☰) + overlay; perspective tabs scroll horizontally.

## Verified live
- Payments workspace: 16 perspective tabs render; **Impact perspective** shows IMPACT 73 / RISK 75 / RECOVERY "Hard — ledger reconciliation" + AFFECTED (49 routes · 205 tables · domains · merchants "ALL tenants" · Revenue "NOT CONNECTED" · FK 14).
- All 15 in-page perspectives execute with zero errors; cross-domain nav works.
- Responsive: no horizontal overflow at 320/375/390/430/768/1024/1440px; FAB + scrollable tabs on mobile.

## Honesty
Live values (revenue, runtime, merchant counts, provider data) render **NOT CONNECTED** with their source. Impact/risk scores are labeled heuristics derived from the cross-domain blast + money/tenant flags + open blockers — repository truth, not fabricated telemetry. CONNECTED / NOT CONNECTED only.
