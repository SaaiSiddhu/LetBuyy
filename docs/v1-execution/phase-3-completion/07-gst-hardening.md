# 07 — GST & Tax

**Readiness: PARTIAL** — GST computes server-side correctly, but the storefront never sends the recipient state code, so GST resolves to 0.
Detailed audit: `docs/v1-execution/pre-launch-wave/03-checkout-audit.md` (I-2).

## State
- The gateway computes GST server-side (`calculateGstLine`, supplier state from `tax_registrations`) and consumes `body.recipientStateCode`. Invoices are immutable, GST server-authoritative. ✅
- **I-2 (HIGH for GST-registered merchants):** `checkout-client.tsx` collects a free-text `state` but never derives/sends `recipientStateCode` → the gateway gets `null` → GST = 0 on every order.

## Why not fixed blind here
Closing I-2 requires a state-name → GST-state-code mapping (37 entries) wired into the checkout form + sending `recipientStateCode`. It is a storefront UI/data change whose correctness (free-text state → code) and rendering cannot be verified without the running stack — and the mission requires every fix be verified. **Ready-to-apply spec:** add a normalized state→code map (e.g., a `GST_STATE_CODES` const), derive `recipientStateCode` from the selected/entered state in `buildOrderPayload`, send it; the gateway already consumes it (`checkout-payment-routes.ts`).

## Scope note
Only affects **GST-registered** merchants (minority for V1). Zero-tax for unregistered stores is correct behavior. Not a blocker for non-GST stores; a compliance gap for registered ones.
