# LCIS V11 Test Report

Executed against the running LCIS server (real browser via the preview harness) + the governance gate. Honest about scope and results.

## Scope
Change set = `tools/graph-server/` (vanilla-JS UI + Node http — no build/typecheck pipeline) + `docs/v11/` + `CLAUDE.md`. No app/service/database source changed.

## Static checks
| Check | Result | Evidence |
|-------|:------:|----------|
| `node --check business-flow-intel.mjs` | ✅ | parses; CLI prints 10 journeys / 9 implemented / 32 edges |
| `node --check server.mjs` | ✅ | parses |
| `index.html` `<script>` parse | ✅ | 0 parse errors |
| **Governance gate** (107 validators) | ✅ | **107/107** with V11 present — see "Gate isolation" |

## Endpoints (server)
| Endpoint | Result | Evidence |
|----------|:------:|----------|
| `/api/business-flow` | ✅ | 10 journeys, 9 implemented, 32 shared-domain edges, 9 money journeys |
| `/api/business-flow?journey=checkout` | ✅ | actors/stages/systems/dependencies/failure/recovery/metrics |
| `/api/business-impact?domain=payments` | ✅ | plain-language merchant/customer/revenue/operational/growth/launch + scores |
| `/api/investor` | ✅ | 6 panels; verdict NO-GO; 22 domains |
| `/api/developer` | ✅ | gettingStarted + flows + journeys |
| `/api/founder` | ✅ | verdict NO-GO; 7 readiness panels |

## Browser — functional (real DOM)
| Phase | Result | Evidence |
|-------|:------:|----------|
| 4 Founder | ✅ | `/page/founder` — readiness bars + verdict |
| 5 Operations | ✅ | topology cards + live NOT CONNECTED table + money-domain health |
| 6/17 Support | ✅ | 4 NL quick-questions; investigation renders (resolved domain, diagnosis, dependencies) |
| 15 Investor | ✅ | `/page/investor` — 6 plain-language panels incl. Risk |
| 16 Developer | ✅ | architecture walk + 22 domain chips + key flows |
| 1/2/11 Business Flows | ✅ | 10 journey cards (Subscription = NOT IMPLEMENTED) + 6 business graph tabs |
| 2/9 Journey Workspace | ✅ | Refund journey: actors (Merchant/Ledger/Razorpay), 7-step flow, systems (9r/39rpc/33t), failure points, recovery, metrics NOT CONNECTED |
| Journey deep-link | ✅ | full reload of `/journey/payment` → Payment Journey restored (HMAC/ledger flow) |
| 10 Copilot V2 | ✅ | "how does checkout work" → `/journey/checkout` |
| 18 Workspace auto-gen | ✅ | journey + domain queries generate full workspaces |

## Browser — responsive (Phase 21)
All 7 modes + journey workspace checked at **320 / 768 / 1440** — **no document overflow** at any width (V10's `html,body{overflow-x:hidden}` guard + scrollable bars carry over). Mobile FAB + drawer functional.

## Performance (Phase 22)
| Surface | Budget | Measured | Result |
|---------|:------:|:--------:|:------:|
| Founder / Investor / mode render | < 500ms | ~3ms | ✅ |
| Journey workspace | < 500ms | 5–11ms | ✅ |
| Support investigation | < 500ms | well under | ✅ |
| Business-flow endpoint | — | sub-5ms (cached engines) | ✅ |

Emitted to the bottom-right perf HUD + `window.__perf`.

## Console & honesty
- **Console errors: none** across the session (`level:error` empty).
- **No fabricated data:** every live metric renders NOT CONNECTED + its source; the Subscription journey is NOT IMPLEMENTED (no `subscriptions` domain), never invented; investor/founder verdicts are the real NO-GO with 5 blockers.

## Gate isolation (important — external working-tree noise)
During V11 the working tree accumulated **unrelated changes from another workstream** — edited `database/supabase/migrations/*.sql`, `apps/identity-platform/src/lib/auth/cookies.ts`, service `wrangler.toml`s, an untracked migration `175_*.sql`, and `apps/*/.next` build outputs. These tripped the tenant-isolation, sequential-migration and stale-artifact validators — **none of which scan V11's files**. With that external noise set aside (stashed/moved, then restored), the gate passes **107/107** with the full V11 change set present. V11 touches **zero** files under `database/`, `services/`, or `apps/` — it cannot cause those failures. The external workstream's changes were restored untouched.

## Not run (with reason)
- Full monorepo `build`/`typecheck`/`lint`: **n/a** — no app/service source changed; LCIS has no build step.
- Live provider data: **NOT CONNECTED** by design (no credentials in dev).
