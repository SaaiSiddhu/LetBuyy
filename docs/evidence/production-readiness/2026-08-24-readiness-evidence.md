# Production-Readiness Evidence Snapshot — 2026-08-24

**This is an evidence snapshot, not a readiness certification.** It records what was
directly measured on this date, against this commit, and what was not. It contains
no GO/NO-GO verdict, no readiness percentage, and no score. Per the Constitution's
production-readiness law, "architecture diagrams, green builds, and file-presence
validators do not prove production readiness" — this document exists to separate
what is genuinely measured from what merely looks measured, not to declare the
platform ready or unready. A matrix that is mostly `NOT MEASURED` is the honest,
expected state of a pre-launch, ~100-1,000-merchant-envelope system; it is not a
finding of failure.

**Baseline commit:** `89274860` (HEAD at the time this phase began, 2026-08-24
11:33:35 +05:30). Re-check `git log -1` before trusting this document past today —
this snapshot is valid only for the commit it names, and this repository has
concurrent, actively-committing sessions (see `letbuyy-concurrent-sessions-one-checkout`
memory). At the time this document was authored, the working tree also carried
unrelated, uncommitted theme/Liquid changes from a concurrent session; none of
those files were touched, read for correctness, or included in this evidence.

**Update, same day (Phase I1):** Dimension 3 below was revised after Phase R1
by a follow-on phase that authored an adversarial identity red-team suite
(`services/api-gateway/src/__tests__/identity-redteam.test.ts`). Updated in
place rather than as a separate dated document, since it is a same-day
continuation of this exact snapshot's own stated gap for the same commit
lineage — see that section for the new baseline commit this update is valid
against. No other dimension was touched by Phase I1.

**Further update, same day (Phase I4):** Phase I3 closed IRT-4
(2026-08-24, migration 205) but did not revisit this document, leaving the
Dimension 3 text stale for one phase; Phase I4 then closed IRT-6 and
corrected both statuses in the same edit. See that section for what
changed and why neither closure moves this dimension's overall status —
the remaining gap (no live/deployed-system red-team) is unaffected by
either.

**Further update, same day (Phase O1):** Dimension 10 was revised to record
that `services/queue-workers` now emits four of the six catalog SLOs to
Analytics Engine every 6 hours. Explicitly still NOT MEASURED — see that
section for exactly why emission is not measurement, and why every emitted
SLO's stated alert policy is faster than the emission cadence can serve. No
other dimension was touched by Phase O1.

**Further update, same day (Phase R2):** Dimension 4 was revised after a new
executable-Postgres test
(`tests/executable/checkout-order-concurrency-postgres.test.mjs`) closed the
first of its two named gaps — a genuine concurrent-checkout inventory race
test against the real, unmodified `create_checkout_order` RPC — and, in the
process, found a real, reproducible idempotency-under-concurrency defect in
that same RPC (5/5 runs). Status stays **PARTIALLY MEASURED**: the second
named gap (end-to-end browser-driven checkout proof) is unaffected and
explicitly out of scope for this phase. Valid against commit `e43bc1a5` (HEAD
when the test was run; this repository has concurrent, actively-committing
sessions — see `letbuyy-concurrent-sessions-one-checkout` memory). No other
dimension was touched by Phase R2.

**Further update, same day (Phase R3):** Dimension 4's idempotency-under-
concurrency defect (found by Phase R2, reported not fixed) is now closed —
migration 206 adds a transaction-scoped advisory lock to
`create_checkout_order`, and Phase R2's own unmodified test (W1b) flips from
FAIL (5 orders from 1 idempotency key) to PASS (1 order), verified 5 times
plus a 20-concurrent-call pass, with the oversell, gift-card, and tenant-
scoping scenarios all still passing (no regression, no deadlock). Status
stays **PARTIALLY MEASURED**: the end-to-end browser-driven checkout proof
remains the only open gap. No other dimension was touched by Phase R3.

