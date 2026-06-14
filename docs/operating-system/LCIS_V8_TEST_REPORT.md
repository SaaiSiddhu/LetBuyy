# LCIS V8 Test Report

Executed against the V8 working tree. Honest about what was run and what is not applicable.

## Scope of change
The entire V8 change set is `tools/graph-server/` (the LCIS viewer — vanilla JS + Node http, **ungoverned tooling, no build/typecheck/test pipeline**) plus `docs/`, `CLAUDE.md`, and `package.json` script entries. **No app or service source changed**, so the monorepo app build/typecheck/lint is unaffected by this work.

## Tests executed
| Check | Result |
|-------|:------:|
| `node --check` on all 76 engines (`tools/graph-server/*.mjs`) | ✅ all parse |
| `node --check` on the index.html `<script>` (the UI) | ✅ parse |
| `node --check` on `server.mjs` | ✅ parse |
| **Governance gate** `node scripts/validate-governance.mjs` (the authoritative 107-validator repo test) | ✅ **107/107** |
| API endpoints respond 200 (workspace, related, graph, search-v2, trace, ai-context-pack, …) | ✅ |
| Workspace perspectives execute without throwing (explain/technical/graphs/trace/related/ai) | ✅ |
| Explain pages execute without throwing (mission-control/launch/live-integrations/ecosystem/database/readiness) | ✅ |
| **Browser console errors** | ✅ none |
| **Mobile/responsive overflow** at 320 / 375 / 390 / 430 / 768 / 1024 / 1440px | ✅ no horizontal overflow at any width |
| Touch targets (perspective tabs, FAQ rows) ≥ 44px | ✅ |

## Fix applied during testing
At 430–880px the header `.kbtn` (220px search button) overflowed because the header only wrapped at ≤400px. Fixed by wrapping the header (`flex-wrap`) at the 880px breakpoint. Re-validated: 320/375/430/768/1024/1440 all clean.

## Not run (with reason — honest)
- `npm run build` / `typecheck` / `lint` (full monorepo turbo over apps/services): **not applicable** — no app/service source changed; running the multi-app turbo build is unrelated to this LCIS-only change and out of scope. The LCIS layer has no TypeScript/build step; it is validated by `node --check` + the governance gate above.
- Live provider probes: returned **NOT CONNECTED** (no credentials in the dev environment) — by design, not a failure.

## Verdict
All applicable validations green; no console errors; responsive 320–1440px; gate 107/107.
