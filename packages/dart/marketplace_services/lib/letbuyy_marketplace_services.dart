/// Shared backend services for LetBuyy apps.
///
/// BOUNDED COMPATIBILITY PACKAGE — NOT the canonical service layer. Retained only so
/// `apps/marketplace/mobile` (formerly `customer_app`; `admin_app` was retired to a
/// RESERVED root in phase FB-1, 2026-09-05, and no longer consumes it) resolves/
/// analyzes/tests. Do not extend or use as a template — see this package's README.md
/// and docs/migration/repository_consolidation/18_dart_package_recovery_journal.md.
///
/// Phase 1R (C3, Firebase SDK removal, 27 September 2026 review continuation, second
/// pass): the owner decided to remove Firebase entirely from the active marketplace
/// (no real users existed to migrate). This sweep is IN PROGRESS, not complete: every
/// export with no remaining live caller anywhere in the app has been deleted outright
/// (their own removal is recorded in place, below); every export still listed below
/// either has a live, reachable caller still being traced to its own disposition, or
/// is already confirmed Firebase-free. `firebase_safety.dart` (safeFirebaseUserId/
/// safeFirebaseCurrentUser) is deleted -- its last callers closed this same pass --
/// and `firebase_auth`/`cloud_functions`/`firebase_storage` are confirmed absent from
/// this package's pubspec (zero remaining imports anywhere in this workspace, grepped).
/// Phase 1R final pass (owner-requested completion, same day): support_chat_service.dart,
/// visual_search_service.dart and category_attribute_service.dart -- the last three
/// Firestore-backed services, each with no canonical successor -- are deleted outright,
/// not merely disconnected. Their reachable callers now decide the honest "not available"
/// state locally (support screens show a static message; the visual-search screen never
/// starts a fake search; filter_drawer.dart treats zero attribute schemas as the permanent
/// state) instead of calling a backend that could only ever fail or return empty. Combined
/// with the eager-crash-class services closed earlier this phase, `cloud_firestore` and
/// `firebase_core` now have zero remaining importers anywhere in this workspace (grepped) --
/// see this package's and the app's pubspec.yaml for the corresponding dependency removal.
library;

// Cache Service (for offline-first data loading)
export 'src/cache_service.dart';

// firebase_safety.dart retired (C3 corrective, 27 September 2026 review continuation, second
// pass): zero remaining callers -- every safeFirebaseUserId()/safeFirebaseCurrentUser() call site
// was itself already unreachable dead code (guarded on canonical auth, which never touches
// Firebase) or has been individually rewired (splash_screen.dart, ai_chat_screen.dart).

// C3 (Firebase SDK removal, 27 September 2026 review continuation): database_service.dart,
// auth_service.dart, storage_service.dart, order_notification_service.dart, order_service.dart,
// seller_service.dart, admin_service.dart, app_update_service.dart, ad_service.dart (+
// providers/ad_provider.dart, its only caller), fee_service.dart, invoice_service.dart and
// product_stats_service.dart deleted outright: all entirely Firestore/Firebase-Functions-backed,
// with zero real (non-comment) callers anywhere in this app, confirmed by grep. Most were already
// documented elsewhere as unreachable behind other retired providers' safeFirebaseUserId() == null
// guards; database_service.dart's one remaining call site was payment_method_screen.dart's own
// now-deleted _createOrder (see that file's own doc comment -- no canonical order/payment-creation
// endpoint is wired into this app yet, so purchase execution is now an honest "not available"
// state rather than dead Firestore code reached through a permanently-false guard).

// Stock Management
// stock_service.dart retired alongside database_service.dart above: its one caller was
// payment_method_screen.dart's own dead stock-validation-before-order-creation step.

// Returns & Exchange
export 'src/return_service.dart';

// AI Chat
export 'src/ai_chat_service.dart';

// Location
export 'src/location_service.dart';

