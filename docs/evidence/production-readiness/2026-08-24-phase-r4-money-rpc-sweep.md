# Phase R4 — Money RPC Idempotency Sweep

**Scope:** measurement only. No RPC modified, no migration written. This document
records, per RPC, its classification, its pre-recorded prediction, and its
measured result — kept separate, per this phase's own explicit instruction that
a static classification is not a measurement.

**Baseline commit:** `4234f50d` (HEAD when Phase R4 began). This repository has
concurrent, actively-committing sessions — see `letbuyy-concurrent-sessions-one-checkout`
memory; re-check `git log -1` before trusting this document past today.

**Why this phase:** Phase R3 closed a real duplicate-order defect in
`create_checkout_order` — a non-locking check-then-act idempotency guard where
the only real uniqueness enforcement ran *after* the mutation it was meant to
prevent. `CLAUDE.md` names six canonical money RPCs, all requiring an
`idempotency_key`. This phase asks the same question of the remaining five:
`confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`,
`set_gift_card_status`, `restore_gift_card_on_refund`.

## Classification (against each RPC's latest redefinition, not baseline)

| RPC | Latest migration | Guard shape | Row locks taken | Classification |
|---|---|---|---|---|
| `confirm_order_payment_with_ledger` | `168_b1_b2_capture_refund_ledgering.sql` | No dedicated idempotency check in the outer function; relies on the nested `confirm_order_payment` call's `orders ... FOR UPDATE` (taken first) + its `payment_status='paid'` early-return check (after the lock) | `orders FOR UPDATE`, held for the whole transaction | **(b)** — safe |
| `complete_order_refund` | `168_b1_b2_capture_refund_ledgering.sql` | `refunds WHERE id=p_refund_id ... FOR UPDATE`, then `IF v_refund.status <> 'succeeded'` | `refunds FOR UPDATE` on the specific `p_refund_id` row, held for the whole transaction | **(b)** — safe |
| `issue_gift_card` | `173_v1_gift_card_issuance_lifecycle.sql` | Non-locking `SELECT ... WHERE metadata->>'issue_idempotency_key'=p_idempotency_key LIMIT 1` before the mutating `INSERT` | None on the idempotency-key path; the `INSERT`'s own `ON CONFLICT (site_id, code_hash)` guards a *different* column | **(a)** — the R3 defect shape |
| `set_gift_card_status` | `173_v1_gift_card_issuance_lifecycle.sql` | No `p_idempotency_key` parameter at all; `gift_card_accounts WHERE id=... FOR UPDATE` taken first | `gift_card_accounts FOR UPDATE` | **(b)** — money-safe (every ledger entry it writes carries `amount=0`); separately missing an idempotency-key parameter, a correctness gap, not a money gap |
| `restore_gift_card_on_refund` | `174_v1_gift_card_refund_restore.sql` | `gift_card_redemptions ... FOR UPDATE` cursor, then a per-row `INSERT ... ON CONFLICT (site_id, idempotency_key) DO NOTHING` on a deterministic key, then `IF FOUND` gates the follow-up `UPDATE` | `gift_card_redemptions FOR UPDATE`, per row | **(b)+(c)** — doubly safe, explicitly designed against this defect per its own migration comment |

The shared ledger-write primitive both `confirm_order_payment_with_ledger` and
`complete_order_refund` ultimately call — `post_ledger_transaction`
(`139_executable_foundation_ledger_core.sql`, never redefined since) — is
independently classification **(c)**: `INSERT INTO ledger_transactions (...)
ON CONFLICT (site_id, source_type, source_id, idempotency_key) DO NOTHING
RETURNING id`, with a `v_transaction_id IS NULL` early-return before any
`ledger_entries` row is written. This is the atomic-upsert shape — the
existence check and the mutation are the same statement, not two.

## Reachability

