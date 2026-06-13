# Checkout Patterns

Storefront checkout (`storefront-runtime`). The customer's trust + the money invariants both live here.

- **Server-authoritative totals** — the UI displays totals returned by the gateway/`create_checkout_order`; it never computes the payable. The cart→checkout handoff is HMAC-signed.
- **Clear cost breakdown** — subtotal, shipping, GST, discount, gift-card applied, **amount payable** — all in INR, itemized.
- **Gift card** — input to apply a code; on apply, show the redeemed amount + new payable; errors ("invalid or unavailable") are friendly.
- **Payment methods** — COD + Razorpay; the chosen method is explicit; Razorpay handled via its checkout, verified server-side.
- **One-step clarity** — minimal fields (address, GSTIN optional for B2B); inline validation (pincode serviceability).
- **States** — applying/placing show progress; failure keeps the cart intact with a retry.
- **Confirmation** — success page + order number + "we'll email updates"; confirmation email enqueued server-side.
