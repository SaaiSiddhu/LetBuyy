# N1.5 — canonical spent-point reversal and durable recovery

This slice implements the existing loyalty reversal requirement. It returns the original redeemed point count and retains the original redemption value metadata. It introduces no earned-point clawback or negative-balance policy. The owner-approved rule blocking point-value decreases while any account has outstanding points remains in force.

## Reproduced defects

- `334c4590cfed`: real owner cancellation failed before restoration because the order resolver issued an unscoped query through the strict tenant guard.
- `03d63fdd6637`: after repairing that dependency, cancellation committed with HTTP200. A named PostgREST restoration503 was ignored; the exact retry returned200 while the balance remained149 instead of199.
- `649862f56a88`: the first repair exposed a second response cache above the route. It replayed success before live ownership and restoration. Additional tests in that intermediate run also exposed duplicate synthetic fixture names; neither failure is relabelled green.
- `59feb083521c`: actual internal partial/full provider refund events posted the canonical refund ledger, but order-only recovery missed the full refund because the older order status projection remained unchanged. A supplied foreign refund ID also became succeeded before the order completion endpoint returned403. Both were reproduced through the real Gateway, not a mock router.

- `85952e6cdd78`:20/21 passed. The added archival/closed-account recovery case passed; an unrelated additional canonical checkout hit `orders_order_number_key` on a four-digit daily number. The same-order denial now uses a distinct raw synthetic order, retains its ownership assertion, and leaves the checkout defect open under N6. No generator or constraint was disabled.

## Implemented authority and recovery

Migration335 retains the same service-only restoration ABI and all existing source families. The restorer verifies order/site scope and a committed cancellation/full-refund source, locks the original account in stable order, derives the balance from the ledger, and credits each original redemption once. An existing reversal key must match its source, account, count and metadata. Merchant archival, paused programmes and closed accounts do not forfeit previously spent points. Recovery reads the persisted terminal source even when it has been hidden from ordinary order screens. Wrong tenant GUCs fail closed.

Full provider-refund eligibility can use canonical payment/ledger facts when the order status projection lags: all captured payments must be fully refunded, their aggregate must cover the order's net amount, and each needs a tenant-matching canonical refund posting. Partial refunds and a bare refunded status without that posting do not qualify. This slice does not rewrite the older order projection; its lifecycle repair remains mapped to N6.

The existing `platform_queue_jobs` table and queue-workers owner handle the logical `loyalty-refunds` family. No new service, Cloudflare queue resource, provider account or topology is created. The minute handler runs bounded discovery and consumption without draining the frozen app/payment family.

| Policy | Current implementation |
| --- | --- |
| Discovery | At most25 sources per scheduled invocation; SQL limit clamped1–100. Missing correct ledger credits and existing source jobs are checked before LIMIT. |
| Source | One job per immutable redeemed entry, carrying source IDs only. Points and monetary values come from the original ledger entry. |
| Lease |120seconds; current worker ID and unexpired claimed database row required. Expired leases use the existing failure transition. |
| Tenant | Claimed job site, original redemption, order and account must agree. Recovery sets transaction-local tenant context after validation and rejects an existing mismatched context. |
| Retry | Existing event retry-delay helper and platform failure transition; delayed availability, ten attempts, then durable dead state. |
| Poison source | Deterministic source/payload/schema mismatch is quarantined immediately. It cannot credit another account or occupy the discovery window indefinitely. |
| Lost reply/ack | Original ledger key remains authoritative. A repeated job acknowledges the same credit instead of inserting another. |
| Observability | Structured scheduled totals and safe pending-restoration logs; source/job IDs and persisted attempt, error, lease, result and dead states remain inspectable. |
| Exhausted debt | Remains visible and uncredited. No silent deletion, unlimited retry or fabricated success. Approved operational redrive remains an acceptance item. |

The Gateway fast path checks returned RPC errors and logs a pending restoration without rolling back a committed cancellation/refund. Exact order transition/completion retries use their existing route-owned receipts after live ownership checks, avoiding the outer HTTP cache. The complete-order-refund adapter binds a refund to both the URL order and authorized site before its monetary RPC. That endpoint now requires the same cryptographic `refund.approve` step-up as the existing payments route.

Rollback335 refuses any current or historical loyalty recovery job, changed parameter names, result ABI or overload set. With no jobs, it restores the exact334 restorer/ACLs, preserves business rows, and supports reapply. No hosted rollback or migration was performed.

## Verification and limits

Current evidence is maintained in `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.5/loyalty-reversal-evidence.json` outside this checkout. It preserves every intermediate red result and identifies the latest passing run per suite. Migration334's historical rollback test now unwinds335 first and reapplies335 afterward, proving both histories rather than overwriting the current definition and comparing it with334.

Local recovery tests cover same-request and independent recovery; canonical buyer-checkout point tender; full and partial internal provider events; original value metadata after pause/revaluation; foreign and revoked owners; body/key conflicts; failed scope reads; cryptographic step-up denials; transient outage; committed lost reply; lost worker before and after credit; lease ownership; concurrent consumers; concurrent earning/balance projection; retry exhaustion; malformed tenant source; actual browser/tenant database-role execution denials; and rollback refusal/round-trip. Synthetic paid setup, provider IDs, signed fixture credentials and local callback delivery are explicitly local fixtures.

| Verdict | Scope |
| --- | --- |
| Implementation/integration | Canonical Gateway, PostgreSQL ledger and existing worker paths implemented; focused local evidence below. |
| Local verification | Latest per-suite results and full governance outcome are recorded in the machine evidence. Historical failed batches remain failed. |
| Browser/device | Prior merchant configuration/rewards evidence is retained with its original source/APK. No claim that the newer335 refund and step-up flows were recertified on those older artifacts. |
| Provider sandbox | Not verified by these synthetic callbacks. Approved provider credentials, real sandbox lifecycle and delivery remain required. |
| Hosted | Not applied or verified. Local scheduler invocation does not certify hosted scheduling. |
| Acceptance | N1.5 and N1 remain open. No63/77/103 coverage entry was removed or declared accepted by test totals. |

## Concrete continuation

1. Reproduce and repair the sibling return-completion refund-ID boundary in `routes/returns.ts`. Its source accepts a supplied refund ID after resolving a different return; prove pre-write ownership, step-up and receipt/replay safety through the real Gateway before changing it.
2. Complete the approved operational inspection/redrive path for exhausted loyalty jobs with the existing protected operator authority. Do not substitute the unrelated distributed-queue redrive endpoint for platform jobs.
3. Verify affected merchant/buyer browser and native cancellation/refund journeys, including actionable fresh-verification handling. The current native completion UI has no proven cryptographic step-up flow; keep this requirement visible with N1/N6 dependencies.
4. Retain the separate N6 checkout loyalty-intent, four-digit globally unique order-number collision, order/refund status projection and gift-card restoration recovery gaps, plus provider/hosted proof. Do not invent earned-point clawback policy to close them.

The nine prior governance findings, Resend access, privacy erasure/retention decisions and all original acceptance mappings remain separately open until resolved by current evidence.
