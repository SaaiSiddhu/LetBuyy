# Current source handoff — 21 October 2026

This consolidation supersedes the earlier 21 October source handoff at `9c4ae605`. The owner expressly authorized integrating all machine work, merging develop and pushing GitHub for another machine. The final source/merge/push identities and observed verification state are recorded in [consolidation-2026-10-21.json](consolidation-2026-10-21.json). This is source synchronization; the launch programme and merchant audit remain paused/open.

## Get the current source

Use Node 22 (verified 22.23.2) and pnpm 10.6.2.

```sh
git clone --branch develop https://github.com/SaaiSiddhu/LetBuyy.git
cd LetBuyy
corepack enable
corepack prepare pnpm@10.6.2 --activate
pnpm install --frozen-lockfile
git status --short --branch
git rev-parse HEAD
```

For an existing checkout, preserve its local edits, then:

```sh
git fetch origin
git switch develop
git pull --ff-only origin develop
pnpm install --frozen-lockfile
```

Continue from develop. The old phase checkouts retain their original paused edits, while their integrated source is on develop; overlaying old files can undo newer changes.

## Consolidated work

| Conversation | Integrated or preserved result |
| --- | --- |
| Package LetBuyy skill as ZIP | Byte-for-byte 13-file portable ZIP beside this guide; archive integrity and secret scan verified. |
| Assess LetBuyy web launch scope | Existing Week 1/Week 2 signup, billing, shipping/tax, Core, SQL and image work; newer fresh purchase admission, private hosted checkout, receipt/state privacy, terminal cart preservation and repeat shopping. Paused catalogue freshness probes reproduced eight failures and drove the current-authority repair. |
| Speed up merchant admin app | Shared client navigation, bounded/debounced/scoped reads, dashboard/read improvements, editor stylesheet separation, complete asynchronous exports and validated multiline CSV imports with progress/retry. Broader performance audit remains open. |
| Improve LeadBy theme experience | Ten independently discoverable/installable themes, separate customization state, redesigned catalog/library/editor, responsive previews, explicit publication and storefront visibility/password controls. |

Nine historical unfinished phase snapshots remain available on origin/letbuyy/recovery-2026-10-18. Their source bytes were compared with the original checkouts; they are recovery history and must not be merged wholesale over current shared files. Every named non-recovery source branch and the remote CLI checkpoint is contained in the consolidation history. The detailed branch inventory is in the JSON receipt.

## Run locally

Read AGENTS.md, CLAUDE.md, config/env/README.md, scripts/dev/README.md and docs/LOCAL_DEV.md. Configure a matching isolated local database and the required local runtime environment privately, then use:

```sh
pnpm dev
# Or include the async/BFF/webhook Workers:
pnpm dev:all
```

The maintained local apps use storefront 9000, merchant 9001, identity 9002, marketing 9006 and internal console 9007; Gateway 9010. Templates contain placeholder values. Generated local configuration is untracked and is not live provider acceptance. Use the committed workflow/toolchain pins for mobile work on the other machine.

The source contains migrations through 378. Pulling or installing does not apply them. Inspect the target schema and migration history, preserve its data, and follow the migration/paired rollback process before any separately authorized database update. This consolidation did not migrate restored/hosted databases. Migrations377/378 repair the registered theme-install event and explicitly retain private backend metadata-reader privileges; paired rollbacks preserve these safety repairs. The retirement tests keep successor 376 and predecessor 366/354/344 ordering explicit; private theme data is retained during downgrade.

## Transfer private state separately

Git contains application and mobile source, packages, complete source history, lockfiles, database migration/rollback sources, scripts, portable skill ZIP and committed structured acceptance evidence. Local environment credentials, signing assets, database contents, uploaded media, browser sessions and full external Verification reports belong in the private transfer.

A fresh private handoff was prepared in the workspace Verification/LetBuyy-Consolidation-2026-10-21 directory: 30 original worktrees inventoried; dirty tracked/untracked snapshots archived and checksummed; both identified LetBuyy development databases dumped read-only and catalogs validated; local configuration/media/signing inputs archived privately. Individual database dumps are transaction-consistent, but databases and filesystem media are not one atomic combined snapshot. No restore was performed. Preserve older Mac/T7 backups too.

The portable LetBuyy skill ZIP is [letbuyy-skill-2026-10-19.zip](letbuyy-skill-2026-10-19.zip). It contains the installed skill and transfer instructions; its older bootstrap snapshot must be reconciled with this repository's current evidence after installation.

## Remaining acceptance

Week 1/the four-week launch programme and the complete merchant audit remain open. Public signup, online payments+COD and the accepted `letbuyy.com` platform / `letbuyy.store` storefront direction remain launch requirements. Real Razorpay login/acceptance is owner-deferred. Managed Hyperdrive configuration/freshness, hosted domains/TLS, provider journeys, broader load/performance acceptance and release readiness remain separate. Prior GitHub CI jobs could not start because of account billing/spending limits; the final JSON records checks for the pushed head. No staging/main promotion or deployment is included.
