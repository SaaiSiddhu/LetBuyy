# Sustained unified-foundation programme — record (started 2026-09-24, Claude Code Cloud)

A dated evidence record, updated at phase boundaries. Not a readiness claim; a truthful log of what
is `IMPLEMENTED`/`VERIFIED_LOCAL`/`BLOCKED_INFRA`/`BLOCKED_DECISION` versus `NOT_STARTED`. Historical
prose below is evidence about its own moment, not a standing status. Environment: Claude Code Cloud
container `/home/user/letbuyy`, no Mac primary checkout, no Docker daemon, no Flutter SDK, Playwright
+ Chromium pre-installed. Single agent throughout: no subagents, no workflow orchestration, no
background coding agents, no scheduled/cron continuation.

Owner authorization (this message, 2026-09-24): scoped source/test/doc/tooling changes, phase
branches and worktrees, disposable local services and synthetic-data test databases, migrations +
rollbacks when required, commits, merges into local `develop` when governed prerequisites are met,
automatic continuation phase to phase. **Not authorized:** `staging`/`main` advance or push, any
deploy, hosted migrations, live secret/provider/DNS/Firebase/flag changes, mobile publishing,
spend changes, Constitution changes, bypassing gates/hooks/protection, force-push or history rewrite.

## Governing facts kept in working memory (not re-read every phase)

- Authority order: Constitution → root `AGENTS.md` → local `AGENTS.md` → `LETBUYY_CANONICAL_SYSTEMS.md`
  → `CLAUDE.md` → `.claude/skills/letbuyy/SKILL.md` and its `references/*.md`.
  `docs/active/BRANCH_DISPOSITIONS.md` is the only branch-disposition authority.
- Branch model: `letbuyy/<phase>` → `--no-ff` merge into `develop` (in the checkout that holds
  `develop` — in this container, `/home/user/letbuyy`, since there is no separate Mac primary) →
  fast-forward-only `staging`/`main`, owner's word required, never performed by this programme.
- Eight ACTIVE runtimes, canonical topology, grouped `apps/` layout (Constitution Amendment 3,
  D-APP-LAYOUT) — already executed; do not repeat.
- `identity-platform` is the sole intended asymmetric issuer (ART-05/R-14); buyer realm is still
  transitionally HS256 (`CUSTOMER_SESSION_SECRET`) — a state to collapse, never extend.
- Tenant backstop: RLS `ENABLE`+`FORCE`+transaction-local GUC on every tenant table; the app-layer
  guard (`createTenantGuardedSupabaseClient`) is defence-in-depth, never the sole boundary.
- `buyer_accounts` is the one buyer principal across Marketplace/Quick/every storefront;
  `store_customers` rows are merchant-scoped relationships, not logins (D-ONE-BUYER).
- Never: microservices/CQRS/event-sourcing/saga for their own sake, a second canonical system for any
  domain, activating a RESERVED root, a `stores` table, a GMV/transaction fee.

## Phase table (updated at every phase boundary)

