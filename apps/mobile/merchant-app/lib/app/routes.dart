import 'package:flutter/material.dart';

// Only import landing screen eagerly - it's the first screen users see
import '../screens/landing/landing_screen.dart';

// All other screens are imported but Flutter's tree-shaking
// will handle optimization at build time

import '../screens/splash/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/error_screen.dart';
import '../screens/wizard/create_store_wizard.dart';
import '../screens/wizard/store_published_screen.dart';
import '../screens/main/store_main_screen.dart';
import '../screens/premium/upgrade_screen.dart';
import '../screens/download/download_screen.dart';
import '../screens/preview/live_preview_screen.dart';
import '../screens/settings/domain_settings_screen.dart';
import '../screens/settings/seo_settings_screen.dart';
import '../screens/settings/store_details_screen.dart';
import '../screens/settings/help_screen.dart';
import '../screens/analytics/analytics_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/subscription/pricing_screen.dart';
import '../screens/subscription/connect_razorpay_screen.dart';
import 'auth_wrapper.dart';

/// App route definitions
class AppRoutes {
  // Landing & Auth routes
  static const String auth = '/'; // Auth wrapper is root route for mobile
  static const String landing = '/landing'; // Landing is web-only
  static const String splash = '/splash';
  static const String login = '/login';
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
  static const String download = '/download';
  
  // New supporting routes
  static const String livePreview = '/live-preview';
  static const String domainSettings = '/domain-settings';
  static const String seoSettings = '/seo-settings';
  static const String storeDetails = '/store-details';
  static const String help = '/help';
  static const String analytics = '/analytics';
  static const String orders = '/orders';
  static const String pricing = '/pricing';
  static const String connectRazorpay = '/connect-razorpay';

  /// Generate routes with optimized page transitions
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case auth:
        // Auth wrapper is the primary mobile entry point
        return _buildFastRoute(const AuthWrapper(), settings);
      
      case landing:
        // Landing page - web only
        return _buildFastRoute(const LandingScreen(), settings);
      
      case splash:
        return _buildRoute(const SplashScreen(), settings);
      
      case login:
        return _buildRoute(const LoginScreen(), settings);
      
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
      
      case download:
        return _buildRoute(const DownloadScreen(), settings);
        
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
        
      case help:
        return _buildRoute(const HelpScreen(), settings);
        
      case analytics:
        return _buildRoute(const AnalyticsScreen(), settings);
        
      case orders:
        return _buildRoute(const OrdersScreen(), settings);
      
      case pricing:
        return _buildRoute(const PricingScreen(), settings);
      
      case connectRazorpay:
        return _buildRoute(const ConnectRazorpayScreen(), settings);
      
      default:
        return _buildRoute(
          Scaffold(
            body: Center(
              child: Text('Route not found: ${settings.name}'),
            ),
          ),
          settings,
        );
    }
  }

  /// Fast route for landing page - no animation delay
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
    return MaterialPageRoute(
      builder: (_) => page,
      settings: settings,
    );
  }
}
