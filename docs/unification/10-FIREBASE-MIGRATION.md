# 10 — Firebase Migration

Scope: the shipped LetBuyy marketplace app (`apps/customer_app`, Firebase project `letbuy-y`) and its archived Cloud Functions. AgriMore's own Firebase-era apps (`legacy_archive_v2`, and the separate `Projects/Clients/Agrimore*` programme) are out of scope. Owner decisions already taken: D-0 (canonical backend is S1), D-9 (all eleven capability areas rebuilt canonically), D-10 (Firebase deleted in **one cutover after** every area exists canonically). This document does not change them; it makes them executable.

## 1. What Firebase provides today (inspected)

| Firebase service | Current usage | Evidence |
|---|---|---|
| **Firebase Auth** | customer login: email + password, Google sign-in (`google_sign_in`), email OTP via callables; `FirebaseAuth.instance.currentUser` read in 46 places | `packages/dart/marketplace_services/lib/src/auth_service.dart`, app screens |
| **Firestore** | primary database for users, addresses, products (reads now partly canonical), sellers, orders, carts, wishlists, reviews, notifications, reels, loyalty, ads, banners, support chat, returns, trending searches, app updates; 12 realtime listeners | `collection('…')` grep; `firestore.rules` 95 collections |
| **Realtime Database** | not used | no `FirebaseDatabase` reference |
| **Firebase Storage** | avatars `users/<uid>/…`, review images; product image URLs on `firebasestorage.googleapis.com` | `edit_profile_screen.dart:177`, `add_review_dialog.dart:178` |
| **Cloud Functions** (115 exports) | email OTP, payment (`createRazorpayOrder`, `verifyPaymentSignature`, `validateVPA`, saved cards), commission and payouts, subscriptions, KYC, returns, store deployment, notifications, analytics aggregation, admin auth | `services/compatibility/firebase_bridge/src/*` (`823aa5ee`); the app calls 10 of them |
| **FCM** (`firebase_messaging`) | push delivery to customers; token storage | `marketplace_services` (2 files), `notifications.ts` |
| **Firebase Analytics** | event logging | `firebase_analytics` dependency; 1 file in `marketplace_services` |
| **Crashlytics, Remote Config, Hosting, App Check** | Crashlytics and Remote Config: no references. Hosting: `firebase.json` serves the Flutter web build (`apps/marketplace/build/web`). App Check: none | `firebase.json` |

Security rules: 1,141 lines; open reads/writes exist on `pending_verifications`, `admin_otps`, `emailChangeOTPs`, open reads on `trending_searches`, `category_attributes`, open create on `adminActivityLogs` (see [16](./16-SECURITY-REVIEW.md)).

## 2. Investigation matrix

| Firebase service | Usage | Proposed replacement | Difficulty | Notes |
|---|---|---|---|---|
| Firebase Auth | customer identity | identity-platform **buyer realm** (exists: email+password) + **phone OTP** (new) + **Google sign-in** (new on the issuer) + `identity_legacy_links` | **High** | password hashes: Firebase scrypt export is importable only if the issuer honours the modified scrypt; otherwise force reset; Google users re-link on first login |
| Firestore | all customer data | Postgres domains (buyer accounts, addresses, orders, wishlists, notifications, reviews, loyalty, ads, banners, support) — most already exist canonically (CAP-FB-* phases) | **High** (data), **Medium** (code, via repositories) | orders history: decide keep-as-history vs import |
| Firestore listeners | live UI updates | push notifications + pull-to-refresh for Ecommerce; realtime Worker for Quick tracking | Medium | no Firestore-style live queries in S1 |
| Firebase Storage | avatars, review images, product images | R2 via gateway signed uploads; URL map for existing objects | Medium | do not break public URLs: keep Firebase Storage read-only until URLs are rewritten, then redirect |
| Cloud Functions | 10 called by app; rest seller/admin (retired) | gateway routes (payments, returns, notifications, buyer identity) — exist; saved cards / VPA validation are **new** if kept | Low–Medium | commission/payout functions are retired by decision, not migrated |
| FCM | push | **retain** as transport; queue-workers `push-dispatcher` already targets FCM/APNs; token registered against buyer principal | Low | keep `firebase_core` + `firebase_messaging` only |
| Firebase Analytics | events | `analytics_events` + product analytics tool (founder choice) | Low | decouple from database migration |
| Hosting | Flutter web build | Vercel or Cloudflare Pages for the web build (if the web variant stays) | Low | separate decision from data |

