# CODEX PRODUCTION HARDENING MISSION — LetBuyy WS7

**Driver:** Codex agent. Reasoning: `xhigh` for migration/real‑stack/payment work, `medium` for scaffold wiring.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `services/**` + `database/**` + `packages/infrastructure/**` + `scripts/staging/**` **ONLY**. (The **only** backend stream — the inverse of every UI workstream.)
**Dependencies:** staging secrets/deploy are human-gated (this stream unblocks staging proof for all UI streams once deployed).
**Predecessor / source of truth:** `CODEX_PRODUCTION_READINESS_MISSION.md` (P0→P4). Status: **fresh‑DB provisioning from `000_baseline.sql` is already ✅ proven** (baseline + migrations 073‑075). This mission closes what remains: real E2E, India payments depth, build stability, and the scaffold services.

---

## 0. PRIME DIRECTIVE
Make LetBuyy **operationally production‑ready**: real integration proof against a live database, India‑native payments that actually work where no keys are needed, a network‑free reproducible build, and the scaffold services advanced from stubs to functional — **backend only; never touch any app or the design system.**

**SUCCESS CRITERIA (proven with command evidence):**
1. The staging stack is deployed and seeded from the baseline; `/health` returns 200; a real product query returns seeded data.
2. **Real J1‑J5 E2E** run green against real Postgres (not mocks): identity SSO, app lifecycle, theme lifecycle, commerce+events, customer SSO.
3. **COD** checkout works end‑to‑end; **GST** invoice (CGST/SGST/IGST) correct on a real order; one **online provider (Cashfree or UPI)** real in test mode; live keys → `[SKIP — NEEDS HUMAN]`.
4. `pnpm turbo build` succeeds **network‑free**; reproducible.
5. Scaffold services advanced where unblocked (queue‑workers, notification‑service, search‑service, analytics‑pipeline, media‑service, event‑bus, checkout‑runtime) — real where data/contracts exist, honest stub + `[SKIP]` otherwise.
6. **128/128 governance**, 57/57 typecheck, 287/287 tests, 5/5 E2E green. `CODEX_WS7_LEDGER.md` complete.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next task. 2. **Green Law** (128/128 at gates; never red; 3 strikes → revert/BLOCKED). 3. **Backend‑only Law:** edit only owned paths; **never** touch `apps/**` or `packages/typescript/**`; UI need → `[SKIP — NEEDS UI]` for the relevant WS. 4. **Real‑proof Law:** test against the deployed staging stack, never a mock; if staging is not credentialed, commit the runnable scripts/tests and `[SKIP — NEEDS HUMAN: staging deploy + secrets]` only the live execution. 5. **DB safety:** never mutate prod; migrations forward‑only + fresh‑replay‑safe; archive, never delete. 6. SKIP‑and‑continue for live keys/paid signups/policy. 7. No fabrication; small reversible commits; anti‑thrash.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
All `apps/**` (every web + mobile app) · `packages/typescript/**` (design system, api‑client, api‑types — consume only) · `packages/*-core/**` *domain contracts* (you may wire/execute them but not redesign their public contracts) · `docs/governance/**` + `scripts/validators/**` (read‑only; update governance memory only in lockstep when a migration legitimately requires it).

## 3. THE WORK — P‑phases (from `CODEX_PRODUCTION_READINESS_MISSION.md`, scoped to WS7)
- **P1 — Staging stack & E2E.** Keep the baseline fresh‑replay‑safe; harden `scripts/staging/seed.mjs`; run **J1‑J5 against staging Postgres**; fix real‑data bugs (RLS, seeds, contract drift) as small green commits. **Effort:** L. **Priority:** P0. _Data: own DB/services._
- **P2 — India payments depth.** COD end‑to‑end (no keys); GST verified on real intra/inter‑state orders; Cashfree **or** UPI real in test mode behind the `PaymentProvider` interface (live keys SKIP). **Files:** `services/api-gateway/src/routes/payments.ts`, `packages/infrastructure/*-adapter/**`, `packages/checkout-core` execution. **Effort:** L. **Priority:** P0.
- **P3 — Build stability.** Network‑free build (fonts self‑hosted already); fix any flaky build/test; ensure CI parity. **Effort:** M. **Priority:** P1.
- **P4 — Scaffold services.** Advance queue‑workers/notification/search/analytics/media/event‑bus/checkout‑runtime from stubs toward functional consumers over the existing event spine; honest `[SKIP]` where a contract/provider key is missing. **Files:** `services/<svc>/**`. **Effort:** L. **Priority:** P2.
- **GATE (FINAL):** fresh DB provisions; real J1‑J5 green; COD/GST/one provider real; build network‑free; 128/128 + typecheck/tests/E2E green; `CODEX_PRODUCTION_STATUS.md` written (COMPLETE only if all true, else `BLOCKED — AWAITING HUMAN`).

## 4. PARALLELIZATION GUIDE
WS7 is **disjoint from all UI streams** (backend vs `apps/**`+`@letbuyy/ui`) → runs fully in parallel. It is the **producer** of the staging stack the UI streams screenshot against; publish "staging proof ready" to `CODEX_WS7_LEDGER.md` so UI streams switch from Storybook proof to staging proof.

## 5. LEDGER — `CODEX_WS7_LEDGER.md`
```
# CODEX WS7 (PRODUCTION HARDENING) LEDGER — started <ts>
## BASELINE: fresh-DB replay status; J1-J5 status; build status
## PROGRESS / SKIPPED (NEEDS HUMAN: live keys, prod apply) / REAL-E2E / VALIDATOR ledgers (append-only)
```

## 6. LAUNCH PROMPT
```
You are WS7 (Production Hardening) in docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md.
Work ONLY in git worktree branch stream/WS7-hardening.
Read docs/Codex_waves/CODEX_PRODUCTION_HARDENING_MISSION.md and CODEX_PRODUCTION_READINESS_MISSION.md.
OWN ONLY: services/**, database/**, packages/infrastructure/**, scripts/staging/**.
NEVER edit apps/** or packages/typescript/**. Seed and prove the staging stack from the baseline, run J1-J5 against
staging Postgres, make COD/GST real + one online provider (Cashfree/UPI) in test mode (live keys [SKIP — NEEDS
HUMAN]), keep the build network-free, advance scaffold services where unblocked. Keep all 128 validators green
per commit; never mutate prod; migrations forward-only/fresh-replay-safe. Maintain CODEX_WS7_LEDGER.md.
Publish "staging proof ready" once true. Begin with P1 now.
```

## 7. NORTH STAR
A staging environment provisions from one baseline, the real journeys pass on real data, money actually moves (COD/UPI/GST), and the build is reproducible offline — the backbone every UI stream proves itself against.