**Scope of this phase (R1):** measurement only. No application, money, identity,
tenancy, theme, or validator code was modified to produce this evidence. The
destructive `node scripts/validate-governance.mjs --lane=gate` was explicitly NOT
run this phase (see the Phase M4 human decision this phase inherits: the lane's
own runner does not short-circuit, so the individually-run validators below give
equivalent coverage without the lane's `rm -rf` of every `node_modules`, which
would have broken a concurrent session's in-progress build). Only
`--lane=gate --plan` (a safe, read-only inventory/drift check) was run — see
Dimension 11 and the closing verification section.

**Methodology note (TEST-R10):** several of the suites cited below assert against
reimplemented, standalone copies of algorithmic logic (e.g. retry backoff math,
event-reducer determinism) rather than by exercising the actual running service.
Each such case is called out explicitly in its own section — a validator or a
unit test proving an algorithm is correct in isolation is not the same evidence
as a live integration test, and this document does not blur that distinction.

---

## Dimension 1 — Payment integrity and reconciliation

**Status:** MEASURED (repository-level, not live-production)

**Evidence:**
- `pnpm test:foundation:wave0` → `tests/governance/foundation-wave0.test.mjs` (5
  tests) + `tests/executable/money-ledger-postgres.test.mjs` run against a real,
  isolated Postgres 16 container (`letbuyy-r1-evidence-pg`, spun up via the
  existing `LETBUYY_EXECUTABLE_PG_CONTAINER`/`LETBUYY_EXECUTABLE_PG_DATABASE`
  overrides so the shared `letbuyy-executable-pg` container used by other
  sessions was never touched). All passing.
- `pnpm test:foundation:wave1` → `packages/payments/test/payments.test.ts`,
  `packages/billing-core/test/billing-core.test.ts`,
  `services/api-gateway/src/__tests__/money.test.ts`, plus
  `tests/executable/foundation-wave1-money-postgres.test.mjs` (25 tests total)
  against the same isolated container. All passing, including real
  append-only-ledger and insufficient-balance rejection proofs (genuine
  Postgres constraint violations, not mocked assertions).
- Phase M1-M5 (this same execution ledger, commits `07494bcb` through
  `2cd8da35`) closed every non-canonical payment rail (Stripe/PayPal/Cashfree)
  from route registration, zod schemas, hand-written TS unions, and the money
  table CHECK constraints themselves, each with its own executable proof
  (`tests/executable/checkout-order-payment-method-guard-postgres.test.mjs`,
  `tests/executable/money-table-provider-guard-postgres.test.mjs`).

**What this proves:** the ledger's double-entry invariants, insufficient-balance
guards, and payment-rail allowlist are enforced by the database itself (CHECK
constraints, `NOT VALID` narrowing with historical-row preservation) and are
exercised by tests that hit a real Postgres, not a mock.

**What this does NOT prove:** live Razorpay reconciliation against a real
gateway account, live webhook delivery under production load, or that the
ledger stays consistent under concurrent production traffic. No live payment
was captured or refunded as part of this evidence.

**Gap:** no live-gateway reconciliation drill; no concurrent-load ledger test.

**Who closes it:** payment/money engineering owner, with a staging Razorpay
account and a scheduled reconciliation job proof (see `SKIP-RAZORPAYX-ENUM-PURGE`
for the one remaining non-canonical enum-value residue, already tracked).

---

## Dimension 2 — Cross-tenant isolation

**Status:** MEASURED (repository-level, not live-production)

**Evidence:**
- `pnpm test:foundation:wave2` → `tests/governance/foundation-wave2-tenant.test.ts`
  + `tests/executable/tenant-redteam-postgres.test.mjs` (5 tests) against the
  isolated container, plus `validate:tenant-isolation`. All passing.
- The tenant red-team suite runs RT-1 through RT-9 against a real Postgres role
  (`app_tenant`, confirmed non-`BYPASSRLS`) and observes genuine
  `permission denied` errors from Postgres itself when tenant context is
  missing, forged, or mismatched — not application-level assertions.

**What this proves:** RLS `ENABLE` + `FORCE` + the transaction-local tenant GUC
correctly produce zero rows and no mutation when tenant context is absent or
wrong, exercised against a real database engine.

**What this does NOT prove:** behavior under a deployed, production-shaped
connection pool/role configuration, or under concurrent cross-tenant request
load.

**Gap:** live/staging-shaped red-team run; already tracked, not duplicated here.

**Who closes it:** already an open row —
`SKIP-CAP-TENANT-REDTEAM-ADOPTION` (database/security engineering owner) —
this phase reuses it rather than creating a duplicate.

---

## Dimension 3 — Authentication forgery, replay, and escalation resistance

**Status:** PARTIALLY MEASURED (upgraded from Phase R1's PARTIALLY MEASURED —
still not MEASURED; see the specific coverage gaps below)

**Baseline commit for this update:** to be confirmed at commit time by Phase
I1's own worker report; re-check `git log -1` before trusting the specific
commit hash. The test evidence itself (pass counts, case IDs) is independent
of the exact hash and was directly observed by running the suite.

**Evidence:**
- `pnpm test:foundation:wave4` → `tests/auth/session-verifier.test.mjs` (9
  tests) + `tests/governance/foundation-wave4-session-security.test.ts` +
  `services/api-gateway/src/__tests__/identity-redteam.test.ts` (16 tests,
  new this update) run together via one `tsx --test` invocation (20 tests
  combined with the 4 pre-existing governance-file tests) +
  `tests/executable/foundation-wave4-session-postgres.test.mjs` (1 test) +
  `validate:session-security`. All 30 passing. The Postgres-touching test ran
  against a disposable, uniquely-named, zero-host-port container
  (`letbuyy-i1-evidence-pg`), never the shared `letbuyy-executable-pg`
  container other sessions use; teardown confirmed via `docker ps` before
  and after.
- The new `identity-redteam.test.ts` suite (`IRT-1` through `IRT-6`, 16
  cases with positive controls) directly and adversarially exercises
  `services/api-gateway/src/lib/identity-session-verifier.ts` — the merchant
  realm's ES256 verifier — for the first time; no prior test file in the
  repository referenced it.

**What this proves, newly, as of this update:**
- **Alg confusion (IRT-1):** the merchant verifier rejects `alg: none` and
  `alg: HS256`-signed-with-the-public-key-as-secret; a genuinely valid ES256
  token is accepted (positive control).
- **Cross-realm presentation (IRT-2):** a valid customer-realm token, and a
  valid operator/platform-console token, are both rejected by the merchant
  verifier; a valid merchant token is rejected by both the customer and the
  operator/platform verifiers. `realm`-correct-but-`token_use`-wrong (and the
  reverse) are both rejected by the merchant verifier.
- **The HS256 customer-realm deviation is now proven AND bounded (IRT-3 /
  W3), not merely restated:** (a) with `CUSTOMER_SESSION_SECRET` known, a
  valid customer session is genuinely mintable from scratch — the
  verification key is the forgery key for that realm, demonstrated, not
  assumed; (b) that same knowledge does **not** grant merchant-realm access —
  three independent attempts (raw forged token with merchant claims, and a
  tampered-and-resigned genuine customer session, both carrying `realm:
  merchant`/`token_use: merchant_session`) were all rejected by the merchant
  verifier, on algorithm grounds alone, before realm/token_use claims are
  even inspected. **This is the phase's designated STOP condition and it did
  NOT trigger** — the deviation's boundary held under direct test.
- **Expiry (IRT-5):** an expired merchant token, and one with `iat` skewed
  more than 60s into the future, are both rejected.

**Update (Phase I3, then I4 — both CLOSED after this document was first
written; corrected here rather than left stale):** at authoring time (Phase
I1/I2), this section listed IRT-4 and IRT-6 as undefended. Both are now
closed:
- **IRT-4 — merchant_session JWT replay — CLOSED, Phase I3** (migration
  `205_merchant_session_jti_consumption.sql`): an atomic, jti-keyed
  consumption check now runs at the token's one call site
  (`services/api-gateway/src/routes/auth.ts`, right after cryptographic
  validation succeeds), proven by
  `tests/executable/merchant-session-jti-consumption-postgres.test.mjs`
  against a real Postgres. The pure verifier itself is deliberately
  unchanged (Fork 1b) — `identity-redteam.test.ts`'s `IRT-4` case still
  documents that fact, correctly, by design.
- **IRT-6 — legacy customer verifier divergence — CLOSED, Phase I4**:
  `isCustomerSessionPayload` (`packages/auth-core/src/index.ts`) now reuses
  `normalizeCustomerSessionId` (the primary verifier's own guard) instead of
  a weaker duplicate check. Closed structurally, not by a production data
  audit: every live writer of the affected fields sources a Postgres `uuid`
  column, which cannot produce a value the tightened guard would reject —
  see `SKIPPED_HUMAN_DECISIONS.md`'s row for the full trace. Proven by 4 new
  cases in `packages/auth-core/test/auth-core.test.ts` plus a flipped
  `identity-redteam.test.ts` `IRT-6` case.

**What this still does NOT prove:** a red-team run against the live,
deployed system (this suite exercises the verifier functions directly with
synthetic, test-generated key material, not a running Worker); a full
enumeration of every conceivable forgery path (this is a targeted suite
covering the attack classes listed in the Phase I1 worker report's gap
matrix, not an exhaustive one); anything about the storefront password-gate
token mechanism (`storefront-access.ts`), which is a separate, out-of-scope
mechanism from the three auth realms. The HS256 customer-realm deviation
itself remains open — collapsing it onto the sole asymmetric issuer (ART-05
/ R-14) is unchanged and still requires the identity-platform engineering
owner; this update proves its current *blast radius is bounded*, not that
the deviation is closed.

**Gap:** no live/deployed-system red-team; the HS256 customer-realm
deviation itself is unchanged. IRT-4 and IRT-6, the two specific gaps
originally listed here, are both closed as of Phase I3/I4 (above) — this
dimension's remaining gap is narrower than it was at authoring time, but
still real: nothing here has ever exercised a running Worker.

**Who closes it:** identity-platform engineering owner — collapse the
customer realm onto the sole asymmetric issuer (ART-05/R-14 target state).
That is the one item on this list still requiring the identity-platform
owner; IRT-4 and IRT-6 required no further owner action once Phase I3/I4
landed. The legacy customer verifier itself will eventually retire alongside
the realm collapse, once its drain telemetry
(`SKIP-IDN-R2-ACCOUNTS-COOKIE-DRAIN` tracks the adjacent accounts-cookie
legacy drain, a related but distinct seam) reaches zero — that is a future
deletion, not a currently-open defect.

**Gap:** no forgery/replay/escalation red-team suite exists; the HS256
customer-realm deviation is a structural forgery-resistance gap, not merely
a style deviation.

**Who closes it:** identity-platform engineering owner — collapse the
customer realm onto the sole asymmetric issuer (ART-05/R-14 target state),
then author a red-team suite exercising forged/replayed/escalated tokens
across all three realms.

---

## Dimension 4 — Checkout correctness

**Status:** PARTIALLY MEASURED

**Evidence:**
- `pnpm test:foundation:wave7` includes
  `services/api-gateway/src/__tests__/checkout.test.ts` and `orders-v1.test.ts`
  (part of 27 total wave7 tests, alongside `whatsapp.test.ts`, the mobile-bff
  suite, and a Flutter Turnstile test). All passing.
- Phase M3-REVISED's draft-order-convert guard test
  (`services/api-gateway/src/__tests__/draft-order-payment-method-retirement.test.ts`)
  and its executable Postgres companion
  (`tests/executable/checkout-order-payment-method-guard-postgres.test.mjs`)
  directly exercise `create_checkout_order`'s guard logic.
- **(Phase R2, new)** `tests/executable/checkout-order-concurrency-postgres.test.mjs`
  runs the real, unmodified `create_checkout_order` (and its full dependency
  chain — `create_order_with_inventory_reservations`, `reserve_inventory`,
  `commit_inventory_reservation`) against a fresh database built by replaying
  every one of the 134 files in `database/supabase/migrations/` in order, on
  a uniquely-named, zero-host-port throwaway container (never the shared
  `letbuyy-executable-pg`). Four real-concurrency scenarios (separate `psql`
  processes via `Promise.allSettled`, not sequential calls): (a) two checkouts
  racing a stock=1 item, (b) five checkouts replaying one idempotency key
  against ample stock, (c) two checkouts racing a gift card's full balance,
  (d) one checkout called with no externally-established `app.site_id` GUC.
  Run 5 times; identical result every time (no flakiness).
- **(Phase R3, new)** `database/supabase/migrations/206_checkout_order_
  idempotency_advisory_lock.sql` redefines `create_checkout_order` with one
  added statement — a transaction-scoped
  `pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' ||
  p_idempotency_key, 0))`, taken before the existence check and before every
  row lock the function transitively takes. Phase R2's own test file, run
  unmodified, is the before/after proof: W1b flips from FAIL (5 orders from
  1 idempotency key) to PASS (1 order). Run 5 times post-fix (identical
  every time) plus one 20-concurrent-call pass (20/20 fulfilled, 1 order,
  1 session, 215ms, no deadlock).

**What this proves:** (a) the inventory-oversell race is already safe —
`reserve_inventory`'s `SELECT ... FOR UPDATE` plus an atomic conditional
`UPDATE` inside one transaction correctly serializes concurrent callers;
exactly one order was created, the loser's transaction (including its own
`orders` insert) rolled back cleanly on `INSUFFICIENT_INVENTORY`, and
committed inventory never exceeded the stock that existed. (c) The same
`FOR UPDATE` pattern on `gift_card_accounts` makes a concurrent full-balance
redemption race equally safe — exactly one redemption succeeded, the ledger
balanced to 0 (never negative, never double-spent). **(b) is now closed**:
`create_checkout_order`'s idempotency-under-concurrency defect (its dedup
check was a non-locking check-then-act; the only enforced uniqueness fired
only at the very end of the function, after order creation and inventory
commit had already happened — five concurrent calls with the same
idempotency key used to produce 5 separate `orders` rows) is fixed by the
Phase R3 advisory lock: the second-and-later callers now block until the
first commits, then see its committed `checkout_sessions` row and return
the existing order instead of racing into a second creation pipeline —
proven at 5x and 20x concurrency, with the `ON CONFLICT DO NOTHING` kept as
an unchanged second line of defence. (d) `create_checkout_order` succeeds
and mutates data even with no tenant GUC established by an external,
independently-authenticated caller — `create_order_with_inventory_reservations`
self-sets `app.site_id` from its own `p_store_id` argument when unset, then
checks it matches itself (a self-satisfying check, not an external
requirement). Registered, not fixed (`SKIP-CHECKOUT-INVENTORY-GUC-SELF-SET`
in `SKIPPED_HUMAN_DECISIONS.md`) — migration 166 is explicitly out of scope
for both Phase R2 and Phase R3.