// Payment
export 'src/payment_service.dart';
export 'src/payment/advanced_razorpay_service.dart';
// custom_checkout_service.dart retired (C3 corrective, 27 September 2026 review continuation):
// zero callers -- its only 3 consumers (custom_payment_sheet.dart, upi_payment_widget.dart,
// card_payment_widget.dart) were themselves already orphaned by payment_method_screen.dart's own
// honest "Checkout isn't available yet" dialog (see that screen's own doc comment); all 4 deleted
// together. cloud_functions has no other importer in this app now.

// Shared Preferences (now in core package)
// export 'src/shared_preferences_service.dart';
export 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart' show SharedPreferencesService;

// Providers
export 'src/providers/theme_provider.dart';
export 'src/providers/product_provider.dart';
export 'src/providers/category_provider.dart';
export 'src/providers/cart_provider.dart';
export 'src/providers/wishlist_provider.dart';
// banner_provider.dart retired (Phase 1R, R1.3): entirely Firestore/Storage, no canonical successor.
// order_provider.dart, sponsored_banner_provider.dart, app_update_provider.dart, address_provider.dart,
// review_provider.dart and coupon_provider.dart: exports retired in R1 corrective C2 (all Firestore-
// backed, address_provider.dart via the legacy AuthService/DatabaseService, with no canonical
// successor and no remaining consumer once their screens were disconnected); the source files
// themselves, re-confirmed still zero-consumer, deleted outright in C3's Firebase SDK removal pass.
// loyalty_provider.dart retired the same way (C3 corrective, 27 September 2026 review
// continuation) -- see main.dart's own doc comment for the full disposition, including its two
// remaining reachable entry points (home_app_bar.dart's badge, payment_method_screen.dart's
// redemption card) that this pass closed. ad_provider.dart (AdService-backed, "Seller app" per its
// own doc comment, a distinct class from the app-local marketplace_ad_provider.dart's
// MarketplaceAdProvider already deleted in C3) re-confirmed zero callers and deleted outright
// alongside ad_service.dart, rather than left "unused, out of scope" as an earlier pass in this
// same phase had judged -- that judgment predates this task's mandate to finish the whole sweep.

// Support Chat retired (Phase 1R final pass): support_chat_service.dart deleted -- see
// support_chat_screen.dart/support_conversations_screen.dart's own doc comments.

// Reels retired (C3 corrective, 27 September 2026 review continuation): reel_service.dart's
// constructor touched FirebaseFirestore.instance/FirebaseStorage.instance eagerly (the same crash
// class as AIChatService's own fields, fixed separately this same pass) -- confirmed already fixed
// at both real call sites in an earlier commit this phase (reels_feed_screen.dart/
// sponsored_products_banner.dart, see their own doc comments), leaving ReelService and
// ReelsPreloadProvider with zero real (non-comment) callers anywhere. Deleted outright, along with
// reel_model.dart/reel_stats_model.dart/reel_comment_model.dart (also zero callers once these were
// gone). Full reel/media commerce remains explicitly owned by its own later phase.

// Visual Search retired (Phase 1R final pass): visual_search_service.dart deleted -- its Gemini
// Vision image analysis worked (no Firebase involved) but the product-matching step was
// Firestore-backed with no canonical successor, so a "search" could never return real results end
// to end. See visual_search_screen.dart's own doc comment; that screen never starts a search now.

// Deals System
export 'src/deals/deal_service.dart';

// Category Attributes (Faceted Search) retired (Phase 1R final pass):
// category_attribute_service.dart deleted -- see filter_drawer.dart's own doc comment.

// Seller Analytics retired (C3 corrective, 27 September 2026 review continuation):
// seller_analytics_service.dart and marketplace_models' analytics_event.dart both deleted -- their
// only real caller (product_details_screen.dart's view/add-to-cart tracking) never once succeeded
// (Firestore write with no canonical successor), and every other method on the service was
// already unreachable. See that screen's own doc comment.
