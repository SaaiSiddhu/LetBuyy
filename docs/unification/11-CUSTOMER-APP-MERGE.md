# 11 — Customer App Merge

Goal: one LetBuyy customer application with **Ecommerce** and **Quick** as modes of the same screens, one profile, one order history, one address book, one notification inbox. Base: today's `apps/customer_app` (the mature Play Store UI). Donor: AgriMore's `customer_app` flows (address serviceability, store-scoped discovery, quote checkout, tracking) and, for the live map, the pattern in AgriMore's archived Firebase-era `live_tracking_screen.dart`.

## 1. Navigation and mode

Recommended information architecture (compare: S2 has a bottom nav with home, categories, cart, orders, profile and web/desktop headers; S3 has home, discovery, cart, orders, profile):

```text
Bottom nav:  Home · Categories · Cart · Orders · Profile
Top of Home: mode switch  [ Ecommerce | Quick ]
             Quick tab visible only when serviceable at the resolved address;
             otherwise shown disabled with "Not available at <area> yet".
Stable across modes: Profile, Orders (one list, badges by mode), Notifications, Addresses, Wishlist, Support.
Mode-dependent: Home content, Categories (Quick shows node assortment), Search (Quick = node-scoped),
                Cart (two baskets, the active one shown; a small "Also in your Quick/Ecommerce cart" chip),
                Checkout (mode-specific steps).
```