**What this does NOT prove:** a real Razorpay round-trip, or GST/shipping/
discount computation edge cases beyond what `checkout.test.ts` enumerates.
No browser-driven or end-to-end checkout flow was run this phase (still out
of scope). All Phase R2/R3 calls ran as the Postgres superuser (matching
every sibling `tests/executable/*-postgres.test.mjs` convention), which
bypasses RLS entirely regardless of GUC state — the tenant-scoping finding
above is about the RPC's own explicit PL/pgSQL guard, not RLS policy
enforcement for a non-superuser caller. The advisory lock's behavior under
sustained production concurrency (thousands of distinct keys, lock-table
contention at scale) was not load-tested — only correctness under a bounded
concurrent-call count (5 and 20) was measured.

**Gap:** end-to-end browser-driven checkout proof. The idempotency-under-
concurrency defect is closed as of Phase R3.

**Who closes it:** commerce-platform engineering owner (browser-driven
proof remains open).

---

## Dimension 5 — Queue lag and retry behavior

**Status:** PARTIALLY MEASURED (algorithm-level only)

**Evidence:**
- `node --test tests/queues/queue-recovery.test.mjs` (run this phase, not part
  of any existing wave): 2/2 passing — "releases expired leases with
  deterministic retry time" and "dead-letters exhausted messages."

