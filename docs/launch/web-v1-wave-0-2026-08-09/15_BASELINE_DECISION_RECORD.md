# 15 — Baseline Decision Record (Web V1 Wave 0)

**Evidence artifact, not governance authority.**

| Field | Value |
|---|---|
| Repository SHA under evaluation | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (short `bf35062e`) |
| Branch at that SHA | `stepup/main` (also `codex/web-v1-integration`, `codex/w0-*`, `codex/emergency-appbridge-killswitch` — all six local Wave 0 branches point at it) |
| Worktree this document describes | `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` (branch `codex/web-v1-integration`) |
| Read-only observation surface | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` (production-linked; not modified) |
| Date | 2026-08-09 |
| Author role | BASELINE DECISION agent (read-only) |
| Human decision status | The human has **already approved** `bf35062e` as the Wave 0 baseline. This document **evidences** that decision; it does not re-open it. |

---

## 0. Method — what was EXECUTED vs INFERRED vs UNVERIFIED

### Commands EXECUTED (exit codes / outputs observed directly)

```
git cat-file -t bf35062eda22f4d881efd61fb1d36c8fc83baed1
git log -1 --format=... bf35062eda22f4d881efd61fb1d36c8fc83baed1
git rev-parse HEAD ; git symbolic-ref --short HEAD
git for-each-ref --format='%(refname) %(objectname:short) %(committerdate:iso8601)' --sort=-committerdate
git merge-base bf35062e <ref>                       # for 6 refs
git rev-list --left-right --count bf35062e...<ref>  # for 8 refs
git rev-list --all --not bf35062eda22f4d881efd61fb1d36c8fc83baed1
git for-each-ref --contains aa5c390a
git worktree list
git -C <web-v1-integration> rev-parse HEAD
git -C <web-v1-integration> status --porcelain        # 0 lines
git -C <web-v1-integration> symbolic-ref --short HEAD
git status --porcelain                                # original tree, count only
git diff-index --cached --name-status HEAD
git diff --name-only origin/stepup/main..bf35062e
git show --stat <3 frozen-surface commits>
git ls-files 'scripts/validators/*.mjs' | wc -l
git stash list ; git stash show --name-only
ls / cat / grep on governance docs, package.json, pnpm-workspace.yaml, pnpm-lock.yaml
node <scratchpad>/lockcheck.mjs                      # custom read-only lockfile↔package.json diff
pnpm --version   -> 10.6.2      node --version -> v26.5.1
```

### Deliberately NOT executed (forbidden or out of scope)

- `pnpm install` in **any** form (including `--frozen-lockfile`, `--lockfile-only`, `--dry-run`). Lockfile resolvability is therefore assessed **structurally**, not by installation.
- Any Supabase command, any remote/deploy command, any push, any history rewrite, any `git clean/reset/stash/restore/checkout --`.
- `node scripts/validate-governance.mjs` — re-measured in deliverables 10/11, not re-run here.
- No file in the original repository was created, edited, or deleted except this deliverable.

### INFERRED (reasoned from executed output, not directly executed)

- "pnpm install would not need to modify the lockfile" — inferred from a structural specifier diff plus the `pnpm.overrides` explanation (§5). **Not proven by an install.**
- "No superior newer candidate exists" — inferred from `git rev-list --all --not <baseline>` returning only 3 commits, all older and all classified in §3.

### UNVERIFIED at the time of writing

- Whether `origin` has commits **not fetched** into this clone. Last fetch timestamp on `.git/FETCH_HEAD` is **Aug 9** (today), but no `git fetch` was executed by this agent, and remote-tracking refs may lag the true remote.
- Whether `pnpm install --frozen-lockfile` actually succeeds at this SHA (would require running it).
- Whether the two `refs/stash` entries contain work that is still wanted (contents listed by name only; not adjudicated).
- Governance classification of `services/lcis-api` (see §6.3) — human decision required, unchanged from Phase 1.

---

## 1. Baseline SHA verification

`bf35062eda22f4d881efd61fb1d36c8fc83baed1` **exists locally** and is a valid commit object.

```
type:      commit
author:    SaaiSiddhu <saaisiddu@gmail.com>
authored:  2026-08-04 22:03:49 +0530
committed: 2026-08-04 22:03:49 +0530
subject:   feat(demo): mount Turnstile so the form works in production
```

Current `HEAD` of the original repository = `bf35062eda22f4d881efd61fb1d36c8fc83baed1`, on branch `stepup/main`. **HEAD and the approved baseline are the same commit.**

---

## 2. Candidate comparison matrix

All ahead/behind figures below are `git rev-list --left-right --count bf35062e...<ref>`, read as **`<baseline ahead> / <candidate ahead>`**.

| # | Candidate | SHA | Commit date | Merge-base with baseline | Baseline ahead | Candidate ahead | Relationship |
|---|---|---|---|---|---|---|---|
| A | **`bf35062e` (approved baseline)** | `bf35062eda…` | 2026-08-04 | — | — | — | The reference point |
| B | `HEAD` (`stepup/main`, local) | `bf35062eda…` | 2026-08-04 | itself | 0 | 0 | **Identical to baseline** |
| C | `origin/stepup/main` | `75305725` | 2026-08-01 | `75305725…` (= itself) | **17** | 0 | Strict ancestor |
| D | `main` (local) | `140a73db` | 2026-06-12 | `140a73db…` (= itself) | **106** | 0 | Strict ancestor |
| E | `origin/main` | `c2547049` | 2026-06-09 | `c2547049…` (= itself) | **291** | 0 | Strict ancestor |
| F | `origin/develop` | `c2547049` | 2026-06-09 | `c2547049…` | **291** | 0 | Identical to `origin/main`; strict ancestor |
| G | `claude/elegant-jang-91fd3e` | `140a73db` | 2026-06-12 | `140a73db…` | **106** | 0 | Identical to local `main`; strict ancestor |
| H | `refs/stash` (`stash@{0}`) | `f8a6c8c7` | 2026-06-14 | `e0860c1d…` | 53 | **2** | **Diverged** — 2 commits not in baseline |
| I | `aa5c390a` (rescue-tag snapshot) | `aa5c390a` | 2026-05-24 | `7e472233…` | 1176 | **1** | Diverged historical backup snapshot |

**Key structural fact:** every named branch candidate (C–G) is a **strict ancestor** of the baseline — `<candidate ahead> = 0` in all cases. The baseline is a superset of `origin/main`, `origin/develop`, `main`, and `origin/stepup/main`. Choosing any of them would discard work with zero compensating gain.

### 2.1 Per-candidate assessment

#### A / B — `bf35062e` (baseline; = current HEAD)

- **Advantages.** Superset of every branch candidate: contains all 291 commits over `origin/main`, all 106 over local `main`, all 17 over `origin/stepup/main`. Checks out clean in an isolated worktree (§4). Lockfile is structurally consistent (§5). Contains all 8 ARCH-R1 canonical runtimes as real packages (§6.1). Contains **zero** deprecated app aliases (§6.2). It is already the HEAD of the working branch, so no rebase or transplant is required to adopt it.
- **Missing work.** The 2 `refs/stash` commits (§3.2) and the 1 rescue-tag snapshot commit (§3.3) are not in it. Neither is a launch candidate; both are captured as risks, not as competing baselines.
- **Governance compatibility.** Conforms structurally to ARCH-R1 and ARCH-R10 (§6). Two open, **inherited** governance items — `services/lcis-api` unclassified, and 3 of the 17 unpushed commits touching the FROZEN `apps/theme-marketplace` (§6.4). Both pre-date this decision and are escalations, not disqualifiers.
- **V1 relevance.** Highest of all candidates: the 17 commits over `origin/stepup/main` are almost entirely `apps/marketing-site` (86 files) plus `services/api-gateway` (8), i.e. Web V1 surfaces.
- **Risk.** All 17 commits are **local-only** — see §7. The measured RED gate state (lint/typecheck/tests) is inherited by this baseline; it is not caused by it.
- **Branch divergence.** Six local branches point here, so Wave 0 lanes all start from an identical tree.
- **Recommendation.** **ADOPT** (confirms the existing human approval).

#### C — `origin/stepup/main` (`75305725`, 2026-08-01)

- **Advantages.** It is the only candidate that is actually **pushed to the remote**, so it is durable against local-machine loss.
- **Missing work.** 17 commits, spanning 86 `apps/marketing-site` files, 15 `apps/theme-marketplace`, 8 `services/api-gateway`, 7 `database`, 2 `packages/shared-types`, 2 `config`, 1 `tests`, 1 `apps/merchant-control-plane`. This includes the api-gateway credentialed-CORS loopback fix and the entire demo-request capture path.
- **Governance compatibility.** Not separately assessed; as an ancestor it can only be *less* converged than the baseline.
- **V1 relevance.** Lower — it excludes marketing-site locale routing, the legal library, and the demo capture flow.
- **Risk of choosing it.** Deliberate loss of 17 commits of V1 work for a durability benefit that is better obtained by **pushing the baseline** rather than by regressing to it.
- **Recommendation.** **REJECT as baseline. ADOPT as the durability target** — push `bf35062e` so `origin/stepup/main` becomes the baseline.

#### D — `main` (local, `140a73db`, 2026-06-12)

- **Advantages.** None over the baseline; it is 106 commits behind and contributes nothing the baseline lacks.
- **Missing work.** 106 commits including the entire LCIS OMEGA/INFINITY layer, the Aug 2026 marketing-site and demo work, and the api-gateway rate-limit/CORS fixes.
- **Governance compatibility.** Predates two months of convergence work; presumed weaker. Not measured.
- **V1 relevance / risk / recommendation.** Low / high / **REJECT**.

#### E, F — `origin/main` and `origin/develop` (`c2547049`, 2026-06-09)

- **Advantages.** They are the nominal integration branches named in `BRANCH_STRATEGY.md`, and they are pushed.
- **Missing work.** **291 commits** — two full months. Both refs are frozen at the same commit (`fix(identity): show turnstile on auth forms`, 2026-06-09).
- **Governance compatibility.** Materially behind the current governance rewrite state.
- **V1 relevance.** Very low.
- **Risk.** Catastrophic scope loss; also the source of the branch-lag problem the Wave 0 work is meant to close.
- **Recommendation.** **REJECT as baseline.** Record the 291-commit lag as the standing branch-lag risk (already tracked in deliverable 02).

#### G — `claude/elegant-jang-91fd3e`

Identical SHA to local `main` (`140a73db`). Same assessment as D. **REJECT.**

#### H — `refs/stash` / `stash@{0}` — *not a baseline candidate*

`On stepup/main: inf-ext`, 2026-06-14 21:40, based on `e0860c1d` (`lcis(omega): production operating system …`). Merge-base with the baseline is `e0860c1d`, which is 53 commits behind the baseline. `git stash show --name-only` lists **28 files**. Its 2 commits are the only *branch-adjacent* commits anywhere in the object store that are not reachable from the baseline.

**Not a baseline candidate** (it is a stash, not a branch, and its base is 53 commits stale). Recorded in §3.2 as an uncaptured-work risk. **Do not drop it.** Adjudicating its contents is out of scope for this record.

#### I — `aa5c390a` (`chore(backup): preserve full dirty worktree snapshot`, 2026-05-24) — *not a baseline candidate*

Reachable only via `refs/tags/rescue/pre-consolidation-20260605/backup-worktree-snapshot-20260524-222342` and `refs/tags/rescue/pre-delete-20260605/…`. Merge-base with the baseline is `7e472233`; the baseline is **1176 commits ahead**. It is a historical rescue snapshot of a dirty tree, deliberately preserved. **REJECT as baseline; retain the tags.**

---

## 3. Newer-candidate search (explicit)

### 3.1 Result: **NO newer candidate exists.**

`git rev-list --all --not bf35062eda22f4d881efd61fb1d36c8fc83baed1` returned exactly **3** commits across all local branches, remote-tracking branches, tags, and the stash:

| SHA | Date | Where it lives | Newer than baseline? |
|---|---|---|---|
| `f8a6c8c7` | 2026-06-14 | `refs/stash` (`stash@{0}`) | **No** — 51 days older |
| `d959f339` | 2026-06-14 | stash index commit | **No** |
| `aa5c390a` | 2026-05-24 | two `refs/tags/rescue/…` tags | **No** — 72 days older |

A date sweep over **all** refs (`git for-each-ref refs/ | awk '$3 > "2026-08-04"'`) returned **zero** rows. No ref anywhere in this clone carries a commit dated after the baseline.

### 3.2 Uncaptured work — `stash@{0}` (28 files, 2026-06-14)

Base `e0860c1d` is 53 commits behind the baseline, so replaying it would be a rebase, not a fast-forward. **Risk:** a future `git stash drop`/`clear` (explicitly forbidden by this workflow) would destroy it irrecoverably. **Mitigation (not performed here — requires a human decision):** tag the stash commit so it survives reflog expiry.

### 3.3 Historical snapshot — `aa5c390a`

Already protected by two permanent tags. No action.

### 3.4 Caveat

The remote may have commits not present in this clone. `.git/FETCH_HEAD` was last written **Aug 9** (today), but this agent did **not** run `git fetch`, so the claim "no newer commit exists on the remote" is **UNVERIFIED**. What is verified is: *no newer commit exists on any ref in this clone.*

---

## 4. Clean-checkout verification (EXECUTED)

```
$ git worktree list | grep web-v1-integration
/Users/…/letbuyy-w0-worktrees/web-v1-integration   bf35062e [codex/web-v1-integration]

