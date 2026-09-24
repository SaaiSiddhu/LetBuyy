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
| B — Cloud validation dependability | **IN_PROGRESS** | `letbuyy/sustained-b-cloud-validation` (claimed at `68269cb`) | Non-Docker Postgres feasibility; cross-suite DB contamination; the 5 untested `apps/commerce/web/src` files; the localization runner defect. |
| C — Tenant-guard predicate tightening | NOT_STARTED | — | Depends on B's harness being trustworthy for the negative-control suite. |
| D — Unified buyer account surfaces | NOT_STARTED | — | Large; will be sliced. |
| E — Operator identity integration | NOT_STARTED | — | Large; may hit `BLOCKED_DECISION` on MFA/bootstrap policy. |
| F — Merchant staff membership | NOT_STARTED | — | Depends on canonical-ownership decision between `employees` and `site_memberships`/`site_roles`. |
| G — Storefront search/CSS/localization | NOT_STARTED | — | Playwright + Chromium available; real browser evidence feasible. |
| H — Integrated acceptance | NOT_STARTED | — | Final pass only. |

## Infrastructure ground truth (measured this session, re-check before relying on it)

- Docker: binary present, daemon **not running** (`docker info` fails). Every real-Postgres suite
  (`test:governance`, `test:behavioral`, `test:foundation:wave*`, `gate.sh --real-db`) is
  `BLOCKED_INFRA` until this changes. Phase B investigates a non-Docker disposable Postgres path.
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