**What this proves:** the retry-backoff and dead-letter decision math is
internally correct for the cases tested.

**What this does NOT prove:** this test defines and asserts against a
**locally reimplemented copy** of the retry/backoff functions
(`queueRetryDelayMs`, `queueRetryAvailableAt`, `planQueueRecovery`) inside the
test file itself — it does not import or exercise `services/queue-workers`'
actual runtime code. No live queue depth, dispatch lag, or dead-letter rate
was measured against a running worker. `tests/operations/queue-storm-controls.test.mjs`
and `tests/operations/queue-bulk-cost.test.mjs` exist but were not run or
attributed to this dimension this phase (not yet reviewed for relevance;
flagged for a future pass rather than guessed at).

**Gap:** no suite exercises the actual `services/queue-workers` retry/backoff
implementation directly; no live queue-lag telemetry exists (see Dimension 10,
`outbox-event-processing-lag` SLO — defined this phase, unmeasured).

**Who closes it:** queue-workers engineering owner.

---

## Dimension 6 — Alert delivery to a real human

**Status:** NOT MEASURED (existing human seam, reused)

**Evidence:** none run this phase. `services/api-gateway/src/lib/runtime-alerting.ts`
and `services/queue-workers/src/incident-command.ts` emit alerts into a
dry-run/queue path locally, per the existing skip row.

