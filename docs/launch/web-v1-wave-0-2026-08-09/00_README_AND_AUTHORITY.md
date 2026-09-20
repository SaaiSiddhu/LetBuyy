# 00 — README and Authority

## This is an evidence artifact, not governance authority

Nothing in this package amends, overrides, reinterprets or supplements the governance chain. It records
what was **measured** at a named commit on a named date, and what follows from those measurements.

**Authority chain, in order:**

1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` — supreme law
2. root `AGENTS.md` (the promoted `LETBUYY_AGENTS_V2` operating rulebook)
3. the relevant local / nested `AGENTS.md`
4. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` and the other canonical governance
   rewrite documents

**Where this package and the authority chain disagree, the authority chain wins and this package is
wrong.** No document here grants permission for anything those documents forbid. Every decision that
belongs to the ARB is labelled `HUMAN_DECISION_REQUIRED` and left undecided — including mobile scope,
`services/lcis-api` classification, the Stripe wiring, the Wasm app-functions runtime, App Bridge
removal, the design-token override, and the branch-lag future.

`config/governance/web-v1-scope-registry.json` (on the integration branch) is likewise **config, not
authority**: it carries `artifactClass: GOVERNANCE_CONFIG_NOT_AUTHORITY`, and its validator hard-asserts
that value so the file cannot be quietly re-badged.

---

## Identity of this package

| Field | Value |
|---|---|
| **Package** | Web V1 — Wave 0 |
| **Date** | 2026-08-09 |
| **Location** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/` |
| **Baseline SHA** | **`bf35062eda22f4d881efd61fb1d36c8fc83baed1`** (`bf35062e`) — human-approved |
| **Original repository** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`, branch `stepup/main` — **production-linked** (`supabase/.temp` → Supabase Cloud), **read-only** throughout Wave 0 |
| **Integration head** | `codex/web-v1-integration` @ `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab`, worktree `…/letbuyy-w0-worktrees/web-v1-integration` |
| **Emergency branch** | `codex/emergency-appbridge-killswitch` @ `6c3e17df`, **not an ancestor of the integration branch** |
| **Push / deploy state** | **NOTHING IS PUSHED.** `git branch -r \| grep -c "codex/"` → **0**. No PR. No deploy. No production change. |
| **Original tree preserved** | branch `stepup/main`, `HEAD` `bf35062e`, **6,826** dirty paths, **2** stashes — identical before and after every Wave 0 agent |

---

## Headline verdict

> **The foundation is intact and now, for the first time, actually measured. Web V1 is NOT ready to
> take production traffic, and Wave 0 is not yet closeable — because none of its repairs has left this
> laptop.**

Six statements carry that verdict:

1. **The governance gate was never running.** At the committed baseline it exited at validator **#2**
   of 108; **106 validators were in an unknown state — not skipped, not attempted, not evaluated**,
   including the money, identity and RLS invariants. On the integration branch **all 110 execute**:
   `PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1`, exit 1. The 20 failures are now a
   *measurement* instead of an unknown. Two validators that structurally **could not fail** were
   repaired; one (`branch-lag-guard`) now genuinely fails, the other (`pricing-catalog`) genuinely
   passes.
2. **The commerce backend could not be built from the baseline.** `services/api-gateway` failed to
   bundle with **17 esbuild errors** while `workerd` still bound its port and every request hung — *a
   port-open health check would have called that "up"*. The cause was **one missing barrel line** in
   `packages/shared-types/src/index.ts`. It is fixed on the integration branch (bundle: **0 errors, 0
   warnings**).
3. **Four of five Next apps build; `platform-console` does not.** Its `next build` fails with `TS2344`
   in `src/app/(dashboard)/developers/page.tsx`, and that failure is **invisible to all 110 validators
   and to `turbo typecheck` (exit 0)**. Root `CLAUDE.md` warned the gate does not cover `next build`;
   that warning is now evidence.
4. **The app platform is reachable in production shape.** **19 of 83** app-store / App Bridge routes
   execute their handler for a caller with **no credential of any kind**, including a live third-party
   OAuth2 token endpoint and a data proxy; third-party scripts run in an **escapable iframe sandbox**
   (`allow-scripts` + `allow-same-origin`) on the buyer-facing storefront. A fail-closed gate exists on
   `codex/emergency-appbridge-killswitch` with **59 proving tests and a falsification pass** — but it is
   **1,356 insertions and 0 deletions**: a reversible gate, not a removal, and it is **not deployed**.
5. **The deploy keystone is open.** `origin/main` == `origin/develop` == `c2547049`, **274 commits
   behind** `origin/stepup/main`. `AGENTS.md:330` DEPLOY-R1 says in its own words: *"Nothing else ships
   until the pipeline can deploy the integration branch."* `production-deploy.yml` triggers on `main`.
   **Every Wave 0 repair is therefore undeployable**, and the repaired branch-lag guard now fails every
   branch until a **human** fast-forwards `main` per `MERGE_RUNBOOK.md`.
6. **Nothing has been pushed.** Five local branches plus the integration branch exist only on this
   machine, and the 99 real uncommitted changes in the original tree exist on **no branch at all** —
   preserved with a round-trip proof (99/99 byte-identical), but still machine-local.