$ git -C /Users/…/letbuyy-w0-worktrees/web-v1-integration rev-parse HEAD
bf35062eda22f4d881efd61fb1d36c8fc83baed1

$ git -C /Users/…/letbuyy-w0-worktrees/web-v1-integration symbolic-ref --short HEAD
codex/web-v1-integration

$ git -C /Users/…/letbuyy-w0-worktrees/web-v1-integration status --porcelain | wc -l
0
```

**CONFIRMED.** The baseline checks out to a **byte-clean** worktree — zero modified, zero untracked, zero staged entries. This is independently significant: it proves the 6,826 dirty paths in the original tree are **working-tree state, not committed state**, and that the baseline commit itself is self-consistent.

Six Wave 0 worktrees exist under `/Users/…/letbuyy-w0-worktrees/`, all at `bf35062e`: `web-v1-integration`, `w0-ci-coverage`, `w0-local-environment`, `w0-v1-perimeter`, `w0-validator-execution`, `emergency-appbridge-killswitch`. Twelve stale `prunable` worktrees from a former checkout path (`/Users/saai_sidd/Git/Letbuyy_Store/…`) are listed by git but were **not pruned** (pruning is forbidden by this workflow).

### 4.1 Re-measured original-tree dirty state (for the record)

```
$ git status --porcelain | cut -c1-2 | sort | uniq -c
6785  " M"   modified, unstaged
  31  "??"   untracked
  10  " A"   staged (intent-to-add)
