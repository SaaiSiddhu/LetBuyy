# Current source handoff — 21 October 2026

This handoff supersedes the earlier SYNC_2026_10_21.md status of the storefront-access branch. The owner expressly authorized committing current work, merging develop and pushing GitHub. Only source synchronization is authorized; no deployment, migration against restored/hosted data or provider effects. Final application and integration identities and actual verification receipts are recorded in sync-latest.json when completed.

## Fresh machine

```sh
git clone --branch develop https://github.com/SaaiSiddhu/LetBuyy.git
cd LetBuyy
corepack enable
corepack prepare pnpm@10.6.2 --activate
pnpm install --frozen-lockfile
git fetch origin
git rev-parse HEAD origin/develop
```

Use Node satisfying the committed engine (>=20.9.0) and pnpm10.6.2. For an existing checkout, preserve local edits first, fetch origin, switch to develop and pull with --ff-only. Never reset a restored checkout to force a match.

Read AGENTS.md, CLAUDE.md, config/env/README.md, scripts/dev/README.md and docs/evidence/local-integration-2026-10-18/CONSOLIDATION.md before configuring services. Current programme: ../four-week-programme.json. Source evidence: ../storefront-access/acceptance.json and ../password-admission/. Historical N1–N9 snapshots remain on origin/letbuyy/recovery-2026-10-18; do not overlay them onto current develop. The merchant-performance branch contains a separate unfinished audit claim, not an accepted feature patch.

## What moves separately

Git includes application/packages/mobile source, lockfiles, database migrations and paired rollback sources, scripts and committed audit evidence. It excludes local environment secrets, signing assets, restored database volumes/backups, uploaded images/objects, browser sessions, node_modules and build caches. Transfer needed secrets/database/media privately using verified backups; do not add them to Git. The external Verification directory contains full HTML reports, raw logs and screenshots and is not included wholesale in this repository. Committed structured receipts retain the source acceptance and failure history.

This source includes migrations365–371. Pulling it does not apply migrations. Inspect the target schema/history and paired rollback process before running migrations against transferred data. Migration371 is the bounded storefront access metadata projection and was exercised against owned disposable databases. Older untyped gate/preview cookies need re-unlock/reissue during a coordinated rollout. No identity token issuer changes.

Week1 and the four-week launch programme remain open. Catalogue/visitor and password resource checks do not establish fresh cart/order eligibility, complete marketplace/buyer-history isolation, managed Hyperdrive cache freshness, provider acceptance or hosted release readiness. Razorpay login remains owner-deferred. Public signup, online payments+COD and the accepted .com/.store domain direction remain launch requirements. No deployment or staging/main promotion is included.
