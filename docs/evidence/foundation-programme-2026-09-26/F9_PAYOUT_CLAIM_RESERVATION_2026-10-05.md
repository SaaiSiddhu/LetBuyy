# Phase 9 payout claim reservations — 5 October 2026

## Result

Migration 294 makes payout release claims reserve canonical merchant payable
while a provider transfer is in flight. Claims serialize per site. A pending
release stops consuming payable only after its canonical `payout` debit exists,
including the short interval before `payout_statements.release_ledger_transaction_id`
is linked.

## Reproduction and correction

Before migration 294, the owned-Postgres regression posted 19,600 paise of
canonical merchant payable, claimed a 9,600-paise statement into `processing`,
then successfully claimed a second 11,000-paise statement. Both statements
individually fit the unchanged ledger balance, although their combined release
exceeded it. The pre-fix assertion failed with “Missing expected exception.”

The corrected claim function takes a transaction-scoped advisory lock keyed to
the site before reading or updating a statement. It computes available payable
as the canonical ledger balance less processing/released statements that do not
yet have a canonical payout transaction. Exact replay returns the prior claim;
a changed key cannot reclaim a processing statement.

## Verification

The executable foundation-wave1 suite ran in a runner-created disposable
PostgreSQL 16 cluster (`ac9f43edc3d0`): 1 test passed, zero failed, zero skipped.
It verifies the overclaim denial, exact retry, changed-key denial, over-balance
denial, two simultaneous distinct claims with only one affordable result, and
the paired 294 rollback followed by the existing 160 rollback. The runner
removed its container, network and volumes. Two pre-fix owned runs reproduced
the missing denial (`a7474b64bb46`, `eebb8c1e246b`); both also cleaned all owned
resources.

This is local SQL behavior evidence only. No payout provider, provider sandbox,
hosted database, live payment or settlement was invoked. Phase 9 and F3.7 remain
open.

## Provider boundary retained

The current payout adapter sends `POST /v1/transfers` with a linked account and
statement amount, but no payment/order source identifier. Razorpay's Route
documentation describes that endpoint as Direct Transfers from account
balance, separately from payment-sourced split transfers, and notes that Direct
Transfers require provider activation. This evidence is a review constraint,
not proof that LetBuyy's account is enabled or that any hosted path has run.
Before actual release acceptance, verify the merchant-of-record and no-custody
contract against the exact account/provider approval and bind reconciliation
to provider transfer and settlement evidence.

- [Razorpay Route API reference](https://d6xcmfyh68wv8.cloudfront.net/docs/api/payments/route/)
- [Razorpay Route FAQs](https://d6xcmfyh68wv8.cloudfront.net/docs/payments/route/faqs/)
- [Razorpay Route transfer settlement lookup](https://razorpay.com/docs/api/payments/route/fetch-transfers-for-a-settlement/?preferred-country=IN)

## Next task

Continue the F3.7 source-to-ledger census for payout compatibility rows: define
the meaning and atomicity of pending wallet credits, bind each confirmed
obligation to its canonical source, and verify release/reversal/reconciliation
paths. Keep the provider boundary above explicit and do not claim Phase 9
acceptance from the claim reservation alone.
