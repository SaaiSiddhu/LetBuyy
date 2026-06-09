# FOUNDATION_EXECUTION_DASHBOARD

> **The control tower.** Codex updates this after **every** wave (and on any STOP/BLOCK). A human reading only this file knows exactly where the autonomous run is, what's green, what's blocked, and what's next. Single source of run-state — keep it current or the wave is not "done."
> **Rule:** a wave may not be marked ✅ COMPLETE here until its checkpoint (V2 §4.1) is green and its reports are written. On restart, read this first.

## Run summary
- **Mission:** `FOUNDATION_STEPUP_MISSION_V2.md` · **Integration branch:** `stepup/main`
- **Overall status:** ◐ IN PROGRESS
- **Current wave:** Wave 3 — Production Safety
- **Open blockers:** 0 · **Open CLASS-A SKIPs:** 4 · **CLASS-B STOPs:** 0
- **Last updated:** 2026-06-09T20:28:15Z (UTC) by Codex

| Phase/Wave | Status | Build | Tests | Dep-graph | Branch | Migrations | SKIPs | Blockers |
|---|---|:--:|:--:|:--:|---|:--:|:--:|:--:|
| PHASE A — Repo Truth Audit | ✅ complete | — | — | — | `stepup/main` | 0 | 0 | 0 |
| PHASE A.5 — Risk Matrix | ✅ complete | — | — | — | `stepup/main` | 0 | 0 | 0 |
| Wave 0 — Truth Harness | ⚠ complete-with-SKIPs | ✅ | ✅ | ✅ | `stepup/wave-0-truth-harness` | 0 | 1 | 0 |
| Wave 1 — Money Fixes | ⚠ complete-with-SKIPs | ✅ | ✅ | ✅ | `stepup/wave-1-money` | 1 | 1 | 0 |
| Wave 2 — Tenant Isolation | ✅ complete | ✅ | ✅ | ✅ | `stepup/wave-2-tenant-isolation` | 0 | 0 | 0 |
| Wave 3 — Production Safety | ⚠ complete-with-SKIPs | ✅ | ✅ | ✅ | `stepup/wave-3-production-safety` | 0 | 2 | 0 |
| Wave 4 — Session Security | ☐ pending | — | — | — | — | 0 | 0 | 0 |
| Wave 5 — Design Governance | ☐ pending | — | — | — | — | 0 | 0 | 0 |
| Wave 6 — Theme Governance | ☐ pending | — | — | — | — | 0 | 0 | 0 |
| Wave 7 — Beta Readiness | ☐ pending | — | — | — | — | 0 | 0 | 0 |
| WAVE FINAL — Final Audit | ☐ pending | — | — | — | — | 0 | 0 | 0 |

Status legend: ☐ pending · ◐ in-progress · ✅ complete · ⛔ blocked (CLASS-B STOP) · ⚠ complete-with-SKIPs.

---

## Per-wave detail (Codex fills each block on completion)

### TEMPLATE (copy per wave)
```
## WAVE <n> — <name>
Status:        <pending | in-progress | complete | blocked>
Started:       <UTC>
Completed:     <UTC>
Branch:        stepup/wave-<n>-<slug>  (merged to stepup/main: yes/no)
Build:         <green/red> (pnpm run build)
Tests:         <green/red> (<which suites; what they prove>)
Dependency-graph: <green/red> (pnpm run validate:dependencies)
Files changed: <count> — <key files by symbol>
Migrations added: <ids + expand/contract step + verification result, or none>
SKIPs:         <SKIP-ids (CLASS-A), or none>
Blockers:      <BLOCKED ids (CLASS-B STOP) + what human input unblocks, or none>
Reports:       impl ✅ / rollback ✅ / governance ✅  (in FOUNDATION_STEPUP_LEDGER.md)
Next wave:     <n+1 name>  (precondition met: yes/no)
```

### PHASE A — Repository Truth Audit
```
Status: complete
Outputs: FOUNDATION_REPO_STATE.md / ACTIVE_DEPLOYMENT_TOPOLOGY.md / BUILD_GRAPH.md / IMPORT_GRAPH.md
Gate: complete when this dashboard/status update and the four PHASE A artifacts are committed; drift vs PART A authority flagged.
```

### PHASE A.5 — Risk Matrix
```
Status: complete
Output: FOUNDATION_RISK_MATRIX.md (verified against PHASE A current state)
Gate: every S0 has a named mitigation; committed before Wave 0.
```

