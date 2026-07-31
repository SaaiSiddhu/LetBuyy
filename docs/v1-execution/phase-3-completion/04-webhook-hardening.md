# 04 — Webhook Hardening

**Readiness: ~75% code** (up from ~70% — the out-of-order refund guard G7 was fixed + verified THIS phase).
Detailed audit: `docs/v1-execution/pre-launch-wave/07-webhooks.md`.

## Verified
- Signature verification (HMAC-SHA256 + `timingSafeEqual`, raw-body-before-parse) ✅; queue envelope HMAC (`signQueueTenantEnvelope`) ✅; idempotency dedup on `(provider, provider_event_id)` ✅.
- **G7 (FIXED THIS PHASE):** `markOrderRefunded` now guards `if (order.payment_status !== "paid") { warn; return; }` — a refund webhook arriving before the capture webhook no longer flips an unpaid order to `refunded` (prevents order/inventory state corruption). Mirrors the `markOrderFailed` paid-guard. **Verified:** webhook typecheck clean; new `tests/launch/lb-webhook-ordering.test.mjs` 2/2; existing webhook-service suite 12/12 (no regression).

## Open (documented — need a live CF-queue / Razorpay-sandbox harness; not blind-editable)
- **G4 (HIGH):** no end-to-end tests for the inbound webhook HTTP handlers (signature-rejection, dedup short-circuit, event routing). Add a handler test harness.
- **G5 (HIGH):** DLQ has no automated alerting/escalation. **G8:** envelope silently no-ops on a sentinel secret → silent DLQ.
- G6 batch-retry-on-single-failure (CF queue semantics); G9 fallback dedup key; G11 no Razorpay timestamp upper bound.

**Verdict:** the state-corruption guard (G7) is closed; inbound-handler tests + DLQ alerting remain → webhooks not fully launch-certified.
