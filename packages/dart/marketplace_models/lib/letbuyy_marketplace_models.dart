/// Shared data models for LetBuyy apps
library;

// Address
export 'src/address_model.dart';

// App Update retired (C3 corrective, 27 September 2026 review continuation, second pass):
// app_update_model.dart deleted alongside marketplace_ui_kit's update_dialog.dart (its only
// consumer, itself unreachable -- see that package's own barrel comment).

// Banner
// banner_model.dart retired with banner_provider.dart (Phase 1R, R1.3) — its only consumer.

// Cart
export 'src/cart_item_model.dart';
export 'src/cart_model.dart';

// Category
export 'src/category_model.dart';

// Chat
export 'src/chat_message.dart';

// Coupon
export 'src/coupon_model.dart';

// Location
export 'src/india_locations.dart';

// Notification retired (C3 corrective, 27 September 2026 review continuation): notification_model.dart
// deleted -- zero callers anywhere in the app or services (its own backend/provider never existed
// in the current tree either).

// Order
export 'src/order_item_model.dart';
export 'src/order_model.dart';
export 'src/order_timeline_model.dart';

// Payment
export 'src/payment_settings_model.dart';
export 'src/upi_app_model.dart';

// Product
export 'src/product_model.dart';

// Review retired (C3 corrective): review_model.dart deleted -- zero callers; product reviews are
// not backed by any live provider/service in this tree.

// Seller retired in full (C3 corrective): seller_model.dart (its last real caller,
// seller_store_screen.dart, was rewired onto ProductProvider's already-loaded canonical feed --
// see that screen's own doc comment), seller_info_model.dart and sponsored_banner_model.dart all
// deleted -- zero callers remain.

// User model retired (C3 corrective): user_model.dart deleted -- zero callers; BuyerAccount
// (letbuyy_api_client) is the canonical buyer identity type this app actually uses.

// Wishlist
export 'src/wishlist_model.dart';

// Returns & Exchange
export 'src/return_status.dart';
export 'src/return_reason_model.dart';
export 'src/return_request_model.dart';

// Sponsored Ads System retired in full (C3 corrective): ad_campaign_model.dart, ad_product_model.dart,
// ad_wallet_model.dart, ad_tracking_models.dart, keyword_bid_model.dart all deleted -- zero callers
// anywhere in the app or services (this marketplace app never wired a sponsored-ads UI/provider).

// Support Chat
export 'src/support_chat_model.dart';

// Reels (Short-form Video) retired (C3 corrective, 27 September 2026 review continuation):
// reel_model.dart/reel_stats_model.dart/reel_comment_model.dart deleted alongside
// marketplace_services' ReelService/ReelsPreloadProvider -- see that package's own barrel comment.

// Loyalty System retired (C3 corrective, 27 September 2026 review continuation): loyalty_model.dart
// deleted alongside LoyaltyProvider/LoyaltyService -- see main.dart's own doc comment.

// Deals System
export 'src/deal_model.dart';

// Search retired (C3 corrective): trending_search_model.dart deleted -- zero callers.

// Category Attributes (Faceted Search)
export 'src/category_attribute_schema_model.dart';

// Commission System retired (C3 corrective): commission_settings_model.dart deleted -- zero callers
// (this is a merchant-side SaaS billing concept with no wiring into the marketplace app).

// Delivery & Invoice System retired (C3 corrective): fee_config_model.dart and
// order_invoice_model.dart both deleted -- zero callers.

// Analytics & Heatmap retired (C3 corrective): analytics_event.dart deleted alongside
// marketplace_services' seller_analytics_service.dart -- see that package's own barrel comment.

// Store Builder (Sections & Blocks) retired (C3 corrective): section_model.dart,
// store_template_model.dart and section_defaults.dart (which only existed to construct
// SectionModel/BlockModel instances) all deleted -- zero callers; this marketplace app has no
// merchant storefront-builder surface.

// Subscription & Payment System (SaaS) retired (C3 corrective): subscription_model.dart,
// payment_config_model.dart and team_member_model.dart all deleted -- zero callers (merchant-side
// SaaS billing concepts with no wiring into this marketplace app).