| Phase | Status | Branch/commit | Notes |
|---|---|---|---|
| A — Close APPID-FIX2 | **VERIFIED_LOCAL, MERGED_DEVELOP, PUSHED** | merge `d90618c4`, ledger `68269cb`, branch tip `8fefe38` (deleted, contained) | See `FIX2_PRODUCT_TENANT_GUARD.md`. `origin/develop` advanced `41af1cd9` → `68269cb` (fast-forward, pushed). `staging`/`main` unchanged at `1e6cc4c3`. |
| B — Cloud validation dependability | **VERIFIED_LOCAL** (A–D all solved; full `test:behavioral` not run to completion — see `SUSTAINED_B_C.md`) | `letbuyy/sustained-b-cloud-validation` | Non-Docker Postgres shim (A); cross-suite `DROP ROLE` contamination root-caused and fixed (B); 5 untested `apps/commerce/web/src` files wired in, 60 subtests (C); localization test harness fixed (D). See `SUSTAINED_B_C.md`. |
| C — Tenant-guard predicate tightening | **VERIFIED_LOCAL** | same branch | `.filter()`/`.or()` now require `eq`/`in`/sanctioned-`IS NULL`, not any operator. Caller inventory: nothing legitimate changes. 11 new tests, real revert-and-watch. See `SUSTAINED_B_C.md`. |
| D — Unified buyer account surfaces | **IN_PROGRESS** (D3 slice VERIFIED_LOCAL, MERGED_DEVELOP; D1/D2/D4/D5/D6 NOT_STARTED) | D3 merge `ed7dc606`, ledger `0dee2bd`, branch tip `3fbd699` (deleted, contained) | `GET /buyer/orders`, marketplace cross-store, via `buyer_order_links`. D1/D2 need a migration (no `full_name`/`phone` on `buyer_accounts`, no `buyer_addresses` table) — deliberately not attempted without a schema-change phase of their own. See `SUSTAINED_D3.md`. |
| E — Operator identity integration | NOT_STARTED | — | Large; may hit `BLOCKED_DECISION` on MFA/bootstrap policy. |
| F — Merchant staff membership | NOT_STARTED | — | Depends on canonical-ownership decision between `employees` and `site_memberships`/`site_roles`. |
| G — Storefront search/CSS/localization | NOT_STARTED | — | Playwright + Chromium available; real browser evidence feasible. |
| H — Integrated acceptance | NOT_STARTED | — | Final pass only. |

## Infrastructure ground truth (measured this session, re-check before relying on it)

- Docker: binary present, daemon **not running** (`docker info` fails). **RESOLVED by Phase B.A**:
  a native `postgresql-16` cluster is already installed in this container; `service postgresql
  start` brings it up, and `scripts/dev/docker-shim/docker`, prepended to `PATH`, translates the
  fixed subset of `docker inspect/run/start/stop/exec` this repo's harness uses onto it. Real-DB
  suites are runnable this way (`test:governance`'s `test:behavioral` half, `test:foundation:wave*`,
  individual `tests/executable/*-postgres.test.mjs` files all verified working) — but the FULL
  `test:behavioral` list has not been run to completion in this container (stopped partway through
  in favor of a faster, targeted repro of the B.B contamination bug; see `SUSTAINED_B_C.md`). The
  Supabase-CLI-stack-only tests (`merchant-tenant-predicate.test.ts` and four siblings, container
  name `supabase_db_supabase`) remain `BLOCKED_INFRA` — out of this phase's scope, already
  self-skipping.
- Flutter SDK: **not on PATH.** `gate.sh --mobile`/`--flutter-build` are `BLOCKED_INFRA`. No Flutter
  claim will be made without a real `flutter build`/`aapt dump badging`.
- Playwright + Chromium: **pre-installed**, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Real-browser
  evidence is feasible for Phase G and any storefront/console UI check — use
  `executablePath: '/opt/pw-browsers/chromium'` if a pinned `@playwright/test` version differs.
- Shallow clone: `branch-dispositions-validator` reports advisory-only "not a commit" lines for SHAs
  from before this container's fetch depth, plus one genuine pre-existing unrelated hard failure
  (`letbuyy/pay4-late-capture-after-release` not an ancestor of `develop` in this shallow clone) —
  attributed, not this programme's, re-verify it stays the only hard failure after each merge.
- `origin` is reachable (`git ls-remote`/`fetch`/`push` all worked for Phase A). `staging`/`main` on
  origin remain `1e6cc4c3` — confirm this is still true before any phase boundary that touches them
  (it never should, under this authorization).

## Resume instructions (if this session ends and a new one picks up)

1. Read this file, then `git -C /home/user/letbuyy log --oneline -5` and `git status --porcelain` to
   confirm HEAD is still `develop`, clean, at or after `68269cb`.
2. Read the Phase table above for the last `IN_PROGRESS`/next `NOT_STARTED` row.
3. Re-run the infrastructure ground-truth checks (`docker info`, `which flutter`,
   `git ls-remote origin`) — do not assume the previous session's findings still hold.
4. Continue from the named phase; do not restart Phase A.
