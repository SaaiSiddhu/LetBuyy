# SUSTAINED-I — full triage of the SUSTAINED-H behavioral run (workstreams 3 and 4)

Source run: `pnpm run test:behavioral` on the SUSTAINED-I tip at commit `c735b89` (container
`letbuyy-executable-pg`, database `letbuyy_executable`, docker-shim on PATH). Full log preserved at
`/tmp/sustained-i-test-behavioral.log` (container-local, not committed — too large for the tree).
Final summary: `tests 2089, pass 2040, fail 28, cancelled 6, skipped 15, duration_ms 1480665` (~24.7
min).

Per the owner's instruction: triage every failure, cancellation and skip; reproduce suspected
baseline failures on the pre-programme commit in an equivalent environment; treat unattributed
results as unresolved. Nothing below is asserted from memory or git-blame alone where reproduction
was possible — every PRE_EXISTING classification is backed by an actual `node --test` run against
`41af1cd9` (the commit immediately before the SUSTAINED programme's first claim, `17e754e`'s parent
chain — confirmed the correct baseline reference already established earlier in this same phase).

## Method

1. Extracted all 29 `not ok` TAP lines (28 counted as `fail`, 1 folded into `cancelled` — see below)
   plus the 15 `# SKIP` lines from the full log.
2. For each failure, read the actual assertion/error text and identified the implementation file(s)
   the test reads.
3. For each implementation file, checked `git log -1 -- <file>` and `git merge-base --is-ancestor
   <that commit> 41af1cd9`. A file last touched by a commit that is an ancestor of `41af1cd9` cannot
   have been changed by the SUSTAINED programme (or by the earlier-in-this-session APPID-FIX2 work
   that preceded it) — that is decisive, not circumstantial.
4. Where a candidate looked genuinely programme-caused (console-mfa.ts), traced its owning commit,
   read the full diff, and fixed it.
5. For every remaining PRE_EXISTING candidate, added a **second, independent proof**: checked out
   `41af1cd9` into a throwaway worktree (`/tmp/letbuyy-baseline-41af1cd9`, removed after use) and ran
   the exact same test files there, unmodified. 21 of 21 reproduced byte-identically by test title.
   `theme-tenant-isolation.test.mjs` (the suite-level `hookFailed` + its 6 cancelled subtests)
   reproduced identically under the docker-shim specifically (see below). The 4 executable-postgres
   "destructive guard" refusals were confirmed pre-existing by commit-date ancestry alone (their guard
   clauses are self-evidently unconditional — see below) without needing a baseline run.

## Full classification (28 fail + 6 cancelled + 15 skipped = 49 accounted for)

### FIXED — genuine regressions introduced by this session's own work (2)

| # | Test | Root cause | Fix |
|---|---|---|---|
| 1 | `not ok 318` — migration 107 applies locally and closes anon-readable sensitive RLS policies (`tests/executable/security-rls-hardening-postgres.test.mjs`) | Cross-suite Postgres role contamination: `role "anon" cannot be dropped because some objects depend on it` — `505 objects in database letbuyy_webhook_reclaim`. Exactly the `pg_shdepend` cluster-wide-role bug first fixed in `tenant-redteam-postgres.test.mjs` (SUSTAINED-B.B) and ported to 2 files in SUSTAINED-H. This file was never ported. | Ported `clearRoleDependenciesInSiblingDatabases(['service_role','authenticated','anon'])` to this file (see workstream 4 below) — the same mechanism SUSTAINED-I workstream 2 empirically proved scoped, non-destructive and concurrency-safe. |
| 2 | `not ok 364` — domain boundary validator rejects app-local API ownership drift (`tests/federation/app-api-route-ownership.test.mjs`) | SUSTAINED-E (`bcadc99`, 2026-09-24, this session) added `apps/internal/console/src/lib/console-mfa.ts`: RFC 6238 TOTP verification via `createHmac('sha1', ...)` + `timingSafeEqual` for constant-time code comparison. `scripts/validators/domain-boundary-validator.mjs`'s `appLocalProviderSignaturePattern` regex (`razorpay_signature\|stripe\.webhooks\|createHmac\|timingSafeEqual`) flags any app-local `src/lib/` file using those primitives as a payment-provider-signature violation — a real rule for payment webhooks, a false positive for MFA. | Extended `isAuthOwnedLocalFile`'s existing exemption (already covers `console-auth-server.ts` as `app-local-operator-auth`) to also cover `console-mfa.ts` and its test file — the same operator-authentication class, not a payment-provider signature check, and not a relaxation of the payment-signature rule itself. |

`not ok 364`'s subtest still fails today for an *unrelated* pre-existing reason (see the 189-vs-201
item below) — the console-mfa false positive inside it is confirmed cleared: re-running
`tests/federation/app-api-route-ownership.test.mjs` after the fix no longer reports the
`console-mfa.ts`/`console-mfa.test.ts` "must not verify provider signatures" lines at all.

### PRE_EXISTING — reproduced byte-identically on baseline `41af1cd9` (21)