**What this proves / does not prove:** unchanged from the existing row —
repository-side emission and dry-run routing exist; no live provider
delivery to a human has ever been demonstrated.

**Gap:** unchanged.

**Who closes it:** already an open row — `SKIP-CAP-ALERTING-END-TO-END`
(observability/platform operations owner). Reused, not duplicated.

---

## Dimension 7 — Backup, PITR, and a successful restore drill

**Status:** PARTIALLY MEASURED — plan-mode only

**Evidence:**
- `pnpm foundation:restore-drill:plan` → `node scripts/governance/foundation-restore-drill.mjs --plan`,
  run this phase. Output:
  ```
  LetBuyy restore drill plan
  - Codex mode: plan only; no production/shared DB action.
  - Execute locally with --execute and LETBUYY_RESTORE_DRILL_SOURCE_URL / LETBUYY_RESTORE_DRILL_TARGET_URL.
  - Human shared-env apply remains SKIP-DEPLOY with backup, verify, and rollback evidence.
  ```
- Execute-mode was investigated (the R1 prompt explicitly permits a genuinely
  private local execute-mode run, clearly labelled local-only). Blocked:
  `which pg_dump pg_restore` → exit 127 on the host (neither binary
  installed). `foundation-restore-drill.mjs` calls `pg_dump`/`pg_restore`
  directly via `spawnSync` (not through `docker exec`), and modifying the
  script is out of scope for this measurement-only phase. Confirmed as a
  supplementary data point, NOT a workaround: `docker run --rm
  postgres:16-alpine pg_dump --version` → `pg_dump (PostgreSQL) 16.14` — the
  binary exists inside the same Postgres image already used elsewhere in this
  repository's tooling, just not on the host `PATH`.

