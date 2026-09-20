# 15 — Data Migration Plan (Firebase → canonical Postgres)

Applies to the live LetBuyy marketplace (Firebase project `letbuy-y`). Never "delete Firebase and start again": the app has real users. AgriMore Supabase data is presumed absent (unknown); if any exists it follows the same pattern with `supabase_auth_id` links. Live volumes are `UNKNOWN_LIVE_STATE` until someone with cloud access exports them.

## 1. Preconditions

1. Cloud access to export Firebase Auth users (with password hash parameters) and every Firestore collection the app uses ([05 §2](./05-DATABASE-MAP.md)).
2. Canonical destinations live in a real environment: buyer realm with phone OTP + Google, platform address book, buyer notifications, wishlists, loyalty, returns, orders with `channel = marketplace`, marketplace feed with approved listings (requires the operator login fix).
3. New tables: `identity_legacy_links(firebase_uid, buyer_account_id, method, verified_at)`, `external_refs(entity, canonical_id, source, source_id)` for orders/reviews/addresses, `media_url_map(old_url, new_url)`.
4. A rehearsal environment loaded from a Firestore export copy; a runbook with timings; rollback tested.

## 2. Entity plan

| Entity | Firestore source | Canonical target | ID policy | Class | Steps |
|---|---|---|---|---|---|
| Customers | `users`, `userPreferences` | `buyer_accounts` (+ profile fields) | new uuid; `firebase_uid` in link table | active; must map | import email, verified flag, display name, avatar URL (mapped), created_at; password hash import only if Firebase scrypt parameters are honoured by identity-platform, else `password_hash = NULL` + forced reset; Google-linked users flagged for re-link on first login |
| Addresses | `addresses` | platform address book | new uuid; source id in `external_refs` | active; can remap | import; geocode lazily where lat/lng missing |
| Sellers | `sellers`, `stores`, `store_users` | `sites` / `users_custom` | link table (`realm = merchant`) | mostly historical | sellers are re-contracted under 0% (D-1) or the new fee model; only sellers still trading are re-created as S1 merchants; no automated import of store builder data (retired) |
| Products | `products`, `categories` | already canonical for reads (FB-2) | — | historical | parity check only; Firestore product docs frozen at cutover |
| Orders | `orders`, `transactions` | `purchases` + `orders` + `order_items` + `payment_transactions` (`channel = marketplace`, `fulfilment_type = merchant_shipping`) | new uuid; Firestore id in `external_refs`; order number preserved as display number | open orders: active; delivered: historical | import open orders fully (status map in [14 §3.1](./14-ORDER-FULFILMENT-ARCHITECTURE.md)); historical orders either imported read-only or served from a frozen archive for a founder-set period; payment ids kept for reconciliation |
| Carts | `carts`, `items` | none | — | ephemeral | not migrated |
| Wishlists, recently viewed, followers | `wishlists`, `recently_viewed`, `seller_followers`, `followers` | `customer_wishlists`, `buyer_product_views`, `seller_followers` | remap | active | import |
| Reviews | `reviews`, `reviewStats` | `reviews` | remap; image URLs via map | active | import; stats recomputed |
| Notifications | `notifications`, `notification_history` | `buyer_notifications` | remap | historical | import last 90 days (default), rest archived |
| Loyalty | `loyalty`, `loyalty_transactions` | `loyalty_accounts` / ledger | remap | active; **semantics change** | founder decision required: platform cashback → one-time credit vs per-merchant conversion; ledger entries must balance |
| Ads (customer visible) | `ad_products`, `ad_campaigns`, `sponsored_banners`, `banners` | `ad_*`, `marketplace_banners` | remap | active | import active campaigns/banners |
| Reels | `reels`, `saved_reels`, `reel_*` | blocked (media pipeline) | — | active | stay on Firestore until the pipeline exists, or feature disabled at cutover |
| Support chat | `support_conversations`, `messages` | tickets/conversations | remap | active | import open conversations |
| Returns | `return_requests`, `return_qc_reports` | `returns`, `refunds` | remap | active/historical | import open returns |
| Media | Firebase Storage objects | R2 | URL map | active | background copy; rewrite URLs in canonical rows; Storage read-only with redirect for a grace period |
| Admin / KYC / seller money | `admins`, `kyc_submissions`, `wallet_transactions`, `payout_requests`, `subscriptions` | mostly not migrated (retired models) | — | historical | export to cold storage for audit; KYC documents only under the new vendor flow |

## 3. Sequencing

1. **Read-only shadow import** into the rehearsal database; run parity reports (counts, sums of order totals, users by status).
2. **Identity first**: create `buyer_accounts` + links; open the dual-accept window in the app (a Firebase ID token can be exchanged once for a buyer session, which records the link).
3. **Dual-read domains** (wishlist, addresses, notifications, reviews) switch to canonical with Firestore fallback; measure.
4. **Orders**: freeze new Firestore order writes (app version gate) at cutover time T; import open orders; from T all checkouts go canonical.
5. **Cutover release (D-10)**: one app release removes Firestore reads; Firebase Auth remains accepted for the link window only.
6. **Media**: rewrite URLs after copy verification; redirect old URLs.
7. **Retire**: Firestore read-only → export archive → owner deletes the project (FB-5).

## 4. Rollback strategy

| Stage | Rollback |
|---|---|
| Shadow import / rehearsal | discard rehearsal database |
| Identity links | links are additive; disable the exchange endpoint; Firebase login still works |
| Dual-read domains | flip per-domain flag back to Firestore (writes did not move yet) |
| Orders cutover | re-enable Firestore writes in the previous app version; canonical orders created in the window are exported back or served read-only in the old app (decide before T) — the shortest possible window is the real mitigation |
| Cutover release | keep the previous app version publishable; Firestore untouched and read-only for the window |
| Media | old URLs keep resolving until the map is verified |

## 5. Risks

Email collisions between Firebase users and existing `buyer_accounts`/`store_customers`; unverifiable password hashes; in-flight payments at T; Firestore counters that disagree with canonical stock; documents with embedded Storage URLs; unknown volumes; loyalty semantics; reels dependency; the fact that no canonical environment is known to be serving today.

## 6. Verification per entity

Row counts and checksums (source vs target), sample-based field diffs, order total sums per day, login success rate during the dual-accept window, 404 rate on media URLs, reconciliation of imported payment references against Razorpay settlement data.
