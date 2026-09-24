# Cloud handoff — resume LetBuyy from `develop` (F-HANDOFF-1, 2026-09-24)

A dated evidence record, not a readiness claim. Everything below was measured on 2026-09-24 in the
primary checkout and one temporary phase worktree. A cloud session should be able to resume from the
committed repository with nothing else: no local worktree, no ignored report, no developer database,
no chat transcript.

## 1. Where to start

| Item | Value |
|---|---|
| Repository | `https://github.com/SaaiSiddhu/letbuyy.git` (one canonical checkout; grouped `apps/` layout of Constitution Amendment 3) |
| Branch to resume on | `develop` |
| Candidate before this phase | `41212f67`, equal to `origin/develop` after a fresh `git fetch` on 2026-09-24 |
| This phase | `letbuyy/handoff1-cloud-continuation`: claim row plus this file; no source, test, validator, workflow or migration change |
| `staging`, `main` | both `1e6cc4c3`, locally and on origin; 165 commits behind `develop`, fast-forwardable (`main ⊆ staging ⊆ develop`) |
| Other refs | no other local or remote branch; five `archive/*` tags hold commits absent from `develop` and wait for owner decisions (`BRANCH_DISPOSITIONS.md`); none is approved for merge |

Read in this order: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → the local
`AGENTS.md` of any root you touch → `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` → `CLAUDE.md` →
`.claude/skills/letbuyy/SKILL.md` and its `references/` (`merge.md`, `promote.md`, `ci.md`, `hazards.md`,
`decisions.md`, `security.md`). Ledgers: `docs/active/BRANCH_DISPOSITIONS.md`, `EXECUTION_LEDGER.md`.
Evidence for this programme: this folder, especially `EXTERNAL_ACTIONS.md` (owner actions E-1 to E-19).

## 2. What is on `develop`, and what that does not mean

Every row is **merged into `develop` and pushed to `origin/develop`**. None is promoted to `staging` or
`main`, validated in a cloud or staging environment, deployed, or enabled for real users.

| Phase | Merge | Evidence |
|---|---|---|
| APPID-P0 founder decisions, Amendment 3 | `f71b5fd5` | `.claude/skills/letbuyy/references/decisions.md` §2g |
| APPID-P1 grouped app layout | `816aced4` | `EXECUTION_LEDGER.md` |
| APPID-P2 reference isolation | `7028f1af` | `P2_STRUCTURAL_VERIFICATION.md` |
| APPID-P3 buyer linkage | `0cc9595e` | `EXECUTION_LEDGER.md` |
| APPID-SEC1 definer functions off the Data API | `2b283860` | `EXECUTION_LEDGER.md` |
| APPID-P4a buyer verification | `622396f0` | `P4A_BUYER_VERIFICATION.md` |
| APPID-SEC2 identity email relay | `2c1d682e` | `EXECUTION_LEDGER.md` |
| APPID-P4b buyer code + PKCE | `7784aacf` | `P4B_STOREFRONT_SIGN_IN.md` |
| APPID-P4c storefront sign-in | `3cbdde80` | `P4C_STOREFRONT_ENTRY.md` |
| APPID-P4d marketplace mobile sign-in | `489768e1` | `P4D_MARKETPLACE_APP_SIGN_IN.md` |
| APPID-FIX1 full-gate regressions | `a2b57b0c` | `FIX1_FULL_GATE_REGRESSIONS.md` |
| APPID-P5b staff paths fail closed | `24eba04e` | `P5B_STAFF_PATHS.md` |
| F-LIQCONTRACT-1 Liquid source contracts | `9ed996b7` (record `41212f67`) | `docs/evidence/liquid-contracts/F_LIQCONTRACT_1.md` |

The APPID phases in `~/.letbuyy/run/appid-2026-09-24/state.json` all stop at `MERGED_DEVELOP`. None reached
`E2E_DEVELOP`, the local end-to-end state `promote.md` §2 requires before `staging`.

## 3. Known gaps — open, not closed by any merge

