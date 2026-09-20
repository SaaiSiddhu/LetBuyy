// lib/app/routes.dart
// Seller App Routes - Unified & Clean

import 'package:flutter/material.dart';

// Auth Screens
import '../screens/auth/login_screen.dart';
import '../screens/auth/signup_screen.dart';
import '../screens/auth/email_verification_screen.dart';
import '../screens/auth/verify_seller_email_callback_screen.dart';
import '../screens/auth/seller_welcome_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/reset_password_screen.dart';

// KYC Screens
import '../screens/kyc/kyc_wizard_screen.dart';
import '../screens/kyc/kyc_status_screen.dart';
import '../screens/kyc/kyc_rejected_screen.dart';
import '../screens/kyc/suspended_screen.dart';

// Main Screens
import '../screens/seller_main_screen.dart';
import '../screens/seller_dashboard.dart';
import '../screens/profile/seller_profile_screen.dart';
import '../screens/products/seller_product_management_screen.dart';
import '../screens/orders/seller_order_management_screen.dart';
import '../screens/wallet/seller_wallet_screen.dart';
import '../screens/analytics/seller_analytics_screen.dart';
import '../screens/settings/seller_settings_screen.dart';
import '../screens/settings/terms_screen.dart';
import '../screens/settings/privacy_screen.dart';
import '../screens/settings/help_support_screen.dart';
import '../screens/chat/ai_chat_screen.dart';
import '../screens/chat/chat_history_screen.dart';
import '../screens/notifications/notifications_screen.dart';

// Returns Screens
import '../screens/returns/seller_returns_screen.dart';
import '../screens/returns/return_detail_screen.dart';

// Download Screen
import '../screens/download/download_screen.dart';

class AppRoutes {
  static const String baseUrl = 'https://letbuy-y.web.app';
  static const String appScheme = 'letbuyy';

  // Auth routes
  static const String splash = '/';
  static const String auth = '/auth';
  static const String login = '/login';
  static const String signup = '/signup';
  static const String verifyEmail = '/verify-email';
  static const String verifySellerEmailCallback = '/verify-seller-email';
  static const String completeProfile = '/complete-profile';
  static const String welcome = '/welcome';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';

  // KYC routes (3-step wizard: Business, Identity, Bank)
  static const String kycWizard = '/kyc-wizard';
  static const String kycBusiness = '/kyc-wizard/business';
  static const String kycStatus = '/kyc-status';
  static const String kycRejected = '/kyc-rejected';
  static const String suspended = '/suspended';
  
  // Step name to index mapping (3 steps - Business, Identity, Bank)
  static const Map<String, int> kycStepMap = {
    'business': 0,
    'identity': 1,
    'bank': 2,
  };
  
  // Index to step name mapping
  static const List<String> kycStepNames = ['business', 'identity', 'bank'];

  // Main navigation
  static const String sellerMain = '/seller-main';
  static const String sellerDashboard = '/seller-dashboard';
  static const String sellerProfile = '/seller-profile';
  static const String sellerProducts = '/seller/products';
  static const String sellerOrders = '/seller/orders';
  static const String sellerWallet = '/seller/wallet';
  static const String sellerAnalytics = '/seller/analytics';
  static const String sellerSettings = '/seller/settings';
  static const String notifications = '/notifications';

  // Returns
  static const String sellerReturns = '/seller/returns';
  static const String returnDetail = '/seller/returns/detail';

  // Chat
  static const String aiChat = '/ai-chat';
  static const String chatHistory = '/chat-history';

  // Legal & Support
  static const String terms = '/terms';
  static const String privacy = '/privacy';
  static const String helpSupport = '/help-support';

  // Download
  static const String download = '/download';

  // Compatibility aliases
  static const String main = sellerMain;

  // Route generator
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    debugPrint('🔄 Seller Route: ${settings.name}');

    final uri = Uri.tryParse(settings.name ?? '/');
    final routePath = uri?.path ?? settings.name ?? '/';
    final queryParams = uri?.queryParameters ?? {};

