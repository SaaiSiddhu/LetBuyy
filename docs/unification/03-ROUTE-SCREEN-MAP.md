# 03 — Route and Screen Map

Columns: screen · app · route · purpose · API / backend dependencies · reusability · target destination. Reusability legend: **KEEP** (as is), **KEEP-UI/REPLACE-DATA** (UI stays, data layer moves to the canonical API), **MERGE** (combine with the other system's equivalent), **REBUILD**, **REMOVE**.

## A. Customer surfaces

### A1. S2 — `apps/customer_app` (Flutter; mobile, desktop and web variants of most screens)

| Screen (file under `lib/screens/`) | Route (from `lib/app/routes.dart` / pushes) | Purpose | Backend today | Reuse | Target |
|---|---|---|---|---|---|
| `splash/splash_screen.dart`, `onboarding/onboarding_screen.dart` | app start | boot, onboarding | Firebase Auth state | KEEP-UI/REPLACE-DATA | Unified app shell |
| `auth/{auth,mobile_auth,desktop_auth,web_auth}_screen.dart` | `/auth` | email/password, Google sign-in, email OTP | Firebase Auth; callables `sendEmailVerificationOTP`, `verifyEmailOTPAnd{Login,Signup}` | KEEP-UI/REPLACE-DATA | Identity (buyer realm, phone OTP added) |
| `main_screen.dart`, `web_main_screen.dart` | shell | bottom nav / web header | — | MERGE (add Ecommerce/Quick mode) | Unified app shell |
| `home/{home,mobile_home,desktop_home,web_home}_screen.dart` + widgets (banner carousel, sponsored products, suggested for you, rate your purchases, address selection sheet, home app bar) | `/` | marketplace home | Firestore `products`, `ad_products`, `ad_campaigns`, banners; FB-2 canonical feed via `lib/data/marketplace_repository.dart` | KEEP-UI/REPLACE-DATA | Customer · Ecommerce mode |
| `category/*_screen.dart` | category | browse by category | Firestore categories / canonical `marketplace/categories` | KEEP-UI/REPLACE-DATA | Customer |
| `search/{search,mobile_search,desktop_search,web_search,visual_search}_screen.dart` | `/search`, `/visual-search` | search, voice, visual | Firestore queries, `trending_searches`, Gemini | KEEP-UI/REPLACE-DATA | Catalog search |
| `shop/{shop,mobile_shop,desktop_shop,web_shop,product_details,seller_store,seller_profile}_screen.dart` | product / seller | PDP, seller store, seller profile, reviews, delivery info, sponsored banner | Firestore `products`, `sellers`, `reviews`, `seller_followers`; canonical `marketplace/listings/:id` | KEEP-UI/REPLACE-DATA | Customer |
| `cart/{cart,mobile_cart,desktop_cart,web_cart,coupon_selection}_screen.dart` | cart | cart, coupons | Firestore `carts`, local state | KEEP-UI/REPLACE-DATA | Cart (Ecommerce basket) |
| `checkout/{checkout,mobile_checkout,desktop_checkout,web_checkout,add_address,payment_method,order_success}_screen.dart` | checkout | address, payment (Razorpay, COD), success | Firestore `addresses`, `orders`; callables `verifyPaymentSignature`, `validateVPA`, saved cards; Razorpay SDK | KEEP-UI/REPLACE-DATA | Order / Payment |
| `orders/{orders,mobile_orders,desktop_orders,web_orders,order_history,order_details,order_tracking}_screen.dart` | `/orders` | history, detail, tracking | Firestore `orders` | KEEP-UI/REPLACE-DATA (tracking MERGE with Quick map) | Order |
| `returns/{my_returns,return_request,return_tracking,desktop_returns,web_returns}_screen.dart` | returns | return flow | Firestore + `returnService` callables | KEEP-UI/REPLACE-DATA | Order |
| `profile/{profile,mobile_profile,desktop_profile,web_profile,edit_profile,change_password,saved_addresses,settings}_screen.dart` | `/profile/*`, `/edit-profile` | profile, addresses, settings | Firestore `users`, `addresses`; Storage avatars | KEEP-UI/REPLACE-DATA | Customer profile (single) |
| `notifications/*_screen.dart` | `/notifications` | inbox | Firestore `notifications` listeners, FCM | KEEP-UI/REPLACE-DATA | Notification |
| `wishlist` (under profile/shop widgets) | wishlist | wishlist | Firestore `wishlists` | KEEP-UI/REPLACE-DATA | Customer |
| `reels/{reels_feed,mobile_reels_feed,desktop_reels_feed,web_reels_feed,saved_reels}_screen.dart` + comments sheet | reels | video feed | Firestore `reels`, `saved_reels`, `reel_*` | KEEP-UI (data blocked on media pipeline) | Customer (ARB-gated) |
| `chat/{ai_chat,chat_history,mobile_ai_chat,desktop_ai_chat,web_ai_chat}_screen.dart` | `/support-chat`, `/support-conversations` | AI chat, support | Gemini, Firestore `support_conversations` | REPLACE-DATA (support → canonical tickets); AI chat REMOVE per decision | Customer |
| `loyalty/*_screen.dart` | loyalty | points | Firestore `loyalty` listener | KEEP-UI/REPLACE-DATA (per-merchant ledger points) | Promotion |
| `support/*`, `help/help_screen.dart` | support | help centre | static + Firestore | KEEP | Customer |
| `downloads/download_screen.dart` | `/downloads` | digital downloads | UNKNOWN backend | UNKNOWN | verify |

**Reusability judgement.** The screen set is the most complete customer UI in any of the three systems (mobile, desktop and web variants exist for the core journeys). Its data access is only partly abstracted: `packages/dart/marketplace_services` holds most Firestore access, but 29 app files still call Firestore directly. The FB-2 seam (`lib/data/canonical_api.dart`, `marketplace_repository.dart`) shows the pattern for the rest.

### A2. S3 — `Agrimore_Supabase:apps/customer_app` (Flutter skeleton, Android only)

| Feature module (`lib/src/features/`) | Purpose | Backend | Reuse | Target |
|---|---|---|---|---|
| `address` | addresses with serviceability check | `/v1/addresses`, `/v1/addresses/serviceability` | MERGE (logic) into S2 address screens | Customer · Quick |
| `discovery`, `home` | store-scoped browse, home shelves | `/v1/catalog/*`, `/v1/serviceability/public-zones` | MERGE as the **Quick mode** of the S2 home | Customer · Quick |
| `cart`, `checkout` | single-store cart, quote, payment intent | `/v1/cart*`, `/v1/checkout/quote`, `/v1/payments/*` | MERGE (Quick basket + quote step) | Cart / Order |
| `orders`, `tracking` | order list, status timeline + ETA text (159 lines) | `/v1/orders*` | REBUILD tracking with map; list MERGE | Order |
| `wallet`, `growth`, `notifications`, `profile`, `auth` | wallet, referrals, inbox, profile, OTP | `/v1/wallet`, `/v1/me`, `/v1/notifications*`, `/v1/auth/*` | REMOVE (superseded by S2 UI + S1 backend); referrals concept to Promotion | — |

### A3. S3 — `Agrimore_Supabase:apps/marketplace_web` (Next, 9 pages)

`/(shop)/{shop,checkout,search,cart,orders,category/[id],product/[id],orders/[id]}` — a thin web shop against the AgriMore gateway. **REMOVE**: S1 `customer_web` is the web surface; a future marketplace website is a new decision.

### A4. S1 — `apps/customer_web` (Next 16; merchant storefronts + hosted checkout)

| Route | Purpose | Backend | Reuse | Target |
|---|---|---|---|---|
| `/store/[subdomain]` and `/[...path]` (theme-rendered) | storefront home and theme pages | `/v1/storefront/:subdomain/*` | KEEP | Storefront channel |
| `/store/[subdomain]/{products,product/[productId],collections,collections/[slug],search,shop,blog,blog/[slug],contact,shipping,privacy,terms,returns,password}` | catalogue, content, policies | storefront public routes | KEEP | Storefront |
| `/store/[subdomain]/cart`, `/checkout`, `/checkout/success`, `/checkout/paypal-return` | cart and checkout (`checkout-client.tsx` drives Razorpay order + verify) | cart routes, `POST …/orders`, `…/payments/razorpay/{order,verify}` | KEEP (remove PayPal remnant) | Storefront checkout |
| `/store/[subdomain]/customers/{login,register}`, `/account/(hub)`, `/account/{addresses,orders,orders/[id],settings,wishlist}`, `/orders` | per-store customer account | customer session routes | KEEP; link to platform buyer account later | Storefront |
| `/checkout-origin/checkout` | tenant-free hosted checkout origin | signed handoff | KEEP (verify callers) | Storefront |
| `/preview`, `/preview/coming-soon`, `/demo/urban-kicks` | previews, demo | — | KEEP / REMOVE demo before launch | — |
| Local API routes: `/api/{seed,store-lookup,orders,themes,reviews,shipping/rates,coupons/validate,orders/set-password}` | proxies/helpers | gateway | KEEP (route-ownership lockstep) | — |

## B. Merchant surfaces

### B1. S1 — `apps/merchant_web` (Next 16, `/[store]/…`)

| Area | Pages | Backend (via 130 proxy routes under `/api/stores/[store]/…`) | Reuse | Target |
|---|---|---|---|---|
| Dashboard, analytics | `/dashboard`, `/analytics` | `/v1/analytics/*`, `/v1/commerce-analytics/*` | KEEP; add channel breakdown | Merchant control plane |
| Products | `/products`, `/products/new`, `/products/[productId]`, `/products/{collections,smart-collections,gift-cards,inventory,inventory-history,locations,purchase-orders,receipts,reservations,suppliers,transfers,operations-dashboard}` | `/v1/products`, `/v1/inventory/*`, `/v1/gift-cards`, `/v1/smart-collections` | KEEP; add per-channel publish panel and node stock | Catalog / Inventory |
| Orders | `/orders`, `/orders/[orderId]` | `/v1/orders/*`, `/v1/returns`, `/v1/shipping/labels` | KEEP; add Quick order queue | Order |
| Customers | `/customers`, `/customers/[email]`, `/customers/segments` | `/v1/customers/*` | KEEP | Customer (merchant view) |
| Online store | `/online-store`, `/online-store/{pages,preferences,themes,themes/[themeId]/editor,themes/[themeId]/editor/translations,themes/update}`, `/pages`, `/posts`, `/appearance`, `/experience` | `/v1/themes/*`, `/v1/pages`, `/v1/blog` | KEEP | Storefront channel |
| Marketing | `/marketing`, `/coupons`, `/reviews`, `/leads`, `/comments`, `/testimonials`, `/gallery` | `/v1/marketing`, `/v1/coupons`, `/v1/reviews`, `/v1/ads` | KEEP | Marketing |
| Money | `/payouts`, `/settings/payments`, `/settings/billing`, `/settings/plan`, `/settings/subscribe/checkout`, `/access_account/checkout/*` | `/v1/payouts`, `/v1/payments/*`, `/v1/billing` | KEEP; add channel plans | Settlement / Subscription |
| Settings | `/settings/{general,business,domains,shipping,taxes,notifications,policies,localization,security,users,custom-data,checkout,apps}` | domains, shipping, tax, notifications, employees, security routes | KEEP; add **Sales Channels** section | Merchant |
| Apps / AI / misc | `/apps`, `/apps/[installationId]`, `/ai`, `/skills`, `/projects`, `/education`, `/certifications`, `/contact`, `/export` | app platform (frozen), AI credits | KEEP or prune (`FEATURE_APP_PLATFORM`) | — |
| Cross-store | `/stores`, `/accept-invite`, `/launching-soon`, `/[store]/login` | `/v1/stores`, employees invite | KEEP | Merchant |

Absent today and required: **Sales Channels** (`/[store]/channels`), **Locations of three kinds** (own store, dark store, partner), **Quick order queue / Store Ops mode**, **POS mode**.

### B2. S1 — `apps/merchant_app` (Flutter, 59 `*_screen.dart` files)

`auth/{login,otp,turnstile_challenge,error}`, `dashboard/home`, `main/store_main`, `products/{products,product_form,collections,import_products}`, `inventory/{inventory,locations,purchase_orders,suppliers,transfers}`, `orders/{orders,order_detail,returns}`, `customers/{customers,customer_detail}`, `discounts/{coupons,coupon_form,gift_cards}`, `marketing/{email_campaigns,leads,reviews}`, `content/{pages,page_editor,posts,post_editor,blog,media_library,navigation}`, `customize/{theme,theme_versions}`, `editor/section_editor`, `preview/live_preview`, `money/money`, `analytics/analytics`, `kyc/kyc`, `settings/{settings,store_details,domain_settings,shipping,taxes,staff,notifications,seo_settings,localization_markets,billing,custom_data,help}`, `security/two_factor`, `subscription/{pricing,razorpay_checkout,connect_razorpay}`, `premium/upgrade`, `apps/{apps,app_bridge_runtime}`, `ai/ai`, `store_health/store_health`, `platform/platform_blocked`, `wizard/{create_store_wizard,store_published}`, `splash`. Backend: gateway + `mobile-bff`; auth via identity cookies. **KEEP**; becomes the merchant control plane on mobile with Store Ops and POS modes added.

### B3. S3 — `Agrimore_Supabase:apps/seller_app` (features catalog, dashboard, onboarding, orders, payouts; 17 files)

**REMOVE**: superseded by S1 merchant surfaces.

## C. Store operations and delivery surfaces

| Screen set | Where | Purpose | Backend | Reuse | Target |
|---|---|---|---|---|---|
| `apps/phase_2/store_ops_app` features `queue`, `pick_pack`, `handoff`, `inventory`, `onboarding` (18 files; riverpod + go_router) | S1 repo (donor copy) | store-ops queue, picking, packing, handover, node inventory | AgriMore-shaped `/v1/store/*` (absent in S1) | KEEP-UI/REPLACE-DATA → **Store Ops mode of the merchant app** for merchant-run nodes; standalone app only for partner staff | Fulfilment |
| `apps/phase_2/rider_app` features `assignment`, `delivery`, `earnings`, `shift`, `auth` (20 files) | S1 repo (donor copy) | offers, delivery steps, earnings, shift with heartbeat timer | `/v1/rider/*` (absent in S1) | KEEP-UI/REPLACE-DATA → **Delivery Partner app** | Delivery |
| `Agrimore_Supabase:apps/{store_ops_app,rider_app}` | S3 | same skeletons (source of the copies) | AgriMore gateway | duplicate of the above | — |
| `Agrimore_Supabase:legacy_archive_v2/apps/{marketplace,delivery,admin}` | S3 HEAD (being deleted) | Firebase-era app with Google Maps live tracking (`live_tracking_screen.dart`, 729 lines), delivery app with geolocator stream, admin with delivery partner management and order assignment | Firestore | reference only for the map UI pattern | — |

## D. Operator / admin surfaces

| Screen | App | Route | Backend | Reuse | Target |
|---|---|---|---|---|---|
| Login, MFA | `admin_web` | `/(auth)/login`, `/(auth)/mfa` | console-auth (dev-only magic link) | REBUILD login (operator realm) | Operations |
| Dashboard, merchants, merchants/[id], stores, users, subscriptions, revenue, money-reconciliation, risk, trust-safety, incidents, operations, compliance, audit-logs, analytics, developers, founding, employees, settings | `admin_web` | `/(dashboard)/*` (22 pages) | `/v1/internal/console`, `/v1/admin`, `/v1/operations` | KEEP | Operations |
| Marketplace listings, marketplace governance | `admin_web` | `/(dashboard)/marketplace-listings`, `/marketplace-governance` | `/v1/operations/marketplace-listings`, `transition_channel_listing` | KEEP | Operations |
| Zones, dark stores, partner stores, delivery partners, live operations | — | — | — | NEW | Operations |
| `Agrimore_Supabase:apps/admin_app` (dashboard, dispatch, operations; 18 files) | S3 | — | `/v1/ops/*` stubs | REMOVE (concepts → Operations) | — |
| `apps/platform-operations-portal` | S1 FROZEN | — | — | consolidation into `admin_web` pending (ART-24) | — |

## E. Identity surfaces

`apps/identity-platform`: `/login`, `/signup`, `/lookup`, `/select`, `/onboarding`, `/check-email`, `/forgot-password`, `/reset-password`, `/set-password`, `/jwks`, `/oauth2/*`; API `api/auth/{accounts,create-store,login,logout,lookup,reset-password,send-magic,send-reset,session,set-password,signup,stores,switch,validate-subdomain,verify,verify-otp}`, `api/buyer/{register,login}`, `api/email`. **KEEP**; add phone OTP and the operator realm.

## F. Marketing

`apps/marketing-site` (public pages, founding/demo request forms → gateway public routes). **KEEP**.
