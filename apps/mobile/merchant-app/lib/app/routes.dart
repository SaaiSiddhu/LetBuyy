import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// All other screens are imported but Flutter's tree-shaking
// will handle optimization at build time

import '../screens/splash/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/otp_screen.dart';
import '../screens/auth/error_screen.dart';
import '../screens/auth/turnstile_challenge_screen.dart';
import '../screens/wizard/create_store_wizard.dart';
import '../screens/wizard/store_published_screen.dart';
import '../screens/main/store_main_screen.dart';
import '../screens/premium/upgrade_screen.dart';
import '../screens/preview/live_preview_screen.dart';
import '../screens/settings/domain_settings_screen.dart';
import '../screens/settings/seo_settings_screen.dart';
import '../screens/settings/shipping_screen.dart';
import '../screens/settings/store_details_screen.dart';
import '../screens/settings/taxes_screen.dart';
import '../screens/settings/notifications_screen.dart';
import '../screens/settings/help_screen.dart';
import '../screens/analytics/analytics_screen.dart';
import '../screens/customers/customer_detail_screen.dart';
import '../screens/customers/customers_screen.dart';
import '../screens/discounts/coupon_form_screen.dart';
import '../screens/discounts/coupons_screen.dart';
import '../screens/content/blog_screen.dart';
import '../screens/content/media_library_screen.dart';
import '../screens/content/navigation_screen.dart';
import '../screens/content/pages_screen.dart';
import '../screens/inventory/inventory_screen.dart';
import '../screens/orders/order_detail_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/subscription/pricing_screen.dart';
import '../screens/subscription/connect_razorpay_screen.dart';
import '../screens/parity/merchant_feature_definitions.dart';
import '../screens/parity/merchant_feature_screen.dart';
import 'auth_wrapper.dart';

/// App route definitions
class AppRoutes {
  // Auth routes
  static const String auth = '/'; // Auth wrapper is root route for mobile
  static const String splash = '/splash';
  static const String login = '/login';
  static const String otp = '/otp';
  static const String turnstileChallenge = '/turnstile-challenge';
  static const String error = '/error';

  // Wizard routes
  static const String createStore = '/create-store';
  static const String wizard = '/create-store'; // Alias
  static const String storePublished = '/store-published';

  // Auth flow routes
  static const String setPassword = '/set-password';
  // Note: onboarding route kept for backwards compatibility - redirects to wizard

  // Main app routes
  static const String main = '/main';
  static const String upgrade = '/upgrade';

  // New supporting routes
  static const String livePreview = '/live-preview';
  static const String domainSettings = '/domain-settings';
  static const String seoSettings = '/seo-settings';
  static const String storeDetails = '/store-details';
  static const String notifications = '/notifications';
  static const String shipping = '/shipping';
  static const String taxes = '/taxes';
  static const String help = '/help';
  static const String analytics = '/analytics';
  static const String customers = '/customers';
  static const String customerDetail = '/customers/detail';
  static const String coupons = '/coupons';
  static const String couponForm = '/coupons/form';
  static const String pages = '/pages';
  static const String blog = '/blog';
  static const String navigation = '/navigation';
  static const String media = '/media';
  static const String inventory = '/inventory';
  static const String orders = '/orders';
  static const String orderDetail = '/orders/detail';
  static const String pricing = '/pricing';
  static const String connectRazorpay = '/connect-razorpay';