1. **APPID-FIX2 (next phase).** `PATCH` and `DELETE /v1/products/:id` return 500 on `develop`: the product
   adapter looks up and writes by product id alone, and the tenant query guard refuses it ("Tenant table
   products requires a tenant/owner predicate before execution"). P5b's PATCH/DELETE tests prove only that
   the staff check receives the product's store; they pass while the later adapter call fails. They are
   not proof that product edit or delete works.
2. The tenant query guard accepts `filter` with any operator on a scope column as scoping (a `neq` passes).
3. Operator sign-in, MFA and step-up: APPID-P5a, not started.
4. The staff check does not read `site_memberships` / `site_roles`; safe only while every route using it is
   owner-only.
5. Merchant custom CSS (`site_settings.custom_css`) is rendered on no storefront, and the `.lb-theme`
   selector matches no element on the storefront runtime.
6. The Core theme search box has no form, so Enter submits nothing. Reasoned from HTML; needs a browser.
7. Five `apps/commerce/web/src` TypeScript test files run in no regular test lane.
8. Localization and other ambient gate failures (§6), including `tests/localization/theme-localization.test.mjs`.
9. Pending outside the repository: every item in `EXTERNAL_ACTIONS.md`, hosted migrations 257–259, feature
   flags below, mobile release verification (iOS never built on this machine).

## 4. Toolchain

| Tool | Version | Source |
|---|---|---|
| Node | 20 (`.nvmrc`; CI `NODE_VERSION: "20"`; `engines.node >=20.9.0`). The last local gate ran on Node 26; use `npx -y node@20` to reproduce CI | `package.json`, `.github/workflows/ci.yml` |
| pnpm | 10.6.2 (`packageManager`) | `package.json` |
| Flutter | stable channel in CI; 3.44.8 locally; Dart SDK `^3.10`/`^3.11` per pubspec | `ci.yml`, `pubspec.yaml` |
| Postgres | ephemeral container started by `scripts/governance/foundation-ephemeral-postgres.mjs` (Docker) | `package.json` `test:behavioral` |

## 5. Install and test

```bash
pnpm install --frozen-lockfile
node scripts/dev/setup-local-env.mjs      # writes untracked .env.local / .dev.vars from config/env/templates, dev-safe values only
pnpm run typecheck
pnpm run lint
node scripts/validate-governance.mjs --lane=gate --plan   # SAFE; the lane without --plan deletes node_modules, .next, build, … under apps|packages|services
pnpm run test:contracts
pnpm run test:unit:gateway
node --test --test-concurrency=1 tests/*/*.test.mjs
bash .claude/skills/letbuyy/scripts/gate.sh --full --flutter-build --build   # the governed battery; refuses the primary checkout, so run it in a worktree
```

What needs more than Node and pnpm:

| Check | Needs |
|---|---|
| `pnpm run test:behavioral`, `test:governance`, `test:executable`, `gate.sh --real-db` | Docker for the ephemeral Postgres; `gate.sh` requires `LETBUYY_EXECUTABLE_PG_CONTAINER` naming a throwaway container |
| `gate.sh --mobile`, `--flutter-build` | Flutter SDK and Android SDK (`aapt` for badging) |
| iOS build of either Flutter app | macOS with Xcode and CocoaPods (CI job "Mobile merchant Flutter"; never run locally) |
| Storefront behaviour (search submit, custom CSS) | a browser against `pnpm dev` (`apps/commerce/web` on :9000) |
| Anything against hosted Supabase, Cloudflare, Vercel, Razorpay, Resend, Turnstile, Firebase | provider credentials; none is in the repository, and none is needed for the checks above |

Environment variable **names** (values never in git): the full key set is `config/env/staging.env.template`
and `config/env/production.env.template`; `setup-local-env.mjs` derives local keys from
`config/env/templates/*.env.example`. The ones that matter for the open work: `SUPABASE_DB_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (gateway database access), `LETBUYY_IDENTITY_ISSUER`, `LETBUYY_IDENTITY_PRIVATE_JWK`
(identity-platform only) and `LETBUYY_IDENTITY_PUBLIC_JWKS` (every verifier), `CUSTOMER_SESSION_SECRET`
(transitional HS256 buyer realm), `INTERNAL_API_SECRET` (identity-platform ↔ gateway), `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` (buyer verification email, E-13), `NEXT_PUBLIC_ACCOUNTS_URL` (storefront → identity, E-17),
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (payments), `TURNSTILE_SECRET_KEY`.

## 6. Feature flags and defaults

| Flag | Default | Where |
|---|---|---|
| `MERCHANT_STAFF_RBAC_MODE` | `enforce`; `dryrun` honoured only outside production | `services/api-gateway/src/middleware/staff-permission.ts` |
| `FEATURE_LIQUID` | `"true"` in the dev and staging var blocks, `"false"` in production | `services/api-gateway/wrangler.toml` |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | `false` | `packages/theme-engine/src/theme-governance.ts` |
| `LETBUYY_BUYER_SIGN_IN` (dart-define) | off; "Sign in with LetBuyy" is compiled only with `=true` | `apps/marketplace/mobile/lib/main.dart` |

Not deployed and not enabled anywhere: buyer sign-in (P4a–P4d, needs migrations 257–259 then gateway then
identity-platform, E-12/E-16/E-18), P5b's staff enforcement (E-19 query first), Liquid in production.

## 7. Validation baseline

Last full governed gate: `gate.sh --full --flutter-build --build` at `c2064968` (tree identical to merge
`9ed996b7`; `develop` = `41212f67` adds two ledger lines): **failed = 7 lanes**, 295 failing test names:
`lint` (customer-web: 37 `no-hardcoded-hex` CAP-C77 + 1 `no-new-next-api-route` CAP-C76), `validators:sweep`
112/114 (`environment`: one offender, `apps/marketplace/mobile/web/firebase-messaging-sw.js:7`, owner action
E-7; `stale-artifact`: method artefact of a working tree with `node_modules`, F-STALECOUNT-1),
`tests:security+auth`, `ui:validate`, `tests:all`, `test:@letbuyy/customer-web`
(`theme-localization.test.mjs`), `test:@letbuyy/merchant-web`. These are recorded ambient failures, not a
waiver: a later phase must compare failing **names** against this set, not totals.

CI on `41212f67` (run `36030084973`, push to `develop`): Typecheck and Secret hygiene passed; Lint failed with
the same 38 customer-web errors; Governance (the real lane) failed on `environment-validator` alone, the same
single offender. The scheduled "Branch lag monitor" fails on every run with "Production deploy must run from
main; current ref is develop": the schedule runs on the default branch, `develop`. That is a CI configuration
finding, not a regression. "Graph Intelligence (DB layer)" (run `36030084957`) failed on the same push: its
report step opens `graphify-out/graph.json`, which is gitignored and never generated in CI. The re-run of the full gate for this phase and the remaining CI jobs are recorded in
this phase's `EXECUTION_LEDGER.md` row.

## 8. Next bounded task — APPID-FIX2: product edit and delete by id

Objective: `PATCH` and `DELETE /v1/products/:id` succeed for a store's own products and never touch another
store's, with the tenant query guard satisfied by an exact store predicate rather than weakened.

Acceptance, each shown failing before the fix (revert-and-watch):
1. Through the real products router, adapter and guarded client: the owner of store A edits product P of
   A and gets 200 with the row changed; deletes it and gets the documented success status with the row gone.
2. Cross-tenant denial: the owner of store B sends the same requests for P and gets 403 or 404, and P is
   unchanged; a raw probe as `app_tenant` with B's GUC reads zero rows of A and mutates none.
3. The guard is not relaxed to make this pass; a plant that drops the store predicate from the adapter
   makes test 1 fail with the guard error.
4. Gateway unit, contracts, `tests/*` and the validator sweep show no failing name absent from §7's set.

Out of scope for that phase: tightening the guard's operator check (gap 2), operator sign-in (P5a).

## 9. Push side effects (read from `.github/workflows/` on 2026-09-24)

A push to `develop`, `staging` or `main` runs `ci.yml` (typecheck, lint, secret hygiene, unit tests, merge
safety gate, governance, Flutter mobile on macOS, build) and, when paths match, `graph-intelligence.yml`.
A push to `main` also runs `architecture-governance.yml` and, path-scoped, `staging-runtime-deployment.yml`,
whose push path takes the `!inputs.execute` branch: a plan, not a deploy. `production-deploy.yml`,
`deploy-staging.yml`, `staging-deploy.yml`, `production-rollout.yml` and `mobile-merchant-release.yml` are
`workflow_dispatch` only. No GitHub workflow deploys, migrates a hosted database or publishes a mobile build
on push.

Not visible from the repository: whether the Vercel projects that `EXTERNAL_ACTIONS.md` E-1 names are
connected to this GitHub repository, and whether Cloudflare has a Git build connected. No tracked
`vercel.json` sets `git.deploymentEnabled`, so if a Vercel project is Git-connected, a push can build a
preview (any branch) or a production deployment (the project's production branch). Check both dashboards
before pushing `staging` or `main`. Re-read the triggers before any push; this section is dated.
