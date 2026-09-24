# Product / Channel Model

> Records the owner's standing product decisions and their structural consequence. Not a substitute
> for `LETBUYY_CONSTITUTION.md` (see Amendments 1–3, §16) or `.claude/skills/letbuyy/references/decisions.md`.
> First written 2026-09-02 (Phase M); revised 2026-09-24 (APPID-P0) for the founder's decisions of that day.

## The decisions

**One product (Phase M standing decision, 2026-09-02).** LetBuyy, the Firebase LetBuyy app, the
Start_Up platform, and Agrimore are **one product**. Marketplace, Storefront, and Quick-commerce are
**channels**, not separate companies or separate backends.

**One app per actor (D-ONE-PRODUCT, 2026-09-24).** The founder, verbatim: *"Ecommerce and Quick are
modes within ONE customer Marketplace application. There is one merchant product delivered through
web and mobile: Storefront creation and management. Marketplace selling. Inventory and order
management. Supermarket operations. Store Ops/picking/packing workflows. Future approved dark-store
operations. There is one internal console for LetBuyy employees, with restricted workspaces and
organization-wide administration."*

**One identity, one buyer (D-ONE-IDENTITY, D-ONE-BUYER, 2026-09-24).** Every client signs in through
`identity-platform`, the sole issuer. One buyer account spans the Marketplace, Quick and every
participating storefront; order views are scoped by where they are shown.

## What this means structurally

| Actor | One application | Directory (D-APP-LAYOUT) | Notes |
|---|---|---|---|
| Buyer | the Marketplace app, Ecommerce and Quick modes | `apps/marketplace/mobile` (was `apps/customer_app`) | The shipped Play Store app `com.letbuyy.letbuyy`; its identity is unchanged. The quick-commerce buyer app of System B is a **donor** for Quick mode, never a second customer app. |
| Buyer (web) | merchant storefronts, custom domains, hosted checkout, buyer account pages | `apps/commerce/web` (was `apps/customer_web`) | No separate Marketplace web application is created. |
| Merchant (owner and staff) | one merchant product on web and mobile | `apps/merchant/web`, `apps/merchant/mobile` | Storefront management, Marketplace selling, inventory and orders, supermarket operations and Store Ops are modules and modes of this product. **No separate seller or store-ops app.** |
| LetBuyy employee | one internal console | `apps/internal/console` (was `apps/admin_web`) | Restricted workspaces plus organisation-wide administration. The frozen operations portal is folded in under ART-24, then deleted. |
| Delivery partner | a separate client, **deferred** | `apps/deferred/delivery/mobile` | Activation needs its own amendment; it will sign in through `identity-platform` like every other client. |

- **Agrimore is a feature and operational donor, never a canonical backend.** Its Cloudflare Workers
  live in `services/compatibility/agrimore_bridge/`, inert; its store-operations skeleton is
  preserved at `reference/apps/store-operations` as the donor for the merchant product's Store Ops.
- **The seller app is a donor, not a product.** System A's seller app is preserved at
  `reference/apps/marketplace-seller`; its surviving capabilities port into the merchant product per
  `decisions.md` §2a, and its seller auth, wallet and commission engine are retired there.
- Authorisation never follows the app. Sharing one merchant binary between an owner, staff and (later)
  node pickers grants nothing: the server checks realm, audience, membership and permission on every
  call. Partner-node staff are not modelled yet (D-PARTNER-CUSTODY stays open).

## What remains open (explicitly not decided here)

- **D-2**, whether LetBuyy is merchant of record — counsel.
- **D-PARTNER-CUSTODY** — who a partner-node picker is and what they may read.
- The fee / merchant-of-record model for the quick-commerce channel specifically (D-1 governs today).
- Quick dispatch, POS and dark-store custody are not built by these decisions.

## Where to look for more detail

`.claude/skills/letbuyy/references/decisions.md` §2g (the 2026-09-24 decisions with the founder's
words), the Constitution §16 Amendment 3, `docs/architecture/APPLICATION_OWNERSHIP.md` (per-app
ownership and donor provenance), and `docs/unification/17-UNIFICATION-ROADMAP.md`.