**Separate database consolidation from mobile notification infrastructure.** FCM stays; Firestore, Auth, Storage and Functions go.

## 3. What remains after cutover

- `firebase_core` and `firebase_messaging` for push (and `firebase_analytics` only if the analytics decision keeps it).
- Read-only Firebase Storage bucket for a defined grace period behind a URL rewrite map.
- The Firebase project itself until the owner deletes it (D-10 "FB-5 is the owner deleting the project").

## 4. Strangler sequence for the app (per domain, behind repositories)

Pattern already in place for the catalogue (FB-2: `lib/data/canonical_api.dart`, `marketplace_repository.dart`). Each step: add canonical repository → feature flag per domain → dual-read where safe → switch → remove Firestore code.

| Step | Domain | Canonical backend (exists?) | App work | Risk |
|---|---|---|---|---|
| 1 | Catalogue reads (home, categories, PDP, search) | `/storefront/marketplace/*` (yes) | done for feed/categories/detail; extend to search and seller pages | low |
| 2 | Banners, sponsored, personalization, follows, wishlist | `marketplace-banner`, `sponsored-product`, `personalization`, `seller-follow`, wishlist routes (yes) | repositories | low |
| 3 | Buyer identity | buyer register/login (yes); phone OTP + Google (new); legacy link | auth service swap; dual-accept window: app accepts a Firebase ID token to mint a buyer session once (link), then buyer tokens only | high |
| 4 | Addresses, profile | platform address book (new) | repositories | medium |
| 5 | Cart + checkout + payment | storefront cart/orders/payments routes (yes) with marketplace scope | replace Firestore order write with `POST …/orders` + Razorpay routes | high (money) |
| 6 | Orders, tracking, returns | buyer order reads, `request_order_return` (yes) | repositories | medium |
| 7 | Notifications | `buyer_notifications` + FCM dispatcher (yes) | inbox repository; token registration via gateway | low |
| 8 | Loyalty | merchant-funded loyalty (yes, different semantics) | UI copy change: points per merchant | medium (product change) |
| 9 | Support chat | tickets/conversations (yes) | repository | low |
| 10 | Reels | blocked on media pipeline (ARB) | keep Firestore until pipeline exists or disable feature at cutover | product decision |
| 11 | Ads (customer side) | sponsored/feed (yes) | repository | low |
| 12 | Cutover (D-10) | all above green in the app | single release; Firebase read-only; rollback = previous app version + Firestore still intact | high |

## 5. Data migration classification

| Data | Class | Approach |
|---|---|---|
| Users | must map IDs (Firebase UID → new uuid), active data | one-time import + `identity_legacy_links`; dual-accept login window |
| Addresses | can remap IDs, active | import into platform address book; geocode missing coordinates lazily |
| Products / sellers | historical only for Firestore (S1 is already master for reads) | verify parity; no import |
| Orders | active (open orders) + historical | import open orders into `orders` with `channel = marketplace`, `external_ref = firestore id`; historical orders either imported read-only or kept in a frozen archive readable by the app for N months (founder choice) |
| Carts | ephemeral | do not migrate; app rebuilds |
| Wishlists, recently viewed, followers | active, can remap | import |
| Reviews + images | active | import rows; media URL map |
| Notifications history | historical | optional import; default keep 90 days in archive |
| Loyalty balances | active, **semantics change** (platform cashback → per-merchant) | founder decision: honour as platform credit once, or per-merchant conversion |
| Payments metadata | historical | import `payment_transactions` references for reconciliation |
| Media (Storage) | active | copy to R2 in background; URL rewrite map; Storage read-only grace |

Temporary dual-write: **avoid**; prefer dual-read (canonical first, Firestore fallback) during the strangler steps and a hard cutover for writes.

## 6. Rollback

Each strangler step is a feature flag in the app config; rollback = flip the flag and ship. The final cutover keeps Firestore intact and read-only for the rollback window; the previous app version remains installable. Identity rollback is the hardest: the dual-accept window must stay open until adoption is measured.

## 7. Prerequisites before any Firebase data moves

Cloud visibility to enumerate real data volumes; an export of Firebase Auth users (with hash parameters) and Firestore collections; the identity link table and phone OTP live; the canonical marketplace feed serving rows in a real environment (needs the operator login fix so listings can be approved); a rehearsal on a copy.
