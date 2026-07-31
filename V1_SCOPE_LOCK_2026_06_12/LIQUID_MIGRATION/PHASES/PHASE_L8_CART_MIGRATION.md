# PHASE L8 — CART MIGRATION

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only.

1. **Purpose.** Render the full-page cart through Liquid; today the cart drawer island works but the cart page is bespoke React.
2. **Repository Reality.** Full server cart exists at `services/api-gateway/src/routes/storefront/cart-routes.ts` (POST/GET/PATCH/buyer-identity/discount-codes/checkout-url/DELETE; `carts` table RLS ENABLE; server re-pricing). React cart + the `lb-cart-drawer` island **share `lb_cart`/`lb_cart_token`** → unified state; islands proxy `/cart` via the `next.config.ts:107-115` rewrite to the gateway (works). `composition-engine.tsx:279-287` stubs the `cart` drop (`item_count:0`). React `cart/page.tsx` (199) bypasses the engine.
3. **Current State.** Cart backend complete; drawer Liquid; full cart page React-only; cart drop stubbed.
4. **Target State.** A `cart` Liquid template rendering the shared cart; optional server cart-drop injection (token cookie → GET `/cart/:token`).
5. **Files To Modify.** `theme-bundle.ts` (`cart` template + section); optional `composition-engine.tsx:279-287` (real cart drop from token).
6. **Files To Create.** None (backend exists).
7. **Files To Delete.** None — `cart/page.tsx` + `cart-context.tsx` KEEP-TEMP until L17.
8. **Dependencies.** L5 (add-to-cart), L4.
9. **Validator Impact.** Schema; none deleted.
10. **Migration Impact.** None (carts table exists).
11. **Testing Requirements.** Add→cart page→update qty→remove→checkout-link, all over `lb_cart` shared state; server re-pricing reflected; empty-cart state.
12. **Performance Requirements.** Cart is dynamic (per-session) — not ISR-cached; render the cart drop client-hydrated or with a fast token read; keep within limits.
13. **Security Requirements.** Cart re-priced server-side (`hydrateCartLines` — client prices never trusted); cart token is opaque (`ct_…`); coupon codes validated server-side.
14. **Tenancy Requirements.** `carts` RLS ENABLE, scoped by `site_id`+`session_id`; read/write via the tenant-scoped `cart-routes.ts`.
15. **Identity Requirements.** Buyer identity attaches via `PUT /cart/:token/buyer-identity` using the customer session; guest carts allowed.
16. **Money Requirements.** **Money-adjacent.** The cart computes server-authoritative subtotals and mints the **signed checkout handoff** (`/cart/:token/checkout-url` — HMAC of sorted line items+coupons+subtotal, per Constitution §234). The Liquid cart MUST use this handoff for checkout; it must not compute or trust client totals. The canonical ledger is untouched (order creation is post-handoff at checkout).
17. **Rollback Plan.** Remove the `cart` template key → React cart page (or canary off → full React).
18. **Success Criteria.** Canary cart page renders Liquid, shares state with the drawer, and hands off to checkout via the signed URL.
19. **Exit Criteria.** Cart E2E green; signed-handoff path verified; cart parity cells green.
20. **Evidence Requirements.** Rendered Liquid cart; an add→cart→checkout-handoff trace; server re-pricing evidence.