### Wave 0 — Truth Harness
```
Status:        complete-with-SKIPs
Started:       2026-06-09T19:33:00Z
Completed:     2026-06-09T19:38:30Z
Branch:        stepup/wave-0-truth-harness (merged to stepup/main: yes, 92d1a9fa)
Build:         green (pnpm run build)
Tests:         green (pnpm run test:foundation:wave0; planted fake UTR fails gate; real Postgres ledger test executes post_ledger_transaction)
Dependency-graph: green (pnpm run validate:dependencies)
Files changed: 15 Wave 0-owned files, plus dashboard/status/ledger/SKIP artifacts
Migrations added: none
SKIPs:         SKIP-W0-PITR-TIER
Blockers:      none
Reports:       impl ✅ / rollback ✅ / governance ✅ (FOUNDATION_STEPUP_LEDGER.md)
Next wave:     Wave 1 — Money Fixes (precondition met after merge: yes)
```

### Wave 1 — Money Fixes
```
Status:        complete-with-SKIPs
Started:       2026-06-09T19:40:53Z
Completed:     2026-06-09T20:00:36Z
Branch:        stepup/wave-1-money (merged to stepup/main: yes, 8f7a7cfa)
Build:         green (pnpm run build)
Tests:         green (pnpm run test:foundation:wave1; validates capture/refund ledger posting contracts, wallet backfill/reconciliation, payout claim safety, and rollback on fixture)
Dependency-graph: green (pnpm run validate:dependencies)
Files changed: 22 Wave 1-owned files, plus dashboard/status/ledger/SKIP artifacts
Migrations added: 160_foundation_money_ledger_authority.sql (additive expand/contract; fixture apply/down green)
SKIPs:         SKIP-W1-PA-PAYOUT-PROVIDER
Blockers:      none
Reports:       impl ✅ / rollback ✅ / governance ✅ (FOUNDATION_STEPUP_LEDGER.md)
Next wave:     Wave 2 — Tenant Isolation (precondition met: yes)
```

### Wave 2 — Tenant Isolation
```
Status:        complete
Started:       2026-06-09T20:03:00Z
Completed:     2026-06-09T20:17:38Z
Branch:        stepup/wave-2-tenant-isolation (merged to stepup/main: yes, 49741343)
Build:         green (pnpm run build)
Tests:         green (pnpm run test:foundation:wave2; exhaustive registry fail-closed test over 261 tenant tables, scoped mutation proof, and tenant-isolation validator)
Dependency-graph: green (pnpm run validate:dependencies)
Files changed: 21 Wave 2-owned source/test/governance files, plus dashboard/status/ledger artifacts
Migrations added: none
SKIPs:         none
Blockers:      none
Reports:       impl ✅ / rollback ✅ / governance ✅ (FOUNDATION_STEPUP_LEDGER.md)
Next wave:     Wave 3 — Production Safety (precondition met: yes)
```

### Wave 3 — Production Safety
```
Status:        complete-with-SKIPs
Started:       2026-06-09T20:20:45Z
Completed:     2026-06-09T20:28:15Z
Branch:        stepup/wave-3-production-safety (merged to stepup/main: no, checkpoint green)
Build:         green (pnpm run build)
Tests:         green (pnpm run test:foundation:wave3; validates rate-limit fail-closed behavior, mock registrar gating, shared-env preflight, and .store public URL defaults)
Dependency-graph: green (pnpm run validate:dependencies)
Files changed: 18 Wave 3-owned source/config/test/governance files, plus dashboard/status/ledger artifacts
Migrations added: none
SKIPs:         SKIP-W3-SENTRY-DSN, SKIP-W3-DNS-CUTOVER
Blockers:      none
Reports:       impl ✅ / rollback ✅ / governance ✅ (FOUNDATION_STEPUP_LEDGER.md)
Next wave:     Wave 4 — Session Security (precondition met after merge: yes)
```

---

## Blocker log (append-only)
```
## BLOCK-<id> · Wave <n> · <date>
WHAT: <the CLASS-B issue that forced a STOP>
WHY IT'S CLASS-B: <correctness/safety on a P0 path>
NEEDS: <exact human decision/input to resume>
STATE: open | resolved (<date>, by <who>)
```

## SKIP log pointer
Full SKIP entries live in `FOUNDATION_STEPUP_SKIPPED.md`; this dashboard only counts them per wave.
