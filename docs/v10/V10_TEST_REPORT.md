# LCIS V10 Test Report

Executed against the running LCIS server (real browser via the preview harness) + the governance gate. Honest about scope and results.

## Scope
Change set = `tools/graph-server/` (vanilla-JS UI + Node http — no build/typecheck pipeline) + `docs/v10/` + `CLAUDE.md`. No app/service source changed.

## Static checks
| Check | Result | Evidence |
|-------|:------:|----------|
| `node --check server.mjs` | ✅ | parses |
| `index.html` `<script>` parse (`new Function`) | ✅ | 0 parse errors (removed one stray garbled constant during dev) |
| **Governance gate** (107 validators) | ✅ | `Governance gate lane passed (107 validators)` |

## Server endpoints
| Check | Result | Evidence |
|-------|:------:|----------|
| SPA fallback for deep links | ✅ | `GET /domain/orders/impact` → 200, `GET /page/launch` → 200 |
| `/api/*` still 404 JSON | ✅ | `GET /api/nope` → 404 |
| Path-step relations + explanations | ✅ | `/api/path` → `1. [imports] getSupabaseAdmin() imports compliance.ts` |
| Typed-edge data present | ✅ | neighborhood edge types `{calls, imports, contains, references, imports_from}` |

## Browser — functional (real DOM, all in-page)
| Phase | Result | Evidence |
|-------|:------:|----------|
| 1 URL state | ✅ | select payments → `/domain/payments`; switch to Impact → `/domain/payments/impact`; recent recorded |
| 2 Deep linking (refresh restore) | ✅ | full reload of `/domain/refunds/incidents` → **Incidents** tab active, refunds content, breadcrumb “Refunds” |
| 3 Browser history | ✅ | payments→orders `history.back()`→`/domain/orders`; `history.forward()`→`/domain/payments` (no reset to Overview) |
| 4 Restoration | ✅ | `lcis-last` restored on load when no URL target |
| 5 Recent workspaces | ✅ | palette home shows Recent (pinned-first) + Quick actions |
| 6 Command Palette V2 | ✅ | “what breaks if payments fail” → *What breaks if Payments fails*; “show inventory dependencies” → *Open Inventory · dependencies*; “open orders impact” → *Open Orders · impact* |
| 7 Typed edges | ✅ | technical graph: 412 typed edges, colored (calls/imports/contains/references), clickable legend filter |
| 8 Graph levels | ✅ | L1 Direct → L6 Platform; switched L2→L3 Domain, re-rendered |
| 9 Path explanations | ✅ | numbered steps with verb per relation |
| 10–14 Dependency/Impact/WhatBreaksIf/Generator/CrossNav | ✅ | Deps & Impact perspectives render; dependency pills navigate cross-domain (history-aware) |
| 15 Shareable URLs | ✅ | `xCopyLink` copies current canonical path + toast |

## Browser — responsive (Phase 16)
| Width | Doc overflow | Notes |
|------:|:------------:|-------|
| 320 | ✅ none | impact + dependencies; FAB 44px; perspective tab 58px (≥44px) |
| 375 | ✅ none | |
| 430 | ✅ none | dependency explorer + FAB drawer |
| 768 | ✅ none | impact perspective |
| 1024 | ✅ none | |
| 1440 | ✅ none | **fixed**: added `html,body{overflow-x:hidden}` + scrollable `.ws-tabs` (header search label/kbd previously pushed doc to 1535px) |

## Performance (Phase 17)
| Metric | Budget | Measured | Result |
|--------|:------:|:--------:|:------:|
| Search | < 200ms | ~9ms (`/api/search` 20 results) | ✅ |
| Workspace | < 500ms | ~1ms (article render, engines cached) | ✅ |
| Perspective switch | < 200ms | ~1ms | ✅ |
| Graph load | < 1s | 20–23ms (L3, 160 nodes / 412 edges) | ✅ |

All emitted to `window.__perf` + the bottom-right HUD; over-budget renders `console.warn`.

## Console & links
- **Console errors: none** (`level:error` empty across the whole session).
- All navigation links/pills resolve (cross-domain pills, palette commands, quick actions, level buttons, legend chips).

## Fix applied during testing
- Document horizontal overflow at 1440px (header search label/`⌘K` chip extended past the viewport with `overflow-x:visible`). Fixed with a universal `html,body{max-width:100%;overflow-x:hidden}` guard + `.ws-tabs{overflow-x:auto;flex-wrap:nowrap}`; re-verified clean at 320/375/430/768/1024/1440.

## Not run (with reason)
- Full monorepo `build`/`typecheck`/`lint`: **n/a** — no app/service source changed; LCIS has no build step; validated by `node --check` + the gate.
- Live provider data: **NOT CONNECTED** by design (no credentials in dev) — unchanged by V10.
