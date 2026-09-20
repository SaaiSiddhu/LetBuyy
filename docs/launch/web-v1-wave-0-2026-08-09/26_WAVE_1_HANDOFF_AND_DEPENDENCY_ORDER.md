# 26 — Wave 1 Handoff and Dependency Order

> **Evidence artifact, not governance authority.**
> This document plans work. It does not amend the Constitution, `AGENTS.md`, any nested `AGENTS.md`,
> or `LETBUYY_CANONICAL_SYSTEMS.md`, and it does not grant permission for anything those documents
> forbid. Where this plan and the authority chain disagree, **the authority chain wins and this
> document is wrong**. Every ARB-gated item below is named as ARB-gated; none is pre-approved here.

| Field | Value |
|---|---|
| **Date** | 2026-08-09 |
| **Baseline SHA** | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (`bf35062e`), human-approved |
| **Original repository** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — branch `stepup/main`, **production-linked**, read-only for this agent |
| **Integration head** | `codex/web-v1-integration` @ `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab` in worktree `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` |
| **Emergency branch** | `codex/emergency-appbridge-killswitch` @ `6c3e17df` in worktree `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch` |
| **Authority chain** | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → nested `AGENTS.md` → `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` |
| **Wave 1 work implemented by this document** | **None.** This is a handoff. No Wave 1 change was designed, written, staged or committed. |

---

## 0. EXECUTED vs INFERRED vs UNVERIFIED for *this* document

### 0.1 EXECUTED by this agent, in the original repository, read-only, 2026-08-09

