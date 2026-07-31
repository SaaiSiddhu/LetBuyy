# 06 — Discounts

**Readiness: ~85%.** Coupon engine is production-ready for V1.

## Real
Coupon CRUD + active toggle, types `percentage`/`fixed_amount`/`free_shipping`, min purchase, max uses, start/expiry, usage counter, summary stats (from live API). Server-authoritative validation. Ownership-guarded on all verbs. **BOGO intentionally blocked (422, V1 scope-lock)** — verified, not a gap.

## Gaps (documented)
- No automatic/promotion-rule discount UI (`[store]/promotions` absent). MEDIUM (V1.1).
- Coupon free-shipping value handling vs `create_checkout_order` integration to confirm. MEDIUM.
- Bulk coupon generation, per-coupon usage analytics, tiered/flash sales. LOW (V1.1).

**Verdict:** percentage + fixed + free-shipping coupons with min-order/max-uses/expiry are wired end to end. Launch-ready; automatic promotions are V1.1.
