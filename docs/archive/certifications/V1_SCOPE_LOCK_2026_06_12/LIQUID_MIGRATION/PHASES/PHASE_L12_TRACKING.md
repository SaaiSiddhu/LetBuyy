# PHASE L12 — ORDER TRACKING

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only.

1. **Purpose.** Render the order-status / tracking timeline through Liquid.
2. **Repository Reality.** Tracking is a view over the same order read APIs (status + tracking number); React renders a 4-step timeline (`account/orders/page.tsx:33-45`, `orders-client.tsx`). Fulfillment sets `orders.tracking_number`/`carrier` (`create_order_fulfillment` RPC, `order-execution.adapter.ts:465-476`). V1 fulfillment is manual (merchant-entered tracking number) — no live carrier integration.
3. **Current State.** Backend complete; React timeline; no Liquid tracking template.
4. **Target State.** A Liquid order-status template rendering the status timeline + tracking number/carrier.
5. **Files To Modify.** `theme-bundle.ts` (order-status template/section, likely part of the `customers/order` template).
6. **Files To Create.** None.
7. **Files To Delete.** None.
8. **Dependencies.** L11.
9. **Validator Impact.** Schema.
10. **Migration Impact.** None.
11. **Testing Requirements.** Status timeline renders the order's state (placed→confirmed→shipped→delivered); tracking number displayed when present; pre-ship state.
12. **Performance Requirements.** Dynamic; bounded; cache-safe per order.
13. **Security Requirements.** Session/lookup-gated (same as L11); no PII leakage.
14. **Tenancy Requirements.** Order RLS-governed, tenant-scoped.
15. **Identity Requirements.** Same customer session as L11.
16. **Money Requirements.** Read-only status display; no money path.
17. **Rollback Plan.** Remove the tracking template → React tracking.
18. **Success Criteria.** A shopper sees the Liquid status timeline + tracking number for an order.
19. **Exit Criteria.** Tracking render tests green; tracking parity cells green. **At this point every customer-facing route has a Liquid template (Full-Liquid render parity reached, pending L14 validation).**
20. **Evidence Requirements.** Rendered tracking timeline; binding test; the route-coverage checklist showing all customer-facing routes Liquid-templated.
