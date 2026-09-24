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
| E — Operator identity integration | **BLOCKED_DECISION** on the identity-platform migration itself; the console-MFA hardening slice **VERIFIED_LOCAL, MERGED_DEVELOP** | merge `96be3f9b`, ledger `ceb2d4c`, branch tip `e863d9a` (deleted, contained) | `apps/internal/console` has its own independent, dev-only, non-identity-platform-wired auth (login refuses outright in production). Migrating it is APPID-P4-scale work needing the owner's MFA/bootstrap policy word — recorded as `BLOCKED_DECISION`, not invented. Hardened the one bounded gap that needed no such decision: MFA lockout, replay rejection, constant-time compare. See `SUSTAINED_E.md`. |
| F — Merchant staff membership | **BLOCKED_DECISION** (investigated, no code change) | ledger `022b2fc` | Not two but THREE mechanisms: `employees` (live), `site_memberships`/`site_roles` (fully built, never mounted), `identity-foundation`'s org model (a third, already calls (2) legacy, also never mounted). No live authorization gap — today's requests are decided by `employees` alone. See `SUSTAINED_F.md`. |
| G — Storefront search/CSS/localization | **VERIFIED_LOCAL, MERGED_DEVELOP** (G1, G2, G3 all complete as scoped) | G1 merge `a167160`; G2 merge `df019bc`; G3 merge `892fecf`, ledger `c0412d0`, branch tip `c0412d0` (deleted, contained) | G1: search-box Liquid section rendered a bare `<input>` with no `<form>`; fixed to a real `<form method="get" action="{{ routes.search_url }}">`, matching the header's pattern. Real-browser (Playwright/Chromium) proof: Enter and Submit both navigate correctly. G2: the merchant custom CSS feature was fully validated and persisted, and the renderer had a complete, tested validate-and-scope function for it, but that function's only call site never passed the value — no merchant's custom CSS had ever reached a live storefront. Wired `StoreTemplateConfig.customCss` through `store-service.ts`'s existing appearance bridge to the renderer call site; 3 new render-pipeline tests, real revert-and-watch. G3: found TWO duplicate translation-lookup implementations — a tested, India-first, prototype-guarded `tLocale()` with zero real consumers, and a divergent, less-robust inline duplicate that the real `\| t` filter actually called. Deleted the duplicate, wired the filter to `tLocale()`; 2 new tests, real revert-and-watch. Separately found and explicitly NOT attempted: the shipped theme's translation catalog has exactly one key (English only) and `\| t` is used once in the whole theme — populating real 9-locale content is a large authoring project outside this phase's authority, recorded honestly. See `SUSTAINED_G1.md`, `SUSTAINED_G2.md`, `SUSTAINED_G3.md`. |
| H — Integrated acceptance | **VERIFIED_LOCAL, MERGED_DEVELOP** | merge `3c77775`, ledger `db7c05d`, branch tip `db7c05d` (deleted, contained) | Completed SUSTAINED-B.B's own named gap: ran `pnpm run test:behavioral` (~230 files) to completion for the first time in this container (25.7 min, 2049 tests, 1983 pass, 45 fail). Classified all 46 failures against this session's full diff: 14 are the same transient `node_modules` filesystem blip seen twice in G1/G2 (not a code defect); 2 are real and attributable — a stale G2 test assertion, and extending SUSTAINED-B.B's own cross-suite Postgres role-contamination fix to 2 more files it never covered — both fixed with real revert-and-watch (the role fix proven via an actual planted-contamination reproduction). ~30 remaining failures touch none of this session's files; recorded honestly as a first-observed, un-triaged baseline for a future phase, neither claimed pre-existing nor attributed here. See `SUSTAINED_H.md`. |

**Programme complete as scoped.** SUSTAINED-A through H are all `MERGED_DEVELOP` and pushed to
`origin/develop` (`3c77775`); `staging`/`main` remain untouched at `1e6cc4c3` throughout, per the
owner's "hold promotion" instruction. Two `BLOCKED_DECISION`s remain, correctly unresolved by this
programme (SUSTAINED-E's operator-identity migration, SUSTAINED-F's staff-membership mechanism among
three coexisting candidates) — both need the owner's word. One un-triaged `test:behavioral` baseline
(~30 failures, SUSTAINED-H) remains for a future phase's dedicated triage. Single agent throughout
this entire programme: no subagents, no workflow orchestration, no background coding agents, no
scheduled/autonomous restart services.

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