    switch (routePath) {
      // Auth Flow - splash redirects to login (AuthGate handles initial routing)
      case splash:
      case '/':
        return _buildRoute(const LoginScreen(), settings);

      case auth:
      case login:
        return _buildRoute(const LoginScreen(), settings);

      case signup:
        return _buildRoute(const SignupScreen(), settings);

      case verifyEmail:
        String email = '';
        String sellerId = '';
        String userName = '';
        if (settings.arguments is String) {
          email = settings.arguments as String;
        } else if (settings.arguments is Map<String, dynamic>) {
          final args = settings.arguments as Map<String, dynamic>;
          email = args['email'] ?? '';
          sellerId = args['sellerId'] ?? '';
          userName = args['userName'] ?? '';
        }
        return _buildRoute(
          EmailVerificationScreen(email: email, sellerId: sellerId, userName: userName), 
          settings,
        );



      case welcome:
        return _buildRoute(const SellerWelcomeScreen(), settings);

      case verifySellerEmailCallback:
        String? token = queryParams['token'];
        String? sellerId = queryParams['sellerId'];
        if (settings.arguments is Map<String, dynamic>) {
          final args = settings.arguments as Map<String, dynamic>;
          token ??= args['token'];
          sellerId ??= args['sellerId'];
        }
        return _buildRoute(
          VerifySellerEmailCallbackScreen(token: token, sellerId: sellerId),
          settings,
        );

      case forgotPassword:
        return _buildRoute(const ForgotPasswordScreen(), settings);

      case resetPassword:
        String? token = queryParams['token'];
        String? uid = queryParams['uid'];
        if (settings.arguments is Map<String, dynamic>) {
          final args = settings.arguments as Map<String, dynamic>;
          token ??= args['token'];
          uid ??= args['uid'];
        }
        if (token == null || uid == null) {
          return _buildErrorRoute('Invalid reset password link', settings);
        }
        return _buildRoute(
          ResetPasswordScreen(token: token, uid: uid),
          settings,
        );

      // KYC Flow (3-step wizard)
      case kycWizard:
      case kycBusiness:
        return _buildRoute(const KycWizardScreen(initialStep: 0), settings);

      case kycStatus:
        return _buildRoute(const KycStatusScreen(), settings);

      case kycRejected:
        return _buildRoute(const KycRejectedScreen(), settings);

      case suspended:
        return _buildRoute(const SuspendedScreen(), settings);

      // Main Screens
      case sellerMain:
        return _buildRoute(const SellerMainScreen(), settings);

      case sellerDashboard:
        return _buildRoute(const SellerDashboard(), settings);

      case sellerProfile:
        return _buildRoute(const SellerProfileScreen(), settings);

      case sellerProducts:
        return _buildRoute(const SellerProductManagementScreen(), settings);

      case sellerOrders:
        return _buildRoute(const SellerOrderManagementScreen(), settings);

      case sellerWallet:
        return _buildRoute(const SellerWalletScreen(), settings);

      case sellerAnalytics:
        return _buildRoute(const SellerAnalyticsScreen(), settings);

      case sellerSettings:
        return _buildRoute(const SellerSettingsScreen(), settings);

      case notifications:
        return _buildRoute(const NotificationsScreen(), settings);

      // Returns Management
      case sellerReturns:
        return _buildRoute(const SellerReturnsScreen(), settings);

      case returnDetail:
        final returnId = settings.arguments as String?;
        if (returnId == null) {
          return _buildErrorRoute('Return ID required', settings);
        }
        return _buildRoute(ReturnDetailScreen(returnId: returnId), settings);

      case aiChat:
        return _buildRoute(const AIChatScreen(), settings);

      case chatHistory:
        return _buildRoute(const ChatHistoryScreen(), settings);

      // Legal & Support
      case terms:
        return _buildRoute(const TermsScreen(), settings);

      case privacy:
        return _buildRoute(const PrivacyScreen(), settings);

      case helpSupport:
        return _buildRoute(const HelpSupportScreen(), settings);

      // Download page (public)
      case download:
        return _buildRoute(const DownloadScreen(), settings);

      default:
        return _buildErrorRoute('Route not found: ${settings.name}', settings);
    }
  }

  static MaterialPageRoute _buildRoute(Widget screen, RouteSettings settings) {
    return MaterialPageRoute(settings: settings, builder: (_) => screen);
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
                onPressed: () => Navigator.pushReplacementNamed(context, splash),
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
      Navigator.pushReplacementNamed(context, splash);
    }
  }
}