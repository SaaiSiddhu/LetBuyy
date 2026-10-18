# F8 payment refund lifecycle and Gateway reconciliation — 4 October 2026

Working checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`,
HEAD `0862687a5008d604d0df23357b2eb511293139fa`. The checkout already contains
many unrelated user-owned modifications; this change was left unstaged and
uncommitted.

## Verified behavior

Razorpay refund creation is now treated as a request, not proof that money has
been returned. The adapter maps provider state `processed` to success, `failed`
to failure, and other responses to pending. Before calling Razorpay, the merchant
payment route durably reserves a refund attempt through an idempotent database
function. A pending provider response attaches its refund reference to that
attempt and completes the HTTP request with `202`, so replaying the merchant
request cannot create another provider refund.

Verified refund webhooks now cross from webhook-service into the internal
Gateway refund-event route. The Gateway resolves a provider payment through a
service-role-only function that returns the minimum payment identity needed;
all following payment-attempt reads include the owning `site_id`. One atomic
database function locks the payment and attempt, verifies the provider event,
amount, currency and attempt ownership, applies cumulative refund bounds, posts
the balanced reversal through the canonical settlement-ledger writer, and
updates the attempt and payment totals. `refund.created` stays pending;
`refund.failed` releases its reservation without a ledger entry;
`refund.processed` posts once and supports partial followed by full refunds.
Webhook retries return the already-recorded result, and the payment-refunded
outbox event uses the same per-refund idempotency key as synchronous provider
confirmation. The authenticated merchant route resolves payment ownership
inside a service-role-only database function before it exposes the payment to
the caller, then reserves before the provider side effect. Its provider fixture
journey returns `202` while the provider reports `created`, replays the same
request without another provider call, denies a different merchant, and
reconciles the later processed event through the real Gateway and database.
Concurrency coverage holds the first same-key request at the synthetic provider
boundary while its duplicate is denied, and races two different keys against
the same remaining balance; only one reservation and provider call succeed.

The non-Razorpay manual-confirmation path now reserves the supplied provider
refund reference and sends payment, attempt, balanced ledger posting and the
canonical `payment.refunded` outbox event through one service-role-only SQL
transaction. If finalization fails transiently, the route releases the HTTP
idempotency claim and returns `503`; retrying with the same key and provider
reference reclaims the existing attempt and safely reruns the finalizer, which
also handles a response lost after commit. The route has a synthetic UPI
owner/retry/replay/ledger/outbox test, but that new owned-database case has not
run yet because this workstation currently has no responding Docker daemon.

The shared payment event contract accepts only order payment states. A partial
refund therefore leaves the order state `paid`; the payment session separately
tracks cumulative refunded minor units until the order is fully refunded.
If a provider payment matches but its webhook cannot be tied to exactly one
reserved attempt, Gateway returns a retryable conflict instead of acknowledging
the event or handing it to the legacy order refund writer.

Razorpay distinguishes `refund.created`, `refund.processed` and `refund.failed`
in its [refund webhook payload reference](https://d6xcmfyh68wv8.cloudfront.net/docs/webhooks/payloads/refunds/).

## Verification

- Owned disposable Gateway/Postgres/PostgREST run after adding the manual UPI path: **9/9 passed**, zero skips or TODOs (run `520ada39e6f0`). In addition to the Razorpay cases above, it injects a transient finalizer error for a real authenticated UPI refund, confirms the durable attempt remains pending with no ledger write, retries with the same key/reference, and verifies one balanced ledger transaction, one canonical outbox row and exact response replay. See the [sanitized run record](F8_REFUND_MANUAL_UPI_OWNED_DATABASE_RUN_2026-10-04.json).
- The earlier ordinary-sandbox attempt did not reach execution because `docker info` had no responding daemon; the same owned runner completed after reviewed elevated execution. The earlier 8/8 run (`1877a103d9c8`) remains historical evidence before the UPI test was added.
- Current focused payment and Gateway refund-event tests: **15/15 passed**, zero skips or TODOs (`node --import tsx --test ...`). The broader adapter/webhook/event-contract suite had passed **43/43** before the manual-path change.
- Current `@letbuyy/api-gateway` typecheck: passed.
- Current `git diff --check`: passed.
- `@letbuyy/payments` typecheck: passed in the preceding lifecycle correction.
- `git diff --check`: passed.

The owned database uses synthetic merchant, payment and provider references;
the provider HTTP response is intercepted locally. No Razorpay sandbox call,
real refund, hosted deployment or physical merchant acceptance was performed.

## Remaining work

- Reconcile legacy order-level payment refunds with this payment-session writer and define the supported transition for partial refunds on orders still using that legacy path.
- Verify merchant-owned provider credentials, legal/account authority and sandbox behavior before any external PSP acceptance. No live refund was requested or made.

Phase 8 and the eleven-phase foundation goal remain active.

## 5 October continuation — normalize Razorpay's created-refund payload

The official Razorpay [refund webhook payload reference](https://d6xcmfyh68wv8.cloudfront.net/docs/webhooks/payloads/refunds/)
shows that `refund.created` can carry entity status `processed` for the standard
refund example and `pending` for the instant-refund example. Treating the entity
status as the event lifecycle previously skipped the canonical payment-session
refund writer for those payloads. The webhook now uses the signed event name as
the lifecycle authority: `refund.created` with entity status `created`, `pending`
or `processed` is sent to Gateway as semantic status `created`; contradictory
or unsupported statuses remain excluded. This preserves the reservation and
cannot post a reversal. `refund.processed` and `refund.failed` still require
their matching terminal entity status.

The real Hono webhook contract now reproduces the Razorpay `refund.created` /
`processed` payload and verifies it reaches the reserved-attempt reconciliation
path with status `created`, without invoking the legacy order writer or emitting
`payment.refunded`. The focused refund-transition contract passes **3/3** and
the full Razorpay webhook retry/reclaim contract passes **16/16** using Node/tsx.
The earlier owned Gateway/Postgres refund suite remains **9/9** for its recorded
revision; this webhook normalization did not receive a fresh database rerun.
`git diff --check` passes. These use synthetic signed provider fixtures; no
Razorpay sandbox, live refund, or deployment was performed.

This corrects the canonical payment-session event mapping only. The legacy
order-level partial-refund bridge remains unimplemented pending owner approval
for the accounting transition described above. Phase 8 and the eleven-phase
foundation goal remain active.

## 5 October review — legacy order-refund compatibility decision pending

The canonical payment-session path is unchanged and its focused route/ledger
contracts pass 10/10. A source review isolated the older-order gap: the current
webhook first attempts the session-based `payments`/`payment_attempts` writer;
when no canonical payment matches, the legacy branch only marks a refund
complete when a processed Razorpay refund equals the entire order total. A
partial refund is sent to the generic provider-event recorder and does not
reconcile the corresponding legacy `refunds` row or post its canonical ledger
reversal. The old schema does retain provider payment/refund references and
amounts (`payment_transactions`, `refunds`, `refund_attempts`), but this path
does not yet resolve them as an exact, tenant-scoped tuple.

The next proposed bridge is deliberately narrow: reconcile only a unique legacy
refund matching both provider payment and refund references, verify the signed
event amount/currency against the stored refund, and use the existing
`complete_order_refund` writer; keep unmatched or mismatched events retryable.
Owner approval is pending because this defines how partially refunded legacy
orders cross into the newer payment-session accounting path. No production
code or database migration for that bridge has been written. Existing tests
confirm a matched session payment with no reserved attempt remains retryable
and does not fall through (`payment-refund-event-route.test.ts`, 4/4), and the
focused canonical-ledger/route group passes 10/10. Webhook-service tests pass
16/16 via direct Node/tsx; its package-script invocation hit sandbox `EPERM`
creating tsx's IPC pipe, while package typecheck is currently unavailable
because that package's local `node_modules` lacks workspace links for
`@letbuyy/auth-core` and `hono`. No install or lockfile change was made.