**What this proves:** the plan-mode path is safe-by-default and correctly
refuses to touch production/shared infrastructure without explicit
`--execute` + an allow-flag + explicit source/target URLs, and
`assertLocalTarget()` exists as a hard local-only guard.

**What this does NOT prove:** no restore was ever actually performed, locally
or otherwise. No RTO figure exists — local or production.

**Gap:** (a) host-level: `pg_dump`/`pg_restore` are not installed, so even a
local, low-stakes execute-mode drill cannot run today without either
installing the client tools on the host or adapting the script to shell out
via `docker exec` against the `postgres:16-alpine` image (a script change,
correctly out of scope this phase). (b) production-level: unchanged from the
existing row.

**Who closes it:** for (a), any engineer — install `postgresql-client`
(or equivalent) locally, or file a follow-up to adapt
`foundation-restore-drill.mjs` to invoke `pg_dump`/`pg_restore` via `docker
exec`. For (b), database/platform operations owner — already tracked as
`SKIP-W0-PITR-TIER`, reused, not duplicated.

---

## Dimension 8 — RTO and RPO

**Status:** NOT MEASURED

**Evidence:** none. Tied directly to Dimension 7: no restore was performed,
so no recovery-time or recovery-point figure — local or production — exists
to report.

**What this does NOT prove:** nothing can be claimed about actual recovery
time or data-loss window.

