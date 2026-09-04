# `promote` mode — `staging` ← `develop`, `main` ← `staging` (fast-forward only, owner's word)

Promotion is a **git fast-forward plus a push**, and the push is the outward-facing act. The loop
never promotes. A promotion request without the owner's word in the **same message** produces the
plan and the question, nothing else. The harness denies agent pushes: after the word, the skill
fast-forwards locally, prints the exact push command, and the **owner pushes**.

## 1. Why fast-forward only

The SHA that passed local end-to-end on `develop` is the SHA that reaches `staging`; the SHA that
passed cloud checks on `staging` is the SHA that reaches `main`. No merge commit, no direct commit,
no cherry-pick on `staging`/`main` — a hotfix goes through a phase branch → `develop` → promotion like
everything else, just faster. If `git merge-base --is-ancestor <target> <source>` is false, the
promotion is refused and the divergence is a finding (`MERGE_RUNBOOK.md` §Divergence still applies).

## 2. Preconditions

| Target | Must be true (by command) |
|---|---|
| `staging` ← `develop` | every phase merged since the last promotion is `E2E_DEVELOP` in `state.json` · `scripts/gate.sh --full` on the `develop` tip: no red that is not an attributed ambient red (`hazards.md`, `ci.md`) · `ci.yml` run on that `develop` SHA read and attributed (if `develop` was pushed and CI is readable) · ledger rows `MERGED_DEVELOP` with SHAs filled · no open P0 in `security.md` §9 introduced since the last promotion · `main ⊆ staging ⊆ develop` · owner's word |
| `main` ← `staging` | `staging` == the SHA that was soaked in the cloud (`Promotions` table) · cloud checklist (§4) complete **or** the owner explicitly accepts the "no cloud staging yet" exception for this SHA, quoted · `LIVE_FIREBASE_SECURITY` and `TENANCY_AND_RLS` ≠ `NO_GO` for anything the SHA exposes · release evidence recorded · owner's word |

## 3. Procedure (`scripts/promote.sh <staging|main> [--push]`)

```
1  source=develop|staging  target=staging|main
2  git worktree list | grep -w "\[$target\]"           # if a worktree holds the target: run step 4 INSIDE it with merge --ff-only
3  git merge-base --is-ancestor "$target" "$source" || refuse ("target has commits not in source")
4  git fetch . "$source:$target"                        # ff-only by construction; refuses if the target is checked out anywhere
5  git log --oneline "$target@{1}".."$target"           # what moved — quote it in the report
6  --push (only after the owner's word, LETBUYY_PROMOTE_CONFIRM=<target> set by the session):
   the script attempts `git push origin <target>`; the harness will deny it — print the command for the owner:
       git push origin refs/heads/<target>:refs/heads/<target>
   (no hooks are installed, so --no-verify is unnecessary; keep it if the owner's clone has hooks)
7  ledger: append a row to ## Promotions (date · source SHA · target · pushed · owner's word quoted · CI run id when available)
   on develop as a bookkeeping commit; state.json: promotions[] entry
```

Push order for a first-time sync of all three: `develop`, then `staging`, then `main` — the
production-deploy branch-lag guard resolves `origin/staging`, so `staging` must exist remotely before
a `main` deploy is dispatched. `origin/develop` (June 2026) and `origin/main`/`origin/stepup/main`
(2026-08-15) are all ancestors of `823aa5ee`, so every first push is a fast-forward.

## 4. Cloud checklist — per lineage (manual until DEPLOY-1 rewrites the workflows)

`CURRENT` (2026-09-04): nothing is deployed; `config/vercel/projects.json` holds placeholder project
IDs; whether the Cloudflare/Vercel/Supabase secrets exist in GitHub is `UNKNOWN_LIVE_STATE`;
`production-deploy.yml` and `deploy-staging.yml` are `workflow_dispatch` only. A `staging` push is a
git event only until then.

**Lineage C (canonical commerce OS)** — when infrastructure exists:
1. Supabase staging project: `supabase db push` of `database/supabase/migrations` (145 tracked; any
   untracked migration is rejected by `production-deploy.yml`'s guard); confirm `app_tenant` role
   exists and is `NOBYPASSRLS`; run the RLS zero-row probe (`security.md` §7 C) with two seeded sites.
2. Cloudflare Workers via `infrastructure/scripts/deploy/deploy-worker-runtime.mjs --env staging`
   (governed wrapper; never bare `wrangler deploy`): api-gateway, webhook-service, queue-workers,
   mobile-bff. Secrets by name from `config/env/staging.env.template`; `LETBUYY_IDENTITY_PRIVATE_JWK`
   only in identity-platform; `CUSTOMER_SESSION_SECRET` never in a browser-facing project.
3. Vercel: the projects in `config/vercel/projects.json` (identity → `accounts-staging`, merchant →
   `admin-staging`, customer → `store-staging`, marketing), branch `staging`; `letbuyy.com` DNS.
4. Smoke: `/health` and `/v1/health` on the gateway, the storefront host resolution, the identity
   login page; `tests/e2e/*.spec.ts` against staging; the security probes of `security.md` §7.
5. Record run/evidence paths in the `Promotions` row.

**Lineage A (live Firebase marketplace, Play Store `com.letbuyy.letbuyy`)** — nothing in this
repository deploys it; every item is an owner act:
1. Firebase project `letbuy-y`: verify the **live** `firestore.rules`/`storage.rules` in the console
   against `security.md` §9 before and after any rules deploy; a lockdown ships only with its callable
   replacement or the shipped app breaks.
2. Play Store: `code merged ≠ backend deployed ≠ app submitted ≠ app approved ≠ app released ≠ release
   adopted`; verify the signing certificate fingerprint in the Play Console against the rescued
   keystores (`~/LetBuyy-signing-recovery-2026-08-29/`, 3 distinct hashes) — an agent never runs
   `keytool` with a password; the customer app is built from `apps/customer_app` with
   `--dart-define-from-file`, never with a committed key.
3. Raise the minimum app version only after adoption clears the gate — never to force a migration.

**Lineage B** — never deployed; a donor.

## 5. Production (`main`)

Everything in §4 against production, plus: `production-deploy.yml` dispatched by the owner (its
`branch-lag-guard` job asserts `main` is not behind `origin/staging`; its governance gate must be
green — six ambient reds today mean it **stops safely**); the encrypted pre-migration backup step
observed; `infrastructure/scripts/deploy/production-rollback.mjs` and the previous `main` SHA named
in the rollback plan; alert delivery to a human tested, not assumed.

## 6. Report

```
PROMOTE — <target> ← <source>
moved: <from>..<to> (<n> commits, listed)   ff check: ok   worktree holding target: none|<path>
preconditions: table (each with the command and result)
push: NOT DONE (awaiting the owner's word) | owner command printed: git push origin refs/heads/<target>:refs/heads/<target>
cloud checklist: N/A (no infrastructure) | items done / pending, per lineage
ledger Promotions row: line <n>, commit <sha>
```
