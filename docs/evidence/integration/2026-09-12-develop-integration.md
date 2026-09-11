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

## Measurement 3 — the five Next app builds, which the gate does not cover

**Measured at `56b521f6`**, not at `7b96adb1`. `git diff --name-status 7b96adb1..56b521f6` is three
Markdown files — `EXECUTION_LEDGER.md`, `docs/active/BRANCH_DISPOSITIONS.md` and this document — and
**zero code files**, so the build result carries over; saying so is cheaper than pretending the two
commits were the same one.

`CLAUDE.md`'s Operational rules state it outright: *run real `pnpm --filter <app> build` (the gate
does NOT cover app `next build`)*. Until this tick, no phase this session had run it.

```
pnpm --filter @letbuyy/customer-web       build   BUILD OK
pnpm --filter @letbuyy/merchant-web       build   BUILD OK
pnpm --filter @letbuyy/admin-web          build   BUILD OK
pnpm --filter @letbuyy/identity-platform  build   BUILD OK
pnpm --filter @letbuyy/marketing-site     build   BUILD OK
```

This matters because `typecheck` and `lint` do not exercise Next's own build: route collection,
server/client boundary enforcement, and static-versus-dynamic rendering decisions are resolved only
here. `customer_web` in particular compiles the full `/store/[subdomain]/…` tree that every storefront
serves. A green gate with a broken `next build` is a state this repository has been in before.

## `E2E_DEVELOP` — attempted, blocked, and diagnosed (corrected)

> **This section replaces an earlier version that named the wrong cause.** The first draft said
> `supabase start` created nothing because the CLI derives its project namespace from the workdir
> directory name and therefore looked for `supabase_db_database`. That namespace observation is true,
> but it was a *consequence* of nothing having started, not the reason nothing started. The corrected
> cause is below. A wrong cause in an evidence document is worse than no document, because it sends
> the next attempt somewhere specific and wrong.

Attempted because leaving it as an unexplained gap was worse than trying. `references/run.md` §5
explicitly permits the loop to boot and stop the local stack.

**What actually blocks it.** `supabase start` blocks on

```
docker pull public.ecr.aws/supabase/supavisor:2.9.7
```

`supavisor` is the connection pooler, required because `database/supabase/config.toml` sets
`[db.pooler] enabled = true`. The image is **absent** from this machine
(`docker images | grep -ci supavisor` → `0`) and the pull **does not progress**: `docker system df`
reported `Images 18.46GB` at both ends of a sampling window with the pull process alive throughout.
The registry itself answers — `https://public.ecr.aws/v2/` returns HTTP 401 in 0.97s, which is the
expected unauthenticated response from a live v2 registry — so this is not DNS or TLS. **Why the
transfer stalls was not determined and is not claimed here.**

The namespace fact remains true and still worth fixing: `database/supabase/config.toml` declares no
`project_id` (`grep -c project_id` → `0`), so the CLI names every container after whatever directory
it was invoked from. That makes the local stack's identity non-deterministic — the twelve
`supabase_*_Letbuyy_Store` containers on this machine, all `Exited` and three weeks old, are from a
checkout directory of that name. It is a defect in its own right; it was not this stall.

**Process note, recorded because it cost a tick.** The first attempt was reported as stopped. It was
not: the process survived that `kill` and was still running a full tick later, so a retry contended
with it and both blocked on the same pull. A command that returns without error is not evidence that
a process is gone. Both were subsequently killed with `-KILL` and their absence *verified* by `pgrep`
returning zero, as was the orphaned pull.

Nothing was created and nothing left behind: zero `*_database` containers, and the pre-existing
`supabase_*_Letbuyy_Store` and unrelated `supabase_*_Agrimore` container sets were not touched.

**So `E2E_DEVELOP` remains unreached for all nine phases.** CAP-C69 carries the corrected diagnosis
and the two independent repairs it suggests.

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
done for any of the nine phases above — see the section above for the attempt and its diagnosed
blocker. Five successful `next build`s prove the apps compile and their routes resolve; they prove
nothing about whether a buyer can complete a checkout. Nothing here substitutes for that.

`develop` is **508** commits ahead of `staging` and `main`, which both sit at `823aa5ee` (`git rev-list --count staging..develop` at `7b96adb1`). Promotion is
fast-forward only and requires the owner's word in the same message.
