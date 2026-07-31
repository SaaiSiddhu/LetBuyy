# 07 — Webhook Hardening (Stream G)

**Readiness: ~70%.** Core signature verification + idempotency are solid; 4 HIGH gaps remain (documented — webhook behavior needs live testing, not blind edits).

## Solid (verified)
- **G1** Razorpay signature: raw body read before parse → `hmacSha256Hex(secret, rawBody)` → `timingSafeEqual`; double verification. ✅
- **G2** All 5 queue dispatch sites use `signQueueTenantEnvelope` (HMAC); worker re-verifies with constant-time + 15-min window. ✅
- **G3** Webhook idempotency: DB upsert on `(provider, provider_event_id)` ignore-duplicates → duplicate events short-circuit before side effects. ✅

## Risk register (documented — not edited; webhook behavior requires live verification)
| ID | Sev | Finding |
|---|---|---|
| G4 | HIGH | Zero end-to-end tests for inbound webhook handlers (signature rejection, dedup short-circuit, event routing). The most critical path — Razorpay payment confirmation — has no automated test. |
| G5 | HIGH | DLQ has no automated alerting/escalation. Dead-lettered emails/refund-notifications/inventory-release jobs go unnoticed until someone checks the ops dashboard. |
| G6 | HIGH | Batch-retry-on-single-failure: a transient error retries the whole CF queue batch; non-idempotent side effects (Resend sends) for already-processed messages re-fire. |
| G7 | HIGH | `markOrderRefunded` lacks the `if payment_status==='paid'` guard that `markOrderFailed` has → an out-of-order `refund.created` before `payment.captured` can leave the order incoherent. |
| G8 | MED | `signQueueTenantEnvelope` silently no-ops if the secret is a `SKIP_NEEDS_HUMAN_` sentinel → misconfigured env silently DLQs all tenant queue messages (compounds G5). |
| G9 | MED | Razorpay `providerEventId` fallback (`event:created_at:sig[:24]`) is not a stable entity id; rare dedup-bypass edge. |
| G11 | LOW | Razorpay events older than 300s are warned-but-processed (no upper age bound). |

## Recommendation
G4 (inbound handler tests), G5/G8 (DLQ alerting + secret guard), and G7 (refund-before-capture guard) are the priority pre-launch hardening items. G6/G10 need a live CF-queue + Razorpay sandbox harness to verify. Webhooks are **not launch-certified** until G4/G5/G7 land and a live Razorpay webhook test passes.
