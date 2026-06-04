# 🖥️ TERMINAL 1 — WS7 Production Hardening

**Worktree:** `../lb-ws7`  ·  **Branch:** `stream/WS7-hardening`  ·  **Wave:** 0 (launch now)
**Owns ONLY:** `services/**` · `database/**` · `packages/infrastructure/**` · `scripts/staging/**`
**Never touches:** any `apps/**`, `packages/typescript/**`

### Setup
```bash
git worktree add ../lb-ws7 -b stream/WS7-hardening   # (skip if already created)
cd ../lb-ws7 && pnpm install
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
```
Read docs/Codex_waves/CODEX_PRODUCTION_HARDENING_MISSION.md and CODEX_PRODUCTION_READINESS_MISSION.md in full,
then execute continuously and autonomously, 24h+, never stopping while unblocked work remains.

OWN ONLY: services/**, database/**, packages/infrastructure/**, scripts/staging/**.
NEVER edit apps/** or packages/typescript/** (other agents own those) — if you need a UI change, log [SKIP — NEEDS UI].

Goal: seed and prove the staging stack from the baseline, run J1–J5 E2E against staging Postgres,
make COD + GST real and one online provider (Cashfree or UPI) real in test mode (live keys → [SKIP — NEEDS HUMAN]),
keep the build network-free, advance scaffold services where unblocked.

Hard rules: keep all 128 validators green after every commit; full `pnpm run validate:governance` at each gate;
never commit red; max 3 attempts per task then revert + log BLOCKED + move on; small reversible commits;
never mutate prod; migrations forward-only & fresh-replay-safe; no fabrication (every DONE = command + result).
Maintain CODEX_WS7_LEDGER.md. When real J1–J5 are green, publish "staging proof ready" in the ledger.
Begin with P1 now.
```