- `confirm_order_payment_with_ledger`: externally reachable (`payment-execution.adapter.ts`,
  called from `checkout.ts`/`payments.ts`/`storefront/{internal-payment,checkout-payment}-routes.ts`).
  `p_idempotency_key` is caller-supplied and passed through unchanged
  (`params.idempotencyKey`) — genuinely stable across a client or webhook retry.
- `complete_order_refund`: externally reachable (`order-execution.adapter.ts`,
  `routes/returns.ts`). `p_idempotency_key` is caller-supplied
  (`input.idempotency_key` / `body.idempotency_key`) — genuinely stable across a retry.
- `issue_gift_card`: reachable via `routes/gift-cards.ts`, **but** the only real
  caller generates a fresh random `p_code` (`crypto.getRandomValues`) **and** a
  fresh random `idempotencyKey` (`crypto.randomUUID()`) on every single call —
  including its own internal collision-retry loop. The RPC's idempotency-key
  mechanism is live, reachable source, but not exercised by a genuine same-key
  retry through this route today. Severity-lowering, stated precisely rather
  than glossed over.
- `set_gift_card_status`: reachable via `routes/gift-cards.ts` (merchant
  fraud-hold action). Not measured — see classification.
- `restore_gift_card_on_refund`: reachable via `routes/order-risk.ts`/`routes/orders.ts`
  (order cancel/refund transition). Not measured — see classification.

## Predictions (recorded before any test code was written)

1. `confirm_order_payment_with_ledger` — **SAFE**. Concurrent same-key calls
   serialize on the nested `orders FOR UPDATE`; no duplicate `payment_transactions`
   row, no duplicate ledger transaction.
2. `complete_order_refund` — **SAFE**. Concurrent same-`p_refund_id`-and-key
   calls serialize on `refunds FOR UPDATE`; exactly one `refund`-side ledger
   transaction, no double refund.
3. `issue_gift_card` — **DEFECTIVE, but not the exact R3 shape**. With a
   *stable* code and idempotency key replayed concurrently, the loser will not
   get the winner's card back gracefully — it will hit
   `ON CONFLICT (site_id, code_hash) DO NOTHING` (0 rows), then
   `RAISE EXCEPTION 'gift card code collision; retry issuance'`. An
   idempotency-*contract* violation (a retry should succeed identically, not
   error), not literal double-money-issuance in this exact shape.
4. `set_gift_card_status` — SAFE (money terms); not tested.
5. `restore_gift_card_on_refund` — SAFE; not tested.

## Prediction scorecard

| RPC | Predicted | Measured | Correct? |
|---|---|---|---|
| `confirm_order_payment_with_ledger` | SAFE | SAFE — 5/5 concurrent calls fulfilled every run, exactly 1 `payment_transactions` row, exactly 1 ledger transaction, ledger balance 0, in all 5 runs | ✔ |
| `complete_order_refund` | SAFE | SAFE — 5/5 concurrent calls fulfilled every run, exactly 1 succeeded refund, exactly 1 ledger transaction, ledger balance 0, in all 5 runs | ✔ |
| `issue_gift_card` | DEFECTIVE (contract, not money) | Confirmed — exactly 1 account/1 issued-ledger-row in every run (no money duplication), but at least one concurrent call was rejected with the exact predicted "code collision" error in every run | ✔ |
| `set_gift_card_status` | SAFE, not tested | Not tested (as predicted) | — |
| `restore_gift_card_on_refund` | SAFE, not tested | Not tested (as predicted) | — |

**All three testable predictions were correct.**

## Measured results — 5 runs each, individually

`tests/executable/money-rpc-idempotency-sweep-postgres.test.mjs`, real concurrency
(`Promise.allSettled` over separate `spawn`-ed `docker exec ... psql` OS processes,
not a sequential loop), against a dedicated throwaway container
(`letbuyy-r4-money-rpc-sweep-pg`, zero host port, never the shared
`letbuyy-executable-pg`).