**Blocker register:** 52 entries — Axis A (security/correctness) **S0=2 · S1=11 · S2=18 · S3=20**;
Axis B (wave/launch blocking) **BLOCKS-WAVE-0=18 · BLOCKS-WAVE-1=14 · BLOCKS-LAUNCH=12 ·
NON-BLOCKING=8**. **Only two entries are S0, and both are the same unauthenticated app-platform
surface.** Eleven deployment, CI, branch-topology and process defects with severe consequences are
deliberately **not** labelled security vulnerabilities — consequence severity is Axis B, not Axis A.

---

## The one thing to read if you read nothing else

> **The committed baseline `bf35062e` is in a *worse* state than the dirty working tree that sits on top
> of it, in at least two independent ways.**

| Property | Committed baseline (clean checkout) | Dirty original working tree |
|---|---|---|
| Does `services/api-gateway` bundle? | **No** — 17 esbuild errors | **Yes** — the one-line barrel export exists only uncommitted |
| Governance gate stops at | validator **#2** (`tenant-isolation-validator`) | validator **#6** (`validate-design-system`) — the regenerated tenant registry exists only uncommitted |

Both readings are honest measurements of different trees. The consequence is load-bearing: **any plan
that treats `bf35062e` as a clean, buildable starting point is proceeding on a false premise**, and the
6,826 dirty paths are not noise — they contain content the baseline depends on. That is why they were
preserved rather than discarded, and why `bf35062e` is nonetheless the correct baseline (every
alternative branch is a strict ancestor; choosing one would discard 17–291 commits for zero gain).

---

## How to read this package

### Reading order by role

| You are… | Read, in this order |
|---|---|
| **Deciding whether to ship** | `00` (this file) → `24` (blocker register) → `23` §8 (builds) → `26` §2 (Wave 1 entry blockers) |
| **The ARB** | `24` §4.1–4.2 (App Bridge + scope conflicts) → `28` → `29` → `21` §4/§10 (the human decisions) → `26` §6 (workstream 4) |
| **Planning Wave 1** | `26` end to end → `24` §6 and §6.1 |
| **About to touch the original repo** | `30` §2 and §3 (**the two armed hazards**) → `16` (preservation) → this file's Safety section |
| **Auditing the evidence** | `27` (changelog + evidence index) → the `raw-evidence/` subtree it points at |
| **New to the package** | `00` → `15` (why this baseline) → `24` → `26` |

### Structure

| Range | What it is |
|---|---|
| `00` | This file — entry point, authority, verdict |
| `01`–`14` | **Phase 1 — discovery and falsification.** Baseline, git topology, dirty-tree classification, scope register, CI audit, validator matrix, false-green findings, isolation plan, toolchain, independent review |
| `15`–`23` | **Phase 2 — repair and evidence.** Baseline decision, preservation, worktree topology, fix porting, CI repair, validator-runner repair, scope freeze, local stack, build/test baseline |
| `24` | **The consolidated 52-entry failure and blocker register** |
| `26`, `27` | Wave 1 handoff; changelog and evidence index |
| `28`, `29` | The App Bridge urgent task — reachability verdict, kill-switch implementation |
| `30` | Corrections applied to earlier documents, and the two uncontained-work hazards |

There is **no `25_*` document** in this package. Stated as an observation.

### Reading conventions every document in this package follows

- Each document opens with **"Evidence artifact, not governance authority"**, the repo SHA, the
  branch/worktree, the date, the commands used, and an explicit **EXECUTED vs INFERRED vs UNVERIFIED**
  split.
- **A command is never described as passing unless the author ran it and saw the exit code.**
- **No readiness percentage is copied.** Where a later agent re-measured a figure and got a different
  answer, both figures are published with the tree each was measured on.

---

## Corrections you must apply before citing any earlier figure

Wave 0 refuted itself four times. Full detail in `30` and `27` §8; the short list:

1. **"777 real content changes" is REFUTED — the true figure is 99.** All 678 "binary content changes"
   are mode-only flips (index blob == worktree blob, **678/678**, proven). **Never re-cite 777.**
2. **Doc 04's "36 binary changes in the frozen `apps/theme-marketplace`" is RETRACTED** — the real
   content-change count there is **0**. (Three of the 17 unpushed commits *do* touch that frozen app;
   that is a separate, still-open finding.)
3. **Doc 04 under-registered `apps/merchant-control-plane/src/app/globals.css`** (+271/−73) — its groups
   sum to 98, not 99.
4. **Doc 13 §1's arithmetic does not sum to its own stated total** (6,785 + 777 + 10 + 31 = 7,603 ≠
   6,826) — it conflates the porcelain `M` count with the zero-diff subset.
5. **Doc 01's header mislabels a porcelain v2 count as v1** (cosmetic).
6. **Doc 07 §5's "alternative PSPs cleanly deferred" is RETRACTED** — Stripe is wired into the live
   payment and checkout routers, deferred only by an unset secret.
