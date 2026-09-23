# `run` mode — the self-paced loop (`/loop /letbuyy run`)

One tick = **one bounded step** of the current phase, evidence written to disk, state advanced,
next wake scheduled. Never one whole phase per tick. Never an unbounded step.

## 1. Where the truth lives (never in the conversation)

```
~/.letbuyy/run/<programme>/state.json    the programme: contracts, phase states, evidence paths, config, budgets, tick log
~/.letbuyy/run/<programme>/STATUS.md     human heartbeat, rewritten every tick (the owner reads this)
~/.letbuyy/run/<programme>/logs/         gate tables, probe outputs, per-tick notes
the repository                           branches, ledger rows, commits — the only durable record of work
```

Every tick **starts** with `scripts/state.sh show <programme>`, `git -C <worktree> status --porcelain | wc -l`,
`git -C <worktree> log -1`, and `git rev-parse develop` (the ref is shared by every worktree;
`LetBuyy-develop` no longer exists — F-SKILLFACTS-3, 2026-09-23). If the conversation and
the disk disagree, the disk wins. Context compaction is expected; it must never change what happens next.

## 2. `state.json` shape

```json
{
  "programme": "<name>", "created": "<iso>", "base_develop": "<sha>",
  "config": { "push_develop": false, "max_ticks": 400, "max_hours": 72, "max_ticks_per_phase": 60,
              "wake_seconds": 300, "allow_e2e_boot": true, "allow_real_db": false, "allow_flutter_build": true },
  "phases": [ { "id": "X-1", "title": "…", "lineage": "C",
                "state": "PLANNED|CLAIMED|BUILT|SELF_GATED|LANES_PASSED|VERIFIED|MERGED_DEVELOP|E2E_DEVELOP|BLOCKED|STOPPED",
                "branch": "letbuyy/x1-…", "worktree": "…/LetBuyy-x1", "depends_on": [], "contract": { …SKILL §2.2… },
                "step": "<next step id>", "ticks": 0, "evidence": { "gate": "logs/…", "lanes": {…}, "merge": "…" },
                "blocked_reason": null } ],
  "promotions": [], "ticks": 0, "started": "<iso>", "stop": null, "tick_log": [ {"t":"<iso>","phase":"X-1","step":"…","result":"…"} ]
}
```

## 3. The tick

1. Load state. If `stop` is set → call the loop's stop (`ScheduleWakeup stop`) and end.
2. Budget check: `ticks ≥ max_ticks` or elapsed ≥ `max_hours` or the phase's `ticks ≥ max_ticks_per_phase`
   → `STOPPED(budget)`.
3. Pick the current phase: the first phase not in a terminal state whose `depends_on` are all
   `MERGED_DEVELOP`/`E2E_DEVELOP`. `BLOCKED` phases are skipped while an independent one remains; if
   none remains → `STOPPED(all remaining phases blocked)`.
4. Execute **one** step for its state (table below), using the mode's reference.
5. Write evidence paths, advance `state`/`step`, append the tick log, rewrite `STATUS.md`
   (`scripts/state.sh status`).
6. `ScheduleWakeup` with `delaySeconds` = `config.wake_seconds` (long-running commands run to
   completion inside the tick; the wake is for the next step, not for polling), `noop:false` when
   anything changed, `reason` naming phase and step.