| ID | Command | Observed |
|---|---|---|
| H1 | `git rev-parse --abbrev-ref HEAD` | `stepup/main` (before **and** after all work) |
| H2 | `git rev-parse HEAD` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` (before and after) |
| H3 | `git status --porcelain=v1 \| wc -l` | **6826** (before and after) |
| H4 | `git stash list \| wc -l` | **2** (before and after) |
| H5 | `git log --oneline bf35062e..codex/web-v1-integration` | **23** commits, listed verbatim in doc 27 §2 |
| H6 | `git diff --shortstat bf35062e codex/web-v1-integration` | `155 files changed, 51757 insertions(+), 1003 deletions(-)` |
| H7 | `git diff --shortstat bf35062e codex/emergency-appbridge-killswitch` | `14 files changed, 1356 insertions(+)` — **0 deletions** |
| H8 | `git merge-base --is-ancestor codex/emergency-appbridge-killswitch codex/web-v1-integration` | **non-zero → NOT an ancestor.** The kill switch is *not* in the integration branch. |
| H9 | `git rev-list --left-right --count HEAD...origin/stepup/main` | `17  0` |
| H10 | `git rev-list --left-right --count origin/main...origin/stepup/main` | `0  274` |
| H11 | `git rev-list --count main..codex/web-v1-integration` | **129** |
| H12 | `git branch -r \| grep -c codex/` | **0** — no `origin/codex/*` ref exists; nothing is pushed |
| H13 | `git worktree list` | 6 Wave 0 worktrees under `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/`, plus the original |
| H14 | `test -e` over 60 candidate paths (apps, services, packages, validators, workflows, tests, migrations) | Every path named as *canonical* in §3–§18 below returned **OK**. Paths that returned MISS in the original tree and exist only on the integration branch are **labelled as such inline**. |
| H15 | `ls scripts/validators/*.mjs` | 112 modules on disk at the baseline; every validator named in a merge gate below is one of them |
| H16 | `ls database/supabase/migrations \| wc -l` | **126** files present on disk (124 apply — see FBR-34: 2 of the 126 are the intent-to-add trap) |

### 0.2 INFERRED (taken from named Wave 0 documents, attributed, not re-run here)

Everything in §2 (Wave 1 entry blockers) that carries an `FBR-nn` reference is inherited from
`24_WAVE_0_FAILURE_AND_BLOCKER_REGISTER.md` and, where cited, from docs 18, 19, 20, 21, 22, 23, 28,
29 and 30. **This agent did not re-run the governance gate, any build, any lint, any test suite, or
any Supabase command.** The measurements are attributed to the agent and document that produced them.

### 0.3 UNVERIFIED — stated plainly

- **No Wave 1 workstream below has been executed, prototyped, or estimated against a real diff.** The
  dependency order is an argument from measured coupling, not from an executed trial.
- **The "required tests" columns name suites and files that exist today** (H14/H16) **plus tests that
  do not yet exist.** New tests are marked **(NEW)**. Nothing below claims a test passes.
- **No merge gate below has been observed to pass on a Wave 1 branch**, because no Wave 1 branch
  exists.
- **The blast-radius claims in "forbidden alternatives" are architectural readings**, not `graph:intel
  blast` output — LCIS was not queried by this agent.
- **No deployed environment variable value was read, in any environment** (FBR-05), so every claim
  about production behaviour is a claim about what the repository declares.

---

## 1. How to use this document

Sixteen workstreams, in **strict dependency order**. The order is not a preference; it is the order in
which the measured coupling permits each one to be *verified*. Building 9 (cart/checkout) before 3
(canonical money single-writer cutover) means the checkout tests certify a writer that is about to be
replaced.

Each workstream carries seven fields, and each field is load-bearing:

| Field | What it means |
|---|---|
| **Proposed branch** | A name only. No branch below exists. Naming convention follows the Wave 0 branches: `codex/w1-<slug>`. |
| **Dependencies** | Workstream numbers that must be **merged and green**, not merely started. |
| **Canonical files / systems** | Real paths, verified present (H14). The single place the change belongs. |
| **Forbidden alternatives** | The specific wrong implementations a reasonable engineer would otherwise pick. These are the rules that make the workstream a *cutover* rather than an addition. |
| **Required tests** | Executed proof the workstream must produce. **(NEW)** = does not exist yet. |
| **Merge gate** | The named validators / commands that must be green **on the workstream branch**, over and above the universal gate in §2.4. |
| **Rollback requirement** | How the change is undone in production without a code deploy, or — where that is impossible — the explicit statement that it cannot be. |

**Universal rule for all sixteen:** money mutations go through the `SECURITY DEFINER` RPCs and never
through `.from(<money table>).insert/update` in TypeScript (root `CLAUDE.md`; enforced by
`scripts/validators/canonical-ledger-only-validator.mjs`). No workstream is exempt.

---

## 2. Wave 1 entry blockers — what must be closed before workstream 1 opens

Wave 1 does not begin when someone decides it has begun. It begins when these gates are closed. They
are grouped by who can close them.

### 2.1 Human-only git operations on protected branches — **the keystone**

| Blocker | Evidence | Why it gates Wave 1 entry |
|---|---|---|
| **DEPLOY-R1 / branch lag** (FBR-27, FBR-28) | `origin/main` == `origin/develop` == `c2547049c0b5666661536d076046415714fb7d03`, **274 behind** `origin/stepup/main` (H10). `main..codex/web-v1-integration` = **129** (H11). `branch-lag-guard-validator.mjs` now hard-asserts and **fails every branch ahead of `main`** (doc 23 §5.2 row #104). | `AGENTS.md:330` DEPLOY-R1: *"Nothing else ships until the pipeline can deploy the integration branch."* `production-deploy.yml` triggers on `main`. **Every Wave 0 repair is currently undeployable, and no Wave 1 branch can pass the gate.** The fix is `MERGE_RUNBOOK.md` executed by a **human** on protected branches — an agent may not fast-forward `main`. |
| **17 unpushed commits on `stepup/main`** (FBR-26) | `git rev-list --left-right --count HEAD...origin/stepup/main` → `17 0` (H9) | Three of the 17 touch the ART-22-frozen `apps/theme-marketplace` (FBR-37) and need perimeter adjudication **before** the push. |
| **Nothing from Wave 0 is pushed** (FBR-26, FBR-33) | `git branch -r \| grep -c codex/` → **0** (H12) | Five local branches + one integration branch exist only on this laptop. A local commit is not a fix. |
| **GitHub branch protection is UNREADABLE** (FBR-23) | doc 09 §4, doc 19 — the available token cannot read protection settings | If protection matches `BRANCH_STRATEGY.md`, PRs into `stepup/main` would wait forever on five `ci / *` checks the repaired `ci.yml` now finally reports. A **repo owner** must read and reconcile it. |

> **Stated plainly:** items 2.1 cannot be closed by any agent. They require a human with push rights
> and a human with repository-settings rights. Until they are closed, Wave 1 work can be *written* but
> cannot be *shipped*, and the branch-lag guard will fail every Wave 1 branch.

### 2.2 Build / gate / lane failures that must be triaged before workstream 1

| Blocker | Measured | Owner surface |
|---|---|---|
| **`platform-console` fails `next build`** (FBR-18, doc 23 §8.3) | `pnpm --filter @letbuyy/platform-console run build` → **exit 1**, `TS2344` in `apps/platform-console/src/app/(dashboard)/developers/page.tsx` — Next 16 requires `PageProps.searchParams` to be a `Promise`. **Invisible to all 110 validators and to `turbo typecheck` (exit 0).** | `apps/platform-console` |
| **20 gate FAILs** (FBR-47, FBR-48, doc 23 §5.2) | `node scripts/validate-governance.mjs --lane=gate` → `PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1`, exit 1, on `8ec05e21`. **All 110 execute for the first time.** | repo-wide |
| — of which **≈4 are purely LCIS** (FBR-07) | `package-ownership` (21 manifests: 19 `packages/lcis-*`, `services/lcis-api`, `tools/central-intelligence`), `provider-isolation` (7 files, all `packages/lcis-adapters/**`), `typescript-governance` (~110 findings, 100 % `packages/lcis-*`), half of `dependency-manifest`/`undeclared-import` | `services/lcis-api` + 19 `packages/lcis-*` — **ARB classification required** |
| — of which **2 are security-relevant** | `route-ownership-validator`: `services/api-gateway/src/routes/custom-domains.ts:GET:/domains:483` — tenant-table handler with no ownership/internal/session gate. `raw-error-message-validator`: `services/api-gateway/src/routes/resource-search.ts` returns raw `error.message`. | `services/api-gateway` |
| **200 lint errors / 1,430 warnings across all 5 lint-capable apps** (FBR-17, doc 23 §7.2) | `merchant-control-plane` 122 errors · `marketing-site` 70 · `storefront-runtime` 4 · `platform-console` 3 · `identity-platform` 1. Dominant rule: `letbuyy-boundaries/no-new-next-api-route` ×68 in `merchant-control-plane` — the lint expression of `domain-boundary-validator`'s *"expected 129, found 188"* app-local API routes. | five Next apps |
| **`lint:css` exit 2** (doc 23 §7.3) | one auto-fixable stylelint error, `color-hex-length`; `ci.yml:97` runs it in the `lint` job | design system |
| **11 behavioural failures / 1,608** (FBR-19, doc 23 §9.1) | 11 with the Postgres fixture up; **30 without it** — the delta is 19 connection failures in `tests/executable/`, not logic | repo-wide `tests/` |
| **Full gate never run on `8ec05e21` in a disposable checkout** (FBR-41) | doc 23 ran it **and it removed 57 directories** including every workspace `node_modules` (FBR-16, doc 23 §5.3). Running the gate **uninstalls the workspace.** | release engineering |

> **Operational rule that must be written into every Wave 1 runbook:** `validate:governance` deletes
> generated output including `node_modules`. Order any pipeline **gate → `pnpm install --frozen-lockfile` →
> build → test**, never gate-then-build.

### 2.3 The two hazards in the original tree that must be defused before anyone commits there

Both are documented in `30_CORRECTIONS_AND_STASH_HAZARD.md` and both are **still armed**. No agent may
defuse either.

1. **Two stashes.** `stash@{0}` (`f8a6c8c7…`, *"On stepup/main: inf-ext"*) holds **28 files, +1,128 /
   −1,203** — a **third divergent body of uncommitted work**, unreachable from the baseline (its base
   `e0860c1d` is 53 commits behind `bf35062e`). Nine files carry a *different* real diff in the stash
   than in the dirty tree (`apps/identity-platform/src/app/onboarding/page.tsx`,
   `apps/merchant-control-plane/src/app/globals.css`, `packages/typescript/ui/src/app-shell.tsx`,
   `merchantNavigation.ts`, `AdminShell.tsx`, `select/page.tsx`, `tokens.ts`,
   `api/auth/create-store/route.ts`, `app-navigation.tsx`). Nineteen exist **only** in the stash —
   including four **already-committed** migrations (`100`, `109`, `111`, `142` — money, payments,
   credentials), `services/api-gateway/src/middleware/idempotency.ts`,
   `services/api-gateway/src/routes/auth.ts`, and three **deletion-only** `wrangler.toml` changes.
   `stash@{1}` is untracked-only (10 files, +214), including
   `apps/storefront-runtime/src/middleware.ts.bak` at +213.
   **Required posture: document only. No stash command beyond `list`/`show`.** The safe first step is a
   human-approved `git tag` on `f8a6c8c7` so it survives reflog expiry — **recommended, not performed.**
2. **The intent-to-add empty-blob trap.** Ten SQL files sit in the index as empty blob `e69de29b`
   while holding **789 lines / 43,929 bytes** on disk: migrations `196`, `197` and rollbacks `180`,
   `181`, `188`, `189`, `190`, `191`, `196`, `197`. `git diff --cached --numstat | wc -l` → **0**, so
   the trap is invisible to the commonest pre-commit check. Measured behaviour (doc 30 §3.2, in a
   throwaway repo): a `git commit` with other paths staged **silently omits all ten and leaves the `A`
   entries intact**; `git checkout-index -a` writes **0-byte files**; `git stash push` currently
   **fails**. Migration `196` is *theme RLS tenant hardening* — losing it while shipping code that
   assumes it silently regresses tenant isolation. **The fix is one human command: explicit
   `git add <path>` on all ten before any commit**, or `git commit -a` / `git commit -- <paths>`.

### 2.4 The universal Wave 1 merge gate

Every workstream branch below must satisfy **all** of this, in addition to its own named gate:

```
pnpm install --frozen-lockfile                     # exit 0
node scripts/validate-governance.mjs --lane=gate   # PASS count must not decrease; FAIL count must not increase
pnpm install --frozen-lockfile                     # again — the gate deletes node_modules (FBR-16)
pnpm run typecheck                                 # exit 0
pnpm --filter @letbuyy/<each touched app> run build   # real `next build`, exit 0, per app
pnpm --filter @letbuyy/<each touched app> run lint    # error count must not increase
pnpm run test:behavioral                           # with the Postgres fixture UP; failures must not increase
pnpm run test:contracts
node scripts/validators/web-v1-scope-perimeter-validator.mjs   # exit 0 — ratchet must not loosen
```

Plus, non-negotiably:

- **No `--update` on `validate-design-system.mjs`.** FBR-11: `--update` rewrites
  `scripts/validators/design-system-baseline.json` to current metrics and exits 0, with no guard
  against *raising* the ratchet. One command turns a hard gate green without touching product code.
  Any Wave 1 diff containing a raised baseline metric is rejected on sight.
- **No new `reporter.warn()` in any validator.** FBR-13 closed the two that existed; `advisory()` is
  the declared channel.
- **`pnpm graph:intel blast "<symbol>"` before merge** for any PR touching a named change-control
  hotspot: `getSupabaseAdmin` (115 files), `@letbuyy/shared-types`, `@letbuyy/api-client`,
  `create_checkout_order` (root `CLAUDE.md`).

---

## 3. Workstream 1 — Identity sole-issuer cutover

| | |
|---|---|
| **Proposed branch** | `codex/w1-identity-sole-issuer` |
| **Dependencies** | §2 entry blockers only. **This is the root of the tree.** Every later workstream authenticates against whatever this establishes; doing it second means re-certifying everything above it. |

**Canonical files / systems** (all verified present, H14):

- `apps/identity-platform/` — the **only** merchant issuer. ES256, `LETBUYY_IDENTITY_PUBLIC_JWKS`.
- `apps/identity-platform/src/proxy.ts` — host routing for the identity origin.
- `packages/auth-core/src/customer-session.ts` — the **only** customer issuer (`issueCustomerSession`, HS256, `CUSTOMER_SESSION_SECRET`).
- `services/api-gateway/src/lib/identity-session-verifier.ts` — the merchant-side verifier.
- `services/api-gateway/src/middleware/auth.ts` — the single gateway auth middleware.
- `services/api-gateway/src/routes/auth.ts`, `services/api-gateway/src/routes/two-factor.ts` — step-up (HMAC) gating refunds/payouts.
- `services/api-gateway/src/routes/storefront/customer-registration.ts`, `.../customer-engagement-routes.ts` — the two current `issueCustomerSession` call sites in the gateway.
- Enforcement: `scripts/validators/identity-sole-issuer-validator.mjs`, `session-security-validator.mjs`, `stepup-crypto-validator.mjs`, `single-source-crypto-validator.mjs`, `cookie-realm-validator.mjs`, `token-source-single-validator.mjs`, `dev-auth-bypass-validator.mjs`.

**Forbidden alternatives**

- **Do not** issue a merchant token anywhere except `apps/identity-platform`. A second ES256 signer,
  even "temporarily", crosses the two-issuer invariant that root `CLAUDE.md` states as *never crossed*.
- **Do not** verify a customer HS256 token with the merchant JWKS or vice versa.
- **Do not** add a dev/staging auth bypass. `dev-auth-bypass-validator.mjs` exists precisely for this,
  and FBR-03 already proves this codebase has a fail-**open** default (`featureFlags.ts:25` →
  `return !isProductionRuntime(env);`) that made a control permissive in dev, staging and preview.
- **Do not** ship this workstream while `featureFlags.ts:25` still defaults fail-open — **inverting
  that default to fail-closed is in scope for this workstream** (FBR-03), because every later
  capability gate inherits it.
- **Do not** touch App Bridge / app-store auth. That surface is workstream 4 and is ARB-gated.

**Required tests**

- `services/api-gateway/src/__tests__/identity-issuer-d3.test.ts` (exists) — must still pass and be
  extended to assert the *negative*: a customer HS256 token is rejected by every merchant-scoped route.
- `packages/auth-core/test/auth-core.test.ts` (exists).
- `tests/auth/**`, `tests/identity-foundation/**` (exist) — full pass.
- **(NEW)** fail-closed test for `featureFlags.ts`: an unset flag must be **disabled** in every
  environment, asserted per environment shape, with a falsification pass proving the test fails if the
  default is reverted.
- **(NEW)** step-up test: a refund and a payout are both rejected without a valid step-up assertion.

**Merge gate** — universal (§2.4) plus: `identity-sole-issuer-validator`, `session-security-validator`,
`stepup-crypto-validator`, `single-source-crypto-validator`, `cookie-realm-validator`,
`token-source-single-validator`, `dev-auth-bypass-validator`, `no-blanket-service-role-validator` — all
exit 0. `pnpm --filter @letbuyy/identity-platform run build` exit 0.

**Rollback requirement** — **Key-rotation rollback, not code rollback.** The change must be deployable
and reversible by JWKS/secret rotation with a documented overlap window in which the previous key still
verifies. State the overlap duration explicitly. Sessions issued under the old key must not be
force-invalidated by the rollback itself. Record the rollback rehearsal in the PR.

---

## 4. Workstream 2 — Tenant isolation and RLS closure

| | |
|---|---|
| **Proposed branch** | `codex/w1-tenant-isolation-rls` |
| **Dependencies** | **1.** RLS decisions are made against a caller identity; closing RLS before the issuer is settled certifies policies against a claim shape that is about to change. |

**Canonical files / systems**

- `services/api-gateway/src/tenant/tenant-tables.registry.ts` — the generated registry; **265 tables**
  after the regeneration that Wave 0 ported (FBR-09). Generator:
  `scripts/generators/generate-tenant-table-registry.mjs`.
- `database/supabase/migrations/` — 126 files on disk (H16). RLS policies live here and nowhere else.
- `database/supabase/rollback/` — the paired rollback scripts.
- **Migration `196_theme_rls_tenant_hardening.sql`** — currently **armed in the intent-to-add trap**
  (§2.3.2). It is a tenant-isolation control. It **must** be committed with an explicit `git add`
  before this workstream can be trusted.
- Enforcement: `scripts/validators/tenant-isolation-validator.mjs`, `rls-force-coverage-validator.mjs`,
  `no-public-using-true-validator.mjs`, `no-blanket-service-role-validator.mjs`,
  `app-utils-service-role-edge-validator.mjs`, `route-ownership-validator.mjs`,
  `fail-closed-internal-routes-validator.mjs`, `migration-safety-validator.mjs`,
  `sequential-migration-validator.mjs`, `rollback-integrity-validator.mjs`.

**Forbidden alternatives**

- **Do not** hand-edit `tenant-tables.registry.ts`. Regenerate it. Doc 18 proved the Wave 0 version is
  a genuine generator output by re-running the generator and observing a 4-line diff whose only changed
  line is the timestamp — hold that standard.
- **Do not** add a policy with `USING (true)` on a tenant table. `no-public-using-true-validator.mjs`
  exists for this.
- **Do not** reach for the service role to "make it work". Service-role gateway access is legal only
  **behind** `verifySiteOwnership` (root `CLAUDE.md`).
- **Do not** edit an already-applied migration. `stash@{0}` contains edits to four already-committed
  migrations (`100`, `109`, `111`, `142`) — that is a migration-immutability breach and is exactly the
  pattern to refuse (doc 30 §2.2).
- **Do not** close `route-ownership-validator`'s `custom-domains.ts:483` finding by adding the route to
  an allowlist. Gate the handler.
- **Do not** land `tests/security/theme-tenant-isolation.test.mjs` as-is: FBR-44 proves it reports
  **0 tests / exit 0** without a database — it passes by running nothing. Make it **hard-fail** when no
  database is reachable, in this workstream, before it is used as evidence for anything.

**Required tests**

- `tests/security/theme-tenant-isolation.test.mjs` — **repaired to hard-fail without a DB**, then run
  against the isolated local stack (doc 22 proved 124/124 migrations apply, 438 tables, 997 RLS
  policies, DB at `127.0.0.1:15422`, provably not the remote pooler).
- `tests/executable/**` with the Postgres fixture **up** — the 19-suite delta in doc 23 §9.1 is the
  proof that running these without a fixture measures nothing.
- **(NEW)** cross-tenant negative test per newly-registered tenant table: tenant A's credential must
  return zero rows for tenant B's `site_id`, asserted at the RPC boundary, not only at the route.
- **(NEW)** a test that fails if `tenant-tables.registry.ts` drifts from the generator output.

**Merge gate** — universal (§2.4) plus all ten validators named above at exit 0, **and** the isolated
local stack applying every migration cleanly from empty. `route-ownership-validator` must go from FAIL
to PASS.

**Rollback requirement** — **Every migration in this workstream ships with a tested rollback in
`database/supabase/rollback/`, and the rollback is executed against the isolated stack before merge.**
`rollback-integrity-validator.mjs` must pass. A policy change with no proven `DOWN` is not mergeable.
Note explicitly in the PR whether the rollback is *safe under load* or requires a maintenance window.

---

## 5. Workstream 3 — Canonical money single-writer cutover

| | |
|---|---|
| **Proposed branch** | `codex/w1-canonical-money-single-writer` |
| **Dependencies** | **1, 2.** The ledger is written under a caller identity and read under RLS. Cutting over the writer before either is settled means re-proving the ledger twice. |

**Canonical files / systems**

- The six `SECURITY DEFINER` RPCs (root `CLAUDE.md`): `create_checkout_order`,
  `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`,
  `set_gift_card_status`, `restore_gift_card_on_refund`. Defined across
  `database/supabase/migrations/000_baseline.sql`, `166_d6_checkout_handoff_inventory.sql`,
  `168_b1_b2_capture_refund_ledgering.sql`, `170_v1_shipping_rates_gst.sql`,
  `173_v1_gift_card_issuance_lifecycle.sql`, `174_v1_gift_card_refund_restore.sql` (verified by grep).
- `services/api-gateway/src/routes/payments.ts`, `services/api-gateway/src/routes/checkout.ts`,
  `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`,
  `services/api-gateway/src/routes/storefront/internal-payment-routes.ts`,
  `services/api-gateway/src/routes/payouts.ts`, `.../settlements.ts`, `.../wallet.ts`,
  `.../gift-cards.ts`, `.../returns.ts`.
- `services/api-gateway/src/middleware/idempotency.ts` — **note: `stash@{0}` holds a divergent
  `+7/−2` version of this file that exists nowhere else** (doc 30 §2.1b). Adjudicate before touching it.
- `services/queue-workers/src/money-ledger-reconciliation.ts` — the reconciliation worker.
- Enforcement: `scripts/validators/canonical-ledger-only-validator.mjs`,
  `single-writer-ownership-validator.mjs`, `inr-currency-format-validator.mjs`,
  `commission-bps-zero-validator.mjs`, `no-self-custody-rail-validator.mjs`,
  `pricing-catalog-validator.mjs` (now hard-asserting and **passing** — FBR-13).

**Forbidden alternatives**

- **Never** `.from(<money table>).insert/update` in TypeScript. This is the single hardest rule in the
  repository and `canonical-ledger-only-validator.mjs` enforces it.
- **Do not** compute totals, tax or shipping on the client, or accept a client-supplied amount. Amounts
  are computed **in the RPC, from the DB** (root `CLAUDE.md`).
- **Do not** add a second writer "just for X". That is the definition of the thing this workstream
  removes.
- **Do not** implement a gift-card balance as a mutable decrement. The balance is a **ledger
  projection**; `gift_card_ledger_entries` is the truth.
- **Do not** ship an RPC without `idempotency_key`, `ON CONFLICT` and `FOR UPDATE`. Balances carry a
  `>= 0` CHECK; keep it.
- **Do not** resolve **FBR-30 (Stripe wired into the live payment router)** inside this workstream by
  quietly deleting it. `services/api-gateway/src/routes/payments.ts:13,1265-1284` and
  `storefront/checkout-payment-routes.ts:23,961-993` import and execute the Stripe adapter against
  `c.env.STRIPE_SECRET_KEY`, declared at `services/api-gateway/src/index.ts:142`. **Deferral is
  currently an unset secret, not a code perimeter.** ARB decides: remove behind a real code perimeter,
  or formally accept an env-gated PSP and record the acceptance (escalation `ESC-STRIPE-LIVE`). **No
  agent picks.** Whatever ARB picks lands *in this workstream*, because it is a money-router change.

**Required tests**

- `tests/executable/**` money suites against the isolated Postgres (doc 23 rows 31–32 ran
  `32_test_payment_postgres_isolated.log` — reuse that harness).
- **(NEW)** idempotency proof per RPC: the same `idempotency_key` submitted twice produces **one**
  ledger effect, asserted on row counts, not on a return value.
- **(NEW)** concurrency proof: two concurrent calls under `FOR UPDATE` produce a serialized result and
  never a negative balance.
- **(NEW)** a single-writer proof: a static assertion that no TypeScript file outside the RPC boundary
  writes any money table — i.e. a test that would fail if `canonical-ledger-only-validator` were
  removed. (A control with no independent test is the FBR-44 shape.)
- **(NEW)** gift-card projection test: balance derived from the ledger equals the projection under
  issue → redeem → refund-restore.

**Merge gate** — universal (§2.4) plus `canonical-ledger-only-validator`,
`single-writer-ownership-validator`, `inr-currency-format-validator`, `commission-bps-zero-validator`,
`no-self-custody-rail-validator` at exit 0, **and** `pnpm graph:intel blast "create_checkout_order"`
attached to the PR (root `CLAUDE.md` change-control hotspot). **ARB sign-off is required** — money-path
change control (`AGENTS.md` §16.5).

**Rollback requirement** — **Forward-only, with a proven compensating path.** A ledger migration is not
rolled back by dropping rows. Each RPC change ships (a) a paired rollback script that restores the
prior function definition, and (b) a written statement of what happens to in-flight orders during the
switch. If the answer is "they fail", the deploy needs a drain window and the PR must say so.

---

## 6. Workstream 4 — App Bridge / extension shutdown

| | |
|---|---|
| **Proposed branch** | `codex/w1-appbridge-removal` |
| **Dependencies** | **1, 2, 3** — the removal touches gateway auth, tenant tables (`app_*`) and, via `app-functions-runtime`, the checkout decision path. |

### 6.1 Current status: ALREADY-GATED-BUT-NOT-REMOVED

`codex/emergency-appbridge-killswitch` @ **`6c3e17df`** exists in
`/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch`.

| Fact | Evidence |
|---|---|
| Two commits: `df4abd5d` *"fail-closed hard gate over the frozen app-platform seam"* → `6c3e17df` *"close the three ungated app-platform seams the prefix gate missed"* | H5-equivalent `git log bf35062e..codex/emergency-appbridge-killswitch` |
| **14 files changed, 1,356 insertions(+), 0 deletions(−)** | H7 |
| **NOT an ancestor of `codex/web-v1-integration`** | H8 — `git merge-base --is-ancestor` returns non-zero |
| Not pushed, no PR, not deployed; `origin/codex/*` does not exist | H12 |
| 59 proving tests pass, with a falsification pass proving they detect an absent gate | doc 29 §11 |
| Status | **`GATED_WITH_RESIDUAL_RISK`** |
| Neither Next.js app was compiled | FBR-04 — no `node_modules` in that worktree; offline mandate |
| No deployed env value was ever read | FBR-05 |

**It is a reversible gate, not a removal. One environment variable re-opens everything.** Zero deletions
in 1,356 insertions is the arithmetic proof of that.

What the gate does **not** close (FBR-46): `services/api-gateway/src/routes/internal-console.ts:1028`
reads `app_installations`; the queue execution adapter reads `marketplace_apps`, `app_developers`,
`partner_payout_ledger_entries` (both behind `INTERNAL_API_SECRET` or an HMAC-signed envelope, not
customer-reachable); `apps/merchant-control-plane/public/letbuyy-app-bridge.js` and
`public/example-app-bridge.html` remain publicly fetchable Next `/public` assets;
`services/mobile-bff` `ALLOWED_PREFIXES` still lists `/v1/app-store` and `/v1/app`.

### 6.2 The Wave 1 action

**Permanent removal is the ARB-governed Wave 1 action, and it is not authorised by this document.**

- Scope: **≈9,566 lines** plus the `app_*` tables (doc 29 / FBR-01). The reachable surface alone is
  `services/api-gateway/src/routes/app-store/*.ts` = **7,292 lines across 11 files** (doc 08, `wc -l`).
- Mounts to remove: `services/api-gateway/src/index.ts:727-728` (`/app-store`, `/app`), `:735`
  (`/storefront` app-block composition), `:832-833` (`/operations/marketplace-reviews`,
  `/operations/developers`).
- Also in scope: `services/api-gateway/src/extensions/app-functions-runtime.ts:437` —
  `WebAssembly.instantiate` on third-party modules feeding `createAppFunctionCheckoutDecision`
  (FBR-31, escalation `ESC-WASM-APPFUNCTIONS`). No importer exists inside `services/api-gateway/src`;
  it is compiled but unmounted. `AGENTS.md:185` NEVER-R3 names it MUST NOT BUILD. **ARB assigns
  ownership first** — it sits adjacent to, not inside, the kill-switch scope.
- Also in scope: the iframe seam. `packages/theme-engine/.../composition-engine.tsx:115-118` renders
  `<iframe sandbox="allow-forms allow-popups allow-scripts allow-same-origin">` — `allow-scripts` +
  `allow-same-origin` together is an **escapable sandbox** on the buyer-facing storefront.
- Governing rules: Constitution **ART-16** (`:245`), **ART-22** (`:289`), Constitution §*"Not a
  third-party app / extension platform now"* (`:123`), `AGENTS.md:185` **NEVER-R3**, `AGENTS.md:364`
  **AGENT-R13** (*"MUST leave the seam empty and MUST NOT fill it"*).

**Ordering, non-negotiable:**

1. **ARB reviews and approves the emergency branch** `6c3e17df` and its rollout.
2. **Two Next.js builds run before the UI half ships** (FBR-04):
   `pnpm --filter @letbuyy/merchant-control-plane build` and
   `pnpm --filter @letbuyy/platform-console build` — the latter is currently **exit 1** (§2.2), so
   workstream 4 is blocked behind that fix. The failing file is
   `apps/platform-console/src/app/(dashboard)/developers/page.tsx` — **the same surface the kill switch
   guards**.
3. **A human with provider access confirms the live values** of `FEATURE_APP_PLATFORM`,
   `FEATURE_EXTENSIONS`, `FEATURE_GRAPHQL`, `FEATURE_LIQUID` in staging and production (FBR-05).
   **Names only in any written record — never values.** A deployed positive override silently re-opens
   the surface.
4. **Then** the gate deploys. **Then** removal proceeds under ARB.

**Forbidden alternatives**

- **Do not repair the individual app-store endpoints.** FBR-02's three unauthenticated service-role
  write paths (`/v1/app-store/discovery/events`, `/telemetry/events`, `/growth/requests`) must **not**
  be fixed one by one — investing in a frozen seam deepens the ART-22 breach (AGENT-R13). Ship the
  gate; they 404 behind it.
- **Do not** merge the emergency branch into `codex/web-v1-integration` to "simplify". It is
  deliberately a separate ARB-governed review path, and H8 confirms the separation holds today.
- **Do not** treat the kill switch as the removal. It is one env var away from being undone.
- **Do not** delete `app_*` tables in the same change as the code. Data removal is its own ARB decision
  with its own rollback.

**Required tests**

- The **59 existing proving tests** on the emergency branch, re-run, plus the falsification pass that
  proves they fail when the gate is absent (doc 29 §11). A control that cannot be shown to fail is not
  proven.
- **(NEW)** post-removal route enumeration: all 83 previously-enumerated routes return **404**, asserted
  from `appStoreRouter.routes` + `appApiRouter.routes` being absent, not from a flag.
- **(NEW)** storefront composition test: `GET /v1/storefront/{subdomain}` returns **no** `app_blocks`
  and renders **no** third-party iframe.
- **(NEW)** `services/mobile-bff` `ALLOWED_PREFIXES` no longer contains `/v1/app-store` or `/v1/app`.
- **(NEW)** `apps/merchant-control-plane/public/` contains no App Bridge SDK or demo host page — and,
  per FBR-45, **a validator that fails on `public/__*` scratch files** (a developer harness
  `public/__g3.html` was rejected from the Wave 0 port; the two *real* App Bridge assets in that
  directory are still shipped).

**Merge gate** — universal (§2.4) plus: recorded **ARB approval**; both Next builds green;
`web-v1-scope-perimeter-validator` exit 0 — the registry baselines this surface with
`expectedRemoval: true`, so removal emits an informational note rather than a hard failure, **and the
baseline must be tightened in the same change** (the ratchet only shrinks, doc 21 §6);
`marketplace-single-source-validator`, `no-reserved-service-activation-validator`,
`settings-apps-dead-twin-validator`, `dead-residue-validator` at exit 0.

**Rollback requirement** — **Two-stage, and this must be explicit.** The *gate* rolls back by env var
(that is its weakness and its rollback). The *removal* does **not**: once ~9,566 lines and the `app_*`
tables are gone, rollback is a revert commit plus a data restore. **Therefore the gate must be deployed
and observed stable in production for a stated soak period before removal begins**, and the removal PR
must state the revert SHA and the data-restore procedure. Do not conflate the two rollbacks.

---

## 7. Workstream 5 — Storefront host routing

| | |
|---|---|
| **Proposed branch** | `codex/w1-storefront-host-routing` |
| **Dependencies** | **1, 2, 4.** Host resolution decides *which tenant* a request belongs to (needs 2) and, until 4 lands, a resolved storefront can still compose third-party `app_blocks` into the page. |

**Canonical files / systems**

- `apps/storefront-runtime/src/proxy.ts` — host routing for `{store}.letbuyy.com` and custom domains.
- `apps/storefront-runtime/src/app/store/[subdomain]/` — the rendered tree (`account`, `cart`,
  `checkout`, `collections`, `customers`, `orders`, `privacy`, `product`, `products`, `returns`,
  `shipping`, `shop`, `terms`, `blog`, `[...path]`) — all verified present.
- `services/api-gateway/src/routes/storefront/public-routes.ts` — the resolution endpoint.
- `services/api-gateway/src/routes/custom-domains.ts` — **carries the open `route-ownership` FAIL at
  `:483`** (§2.2). Closing it is in scope here or in workstream 2; name the owner and do it once.
- `services/api-gateway/src/routes/domains.ts`, `.../internal-custom-domain-reconcile.ts`.
- Enforcement: `scripts/validators/storefront-access-gate-validator.mjs`,
  `storefront-seo-access-validator.mjs`, `custom-domain-target-validator.mjs` (**currently FAIL** —
  *"merchant UI must read public target env"*), `merchant-domains-settings-validator.mjs`
  (**currently FAIL** — 14 required strings missing), `reserved-subdomain-single-source-validator.mjs`,
  `platform-domain-literal-validator.mjs`, `cookie-realm-validator.mjs`.

**Forbidden alternatives**

- **Do not fail open on an unresolved host.** Wave 0 commit `f8b04288` made
  `apps/storefront-runtime` fail **closed** and gated `/preview`, which previously served a full render
  of **any** store — password-gated, preview-only, offline, or unpublished — to any anonymous caller.
  **That fix currently has no executed test** (FBR-39). Writing it is a requirement of this workstream,
  not an optional extra.
- **Do not** resolve a handle by a non-unique column. Commit `c331f929` closed cross-tenant handle
  resolution: `subdomain` and `store_name` are unique only **within their own column**, so one handle
  could resolve to two tenants and return an arbitrary one. Any new lookup must be provably unique.
- **Do not** hardcode a platform domain literal — `platform-domain-literal-validator.mjs` exists.
  Wave 0 commit `fcf3ca1f` already derives identity-platform's storefront hosts from the canonical
  domain (DEPLOY-R3); follow that pattern.
- **Do not** ship without `INTERNAL_API_SECRET` and `LETBUYY_API_BASE_URL` present. FBR-40: with the
  fail-closed change, a storefront deployed without both serves **503 for every store**. Previously it
  failed open and *appeared* to work. **Names only, never values.**
- **Do not** enable custom domains as a V1 capability by accident — `custom_domains` is registered
  `WEB_V1_DEFERRED` in `config/governance/web-v1-scope-registry.json`, and is one of the **9 already-live
  unflagged deferred capabilities** (FBR-29). Scope decision is ARB's.

**Required tests**

- **(NEW, and this is the debt from Wave 0)** an executed test for the **fail-closed** path: unresolved
  host → 503/404, never a render.
- **(NEW)** two-tenants-one-handle: a handle colliding across `subdomain` and `store_name` must resolve
  deterministically or refuse — never return an arbitrary tenant.
- **(NEW)** `/preview` requires its token; anonymous callers get nothing for unpublished, offline or
  password-gated stores.
- **(NEW)** a deploy-time presence assertion for `INTERNAL_API_SECRET` and `LETBUYY_API_BASE_URL`.
- `tests/e2e/customer-journey.spec.ts` (exists) — host-routing leg.

**Merge gate** — universal (§2.4) plus the seven validators above at exit 0, with
`custom-domain-target-validator` and `merchant-domains-settings-validator` moving **FAIL → PASS**;
`pnpm --filter @letbuyy/storefront-runtime build` exit 0.

**Rollback requirement** — **DNS/host-map rollback must be independent of code rollback.** A host
mapping change must be revertible without a redeploy. State which layer (Cloudflare route, Vercel
domain, DB `site_domains` row) owns the revert, and rehearse it. Fail-closed behaviour must be the
*default* on rollback, not the exception.

---

## 8. Workstream 6 — Store creation and publication E2E

| | |
|---|---|
| **Proposed branch** | `codex/w1-store-creation-publication` |
| **Dependencies** | **1, 2, 5.** A store is created under a merchant identity, isolated by RLS, and is only meaningful once its host resolves. |

**Canonical files / systems**

- `services/api-gateway/src/routes/onboarding.ts`, `.../stores.ts`, `.../stores-localization.ts`,
  `.../kyc.ts`.
- `apps/identity-platform/src/app/api/auth/create-store/route.ts` — **note: `stash@{0}` holds a
  divergent `+12/−6` version** (doc 30 §2.1a). Adjudicate before touching.
- `apps/identity-platform/src/app/onboarding/`, `apps/identity-platform/src/app/select/` — **both have
  divergent stash versions** (`+144/−659` and `+33/−48`). Same caution.
- `apps/merchant-control-plane/` — the merchant surface.
- `sites` is the tenant root; `site_id` is the tenancy key everywhere. Commit `c331f929` writes
  `sites.published`.
- Enforcement: `scripts/validators/legacy-site-type-validator.mjs` (**currently FAIL** — marketing
  create page exposes portfolio/resume outside the legacy flag), `operational-lifecycle-validator.mjs`,
  `workspace-lifecycle-validator.mjs`, `shell-single-validator.mjs`.

**Forbidden alternatives**

- **Do not** create a store from client-supplied `site_id`. The server assigns tenancy.
- **Do not** add a new app-local Next API route for this. Root `CLAUDE.md`: new app API routes are
  **gateway proxies** (route-ownership lockstep) and **never write the DB locally**. This is already
  being violated at scale — `letbuyy-boundaries/no-new-next-api-route` fires **68 times** in
  `merchant-control-plane`, and `domain-boundary-validator` reports the inventory drifted from an
  expected 129 to **188** (§2.2). Do not add the 189th.
- **Do not** ship a publication flow that leaves a store reachable before publication — that is the
  `/preview` defect (workstream 5) in a different guise.
- **Do not** re-expose portfolio/resume site types outside the legacy flag (the current
  `legacy-site-type-validator` failure).

**Required tests**

- `tests/e2e/merchant-journey.spec.ts` (exists) — signup → create store → publish, executed.
- **(NEW)** an unpublished store is not renderable and not indexable
  (`storefront-seo-access-validator` cross-check).
- **(NEW)** two merchants creating stores concurrently cannot collide on subdomain.
- **(NEW)** a store created by merchant A is invisible to merchant B at every layer (route, RPC, RLS).

**Merge gate** — universal (§2.4) plus `legacy-site-type-validator` **FAIL → PASS**,
`operational-lifecycle-validator`, `workspace-lifecycle-validator` exit 0, and **no increase** in the
app-local API route inventory reported by `domain-boundary-validator`.

**Rollback requirement** — Publication must be a **reversible data state**, not a deploy state:
unpublishing a store must be a single, audited write with no code change. Store *creation* rollback must
state what happens to a partially-created tenant (orphan `sites` row policy).

---

## 9. Workstream 7 — Catalog and inventory vertical slice

| | |
|---|---|
| **Proposed branch** | `codex/w1-catalog-inventory` |
| **Dependencies** | **2, 6.** Products belong to a store and are isolated by RLS. |

**Canonical files / systems**

- `services/api-gateway/src/routes/products.ts`, `.../categories.ts`, `.../inventory.ts`,
  `.../media.ts`, `.../metafields.ts`, `.../upload.ts`, `.../resource-search.ts`.
- `services/queue-workers/src/inventory-reservations.ts` — reservation lifecycle.
- `apps/merchant-control-plane/` product/inventory surfaces;
  `apps/storefront-runtime/src/app/store/[subdomain]/product/`, `.../products/`, `.../shop/`.
- Scope reference: `config/governance/web-v1-scope-registry.json` (**on the integration branch only**;
  it is not present at the baseline) registers **single-variant products** and **inventory and
  reservations** as `WEB_V1_REQUIRED`.

**Forbidden alternatives**

- **Do not** build multi-variant products, collections, or smart collections into V1 without an ARB
  scope decision. All three are `WEB_V1_DEFERRED` **and all three are already live and unflagged**
  (FBR-29): the merchant variant editor, the storefront variant selector, collections merchant UI + API
  + storefront page, and smart-collections UI + gateway mount are in the 32-signal
  known-activation baseline. **The repository has zero feature-flag mechanism in either web app** —
  `grep` for `featureFlag|FEATURE_FLAG|isFeatureEnabled|useFeatureFlag|process.env.NEXT_PUBLIC_FEATURE`
  across `apps/merchant-control-plane/src` and `apps/storefront-runtime/src` returns **0 matches**. So
  "we'll flag it later" is not currently an available option; ARB must decide **in scope** or **build
  the gate**.
- **Do not** build multi-location inventory, transfers, purchase orders or suppliers — five deferred
  sub-features, all currently live and unflagged.
- **Do not** decrement stock outside the reservation path. Inventory is a money-adjacent projection;
  the same single-writer discipline as workstream 3 applies.
- **Do not** return raw provider errors — `raw-error-message-validator` already fails on
  `services/api-gateway/src/routes/resource-search.ts` returning raw `error.message` for `SEARCH_ERROR`.
  Fix it here.

**Required tests**

- **(NEW)** oversell test: concurrent reservations against the last unit produce exactly one success.
- **(NEW)** reservation expiry releases stock exactly once.
- **(NEW)** a product created for tenant A never appears in tenant B's catalog, search, or media list.
- `tests/executable/**` inventory suites with the Postgres fixture up.

**Merge gate** — universal (§2.4) plus `raw-error-message-validator` **FAIL → PASS**,
`one-system-per-domain-validator`, `cms-slugify-validator` (**currently FAIL** — local slugify in the
merchant smart-collections page) and `date-format-validator` (**currently FAIL** — 3 files declaring
local date helpers) at exit 0, and `web-v1-scope-perimeter-validator` exit 0 with **no new activation**.

**Rollback requirement** — Catalog changes are data; the rollback is a **documented data-repair
procedure** plus a reverted deploy. Inventory ledger changes follow workstream 3's forward-only rule:
never "fix" stock by direct UPDATE.

---

## 10. Workstream 8 — Shipping, GST and coupons

| | |
|---|---|
| **Proposed branch** | `codex/w1-shipping-gst-coupons` |
| **Dependencies** | **3, 7.** These are the inputs to the server-authoritative total, so they must be correct before the total is computed in workstream 9. |

**Canonical files / systems**

- `services/api-gateway/src/routes/shipping.ts`, `.../shipping-tax.ts`, `.../shipping-labels.ts`,
  `.../tax.ts`, `.../coupons.ts`.
- `database/supabase/migrations/170_v1_shipping_rates_gst.sql` — shipping rates + GST, and it touches
  the canonical money RPCs (verified by grep).
- `shipping_rates`, GST invoice tables; invoices are **immutable** (root `CLAUDE.md`).
- `apps/storefront-runtime/src/app/store/[subdomain]/shipping/`.
- `tests/gst/gst-invoice.test.mjs` (exists), `tests/logistics/**`, `tests/localization/**`.
- Enforcement: `scripts/validators/inr-currency-format-validator.mjs`, `date-format-validator.mjs`.

**Forbidden alternatives**

- **Do not** compute GST anywhere but the server. India-first tax is server-computed; invoices are
  immutable once issued — no in-place correction, only a documented credit path.
- **Do not** apply a coupon on the client or trust a client-supplied discount. Discounts change the
  amount, so they are money and belong inside the RPC's computation.
- **Do not** format currency ad hoc. `formatInrCurrency` and `en-IN` dates only
  (`inr-currency-format-validator`, `date-format-validator`).
- **Do not** introduce multi-currency. It is `WEB_V1_DEFERRED` and is one of the two capabilities doc
  21 records as **correctly absent** — keep it that way.
- **Do not** let a coupon interact with the gift-card ledger by a second path. Gift cards are workstream
  3's projection.

**Required tests**

- `tests/gst/gst-invoice.test.mjs` — pass, and **extended** to assert immutability (a second issue for
  the same order is refused).
- **(NEW)** GST rounding table across representative slabs, asserted in **minor units** (`*_minor
  bigint`), never floats.
- **(NEW)** coupon stacking rules: the same coupon cannot be applied twice; an expired coupon is refused
  at the RPC, not only in the UI.
- **(NEW)** serviceability: an unserviceable pincode blocks checkout **before** payment, not after.

**Merge gate** — universal (§2.4) plus `inr-currency-format-validator` and `date-format-validator` at
exit 0, plus the GST suite green with the Postgres fixture up.

**Rollback requirement** — **Rate and tax configuration must be data-rollbackable without a deploy.**
Issued invoices are immutable and are **never** rolled back — the PR must state the credit-note path
that replaces rollback for anything already invoiced.

---

## 11. Workstream 9 — Cart and checkout

| | |
|---|---|
| **Proposed branch** | `codex/w1-cart-checkout` |
| **Dependencies** | **3, 7, 8.** Checkout composes the ledger writer, the catalog, and the shipping/GST/coupon inputs. |

**Canonical files / systems**

- `services/api-gateway/src/routes/storefront/cart-routes.ts`, `.../checkout.ts`,
  `.../storefront/checkout-payment-routes.ts`, `.../storefront/internal-payment-routes.ts`.
- `create_checkout_order` — **a named change-control hotspot** (root `CLAUDE.md`).
  `database/supabase/migrations/166_d6_checkout_handoff_inventory.sql` carries the handoff + inventory
  coupling.
- `apps/storefront-runtime/src/app/store/[subdomain]/cart/`, `.../checkout/`.
- `services/api-gateway/src/middleware/idempotency.ts` (see the stash caution in §5).
- `tests/launch/lb-checkout-hardening.test.mjs`, `tests/launch/lb-liquid-l8-cart.test.mjs` (both exist).

**Forbidden alternatives**

- **Do not** accept a client-computed total, tax, shipping or discount. The RPC computes from the DB.
  This is the single most likely shortcut in this workstream and it is the one that turns a bug into a
  money incident.
- **Do not** create the order outside `create_checkout_order`.
- **Do not** ship checkout while `services/api-gateway/src/extensions/app-functions-runtime.ts` is still
  present. FBR-31: it calls `WebAssembly.instantiate` on third-party modules and feeds
  `createAppFunctionCheckoutDecision`. `AGENTS.md:185` NEVER-R3 names *"checkout extensions /
  app-functions / Wasm runtime in the live path"* as MUST NOT BUILD. **Workstream 4 must remove it
  first** — that is why 4 precedes 9.
- **Do not** add checkout extensions of any kind. `FORBIDDEN_FROZEN` in the scope registry.
- **Do not** enable gift-card redemption at storefront checkout without an ARB scope decision — doc 21
  records it as **INACTIVE with the probe armed**; activating it trips the perimeter ratchet by design.

**Required tests**

- `tests/launch/lb-checkout-hardening.test.mjs` — pass.
- **(NEW)** server-authority test: a tampered client payload (lower price, zero shipping, injected
  discount) produces the **server's** total, and the mismatch is logged.
- **(NEW)** idempotent checkout: a double-submitted cart creates one order.
- **(NEW)** inventory handoff: order creation and reservation are atomic — a failed order leaves no
  reserved stock.
- `tests/e2e/customer-journey.spec.ts` — full cart→checkout leg, executed.

**Merge gate** — universal (§2.4) plus `canonical-ledger-only-validator`, `route-ownership-validator`,
`fail-closed-internal-routes-validator` at exit 0, **and** `pnpm graph:intel blast
"create_checkout_order"` attached to the PR. **ARB sign-off required** (money path).

**Rollback requirement** — **Checkout must be rollbackable to the previous deploy without stranding
in-flight carts.** The PR states the cart-schema compatibility window (old cart readable by new code and
vice versa) and the drain procedure for in-flight orders. If either is impossible, the deploy needs a
maintenance window, stated up front.

---

## 12. Workstream 10 — Razorpay and COD

| | |
|---|---|
| **Proposed branch** | `codex/w1-razorpay-cod` |
| **Dependencies** | **3, 9.** |

**Canonical files / systems**

- `services/api-gateway/src/routes/payments.ts`, `.../storefront/checkout-payment-routes.ts`,
  `.../cod-reconciliation.ts`, `.../order-risk.ts`.
- `services/webhook-service/` — HMAC-signed webhook ingestion.
- `confirm_order_payment_with_ledger` — the only confirmation writer.
- `services/queue-workers/src/money-ledger-reconciliation.ts`.
- Enforcement: `scripts/validators/single-source-crypto-validator.mjs`,
  `secret-topology-validator.mjs`, `committed-secret-placeholder-validator.mjs`,
  `environment-validator.mjs` (**currently FAIL** — secret-like values in two theme-engine **test
  fixtures**; verify they really are fixtures before "fixing" them).

**Forbidden alternatives**

- **Do not** verify a Razorpay signature anywhere but the server, and only with HMAC-SHA256 via
  `timingSafeEqualHex`. No `===` on a signature.
- **Do not** confirm payment from a client callback. The webhook + the RPC are the truth.
- **Do not** add a third PSP. `alternative PSPs` is `WEB_V1_DEFERRED`, **and FBR-30 proves Stripe is
  already wired into the live payment router** gated only by an unset `STRIPE_SECRET_KEY`. Whatever ARB
  decided in workstream 3 is binding here; this workstream may not re-open it.
- **Do not** implement a self-custody payout rail — `no-self-custody-rail-validator.mjs` enforces the
  `FORBIDDEN_FROZEN` classification.
- **Do not** log, echo or write any secret value. Env var **names** only in every artifact.

**Required tests**

- **(NEW)** signature verification: valid, tampered, replayed and absent signatures — four cases,
  asserted at the webhook boundary.
- **(NEW)** replay protection: the same webhook delivered twice produces one ledger effect (reuse
  `tests/replay/**`).
- **(NEW)** COD lifecycle: order → dispatch → collection → reconciliation, with the ledger balanced at
  every step.
- **(NEW)** a payment confirmed by webhook but not by client callback still completes; a client callback
  with no webhook does **not**.
- `tests/executable/**` payment suites, isolated Postgres.

**Merge gate** — universal (§2.4) plus `single-source-crypto-validator`, `secret-topology-validator`,
`committed-secret-placeholder-validator`, `canonical-ledger-only-validator` at exit 0, and
`environment-validator` **FAIL → PASS** (or a recorded, reviewed fixture exemption). **ARB sign-off
required.**

**Rollback requirement** — **PSP configuration rollback must be independent of code.** Webhook endpoint
and key rotation must be revertible at the provider without a redeploy, with a stated overlap window in
which both the old and new signing keys verify. The PR names who at the provider can execute the revert.

---

## 13. Workstream 11 — Orders and fulfilment

| | |
|---|---|
| **Proposed branch** | `codex/w1-orders-fulfilment` |
| **Dependencies** | **9, 10.** |

**Canonical files / systems**

- `services/api-gateway/src/routes/orders.ts`, `.../shipping-labels.ts`, `.../order-risk.ts`,
  `.../export.ts`.
- `orders` + `order_items` (`*_minor bigint` money).
- `apps/storefront-runtime/src/app/store/[subdomain]/orders/`;
  `apps/merchant-control-plane/` order management.
- `tests/launch/lb-liquid-l11-orders.test.mjs`, `tests/launch/lb-liquid-l12-tracking.test.mjs` (exist).
- Enforcement: `scripts/validators/operational-lifecycle-validator.mjs`,
  `single-writer-ownership-validator.mjs`.

**Forbidden alternatives**

- **Do not** mutate order money fields from a fulfilment path. Status transitions are not money
  mutations; if a transition changes an amount, it goes through an RPC.
- **Do not** invent status values. One state machine, one owner (`single-writer-ownership-validator`).
- **Do not** emit order events from more than one place — that is how order emails get sent twice
  (workstream 13's failure mode).
- **Do not** build WhatsApp/SMS/push notification into this workstream. `whatsapp_sms_push` is
  `WEB_V1_DEFERRED`; **WhatsApp is already live at the API layer with no feature gate and no nav entry**
  (doc 21), and the SMS router probe is INACTIVE and armed — creating
  `services/api-gateway/src/routes/sms.ts` was doc 21's own negative test and it **failed the ratchet by
  design**.

**Required tests**

- **(NEW)** state-machine test: every legal transition, and every illegal transition refused, asserted
  at the RPC/route boundary.
- **(NEW)** an order belonging to tenant A is not readable, exportable or fulfillable by tenant B.
- **(NEW)** tracking updates are idempotent under duplicate carrier callbacks.
- `tests/launch/lb-liquid-l11-orders.test.mjs`, `lb-liquid-l12-tracking.test.mjs` — pass.

**Merge gate** — universal (§2.4) plus `operational-lifecycle-validator`,
`single-writer-ownership-validator`, `canonical-ledger-only-validator` at exit 0.

**Rollback requirement** — Order state is customer-visible; a rollback that moves orders backwards is
worse than the bug. The PR states the **forward-fix** procedure and, if a status enum changes, ships a
tested rollback migration that is safe with orders in every state.

---

## 14. Workstream 12 — Refunds

| | |
|---|---|
| **Proposed branch** | `codex/w1-refunds` |
| **Dependencies** | **3, 10, 11.** |

**Canonical files / systems**

- `complete_order_refund`, `restore_gift_card_on_refund` — the only refund writers.
- `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql`,
  `174_v1_gift_card_refund_restore.sql` (verified by grep).
- `services/api-gateway/src/routes/returns.ts`, `.../payments.ts`, `.../payouts.ts`,
  `.../settlements.ts`, `.../wallet.ts`, `.../gift-cards.ts`.
- `apps/storefront-runtime/src/app/store/[subdomain]/returns/`.
- Step-up (HMAC) gates refunds and payouts — see workstream 1.
- `payment_transactions` / `refunds` / `payouts` = the canonical ledger.

**Forbidden alternatives**

- **Do not** refund without step-up. Root `CLAUDE.md` states step-up gates refunds and payouts; the
  step-up test is a workstream 1 deliverable precisely so this workstream can rely on it.
- **Do not** issue a refund larger than the captured amount, or a second refund for the same
  `idempotency_key`.
- **Do not** restore a gift card by incrementing a balance column. `restore_gift_card_on_refund` writes
  a **ledger entry**; the balance is a projection.
- **Do not** refund through a provider API without recording the ledger effect in the same RPC.
- **Do not** allow a partial-refund path that bypasses the GST/invoice credit-note rule from
  workstream 8.

**Required tests**

- **(NEW)** over-refund refused (single and cumulative partial refunds).
- **(NEW)** refund idempotency: same key twice → one ledger effect, one provider call.
- **(NEW)** gift-card restore projection: issue → redeem → refund restores the projected balance
  exactly, with `>= 0` never violated.
- **(NEW)** a refund without step-up is refused at the route **and** at the RPC (defence in depth).
- `tests/executable/**` refund suites, isolated Postgres.

**Merge gate** — universal (§2.4) plus `canonical-ledger-only-validator`,
`single-writer-ownership-validator`, `stepup-crypto-validator`, `commission-bps-zero-validator` at exit
0. **ARB sign-off required.**

**Rollback requirement** — **Refunds are irreversible in the real world.** There is no rollback for a
refund that has left the PSP. The rollback requirement is therefore a **kill switch on the refund route**
(deployable, env-controlled, fail-closed) plus a documented manual reconciliation procedure. The PR must
state both, and must state explicitly that the ledger is forward-only.

---

## 15. Workstream 13 — Transactional email

| | |
|---|---|
| **Proposed branch** | `codex/w1-transactional-email` |
| **Dependencies** | **6, 11, 12.** Email is triggered by lifecycle events; wiring it before the events are stable produces duplicate or wrong sends. |

**Canonical files / systems**

- `services/api-gateway/src/routes/email.ts`, `.../notifications.ts`.
- `services/api-gateway/src/lib/order-confirmation-email.ts`, `.../gift-card-email.ts`,
  `.../founding-merchant-email.ts`, `.../contact-request-email.ts`.
- `packages/notification-core/src/index.ts`.
- `services/queue-workers/` — async dispatch; `services/webhook-service/` — provider callbacks.
- Provider: Resend (`RESEND_API_KEY` — **name only**).

**Forbidden alternatives**

- **Do not** send email synchronously from a money RPC or a checkout request path. A failed send must
  never fail an order.
- **Do not** send from more than one place per event. One emitter per lifecycle event
  (`one-system-per-domain-validator`).
- **Do not** send WhatsApp/SMS/push — `WEB_V1_DEFERRED` (see workstream 11).
- **Do not** put personal data in a URL/query string, and do not embed a bearer token in an email link.
- **Do not** hardcode a platform domain in a template — `platform-domain-literal-validator.mjs`.

**Required tests**

- **(NEW)** exactly-once send per lifecycle event under duplicate queue delivery.
- **(NEW)** a send failure is retried and never rolls back or blocks the originating transaction.
- **(NEW)** tenant-correct branding and reply-to: tenant A's order email never carries tenant B's
  identity.
- **(NEW)** every template renders with no unresolved placeholder, asserted across the full variable set.

**Merge gate** — universal (§2.4) plus `one-system-per-domain-validator`, `queue-topology-validator`,
`secret-topology-validator`, `platform-domain-literal-validator` at exit 0.

**Rollback requirement** — **A per-template and per-event kill switch, controllable without a deploy.**
Email is the one surface where a bad deploy is instantly and irreversibly customer-visible. Rollback is
"stop sending", and it must be one config change away.

---

## 16. Workstream 14 — Legal and account controls

| | |
|---|---|
| **Proposed branch** | `codex/w1-legal-account-controls` |
| **Dependencies** | **1, 2, 6, 13.** Account deletion/export touches every tenant table (2) and must notify (13). |

**Canonical files / systems**

- `apps/storefront-runtime/src/app/store/[subdomain]/account/`, `.../privacy/`, `.../terms/`,
  `.../customers/`; `apps/storefront-runtime/src/components/account/`.
- `apps/marketing-site/src/app/[locale]/legal/`.
- `services/api-gateway/src/routes/customers.ts`, `.../export.ts`, `.../security.ts`,
  `.../two-factor.ts`, `.../compliance` paths in `services/queue-workers/src/compliance.ts`.
- `store_customers` + `customer_credentials`.
- Enforcement: `scripts/validators/session-security-validator.mjs`, `cookie-realm-validator.mjs`,
  `date-format-validator.mjs`.

**Forbidden alternatives**

- **Do not** hard-delete money records to satisfy a deletion request. The canonical ledger is
  forward-only; deletion is **anonymisation of PII with the ledger intact**, and the legal text must say
  so.
- **Do not** implement export as a direct DB dump. It goes through the gateway, scoped by `site_id`.
- **Do not** cross the cookie realm — customer and merchant sessions are separate realms
  (`cookie-realm-validator`).
- **Do not** treat consent as implied. India-first: GSTIN capture, `en-IN` dates, explicit consent.
- **Do not** write legal copy that describes behaviour the code does not implement. Every claim in the
  privacy page must be traceable to a code path in this workstream.

**Required tests**

- **(NEW)** deletion: PII anonymised, ledger rows retained and still balanced, and the customer can no
  longer authenticate.
- **(NEW)** export returns only the requesting customer's data, scoped by `site_id`, with a
  cross-tenant negative case.
- **(NEW)** consent state is persisted and honoured on the next session.
- **(NEW)** every legal page renders for every store without a platform-domain literal.

**Merge gate** — universal (§2.4) plus `session-security-validator`, `cookie-realm-validator`,
`no-blanket-service-role-validator`, `date-format-validator` at exit 0. **Legal review recorded in the
PR** — this is the one workstream where a non-engineering approval is a merge condition.

**Rollback requirement** — **Deletion is irreversible: it has no rollback and the PR must say so
in those words.** The rollback requirement is therefore a **confirmation + delay window** (a queued
deletion that a customer can cancel) plus a kill switch on the deletion route. Export rollback is
"revoke the link".

---

## 17. Workstream 15 — Monitoring and deployment

| | |
|---|---|
| **Proposed branch** | `codex/w1-monitoring-deployment` |
| **Dependencies** | **1–14 merged.** You cannot certify a deployment pipeline for capabilities that are still changing. **Except:** the §2.1 human git operations are a *prerequisite for Wave 1 entry*, not for this workstream — DEPLOY-R1 must already be closed before workstream 1 opened. |

**Canonical files / systems**

- `.github/workflows/ci.yml` — repaired on `codex/w0-ci-coverage` to trigger on `stepup/main` and
  `codex/web-v1-integration` for both `pull_request` and `push`; `develop` **deliberately retained**
  (removing a check is the weakening direction under ART-02 / R-18).
- `.github/workflows/architecture-governance.yml` — repaired: 17 gate steps now carry `id` +
  `continue-on-error`, with a final `gate-aggregate` step (`if: always()`, reads `.outcome` not
  `.conclusion`, itself **not** `continue-on-error`) that exits 1 on any non-success **including
  skipped/missing**.
- `.github/workflows/production-deploy.yml`, `staging-deploy.yml`, `staging-runtime-deployment.yml`,
  `production-rollout.yml`, `live-production-certification.yml`, `branch-lag-monitor.yml`,
  `environment-lifecycle.yml`.
- `scripts/validators/workflow-trigger-coverage-validator.mjs` (**integration branch only** — not
  present at the baseline) + `tests/ci/workflow-trigger-coverage.test.mjs`. Last recorded run: exit 0,
  *"16 workflows parsed; 4 gated branches and 8 deploy lanes checked"*.
- `scripts/validators/deployment-safety-validator.mjs`, `deployment-lineage-validator.mjs`,
  `deploy-matrix-topology-validator.mjs`, `production-safety-validator.mjs`,
  `production-readiness-validator.mjs`, `cloudflare-topology-validator.mjs`,
  `cloudflare-binding-validator.mjs`, `cloudflare-environment-validator.mjs`,
  `env-isolation-validator.mjs`, `environment-honesty-validator.mjs`, `provider-evidence-validator.mjs`,
  `provider-mode-badge-validator.mjs`, `queue-topology-validator.mjs`, `runtime-manifest-validator.mjs`,
  `runtime-topology-validator.mjs`, `secret-topology-validator.mjs`, `stale-artifact-validator.mjs`.
- `MERGE_RUNBOOK.md`, `.github/BRANCH_STRATEGY.md`.

**Forbidden alternatives**

- **Do not** add `codex/**` to any deploy workflow trigger. Wave 0 proved all 8 deploy lanes are
  unreachable from any `codex/*` branch and seeded a regression test (`NEG-2`) that catches exactly
  this.
- **Do not** remove an existing check to make CI green. `develop` was retained for this reason;
  removing a check is the weakening direction.
- **Do not** paper over `branch-lag-guard` by declaring it advisory without a recorded human decision.
  Three futures are documented (FBR-28): (a) fast-forward `main` per `MERGE_RUNBOOK.md` — the option
  DEPLOY-R1 actually mandates; (b) re-scope the check to the integration branch; (c) explicitly declare
  it advisory. **Doing nothing leaves a gate no branch can pass.**
- **Do not** leave `environment-lifecycle.yml`'s *"Seed staging data"* and *"Run staging E2E"* ungated
  (FBR-25). After the CI repair they now newly apply to integration-branch PRs — a PR can cause writes
  to shared staging without an explicit gate.
- **Do not** order any pipeline gate-then-build. The gate **removed 57 directories** including every
  workspace `node_modules` (FBR-16, doc 23 §5.3).
- **Do not** report a live metric that is not connected. Live values are real-source or **NOT CONNECTED
  + the exact env var name** — never fabricated (root `CLAUDE.md` live-data law;
  `environment-honesty-validator`, `provider-evidence-validator`, `provider-mode-badge-validator`).
- **Do not** run `local-stack-up.mjs` as-is (FBR-43): `:838` calls `supabase db reset`, `:646-721` seeds
  App Bridge tables (`app_developers`, `marketplace_apps`, `app_extensions`), and `:46-47` boots the
  ART-22-frozen `app-marketplace` and `theme-marketplace`. Rewrite it around `supabase start` on a
  fresh volume — doc 22 proved that path works (124/124 migrations, 438 tables, 997 RLS policies, all 6
  money RPCs present, all business tables 0 rows).
- **Do not** leave `local-stack-down.mjs` destroying evidence (FBR-42): `:48` stops with `--no-backup`,
  `:62` `rmSync` deletes config, migrations **and logs**, and `:18` passes `process.env` — i.e. the
  machine's **real `HOME`**, which is exactly where the production Supabase link lives.

**Required tests**

- `tests/ci/workflow-trigger-coverage.test.mjs` — pass, plus the `NEG-2` seeded regression.
- **(NEW)** a rollback rehearsal per runtime, executed against staging, with the measured time-to-revert
  recorded.
- **(NEW)** a deploy-time presence assertion for every required env var **name**
  (`INTERNAL_API_SECRET`, `LETBUYY_API_BASE_URL`, `CUSTOMER_SESSION_SECRET`,
  `LETBUYY_IDENTITY_PUBLIC_JWKS`, …) that fails the deploy rather than the request.
- **(NEW)** a smoke suite that fails on a bundling failure, not on a port being open. Doc 22 §5 is the
  cautionary tale: `workerd` bound `127.0.0.1:8787` while esbuild had failed with 17 errors and every
  request hung (`curl` exit 28, 0 bytes). **A port-open health check reported that as "up". It was not.**
- **(NEW)** `services/api-gateway` must be **bundled**, not merely typechecked, in CI. Its `build` script
  is `tsc --noEmit` — it emits nothing and bundles nothing, which is precisely how the missing
  `packages/shared-types/src/index.ts` barrel line reached the baseline.

**Merge gate** — universal (§2.4) plus all 17 deployment/provider validators above at exit 0,
`workflow-trigger-coverage-validator` exit 0, `branch-lag-guard-validator` exit 0 (which requires
DEPLOY-R1 closed), and **a recorded read of GitHub branch protection** reconciled against `ci.yml`
(FBR-23).

**Rollback requirement** — **This workstream's deliverable *is* rollback.** Every runtime must have a
one-command, rehearsed, time-measured revert, and the revert must not depend on the branch that broke.
Record the measured time-to-revert per runtime in the PR.

---

## 18. Workstream 16 — Full Web V1 E2E certification

| | |
|---|---|
| **Proposed branch** | `codex/w1-web-v1-certification` |
| **Dependencies** | **1–15, all merged and green.** This workstream adds no product code. |

**Canonical files / systems**

- `tests/e2e/customer-journey.spec.ts`, `tests/e2e/merchant-journey.spec.ts`, `tests/e2e/smoke/`,
  `tests/e2e/federation/`.
- `tests/launch/**` (21 suites, verified present).
- `config/governance/web-v1-scope-registry.json` — the 50-capability, 55-probe registry with the
  **32-signal known-activation baseline** (**integration branch only**).
- `docs/governance/web-v1-scope-perimeter-governance.md` (**integration branch only**).
- `scripts/validators/beta-readiness-validator.mjs`, `production-readiness-validator.mjs`,
  `whole-repo-end-state-validator.mjs`, `meta-no-theater-validator.mjs`,
  `foundation-antifabrication-gate.mjs`, `no-noop-test-script-validator.mjs`,
  `test-coverage-governance-validator.mjs`.

**Forbidden alternatives**

- **Do not** certify against a percentage copied from an earlier document. Re-measure. Every readiness
  figure in this package was re-measured by the agent that published it, and three earlier figures were
  refuted by doing so.
- **Do not** count a test that runs nothing. FBR-44's `tests/security/theme-tenant-isolation.test.mjs`
  reports **0 tests / exit 0** without a database. `no-noop-test-script-validator.mjs` exists for this
  class.
- **Do not** run `test:behavioral` without the Postgres fixture and report the number. It overstates
  breakage by exactly 19 suites (30 vs 11 of 1,608).
- **Do not** claim "the gate is green" while `services/lcis-api` and the 19 `packages/lcis-*` are
  unclassified — they are responsible for roughly a fifth of the 20 gate failures, and
  `typescript-governance-validator` alone contributes ~110 findings.
- **Do not** claim V1 scope is defined while the **9 already-live unflagged deferred capabilities**
  stand and the repository has **zero feature-flag mechanism** in either web app. The perimeter ratchet
  is honest about this: its baseline heading contains the literal string **`NOT A CLEAN STATE`**, and
  the validator hard-asserts that string is present so it cannot be edited away.
- **Do not** certify without a real `next build` per app. Root `CLAUDE.md` says the gate does not cover
  `next build`; doc 23 §8.3 turned that warning into evidence — `platform-console` fails a real build
  while passing all 110 validators **and** `turbo typecheck`.

**Required tests** — the whole suite, executed, with the fixture up:

```
pnpm install --frozen-lockfile
node scripts/validate-governance.mjs --lane=gate     # target: FAIL=0, BLOCKED=0
pnpm install --frozen-lockfile                       # the gate uninstalls the workspace
pnpm run typecheck
pnpm --filter @letbuyy/merchant-control-plane build   # per app, real next build
pnpm --filter @letbuyy/storefront-runtime  build
pnpm --filter @letbuyy/identity-platform   build
pnpm --filter @letbuyy/marketing-site      build
pnpm --filter @letbuyy/platform-console    build
# api-gateway: tsc --noEmit AND an esbuild bundle — the typecheck alone is not a build
pnpm run lint  (per app)  &&  pnpm run lint:css
pnpm run test:behavioral   # Postgres fixture UP
pnpm run test:contracts
tests/e2e customer + merchant journeys
node scripts/validators/web-v1-scope-perimeter-validator.mjs
```

**Merge gate** — everything above green, **plus**:

- the 2 BLOCKED validators (`cycle-budget-validator`, `route-ownership-validator` — both died on
  `Cannot find package 'typescript'`) resolved to a **real** status, not left BLOCKED;
- the missing migration `129_internal_os_executive_analytics_rollups.sql` resolved (FBR-48);
- `route-line-count-validator` green (`services/api-gateway/src/routes/themes.ts` is 1,870 lines against
  a 1,500 limit);
- `domain-boundary-validator` green — including the *"expected 129, found 188"* app-local API route
  inventory;
- the design-system ratchet **burned down per UI-R7** (10 %/release), **not** cleared with `--update`;
- the Liquid `renderLimit` decision recorded (FBR-38: raised **250 → 5,000**, a 20× relaxation of a
  documented DoS control, because it provably repaired 4 failing theme-engine tests — 1,722 pass / 4
  fail → 1,730 pass / 0 fail, 27 → 0 *"template render limit exceeded"*. The root cause is that LiquidJS
  `renderLimit` is a **wall-clock** budget and concurrent sections starved each other. The likely correct
  long-term fix is a **per-section** budget, not a larger global one. **Security sign-off required
  before the Liquid canary widens.**)

**Rollback requirement** — **Certification is a claim, and the rollback is retraction.** If any
post-certification measurement contradicts the certificate, the certificate is withdrawn and the
contradicting measurement is published in the same package. Wave 0's own record does exactly this three
times (see doc 27 §5); hold the same standard.

---

## 19. The dependency graph, stated once

```
                 [§2 entry blockers: DEPLOY-R1 · push · branch protection ·
                  platform-console build · 20 gate FAILs · 200 lint errors ·
                  stash + intent-to-add hazards]
                                  |
   1 identity sole-issuer ────────┼──────────────────────────────┐
        |                         |                              |
   2 tenant isolation / RLS ──────┤                              |
        |                         |                              |
   3 canonical money single-writer ┤                             |
        |                         |                              |
   4 App Bridge / extension shutdown  (ARB; emergency branch gates, does not remove)
        |                                                        |
   5 storefront host routing ───────────────────────────────────┘
        |
   6 store creation / publication E2E
        |
   7 catalog + inventory
        |
   8 shipping / GST / coupons
        |
   9 cart + checkout
        |
  10 Razorpay + COD
        |
  11 orders + fulfilment
        |
  12 refunds
        |
  13 transactional email
        |
  14 legal / account controls
        |
  15 monitoring + deployment
        |
  16 full Web V1 E2E certification
```

**Why 4 sits where it does.** It depends on 1–3 (gateway auth, `app_*` tenant tables, the checkout
decision path that `app-functions-runtime.ts` feeds) and it **blocks 9**, because NEVER-R3 forbids a
Wasm app-functions runtime in the live checkout path. Placing it later would mean certifying a checkout
that still contains the forbidden runtime.

**Why 5 depends on 4.** Until the gate ships, a resolved storefront still composes third-party
`app_blocks` into an escapable iframe sandbox on the buyer-facing page.

---

## 20. What this document deliberately did NOT do

- **No Wave 1 work was implemented.** No branch created, no file changed outside this deliverable, no
  code written, no test written, no commit, no stage, no push, no PR, no deploy.
- **No ARB decision was made or pre-empted.** Mobile (FBR-06), `services/lcis-api` (FBR-07), Stripe
  (FBR-30), the Wasm runtime (FBR-31), App Bridge removal (FBR-01/FBR-46), the theme-marketplace
  commits (FBR-37), the design-token override (FBR-12), the staging-seed gating (FBR-25) and the
  branch-lag future (FBR-28) are all recorded as human/ARB decisions and none is chosen here.
- **No stash command beyond `list`/`show`** — and this agent ran neither; the stash facts are cited from
  doc 30.
- **No `git add`, `git commit`, `git clean`, `git reset`, `git checkout --`, `git restore`, `chmod`,
  `git worktree remove/prune`, force-push or history rewrite** in any tree.
- **No `supabase`, `wrangler`, provider or deploy command** of any kind, from any directory.
- **No secret value appears anywhere.** Env var **names** only: `FEATURE_APP_PLATFORM`,
  `FEATURE_EXTENSIONS`, `FEATURE_GRAPHQL`, `FEATURE_LIQUID`, `STRIPE_SECRET_KEY`,
  `INTERNAL_API_SECRET`, `LETBUYY_API_BASE_URL`, `CUSTOMER_SESSION_SECRET`,
  `LETBUYY_IDENTITY_PUBLIC_JWKS`, `RESEND_API_KEY`. **No `.env*` file was opened.**

## 21. Safety attestation

Measured in `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` immediately **before** and
immediately **after** all work for this document:

| Property | Before | After |
|---|---|---|
| Branch | `stepup/main` | `stepup/main` |
| `HEAD` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| `git status --porcelain=v1 \| wc -l` | **6826** | **6826** |
| `git stash list \| wc -l` | **2** | **2** |

The only writes performed by this agent are the three files named in doc 27 §4.4, all inside
`docs/launch/web-v1-wave-0-2026-08-09/`.