| Run | W1a (`issue_gift_card`) fulfilled/rejected | accounts | issued-ledger-rows | W1b (`complete_order_refund`) | ledger balance | W1c (`confirm_order_payment_with_ledger`) | ledger balance |
|---|---|---|---|---|---|---|---|
| 1 | 1 / 4 | 1 | 1 | 5/5 fulfilled, 1 succeeded refund, 1 ledger tx | 0 | 5/5 fulfilled, 1 payment_tx, 1 ledger tx | 0 |
| 2 | 4 / 1 | 1 | 1 | 5/5 fulfilled, 1 succeeded refund, 1 ledger tx | 0 | 5/5 fulfilled, 1 payment_tx, 1 ledger tx | 0 |
| 3 | 1 / 4 | 1 | 1 | 5/5 fulfilled, 1 succeeded refund, 1 ledger tx | 0 | 5/5 fulfilled, 1 payment_tx, 1 ledger tx | 0 |
| 4 | 1 / 4 | 1 | 1 | 5/5 fulfilled, 1 succeeded refund, 1 ledger tx | 0 | 5/5 fulfilled, 1 payment_tx, 1 ledger tx | 0 |
| 5 | 1 / 4 | 1 | 1 | 5/5 fulfilled, 1 succeeded refund, 1 ledger tx | 0 | 5/5 fulfilled, 1 payment_tx, 1 ledger tx | 0 |

**Honest note on run 2's variance:** W1a's exact fulfilled/rejected split is
**not deterministic** — it depends on OS/connection scheduling of the 5 spawned
`docker exec` processes relative to when the winning caller's `INSERT` commits.
A caller whose own non-locking existence check happens to run *after* the
winner has already committed sees `FOUND` and returns the existing card
gracefully (no error); one that runs *before* races into the `INSERT` and, if
it loses, raises the collision error. This is reported plainly rather than
averaged away: the invariant that held in every run (exactly one account, exactly
one issued-ledger-row, no money duplication) is the money-safety finding; the
*exact* win/lose split is scheduling noise, not part of the finding. W1b and
W1c showed zero variance across all 5 runs.

## Severity, in money terms

- `confirm_order_payment_with_ledger`, `complete_order_refund`: **no finding** —
  measured safe under 5x concurrent same-key replay. No money-integrity risk
  identified this phase.
- `issue_gift_card`: **low severity, not a money-duplication defect as measured**.
  The concrete, measured failure mode is a same-key retry receiving an error
  instead of the expected idempotent success — a UX/contract defect, not funds
  leaving or duplicating. Money-duplication would require a caller that
  supplies a *stable* idempotency key **and** a *fresh* code per retry (an
  inconsistent combination); the one real caller today does the opposite of
  what would trigger the RPC-level path measured here (fresh key on every
  call, including its own retry loop) — this measurement targets the RPC's
  own contract, independent of today's one caller's specific behavior, per
  the phase's explicit framing ("does it have the same defect?").
- `set_gift_card_status`, `restore_gift_card_on_refund`: no finding, not tested.

## What this proves / does NOT prove

**Proves:** under bounded concurrent replay (5 simultaneous calls, one shared
idempotency key), `confirm_order_payment_with_ledger` and `complete_order_refund`
do not duplicate money at the ledger layer, and `issue_gift_card` does not
duplicate money either — but does violate the idempotency contract for losing
callers.

**Does NOT prove:** behavior under sustained production-scale concurrency
(thousands of distinct keys, lock contention at scale — not load-tested here,
matching the same caveat Phase R3 recorded for `create_checkout_order`);
`set_gift_card_status`/`restore_gift_card_on_refund` under any concurrency
(not tested, reasoning stated); the application-layer question of whether two
genuinely independent HTTP requests (not a repeated idempotency key, but two
separate client submissions each generating their own key) could produce two
valid gift cards — that is an application-layer key-sourcing question, out of
this phase's RPC-level scope.