| State | Step(s) — one per tick unless trivially small |
|---|---|
| PLANNED | collision check → worktree add → install → identity check → claim row commit → `CLAIMED` |
| CLAIMED | `gate.sh --baseline` → read contract files → `BUILT` begins: one workstream per tick (commit each, pathspec) |
| BUILT | `gate.sh` after the last commit → `SELF_GATED` (or fix one red per tick; two consecutive reds on the same check → `STOPPED`) |
| SELF_GATED | one lane per tick (`security` → `uiux` → `feedback` → `mobile`/`db`), each writing its report to `logs/` → `LANES_PASSED` (any `BLOCKING` → fix in ≤ 2 ticks or `BLOCKED`) |
| LANES_PASSED | VERIFY per `cto.md` §2 with fresh evidence (revert-and-watch, may_write diff, probes, full validator sweep) → `VERIFIED` or back to `BUILT` with findings |
| VERIFIED | `merge-develop.sh` → commit → checks → ledger bookkeeping → worktree removal → `MERGED_DEVELOP` (push `develop` only if `config.push_develop`) |
| MERGED_DEVELOP | boot the local stack from the `develop` checkout (`LetBuyy-develop` until 2026-09-20; where it lives now is part of the open D-MERGE-LOCATION) (`pnpm run dev:store` or the runtime's `dev` script), exercise the phase's journeys in the browser preview (+ `tests/e2e` where applicable), stop the stack → `E2E_DEVELOP` |

## 4. Hard stop conditions (write the reason to `STATUS.md`, set `stop`, end the loop)

- an owner or founder decision (D-0…D-7, D-ID) is required and no independent phase remains
- the same gate or test is red on two consecutive ticks for the same step
- an unattributed change appears in a worktree the loop uses, or `develop` moved by a commit the
  loop did not make and the contract's `may_write` overlaps it
- a permission is denied, a command hangs past its time box (default 45 min), or disk headroom drops
  below 15 GB (`df -h /`)
- another `ACTIVE` claim or a topically overlapping branch appears for the current scope
- a merge conflict lands in a file the phase does not own
- any secret-shaped value is encountered in a diff, a log, or an env dump (`rzp_live_`, `AIza…` 39
  chars outside Firebase client config, `BEGIN PRIVATE KEY`, `postgres://…:…@`)
- a validator or test reports an untracked migration, a tracked keystore, or a tenant-registry drift
  the loop did not cause
- the programme is complete (every phase `E2E_DEVELOP`) → `stop` with a completion summary

`BLOCKED` (not stop): a phase needs an owner decision, cloud infrastructure, a Play Store or Firebase
console act, or a fix outside its `may_write`. Record the reason, move on if something independent remains.

## 5. What the loop may and may never do

**May:** create/remove phase worktrees (porcelain commands only) · commit on phase branches · merge into
`develop` inside a `develop` worktree. None can exist while the primary checkout holds `develop`, so the
loop merges nothing until the owner answers D-MERGE-LOCATION (`decisions.md` §6) · push `develop` when
`config.push_develop` is true (the harness may
still deny it; record the denial) · run `gate.sh` in its non-destructive modes, suites, validators
individually, `flutter analyze/test/build apk --debug` · boot and stop the local stack · open the
browser preview · read CI runs with `gh run …` when an account with access is logged in · write under
`~/.letbuyy/run/` and the phase worktree.

**Never:** push `staging` or `main` · deploy anywhere (Firebase, Supabase, Cloudflare, Vercel, Play
Store) · touch the primary checkout or any `.claude/worktrees/*` entry · run the real governance lane
(`validate-governance.mjs` without `--plan`) · start the ephemeral Postgres helper unless
`config.allow_real_db` and an isolated container name are set · drop or recreate a database, run
migrations against anything but a throwaway local DB · `rm -rf` a worktree, `git clean`, `reset --hard`,
`branch -f`, `update-ref`, delete a branch · run repo-wide generators unless the contract names the
exact command as a step · install toolchain · widen CI permissions · run `keytool` or read
`key.properties` · change `config` values it did not start with · continue after a stop condition.

## 6. Permissions for unattended operation

The loop only runs unattended when the harness will not prompt. Run the session in auto mode and keep
the project allowlist (`.claude/settings.local.json`, gitignored, owner-maintained) covering the loop's
safe command set: `git -C * worktree add|remove|prune *`, `git -C * merge *`, `git -C * commit *`,
`git -C * fetch . *`, `pnpm *`, `turbo run *`, `node scripts/*`, `node --test *`, `tsx --test *`,
`bash .claude/skills/letbuyy/scripts/*`, `flutter analyze|test|build apk --debug *`, `gh run *`,
`df -h *`. Never allowlist `git push origin staging|main`, `wrangler deploy`, `vercel deploy`,
`supabase db push`, `firebase deploy`, `rm -rf`, or any `reset`/`clean`. The current
`settings.local.json` still references retired `Letbuyy_lane-*` paths — the owner should refresh it
before the first unattended run.

## 7. Starting, watching, stopping

```
/letbuyy plan: <the whole ask>      → writes state.json with the phase contracts; changes nothing in the repo
/loop /letbuyy run                  → self-paced ticks until DONE or STOP
cat ~/.letbuyy/run/<programme>/STATUS.md
/letbuyy run stop                   → sets stop; the next tick ends the loop (or ScheduleWakeup stop immediately)
```

`STATUS.md` carries: programme · tick count and elapsed · current phase/state/step · last evidence
paths · blocked phases with reasons · promotions · the last 10 tick-log lines · the stop reason.