7. **Doc 10's *"deferred to V1.1"* mobile phrasing is superseded by doc 20.** Wave 0 asserts **no**
   mobile deferral; the governance chain says CANONICAL and no ARB amendment was found.

---

## Safety — read before touching the original repository

The original repository is **production-linked** and holds **two armed hazards**. Both are documented,
neither is defused, and neither may be defused by an agent.

**Hazard A — two stashes.** `stash@{0}` (`f8a6c8c7…`, *"On stepup/main: inf-ext"*) holds **28 files,
+1,128/−1,203**: a **third divergent body of uncommitted work**, unreachable from the baseline. Nine
files carry a *different* diff there than in the working tree; nineteen exist **only** in the stash —
including four **already-committed** migrations (money, payments, credentials), gateway idempotency and
auth code, and three **deletion-only** `wrangler.toml` changes. **No stash command beyond `list`/`show`
may be run.** The safe first step is a human-approved `git tag` on `f8a6c8c7` so it survives reflog
expiry — recommended, not performed.

**Hazard B — the intent-to-add empty-blob trap is still armed.** Ten SQL files sit in the index as empty
blob `e69de29b` while holding **789 lines / 43,929 bytes** on disk: migrations `196`, `197` and
rollbacks `180`, `181`, `188`, `189`, `190`, `191`, `196`, `197`. `git diff --cached --numstat | wc -l`
→ **0**, so the trap is invisible to the commonest pre-commit check. Measured behaviour: **a `git
commit` with other paths staged silently omits all ten and leaves the `A` entries intact**;
`git checkout-index -a` writes **0-byte files**; `git stash push` currently fails. Migration `196` is
*theme RLS tenant hardening* — losing it while shipping code that assumes it silently regresses tenant
isolation. **The fix is one human command: explicit `git add` on all ten before any commit**, or
`git commit -a` / `git commit -- <paths>`.

**Standing prohibitions that applied to every Wave 0 agent and still apply:**

- No `supabase db push / pull / reset / seed / link / unlink / migration up`, no provider command, no
  deploy command, from anywhere. (Material mitigant, verified: the Supabase CLI is **not logged in
  anywhere on this machine**.)
- No `git clean`, `stash`, `reset`, `checkout --`, `restore`, `chmod`, stage or commit in the original
  working tree.
- No push, no PR, no deploy, no `git worktree remove/prune`, no force-push, no history rewrite.
- **Never print or record a secret value.** Environment variable **names** only. No `.env*` file content
  in any document or archive.

**Attested state of the original tree, before and after every Wave 0 agent:**

| Property | Value |
|---|---|
| Branch | `stepup/main` |
| `HEAD` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| `git status --porcelain=v1 \| wc -l` | **6826** |
| `git stash list \| wc -l` | **2** |

---

## What Wave 0 produced, and what it did not

**Produced** — 6 local branches (5 Wave 0 + 1 emergency), **23 commits** on the integration branch
(**155 files, +51,757/−1,003**, zero merge conflicts), 30 documents, and **421 evidence files (17 MB)**
under `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/`. Full index in `27`.

**Did not produce** — a push, a PR, a deploy, a production change, a resolved ARB decision, a green
gate, or a removal of anything. **Not one repair produced by Wave 0 exists anywhere but this laptop.**
Six blocker entries are `REPAIRED-LOCAL-UNPUSHED` and seven more are `MITIGATED`; **all thirteen remain
open in production terms**, and the production runtime is still at the baseline state.

---

## What must happen next

**Before Wave 0 can be declared closed** (in dependency order):

1. **Push the four repaired branches and the integration branch.** Nothing is real until it leaves this
   laptop — this is also the durability fix for work that currently exists on no branch.
2. **Run the full gate on `8ec05e21` in a disposable checkout** and publish the typed status matrix.
   *(The gate deletes generated output, including every workspace `node_modules` — order any pipeline
   gate → reinstall → build → test.)*
3. **Decide `branch-lag-guard`** — it currently fails every branch. The option DEPLOY-R1 mandates is
   fast-forwarding `main`.
4. **Read GitHub branch protection** and reconcile it with the repaired `ci.yml`.
5. **Triage the 20 gate FAILs** and the red lint/test lanes into real defects vs stale expectations.
6. **Classify `services/lcis-api`** — roughly a fifth of the gate failures cannot move until it is.

**Before Web V1 can take production traffic:** ARB decides the App Bridge rollout and a human confirms
the live flag values (names only); DEPLOY-R1 closes; the V1 scope boundary is defined and the Stripe
wiring decided; every app builds; the Liquid `renderLimit` relaxation gets security sign-off and the
storefront fail-closed fixes get tests; the two new hard environment prerequisites are confirmed in every
environment.

**Then Wave 1 begins**, in the 16-workstream dependency order set out in
`26_WAVE_1_HANDOFF_AND_DEPENDENCY_ORDER.md`: identity sole-issuer → tenant isolation/RLS → canonical
money single-writer → App Bridge shutdown → storefront host routing → store creation/publication →
catalog/inventory → shipping/GST/coupons → cart/checkout → Razorpay+COD → orders/fulfilment → refunds →
transactional email → legal/account controls → monitoring/deployment → full Web V1 E2E certification.
