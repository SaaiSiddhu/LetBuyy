/// Shared data models for LetBuyy apps
library;

// Address
export 'src/address_model.dart';

// App Update
export 'src/app_update_model.dart';

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

// Notification
export 'src/notification_model.dart';

// Order
export 'src/order_item_model.dart';
export 'src/order_model.dart';
export 'src/order_timeline_model.dart';

// Payment
export 'src/payment_settings_model.dart';
export 'src/upi_app_model.dart';

// Product
export 'src/product_model.dart';

// Review
export 'src/review_model.dart';

// Seller
export 'src/seller_info_model.dart';
export 'src/seller_model.dart';
export 'src/sponsored_banner_model.dart';

// User
export 'src/user_model.dart';

// Wishlist
export 'src/wishlist_model.dart';

// Returns & Exchange
export 'src/return_status.dart';
export 'src/return_reason_model.dart';
export 'src/return_request_model.dart';

// Sponsored Ads System
export 'src/ad_campaign_model.dart';
export 'src/ad_product_model.dart';
export 'src/ad_wallet_model.dart';
export 'src/ad_tracking_models.dart';
export 'src/keyword_bid_model.dart';

// Support Chat
export 'src/support_chat_model.dart';

// Reels (Short-form Video)
export 'src/reel_model.dart';
export 'src/reel_stats_model.dart';
export 'src/reel_comment_model.dart';

// Loyalty System retired (C3 corrective, 27 September 2026 review continuation): loyalty_model.dart
// deleted alongside LoyaltyProvider/LoyaltyService -- see main.dart's own doc comment.

// Deals System
export 'src/deal_model.dart';

// Search
export 'src/trending_search_model.dart';

// Category Attributes (Faceted Search)
export 'src/category_attribute_schema_model.dart';

// Commission System
export 'src/commission_settings_model.dart';

// Delivery & Invoice System
export 'src/fee_config_model.dart';
export 'src/order_invoice_model.dart';

// Analytics & Heatmap
export 'src/analytics_event.dart';

// Store Builder (Sections & Blocks)
export 'src/section_model.dart';
export 'src/store_template_model.dart';
export 'src/section_defaults.dart';

// Subscription & Payment System (SaaS)
export 'src/subscription_model.dart';
export 'src/payment_config_model.dart';
export 'src/team_member_model.dart';