-----
6826  total
```

The 10 intent-to-add entries are all SQL, and all in `database/supabase/`:
`migrations/196_theme_rls_tenant_hardening.sql`, `migrations/197_letbuyy_core_first_class_theme.sql`, and rollbacks `180_`, `181_`, `188_`, `189_`, `190_`, `191_`, `196_`, `197_`.

This **confirms** the Phase 1 figure (6,826 paths; 10 intent-to-add). It also sharpens the hazard: a naive `git commit -a` would commit **ten database migration/rollback files as zero-byte blobs**. These are migration files, so a zero-byte commit is a silent schema-governance corruption, not merely a cosmetic one.

---

## 5. Lockfile resolvability at the baseline (structural, no install)

`pnpm install` was **not run**. Assessment is a structural diff of `pnpm-lock.yaml` `importers:` against every workspace `package.json`, via a purpose-written read-only script (`<scratchpad>/lockcheck.mjs`).

| Fact | Value |
|---|---|
| `lockfileVersion` | `9.0` |
| `packageManager` (root `package.json:166`) | `pnpm@10.6.2` |
| Installed pnpm | `10.6.2` — **matches** |
| Node | `v26.5.1` |
| Lock settings | `autoInstallPeers: false`, `excludeLinksFromLockfile: false` |
| Workspace dirs matched by `pnpm-workspace.yaml` globs | 65 |
| Dirs with a `package.json` | 55 |
| `importers:` entries in the lockfile | **55 — exact match** |
| Declared deps missing from the lockfile | **0** |
| Lockfile deps not declared in a `package.json` | **0** |
| Raw specifier mismatches | 4 — **all explained**, see below |

### 5.1 The 4 specifier "mismatches" are override rewrites, not drift

| Importer | Package | `package.json` | lockfile |
|---|---|---|---|
| `services/api-gateway` | `hono` | `^4.7.0` | `4.12.4` |
| `services/lcis-api` | `hono` | `^4.7.0` | `4.12.4` |
| `services/mobile-bff` | `hono` | `^4.0.0` | `4.12.4` |
| `services/webhook-service` | `hono` | `^4.0.0` | `4.12.4` |

Root `package.json` declares `pnpm.overrides` including `"hono@<4.12.4": "4.12.4"`. pnpm records the **post-override** specifier in `importers`, so this is the expected serialization, not drift. The lockfile's `overrides:` block reproduces all **11** root override entries verbatim (`defu`, `fast-uri`, `flatted`, `hono`, `minimatch` ×3, `picomatch` ×2, `socket.io-parser`, `undici`). Override set and lockfile agree exactly.

### 5.2 Ten workspace-glob directories have no `package.json`

Matched by `apps/mobile/*` and `services/*` but carrying no `package.json`:
`apps/mobile` (glob artifact), `apps/mobile/merchant-app`, `apps/mobile/operator-app`, `apps/mobile/shopper-app`, `services/analytics-pipeline`, `services/checkout-runtime`, `services/event-bus`, `services/media-service`, `services/notification-service`, `services/search-service`.

pnpm skips glob-matched directories without a `package.json`, so these do **not** break resolution. Eight are the manifest-only reserved roots named in `CLAUDE.md`. `apps/mobile/merchant-app` is a **Flutter/Dart** package (`pubspec.yaml`, 270 tracked files, `android/`, `ios/`, `lib/`, `integration_test/`, `dart-defines/`, `runtime.manifest.json`) — it has no `package.json` **by design**, and consequently its dependency resolution is entirely outside `pnpm-lock.yaml`. Any Web V1 lockfile guarantee therefore says **nothing** about the mobile app's dependency health.

### 5.3 Conclusion (INFERRED, not installed)

The lockfile is **structurally consistent** with the workspace at `bf35062e`: 55/55 importers, 0 missing, 0 extra, 0 unexplained specifier deltas, matching override set, matching pnpm major/minor/patch. There is **no structural reason** `pnpm install --frozen-lockfile` would need to rewrite the lockfile.

**UNVERIFIED:** registry-side facts a structural diff cannot see — tarball availability, integrity-hash validity, peer-dependency resolution, and platform-specific optional deps (`esbuild`, `sharp`, `unrs-resolver`, `workerd` are in `onlyBuiltDependencies`). Proving resolvability requires actually running `pnpm install --frozen-lockfile` in a Wave 0 worktree; that is a separate lane's job.

---

## 6. Governance conformance of the baseline

Authority chain read at this SHA: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → `AGENTS.md` → `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`. Note: `LETBUYY_CANONICAL_SYSTEMS.md` lives **only** at `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`; there is no repo-root copy.

### 6.1 ARCH-R1 — the 8 canonical runtimes (`AGENTS.md:64-79`)

All 8 are present at the baseline with a real `package.json`:

| # | ARCH-R1 runtime | Present at `bf35062e` |
|---|---|---|
| 1 | `services/api-gateway` | YES (package) |
| 2 | `services/queue-workers` | YES (package) |
| 3 | `services/mobile-bff` | YES (package) |
| 4 | `apps/identity-platform` | YES (package) |
| 5 | `services/webhook-service` | YES (package) |
| 6 | `apps/storefront-runtime` | YES (package) |
| 7 | `apps/merchant-control-plane` | YES (package) |
| 8 | `apps/marketing-site` | YES (package) |

Supporting surfaces named in `AGENTS.md:79` — `apps/mobile/merchant-app` (Flutter, present, 270 tracked files) and `apps/platform-console` (present, package) — both present.

**Verdict: CONFORMS.** No canonical runtime is missing from the baseline.

### 6.2 ARCH-R10 — deprecated app aliases (`AGENTS.md:95`)

All nine forbidden aliases were checked; **all nine are absent** at the baseline: `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`.

**Verdict: CONFORMS.** The baseline does not resurrect deprecated topology.

### 6.3 `services/lcis-api` — unresolved, inherited (**HUMAN DECISION REQUIRED**)

`services/lcis-api` exists at the baseline as a real workspace package (`@letbuyy/lcis-api`, 8 tracked files, a lockfile importer, a `hono` dependency). `grep -rn 'lcis-api'` over `AGENTS.md` and `GOVERNANCE_REWRITE_2026_06_10/*.md` returns **zero** hits.

It is therefore a runtime root that is **not** in the ARCH-R1 list of 8. `AGENTS.md:81` (ARCH-R2) states that adding a runtime not in ARCH-R1 requires "a Constitution amendment + ARB approval + DOC 03/04 updates **before** source is created."

This confirms the Phase 1 finding and is **inherited by the baseline, not created by it**. This record does **not** adjudicate it. Two readings are both defensible and this agent does not choose between them:
1. `lcis-api` is an internal developer-tooling surface, not a deployable runtime, so ARCH-R2 does not bind it; or
2. it is an ARCH-R2 violation requiring an amendment or removal from the workspace.

**Escalation: human classification required.** It does not block adopting `bf35062e`, because every alternative candidate that lacks it is a strict ancestor that also lacks 17–291 commits of V1 work.

### 6.4 Frozen / forbidden work carried by the baseline

**Frozen app roots present in the tree** — `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, `apps/platform-operations-portal` — are all present as packages. Governance freezes them as **deploy targets**; it does not require deletion (`LETBUYY_CANONICAL_SYSTEMS.md` row 36 keeps the theme-marketplace machinery CANONICAL with a dormant catalog; row 23 explicitly says FROZEN "**not deleted for completeness**"). **Presence is therefore compliant.**

**However — 3 of the 17 unpushed commits actively modify a frozen surface:**

| Commit | Subject | Scope |
|---|---|---|
| `e3cfa867` | `feat(theme-marketplace): adopt the platform header` | +brand icons/OG assets, `package.json` |
| `000a0fed` | `feat(theme-marketplace): adopt the platform footer` | +1025/−71 lines across `footer.css`, `globals.css`, `header.css`, `footer.tsx` |
| `61dfa6d3` | `fix(theme-marketplace): declare the brand icons explicitly` | `layout.tsx` +10 |

15 files under `apps/theme-marketplace` are touched across the 17-commit range. These are **presentational/branding** changes to a frozen (non-deploy-target) app, already committed before the baseline was approved. Recorded as an **inherited observation** for the Wave 0 perimeter lane (deliverable 08) to decide whether the Web V1 perimeter excludes `apps/theme-marketplace` from further change. **Not adjudicated here.**

**App Bridge.** 5 tracked paths match `app-bridge|appbridge`. Per the standing instruction this is handled by the separate urgent security task on `codex/emergency-appbridge-killswitch` and is **referenced here as an open escalation only — deliberately not adjudicated, not inspected in depth, and not modified.**

**Mobile.** Per the standing human decision, `apps/mobile/merchant-app` is classified **HUMAN_DECISION_REQUIRED**. This record makes **no deferral assertion**. For the record, the governance chain at this SHA is unambiguous that it is canonical: `LETBUYY_CANONICAL_SYSTEMS.md` row 28 lists Mobile → `apps/mobile/merchant-app` (Flutter) as **CANONICAL**, Wave `2→4`, with no V1/V1.1 split; `AGENTS.md:79` names it as a supporting surface riding the canonical topology. No ARB amendment authorizing deferral was found. The mobile work is fully **preserved** in the baseline (270 tracked files) and, because it carries no `package.json`, it is naturally outside the pnpm workspace — so it will **not** be mixed into the Web V1 integration branch's JS/TS build surface. It must not be deleted, and it must not be asserted as deferred.

### 6.5 Baseline governance verdict

**CONFORMS structurally** to ARCH-R1 (all 8 canonical runtimes present) and ARCH-R10 (all 9 deprecated aliases absent), and carries no forbidden deploy target. It carries **two inherited, separately-tracked open items** (`services/lcis-api` classification; App Bridge security escalation) and **one perimeter observation** (frozen theme-marketplace edits). None of these is a reason to prefer any alternative candidate, since every alternative is a strict ancestor.

For completeness: **112** `scripts/validators/*.mjs` files are tracked at the baseline. Phase 1 reports **108** gate-lane validators and a stale in-repo comment saying "107". This record does not re-measure the gate — see deliverables 10 and 11, which are authoritative on validator execution.

---

## 7. RISK — the 17-commit unpushed divergence (baseline durability)

**This is the single most serious risk to the approved baseline, and it is a durability risk, not a correctness risk.**

`bf35062e` is **17 commits ahead of `origin/stepup/main` (`75305725`, 2026-08-01) and 0 behind.** Those 17 commits exist **only on this machine**. If this clone is lost, corrupted, or hard-reset, the approved Wave 0 baseline **ceases to exist anywhere**.

The 17 commits, newest first:

```
bf35062e  feat(demo): mount Turnstile so the form works in production      <- THE BASELINE
3b6e52bf  feat(demo): add-to-calendar invite, ticket email, contact-shell page
cf6a122a  fix(demo): repair the broken email logo and rebuild the templates
593a5391  fix(gateway): allow configured loopback origins through credentialed CORS
6383c8bd  feat(demo): end-to-end demo request capture
56ddfd5f  feat(brand): publish the real social accounts
14ca0f78  fix(footer): replace the Twitter bird with the X mark
1e522e11  feat(marketing-site): locale routing for English, Tamil and Hindi
16a8c7c9  fix(marketing-site): stop the capability map scrolling on desktop selection
000a0fed  feat(theme-marketplace): adopt the platform footer
61dfa6d3  fix(theme-marketplace): declare the brand icons explicitly
e3cfa867  feat(theme-marketplace): adopt the platform header
64d9f9de  feat(marketing-site): hover-driven mega menus with anchored floating panels
23ea6a64  refactor(marketing-site): rebuild the legal library without strokes or badges
d4539cc1  feat(marketing-site): build the legal library at /legal
76569a0e  feat(marketing-site): make account, contact and guide routes discoverable
75868107  feat(marketing-site): rebuild resources experience and fix responsive defects
```

File scope of the range (`git diff --name-only origin/stepup/main..bf35062e`):

| Area | Files |
|---|---|
| `apps/marketing-site` | 86 |
| `apps/theme-marketplace` | 15 |
| `services/api-gateway` | 8 |
| `database` | 7 |
| `packages/shared-types` | 2 |
| `config` | 2 |
| `tests` | 1 |
| `apps/merchant-control-plane` | 1 |

### 7.1 Why this matters beyond backup hygiene

1. **The baseline is not reproducible from the remote.** Any Wave 0 statement of the form "baseline = `bf35062e`" is unverifiable by anyone who only has `origin`. External review, CI on the remote, and any second machine all see `75305725` at best.
2. **CI cannot see it.** Deliverable 09 establishes that `ci.yml` does not trigger for `stepup/main` on push or pull_request. Combined with 17 unpushed commits, **no remote CI has ever evaluated the baseline commit at all.** The baseline's quality signal is 100% local.
3. **It compounds with the branch lag.** `origin/main` and `origin/develop` are frozen at `c2547049` (2026-06-09), **291 commits** behind. The 17-commit gap is the tip; the 291-commit gap is the body.
4. **It includes database changes.** 7 `database/` files are in the unpushed range, and separately 10 `database/supabase/` migration/rollback files sit intent-to-add in the working tree (§4.1). Schema-governance state is thus split across "local commits not on the remote" and "not committed at all."
5. **It includes a security-relevant gateway change.** `593a5391 fix(gateway): allow configured loopback origins through credentialed CORS` touches credentialed-CORS origin handling and exists only locally, unreviewed by remote CI.

### 7.2 Mitigation (recommended; **NOT performed** — pushing is forbidden in this workflow)

- **Push `stepup/main` to `origin`** so `origin/stepup/main` becomes `bf35062e`. This is the single action that converts the baseline from local-only to durable, and it is *non-destructive* (fast-forward: baseline is 0 behind).
- **Tag the baseline** (e.g. `wave-0-baseline-2026-08-09` → `bf35062eda…`) so it survives branch movement and reflog expiry.
- **Tag or otherwise protect `stash@{0}`** (§3.2) before any stash operation is ever run.
- **Resolve the 10 intent-to-add SQL files deliberately** — never via `git commit -a`, which would commit them as zero-byte blobs.

All four require human authorization; none was performed.

---

## 8. Decision

**CONFIRM `bf35062eda22f4d881efd61fb1d36c8fc83baed1` as the Wave 0 Web V1 baseline.**

Evidenced grounds:

1. It exists locally and is a valid commit (§1).
2. Every named branch candidate — `origin/main`, `origin/develop`, `main`, `origin/stepup/main`, `claude/elegant-jang-91fd3e` — is a **strict ancestor** (`candidate ahead = 0` in all five cases). No candidate contains work the baseline lacks (§2).
3. **No newer candidate exists** on any ref in this clone; the only 3 unreachable commits are 51–72 days **older** (§3). *Caveat: an unfetched remote commit is UNVERIFIED.*
4. It checks out **byte-clean** (0 porcelain entries) in an isolated worktree (§4).
5. Its lockfile is **structurally consistent** — 55/55 importers, 0 missing, 0 extra, 4 override-explained specifier deltas, matching pnpm 10.6.2 (§5). *Install was not run.*
6. It **conforms** to ARCH-R1 (8/8 canonical runtimes present) and ARCH-R10 (0/9 deprecated aliases present), and carries no forbidden deploy target (§6).

Adopted **with** these recorded, non-blocking conditions:

- **R1 (durability, HIGH).** 17 unpushed commits; the baseline exists only on this machine and has never been evaluated by remote CI. Mitigation in §7.2 requires human authorization.
- **R2 (governance, OPEN).** `services/lcis-api` is a workspace runtime root absent from all governance topology docs → ARCH-R2 question. **Human classification required.** Inherited, not created by this decision.
- **R3 (security, OPEN, separately tracked).** App Bridge — owned by `codex/emergency-appbridge-killswitch`. Referenced only; **not adjudicated here**.
- **R4 (scope, OPEN).** `apps/mobile/merchant-app` is **HUMAN_DECISION_REQUIRED**. Governance at this SHA calls it CANONICAL with no V1/V1.1 split and no ARB deferral amendment. Work is preserved (270 files) and, having no `package.json`, is naturally outside the pnpm workspace — it must **not** be mixed into the Web V1 integration branch, and **no deferral is asserted**.
- **R5 (perimeter, OPEN).** 3 of the 17 commits modify the FROZEN `apps/theme-marketplace` (15 files). For the perimeter lane (deliverable 08) to rule on.
- **R6 (data-integrity, HIGH).** 10 `database/supabase/` migration/rollback files are intent-to-add with **empty blobs**. A naive `git commit -a` would commit ten SQL migrations as zero bytes.
- **R7 (quality, inherited).** The RED gate state measured in Phase 1 (lint exit 1, typecheck exit 1, 33/1576 behavioral + 13/200 contract failures, validator gate dying at #6 so 102 validators never run) is **inherited** by this baseline. Not re-measured in this document — see deliverables 10, 11, and 14, which are authoritative.

---

## 9. Files written by this agent

- `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/15_BASELINE_DECISION_RECORD.md` (this file)

No other file in the original repository was created, edited, or deleted. No code changes were made in any worktree. No commit, push, fetch, deploy, or Supabase command was executed.
