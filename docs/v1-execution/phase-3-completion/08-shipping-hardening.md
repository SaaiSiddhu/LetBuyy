# 08 — Shipping

**Readiness: ~85% code** — server-resolved rates now reach the gateway (the proxy gap was fixed in the pre-launch wave, I-1).
Detailed audit: `docs/v1-execution/pre-launch-wave/03-checkout-audit.md` (I-1).

## Verified (done, pre-launch wave)
- **I-1 (FIXED):** `shippingRateId` now flows storefront checkout → `/api/orders` proxy → api-client (`StorefrontCreateOrderInput.shippingRateId`) → gateway `resolveShippingRate(db, store.id, body.shippingRateId)`. Contract-tested (`lb-checkout-hardening`). Server-authoritative; LB-7 28/28 still pass.
- Legacy fallback (express=99/standard=0) preserved for stores without configured rates.

## Open / gated
- **Shiprocket / live carrier integration** = CAP-C16 (V1.1) — labels/tracking/serviceability are not live carrier-integrated; rate display uses a placeholder pincode pre-address (documented, I-6). Real serviceability + label generation are post-V1.
- Merchant must configure `shipping_rates` rows (else legacy fallback). Data/config gate, not code.

**Verdict:** rate resolution + propagation are sound + verified. Live carrier ops are explicitly V1.1.
