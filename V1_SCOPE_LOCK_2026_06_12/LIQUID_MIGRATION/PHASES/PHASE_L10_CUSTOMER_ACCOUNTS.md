# PHASE L10 — CUSTOMER ACCOUNTS

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only.

1. **Purpose.** Render account pages (profile, addresses, wishlist) through Liquid over the existing `/api/customer/*` BFF routes.
2. **Repository Reality.** All account endpoints exist and are engine-agnostic: `/api/customer/{session,profile,addresses,wishlist,wishlist/sync,set-password}` (BFF over the gateway). React account pages (`account/{settings,addresses,wishlist}/page.tsx`) call them. `composition-engine.tsx:323` hardcodes `customer:null` (drop not server-populated). No wishlist island exists.
3. **Current State.** Backend complete; pages React; `customer` drop null; no Liquid account templates; no wishlist island.
4. **Target State.** Liquid `customers/account|addresses|settings|wishlist` templates over the same APIs; `customer` drop populated (or client-hydrated from `/api/customer/session`); a `lb-wishlist` island.
5. **Files To Modify.** `theme-bundle.ts` (account templates); optional `composition-engine.tsx:323` (customer drop); `liquid-hydration-islands.tsx` (wishlist island).
6. **Files To Create.** None (backends exist).
7. **Files To Delete.** None — React account pages + `customer-auth-context`/`wishlist-context` KEEP-TEMP until L17.
8. **Dependencies.** L9 (auth).
9. **Validator Impact.** Schema; reuses existing customer routes (no route-count change).
10. **Migration Impact.** None.
11. **Testing Requirements.** Auth-gated render; profile update; address CRUD; wishlist add/remove/sync; logged-out → redirect.
12. **Performance Requirements.** Account pages dynamic (not ISR); per-customer; bounded list sizes.
13. **Security Requirements.** Auth-gated by the customer session cookie; CSRF on mutations; addresses/PII escaped; no cross-customer access (session-scoped).
14. **Tenancy Requirements.** `store_customers`/addresses/wishlist RLS ENABLE, scoped by `site_id` + customer; reads via session.
15. **Identity Requirements.** Customer HS256 session only; `getSession()`/`isCustomerSessionPayload` (`auth-core/index.ts:1298`); no merchant overlap.
16. **Money Requirements.** N/A.
17. **Rollback Plan.** Remove account templates → React account pages (or canary off).
18. **Success Criteria.** A logged-in shopper manages profile/addresses/wishlist on Liquid pages.
19. **Exit Criteria.** Account E2E + auth-gating tests green; account parity cells green.
20. **Evidence Requirements.** Rendered account pages; auth-gating proof; CRUD traces.