**Gap:** same as Dimension 7.

**Who closes it:** same as Dimension 7; RTO/RPO figures can only be produced
once a restore drill (local or production) actually completes.

---

## Dimension 9 — Load, spike, soak, and failure testing

**Status:** NOT MEASURED — by design, explicitly out of scope this phase

**Evidence:** none. No load-testing tooling exists in the canonical
repository. Stale `k6`-style scripts exist only under `.claude/worktrees/**`,
which the R1 prompt explicitly forbids restoring from (dead, unmaintained
path). `SKIP-D11-OPERATIONAL-THEATER-TABLE-PROBE` documents residual
`load_test_runs`/`chaos_experiment_runs` database tables as inert schema
residue from a prior era, not live capability — reinforcing that no load/
chaos capability exists today, repository-wide.

**What this does NOT prove:** nothing about behavior under load, spike, soak,
or induced-failure conditions is known.

**Gap:** no load/spike/soak/chaos tooling exists at all — this is a
tooling-acquisition gap, not a "run the existing tool" gap.

**Who closes it:** genuinely new seam — no existing `SKIP-*`/`CAP-*` row
covers "stand up load/spike/soak/failure-injection tooling and run it."
Added `SKIP-CAP-LOAD-SPIKE-SOAK-TESTING` this phase (see
`SKIPPED_HUMAN_DECISIONS.md`). Platform-SRE/infrastructure engineering owner.

---

## Dimension 10 — Defined SLOs and error budgets

**Status:** MOSTLY NOT MEASURED — **explicitly still not MEASURED after
Phase O1's emission wiring; see the update below for exactly why.**

**Update (Phase O1, 2026-08-24):** `services/queue-workers/src/slo-telemetry.ts`
now emits 4 of the 6 catalog SLOs to `RUNTIME_TELEMETRY` (Cloudflare
Analytics Engine) every 6 hours, on the existing `scheduled()` cron.
**This does not move the status to MEASURED and is not read as such here** —
reading Analytics Engine back out needs Cloudflare API credentials this
repository does not have, and every emitted SLO's `errorBudgetPolicy`
(1h burn-rate, 15m p95-breach, or "immediately") implies a detection window
the 6-hourly cron structurally cannot serve. What changed concretely: an
SLO with a real evidence table and zero telemetry is now an SLO with real
telemetry and zero reader — a narrower gap, not a closed one. See
`infrastructure/monitoring/slo-catalog.yaml`'s per-SLO comments for the
emission/cadence detail on each, and 11 genuine behavioral tests in
`services/queue-workers/test/slo-telemetry.test.mjs` proving each SLI
computes correctly, an empty window is never emitted as a coerced zero
(tested directly against the adapter's own `NaN`→`0` coercion, not just
inferred from this code), a query failure cannot take down a sibling
emission, and nothing is written to any commerce table.

**Evidence:**
- Before Phase R1: `infrastructure/monitoring/slo-catalog.yaml` defined
  exactly one SLO (`deployment-gate-success`).
