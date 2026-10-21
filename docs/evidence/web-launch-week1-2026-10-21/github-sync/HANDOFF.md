# LetBuyy source handoff — 21 October 2026

**Latest sync:** read [SYNC_2026_10_21.md](SYNC_2026_10_21.md). Verified compact/SQL/protocol work is merged into develop; the later access-control branch is saved separately and remains unfinished. The earlier source-sync sections below are dated history.

The owner explicitly requested committing the current launch work, merging it into develop and pushing GitHub so another machine can pull it. This supersedes the earlier no-merge/no-push boundary for this source sync only. No staging/main promotion, deployment, shared database migration, real payment or external message is authorized by this sync.

## Follow-up source sync — 21 October 2026

The verified Core read-performance candidate a92763b70f110db1c4d9ed5eb094e48ed40e568a is now merged into develop by11271049e1b3dafeb11f50729964ffcc540a924c. Its acceptance record is ../core-read-performance/acceptance.json: normal owned production-browser journey passed, Commerce1263 passed, types passed and canonical114 passed. This removes repeated render reads; it does not establish hosted latency or launch readiness.

The unfinished compact-bootstrap source is committed on `letbuyy/week1-compact-bootstrap` and pushed separately for continuation. It is excluded from develop; read that branch’s `docs/evidence/web-launch-week1-2026-10-21/compact-bootstrap/MACHINE_HANDOFF.md` before resuming. Use `git switch --track origin/letbuyy/week1-compact-bootstrap` in a separate clean checkout if needed. Do not merge it until its missing owned/native/cache/publication acceptance is complete.

Correction to the historical preview item below: the audit-only selected-store review proxy was repaired after the first push. Two policy test families and eight HTTP cases passed; seven product reads succeeded, but this is not universal Worker reliability proof. Archived diagnostic source and receipt are in `readonly-preview/`. Old non-public-media URLs still return404; no shared media was rewritten. This preview is separate from the performance serving fixture.

The prior remote develop118209b4 receipt remains historical. The follow-up receipt identifies the merge and WIP branch. Final disposable-clone gate:114 passed, zero failed/blocked/skipped, one not-applicable; focused routing/preview7 passed. All six source-manifest hashes match the previously accepted browser-tested candidate. Raw audit HTML/logs/screenshots outside Git, restored database, uploaded objects, local secrets and sessions still require private transfer. CI was previously unable to start because of GitHub account billing/spending limits; no successful hosted CI or deployment is implied.

## What travels in develop

The cumulative launch branch contains the earlier local develop integration and all completed web repair slices: theme ownership and atomic uploads, Worker SQL request lifetime, bounded request admission, Core theme/category JSONB compatibility, public/private image delivery, shipping/tax integration, billing activation, public merchant signup, Core adoption/publication and variant checkout, honest starter copy, catalog refresh/search scheduling, buyer address identity guards, collection discovery and the current collection pagination/private preview/mobile control changes. Read the adjacent phase acceptance records for exact scopes and limitations. A source sync does not close the four-week launch programme or Week 1.

The current usability implementation is commit `676d432b`, followed by the scoped CSS-variable viewport correction `1a063542`. Its source manifest and final verification are recorded in this directory. Earlier accepted phase evidence is under `docs/evidence/web-launch-week1-2026-10-21/` and `docs/evidence/web-launch-week2-2026-10-21/`.

## Pull on the new machine

Fresh checkout:

```sh
git clone --branch develop https://github.com/SaaiSiddhu/LetBuyy.git
cd LetBuyy
corepack enable
corepack prepare pnpm@10.6.2 --activate
pnpm install --frozen-lockfile
git rev-parse HEAD origin/develop
```

For an existing checkout, first inspect `git status` and preserve its own local changes and unpublished commits. With a clean develop checkout, use `git fetch origin` followed by `git pull --ff-only origin develop`. Do not reset another machine's work to force an update.

Node must satisfy the committed `>=20.9.0` engine requirement. Use the locked pnpm version. Read root AGENTS.md, CLAUDE.md, `config/env/README.md` and `scripts/dev/README.md` before configuring the local runtimes. Configure each runtime from the committed placeholder templates using privately transferred credentials; a source clone alone does not restore a running database.

## Private/local material

Git does not carry the restored database, Docker volumes, uploaded media objects, environment keys, signing assets, local browser sessions or the raw audit workspace. Transfer those privately with a verified backup or reconfigure them deliberately. Do not paste keys into Git or copy old build/dependency caches. Existing local data and worktrees are preserved.

The nine historical coordinated N1–N9 source candidates are already preserved on `origin/letbuyy/recovery-2026-10-18`; its `RECOVERY_INDEX.json` labels them unverified recovery snapshots. They are not new patches to overlay on current develop. The previous transfer record is `docs/evidence/local-integration-2026-10-18/CONSOLIDATION.md`. Historical scratch changes and generated caches remain in their original local worktrees.

## Current open work

- The audit-only existing-store preview on port49897 runs an earlier frozen candidate against the older local Gateway. Its narrow proxy omitted public review reads, and the older Gateway intermittently cancels product requests as hung. The owner reported both; this source sync does not certify that preview repaired. Do not convert failures into empty product/review success.
- Complete remaining Core visual/editor/section acceptance and measure useful-page performance on a defined serving build. Search scheduling still uses its existing production interval; no hosted freshness/performance acceptance is implied.
- Continue inventory/discount/order/refund/customer/operator and billing/invoice reconciliation through normal journeys and failures.
- Real Razorpay sandbox credentials/owner login, real delivery providers and hosted domain/deploy acceptance remain separate. Owner deferred Razorpay login; fixture success is not real-provider verification.
- No claim of whole-platform production readiness, complete Week1 or deployment follows from these tests or this push.

Continue using owned disposable databases for tests. Do not run migrations or fixture mutations against the restored stack merely to reproduce a test environment.

Merge receipt: `merge.json` in this directory identifies the exact merge and included phase tips. Final scoped acceptance is `../core-usability/acceptance.json`; final gate receipt is `gate-final.json`.

Migrations365–369 and paired rollbacks are committed. Owned test databases replayed them; this source sync does not apply them to the restored stack or any hosted target. Check the target schema and supported migration process before running the new source against privately transferred data.
