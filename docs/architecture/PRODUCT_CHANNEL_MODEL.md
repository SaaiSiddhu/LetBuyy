# Product / Channel Model (post-consolidation, 2026-09-02)

> Records the owner's standing decision this phase operated under (never relitigated, per the Phase M brief) and the structural consequence of it. Not a substitute for `LETBUYY_CONSTITUTION.md`.

## The decision (owner's, pre-existing this phase, not made by it)

LetBuyy, the Firebase LetBuyy app, the Start_Up platform, and Agrimore are **one product**. Marketplace, Storefront, and Quick-commerce are **channels**, not separate companies or separate backends by default.

## What this means structurally

- **One set of six product-facing apps** (`customer_app`/`web`, `merchant_app`/`web`, `admin_app`/`web`) — not one set per channel. The marketplace channel's buyer experience (System A's `apps/marketplace`) became `customer_app`; the quick-commerce channel's buyer experience (System B's `apps/customer_app`) is a **donor**, not a second `customer_app`.
- **Agrimore is a feature and operational donor, never a canonical backend.** Its Cloudflare Workers and Supabase schema live in `services/compatibility/agrimore_bridge/`, explicitly inert, pending a real integration decision — never activated as a parallel backend to `services/api-gateway`.
- **The quick-commerce vertical gets its own app tier** (`apps/phase_2/*`) rather than being folded into the six-app model, because rider/store-ops capabilities have no marketplace-channel or storefront-channel equivalent — they are genuinely additive, not a duplicate.
- **No permanent `seller_app`.** Seller capability is part of `merchant_app`, not a separate app — consistent with the one-product decision (a seller is a merchant, on whichever channel).

## What remains open (explicitly not decided by this phase)

- ~~**D-0**, which backend is canonical~~ — **decided 2026-09-04 (OWNER_DECISION, recorded by GOV-4): option A, the Supabase/Cloudflare `services/api-gateway` commerce OS extended with a marketplace channel.** `docs/migration/repository_consolidation/11_backend_consolidation.md`'s 24-domain map remains the option analysis of its moment; the binding record is `.claude/skills/letbuyy/references/decisions.md` §2, which also records D-1, D-3…D-7 and the seller-feature survival list.
- **D-2**, whether LetBuyy is merchant of record — still open, needs counsel.
- The fee / merchant-of-record model for the quick-commerce channel specifically.
- Which of `apps/customer_app`'s currently-unconsolidated shared packages become the long-term canonical Dart package set. (`admin_app` no longer bears on this question: its source was deleted in phase FB-1, 2026-09-05, and the root is RESERVED.)

## Where to look for more detail

`docs/migration/repository_consolidation/00b_topology_amendment_draft.md` (the constitutional amendment text and its still-outstanding owner signature), `07_final_path_mapping.md` (every path's disposition), `11_backend_consolidation.md` (the domain-by-domain backend map).