- Phase R1 added five SLO **definitions** (not measurements) to the same
  file, each citing a real, schema-verified table it could theoretically be
  computed from: `checkout-order-creation-success` (`checkout_sessions`),
  `payment-capture-confirmation-success` (`payment_transactions`),
  `razorpay-webhook-signature-verification` (`payment_webhook_events.signature_valid`,
  confirmed a real column, written only after signature verification passes
  per Phase M5's evidence), `outbox-event-processing-lag`
  (`outbox_events.created_at`/`.dispatched_at`/`.status`, confirmed real
  column names directly against `database/supabase/migrations/000_baseline.sql`,
  correcting an earlier draft of this document that had guessed a
  non-existent `processed_at` column), and
  `tenant-isolation-zero-cross-tenant-rows` (a zero-tolerance invariant with
  no meaningful database evidence table — its only real evidence is the
  point-in-time RT-1–RT-9 suite, not a continuous signal).
- Phase O1 re-verified every cited column against the LATEST migration
  touching each table (not just baseline — `outbox_events` was re-checked
  against migrations 179 and 202 too), then wired emission for four of the
  five real-table SLOs. **Deliberately NOT emitted:** `deployment-gate-success`
  (found, this phase, to have zero writers anywhere in the codebase —
  emitting it would always show `sample_size=0`, which serves no one) and
  `tenant-isolation-zero-cross-tenant-rows` (unchanged reasoning from Phase
  R1 — not measurable via a database rollup at all).

**What this proves:** the named tables and columns are real, already
written by production code paths, and four of them now genuinely compute
and emit a real SLI value on a schedule — proven by real, executed tests
against a mocked Analytics Engine and Supabase REST layer, not asserted.

**What this does NOT prove:** that anything reads these values back out;
that any dashboard, alert, or on-call page exists (`SKIP-CAP-ALERTING-END-TO-END`
stays fully open, unaffected by this phase); that the emission cadence can
serve any of the stated error-budget policies — it structurally cannot, for
any of the four, not only the outbox one. "Now emits" is not "monitored."

**Gap:** the read/dashboard/alert side of all six SLOs remains entirely
open — Phase O1 closed the emission half only. The cadence mismatch (every
emitted SLO's alert policy implies a faster detection window than the
6-hourly cron can serve) is itself an unclosed gap, not a cosmetic detail —
a future phase adding the read side must also decide whether to accept
6-hourly-or-coarser alerting or add a second, faster-cadence emission path.

**Who closes it:** `SKIP-CAP-SLO-TELEMETRY-WIRING` (updated in place this
phase to partial closure — emission done, read/alert side explicitly still
open). Platform-SRE/observability engineering owner, for the Cloudflare API
credentials, the read/rollup/dashboard layer, and the alerting wiring
(`SKIP-CAP-ALERTING-END-TO-END`, unchanged and still fully open).

---

## Dimension 11 — Safe rollback

**Status:** PARTIALLY MEASURED

**Evidence:**
- Every migration authored across Phases M3-REVISED through M5 (`201` through
  `204`) ships a paired, faithful rollback file, each individually verified
  against the actual prior live constraint definition (not the stale
  baseline) — e.g. migration `204`'s rollback restores migration `142`'s real
  7-value provider array, confirmed via `diff`, not baseline's stale 5-value
  one.
- `rollback-integrity-validator` re-run clean after each such migration
  (part of the per-phase validator sweeps in this same execution ledger).
- `node scripts/validate-governance.mjs --lane=gate --plan` (safe, read-only
  inventory/drift mode) was run as this phase's closing verification step —
  see the Verification section below for its result.

**What this proves:** the paired-rollback authoring discipline and the
validator that checks for it are real and exercised repeatedly across five
prior phases.

**What this does NOT prove:** no rollback migration has ever actually been
*applied* against a live or staging database — only diffed and validated
statically. No application-level (non-database) rollback (e.g. a bad
deploy of `services/api-gateway`) was drilled this phase.

**Gap:** no live rollback-application drill, database or application-level.

**Who closes it:** database operator, for a staging-environment rollback
apply-and-verify drill; release engineering owner, for an application
rollback drill.

---

## Verification run this phase

`node scripts/validate-governance.mjs --lane=gate --plan` was run as required
(safe: inventory + drift check only, no destructive artifact cleanup). This
phase did not modify any validator or application code, so no change to the
validator sweep's outcome is expected or claimed from this phase's own edits.

---

## Closing statement

This document is an evidence snapshot for commit `89274860`, dated
2026-08-24. It supersedes no prior evidence document and is itself
superseded the moment a new commit lands. It certifies nothing. Where a
dimension above reads `MEASURED`, it means a specific, named, reproducible
command was run and its result recorded — not that the corresponding
production capability is proven safe at scale. Where a dimension reads
`NOT MEASURED`, that is the honest and, for a system at this stage, the
expected state — not a defect to be silently waived away in a future
document.
