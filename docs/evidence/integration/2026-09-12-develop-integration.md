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

## `E2E_DEVELOP` — blocked on this machine's Docker daemon (third diagnosis)

> **This section has now been wrong twice.** The first version blamed the Supabase project namespace.
> The second blamed the `supavisor` image pull — right about *where* it stalls, wrong in implying the
> image or the network was the cause. Both were published as settled. They were not. The narrowing is
> left visible rather than tidied away, because a reader deciding what to try next needs to know which
> explanations have already been eliminated.

`references/run.md` §5 explicitly permits the loop to boot and stop the local stack, so this was in
scope to attempt.

**The registry works. The daemon's pull path does not.**

| probe | result |
|---|---|
| `public.ecr.aws/token/?scope=repository:supabase/supavisor:pull` | **HTTP 200 in 0.86s**, 1,593-byte token |
| `public.ecr.aws/v2/supabase/supavisor/manifests/2.9.7` (with that token) | **HTTP 200 in 0.89s** |
| `docker pull public.ecr.aws/supabase/supavisor:2.9.7` | zero bytes of output, image never arrives |
| `docker pull busybox:latest` — tiny, never pulled here | **identical**: zero output, image never arrives |
| `docker system df` across a sampling window, both pulls | `Images 18.46GB` → `Images 18.46GB` |
| `docker ps` · `docker images` · `docker version` · `docker info` | instant; version `29.6.2`; `ServerErrors` `[]` |

DNS, TLS, auth and the image path all work from this machine. The daemon answers every other call
immediately and reports no server errors. `busybox` is the discriminating test: the fault is in the
pull path generally, **not** in the `supavisor` image and **not** in the network.

`supabase start` needs `supavisor` because `database/supabase/config.toml` sets
`[db.pooler] enabled = true`, so it blocks there — but it would block on any uncached image.

**Remedy: restart Docker Desktop. That is an owner action, not this session's.** It would stop the
four `edynox-*` containers belonging to a different project and the `letbuyy-executable-pg` container.

**The impact is bounded, and saying so matters more than the alarm.** Only work that needs a *new*
image is blocked. `pnpm test:executable` runs from the already-cached `postgres:16-alpine` and was
observed passing 46 suites / 182 assertions earlier in this same session. The phase pipeline —
claim, build, gate, merge — is unaffected.

All stray pull processes were killed and their absence verified with `pgrep`. No container was
created. The five running containers were not touched, and neither were the dormant
`supabase_*_Letbuyy_Store` or unrelated `supabase_*_Agrimore` sets.

**So `E2E_DEVELOP` remains unreached for all nine phases.** CAP-C69 carries this diagnosis.

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