All 21 reproduced with the same test title and, where checked, the same error text, running the
unmodified test file from the `41af1cd9` worktree — proof, not inference:

| Test | File | Baseline-commit evidence |
|---|---|---|
| WS12 G6 migrated REST endpoints (`not ok 5`) | `tests/api-graphql/rest-shim-parity.test.mjs` | reads `services/api-gateway/src/routes/{orders,pages,products}.ts` + `graphql/*.ts`, all last touched by `d705397` (2026-09-23), an ancestor of `41af1cd9` |
| customer-web signs server-only legacy customer lookups (`not ok 54`) | `tests/auth/customer-session-gateway.test.mjs` | reads `apps/commerce/web/src/lib/api/client.ts` / `.../customer/set-password/route.ts`, last touched by `19f79ba` (D-APP-LAYOUT rename), ancestor of `41af1cd9` |
| app-local API route ownership is validator-enforced (`not ok 363`) | `tests/federation/app-api-route-ownership.test.mjs` | hardcodes `appApiRoutes.length === 189`; the validator's real, current count is 201 (bumped through 188→189→195→197→201 across APPID-P4a/b/c, all pre-baseline commits per the validator's own changelog comments) — stale test debt, never this programme's assertion |
| domain boundary validator rejects app-local API ownership drift (`not ok 364`, residual) | same file | after the console-mfa fix, still fails on the *message-count* assertion (`/189 app API route ownership records checked/` vs actual `201`) — the identical 189-vs-201 drift as `not ok 363`, unrelated to console-mfa |
| app billing approval does not fabricate provider success references (`not ok 368`) | `tests/federation/app-billing-payout.test.mjs` | reads `services/api-gateway/src/routes/app-store/billing-oauth-routes.ts`, last touched `d705397`, pre-baseline |
| all seven web apps consume the shared design-system package (`not ok 386`) | `tests/federation/design-system-consolidation.test.mjs` | hardcodes path `apps/merchant-web/package.json` — stale even against the D-APP-LAYOUT rename's own `apps/merchant/web`; ENOENT is pure path-string debt in the test, not an app regression |
| gateway auth middleware keeps the legacy branch order snapshot (`not ok 751`) | `tests/identity-foundation/production-parity.test.mjs` | reads `services/api-gateway/src/middleware/auth.ts` / `packages/auth-core/src/feature-flags.ts`, both pre-baseline (`d705397`) |
| gateway verifier registry preserves legacy branch order (`not ok 757`) | `tests/identity-foundation/remaining-scaffolds.test.mjs` | reads `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts`, pre-baseline (`d705397`) |
| Experience Picker A/B (×3) (`not ok 775/777/778`) | `tests/launch/lb-experience-flow.test.mjs` | `apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx` last touched `19f79ba` (rename only), pre-baseline; the "editor" wiring file nowhere calls `buildExperienceSettingsOverlay` by that literal name in the current tree, a pre-existing implementation/test naming drift |
| 5C Invite acceptance dead-link check (`not ok 1694`) | `tests/launch/lb-phase5-commerce.test.mjs` | the actual source carries its own dated comment: "Phase N3: staff self-service invite activation is retired ... and is now removed entirely" — a prior, unrelated phase's intentional removal; the test itself was never updated |
| LB-11/LB-12/(P4-4) route-count lockstep (×3) (`not ok 1761/1772/1819`) | `tests/launch/{lb11-giftcards,lb12-registration,lb6-collections}.test.mjs` | all three hardcode `appApiRoutes.length === 188`, an even staler snapshot than the 189 above; same root cause (nobody keeps every old "lockstep" test in sync when the validator's real count grows) |
| LB-13-B assertProviderPaymentNotReplayed signature (`not ok 1779`) | `tests/launch/lb13-security-trio.test.mjs` | reads `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`, pre-baseline (`d705397`) |
| production app deployment matrices match Vercel topology (`not ok 1902`) | `tests/operations/production-deploy-workflow.test.mjs` | reads `config/vercel/projects.json` / `config/runtime/production-topology.json`, both last touched by `2015cfa` (APPID-P1 Stage 6 caller migration), pre-baseline; the config sweep missed this one file, a known-incomplete-sweep pattern already documented in `CLAUDE.md` for the six-app rename |
| storefront JSONB / cache-key / cache-tag / checkout-deferral (×4) (`not ok 1935/1957/1958/1970`) | `tests/performance/{dual-model-consolidation,storefront-cache,variant-checkout-deferral}.test.mjs` | all read `services/api-gateway/src/routes/orders.ts`, `.../lib/storefront-cache.ts`, `.../execution/order-execution.adapter.ts` — every one last touched by `d705397`, pre-baseline. SUSTAINED-D3 (the one phase that plausibly touches order/buyer routes) added a **new** file, `routes/storefront/buyer-order-routes.ts`, and never touched any of these four |
| converted Liquid theme portability (`not ok 1988`) | `tests/theme-engine/first-party-liquid-portability.test.mjs` | reads theme-presets/section-bundle files, pre-baseline |

### PRE_EXISTING — confirmed by unconditional guard clause + commit-date ancestry (4)

Four `tests/executable/*-postgres.test.mjs` files carry their own deliberate, self-imposed refusal:
they recreate their database and replay every migration (one of them twice) and refuse to run at all
unless `LETBUYY_EXECUTABLE_PG_CONTAINER` names a dedicated, uniquely-named throwaway container —
never the shared `letbuyy-executable-pg` container that `pnpm run test:behavioral` uses by default.
This guard is unconditional (it throws at module load, before any test registers), so it fails the
same way regardless of anything this programme did:

| Test | Guard message (verbatim from the log) |
|---|---|
| `checkout-order-concurrency-postgres.test.mjs` (`not ok 35`) | "is destructive (recreates the database and replays every migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, uniquely-named throwaway container — running it against the shared \"letbuyy-executable-pg\" container ... would destroy other sessions' in-progress state." |
| `gift-card-issue-idempotency-postgres.test.mjs` (`not ok 46`) | "is destructive (recreates the database and replays every migration, twice). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, uniquely-named throwaway container." |
| `late-capture-after-release-postgres.test.mjs` (`not ok 50`) | "is destructive (recreates its database and replays every migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER naming a dedicated throwaway container — use scripts/governance/run-executable-suites.mjs --filter late-capture." |
| `money-rpc-idempotency-sweep-postgres.test.mjs` (`not ok 59`) | "is destructive (recreates the database and replays every migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, uniquely-named throwaway container ..." |

All four guard clauses were authored in `d705397` (2026-09-23), confirmed an ancestor of `41af1cd9` —
pre-baseline. `scripts/governance/run-executable-suites.mjs`'s own header comment documents exactly
this design: "three refuse to run at all unless LETBUYY_EXECUTABLE_PG_CONTAINER names a dedicated
throwaway." **This is a structural gap in how `test:behavioral` is wired (it never sets that env var
per-suite), not a code regression** — worth a future bounded fix (teach `test:behavioral` to either
skip these four with a clear reason or shell out to `run-executable-suites.mjs` for them), out of
scope for this acceptance-closure phase.

