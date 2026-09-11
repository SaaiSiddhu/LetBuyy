# `develop` integration measurement — 2026-09-12

**Commit measured: `7b96adb1`.** Both measurements below were executed at that exact commit, in the
`LetBuyy-develop` worktree, in one session. Classification: `VERIFIED_REPOSITORY_FACT` for what was
run and what it printed; nothing here is a production-readiness claim (see *What this is not*).

## Why this document exists

Nine phase branches merged into `develop` on 2026-09-11 and 2026-09-12:

| merge | phase |
|---|---|
| `58a53611` | F-DRIFT-1 — app-store column predicate |
| `184ede37` | F-ROUTELEN-4 — internal-console route size |
| `42dd0034` | F-ORDERDETAIL-1 — customer order-detail fields |
| `58c9a231` | F-PENDINGCOD-1 — orders `pending` filter |
| `4b55b4fb` | F-COMMITTED-1 — release decrements `committed_quantity` |
| `e8f602ea` | F-DIRECTORY-1 — public store directory draft exposure |
| `1fe51b75` | F-QUALIFY-2 — parameter-default measurement |
| `f58d135f` | F-WIRETYPE-1 — checkout wire-contract duplicates |
| `f43fc46c` | F-WIRETYPE-2 — internal payment union enforcement |

Every one was gated on its own branch against its own base, and every one reported a zero delta
against a same-session baseline. **A per-phase gate cannot see an interaction between two phases that
were each green on their own**, because neither baseline contained the other. This document is the
whole-repository measurement at the integration tip, written down — a number nobody records decays
into "a number you remember from a previous tree", which this programme's operating skill lists as
proof of nothing.

## Measurement 1 — every executable suite, on real Postgres

```
pnpm test:executable
EXECUTABLE SUITES  suites=46  failed=0  assertions=182 passed / 0 failed  wall=365s  image=postgres:16-alpine
```

Each suite gets a private database inside a throwaway container that the runner creates and removes,
so a suite cannot inherit another's schema, rows, or cluster-global roles. This is the run that
exercises migrations `000`…`246` end to end against the shape Supabase actually presents — pgcrypto
in `extensions`, `extensions` on the database `search_path`, `service_role` with `BYPASSRLS`, and the
three `ALTER DEFAULT PRIVILEGES` grants — rather than a harness that happens to make the code pass.

## Measurement 2 — the gate at the integration tip

```
scripts/gate.sh   branch=develop  sha=7b96adb1   failed=4

typecheck                   exit=0
lint                        exit=1
governance:plan             exit=0
validators:sweep (111/113)  exit=2   environment · stale-artifact
test:contracts              exit=1
test:unit:gateway           exit=1   944 tests · 933 pass · 2 fail
tests:governance            exit=0
tests:ci                    exit=0
```

**The load-bearing comparison is the SET, not the count.** The ten failing test names and the failing
validator pair (`environment-validator`, `stale-artifact-validator`) at `7b96adb1` are *identical* to
the per-phase baselines each of the nine phases measured against its own base. No merge introduced a
failure that appears only once the changes are combined. A matching `failed=4` alone would not have
shown that — a count can stay level while one failure is traded for another.

All three gateway suites added on 2026-09-11/12 were confirmed running inside `test:unit:gateway` at
this tip by name, not by filename: `storefront-directory-exposure`, `wire-contract-duplication`,
`internal-payment-union-enforcement`. A test file that exists but never runs is proof of nothing.

## The four ambient failures, attributed

These are inherited, not introduced, and are attributed in `references/hazards.md`:

- **lint** — `@letbuyy/customer-web`, Phase M rename fallout.
- **validators:sweep** — `environment-validator`; and `stale-artifact-validator`, which fails *by
  method* when run individually because no orchestrator cleanup has run, not because an artefact is
  stale.
- **test:contracts** — Phase M rename fallout.
- **test:unit:gateway** — 2 of 944.

## What this is not

This is **not** a production-readiness certification. The Constitution's production-readiness law
requires measured evidence across eleven dimensions — payment integrity and reconciliation,
cross-tenant isolation, authentication forgery/replay/escalation resistance, checkout correctness,
queue lag and retry behaviour, alert delivery to a real human, backup/PITR and a successful restore
drill, RTO and RPO, load/spike/soak/failure testing, defined SLOs and error budgets, and safe
rollback. Two green batteries are not those eleven dimensions.

It is also not an end-to-end run: `E2E_DEVELOP` in the phase lifecycle means booting the local stack
from `develop` and exercising each phase's journeys through the running system. That has **not** been
done for any of the nine phases above. Nothing here substitutes for it.

`develop` is **508** commits ahead of `staging` and `main`, which both sit at `823aa5ee` (`git rev-list --count staging..develop` at `7b96adb1`). Promotion is
fast-forward only and requires the owner's word in the same message.