  /// Generate routes with optimized page transitions
  static Route<dynamic> generateRoute(RouteSettings settings) {
    if (settings.name == '/features/order-detail') {
      return _buildRoute(const OrdersScreen(), settings);
    }
    if (settings.name == '/features/customers') {
      return _buildRoute(const CustomersScreen(), settings);
    }
    if (settings.name == '/features/inventory') {
      return _buildRoute(const InventoryScreen(), settings);
    }
    if (settings.name == '/features/coupons') {
      return _buildRoute(const CouponsScreen(), settings);
    }
    if (settings.name == '/features/pages') {
      return _buildRoute(const PagesScreen(), settings);
    }
    if (settings.name == '/features/blog') {
      return _buildRoute(const BlogScreen(), settings);
    }
    if (settings.name == '/features/navigation') {
      return _buildRoute(const NavigationScreen(), settings);
    }
    if (settings.name == '/features/media') {
      return _buildRoute(const MediaLibraryScreen(), settings);
    }
    if (settings.name == '/features/notifications') {
      return _buildRoute(const NotificationsScreen(), settings);
    }
    if (settings.name == '/features/shipping') {
      return _buildRoute(const ShippingScreen(), settings);
    }
    if (settings.name == '/features/taxes') {
      return _buildRoute(const TaxesScreen(), settings);
    }

    final feature = MerchantFeatureDefinitions.byRoute[settings.name];
    if (feature != null) {
      return _buildRoute(MerchantFeatureScreen(feature: feature), settings);
    }

    switch (settings.name) {
      case auth:
        // Auth wrapper is the primary mobile entry point
        return _buildFastRoute(const AuthWrapper(), settings);

      case splash:
        return _buildRoute(const SplashScreen(), settings);

      case login:
        return _buildRoute(const LoginScreen(), settings);

      case otp:
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        return _buildRoute(
          OtpScreen(
            email: args['email'] as String? ?? '',
            password: args['password'] as String? ?? '',
            name: args['name'] as String?,
          ),
          settings,
        );

      case turnstileChallenge:
        return _buildRoute(const TurnstileChallengeScreen(), settings);

      case error:
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(
          ErrorScreen(
            title: args?['title'] ?? 'Error',
            message: args?['message'] ?? 'Something went wrong',
          ),
          settings,
        );

      case '/onboarding':
        // Backwards compatibility - redirect to wizard (handles onboarding now)
        return _buildRoute(const CreateStoreWizard(), settings);

      case createStore:
        return _buildRoute(const CreateStoreWizard(), settings);

      case storePublished:
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(
          StorePublishedScreen(
            storeId: args?['storeId'] ?? '',
            storeName: args?['storeName'] ?? '',
            subdomain: args?['subdomain'] ?? '',
          ),
          settings,
        );

      case main:
        return _buildRoute(const StoreMainScreen(), settings);

      case upgrade:
        return _buildRoute(const UpgradeScreen(), settings);

      case livePreview:
        final args = settings.arguments as Map<String, dynamic>?;
        return _buildRoute(
          LivePreviewScreen(
            storeUrl: args?['storeUrl'] ?? '',
            storeName: args?['storeName'] ?? 'Store',
          ),
          settings,
        );

      case domainSettings:
        return _buildRoute(const DomainSettingsScreen(), settings);

      case seoSettings:
        return _buildRoute(const SEOSettingsScreen(), settings);

      case storeDetails:
        return _buildRoute(const StoreDetailsScreen(), settings);

      case notifications:
        return _buildRoute(const NotificationsScreen(), settings);

      case shipping:
        return _buildRoute(const ShippingScreen(), settings);

      case taxes:
        return _buildRoute(const TaxesScreen(), settings);

      case help:
        return _buildRoute(const HelpScreen(), settings);

      case analytics:
        return _buildRoute(const AnalyticsScreen(), settings);

      case customers:
        return _buildRoute(const CustomersScreen(), settings);

      case customerDetail:
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final customer = args['customer'];
        return _buildRoute(
          CustomerDetailScreen(
            email: args['email'] as String? ?? '',
            initialCustomer: customer is CustomerContract ? customer : null,
          ),
          settings,
        );

      case coupons:
        return _buildRoute(const CouponsScreen(), settings);

      case couponForm:
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final coupon = args['coupon'];
        return _buildRoute(
          CouponFormScreen(
            storeId: args['storeId'] as String? ?? '',
            coupon: coupon is CouponContract ? coupon : null,
          ),
          settings,
        );

      case pages:
        return _buildRoute(const PagesScreen(), settings);

      case blog:
        return _buildRoute(const BlogScreen(), settings);

      case navigation:
        return _buildRoute(const NavigationScreen(), settings);

      case media:
        return _buildRoute(const MediaLibraryScreen(), settings);

      case inventory:
        return _buildRoute(const InventoryScreen(), settings);

      case orders:
        return _buildRoute(const OrdersScreen(), settings);

      case orderDetail:
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final order = args['order'];
        return _buildRoute(
          OrderDetailScreen(
            orderId: args['orderId'] as String? ?? '',
            initialOrder: order is OrderContract ? order : null,
          ),
          settings,
        );

      case pricing:
        return _buildRoute(const PricingScreen(), settings);

      case connectRazorpay:
        return _buildRoute(const ConnectRazorpayScreen(), settings);

      default:
        return _buildRoute(
          Scaffold(
            body: Center(child: Text('Route not found: ${settings.name}')),
          ),
          settings,
        );
    }
  }

  /// Fast route for root auth wrapper - no animation delay
  static PageRoute _buildFastRoute(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, __, ___) => page,
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
    );
  }

  /// Standard route with smooth animation
  static MaterialPageRoute _buildRoute(Widget page, RouteSettings settings) {
    return MaterialPageRoute(builder: (_) => page, settings: settings);
  }
}