### PRE_EXISTING / ENVIRONMENT — reproduced identically on baseline, same tooling artifact (1 suite, 6 cancelled)

`not ok 1979` — theme tenant isolation (migration 196 RLS, live schema)
(`tests/security/theme-tenant-isolation.test.mjs`) — `failureType: hookFailed`, `ERROR: relation
"public.users" does not exist` against container `supabase_db_Letbuyy_Store`. Reproduced two ways at
baseline:

- Without the docker-shim on PATH (real `docker`, no daemon): the test's own reachability check
  correctly reports "Supabase Postgres container ... is not reachable" and **skips** cleanly.
- With the docker-shim on PATH (the actual condition under `test:behavioral`, which prepends it):
  the shim answers `docker inspect`/`exec` against *any* container name by redirecting to the one
  native `postgresql-16` cluster this container has, regardless of the name asked for. So the
  reachability check believes `supabase_db_Letbuyy_Store` is up, proceeds, and hits a cluster that
  was never seeded with this test's expected `public.users` schema (a different schema-under-test
  than the one the shared `letbuyy-executable-pg` container carries) — the exact same `relation
  "public.users" does not exist` error, byte-for-byte, as the SUSTAINED-I run.

This is a docker-shim tooling artifact (documented as an accepted limitation of the shim, which
"translates a small, fixed subset" and was never scoped to arbitrary container names), not a code
regression. The suite's `before` hook failing cancels its own 6 subtests — this single file accounts
for the run's entire `# cancelled 6`.

### Accounted for, benign (15 skipped)

All 15 `# SKIP` lines are `[HUMAN-REQUIRED]` gates: KMS envelope keys, Turnstile secrets, PA-split
credentials, merchant PSP keys, GST IRP/e-way credentials, carrier accounts, checkout.letbuyy.com DNS
cutover, WhatsApp BSP/HSM templates, DLT/TRAI sender IDs, ESP/SPF/DKIM/DMARC, UPI AutoPay/NPCI, RBI
PA-model + DPDP legal sign-off, external warehouse contracts, AI model/provider approval, and
staging/prod migration+deploy human approval. Every one is an intentional, pre-existing gate on a
live credential or an owner decision — none is masking a code defect.

## Reconciliation against the log's own totals

`# fail 28` = 21 (pre-existing, baseline-reproduced) + 4 (pre-existing, destructive-guard) + 1
(pre-existing, theme-tenant-isolation `hookFailed`) + 1 (role contamination, FIXED) + 1 (console-mfa
false positive, FIXED) = 28. `# cancelled 6` = theme-tenant-isolation's own 6 subtests, same root
cause as its `hookFailed`. `# skipped 15` = the `[HUMAN-REQUIRED]` gates above. Every one of the 49
outcomes this run reported beyond a plain `ok` is now attributed to a specific, evidenced cause —
none left as an unattributed "unrelated" assertion.
