/// Shared backend services for LetBuyy apps.
///
/// BOUNDED COMPATIBILITY PACKAGE — NOT the canonical service layer. Firebase-
/// coupled (firebase_core/auth/firestore/functions/storage/messaging), retained
/// only so `customer_app` resolves/analyzes/tests (`admin_app` was retired to a
/// RESERVED root in phase FB-1, 2026-09-05, and no longer consumes it). Disposition:
/// D0_BLOCKED pending the canonical-backend decision (LETBUYY_CONSTITUTION.md,
/// D-0). Do not extend or use as a template — see this package's README.md and
/// docs/migration/repository_consolidation/18_dart_package_recovery_journal.md.
library;

// Cache Service (for offline-first data loading)
export 'src/cache_service.dart';

// Database
export 'src/database_service.dart';

// Authentication
export 'src/auth_service.dart';
export 'src/firebase_safety.dart';

// Storage
export 'src/storage_service.dart';

// FCM & Notifications
// fcm_service.dart and notification_service.dart retired (Phase 1R, R1.4): FCM's only caller was
// main.dart's now-removed boot sequence; both were already zero-referenced anywhere else.
export 'src/order_notification_service.dart';

// Order
export 'src/order_service.dart';

// Stock Management
export 'src/stock_service.dart';

// Returns & Exchange
export 'src/return_service.dart';

// Seller
export 'src/seller_service.dart';

// Admin
export 'src/admin_service.dart';

// AI Chat
export 'src/ai_chat_service.dart';

// Analytics
// analytics_service.dart (firebase_analytics) retired (Phase 1R, R1.4): zero callers anywhere —
// not to be confused with seller_analytics_service.dart (Firestore-based, still live, unrelated).

// App Update
export 'src/app_update_service.dart';

// Location
export 'src/location_service.dart';

// Payment
export 'src/payment_service.dart';
export 'src/payment/advanced_razorpay_service.dart';
export 'src/payment/custom_checkout_service.dart';

// Shared Preferences (now in core package)
// export 'src/shared_preferences_service.dart';
export 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart' show SharedPreferencesService;

// Providers
export 'src/providers/theme_provider.dart';
export 'src/providers/product_provider.dart';
export 'src/providers/order_provider.dart';
export 'src/providers/category_provider.dart';
export 'src/providers/cart_provider.dart';
export 'src/providers/wishlist_provider.dart';
export 'src/providers/coupon_provider.dart';
// banner_provider.dart retired (Phase 1R, R1.3): entirely Firestore/Storage, no canonical successor.
// sponsored_banner_provider.dart, app_update_provider.dart, address_provider.dart and
// review_provider.dart exports retired (R1 corrective, C2): all Firestore-backed (address_provider.dart
// via the legacy AuthService/DatabaseService) with no canonical successor and no remaining consumer
// once their screens were disconnected. Provider source files themselves stay until C3's Firebase
// SDK removal pass. ad_provider.dart (AdProvider, "Seller app" per its own doc comment) is a distinct
// class from marketplace_ad_provider.dart's MarketplaceAdProvider, unused by this app -- out of
// scope here, left untouched.
export 'src/providers/ad_provider.dart';

// Sponsored Ads
export 'src/ad_service.dart';

// Support Chat
export 'src/support_chat_service.dart';

// Reels
export 'src/reel_service.dart';
export 'src/reels_preload_provider.dart';

// Loyalty System
export 'src/loyalty_service.dart';
export 'src/providers/loyalty_provider.dart';

// Visual Search
export 'src/visual_search_service.dart';

// Deals System
export 'src/deals/deal_service.dart';

// Category Attributes (Faceted Search)
export 'src/category_attribute_service.dart';

// Delivery & Invoice System
export 'src/fee_service.dart';
export 'src/invoice_service.dart';

// Product Stats (for seller dashboard)
export 'src/product_stats_service.dart';

// Seller Analytics (for heatmap dashboard)
export 'src/seller_analytics_service.dart';
