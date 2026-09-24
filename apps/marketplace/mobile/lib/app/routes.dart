// lib/app/routes.dart
// Marketplace App Routes

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
// Splash screen removed - app starts directly
import '../screens/onboarding/onboarding_screen.dart';
import '../screens/auth/auth_screen.dart';
import '../screens/main_screen.dart';
import '../screens/web_main_screen.dart';
import '../screens/shop/product_details_screen.dart';
import '../screens/shop/seller_store_screen.dart'; // NEW
import '../screens/wishlist/wishlist_screen.dart';
import '../screens/profile/edit_profile_screen.dart';
import '../screens/profile/saved_addresses_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/chat/ai_chat_screen.dart';
// Return Screens
import '../screens/returns/my_returns_screen.dart';
import '../screens/returns/return_request_screen.dart';
import '../screens/returns/return_tracking_screen.dart';
// Notification Screen
import '../screens/notifications/notification_screen.dart';
// Support Chat
import '../screens/support/support_chat_screen.dart';
import '../screens/support/support_conversations_screen.dart';
// Reels
import '../screens/reels/reels_feed_screen.dart';
import '../screens/reels/saved_reels_screen.dart'; // ✅ NEW
import '../screens/shop/seller_profile_screen.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../screens/search/search_screen.dart';
import '../screens/search/visual_search_screen.dart';
import '../screens/loyalty/loyalty_screen.dart';
// Checkout
import '../screens/checkout/checkout_screen.dart';
import '../screens/checkout/order_success_screen.dart';
import '../screens/checkout/add_address_screen.dart';
// Order Screens
import '../screens/orders/order_details_screen.dart';
import '../screens/orders/order_tracking_screen.dart';
// Downloads
import '../screens/downloads/download_screen.dart';

class AppRoutes {
  static const String baseUrl = 'https://letbuyy.com';
  static const String appScheme = 'letbuyy';

  // Root routes
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String auth = '/auth';
  static const String login = '/login';
  static const String register = '/register';

  // Main navigation
  static const String main = '/main';
  static const String home = '/home';
  static const String shop = '/shop';
  static const String categories = '/categories';
  static const String cart = '/cart';
  static const String wishlist = '/wishlist';
  static const String profile = '/profile';
  static const String editProfile = '/edit-profile';
  static const String orders = '/orders';
  static const String myOrders = '/my-orders';
  static const String addresses = '/profile/addresses';
  
  // Returns
  static const String myReturns = '/my-returns';
  static const String returnRequest = '/return-request';
  static const String returnTracking = '/return-tracking';
  
  // Chat
  static const String aiChat = '/ai-chat';
  static const String supportChat = '/support-chat';
  static const String supportConversations = '/support-conversations';
  
  // Notifications
  static const String notifications = '/notifications';
   
  // Product
  static const String productDetails = '/product-details';
  static const String productDetail = '/product-details';  // Alias
  
  // Recently Viewed
  static const String recentlyViewed = '/recently-viewed';
  
  // Seller Profile
  static const String sellerProfile = '/seller-profile';
  static const String sellerStore = '/seller-store';
  
  // Checkout
  static const String checkout = '/checkout';
  static const String orderSuccess = '/order-success';
  
  // Search
  static const String search = '/search';
  static const String searchResults = '/search/results';
  static const String visualSearch = '/visual-search';
  
  // Reels
  static const String reels = '/reels';
  static const String savedReels = '/saved-reels'; // ✅ NEW
  
  // Loyalty
  static const String loyalty = '/loyalty';
  
  // Order Details & Tracking
  static const String orderDetails = '/order-details';
  static const String orderTracking = '/order-tracking';
  
  // Add Address
  static const String addAddress = '/add-address';
  
  // Downloads
  static const String download = '/download';

  // Route generator
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    debugPrint('🔄 Marketplace Route: ${settings.name}');
    String routeName = settings.name ?? '';

    // ✅ Handle deep links: Extract path from full URL
    // When deep links open the app, the full URL may be passed as the route name
    if (routeName.startsWith('http://') || routeName.startsWith('https://')) {
      try {
        final uri = Uri.parse(routeName);
        routeName = uri.path.isEmpty ? '/' : uri.path;
        debugPrint('🔗 Deep link detected, extracted path: $routeName');
      } catch (e) {
        debugPrint('⚠️ Error parsing URL: $e');
      }
    }

    // ✅ Handle /product/:id routes
    if (routeName.startsWith('/product/')) {
      final productId = routeName.replaceFirst('/product/', '');
      if (productId.isNotEmpty) {
        debugPrint('📦 Opening product: $productId');
        return _buildRoute(ProductDetailsScreen(productId: productId), settings);
      }
    }
    
