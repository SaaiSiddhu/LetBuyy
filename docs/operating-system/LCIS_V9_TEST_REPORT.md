# LCIS V9 Test Report

Executed against the V9 working tree. Honest about scope and results.

## Scope
Change set is `tools/graph-server/` (LCIS viewer — vanilla JS + Node http, no build/typecheck pipeline) + `docs/` + `CLAUDE.md`. No app/service source changed.

## Results
| Check | Result | Evidence |
|-------|:------:|----------|
| `node --check` all 76 engines | ✅ | all parse |
| `node --check` index.html `<script>` | ✅ | parse (fixed one escaped-apostrophe SyntaxError during dev) |
| `node --check` server.mjs | ✅ | parse |
| **Governance gate** (107 validators) | ✅ | `Governance gate lane passed (107 validators)` |
| Workspace exposes 16+ perspectives | ✅ | `/api/workspace?domain=orders` → 19 perspective keys; bar shows 16 tabs |
| **Impact/risk/recovery scores** | ✅ | `/api/impact-score?domain=payments` → impact 73, risk 75, recovery "Hard — ledger reconciliation"; 49 routes / 205 tables affected |
| What-Breaks-If | ✅ | `inventory` → immediate: inventory/orders/refunds/operations |
| All 15 in-page perspectives execute | ✅ | exercised in-browser, **zero errors** |
| Cross-domain navigation | ✅ | payments → refunds via xSelect, no reload |
| **Browser console errors** | ✅ | none |
| **Responsive overflow** 320/375/390/430/768/1024/1440px | ✅ | no document horizontal overflow at any width |
| Header chip strip on mobile | ✅ | made horizontally scrollable (`overflow-x:auto`) so no hidden content (was clipping at 320) |
| Touch targets ≥44px | ✅ | perspective tabs / FAQ rows |
| **Performance** (workspace < 500ms, search < 200ms) | ✅ | workspace **1.4ms**, impact-score **3.9ms**, search-v2 **0.9ms** (all engines cached at startup; pure composition) |

## Fixes applied during testing
1. `xWsDatabase` lede had an escaped apostrophe (`\\'`) that broke the script string → removed the apostrophe.
2. Header `.chips` clipped at narrow widths → made the strip `overflow-x:auto` (scrollable, no hidden content).

## Not run (with reason)
- Full monorepo `npm run build`/`typecheck`/`lint` (turbo over apps/services): **not applicable** — no app/service source changed; LCIS has no build step; validated by `node --check` + the gate.
- Live provider probes: **NOT CONNECTED** (no credentials in dev) — by design.

## Note on authorship
Part of the V9 UI (the three-pane shell: left-nav collapse, right Domain Context panel, mobile FAB drawer) was present in the working tree from a background/linter process. It was **read in full, verified (parses, all functions defined, renders, no console errors), and extended** with the 16-perspective expansion + impact scores — not committed blindly.