Why a mode switch on Home rather than a separate Quick tab: the S2 shell already has five destinations and web/desktop headers; a mode keeps Orders/Profile/Cart singular (the founder's requirement) and mirrors Flipkart Minutes / Amazon Now placement. Final IA to be confirmed with design; the alternative "Home · Quick · Categories · Orders · Profile" is workable if Quick adoption is expected to dominate.

## 2. Screen-by-screen plan

| S2 screen | Decision | Ecommerce mode | Quick mode (from S3 / new) | Data layer target |
|---|---|---|---|---|
| Splash / onboarding | KEEP AS-IS | — | resolve location permission early | app config |
| Auth screens | KEEP UI / REPLACE DATA | buyer realm (email, Google) | same | identity-platform buyer routes + phone OTP (new) |
| Main shell | MERGE | add mode switch and serviceability gate | — | serviceability API (new) |
| Home | KEEP UI / REPLACE DATA + MERGE | canonical feed, banners, sponsored, suggested | node assortment, shelves (S3 `home_feed_shelves` idea), delivery promise chip, node picker | `/storefront/marketplace/*`; new `/quick/nodes/:id/feed` |
| Category | KEEP UI / REPLACE DATA | marketplace categories | node categories with availability | marketplace categories; node-scoped variant |
| Search (incl. visual, voice) | KEEP UI / REPLACE DATA | canonical search | node-scoped search respecting stock | FTS with node join |
| Product detail | KEEP UI / REPLACE DATA + MERGE | listing detail, seller card, reviews | node price, "delivered in ~N min" from ETA service, stock at node | listing detail; node offer |
| Seller store / profile | KEEP UI / REPLACE DATA | seller listings, follow | partner label "in partnership with" | seller-follow routes |
| Cart | KEEP UI / REPLACE DATA + MERGE | Ecommerce basket (`carts`) | Quick basket bound to node; requote prompt on node change | cart routes; new quick basket |
| Coupon selection | KEEP UI / REPLACE DATA | coupons | node/channel coupons | coupons routes |
| Checkout: address | KEEP UI / MERGE | address book | address must be inside the node's zone; map pin (S2 already has Google Maps picker) | platform address book (new) |
| Checkout: payment | KEEP UI / REPLACE DATA | Razorpay order/verify, COD | quote → pay within expiry; COD per policy | storefront payment routes; quote (new) |
| Order success | KEEP AS-IS | — | shows ETA and node | — |
| Orders list / history / detail | KEEP UI / REPLACE DATA | shipment status | Quick status timeline (picking → rider → delivered) | buyer order reads (extend for Quick) |
| Order tracking | REBUILD | carrier events | **live map**: rider marker, route, ETA, status steps (pattern: archived `live_tracking_screen.dart`; data: realtime Worker) | realtime channel (new) |
| Returns (request, tracking, list) | KEEP UI / REPLACE DATA | returns RPC | Quick returns per policy (often instant refund) | returns routes |
| Profile, edit profile, settings, change password | KEEP UI / REPLACE DATA | buyer profile | same | buyer account routes |
| Saved addresses | KEEP UI / REPLACE DATA | platform address book with coordinates | same (default address drives Quick serviceability) | new |
| Notifications | KEEP UI / REPLACE DATA | inbox + FCM | rider/delivery events | `buyer_notifications` + push |
| Wishlist | KEEP UI / REPLACE DATA | wishlist | same | wishlist routes |
| Loyalty | KEEP UI / REPLACE DATA (copy change) | per-merchant points | same | loyalty routes |
| Reels | KEEP UI (data blocked) | Firestore until media pipeline | — | ARB-gated |
| AI chat / support chat | support KEEP UI / REPLACE DATA; AI chat REMOVE | tickets | same | support routes |
| Help, downloads | KEEP / VERIFY | — | — | — |

S3 screens absorbed: `address` (serviceability check), `discovery` and `home` (node-scoped browse), `cart`/`checkout` (single-node basket + quote), `tracking` (status + ETA → merged into the rebuilt tracking), `wallet`/`growth`/`profile`/`auth`/`notifications` (removed; superseded).

## 3. Feature-by-feature merge

| Feature | S2 today | S3 today | Unified |
|---|---|---|---|
| Location context | address selection sheet (Firestore addresses, Google Maps) | serviceability at address | one address book with coordinates; app resolves default address → serviceability → Quick availability |
| Product identity | Firestore product doc | catalog variant | one `products`/`product_variants` master with channel listing and node offer |
| Delivery promise | none (marketplace) | ETA seconds from SLA | Ecommerce: shipping estimate from rules; Quick: ETA from prep + travel (routing adapter) |
| Cart | one Firestore cart | one store-bound cart | two baskets, never merged |
| Checkout | address → payment → Firestore order | quote → intent → confirm | Ecommerce: existing storefront path; Quick: quote (holds reservation, expires) → pay → confirm |
| Payments | Razorpay callable verification, COD, saved cards | Razorpay intents | gateway Razorpay routes (fix capture check); saved cards only if decided |
| Order tracking | status screen | status + ETA | Ecommerce: shipment events; Quick: live map + steps |
| Profile | Firestore user | profile | buyer account |
| Notifications | Firestore + FCM | device tokens | buyer inbox + FCM |
| Wallet | — | customer wallet | not carried (no stored value outside the ledger); gift cards/loyalty remain tender |
| Referral | — | referrals | later, Promotion domain |

## 4. Data layer abstraction

Current state: `packages/dart/marketplace_services` (51 files) holds most Firestore access; 29 app files still call Firestore directly; `packages/dart/marketplace_models` (52 files) are Firestore-shaped models; `lib/data/{canonical_api,marketplace_repository}.dart` is the canonical seam (105 lines). Plan: make every screen depend on repository interfaces in `marketplace_services`; implement each interface twice (Firestore, canonical) during the strangler window; delete the Firestore implementation per domain after cutover; move models to canonical shapes in `marketplace_models` (or to `packages/dart/api_client` types).

## 5. Design system

Keep `marketplace_ui_kit` components as the base of the unified customer kit; apply LetBuyy tokens from the generated mobile token set; Quick mode uses the same components with a mode accent, not AgriMore's palette. Both modes share loading, empty, error, offline, stale-data and permission-denied states (the nine-state rule).

## 6. Acceptance for the merged app

- Same buyer signs in once and sees Ecommerce and Quick orders in one list.
- Quick tab hidden when the default address is not serviceable; visible with node choice when several nodes qualify.
- Two baskets coexist; switching node in Quick requotes with explicit confirmation.
- Checkout in both modes ends with a server-confirmed order; no client callback marks anything paid.
- Live tracking shows the assigned rider only to that order's buyer.
- App size and cold start not worse than today's build (measure).