    // ✅ Handle /reels/:id routes for deep linking to specific reels
    if (routeName.startsWith('/reels/') && routeName != '/reels/') {
      final reelId = routeName.replaceFirst('/reels/', '');
      if (reelId.isNotEmpty) {
        debugPrint('🎬 Opening specific reel: $reelId');
        return _buildRoute(ReelsFeedScreen(initialReelId: reelId), settings);
      }
    }
    
    // ✅ Handle /seller-profile/:id routes
    if (routeName.startsWith('/seller-profile/')) {
      final sellerId = routeName.replaceFirst('/seller-profile/', '');
      if (sellerId.isNotEmpty) {
        debugPrint('🏪 Opening seller profile: $sellerId');
        return _buildRoute(SellerProfileScreen(sellerId: sellerId), settings);
      }
    }
    
    // ✅ Handle /orders/:id routes for deep linking to order details
    if (routeName.startsWith('/orders/')) {
      final orderId = routeName.replaceFirst('/orders/', '');
      if (orderId.isNotEmpty) {
        debugPrint('📋 Opening order details: $orderId');
        return _buildRoute(OrderDetailsScreen(orderId: orderId), settings);
      }
    }
    
    // ✅ Handle /return-tracking/:id routes
    if (routeName.startsWith('/return-tracking/')) {
      final returnId = routeName.replaceFirst('/return-tracking/', '');
      if (returnId.isNotEmpty) {
        debugPrint('📦 Opening return tracking: $returnId');
        return _buildRoute(ReturnTrackingScreen(returnId: returnId), settings);
      }
    }

    switch (routeName) {
      case splash:
      case '/':
        // Skip splash - go directly to main screen
        // 🌐 Web uses WebMainScreen with sidebar, native uses MainScreen
        return _buildRoute(
          kIsWeb 
            ? const WebMainScreen(initialIndex: 0) 
            : const MainScreen(initialIndex: 0), 
          settings,
        );

      case onboarding:
        return _buildRoute(const OnboardingScreen(), settings);

      case auth:
      case login:
      case register:
        return _buildRoute(const AuthScreen(), settings);

      case main:
        final args = settings.arguments as Map<String, dynamic>?;
        final initialIndex = args?['initialIndex'] as int? ?? 0;
        return _buildRoute(
          kIsWeb 
            ? WebMainScreen(initialIndex: initialIndex) 
            : MainScreen(initialIndex: initialIndex), 
          settings,
        );

      case home:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 0) : const MainScreen(initialIndex: 0), settings);
      case reels:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 1) : const MainScreen(initialIndex: 1), settings);
      case shop:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 2) : const MainScreen(initialIndex: 2), settings);
      case categories:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 3) : const MainScreen(initialIndex: 3), settings);
      case cart:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 4) : const MainScreen(initialIndex: 4), settings);
      case profile:
        return _buildRoute(kIsWeb ? const WebMainScreen(initialIndex: 5) : const MainScreen(initialIndex: 5), settings);
      case wishlist:
        return _buildRoute(const WishlistScreen(), settings);

      case editProfile:
      case '/edit-profile':
        return _buildRoute(const EditProfileScreen(), settings);

      case orders:
      case myOrders:
        return _buildRoute(const OrdersScreen(), settings);
        
      case addresses:
      case '/profile/addresses':
        return _buildRoute(const SavedAddressesScreen(), settings);

      case aiChat:
        return _buildRoute(const AIChatScreen(), settings);
      
      case search:
      case '/search':
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(const SearchScreen(), settings);
      
      case visualSearch:
      case '/visual-search':
        return _buildRoute(const VisualSearchScreen(), settings);
        
      case notifications:
      case '/notifications':
        return _buildRoute(const NotificationScreen(), settings);
        
      // Handle product details with arguments
      case productDetails:
      case productDetail:
        final args = settings.arguments;
        if (args is String) {
          return _buildRoute(ProductDetailsScreen(productId: args), settings);
        } else if (args is Map<String, dynamic>) {
          final productId = args['productId'] as String?;
          if (productId != null) {
            return _buildRoute(ProductDetailsScreen(productId: productId), settings);
          }
        }
        return _buildErrorRoute('Product ID required', settings);

      case sellerProfile:
        final sellerId = settings.arguments as String?;
        if (sellerId != null) {
          return _buildRoute(SellerProfileScreen(sellerId: sellerId), settings);
        }
        return _buildErrorRoute('Seller ID required', settings);

      case sellerStore:
        final sellerId = settings.arguments as String?;
        if (sellerId != null) {
          return _buildRoute(SellerStoreScreen(sellerId: sellerId), settings);
        }
        return _buildErrorRoute('Seller ID required', settings);

      // Return & Exchange routes
      case myReturns:
        return _buildRoute(const MyReturnsScreen(), settings);
        
      // ✅ Saved Reels
      case savedReels:
        return _buildRoute(const SavedReelsScreen(), settings);
      
      case loyalty:
        return _buildRoute(const LoyaltyScreen(), settings);
        
      case returnRequest:
        final args = settings.arguments as Map<String, dynamic>?;
        if (args != null) {
          return _buildRoute(
            ReturnRequestScreen(
              orderId: args['orderId'] as String,
              orderNumber: args['orderNumber'] as String,
              item: args['item'],
              orderTotal: args['orderTotal'] as double,
            ),
            settings,
          );
        }
        return _buildErrorRoute('Order details required', settings);
        
      case returnTracking:
        final returnId = settings.arguments as String?;
        if (returnId != null) {
          return _buildRoute(ReturnTrackingScreen(returnId: returnId), settings);
        }
        return _buildErrorRoute('Return ID required', settings);

      // Support Chat
      case supportChat:
      case '/support-chat':
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(
          SupportChatScreen(
            conversationId: args?['conversationId'] as String?,
            ticketType: args?['type'] == 'return_appeal'
                ? SupportTicketType.returnAppeal
                : args?['ticketType'] as SupportTicketType?,
            subject: args?['subject'] as String?,
            initialMessage: args?['prefillMessage'] as String?,
            metadata: args,
          ),
          settings,
        );

      // Support Conversations List (Chat History)
      case supportConversations:
      case '/support-conversations':
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(
          SupportConversationsScreen(
            newChatType: args?['type'] == 'return_appeal'
                ? SupportTicketType.returnAppeal
                : args?['ticketType'] as SupportTicketType?,
            newChatSubject: args?['subject'] as String?,
            newChatMessage: args?['initialMessage'] as String?,
            newChatMetadata: args,
          ),
          settings,
        );

      // ✅ Checkout Flow
      case checkout:
        return _buildRoute(const CheckoutScreen(), settings);

      case orderSuccess:
        final args = settings.arguments as Map<String, dynamic>?;
        if (args != null && args['order'] != null) {
          return _buildRoute(
            OrderSuccessScreen(
              order: args['order'] as OrderModel,
              additionalOrders: args['additionalOrders'] as List<OrderModel>?,
            ),
            settings,
          );
        }
        return _buildErrorRoute('Order data required', settings);

      // ✅ Order Details
      case orderDetails:
        final orderId = settings.arguments as String?;
        if (orderId != null) {
          return _buildRoute(OrderDetailsScreen(orderId: orderId), settings);
        }
        return _buildErrorRoute('Order ID required', settings);

      // ✅ Order Tracking
      case orderTracking:
        final args = settings.arguments;
        if (args is OrderModel) {
          return _buildRoute(OrderTrackingScreen(order: args), settings);
        }
        return _buildErrorRoute('Order data required', settings);

      // ✅ Add Address
      case addAddress:
        return _buildRoute(const AddAddressScreen(), settings);

      // ✅ Downloads
      case download:
      case '/downloads': // Legacy compatibility
        return _buildRoute(const DownloadScreen(), settings);

      default:
        return _buildErrorRoute('Route not found: ${settings.name}', settings);
    }
  }

  static MaterialPageRoute _buildRoute(Widget screen, RouteSettings settings) {
    return MaterialPageRoute(
      settings: settings,
      builder: (_) => screen,
    );
  }

  static MaterialPageRoute _buildErrorRoute(String message, RouteSettings settings) {
    return MaterialPageRoute(
      settings: settings,
      builder: (context) => Scaffold(
        appBar: AppBar(title: const Text('Error')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pushReplacementNamed(context, main),
                child: const Text('Go Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Navigation helpers
  static Future<dynamic> navigateTo(BuildContext context, String routeName, {dynamic arguments}) {
    return Navigator.pushNamed(context, routeName, arguments: arguments);
  }

  static Future<dynamic> navigateAndReplace(BuildContext context, String routeName, {dynamic arguments}) {
    return Navigator.pushReplacementNamed(context, routeName, arguments: arguments);
  }

  static Future<dynamic> navigateAndRemoveUntil(BuildContext context, String routeName, {dynamic arguments}) {
    return Navigator.pushNamedAndRemoveUntil(context, routeName, (route) => false, arguments: arguments);
  }

  static void goBack(BuildContext context, {dynamic result}) {
    if (Navigator.canPop(context)) {
      Navigator.pop(context, result);
    } else {
      Navigator.pushReplacementNamed(context, main);
    }
  }
}
